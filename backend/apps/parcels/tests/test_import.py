"""Import de parcelles par fichier (J15b) : formats, sécurité, aperçu, confirmation, API."""

import io
import json
import struct
import zipfile

import pytest
from django.contrib.gis.gdal import OGRGeometry, SpatialReference
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.actors import services as actor_services
from apps.parcels import imports, selectors, services
from apps.parcels.importers import ImportFileError
from apps.parcels.importers import read_file as _read_file
from apps.parcels.models import CaptureMethod, ImportStatus, Parcel, ParcelImport
from apps.parcels.tests.test_parcels import D_LAT, D_LON, LAT, LON, square

pytestmark = pytest.mark.django_db
URL = "/api/v1/parcel-imports/"


def read_file(name, data):
    content = _read_file(name, data)
    return content.file_format, content.features


# ── Fichiers d'exemple ───────────────────────────────────────────────────


def ring(lon=LON, lat=LAT):
    return square(lon, lat)["coordinates"][0]


def kml(placemarks: list[tuple[str, list]]) -> bytes:
    body = "".join(
        f"<Placemark><name>{name}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>"
        + " ".join(f"{x},{y},0" for x, y in coords)
        + "</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>"
        for name, coords in placemarks
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2">'
        f"<Document>{body}</Document></kml>"
    ).encode()


