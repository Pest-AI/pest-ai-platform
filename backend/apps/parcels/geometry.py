"""Lecture et mesure des contours de parcelles (GeoJSON ↔ PostGIS).

- Entrée : un objet GeoJSON `Polygon` ou `MultiPolygon` (coordonnées longitude, latitude
  en WGS 84), éventuellement enveloppé dans un `Feature`. Toujours stocké en MultiPolygon.
- Mesures : surface et périmètre calculés par PostGIS sur l'ellipsoïde
  (`ST_Area(geography)`, `ST_Perimeter(geography)`), en mètres ; centroïde garanti à
  l'intérieur du contour (`ST_PointOnSurface`), utile pour une parcelle en forme de L.

Les contrôles métier (surface minimale et maximale, chevauchements, statut « signalée »)
arrivent au J12 (MVP-36). Ici, seul un contour géométriquement invalide est refusé.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.gis.gdal import GDALException
from django.contrib.gis.geos import GEOSException, GEOSGeometry, MultiPolygon, Point, Polygon
from django.core.exceptions import ValidationError
from django.db import connection

MAX_VERTICES = 5_000  # contour marché au GPS : largement suffisant, protège le serveur


@dataclass(frozen=True)
class Measured:
    geometry: MultiPolygon
    area_m2: Decimal
    perimeter_m: Decimal
    centroid: Point


def _two_decimals(value: float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def from_geojson(data: dict | str) -> MultiPolygon:
    """Convertit un GeoJSON (Polygon, MultiPolygon ou Feature) en MultiPolygon 4326."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError as exc:
            raise ValidationError({"geometry": "GeoJSON illisible."}) from exc
    if not isinstance(data, dict):
        raise ValidationError({"geometry": "Objet GeoJSON attendu."})
    if data.get("type") == "Feature":
        data = data.get("geometry") or {}
    kind = data.get("type")
    if kind not in ("Polygon", "MultiPolygon"):
        raise ValidationError({"geometry": "Contour attendu : GeoJSON Polygon ou MultiPolygon."})
    try:
        geom = GEOSGeometry(json.dumps({"type": kind, "coordinates": data.get("coordinates")}))
    except (GEOSException, GDALException, ValueError, TypeError) as exc:
        raise ValidationError({"geometry": "Coordonnées GeoJSON invalides."}) from exc
    geom.srid = 4326
    if isinstance(geom, Polygon):
        geom = MultiPolygon(geom, srid=4326)
    if geom.empty:
        raise ValidationError({"geometry": "Le contour est vide."})
    if geom.num_coords > MAX_VERTICES:
        raise ValidationError(
            {"geometry": f"Contour trop détaillé (plus de {MAX_VERTICES} points)."}
        )
    xmin, ymin, xmax, ymax = geom.extent
    if not (-180 <= xmin <= xmax <= 180 and -90 <= ymin <= ymax <= 90):
        raise ValidationError(
            {"geometry": "Coordonnées hors limites : ordre attendu longitude, latitude (WGS 84)."}
        )
    return geom


def measure(geom: MultiPolygon) -> Measured:
    """Vérifie la validité et calcule surface, périmètre et point central avec PostGIS."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT ST_IsValid(g), ST_IsValidReason(g),
                   ST_Area(g::geography), ST_Perimeter(g::geography),
                   ST_AsEWKB(ST_PointOnSurface(g))
            FROM (SELECT ST_GeomFromEWKB(%s) AS g) AS t
            """,
            [bytes(geom.ewkb)],
        )
        valid, reason, area, perimeter, centroid = cursor.fetchone()
    if not valid:
        raise ValidationError(
            {
                "geometry": (
                    f"Contour invalide (côtés qui se croisent ou anneau mal fermé) : {reason}."
                )
            }
        )
    if not area or area <= 0:
        raise ValidationError({"geometry": "Le contour n'a pas de surface."})
    point = GEOSGeometry(memoryview(bytes(centroid)))
    point.srid = 4326
    return Measured(
        geometry=geom,
        area_m2=_two_decimals(area),
        perimeter_m=_two_decimals(perimeter),
        centroid=point,
    )


def to_geojson(geom) -> dict:
    """GeoJSON (dict) d'une géométrie GEOS."""
    return json.loads(geom.geojson)
