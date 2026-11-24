"""Écritures du domaine Agriculture. Les auteurs et l'espace sont toujours passés explicitement.

L'espace (organisation ou personnel) vient du contexte X-Workspace vérifié par la vue,
jamais du corps de la requête. PostgreSQL refuse de toute façon un mélange d'espaces
(clés étrangères composites, migration 0002).
"""

from __future__ import annotations

from datetime import date

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.actors.selectors import visible_producers
from apps.agriculture.models import (
    AgriculturalCampaign,
    AgriculturalOperation,
    CampaignStatus,
    Crop,
    CropCycle,
    CropCycleStatus,
    CropVariety,
    HarvestRecord,
    RecordSource,
)
from apps.core import services as core_services
from apps.parcels import selectors as parcel_selectors
from apps.parcels.models import CultivationUnitStatus, ParcelStatus

# Passages de statut autorisés (un cycle s'abandonne tant qu'il n'est pas récolté).
CYCLE_TRANSITIONS = {
    CropCycleStatus.PLANNED: {CropCycleStatus.IN_PROGRESS, CropCycleStatus.ABANDONED},
    CropCycleStatus.IN_PROGRESS: {CropCycleStatus.HARVESTED, CropCycleStatus.ABANDONED},
    CropCycleStatus.HARVESTED: set(),
    CropCycleStatus.ABANDONED: set(),
}
CAMPAIGN_TRANSITIONS = {
    CampaignStatus.PLANNED: {CampaignStatus.ACTIVE, CampaignStatus.CLOSED},
    CampaignStatus.ACTIVE: {CampaignStatus.CLOSED},
    CampaignStatus.CLOSED: set(),
}


def _stamp(obj, by, creating: bool) -> None:
    if creating:
        obj.created_by = by
        if hasattr(obj, "server_received_at"):
            obj.server_received_at = timezone.now()
    obj.updated_by = by


# ── Campagnes ────────────────────────────────────────────────────────────


def _check_campaign_dates(start: date, end: date | None) -> None:
    if end and end < start:
        raise ValidationError({"end_date": "La fin de campagne précède son début."})


@transaction.atomic
def create_campaign(
    *,
    workspace,
    by,
    name: str,
    season_type: str,
    year: int,
    start_date: date,
    end_date: date | None = None,
    status: str = CampaignStatus.PLANNED,
):
    _check_campaign_dates(start_date, end_date)
    name = (name or "").strip()
    if not name:
        raise ValidationError({"name": "Donnez un nom à la campagne."})
    if AgriculturalCampaign.objects.for_workspace(workspace).filter(name__iexact=name).exists():
        raise ValidationError({"name": "Une campagne porte déjà ce nom dans cet espace."})
    campaign = AgriculturalCampaign(
        name=name,
        season_type=season_type,
        year=year,
        start_date=start_date,
        end_date=end_date,
        status=status,
    )
    campaign.set_space(workspace)
    _stamp(campaign, by, creating=True)
    campaign.full_clean(exclude=["organization", "personal_producer"])
    campaign.save()
    return campaign


@transaction.atomic
def update_campaign(campaign: AgriculturalCampaign, *, by, **fields) -> AgriculturalCampaign:
    campaign = AgriculturalCampaign.objects.select_for_update().get(pk=campaign.pk)
    if campaign.status == CampaignStatus.CLOSED and set(fields) - {"status"}:
        raise ValidationError("Campagne clôturée : elle ne se modifie plus.")
    new_status = fields.pop("status", None)
    if new_status and new_status != campaign.status:
        if new_status not in CAMPAIGN_TRANSITIONS[campaign.status]:
            raise ValidationError({"status": "Passage de statut impossible pour cette campagne."})
        campaign.status = new_status
    if "name" in fields:
        name = (fields.pop("name") or "").strip()
        if not name:
            raise ValidationError({"name": "Donnez un nom à la campagne."})
        clash = (
            type(campaign)
            .objects.filter(space_key=campaign.space_key, name__iexact=name)
            .exclude(pk=campaign.pk)
            .exists()
        )
        if clash:
            raise ValidationError({"name": "Une campagne porte déjà ce nom dans cet espace."})
        campaign.name = name
    for key, value in fields.items():
        setattr(campaign, key, value)
    _check_campaign_dates(campaign.start_date, campaign.end_date)
    _stamp(campaign, by, creating=False)
    campaign.full_clean(exclude=["organization", "personal_producer"])
    campaign.save()
    return campaign


# ── Cycles ───────────────────────────────────────────────────────────────


def accessible_parcels(workspace):
    """Parcelles sur lesquelles l'espace peut suivre des cycles : lien actif (organisation),
    accès personnel ouvert (producteur). Jamais une autre."""
    if workspace.kind == "personal":
        return parcel_selectors.personal_parcels(workspace.producer)
    return parcel_selectors.visible_parcels(workspace.organization)