def zipped(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


def shapefile(polygons: list[tuple[str, list]], epsg: int = 32628) -> dict[str, bytes]:
    """Shapefile minimal (polygones, champ « nom »), coordonnées projetées en `epsg`."""
    srs = SpatialReference(epsg)
    projected = []
    for name, coords in polygons:
        g = OGRGeometry(json.dumps({"type": "Polygon", "coordinates": [coords]}), srs=4326)
        g.transform(srs)
        pts = list(reversed(g.coords[0]))  # anneau extérieur dans le sens horaire
        projected.append((name, [(p[0], p[1]) for p in pts]))
    xs = [p[0] for _, pts in projected for p in pts]
    ys = [p[1] for _, pts in projected for p in pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))

    records, index, offset = b"", b"", 50
    for i, (_, pts) in enumerate(projected, start=1):
        px = [p[0] for p in pts]
        py = [p[1] for p in pts]
        content = struct.pack("<i4d2i", 5, min(px), min(py), max(px), max(py), 1, len(pts))
        content += struct.pack("<i", 0) + b"".join(struct.pack("<2d", *p) for p in pts)
        records += struct.pack(">2i", i, len(content) // 2) + content
        index += struct.pack(">2i", offset, len(content) // 2)
        offset += 4 + len(content) // 2

    def header(length_bytes):
        return (
            struct.pack(">7i", 9994, 0, 0, 0, 0, 0, length_bytes // 2)
            + struct.pack("<2i", 1000, 5)
            + struct.pack("<4d", *bbox)
            + struct.pack("<4d", 0, 0, 0, 0)
        )

    shp = header(100 + len(records)) + records
    shx = header(100 + len(index)) + index
    field = b"nom".ljust(11, b"\0") + b"C" + b"\0" * 4 + bytes([40, 0]) + b"\0" * 14
    dbf = struct.pack("<B3BIHH20x", 3, 126, 11, 24, len(projected), 32 + 32 + 1, 41)
    dbf += field + b"\r"
    for name, _ in projected:
        dbf += b" " + name.encode("latin-1").ljust(40)
    dbf += b"\x1a"
    return {"champs.shp": shp, "champs.shx": shx, "champs.dbf": dbf, "champs.prj": srs.wkt.encode()}


def geojson(features: list[tuple[dict, dict | None]]) -> bytes:
    return json.dumps(
        {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": p, "geometry": g} for p, g in features],
        }
    ).encode()


def wkt(lon=LON, lat=LAT):
    return "POLYGON((" + ", ".join(f"{x} {y}" for x, y in ring(lon, lat)) + "))"


# ── Lecture des formats ──────────────────────────────────────────────────


def test_kml():
    fmt, feats = read_file("champs.kml", kml([("Champ A", ring())]))
    assert fmt == "kml" and len(feats) == 1
    assert feats[0].kind == "polygon" and feats[0].properties["Name"] == "Champ A"


def test_kmz():
    data = zipped({"doc.kml": kml([("A", ring()), ("B", ring(LON + 0.01))])})
    fmt, feats = read_file("export.kmz", data)
    assert fmt == "kmz" and [f.kind for f in feats] == ["polygon", "polygon"]


def test_shapefile_reprojete_en_wgs84():
    fmt, feats = read_file("champs.zip", zipped(shapefile([("Champ du fleuve", ring())])))
    assert fmt == "shapefile" and feats[0].properties["nom"] == "Champ du fleuve"
    from django.contrib.gis.geos import GEOSGeometry

    centroid = GEOSGeometry(feats[0].ewkt).centroid
    assert abs(centroid.x - (LON + D_LON / 2)) < 1e-4  # longitude d'abord : pas d'inversion
    assert abs(centroid.y - (LAT + D_LAT / 2)) < 1e-4


def test_shapefile_sans_prj_refuse():
    files = shapefile([("A", ring())])
    del files["champs.prj"]
    with pytest.raises(ImportFileError, match="projection"):
        read_file("champs.zip", zipped(files))


def test_geojson_et_entite_sans_geometrie():
    data = geojson([({"nom": "A"}, square()), ({"nom": "B"}, None)])
    _, feats = read_file("champs.geojson", data)
    assert feats[0].kind == "polygon" and feats[1].error == "Aucune géométrie."


@pytest.mark.parametrize("sep", [",", ";"])
def test_csv_wkt_et_points(sep):
    lines = [
        sep.join(["nom", "wkt", "latitude", "longitude"]),
        sep.join(["Contour", f'"{wkt()}"', "", ""]),
        sep.join(["Point", "", "16,66" if sep == ";" else "16.66", "-14.95"]),
    ]
    _, feats = read_file("liste.csv", "\n".join(lines).encode())
    assert [f.kind for f in feats] == ["polygon", "point"]
    assert feats[0].properties == {"nom": "Contour"}


def test_csv_sans_geometrie_refuse():
    with pytest.raises(ImportFileError, match="CSV sans géométrie"):
        read_file("liste.csv", b"nom,village\nA,Guede\n")


def test_ligne_non_fermee_signalee():
    data = geojson([({}, {"type": "LineString", "coordinates": ring()[:3]})])
    _, feats = read_file("trace.geojson", data)
    assert feats[0].kind == "none" and "non fermée" in feats[0].error


# ── Sécurité des fichiers ────────────────────────────────────────────────


def test_kml_avec_entites_refuse():
    data = b'<?xml version="1.0"?><!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml>&x;</kml>'
    with pytest.raises(ImportFileError, match="entités XML"):
        read_file("piege.kml", data)


def test_archive_trop_chargee_refusee():
    data = zipped({f"f{i}.txt": b"x" for i in range(60)})
    with pytest.raises(ImportFileError, match="trop chargée"):
        read_file("champs.zip", data)


def test_chemin_sortant_ignore(tmp_path):
    files = shapefile([("A", ring())])
    files["../../evil.txt"] = b"x"
    _, feats = read_file("champs.zip", zipped(files))
    assert len(feats) == 1


def test_format_inconnu_et_fichier_vide():
    with pytest.raises(ImportFileError, match="Format non reconnu"):
        read_file("champs.docx", b"x")
    with pytest.raises(ImportFileError, match="vide"):
        read_file("champs.kml", b"")


def test_limite_d_entites(monkeypatch):
    monkeypatch.setattr("apps.parcels.importers.MAX_FEATURES", 2)
    data = geojson([({}, square(LON + i * 0.01)) for i in range(3)])
    with pytest.raises(ImportFileError, match="découpez"):
        read_file("champs.geojson", data)


# ── Aperçu et confirmation ───────────────────────────────────────────────


@pytest.fixture
def org(make_org):
    return make_org("Coopérative de Guédé")


@pytest.fixture
def user(org, make_member):
    return make_member(org, "organization_admin")[0]


@pytest.fixture
def producer(org, user):
    return actor_services.register_producer(
        organization=org,
        registered_by=user,
        phone_number="+221770001111",
        membership_number="ADH-042",
        first_name="Awa",
        last_name="Sow",
    )


def start(org, user, name, data):
    record, rows, _ = imports.start_import(organization=org, by=user, file_name=name, data=data)
    return record, rows


def test_apercu_ne_cree_rien(org, user):
    record, rows = start(org, user, "champs.kml", kml([("A", ring())]))
    assert Parcel.objects.count() == 0
    assert record.status == ImportStatus.PREVIEWED and record.summary["ok"] == 1
    assert rows[0]["status"] == "ok" and rows[0]["geometry"]["type"] == "MultiPolygon"
    assert record.mapping["name_column"] == "Name"


def test_doublon_et_chevauchement_dans_le_fichier(org, user):
    half = D_LON / 2
    data = geojson(
        [({"nom": "A"}, square()), ({"nom": "A bis"}, square()), ({"nom": "C"}, square(LON + half))]
    )
    record, rows = start(org, user, "champs.geojson", data)
    assert rows[1]["status"] == "refused" and "Doublon de la ligne 1" in rows[1]["messages"][0]
    assert rows[0]["status"] == "flagged" and rows[2]["status"] == "flagged"
    assert record.summary == record.summary | {"refused": 1, "flagged": 2, "ok": 0}


def test_chevauchement_avec_parcelle_existante(org, user):
    existing = services.create_parcel(by=user, organization=org, geometry=square())
    _, rows = start(org, user, "champs.geojson", geojson([({}, square(LON + D_LON / 4))]))
    assert rows[0]["status"] == "flagged"
    assert existing.agroid in rows[0]["messages"][0]


def test_exploitant_par_numero_ou_telephone(org, user, producer):
    data = geojson(
        [
            ({"nom": "A", "adherent": "adh-042", "tel": "77 000 11 11"}, square()),
            ({"nom": "B", "adherent": "X-999", "tel": ""}, square(LON + 0.01)),
        ]
    )
    record, rows = start(org, user, "champs.geojson", data)
    assert record.mapping == {
        "name_column": "nom",
        "operator_column": "adherent",
        "operator_key": "membership_number",
    }
    assert rows[0]["operator"]["id"] == str(producer.pk)
    assert rows[1]["status"] == "flagged" and "X-999" in rows[1]["messages"][0]
    rows, _ = imports.preview(
        record,
        mapping={"name_column": "nom", "operator_column": "tel", "operator_key": "phone"},
        by=user,
    )
    assert rows[0]["operator"]["name"] == "Awa Sow" and rows[1]["status"] == "ok"


def test_colonne_inconnue_refusee(org, user):
    record, _ = start(org, user, "champs.kml", kml([("A", ring())]))
    with pytest.raises(ValidationError):
        imports.preview(record, mapping={"name_column": "absent"}, by=user)


def test_confirmation_cree_les_parcelles(org, user, producer):
    data = geojson(
        [
            ({"nom": "A", "adherent": "ADH-042"}, square()),
            ({"nom": "B"}, {"type": "Point", "coordinates": [LON + 0.02, LAT]}),
            ({"nom": "Doublon"}, square()),
            ({"nom": "Inconnu", "adherent": "X"}, square(LON + 0.01)),
        ]
    )
    record, _ = start(org, user, "champs.geojson", data)
    record = imports.commit(record, by=user)
    assert record.status == ImportStatus.COMMITTED and record.parcels_created == 2
    assert record.features == []
    report = {line["label"]: line for line in record.summary["report"]}
    assert report["A"]["agroid"] == Parcel.objects.get(local_name="A").agroid
    assert report["A"]["operator"] == "Awa Sow"
    assert report["Doublon"]["agroid"] is None and report["Doublon"]["status"] == "refused"
    parcels = {p.local_name: p for p in Parcel.objects.filter(import_batch=record)}
    assert set(parcels) == {"A", "B"}
    a, b = parcels["A"], parcels["B"]
    assert a.agroid.startswith("PAI-SN-") and a.status == "active"
    assert selectors.current_geometry(a).capture_method == CaptureMethod.IMPORT_GEOJSON
    assert a.operators.get().producer == producer
    assert selectors.current_geometry(b) is None and b.centroid is not None
    with pytest.raises(ValidationError, match="déjà terminé"):
        imports.commit(record, by=user)


def test_confirmation_avec_lignes_signalees(org, user):
    data = geojson([({"nom": "A", "adherent": "X"}, square())])
    record, _ = start(org, user, "champs.geojson", data)
    with pytest.raises(ValidationError, match="Rien à importer"):
        imports.commit(record, by=user)
    record = imports.commit(record, by=user, include_flagged=True)
    assert record.parcels_created == 1


def test_abandon(org, user):
    record, _ = start(org, user, "champs.kml", kml([("A", ring())]))
    record = imports.discard(record, by=user)
    assert record.status == ImportStatus.DISCARDED and Parcel.objects.count() == 0


def test_import_jamais_supprime(org, user):
    from django.db import IntegrityError, InternalError, transaction

    record, _ = start(org, user, "champs.kml", kml([("A", ring())]))
    with pytest.raises((IntegrityError, InternalError)), transaction.atomic():
        ParcelImport.objects.filter(pk=record.pk)._raw_delete(using="default")


# ── API ──────────────────────────────────────────────────────────────────


def client_for(user, workspace):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_WORKSPACE=workspace)
    return client


def upload(client, name, data):
    return client.post(URL, {"file": SimpleUploadedFile(name, data)}, format="multipart")


def test_api_parcours_complet(org, user):
    client = client_for(user, f"org:{org.pk}")
    res = upload(client, "champs.zip", zipped(shapefile([("Champ 1", ring())])))
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["file_format"] == "shapefile" and body["summary"]["ok"] == 1
    assert body["rows"][0]["label"] == "Champ 1"
    detail = client.get(f"{URL}{body['id']}/").json()
    assert detail["rows"][0]["status"] == "ok"
    res = client.post(f"{URL}{body['id']}/preview/", {"name_column": "nom"}, format="json")
    assert res.status_code == 200
    res = client.post(f"{URL}{body['id']}/commit/", {}, format="json")
    assert res.status_code == 200 and res.json()["parcels_created"] == 1
    done = client.get(f"{URL}{body['id']}/").json()
    assert "rows" not in done and done["report"][0]["agroid"].startswith("PAI-SN-")
    assert "report" not in done["summary"]
    assert client.get(URL).json()["results"][0]["status"] == "committed"
    res = client.post(f"{URL}{body['id']}/commit/", {}, format="json")
    assert res.status_code == 400


def test_api_fichier_refuse_400(org, user):
    client = client_for(user, f"org:{org.pk}")
    res = upload(client, "liste.csv", b"nom\nA\n")
    assert res.status_code == 400 and "CSV sans géométrie" in res.json()["file"][0]
    assert ParcelImport.objects.count() == 0


def test_api_droits(org, make_member, make_org):
    agent = make_member(org, "field_agent")[0]
    res = upload(client_for(agent, f"org:{org.pk}"), "c.kml", kml([("A", ring())]))
    assert res.status_code == 403
    other = make_org("Union de Podor")
    admin_other = make_member(other, "organization_admin")[0]
    owner = make_member(org, "organization_admin")[0]
    record, _ = start(org, owner, "c.kml", kml([("A", ring())]))
    res = client_for(admin_other, f"org:{other.pk}").get(f"{URL}{record.pk}/")
    assert res.status_code == 404
