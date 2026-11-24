"""Écritures du domaine Parcelles. Les auteurs sont toujours passés explicitement."""

from __future__ import annotations

from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core import services as core_services
from apps.parcels import agroid as agroid_format
from apps.parcels import geometry as geo
from apps.parcels import validation
from apps.parcels.models import (
    AccessBasis,
    AccessLevel,
    CaptureMethod,
    CultivationUnit,
    CultivationUnitStatus,
    GeometryValidationStatus,
    LinkStatus,
    LinkType,
    OperatorRole,
    OperatorVerification,
    OwnershipVerification,
    Parcel,
    ParcelGeometry,
    ParcelOperatorAssignment,
    ParcelOrganizationLink,
    ParcelOwnership,
    ParcelRegistrationChannel,
    ParcelStatus,
    ProducerParcelAccess,
)

AGROID_ATTEMPTS = 8  # avec 32^8 combinaisons, une seule collision est déjà improbable


class AgroIDUnavailableError(Exception):
    """Aucun AgroID libre trouvé après plusieurs tirages (ne devrait jamais arriver)."""


def _origin(organization, producer) -> dict:
    if (organization is None) == (producer is None):
        raise ValidationError("Une parcelle a exactement une origine : organisation ou producteur.")
    if organization is not None:
        return {
            "registration_channel": ParcelRegistrationChannel.ORGANIZATION,
            "registered_by_organization": organization,
        }
    return {
        "registration_channel": ParcelRegistrationChannel.PRODUCER_SELF,
        "registered_by_producer": producer,
    }


def _status_from_geometry(parcel: Parcel) -> str:
    """Active si le contour courant est valide ou absent ; en attente s'il est signalé ou refusé."""
    current = parcel.geometries.filter(is_current=True).values_list("validation_status", flat=True)
    current = current.first()
    if current in (GeometryValidationStatus.FLAGGED, GeometryValidationStatus.REJECTED):
        return ParcelStatus.PENDING_VALIDATION
    return ParcelStatus.ACTIVE


def _sync_status(parcel: Parcel, by) -> None:
    """Met le statut de la parcelle en accord avec son contour courant (si elle a son AgroID)."""
    if not parcel.agroid or parcel.status not in (
        ParcelStatus.ACTIVE,
        ParcelStatus.PENDING_VALIDATION,
    ):
        return
    status = _status_from_geometry(parcel)
    if status != parcel.status:
        parcel.status = status
        parcel.updated_by = by
        parcel.save(update_fields=["status", "updated_by", "updated_at"])


@transaction.atomic
def assign_agroid(parcel: Parcel, *, by) -> Parcel:
    """Attribue un AgroID à une parcelle qui n'en a pas (D-05). Sans effet si déjà attribué.

    Tirage cryptographique ; en cas de collision (contrainte UNIQUE), nouveau tirage.
    Chaque essai est isolé dans un point de sauvegarde pour ne pas casser la transaction.
    """
    parcel = Parcel.objects.select_for_update().get(pk=parcel.pk)
    if parcel.agroid:
        return parcel
    for _ in range(AGROID_ATTEMPTS):
        candidate = agroid_format.generate(parcel.country_code)
        try:
            with transaction.atomic():
                updated = Parcel.objects.filter(pk=parcel.pk, agroid__isnull=True).update(
                    agroid=candidate,
                    agroid_assigned_at=timezone.now(),
                    status=(
                        _status_from_geometry(parcel)
                        if parcel.status == ParcelStatus.DRAFT
                        else parcel.status
                    ),
                    updated_by=by,
                    updated_at=timezone.now(),
                )
        except IntegrityError:
            continue  # AgroID déjà pris (y compris par une parcelle retirée) : nouveau tirage
        if updated:
            parcel.refresh_from_db()
            return parcel
    raise AgroIDUnavailableError("Impossible d'attribuer un AgroID unique.")


