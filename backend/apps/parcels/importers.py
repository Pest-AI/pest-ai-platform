"""Lecture des fichiers de parcelles (J15b, J15d) : Excel (.xlsx, Google Sheets), CSV, JSON
(GeoJSON ou liste d'enregistrements), KML, KMZ, Shapefile (.zip), GPX ; contours au format
KoboToolbox / ODK reconnus dans les tableaux.

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
import math
import os
import re
import tempfile
import unicodedata
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
        (".xlsx", ImportFormat.XLSX),
        (".gpx", ImportFormat.GPX),
    ):
        if name.endswith(suffix):
            return fmt
    raise ImportFileError(
        "Format non reconnu. Formats acceptés : Excel (.xlsx), CSV, JSON, GeoJSON, KML, KMZ, "
        "Shapefile (.zip), GPX."
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


# ── Tableaux : CSV, Excel, JSON d'enregistrements ────────────────────────
#
# Une ligne = une parcelle. La géométrie vient d'une colonne contour (WKT ou format
# KoboToolbox / ODK « lat lon alt précision;… »), ou de deux colonnes latitude / longitude
# (y compris les colonnes « …_latitude » / « …_longitude » des exports Kobo).


def normalize_header(value) -> str:
    """En-tête comparable : sans accents, minuscules, « _ » entre les mots."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


SHAPE_COLUMNS = {
    "wkt",
    "geometry",
    "geometrie",
    "geom",
    "the_geom",
    "contour",
    "contour_facultatif",
    "geoshape",
    "geotrace",
    "geopoint",
    "gps",
    "coordonnees_gps",
}
LAT_NAMES = {"latitude", "lat", "y"}
LON_NAMES = {"longitude", "lon", "lng", "long", "x"}
ODK_POINT = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+-?\d+(?:\.\d+)?){0,2}\s*$")


def _geometry_columns(headers: list[str]) -> tuple[str | None, str | None, str | None]:
    norm = {h: normalize_header(h) for h in headers}
    shape = next(
        (
            h
            for h, n in norm.items()
            if n in SHAPE_COLUMNS or n.endswith(("_geoshape", "_geotrace", "_geopoint", "_wkt"))
        ),
        None,
    )
    lat = next((h for h, n in norm.items() if n in LAT_NAMES or n.endswith("_latitude")), None)
    lon = next((h for h, n in norm.items() if n in LON_NAMES or n.endswith("_longitude")), None)
    return shape, lat, lon


def _number(value) -> float:
    if isinstance(value, int | float):
        return float(value)
    return float(str(value).strip().replace(",", ".").replace(" ", ""))


def _parse_odk(text: str) -> GEOSGeometry | None:
    """Format KoboToolbox / ODK : « lat lon alt précision » séparés par « ; »."""
    parts = [p for p in text.split(";") if p.strip()]
    coords = []
    for part in parts:
        match = ODK_POINT.match(part)
        if not match:
            return None
        lat, lon = float(match.group(1)), float(match.group(2))
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError
        coords.append((lon, lat))
    if len(coords) == 1:
        return Point(*coords[0], srid=4326)
    if len(coords) >= 3:
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        return Polygon(coords, srid=4326)
    return None


def _shape_from_text(text: str) -> GEOSGeometry:
    odk = _parse_odk(text)
    if odk is not None:
        return odk
    return GEOSGeometry(text, srid=4326)


