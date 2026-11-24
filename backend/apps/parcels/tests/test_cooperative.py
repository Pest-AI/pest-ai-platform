"""J15d : modèle Excel « Coopérative », JSON, KoboToolbox / ODK, GPX."""

import io
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook, load_workbook
from rest_framework.test import APIClient

from apps.actors import services as actor_services
from apps.actors.models import Producer
from apps.parcels import imports
from apps.parcels.importers import ImportFileError, read_file
from apps.parcels.models import Parcel
from apps.parcels.template import PARCEL_HEADERS, PRODUCER_HEADERS, build_template
from apps.parcels.tests.test_import import ring
from apps.parcels.tests.test_parcels import LAT, LON

pytestmark = pytest.mark.django_db
URL = "/api/v1/parcel-imports/"


def odk(lon=LON, lat=LAT):
    """Contour au format KoboToolbox / ODK (« lat lon alt précision; … »)."""
    return "; ".join(f"{y} {x} 0 4" for x, y in ring(lon, lat)[:-1])


def filled_template(producers: list[list], parcels: list[list]) -> bytes:
    book = load_workbook(io.BytesIO(build_template()))
    for row in producers:
        book["Producteurs"].append(row)
    for row in parcels:
        book["Parcelles"].append(row)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


@pytest.fixture
def org(make_org):
    return make_org("Coopérative de Guédé")


@pytest.fixture
def user(org, make_member):
    return make_member(org, "organization_admin")[0]


def start(org, user, name, data):
    return imports.start_import(organization=org, by=user, file_name=name, data=data)


# ── Modèle ───────────────────────────────────────────────────────────────


def test_modele_onglets_et_entetes():
    book = load_workbook(io.BytesIO(build_template()))
    assert book.sheetnames == ["Lisez-moi", "Producteurs", "Parcelles"]
    assert [c.value for c in book["Producteurs"][1]] == [h for h, _, _ in PRODUCER_HEADERS]
    assert [c.value for c in book["Parcelles"][1]] == [h for h, _, _ in PARCEL_HEADERS]
    assert book["Producteurs"].max_row == 1  # aucune ligne d'exemple
    assert book["Parcelles"].max_row == 1


def test_modele_vide_refuse():
    with pytest.raises(ImportFileError, match="Aucune parcelle"):
        read_file("modele.xlsx", build_template())


# ── Producteurs + parcelles ──────────────────────────────────────────────


def test_cooperative_complete(org, user):
    other = actor_services.register_producer(
        organization=org,
        registered_by=user,
        first_name="Awa",
        last_name="Sow",
        membership_number="ADH-001",
    )
    data = filled_template(
        producers=[
            ["Awa", "Sow", "F", 1980, "Guédé", "", "ADH-001", "", ""],  # déjà dans le registre
            [
                "Moussa",
                "Diallo",
                "H",
                1975,
                "Guédé Chantier",
                "77 000 22 33",
                "ADH-002",
                "membre",
                "pulaar",
            ],
            ["Fatou", "", "F", "", "", "", "ADH-003", "", ""],  # nom manquant
            ["Ali", "Ba", "X", "", "", "", "ADH-002", "", ""],  # sexe inconnu, n° en double
        ],
        parcels=[
            ["Casier Awa", "ADH-001", LAT, LON, ""],
            ["Casier Moussa", "ADH-002", "", "", odk(LON + 0.01)],
            ["Champ de Fatou", "ADH-003", LAT + 0.01, LON, ""],
        ],
    )
    record, rows, producers = start(org, user, "cooperative.xlsx", data)
    assert record.file_format == "xlsx"
    assert record.mapping == {
        "name_column": "Nom de la parcelle",
        "operator_column": "N° d'adhérent de l'exploitant",
        "operator_key": "membership_number",
    }
    assert [(p["status"], p["action"]) for p in producers] == [
        ("ok", "existing"),
        ("ok", "create"),
        ("refused", None),
        ("refused", None),
    ]
    assert producers[1]["phone"] == "+221770002233"
    assert "N° d'adhérent déjà utilisé ligne 2" in " ".join(producers[3]["messages"])
    assert record.summary["producers"] == {
        "total": 4,
        "create": 1,
        "existing": 1,
        "flagged": 0,
        "refused": 2,
    }
    assert rows[0]["operator"]["id"] == str(other.pk)
    assert rows[1]["operator"] == {"id": None, "name": "Moussa Diallo", "producer_line": 2}
    assert rows[1]["kind"] == "polygon"
    assert rows[2]["status"] == "flagged" and "refusé" in " ".join(rows[2]["messages"])
    assert Producer.objects.count() == 1  # rien n'est créé avant confirmation

    record = imports.commit(record, by=user)
    moussa = Producer.objects.get(last_name="Diallo")
    assert moussa.sex == "male" and moussa.birth_year == 1975 and moussa.preferred_language == "ff"
    assert moussa.assignments.get().membership_number == "ADH-002"
    assert record.producers_created == 1 and record.parcels_created == 2
    casier = Parcel.objects.get(local_name="Casier Moussa")
    assert casier.operators.get().producer == moussa
    assert record.summary["producer_report"][1]["created"] is True
    assert record.producer_rows == []