@transaction.atomic
def create_parcel(
    *,
    by,
    organization=None,
    producer=None,
    local_name: str = "",
    country_code: str = "SN",
    geometry: dict | str | None = None,
    capture_method: str = CaptureMethod.MANUAL_DRAWING,
    gps_accuracy_m=None,
    captured_at: datetime | None = None,
    draft: bool = False,
    client_created_at: datetime | None = None,
) -> Parcel:
    """Crée une parcelle.

    - En ligne (`draft=False`) : l'AgroID est attribué tout de suite, statut « active ».
    - Brouillon (`draft=True`, saisie hors ligne) : pas d'AgroID ; il sera attribué à la
      synchronisation par `assign_agroid`.
    - Si un contour est fourni, il devient la version 1.
    """
    country = (country_code or "SN").upper()
    if producer is not None and (producer.user_id is None or producer.status != "active"):
        raise ValidationError(
            "Seul un producteur actif disposant d'un compte déclare ses parcelles."
        )
    measured = geo.measure(geo.from_geojson(geometry)) if geometry is not None else None
    parcel = Parcel.objects.create(
        country_code=country,
        local_name=(local_name or "").strip(),
        status=ParcelStatus.DRAFT,
        client_created_at=client_created_at,
        server_received_at=timezone.now(),
        created_by=by,
        updated_by=by,
        **_origin(organization, producer),
    )
    if measured is not None:
        _add_version(
            parcel,
            measured,
            by=by,
            capture_method=capture_method,
            gps_accuracy_m=gps_accuracy_m,
            captured_at=captured_at,
        )
    today = timezone.localdate()
    if organization is not None:
        # L'organisation qui enregistre suit la parcelle : c'est ce lien qui la lui rend visible.
        ParcelOrganizationLink.objects.create(
            parcel=parcel,
            organization=organization,
            link_type=LinkType.REGISTERING,
            status=LinkStatus.ACTIVE,
            start_date=today,
            granted_by=by,
            created_by=by,
            updated_by=by,
        )
    else:
        # Parcelle déclarée par le producteur : accès personnel complet (D-02).
        ProducerParcelAccess.objects.create(
            producer=producer,
            parcel=parcel,
            access_level=AccessLevel.MANAGE,
            basis=AccessBasis.SELF_REGISTERED,
            granted_by=by,
            start_date=today,
            created_by=by,
            updated_by=by,
        )
    if not draft:
        parcel = assign_agroid(parcel, by=by)
    return parcel


def _add_version(
    parcel: Parcel, measured: geo.Measured, *, by, capture_method, gps_accuracy_m, captured_at
) -> ParcelGeometry:
    if capture_method not in CaptureMethod.values:
        raise ValidationError({"capture_method": "Méthode de capture inconnue."})
    now = timezone.now()
    previous = (
        ParcelGeometry.objects.select_for_update().filter(parcel=parcel, is_current=True).first()
    )
    last = parcel.geometries.order_by("-version").values_list("version", flat=True).first() or 0
    if previous is not None:
        previous.is_current = False
        previous.valid_to = now
        previous.updated_by = by
        previous.save(update_fields=["is_current", "valid_to", "updated_by", "updated_at"])
    version = ParcelGeometry.objects.create(
        parcel=parcel,
        version=last + 1,
        geometry=measured.geometry,
        area_m2=measured.area_m2,
        perimeter_m=measured.perimeter_m,
        centroid=measured.centroid,
        capture_method=capture_method,
        gps_accuracy_m=gps_accuracy_m,
        captured_by=by,
        captured_at=captured_at or now,
        is_current=True,
        valid_from=now,
        server_received_at=now,
        created_by=by,
        updated_by=by,
    )
    parcel.current_area_m2 = measured.area_m2
    parcel.centroid = measured.centroid
    parcel.updated_by = by
    parcel.save(update_fields=["current_area_m2", "centroid", "updated_by", "updated_at"])
    status, report = validation.evaluate(version)
    version.validation_status = status
    version.validation_report = report
    version.save(update_fields=["validation_status", "validation_report", "updated_at"])
    _sync_status(parcel, by)
    return version