def _check_cycle_dates(cycle: CropCycle) -> None:
    sow = cycle.sowing_date
    if sow and cycle.transplanting_date and cycle.transplanting_date < sow:
        raise ValidationError({"transplanting_date": "Le repiquage précède le semis."})
    if sow and cycle.harvest_end_date and cycle.harvest_end_date < sow:
        raise ValidationError({"harvest_end_date": "La fin de récolte précède le semis."})
    start = cycle.planned_sowing_date or sow
    if start and cycle.expected_harvest_date and cycle.expected_harvest_date < start:
        raise ValidationError({"expected_harvest_date": "La récolte prévue précède le semis."})


def _resolve_operator(workspace, operator_id, parcel):
    if workspace.kind == "personal":
        if operator_id and str(operator_id) != str(workspace.producer.pk):
            raise ValidationError({"operator": "Dans votre espace, l'exploitant est vous-même."})
        return workspace.producer
    if operator_id:
        producer = visible_producers(workspace.organization).filter(pk=operator_id).first()
        if producer is None:
            raise ValidationError({"operator": "Producteur introuvable dans votre organisation."})
        return producer
    # Copie de l'exploitant principal au démarrage (Design v2.2).
    primary = parcel_selectors.current_operators(parcel).filter(operator_role="primary").first()
    return primary.producer if primary else None


@transaction.atomic
def create_crop_cycle(
    *,
    workspace,
    by,
    parcel_id,
    declared_crop: Crop,
    cultivation_unit_id=None,
    campaign_id=None,
    variety: CropVariety | None = None,
    operator_id=None,
    status: str = CropCycleStatus.PLANNED,
    **dates_and_area,
) -> CropCycle:
    parcel = accessible_parcels(workspace).filter(pk=parcel_id).first()
    if parcel is None:
        raise ValidationError({"parcel": "Parcelle introuvable dans votre espace."})
    if parcel.status == ParcelStatus.RETIRED:
        raise ValidationError({"parcel": "Parcelle retirée : aucun nouveau cycle."})
    if not declared_crop.is_active:
        raise ValidationError({"declared_crop": "Culture inactive."})
    if variety is not None and variety.crop_id != declared_crop.pk:
        raise ValidationError({"variety": "Cette variété n'appartient pas à la culture déclarée."})
    unit = None
    if cultivation_unit_id:
        unit = parcel.units.filter(pk=cultivation_unit_id).first()
        if unit is None:
            raise ValidationError({"cultivation_unit": "Unité introuvable sur cette parcelle."})
        if unit.status != CultivationUnitStatus.ACTIVE:
            raise ValidationError({"cultivation_unit": "Unité de culture retirée."})
    campaign = None
    if campaign_id:
        campaign = (
            AgriculturalCampaign.objects.for_workspace(workspace)
            .filter(pk=campaign_id, is_archived=False)
            .first()
        )
        if campaign is None:
            raise ValidationError({"campaign": "Campagne introuvable dans votre espace."})
        if campaign.status == CampaignStatus.CLOSED:
            raise ValidationError({"campaign": "Campagne clôturée : aucun nouveau cycle."})
    if status not in (CropCycleStatus.PLANNED, CropCycleStatus.IN_PROGRESS):
        raise ValidationError({"status": "Un cycle démarre « prévu » ou « en cours »."})
    cycle = CropCycle(
        parcel=parcel,
        cultivation_unit=unit,
        campaign=campaign,
        declared_crop=declared_crop,
        variety=variety,
        operator=_resolve_operator(workspace, operator_id, parcel),
        status=status,
        **dates_and_area,
    )
    cycle.set_space(workspace)
    _check_cycle_dates(cycle)
    _stamp(cycle, by, creating=True)
    cycle.save()
    return cycle


@transaction.atomic
def update_crop_cycle(cycle: CropCycle, *, workspace, by, **fields) -> CropCycle:
    cycle = CropCycle.objects.select_for_update().get(pk=cycle.pk)
    if cycle.is_archived:
        raise ValidationError("Cycle archivé : il ne se modifie plus.")
    new_status = fields.pop("status", None)
    if new_status and new_status != cycle.status:
        if new_status not in CYCLE_TRANSITIONS[cycle.status]:
            raise ValidationError({"status": "Passage de statut impossible pour ce cycle."})
        cycle.status = new_status
    if "campaign_id" in fields:
        campaign_id = fields.pop("campaign_id")
        campaign = None
        if campaign_id:
            campaign = (
                AgriculturalCampaign.objects.for_workspace(workspace)
                .filter(pk=campaign_id, is_archived=False)
                .first()
            )
            if campaign is None:
                raise ValidationError({"campaign": "Campagne introuvable dans votre espace."})
        cycle.campaign = campaign
    if "variety" in fields:
        variety = fields.pop("variety")
        if variety is not None and variety.crop_id != cycle.crop.pk:
            raise ValidationError(
                {"variety": "Cette variété n'appartient pas à la culture du cycle."}
            )
        cycle.variety = variety
    for key, value in fields.items():
        setattr(cycle, key, value)
    _check_cycle_dates(cycle)
    _stamp(cycle, by, creating=False)
    cycle.save()
    return cycle


