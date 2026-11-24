"""Import de parcelles par fichier (J15b) : aperçu, puis création à la confirmation.

1. `start_import` lit le fichier, garde les entités et calcule l'aperçu. Rien n'est créé.
2. `preview` recalcule l'aperçu avec d'autres colonnes (nom, exploitant).
3. `commit` recalcule une dernière fois puis crée les parcelles retenues, en une seule
   transaction (tout ou rien) : chacune reçoit son AgroID ; l'import garde la trace.

Statut de chaque ligne :
- `ok` : prête (un point sans contour est accepté : « contour à relever ») ;
- `flagged` : importable mais à vérifier (surface hors bornes, chevauchement, exploitant
  introuvable) ; créée seulement si l'utilisateur le demande ;
- `refused` : jamais créée (géométrie absente ou impossible, doublon dans le fichier).

Un AgroID n'étant jamais réutilisé, l'aperçu évite les imports ratés.
"""

from __future__ import annotations

import hashlib
import json

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.validators import normalize_phone_number
from apps.actors.models import ContactType, Producer
from apps.actors.selectors import visible_producers
from apps.parcels import geometry as geo
from apps.parcels import selectors, services, validation
from apps.parcels.importers import RawFeature, read_file
from apps.parcels.models import CaptureMethod, ImportFormat, ImportStatus, ParcelImport

NAME_GUESSES = (
    "name",
    "nom",
    "nom_parcelle",
    "parcelle",
    "parcel",
    "libelle",
    "libellé",
    "label",
    "titre",
)
OPERATOR_GUESSES = (
    "membership_number",
    "n_adherent",
    "num_adherent",
    "adherent",
    "matricule",
    "code_producteur",
    "telephone",
    "téléphone",
    "phone",
    "tel",
)
PHONE_HINTS = ("tel", "phone", "téléphone", "telephone", "mobile")
CAPTURE = {
    ImportFormat.KML: CaptureMethod.IMPORT_KML,
    ImportFormat.KMZ: CaptureMethod.IMPORT_KML,
    ImportFormat.SHAPEFILE: CaptureMethod.IMPORT_SHAPEFILE,
    ImportFormat.GEOJSON: CaptureMethod.IMPORT_GEOJSON,
    ImportFormat.CSV: CaptureMethod.IMPORT_CSV,
}
OVERLAP_IN_FILE_PERCENT = 5.0
DEFAULT_COUNTRY_CODE = "+221"


def _columns(features: list[dict]) -> list[str]:
    seen: dict[str, None] = {}
    for f in features:
        for key in f["properties"]:
            seen.setdefault(key, None)
    return list(seen)


def guess_mapping(columns: list[str]) -> dict:
    lower = {c.lower(): c for c in columns}
    name = next((lower[g] for g in NAME_GUESSES if g in lower), None)
    operator = next((lower[g] for g in OPERATOR_GUESSES if g in lower), None)
    key = (
        "phone"
        if operator and any(h in operator.lower() for h in PHONE_HINTS)
        else "membership_number"
    )
    return {
        "name_column": name,
        "operator_column": operator,
        "operator_key": key if operator else "none",
    }


def clean_mapping(mapping: dict, columns: list[str]) -> dict:
    name = mapping.get("name_column") or None
    operator = mapping.get("operator_column") or None
    key = mapping.get("operator_key") or "none"
    if name and name not in columns:
        raise ValidationError({"name_column": "Colonne inconnue dans ce fichier."})
    if operator and operator not in columns:
        raise ValidationError({"operator_column": "Colonne inconnue dans ce fichier."})
    if key not in ("membership_number", "phone", "none"):
        raise ValidationError({"operator_key": "Valeurs : membership_number, phone, none."})
    if not operator:
        key = "none"
    return {"name_column": name, "operator_column": operator, "operator_key": key}


def _producer_index(organization, key: str) -> dict[str, object]:
    """Producteurs de l'organisation par n° d'adhérent ou par téléphone (minuscules, E.164)."""
    index: dict[str, object] = {}
    producers = visible_producers(organization)
    for p in producers:
        if key == "membership_number":
            for a in p.assignments.all():
                if (
                    a.organization_id == organization.pk
                    and a.end_date is None
                    and a.membership_number
                ):
                    index[a.membership_number.strip().lower()] = p
        elif key == "phone":
            for c in p.contacts.all():
                if c.contact_type in (ContactType.PHONE, ContactType.WHATSAPP):
                    index[c.value] = p
    return index


