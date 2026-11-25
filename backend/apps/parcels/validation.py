"""Contrôle des contours de parcelles (D-19, MVP-36), en synchrone au MVP.

Deux niveaux :
- **refusé** : contour géométriquement impossible (côtés qui se croisent, anneau non fermé,
  SRID ≠ 4326). Il n'est jamais enregistré (geometry.measure + contrainte PostgreSQL).
- **signalé** (`flagged`) : contour enregistré mais suspect. Le terrain n'est pas bloqué ;
  une personne habilitée confirme ou refuse ensuite (services.review_geometry).
  Motifs : surface hors bornes, précision GPS insuffisante, chevauchement avec une autre
  parcelle au-delà du seuil.

Le rapport (`ParcelGeometry.validation_report`) garde les mesures et les seuils appliqués,
pour comprendre plus tard pourquoi un contour a été signalé, même si les seuils changent.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import connection
from django.utils import timezone

AREA_TOO_SMALL = "area_too_small"
AREA_TOO_LARGE = "area_too_large"
GPS_ACCURACY_LOW = "gps_accuracy_low"
OVERLAP = "overlap"
FIELD_SURVEY_REQUIRED = "field_survey_required"

FLAG_LABELS = {
    AREA_TOO_SMALL: "Surface très petite",
    AREA_TOO_LARGE: "Surface très grande",
    GPS_ACCURACY_LOW: "Précision GPS insuffisante",
    OVERLAP: "Chevauche une autre parcelle",
    FIELD_SURVEY_REQUIRED: "À confirmer par un relevé terrain",
}


def rules() -> dict:
    return dict(settings.PARCEL_GEOMETRY_RULES)


def _overlaps(version) -> list[dict]:
    """Chevauchements avec les contours courants des autres parcelles (non retirées)."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT other.parcel_id, other.id,
                   ST_Area(ST_Intersection(other.geometry, me.geometry)::geography)
            FROM parcels_parcel_geometry AS me
            JOIN parcels_parcel_geometry AS other
              ON other.is_current
             AND other.parcel_id <> me.parcel_id
             AND other.validation_status <> 'rejected'
             AND other.geometry && me.geometry
             AND ST_Intersects(other.geometry, me.geometry)
            JOIN parcels_parcel AS p ON p.id = other.parcel_id AND p.status <> 'retired'
            WHERE me.id = %s
            """,
            [version.id],
        )
        rows = cursor.fetchall()
    area = float(version.area_m2)
    found = []
    for parcel_id, geometry_id, shared in rows:
        if not shared or shared <= 0:
            continue  # simple contact par un côté
        found.append(
            {
                "parcel_id": str(parcel_id),
                "geometry_id": str(geometry_id),
                "overlap_m2": round(shared, 2),
                "percent": round(100 * shared / area, 2),
            }
        )
    return sorted(found, key=lambda o: -o["percent"])


def overlaps_with_existing(geom, area_m2: float, visible_ids: set[str] | None = None) -> list[dict]:
    """Chevauchements d'un contour (pas encore enregistré) avec les parcelles existantes.

    Utilisé par l'aperçu d'import. `visible_ids` : parcelles de l'espace ; les autres sont
    signalées sans identifiant.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT other.parcel_id, p.agroid,
                   ST_Area(ST_Intersection(other.geometry, me.g)::geography)
            FROM (SELECT ST_GeomFromEWKB(%s) AS g) AS me
            JOIN parcels_parcel_geometry AS other
              ON other.is_current
             AND other.validation_status <> 'rejected'
             AND other.geometry && me.g
             AND ST_Intersects(other.geometry, me.g)
            JOIN parcels_parcel AS p ON p.id = other.parcel_id AND p.status <> 'retired'
            """,
            [bytes(geom.ewkb)],
        )
        rows = cursor.fetchall()
    found = []
    for parcel_id, agroid, shared in rows:
        if not shared or shared <= 0:
            continue
        visible = visible_ids is not None and str(parcel_id) in visible_ids
        found.append(
            {
                "agroid": agroid if visible else None,
                "overlap_m2": round(shared, 2),
                "percent": round(100 * shared / area_m2, 2),
            }
        )
    return sorted(found, key=lambda o: -o["percent"])


def evaluate(version) -> tuple[str, dict]:
    """Calcule le statut (`valid` ou `flagged`) et le rapport d'une version de contour."""
    limits = rules()
    area = float(version.area_m2)
    flags = []
    if area < limits["MIN_AREA_M2"]:
        flags.append(AREA_TOO_SMALL)
    if area > limits["MAX_AREA_M2"]:
        flags.append(AREA_TOO_LARGE)
    accuracy = version.gps_accuracy_m
    if accuracy is not None and float(accuracy) > limits["MAX_GPS_ACCURACY_M"]:
        flags.append(GPS_ACCURACY_LOW)
    if version.capture_method in limits.get("FIELD_SURVEY_REQUIRED_METHODS", []):
        flags.append(FIELD_SURVEY_REQUIRED)
    overlaps = _overlaps(version)
    if any(o["percent"] > limits["MAX_OVERLAP_PERCENT"] for o in overlaps):
        flags.append(OVERLAP)
    report = {
        "checked_at": timezone.now().isoformat(),
        "is_valid_geometry": True,
        "area_m2": area,
        "gps_accuracy_m": float(accuracy) if isinstance(accuracy, Decimal | int | float) else None,
        "overlaps": overlaps,
        "flags": flags,
        "thresholds": limits,
    }
    return ("flagged" if flags else "valid"), report