@transaction.atomic
def add_geometry(
    parcel: Parcel,
    geometry: dict | str,
    *,
    by,
    capture_method: str = CaptureMethod.MANUAL_DRAWING,
    gps_accuracy_m=None,
    captured_at: datetime | None = None,
) -> ParcelGeometry:
    """Enregistre un nouveau contour : nouvelle version courante, l'ancienne est conservée."""
    parcel = Parcel.objects.select_for_update().get(pk=parcel.pk)
    if parcel.status == ParcelStatus.RETIRED:
        raise ValidationError("Parcelle retirée : son contour ne peut plus changer.")
    measured = geo.measure(geo.from_geojson(geometry))
    return _add_version(
        parcel,
        measured,
        by=by,
        capture_method=capture_method,
        gps_accuracy_m=gps_accuracy_m,
        captured_at=captured_at,
    )


@transaction.atomic
def retire_parcel(parcel: Parcel, *, by, reason: str) -> Parcel:
    """Retire une parcelle (disparue, fusionnée…). Son AgroID reste réservé à vie."""
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Indiquez pourquoi la parcelle est retirée."})
    parcel = Parcel.objects.select_for_update().get(pk=parcel.pk)
    if parcel.status == ParcelStatus.RETIRED:
        return parcel
    if not parcel.agroid:
        raise ValidationError("Un brouillon sans AgroID ne peut pas être retiré : archivez-le.")
    parcel.status = ParcelStatus.RETIRED
    parcel.updated_by = by
    parcel.save(update_fields=["status", "updated_by", "updated_at"])
    return core_services.archive(parcel, by=by, reason=reason)


@transaction.atomic
def review_geometry(
    version: ParcelGeometry, *, decision: str, by, note: str = ""
) -> ParcelGeometry:
    """Décision humaine sur un contour signalé (D-19) : le confirmer (`valid`) ou le refuser.

    Un contour refusé reste dans l'historique ; la parcelle reste « en attente » jusqu'à ce
    qu'un nouveau contour soit enregistré.
    """
    if decision not in (GeometryValidationStatus.VALID, GeometryValidationStatus.REJECTED):
        raise ValidationError({"decision": "Décision attendue : valid ou rejected."})
    version = ParcelGeometry.objects.select_for_update().get(pk=version.pk)
    if version.validation_status not in (
        GeometryValidationStatus.FLAGGED,
        GeometryValidationStatus.PENDING,
    ):
        raise ValidationError("Ce contour a déjà été tranché.")
    if decision == GeometryValidationStatus.REJECTED and not (note or "").strip():
        raise ValidationError({"note": "Expliquez pourquoi le contour est refusé."})
    report = dict(version.validation_report or {})
    report["review"] = {
        "decision": decision,
        "note": (note or "").strip(),
        "by": str(by.pk),
        "at": timezone.now().isoformat(),
    }
    version.validation_status = decision
    version.validation_report = report
    version.validated_by = by
    version.validated_at = timezone.now()
    version.updated_by = by
    version.save(
        update_fields=[
            "validation_status",
            "validation_report",
            "validated_by",
            "validated_at",
            "updated_by",
            "updated_at",
        ]
    )
    _sync_status(Parcel.objects.select_for_update().get(pk=version.parcel_id), by)
    return version


# ── Propriété et exploitation (F-09, D-06, D-07) ─────────────────────────
# Aucune de ces relations n'ouvre d'accès à la parcelle : la propriété ne vaut pas
# l'exploitation, et ni l'une ni l'autre ne donne de droit de consultation.


