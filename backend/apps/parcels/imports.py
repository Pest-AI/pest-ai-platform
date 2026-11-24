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

Modèle Excel « Coopérative » (J15d) : un onglet Producteurs (créés d'abord, avec la même
détection de doublons D-28 que la saisie) et un onglet Parcelles, reliés par le n° d'adhérent.
Un producteur déjà dans le registre de l'organisation n'est pas recréé.

Un AgroID n'étant jamais réutilisé, l'aperçu évite les imports ratés.
"""

from __future__ import annotations

import hashlib
import json

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.validators import normalize_phone_number, validate_e164
from apps.actors import selectors as actor_selectors
from apps.actors import services as actor_services
from apps.actors.models import ContactType, Producer
from apps.actors.selectors import visible_producers
from apps.parcels import geometry as geo
from apps.parcels import selectors, services, validation
from apps.parcels.importers import RawFeature, normalize_header, read_file
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
    "phone",
    "tel",
)
PHONE_HINTS = ("tel", "phone", "telephone", "mobile")
CAPTURE = {
    ImportFormat.KML: CaptureMethod.IMPORT_KML,
    ImportFormat.KMZ: CaptureMethod.IMPORT_KML,
    ImportFormat.SHAPEFILE: CaptureMethod.IMPORT_SHAPEFILE,
    ImportFormat.GEOJSON: CaptureMethod.IMPORT_GEOJSON,
    ImportFormat.CSV: CaptureMethod.IMPORT_CSV,
    ImportFormat.XLSX: CaptureMethod.IMPORT_XLSX,
    ImportFormat.JSON: CaptureMethod.IMPORT_JSON,
    ImportFormat.GPX: CaptureMethod.IMPORT_GPX,
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
    """Colonnes probables du nom de parcelle et de l'exploitant (en-têtes normalisés)."""
    norm = {c: normalize_header(c) for c in columns}
    name = next(
        (
            c
            for c, n in norm.items()
            if n in NAME_GUESSES or n.startswith(("nom_de_la_parcelle", "nom_parcelle"))
        ),
        None,
    )
    operator = next(
        (
            c
            for c, n in norm.items()
            if n in OPERATOR_GUESSES or "adherent" in n or "matricule" in n
        ),
        None,
    ) or next((c for c, n in norm.items() if any(h in n for h in PHONE_HINTS)), None)
    key = "membership_number"
    if operator and any(h in norm[operator] for h in PHONE_HINTS):
        key = "phone"
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
            for a in p.org_assignments:
                if a.end_date is None and a.membership_number:
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


# ── Onglet Producteurs du modèle « Coopérative » (J15d) ────────────────

PRODUCER_COLUMNS = {
    "first_name": ("prenom", "prenoms", "first_name"),
    "last_name": ("nom", "nom_de_famille", "last_name"),
    "sex": ("sexe", "sexe_f_h", "genre", "sex"),
    "birth_year": ("annee_de_naissance", "annee_naissance", "birth_year"),
    "locality_text": ("village", "village_localite", "localite", "village_quartier", "locality"),
    "phone": ("telephone", "tel", "phone", "numero_de_telephone"),
    "membership_number": (
        "n_d_adherent",
        "numero_d_adherent",
        "numero_adherent",
        "n_adherent",
        "adherent",
        "matricule",
        "membership_number",
    ),
    "relationship_type": ("type_de_rattachement", "rattachement", "relation"),
    "preferred_language": ("langue", "langue_preferee"),
}
SEX_VALUES = {
    "f": "female",
    "femme": "female",
    "female": "female",
    "h": "male",
    "m": "male",
    "homme": "male",
    "male": "male",
}
RELATION_VALUES = {
    "membre": "member",
    "member": "member",
    "beneficiaire": "beneficiary",
    "beneficiary": "beneficiary",
    "client": "client",
}
LANGUAGE_VALUES = {
    "francais": "fr",
    "fr": "fr",
    "wolof": "wo",
    "wo": "wo",
    "pulaar": "ff",
    "peul": "ff",
    "ff": "ff",
}


def _producer_field(row: dict, field: str) -> str:
    names = PRODUCER_COLUMNS[field]
    for key, value in row.items():
        if normalize_header(key) in names:
            return (value or "").strip()
    return ""