@transaction.atomic
def confirm_crop(cycle: CropCycle, *, by, crop: Crop) -> CropCycle:
    """Confirmation de la culture par une personne habilitée (agronome)."""
    cycle = CropCycle.objects.select_for_update().get(pk=cycle.pk)
    if cycle.variety_id and cycle.variety.crop_id != crop.pk:
        cycle.variety = None  # la variété déclarée ne correspond plus à la culture confirmée
    cycle.confirmed_crop = crop
    cycle.confirmed_by = by
    cycle.confirmed_at = timezone.now()
    _stamp(cycle, by, creating=False)
    cycle.save()
    return cycle


def archive(obj, *, by, reason: str):
    if not (reason or "").strip():
        raise ValidationError({"reason": "Indiquez le motif de l'archivage."})
    return core_services.archive(obj, by=by, reason=reason.strip())


def _span(cycle: CropCycle) -> tuple[date | None, date | None]:
    start = cycle.sowing_date or cycle.transplanting_date or cycle.planned_sowing_date
    end = cycle.harvest_end_date or cycle.expected_harvest_date
    return start, end


def overlapping_cycles(cycle: CropCycle) -> list[CropCycle]:
    """D-17 : cycles du même espace qui se chevauchent sur la même parcelle (ou unité).

    Seuls les cycles prévus ou en cours comptent. Une période ouverte (date manquante)
    est considérée comme chevauchante : mieux vaut signaler à tort que rater un doublon.
    """
    if cycle.status not in (CropCycleStatus.PLANNED, CropCycleStatus.IN_PROGRESS):
        return []
    others = (
        CropCycle.objects.filter(
            space_key=cycle.space_key,
            parcel_id=cycle.parcel_id,
            is_archived=False,
            status__in=[CropCycleStatus.PLANNED, CropCycleStatus.IN_PROGRESS],
        )
        .exclude(pk=cycle.pk)
        .select_related("declared_crop", "confirmed_crop")
    )
    start, end = _span(cycle)
    found = []
    for other in others:
        if (
            cycle.cultivation_unit_id
            and other.cultivation_unit_id
            and cycle.cultivation_unit_id != other.cultivation_unit_id
        ):
            continue
        o_start, o_end = _span(other)
        if start and o_end and o_end < start:
            continue
        if o_start and end and end < o_start:
            continue
        found.append(other)
    return found


# ── Opérations et récoltes ───────────────────────────────────────────────


def _open_cycle(cycle: CropCycle) -> None:
    if cycle.is_archived:
        raise ValidationError("Cycle archivé.")


@transaction.atomic
def record_operation(cycle: CropCycle, *, workspace, by, source: str | None = None, **fields):
    _open_cycle(cycle)
    if workspace.kind == "personal":
        source = RecordSource.PRODUCER_DECLARED
    elif source not in RecordSource.values:
        source = RecordSource.FIELD_AGENT
    if not fields.get("planned_date") and not fields.get("performed_date"):
        raise ValidationError({"performed_date": "Indiquez la date réalisée ou prévue."})
    operation = AgriculturalOperation(crop_cycle=cycle, source=source, recorded_by=by, **fields)
    operation.set_space(workspace)
    _stamp(operation, by, creating=True)
    operation.save()
    return operation


@transaction.atomic
def record_harvest(cycle: CropCycle, *, workspace, by, **fields) -> HarvestRecord:
    _open_cycle(cycle)
    if cycle.status in (CropCycleStatus.PLANNED, CropCycleStatus.ABANDONED):
        raise ValidationError("Récolte impossible sur un cycle prévu ou abandonné.")
    if cycle.sowing_date and fields["harvest_date"] < cycle.sowing_date:
        raise ValidationError({"harvest_date": "La récolte précède le semis du cycle."})
    if fields["harvest_date"] > timezone.localdate():
        raise ValidationError({"harvest_date": "Une récolte se déclare une fois faite."})
    harvest = HarvestRecord(crop_cycle=cycle, recorded_by=by, **fields)
    harvest.set_space(workspace)
    _stamp(harvest, by, creating=True)
    harvest.save()
    return harvest