def _recorder(organization, producer) -> dict:
    if (organization is None) == (producer is None):
        raise ValidationError(
            "Une relation est enregistrée soit par une organisation, soit par le producteur."
        )
    if organization is not None:
        return {"recorded_by_organization": organization}
    return {"recorded_by_producer": producer}


def _close(row, end_date: date, by):
    if row.end_date is not None:
        raise ValidationError("Cette relation est déjà close.")
    if end_date < row.start_date:
        raise ValidationError({"end_date": "La date de fin précède la date de début."})
    row.end_date = end_date
    row.updated_by = by
    row.save(update_fields=["end_date", "updated_by", "updated_at"])
    return row


@transaction.atomic
def record_ownership(
    parcel: Parcel,
    *,
    by,
    tenure_type: str,
    start_date: date,
    owner_producer=None,
    owner_organization=None,
    owner_name: str = "",
    share_percent=None,
    verification_status: str = OwnershipVerification.DECLARED,
    recorded_by_organization=None,
    recorded_by_producer=None,
    notes: str = "",
) -> ParcelOwnership:
    """Enregistre un propriétaire (producteur, organisation ou simple nom déclaré, D-07)."""
    owner_name = (owner_name or "").strip()
    if (
        sum(x is not None and x != "" for x in (owner_producer, owner_organization, owner_name))
        != 1
    ):
        raise ValidationError("Indiquez un seul propriétaire : producteur, organisation ou nom.")
    if recorded_by_producer is not None and verification_status != OwnershipVerification.DECLARED:
        raise ValidationError("Une propriété déclarée par le producteur reste « déclarée ».")
    return ParcelOwnership.objects.create(
        parcel=parcel,
        owner_producer=owner_producer,
        owner_organization=owner_organization,
        owner_name=owner_name,
        tenure_type=tenure_type,
        share_percent=share_percent,
        start_date=start_date,
        verification_status=verification_status,
        notes=(notes or "").strip(),
        created_by=by,
        updated_by=by,
        server_received_at=timezone.now(),
        **_recorder(recorded_by_organization, recorded_by_producer),
    )


def end_ownership(ownership: ParcelOwnership, *, end_date: date, by) -> ParcelOwnership:
    """Clôt une propriété (vente, succession…). Le nouveau propriétaire est une nouvelle ligne."""
    return _close(ownership, end_date, by)


def set_ownership_verification(ownership: ParcelOwnership, *, status: str, by) -> ParcelOwnership:
    """Seul champ modifiable d'une propriété : son statut (justifiée, contestée)."""
    if status not in OwnershipVerification.values:
        raise ValidationError({"verification_status": "Statut inconnu."})
    if ownership.recorded_by_producer_id and status == OwnershipVerification.DOCUMENTED:
        raise ValidationError("Une déclaration du producteur ne se justifie pas elle-même.")
    ownership.verification_status = status
    ownership.updated_by = by
    ownership.save(update_fields=["verification_status", "updated_by", "updated_at"])
    return ownership


@transaction.atomic
def assign_operator(
    parcel: Parcel,
    producer,
    *,
    by,
    role: str,
    start_date: date,
    arrangement_type: str = "unknown",
    recorded_by_organization=None,
    recorded_by_producer=None,
    replace_primary: bool = False,
) -> ParcelOperatorAssignment:
    """Désigne un exploitant. Un seul exploitant principal à la fois (D-06).

    `replace_primary=True` clôt l'exploitant principal en cours à `start_date` avant de
    désigner le nouveau ; sinon, un principal déjà en place est une erreur.
    """
    if role not in OperatorRole.values:
        raise ValidationError({"role": "Rôle inconnu."})
    Parcel.objects.select_for_update().get(pk=parcel.pk)
    if parcel.status == ParcelStatus.RETIRED:
        raise ValidationError("Parcelle retirée.")
    if ParcelOperatorAssignment.objects.filter(
        parcel=parcel, producer=producer, end_date__isnull=True
    ).exists():
        raise ValidationError("Ce producteur exploite déjà cette parcelle.")
    if role == OperatorRole.PRIMARY:
        current = ParcelOperatorAssignment.objects.filter(
            parcel=parcel, operator_role=OperatorRole.PRIMARY, end_date__isnull=True
        ).first()
        if current is not None:
            if not replace_primary:
                raise ValidationError(
                    "Un exploitant principal est déjà en place : clôturez-le d'abord."
                )
            _close(current, start_date, by)
    verification = (
        OperatorVerification.CONFIRMED_BY_ORGANIZATION
        if recorded_by_organization is not None
        else OperatorVerification.DECLARED
    )
    return ParcelOperatorAssignment.objects.create(
        parcel=parcel,
        producer=producer,
        operator_role=role,
        arrangement_type=arrangement_type,
        verification_status=verification,
        start_date=start_date,
        created_by=by,
        updated_by=by,
        server_received_at=timezone.now(),
        **_recorder(recorded_by_organization, recorded_by_producer),
    )