def _phone(value: str) -> str:
    """Numéro de fichier → E.164 ; numéro local sénégalais à 9 chiffres complété en +221."""
    number = normalize_phone_number(value) or ""
    if number.isdigit() and len(number) == 9:
        return DEFAULT_COUNTRY_CODE + number
    if number.isdigit() and number.startswith("221") and len(number) == 12:
        return "+" + number
    return number


def _lookup(index: dict, key: str, value: str):
    if not value:
        return None
    if key == "phone":
        return index.get(_phone(value))
    return index.get(value.strip().lower())


def evaluate(record: ParcelImport, mapping: dict) -> tuple[list[dict], dict]:
    """Aperçu : une ligne par entité, avec statut, motifs et contour (GeoJSON)."""
    rules = validation.rules()
    visible = {
        str(pk)
        for pk in selectors.visible_parcels(record.organization).values_list("pk", flat=True)
    }
    index = (
        _producer_index(record.organization, mapping["operator_key"])
        if mapping["operator_key"] != "none"
        else {}
    )
    rows: list[dict] = []
    polygons: list[tuple[int, MultiPolygon]] = []
    for f in record.features:
        props = f["properties"]
        label = (props.get(mapping["name_column"]) if mapping["name_column"] else "") or ""
        row = {
            "index": f["index"],
            "label": label[:150],
            "status": "ok",
            "messages": [],
            "kind": f["kind"],
            "area_m2": None,
            "operator": None,
            "geometry": None,
        }
        if f.get("error") or not f.get("ewkt"):
            row.update(status="refused", messages=[f.get("error") or "Aucune géométrie."])
            rows.append(row)
            continue
        geom = GEOSGeometry(f["ewkt"])
        row["geometry"] = json.loads(geom.geojson)
        if f["kind"] == "polygon":
            try:
                measured = geo.measure(geom)
            except ValidationError as exc:
                row.update(status="refused", messages=[next(iter(exc.message_dict.values()))[0]])
                rows.append(row)
                continue
            area = float(measured.area_m2)
            row["area_m2"] = str(measured.area_m2)
            if area < rules["MIN_AREA_M2"]:
                row["messages"].append(validation.FLAG_LABELS[validation.AREA_TOO_SMALL])
            if area > rules["MAX_AREA_M2"]:
                row["messages"].append(validation.FLAG_LABELS[validation.AREA_TOO_LARGE])
            for hit in validation.overlaps_with_existing(geom, area, visible):
                if hit["percent"] > rules["MAX_OVERLAP_PERCENT"]:
                    who = hit["agroid"] or "une parcelle hors de votre périmètre"
                    row["messages"].append(f"Chevauche {who} ({hit['percent']:.0f} %).")
            polygons.append((len(rows), geom))
        else:
            row["messages"].append("Point sans contour : contour à relever sur le terrain.")
        if mapping["operator_column"]:
            value = props.get(mapping["operator_column"], "")
            producer = _lookup(index, mapping["operator_key"], value)
            if producer is not None:
                row["operator"] = {
                    "id": str(producer.pk),
                    "name": f"{producer.first_name} {producer.last_name}",
                }
            elif value:
                row["messages"].append(
                    f"Exploitant « {value} » introuvable dans votre organisation."
                )
        if any(m for m in row["messages"] if not m.startswith("Point sans contour")):
            row["status"] = "flagged"
        rows.append(row)

    # Doublons et chevauchements à l'intérieur du fichier.
    for a in range(len(polygons)):
        ia, ga = polygons[a]
        if rows[ia]["status"] == "refused":
            continue
        for b in range(a + 1, len(polygons)):
            ib, gb = polygons[b]
            if rows[ib]["status"] == "refused" or not ga.envelope.intersects(gb.envelope):
                continue
            if ga.equals_exact(gb, 1e-7):
                rows[ib].update(
                    status="refused", messages=[f"Doublon de la ligne {rows[ia]['index']}."]
                )
                continue
            if ga.intersects(gb):
                shared = ga.intersection(gb).area
                smaller = min(ga.area, gb.area) or 1
                if 100 * shared / smaller > OVERLAP_IN_FILE_PERCENT:
                    for i, other in ((ia, ib), (ib, ia)):
                        rows[i]["messages"].append(
                            f"Chevauche la ligne {rows[other]['index']} du fichier."
                        )
                        rows[i]["status"] = "flagged"

    summary = {
        "total": len(rows),
        "ok": sum(r["status"] == "ok" for r in rows),
        "flagged": sum(r["status"] == "flagged" for r in rows),
        "refused": sum(r["status"] == "refused" for r in rows),
        "without_contour": sum(r["kind"] == "point" and r["status"] != "refused" for r in rows),
        "with_operator": sum(r["operator"] is not None for r in rows),
    }
    return rows, summary