def read_rows(rows: list[dict], *, source: str) -> list[RawFeature]:
    """Lignes d'un tableau (dictionnaires) → entités. `source` sert aux messages d'erreur."""
    headers = list(dict.fromkeys(k for row in rows for k in row if k))
    shape_col, lat_col, lon_col = _geometry_columns(headers)
    if not shape_col and not (lat_col and lon_col):
        raise ImportFileError(
            f"{source} sans géométrie : ajoutez une colonne « contour » (WKT ou relevé "
            "KoboToolbox) ou deux colonnes « latitude » et « longitude » (point, contour à "
            "relever)."
        )
    geometry_cols = {shape_col, lat_col, lon_col}
    features = []
    for i, row in enumerate(rows, start=1):
        if i > MAX_FEATURES:
            raise ImportFileError(f"Plus de {MAX_FEATURES} parcelles : découpez le fichier.")
        props = {str(k).strip(): _clean(v) for k, v in row.items() if k and k not in geometry_cols}
        raw = RawFeature(index=i, label="", properties=props)
        shape = _clean(row.get(shape_col)) if shape_col else ""
        lat = row.get(lat_col) if lat_col else None
        try:
            if shape:
                raw.kind, raw.ewkt, raw.error = _classify(_shape_from_text(shape))
            elif lat not in (None, "") and str(lat).strip():
                lat_v, lon_v = _number(lat), _number(row.get(lon_col))
                if not (-90 <= lat_v <= 90 and -180 <= lon_v <= 180):
                    raise ValueError
                raw.kind, raw.ewkt = "point", Point(lon_v, lat_v, srid=4326).ewkt
            else:
                raw.error = "Ligne sans géométrie."
        except (GEOSException, GDALException, ValueError, TypeError):
            raw.error = "Géométrie illisible (contour, ou latitude / longitude)."
        features.append(raw)
    return features


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
    rows = [
        r
        for r in csv.DictReader(io.StringIO(text), dialect=dialect)
        if any((v or "").strip() for v in r.values() if isinstance(v, str))
    ]
    return read_rows(rows, source="CSV")


def _sheet_rows(sheet) -> list[dict]:
    """Onglet Excel → lignes : la première ligne non vide donne les en-têtes."""
    rows: list[dict] = []
    headers: list[str] | None = None
    for values in sheet.iter_rows(values_only=True):
        if values is None or all(v is None or str(v).strip() == "" for v in values):
            continue
        if headers is None:
            headers = [str(v).strip() if v is not None else "" for v in values]
            continue
        if len(rows) >= MAX_FEATURES:
            raise ImportFileError(
                f"Plus de {MAX_FEATURES} lignes dans un onglet : découpez le fichier."
            )
        rows.append({h: v for h, v in zip(headers, values, strict=False) if h})
    return rows


def _read_xlsx(data: bytes) -> tuple[list[RawFeature], list[dict] | None]:
    """Classeur Excel ou Google Sheets (.xlsx). Modèle « Coopérative » : onglets Producteurs
    et Parcelles ; sinon, le premier onglet non vide contient les parcelles."""
    from openpyxl import load_workbook

    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        entries = archive.infolist()
    except zipfile.BadZipFile as exc:
        raise ImportFileError("Classeur Excel illisible (enregistrez-le au format .xlsx).") from exc
    if len(entries) > 500 or sum(e.file_size for e in entries) > MAX_ZIP_UNCOMPRESSED:
        raise ImportFileError("Classeur trop volumineux une fois décompressé.")
    try:
        book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except (
        Exception
    ) as exc:  # noqa: BLE001 - openpyxl lève des erreurs variées sur un fichier abîmé
        raise ImportFileError("Classeur Excel illisible (enregistrez-le au format .xlsx).") from exc
    try:
        sheets = {normalize_header(ws.title): ws for ws in book.worksheets}
        if "parcelles" in sheets and "producteurs" in sheets:
            producers = _sheet_rows(sheets["producteurs"])
            parcel_rows = _sheet_rows(sheets["parcelles"])
            features = read_rows(parcel_rows, source="Onglet Parcelles") if parcel_rows else []
            return features, producers
        for ws in book.worksheets:
            rows = _sheet_rows(ws)
            if rows:
                return read_rows(rows, source="Classeur"), None
        return [], None
    finally:
        book.close()


def _read_json(data: bytes) -> tuple[str, list[RawFeature]]:
    """GeoJSON, ou liste d'enregistrements (export d'application, KoboToolbox)."""
    try:
        doc = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportFileError("JSON illisible.") from exc
    if isinstance(doc, dict) and doc.get("type") in (
        "FeatureCollection",
        "Feature",
        "Polygon",
        "MultiPolygon",
        "Point",
        "LineString",
        "GeometryCollection",
    ):
        return ImportFormat.GEOJSON, _read_geojson(data)
    records = doc
    if isinstance(doc, dict):
        records = next(
            (
                doc[k]
                for k in ("results", "data", "records", "items", "parcelles")
                if isinstance(doc.get(k), list)
            ),
            None,
        )
    if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
        raise ImportFileError(
            "JSON non reconnu : GeoJSON, ou liste d'objets (une parcelle par objet)."
        )
    if len(records) > MAX_FEATURES:
        raise ImportFileError(f"Plus de {MAX_FEATURES} parcelles : découpez le fichier.")
    flat = [{k: v for k, v in r.items() if not isinstance(v, dict | list)} for r in records]
    return ImportFormat.JSON, read_rows(flat, source="JSON")


