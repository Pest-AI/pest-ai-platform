"""Écritures du domaine Parcelles. Les auteurs sont toujours passés explicitement."""

from __future__ import annotations

from datetime import datetime

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core import services as core_services
from apps.parcels import agroid as agroid_format
from apps.parcels import geometry as geo
from apps.parcels.models import (
    CaptureMethod,
    Parcel,
    ParcelGeometry,
    ParcelRegistrationChannel,
    ParcelStatus,
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
                        ParcelStatus.ACTIVE
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
