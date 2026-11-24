"""Lectures du domaine Parcelles."""

from __future__ import annotations

from apps.parcels import agroid as agroid_format
from apps.parcels.models import LinkStatus, Parcel, ParcelOrganizationLink, ProducerParcelAccess


def by_agroid(value: str) -> Parcel | None:
    """Parcelle d'après un AgroID saisi par une personne (casse, espaces, O/0, I/1 tolérés)."""
    canonical = agroid_format.normalize(value)
    if canonical is None:
        return None
    return Parcel.objects.filter(agroid=canonical).first()


def current_geometry(parcel: Parcel):
    return parcel.geometries.filter(is_current=True).first()


def geometry_history(parcel: Parcel):
    """Toutes les versions du contour, de la plus récente à la plus ancienne."""
    return parcel.geometries.order_by("-version")


def visible_parcels(organization):
    """Parcelles qu'une organisation peut voir : lien actif et ouvert, rien d'autre."""
    return Parcel.objects.filter(
        organization_links__organization=organization,
        organization_links__status=LinkStatus.ACTIVE,
        organization_links__end_date__isnull=True,
    ).distinct()


def personal_parcels(producer):
    """Parcelles de l'espace personnel d'un producteur : accès personnel ouvert, rien d'autre."""
    return Parcel.objects.filter(
        personal_accesses__producer=producer, personal_accesses__end_date__isnull=True
    ).distinct()


def personal_access(producer, parcel) -> ProducerParcelAccess | None:
    return ProducerParcelAccess.objects.filter(
        producer=producer, parcel=parcel, end_date__isnull=True
    ).first()


def pending_link_requests(producer):
    """Demandes en attente d'accord sur les parcelles déclarées par le producteur."""
    return ParcelOrganizationLink.objects.filter(
        parcel__registered_by_producer=producer, status=LinkStatus.PENDING_PRODUCER_CONSENT
    ).select_related("organization", "parcel")


def current_owners(parcel):
    return parcel.ownerships.filter(end_date__isnull=True)


def current_operators(parcel):
    return parcel.operators.filter(end_date__isnull=True)