def evaluate_producers(record: ParcelImport) -> list[dict]:
    """Aperçu de l'onglet Producteurs : à créer, déjà dans le registre, à vérifier, refusé."""
    org = record.organization
    by_number = _producer_index(org, "membership_number")
    by_phone = _producer_index(org, "phone")
    lines: list[dict] = []
    seen_numbers: dict[str, int] = {}
    seen_phones: dict[str, int] = {}
    for i, row in enumerate(record.producer_rows, start=1):
        f = {name: _producer_field(row, name) for name in PRODUCER_COLUMNS}
        line = {
            "index": i,
            "name": f"{f['first_name']} {f['last_name']}".strip(),
            "phone": "",
            "membership_number": f["membership_number"],
            "locality": f["locality_text"],
            "status": "ok",
            "action": "create",
            "messages": [],
            "fields": {},
        }
        problems = []
        if not f["first_name"] or not f["last_name"]:
            problems.append("Prénom et nom obligatoires.")
        phone = _phone(f["phone"]) if f["phone"] else ""
        if phone:
            try:
                validate_e164(phone)
                line["phone"] = phone
            except ValidationError:
                problems.append(f"Téléphone « {f['phone']} » invalide.")
        year = None
        if f["birth_year"]:
            try:
                year = int(float(f["birth_year"].replace(",", ".")))
                if not 1900 <= year <= timezone.localdate().year:
                    raise ValueError
            except ValueError:
                problems.append(f"Année de naissance « {f['birth_year']} » invalide.")
        sex = SEX_VALUES.get(normalize_header(f["sex"]), "unspecified" if not f["sex"] else None)
        if sex is None:
            problems.append(f"Sexe « {f['sex']} » non reconnu (F ou H).")
        relation = RELATION_VALUES.get(normalize_header(f["relationship_type"]) or "membre")
        if relation is None:
            problems.append(
                f"Rattachement « {f['relationship_type']} » non reconnu "
                "(membre, bénéficiaire, client)."
            )
        language = LANGUAGE_VALUES.get(normalize_header(f["preferred_language"]) or "fr")
        if language is None:
            problems.append(f"Langue « {f['preferred_language']} » non reconnue.")
        number = f["membership_number"].lower()
        if number and number in seen_numbers:
            problems.append(f"N° d'adhérent déjà utilisé ligne {seen_numbers[number]}.")
        if phone and phone in seen_phones:
            problems.append(f"Téléphone déjà utilisé ligne {seen_phones[phone]}.")
        if number:
            seen_numbers.setdefault(number, i)
        if phone:
            seen_phones.setdefault(phone, i)
        if problems:
            line.update(status="refused", action=None, messages=problems)
            lines.append(line)
            continue
        existing = (by_number.get(number) if number else None) or (
            by_phone.get(phone) if phone else None
        )
        if existing is not None:
            line.update(
                action="existing",
                producer_id=str(existing.pk),
                messages=["Déjà dans votre registre : pas de nouvelle fiche."],
            )
            lines.append(line)
            continue
        candidates = actor_selectors.find_duplicates(
            first_name=f["first_name"],
            last_name=f["last_name"],
            phone=phone or None,
            locality=f["locality_text"],
        )
        if candidates:
            line.update(
                status="flagged",
                messages=[
                    "Producteur probablement déjà enregistré (même téléphone, ou même nom dans "
                    "la même localité) : vérifiez avant de créer une nouvelle fiche."
                ],
            )
        line["fields"] = {
            "first_name": f["first_name"],
            "last_name": f["last_name"],
            "sex": sex,
            "birth_year": year,
            "locality_text": f["locality_text"],
            "preferred_language": language,
            "relationship_type": relation,
        }
        lines.append(line)
    return lines


def _file_producer_index(lines: list[dict], key: str) -> dict[str, dict]:
    index = {}
    for line in lines:
        value = line["membership_number"].lower() if key == "membership_number" else line["phone"]
        if value:
            index.setdefault(value, line)
    return index


def _lookup(index: dict, key: str, value: str):
    if not value:
        return None
    if key == "phone":
        return index.get(_phone(value))
    return index.get(value.strip().lower())