@transaction.atomic
def start_import(
    *, organization, by, file_name: str, data: bytes
) -> tuple[ParcelImport, list[dict]]:
    fmt, features = read_file(file_name, data)
    raw = [f.as_dict() if isinstance(f, RawFeature) else f for f in features]
    columns = _columns(raw)
    record = ParcelImport.objects.create(
        organization=organization,
        file_name=file_name[:255],
        file_format=fmt,
        file_size=len(data),
        file_sha256=hashlib.sha256(data).hexdigest(),
        columns=columns,
        features=raw,
        mapping=guess_mapping(columns),
        created_by=by,
        updated_by=by,
    )
    rows, summary = evaluate(record, record.mapping)
    record.summary = summary
    record.save(update_fields=["summary", "updated_at"])
    return record, rows


def _check_open(record: ParcelImport) -> None:
    if record.status != ImportStatus.PREVIEWED:
        raise ValidationError("Cet import est déjà terminé.")


@transaction.atomic
def preview(record: ParcelImport, *, mapping: dict, by) -> list[dict]:
    record = ParcelImport.objects.select_for_update().get(pk=record.pk)
    _check_open(record)
    record.mapping = clean_mapping(mapping, record.columns)
    rows, summary = evaluate(record, record.mapping)
    record.summary = summary
    record.updated_by = by
    record.save(update_fields=["mapping", "summary", "updated_by", "updated_at"])
    return rows


@transaction.atomic
def commit(record: ParcelImport, *, by, include_flagged: bool = False) -> ParcelImport:
    """Crée les parcelles retenues (tout ou rien) ; l'aperçu est recalculé juste avant."""
    record = ParcelImport.objects.select_for_update().get(pk=record.pk)
    _check_open(record)
    rows, summary = evaluate(record, record.mapping)
    keep = [
        r for r in rows if r["status"] == "ok" or (include_flagged and r["status"] == "flagged")
    ]
    if not keep:
        raise ValidationError("Aucune parcelle à importer.")
    method = CAPTURE[record.file_format]
    features = {f["index"]: f for f in record.features}
    today = timezone.localdate()
    created = 0
    agroids: dict[int, str] = {}
    for row in keep:
        f = features[row["index"]]
        parcel = services.create_parcel(
            by=by,
            organization=record.organization,
            local_name=row["label"],
            geometry=row["geometry"] if f["kind"] == "polygon" else None,
            capture_method=method,
        )
        if f["kind"] == "point":
            parcel.centroid = GEOSGeometry(f["ewkt"])
            parcel.save(update_fields=["centroid", "updated_at"])
        if row["operator"]:
            services.assign_operator(
                parcel,
                Producer.objects.get(pk=row["operator"]["id"]),
                by=by,
                role="primary",
                start_date=today,
                recorded_by_organization=record.organization,
            )
        type(parcel).objects.filter(pk=parcel.pk).update(import_batch=record)
        agroids[row["index"]] = parcel.agroid
        created += 1
    record.status = ImportStatus.COMMITTED
    # Bilan ligne par ligne, sans les contours : base du rapport téléchargeable.
    report = [
        {
            "index": r["index"],
            "label": r["label"],
            "status": r["status"],
            "messages": r["messages"],
            "operator": (r["operator"] or {}).get("name"),
            "agroid": agroids.get(r["index"]),
        }
        for r in rows
    ]
    record.summary = summary | {
        "created": created,
        "include_flagged": include_flagged,
        "report": report,
    }
    record.parcels_created = created
    record.committed_at = timezone.now()
    record.committed_by = by
    record.features = []  # les entités ne servent plus : on ne garde que la trace
    record.updated_by = by
    record.save()
    return record


@transaction.atomic
def discard(record: ParcelImport, *, by) -> ParcelImport:
    record = ParcelImport.objects.select_for_update().get(pk=record.pk)
    _check_open(record)
    record.status = ImportStatus.DISCARDED
    record.features = []
    record.updated_by = by
    record.save()
    return record