# ── Unités de culture (D-16) ─────────────────────────────────────────────

UNIT_OUTSIDE_PARCEL = "unit_outside_parcel"
UNIT_OVERLAP = "unit_overlap"
UNIT_NO_PARCEL_CONTOUR = "unit_no_parcel_contour"
UNIT_FLAG_LABELS = {
    UNIT_OUTSIDE_PARCEL: "Déborde de la parcelle (au-delà de 1 m)",
    UNIT_OVERLAP: "Chevauche une autre unité de la parcelle",
    UNIT_NO_PARCEL_CONTOUR: "La parcelle n'a pas encore de contour : inclusion non vérifiée",
}
UNIT_TOLERANCE_M = 1.0  # D-16
UNIT_MAX_OVERLAP_PERCENT = 5.0


def check_unit(unit) -> dict:
    """Contrôle d'une unité qui a un contour (D-16) : signalée, jamais refusée.

    - incluse dans le contour courant de la parcelle à 1 m près :
      ST_Within(ST_Buffer(unité, -1 m), parcelle) ;
    - pas de chevauchement de plus de 5 % avec une autre unité active de la parcelle.
    Sans contour d'unité : rien à contrôler (unité déclarée par code et surface).
    """
    if unit.geometry is None:
        return {"status": "not_applicable", "flags": [], "labels": []}
    flags: list[str] = []
    parcel_geom = (
        unit.parcel.geometries.filter(is_current=True).values_list("geometry", flat=True).first()
    )
    with connection.cursor() as cursor:
        if parcel_geom is None:
            flags.append(UNIT_NO_PARCEL_CONTOUR)
        else:
            cursor.execute(
                """
                SELECT ST_Within(
                    ST_Buffer(ST_GeomFromEWKB(%s)::geography, %s)::geometry,
                    ST_GeomFromEWKB(%s)
                )
                """,
                [bytes(unit.geometry.ewkb), -UNIT_TOLERANCE_M, bytes(parcel_geom.ewkb)],
            )
            (within,) = cursor.fetchone()
            if not within:
                flags.append(UNIT_OUTSIDE_PARCEL)
        others = (
            unit.parcel.units.filter(status="active", geometry__isnull=False, is_archived=False)
            .exclude(pk=unit.pk)
            .values_list("geometry", flat=True)
        )
        for other in others:
            cursor.execute(
                """
                SELECT ST_Area(ST_Intersection(a, b)::geography) / NULLIF(ST_Area(a::geography), 0)
                FROM (SELECT ST_GeomFromEWKB(%s) AS a, ST_GeomFromEWKB(%s) AS b) AS t
                """,
                [bytes(unit.geometry.ewkb), bytes(other.ewkb)],
            )
            (ratio,) = cursor.fetchone()
            if ratio and 100 * ratio > UNIT_MAX_OVERLAP_PERCENT:
                flags.append(UNIT_OVERLAP)
                break
    return {
        "status": "flagged" if flags else "valid",
        "flags": flags,
        "labels": [UNIT_FLAG_LABELS[f] for f in flags],
    }