def evaluate(record: ParcelImport, mapping: dict) -> tuple[list[dict], dict, list[dict]]:
    """Aperçu : une ligne par parcelle (statut, motifs, contour GeoJSON), le résumé et, pour le
    modèle « Coopérative », les lignes de l'onglet Producteurs."""
    producer_lines = evaluate_producers(record) if record.producer_rows else []
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
    file_index = (
        _file_producer_index(producer_lines, mapping["operator_key"])
        if producer_lines and mapping["operator_key"] != "none"
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
            in_file = _lookup(file_index, mapping["operator_key"], value) if file_index else None
            if producer is not None:
                row["operator"] = {
                    "id": str(producer.pk),
                    "name": f"{producer.first_name} {producer.last_name}",
                }
            elif in_file is not None and in_file["status"] != "refused":
                row["operator"] = {
                    "id": in_file.get("producer_id"),
                    "name": in_file["name"],
                    "producer_line": in_file["index"],
                }
                if in_file["status"] == "flagged":
                    row["messages"].append(
                        f"Exploitant à vérifier (onglet Producteurs, ligne {in_file['index']})."
                    )
            elif in_file is not None:
                row["messages"].append(
                    f"Exploitant refusé dans l'onglet Producteurs (ligne {in_file['index']})."
                )
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
    if producer_lines:
        summary["producers"] = {
            "total": len(producer_lines),
            "create": sum(p["action"] == "create" and p["status"] == "ok" for p in producer_lines),
            "existing": sum(p["action"] == "existing" for p in producer_lines),
            "flagged": sum(p["status"] == "flagged" for p in producer_lines),
            "refused": sum(p["status"] == "refused" for p in producer_lines),
        }
    return rows, summary, producer_lines


@transaction.atomic
def start_import(
    *, organization, by, file_name: str, data: bytes
) -> tuple[ParcelImport, list[dict], list[dict]]:
    content = read_file(file_name, data)
    fmt = content.file_format
    raw = [f.as_dict() if isinstance(f, RawFeature) else f for f in content.features]
    producer_rows = [
        {str(k): ("" if v is None else str(v).strip()[:200]) for k, v in row.items()}
        for row in (content.producers or [])
    ]
    columns = _columns(raw)
    record = ParcelImport.objects.create(
        organization=organization,
        file_name=file_name[:255],
        file_format=fmt,
        file_size=len(data),
        file_sha256=hashlib.sha256(data).hexdigest(),
        columns=columns,
        features=raw,
        producer_rows=producer_rows,
        mapping=guess_mapping(columns),
        created_by=by,
        updated_by=by,
    )
    rows, summary, producer_lines = evaluate(record, record.mapping)
    record.summary = summary
    record.save(update_fields=["summary", "updated_at"])
    return record, rows, producer_lines


def _check_open(record: ParcelImport) -> None:
    if record.status != ImportStatus.PREVIEWED:
        raise ValidationError("Cet import est déjà terminé.")


@transaction.atomic
def preview(record: ParcelImport, *, mapping: dict, by) -> tuple[list[dict], list[dict]]:
    record = ParcelImport.objects.select_for_update().get(pk=record.pk)
    _check_open(record)
    record.mapping = clean_mapping(mapping, record.columns)
    rows, summary, producer_lines = evaluate(record, record.mapping)
    record.summary = summary
    record.updated_by = by
    record.save(update_fields=["mapping", "summary", "updated_by", "updated_at"])
    return rows, producer_lines


@transaction.atomic
def commit(record: ParcelImport, *, by, include_flagged: bool = False) -> ParcelImport:
    """Crée les producteurs puis les parcelles retenus (tout ou rien) ; l'aperçu est recalculé
    juste avant."""
    record = ParcelImport.objects.select_for_update().get(pk=record.pk)
    _check_open(record)
    rows, summary, producer_lines = evaluate(record, record.mapping)
    keep = [
        r for r in rows if r["status"] == "ok" or (include_flagged and r["status"] == "flagged")
    ]
    new_producers = [
        p
        for p in producer_lines
        if p["action"] == "create"
        and (p["status"] == "ok" or (include_flagged and p["status"] == "flagged"))
    ]
    if not keep and not new_producers:
        raise ValidationError("Rien à importer.")
    # 1. Producteurs de l'onglet Producteurs (mêmes règles que la saisie ; D-28 vérifiée).
    created_producers: dict[int, Producer] = {}
    for line in new_producers:
        fields = dict(line["fields"])
        relation = fields.pop("relationship_type")
        created_producers[line["index"]] = actor_services.register_producer(
            organization=record.organization,
            registered_by=by,
            phone_number=line["phone"] or None,
            membership_number=line["membership_number"] or None,
            relationship_type=relation,
            confirm_new=True,
            **fields,
        )
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
            position=GEOSGeometry(f["ewkt"]) if f["kind"] == "point" else None,
            capture_method=method,
        )
        operator = None
        if row["operator"] and row["operator"].get("id"):
            operator = Producer.objects.get(pk=row["operator"]["id"])
        elif row["operator"]:
            operator = created_producers.get(row["operator"]["producer_line"])
        if operator is not None:
            services.assign_operator(
                parcel,
                operator,
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
    producer_report = [
        {
            k: v
            for k, v in (line | {"created": line["index"] in created_producers}).items()
            if k not in ("fields", "producer_id")
        }
        for line in producer_lines
    ]
    record.summary = summary | {
        "created": created,
        "producers_created": len(created_producers),
        "include_flagged": include_flagged,
        "report": report,
        "producer_report": producer_report,
    }
    record.producers_created = len(created_producers)
    record.producer_rows = []
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
    record.producer_rows = []
    record.updated_by = by
    record.save()
    return record