def end_operator(assignment: ParcelOperatorAssignment, *, end_date: date, by):
    return _close(assignment, end_date, by)


# ── Liens aux organisations (D-03) et accès personnels (D-02) ─────────────


@transaction.atomic
def request_organization_link(
    parcel: Parcel, organization, *, by, link_type: str = LinkType.SUPPORTING
) -> ParcelOrganizationLink:
    """Une organisation demande à suivre une parcelle.

    Parcelle déclarée par le producteur : le lien attend son accord (D-03) et ne donne
    aucun accès d'ici là. Parcelle d'organisation : le lien est actif tout de suite.
    """
    if parcel.status == ParcelStatus.RETIRED:
        raise ValidationError("Parcelle retirée.")
    if ParcelOrganizationLink.objects.filter(
        parcel=parcel, organization=organization, end_date__isnull=True
    ).exists():
        raise ValidationError("Cette organisation suit déjà cette parcelle (ou attend l'accord).")
    personal = parcel.registration_channel == ParcelRegistrationChannel.PRODUCER_SELF
    return ParcelOrganizationLink.objects.create(
        parcel=parcel,
        organization=organization,
        link_type=link_type,
        status=LinkStatus.PENDING_PRODUCER_CONSENT if personal else LinkStatus.ACTIVE,
        start_date=timezone.localdate(),
        granted_by=by,
        created_by=by,
        updated_by=by,
    )


def _check_owner_consent(link: ParcelOrganizationLink, by) -> None:
    if link.status != LinkStatus.PENDING_PRODUCER_CONSENT:
        raise ValidationError("Aucune demande en attente.")
    producer = link.parcel.registered_by_producer
    if producer is None or producer.user_id != by.pk:
        raise ValidationError("Seul le producteur qui a déclaré la parcelle peut répondre.")


@transaction.atomic
def consent_organization_link(link: ParcelOrganizationLink, *, by) -> ParcelOrganizationLink:
    """Le producteur accepte qu'une organisation suive sa parcelle (D-03)."""
    link = ParcelOrganizationLink.objects.select_for_update().get(pk=link.pk)
    _check_owner_consent(link, by)
    link.status = LinkStatus.ACTIVE
    link.consented_by = by
    link.consented_at = timezone.now()
    link.updated_by = by
    link.save(update_fields=["status", "consented_by", "consented_at", "updated_by", "updated_at"])
    return link


@transaction.atomic
def decline_organization_link(link: ParcelOrganizationLink, *, by) -> ParcelOrganizationLink:
    """Le producteur refuse : le lien est clos, aucun accès n'a jamais été ouvert."""
    link = ParcelOrganizationLink.objects.select_for_update().get(pk=link.pk)
    _check_owner_consent(link, by)
    return end_organization_link(link, by=by)


