"""Lectures du domaine Parcelles."""

from __future__ import annotations

from apps.parcels import agroid as agroid_format
from apps.parcels.models import Parcel


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