# ── GPX (GPS de poche, applications de randonnée) ───────────────────────

GPX_LAYERS = ("tracks", "routes", "waypoints")
GPX_FIELDS = ("name", "desc", "cmt", "type")
GPX_MAX_GAP_M = 25.0


def _gap_m(a, b) -> float:
    """Distance approchée en mètres entre deux points (lon, lat)."""
    lat = math.radians((a[1] + b[1]) / 2)
    dx = (b[0] - a[0]) * 111_320 * math.cos(lat)
    dy = (b[1] - a[1]) * 110_540
    return math.hypot(dx, dy)


def _read_gpx(data: bytes) -> list[RawFeature]:
    _check_kml(data)  # même refus des entités XML
    with tempfile.TemporaryDirectory(prefix="pestai-import-") as tmp:
        path = os.path.join(tmp, "import.gpx")
        with open(path, "wb") as fh:
            fh.write(data)
        try:
            source = DataSource(path)
        except GDALException as exc:
            raise ImportFileError("Fichier GPX illisible.") from exc
        features: list[RawFeature] = []
        for layer in source:
            if layer.name not in GPX_LAYERS:
                continue
            for feat in layer:
                if len(features) >= MAX_FEATURES:
                    raise ImportFileError(
                        f"Plus de {MAX_FEATURES} parcelles : découpez le fichier."
                    )
                props = {}
                for name in GPX_FIELDS:
                    if name in layer.fields:
                        value = _clean(feat.get(name))
                        if value:
                            props[name] = value
                raw = RawFeature(index=len(features) + 1, label="", properties=props)
                try:
                    geom = feat.geom
                except GDALException:
                    geom = None
                if geom is None or geom.empty:
                    raw.error = "Aucune géométrie."
                elif layer.name == "waypoints":
                    raw.kind, raw.ewkt, raw.error = _from_ogr(geom)
                else:
                    coords = []
                    for line in (
                        geom.geos if geom.geom_name.upper().startswith("MULTI") else [geom.geos]
                    ):
                        coords.extend((c[0], c[1]) for c in line.coords)
                    if len(coords) < 3:
                        raw.error = "Tracé trop court pour former un contour."
                    elif _gap_m(coords[0], coords[-1]) > GPX_MAX_GAP_M:
                        raw.error = (
                            "Tracé non refermé : le relevé doit revenir à son point de départ "
                            f"(écart de {_gap_m(coords[0], coords[-1]):.0f} m)."
                        )
                    else:
                        if coords[0] != coords[-1]:
                            coords.append(coords[0])
                        try:
                            raw.kind, raw.ewkt, raw.error = _classify(Polygon(coords, srid=4326))
                        except (GEOSException, ValueError):
                            raw.error = "Tracé illisible."
                features.append(raw)
        return features


@dataclass
class ImportContent:
    file_format: str
    features: list[RawFeature]
    producers: list[dict] | None = None  # modèle « Coopérative » : onglet Producteurs


def read_file(file_name: str, data: bytes) -> ImportContent:
    """Lit un fichier de parcelles (et, pour le modèle Excel, de producteurs)."""
    if len(data) > MAX_BYTES:
        raise ImportFileError(f"Fichier trop lourd (plus de {MAX_BYTES // (1024 * 1024)} Mo).")
    if not data:
        raise ImportFileError("Fichier vide.")
    fmt = detect_format(file_name)
    producers = None
    if fmt == ImportFormat.GEOJSON:
        fmt, features = _read_json(data)
    elif fmt == ImportFormat.CSV:
        features = _read_csv(data)
    elif fmt == ImportFormat.XLSX:
        features, producers = _read_xlsx(data)
    elif fmt == ImportFormat.GPX:
        features = _read_gpx(data)
    else:
        features = _read_gdal(data, fmt)
    if not features and not producers:
        raise ImportFileError("Aucune parcelle trouvée dans le fichier.")
    return ImportContent(fmt, features, producers)