def end_organization_link(link: ParcelOrganizationLink, *, by) -> ParcelOrganizationLink:
    """L'organisation cesse de suivre la parcelle (ou la demande est retirée)."""
    if link.status == LinkStatus.ENDED:
        return link
    link.status = LinkStatus.ENDED
    link.end_date = max(timezone.localdate(), link.start_date)
    link.updated_by = by
    link.save(update_fields=["status", "end_date", "updated_by", "updated_at"])
    return link


@transaction.atomic
def grant_personal_access(
    parcel: Parcel, producer, *, organization, by, level: str = AccessLevel.VIEW
) -> ProducerParcelAccess:
    """Une organisation qui suit la parcelle donne à un producteur l'accès dans son espace
    personnel (D-02, consultation par défaut). Jamais déduit d'une propriété ou d'une
    exploitation ; la revendication vérifiée (`verified_claim`) n'existe pas au MVP."""
    if level not in AccessLevel.values:
        raise ValidationError({"level": "Niveau inconnu."})
    if not ParcelOrganizationLink.objects.filter(
        parcel=parcel, organization=organization, status=LinkStatus.ACTIVE, end_date__isnull=True
    ).exists():
        raise ValidationError(
            "Seule une organisation qui suit la parcelle peut accorder cet accès."
        )
    if producer.user_id is None or producer.status != "active":
        raise ValidationError("Le producteur doit avoir un compte actif.")
    if ProducerParcelAccess.objects.filter(
        producer=producer, parcel=parcel, end_date__isnull=True
    ).exists():
        raise ValidationError("Ce producteur a déjà accès à cette parcelle.")
    return ProducerParcelAccess.objects.create(
        producer=producer,
        parcel=parcel,
        access_level=level,
        basis=AccessBasis.GRANTED_BY_ORGANIZATION,
        granted_by_organization=organization,
        granted_by=by,
        start_date=timezone.localdate(),
        created_by=by,
        updated_by=by,
    )


def revoke_personal_access(access: ProducerParcelAccess, *, by, reason: str):
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Indiquez le motif."})
    if access.end_date is not None:
        return access
    access.end_date = max(timezone.localdate(), access.start_date)
    access.revocation_reason = reason
    access.updated_by = by
    access.save(update_fields=["end_date", "revocation_reason", "updated_by", "updated_at"])
    return access


# ── Unités de culture (F-10, D-16) ───────────────────────────────────────


@transaction.atomic
def create_cultivation_unit(
    parcel: Parcel, *, by, code: str, name: str = "", area_m2=None
) -> CultivationUnit:
    """Déclare une unité de culture par son code (U1, U2…) et sa surface (D-16).

    Le contour de l'unité (facultatif au MVP) arrivera avec la saisie sur la carte ;
    il devra être inclus dans celui de la parcelle, à 1 m près.
    """
    code = (code or "").strip().upper()
    if not code:
        raise ValidationError({"code": "Code obligatoire, par exemple U1."})
    if parcel.status == ParcelStatus.RETIRED:
        raise ValidationError("Parcelle retirée.")
    if CultivationUnit.objects.filter(parcel=parcel, code=code).exists():
        raise ValidationError({"code": "Ce code existe déjà sur cette parcelle."})
    return CultivationUnit.objects.create(
        parcel=parcel,
        code=code,
        name=(name or "").strip(),
        area_m2=area_m2,
        valid_from=timezone.localdate(),
        created_by=by,
        updated_by=by,
        server_received_at=timezone.now(),
    )


@transaction.atomic
def retire_cultivation_unit(unit: CultivationUnit, *, by, reason: str) -> CultivationUnit:
    """Retire une unité ; elle garde son historique (cycles, observations à venir)."""
    unit.status = CultivationUnitStatus.RETIRED
    unit.valid_to = max(timezone.localdate(), unit.valid_from or timezone.localdate())
    unit.updated_by = by
    unit.save(update_fields=["status", "valid_to", "updated_by", "updated_at"])
    return core_services.archive(unit, by=by, reason=reason)