def test_doublon_probable_a_verifier(org, user, make_org, make_member):
    other_org = make_org("Union de Podor")
    other_admin = make_member(other_org, "organization_admin")[0]
    actor_services.register_producer(
        organization=other_org,
        registered_by=other_admin,
        first_name="Moussa",
        last_name="Diallo",
        phone_number="+221770002233",
    )
    data = filled_template(
        producers=[["Moussa", "Diallo", "H", "", "", "770002233", "ADH-9", "", ""]],
        parcels=[["Casier", "ADH-9", LAT, LON, ""]],
    )
    record, rows, producers = start(org, user, "c.xlsx", data)
    assert producers[0]["status"] == "flagged"
    assert rows[0]["status"] == "flagged"  # son exploitant est à vérifier
    before = Producer.objects.count()
    with pytest.raises(Exception, match="Rien à importer"):
        imports.commit(record, by=user)
    record = imports.commit(record, by=user, include_flagged=True)
    assert Producer.objects.count() == before + 1 and record.parcels_created == 1


def test_producteurs_seuls(org, user):
    data = filled_template(
        producers=[["Awa", "Ndiaye", "F", "", "Ndioum", "", "", "", ""]], parcels=[]
    )
    record, rows, producers = start(org, user, "c.xlsx", data)
    assert rows == [] and producers[0]["action"] == "create"
    record = imports.commit(record, by=user)
    assert record.producers_created == 1 and record.parcels_created == 0


def test_api_modele_et_aperçu(org, user, make_member):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_WORKSPACE=f"org:{org.pk}")
    res = client.get(f"{URL}template/")
    assert res.status_code == 200
    assert res["Content-Type"].startswith("application/vnd.openxmlformats")
    data = filled_template(
        producers=[["Moussa", "Diallo", "H", "", "", "", "ADH-2", "", ""]],
        parcels=[["Casier", "ADH-2", LAT, LON, ""]],
    )
    res = client.post(URL, {"file": SimpleUploadedFile("c.xlsx", data)}, format="multipart")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["producers"][0]["action"] == "create" and "fields" not in body["producers"][0]
    assert body["summary"]["producers"]["create"] == 1
    res = client.post(f"{URL}{body['id']}/commit/", {}, format="json")
    assert res.status_code == 200 and res.json()["producers_created"] == 1
    done = client.get(f"{URL}{body['id']}/").json()
    assert done["producers"][0]["created"] is True and "producer_report" not in done["summary"]
    agent = make_member(org, "field_agent")[0]
    client.force_authenticate(user=agent)
    assert client.get(f"{URL}template/").status_code == 403


# ── Autres formats ───────────────────────────────────────────────────────


def test_excel_simple_premier_onglet():
    book = Workbook()
    book.active.append(["parcelle", "latitude", "longitude"])
    book.active.append(["Champ 1", LAT, LON])
    out = io.BytesIO()
    book.save(out)
    content = read_file("liste.xlsx", out.getvalue())
    assert content.producers is None and content.features[0].kind == "point"


def test_json_enregistrements():
    data = json.dumps({"results": [{"nom": "A", "lat": LAT, "lon": LON, "meta": {"x": 1}}]})
    content = read_file("export.json", data.encode())
    assert content.file_format == "json"
    assert content.features[0].kind == "point" and "meta" not in content.features[0].properties


def test_json_geojson_reste_geojson():
    data = json.dumps(
        {
            "type": "Feature",
            "properties": {},
            "geometry": {"type": "Point", "coordinates": [LON, LAT]},
        }
    )
    assert read_file("a.json", data.encode()).file_format == "geojson"


def test_export_kobo_csv():
    header = "nom_parcelle;parcelle_geoshape;_gps_latitude;_gps_longitude"
    line = f'Casier;"{odk()}";;'
    content = read_file("kobo.csv", f"{header}\n{line}\n".encode())
    assert content.features[0].kind == "polygon"
    kobo_point = "nom;_gps_latitude;_gps_longitude\nJardin;16,65;-14,96\n"
    assert read_file("kobo.csv", kobo_point.encode()).features[0].kind == "point"


def gpx(body: str) -> bytes:
    return (
        '<?xml version="1.0"?><gpx version="1.1" creator="test" '
        f'xmlns="http://www.topografix.com/GPX/1/1">{body}</gpx>'
    ).encode()


def track(points) -> str:
    pts = "".join(f'<trkpt lat="{y}" lon="{x}"><ele>5</ele></trkpt>' for x, y in points)
    return f"<trk><name>Tour du champ</name><trkseg>{pts}</trkseg></trk>"


def test_gpx_trace_ferme_et_point():
    closed = ring()[:-1] + [(LON + 0.00001, LAT + 0.00001)]  # revient à ~1,5 m du départ
    data = gpx(f'<wpt lat="{LAT}" lon="{LON}"><name>Puits</name></wpt>' + track(closed))
    content = read_file("releve.gpx", data)
    kinds = sorted(f.kind for f in content.features)
    assert kinds == ["point", "polygon"]
    poly = next(f for f in content.features if f.kind == "polygon")
    assert poly.properties == {"name": "Tour du champ"}


def test_gpx_trace_non_ferme():
    open_track = [(LON, LAT), (LON + 0.002, LAT), (LON + 0.002, LAT + 0.002)]
    content = read_file("releve.gpx", gpx(track(open_track)))
    assert content.features[0].kind == "none" and "non refermé" in content.features[0].error


def test_gpx_entites_refusees():
    with pytest.raises(ImportFileError, match="entités XML"):
        read_file("piege.gpx", b'<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY x "y">]><gpx/>')
