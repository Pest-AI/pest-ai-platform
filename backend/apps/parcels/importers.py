"""Lecture des fichiers de parcelles (J15b) : KML, KMZ, Shapefile (.zip), GeoJSON, CSV.

Les fichiers viennent de l'extérieur (Google Earth, logiciels SIG, tableurs) : ils sont lus
avec prudence.
- Taille limitée (`MAX_BYTES`), nombre d'entités limité (`MAX_FEATURES`).
- Archives (.zip, .kmz) : nombre et taille des fichiers limités, chemins vérifiés
  (pas de « ../ »), extraction dans un dossier temporaire supprimé ensuite.
- KML : refusé s'il déclare un DOCTYPE ou des entités XML (attaques par entités externes).
- Toute projection déclarée (.prj d'un Shapefile, CRS d'un CSV ou d'un GeoJSON non
  standard) est convertie en WGS 84 (EPSG:4326) ; les altitudes sont ignorées.

Sortie : une liste d'entités `{index, label, properties, ewkt | None, kind, error}` où
`kind` vaut `polygon` (contour), `point` (position sans contour) ou `none` (erreur).
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import tempfile
import zipfile
from dataclasses import asdict, dataclass, field

from django.contrib.gis.gdal import DataSource, GDALException, OGRGeometry, SpatialReference
from django.contrib.gis.geos import GEOSException, GEOSGeometry, MultiPolygon, Point, Polygon

from apps.parcels.models import ImportFormat

MAX_BYTES = 10 * 1024 * 1024
MAX_FEATURES = 1000
MAX_ZIP_ENTRIES = 40
MAX_ZIP_UNCOMPRESSED = 60 * 1024 * 1024
MAX_PROPERTY_LENGTH = 200

WGS84 = SpatialReference(4326)
WKT_COLUMNS = ("wkt", "geometry", "geometrie", "géométrie", "geom", "the_geom", "contour")
LAT_COLUMNS = ("latitude", "lat", "y")
LON_COLUMNS = ("longitude", "lon", "lng", "long", "x")


class ImportFileError(Exception):
    """Fichier illisible ou refusé : message affiché tel quel."""


@dataclass
class RawFeature:
    index: int
    label: str
    properties: dict[str, str] = field(default_factory=dict)
    ewkt: str | None = None
    kind: str = "none"  # polygon | point | none
    error: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def detect_format(file_name: str) -> str:
    name = file_name.lower()
    for suffix, fmt in (
        (".kmz", ImportFormat.KMZ),
        (".kml", ImportFormat.KML),
        (".zip", ImportFormat.SHAPEFILE),
        (".geojson", ImportFormat.GEOJSON),
        (".json", ImportFormat.GEOJSON),
        (".csv", ImportFormat.CSV),
        (".txt", ImportFormat.CSV),
    ):
        if name.endswith(suffix):
            return fmt
    raise ImportFileError(
        "Format non reconnu. Formats acceptés : KML, KMZ, Shapefile (.zip), GeoJSON, CSV."
    )


# ── Géométries ───────────────────────────────────────────────────────────


def _clean(value) -> str:
    text = "" if value is None else str(value).strip()
    return text[:MAX_PROPERTY_LENGTH]


def _from_ogr(geom: OGRGeometry) -> tuple[str, str | None, str | None]:
    """OGR → (kind, ewkt 4326 en 2D, erreur)."""
    try:
        srs = geom.srs
        # Déjà en WGS 84 (KML, GeoJSON) : on ne touche à rien (évite toute inversion d'axes).
        if srs is not None and not (srs.geographic and srs.srid in (None, 4326)):
            geom.transform(WGS84)
        geom.coord_dim = 2
        gtype = geom.geom_name.upper()
        geos = geom.geos
    except (GDALException, GEOSException) as exc:
        return "none", None, f"Géométrie illisible ({exc})."
    geos.srid = 4326
    return _classify(geos, gtype)


def _classify(geos: GEOSGeometry, gtype: str | None = None) -> tuple[str, str | None, str | None]:
    gtype = (gtype or geos.geom_type).upper()
    if isinstance(geos, Polygon):
        geos = MultiPolygon(geos, srid=4326)
    if isinstance(geos, MultiPolygon):
        return "polygon", geos.ewkt, None
    if isinstance(geos, Point):
        return "point", geos.ewkt, None
    if gtype in ("LINESTRING", "LINEARRING") and geos.closed and geos.num_points >= 4:
        # Tracé GPS fermé : on en fait un contour.
        poly = Polygon(geos.coords, srid=4326)
        return "polygon", MultiPolygon(poly, srid=4326).ewkt, None
    if gtype in ("GEOMETRYCOLLECTION", "MULTIGEOMETRY"):
        polygons = [g for g in geos if isinstance(g, Polygon | MultiPolygon)]
        if polygons:
            parts = []
            for g in polygons:
                parts.extend(list(g) if isinstance(g, MultiPolygon) else [g])
            return "polygon", MultiPolygon(*parts, srid=4326).ewkt, None
    if gtype in ("LINESTRING", "MULTILINESTRING"):
        return "none", None, "Ligne non fermée : un contour doit revenir à son point de départ."
    return "none", None, f"Type de géométrie non pris en charge ({geos.geom_type})."


# ── Lecture GDAL (KML, KMZ, Shapefile) ───────────────────────────────────


def _safe_extract(data: bytes, target: str) -> list[str]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ImportFileError("Archive .zip / .kmz illisible.") from exc
    entries = [e for e in archive.infolist() if not e.is_dir()]
    if len(entries) > MAX_ZIP_ENTRIES:
        raise ImportFileError(f"Archive trop chargée (plus de {MAX_ZIP_ENTRIES} fichiers).")
    if sum(e.file_size for e in entries) > MAX_ZIP_UNCOMPRESSED:
        raise ImportFileError("Archive trop volumineuse une fois décompressée.")
    written = []
    for entry in entries:
        name = entry.filename.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/") or name.startswith("__MACOSX/"):
            continue
        path = os.path.join(target, *name.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with archive.open(entry) as src, open(path, "wb") as dst:
            dst.write(src.read(entry.file_size + 1)[: entry.file_size])
        written.append(path)
    return written


def _check_kml(raw: bytes) -> None:
    head = raw[:4096].upper()
    if b"<!DOCTYPE" in head or b"<!ENTITY" in raw.upper():
        raise ImportFileError("Fichier KML refusé : il déclare des entités XML.")


def _read_datasource(path: str) -> list[RawFeature]:
    try:
        source = DataSource(path)
    except GDALException as exc:
        raise ImportFileError(
            "Fichier illisible : vérifiez qu'il s'ouvre dans Google Earth ou QGIS."
        ) from exc
    features: list[RawFeature] = []
    for layer in source:
        fields = list(layer.fields)
        for feat in layer:
            if len(features) >= MAX_FEATURES:
                raise ImportFileError(f"Plus de {MAX_FEATURES} parcelles : découpez le fichier.")
            props = {}
            for name in fields:
                try:
                    props[name] = _clean(feat.get(name))
                except (GDALException, UnicodeDecodeError):
                    props[name] = ""
            index = len(features) + 1
            raw = RawFeature(index=index, label="", properties=props)
            try:
                geom = feat.geom
            except GDALException:
                geom = None
            if geom is None or geom.empty:
                raw.error = "Aucune géométrie."
            else:
                raw.kind, raw.ewkt, raw.error = _from_ogr(geom)
            features.append(raw)
    return features


def _read_gdal(data: bytes, fmt: str) -> list[RawFeature]:
    with tempfile.TemporaryDirectory(prefix="pestai-import-") as tmp:
        if fmt == ImportFormat.KML:
            _check_kml(data)
            path = os.path.join(tmp, "import.kml")
            with open(path, "wb") as fh:
                fh.write(data)
            return _read_datasource(path)
        files = _safe_extract(data, tmp)
        if fmt == ImportFormat.KMZ:
            kmls = [f for f in files if f.lower().endswith(".kml")]
            if not kmls:
                raise ImportFileError("Le fichier KMZ ne contient pas de KML.")
            with open(kmls[0], "rb") as fh:
                _check_kml(fh.read())
            return _read_datasource(kmls[0])
        shps = [f for f in files if f.lower().endswith(".shp")]
        if not shps:
            raise ImportFileError(
                "L'archive ne contient pas de Shapefile (.shp, .shx, .dbf, .prj)."
            )
        if len(shps) > 1:
            raise ImportFileError("Une seule couche Shapefile par archive.")
        base = shps[0][:-4]
        missing = [
            ext
            for ext in (".shx", ".dbf")
            if not any(f.lower() == (base + ext).lower() for f in files)
        ]
        if missing:
            raise ImportFileError(
                f"Shapefile incomplet : fichier(s) {', '.join(missing)} manquant(s)."
            )
        if not any(f.lower() == (base + ".prj").lower() for f in files):
            raise ImportFileError(
                "Shapefile sans fichier .prj : la projection est inconnue. "
                "Exportez-le avec sa projection."
            )
        return _read_datasource(shps[0])


# ── GeoJSON ──────────────────────────────────────────────────────────────


def _read_geojson(data: bytes) -> list[RawFeature]:
    try:
        doc = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportFileError("GeoJSON illisible.") from exc
    if not isinstance(doc, dict):
        raise ImportFileError("GeoJSON illisible.")
    if doc.get("type") == "FeatureCollection":
        items = doc.get("features") or []
    elif doc.get("type") == "Feature":
        items = [doc]
    else:
        items = [{"type": "Feature", "properties": {}, "geometry": doc}]
    srs = None
    crs = (doc.get("crs") or {}).get("properties", {}).get("name", "")
    match = re.search(r"EPSG::?(\d+)", crs or "")
    if match and match.group(1) not in ("4326", "84"):
        srs = SpatialReference(int(match.group(1)))
    if len(items) > MAX_FEATURES:
        raise ImportFileError(f"Plus de {MAX_FEATURES} parcelles : découpez le fichier.")
    features = []
    for i, item in enumerate(items, start=1):
        props = {k: _clean(v) for k, v in ((item or {}).get("properties") or {}).items()}
        raw = RawFeature(index=i, label="", properties=props)
        geometry = (item or {}).get("geometry")
        if not geometry:
            raw.error = "Aucune géométrie."
        else:
            try:
                ogr = OGRGeometry(json.dumps(geometry))
                if srs is not None:
                    ogr.srs = srs
                raw.kind, raw.ewkt, raw.error = _from_ogr(ogr)
            except (GDALException, GEOSException, ValueError, TypeError):
                raw.error = "Géométrie GeoJSON invalide."
        features.append(raw)
    return features


# ── CSV ──────────────────────────────────────────────────────────────────


def _number(text: str) -> float:
    return float(text.strip().replace(",", ".").replace(" ", ""))


def _read_csv(data: bytes) -> list[RawFeature]:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = {h.strip().lower(): h for h in (reader.fieldnames or []) if h}
    wkt_col = next((headers[c] for c in WKT_COLUMNS if c in headers), None)
    lat_col = next((headers[c] for c in LAT_COLUMNS if c in headers), None)
    lon_col = next((headers[c] for c in LON_COLUMNS if c in headers), None)
    if not wkt_col and not (lat_col and lon_col):
        raise ImportFileError(
            "CSV sans géométrie : ajoutez une colonne « wkt » (contour) ou deux colonnes "
            "« latitude » et « longitude » (point, contour à relever)."
        )
    features = []
    for i, row in enumerate(reader, start=1):
        if i > MAX_FEATURES:
            raise ImportFileError(f"Plus de {MAX_FEATURES} parcelles : découpez le fichier.")
        props = {
            k.strip(): _clean(v)
            for k, v in row.items()
            if k and k not in (wkt_col, lat_col, lon_col)
        }
        raw = RawFeature(index=i, label="", properties=props)
        try:
            if wkt_col and (row.get(wkt_col) or "").strip():
                geos = GEOSGeometry((row[wkt_col] or "").strip(), srid=4326)
                raw.kind, raw.ewkt, raw.error = _classify(geos)
            elif lat_col and lon_col and (row.get(lat_col) or "").strip():
                lat, lon = _number(row[lat_col]), _number(row[lon_col])
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    raise ValueError
                raw.kind, raw.ewkt = "point", Point(lon, lat, srid=4326).ewkt
            else:
                raw.error = "Ligne sans géométrie."
        except (GEOSException, ValueError, TypeError):
            raw.error = "Géométrie illisible (WKT ou latitude / longitude)."
        features.append(raw)
    return features


def read_file(file_name: str, data: bytes) -> tuple[str, list[RawFeature]]:
    """Lit un fichier de parcelles ; renvoie (format, entités). Lève ImportFileError."""
    if len(data) > MAX_BYTES:
        raise ImportFileError(f"Fichier trop lourd (plus de {MAX_BYTES // (1024 * 1024)} Mo).")
    if not data:
        raise ImportFileError("Fichier vide.")
    fmt = detect_format(file_name)
    if fmt == ImportFormat.GEOJSON:
        features = _read_geojson(data)
    elif fmt == ImportFormat.CSV:
        features = _read_csv(data)
    else:
        features = _read_gdal(data, fmt)
    if not features:
        raise ImportFileError("Aucune parcelle trouvée dans le fichier.")
    return fmt, features
