"""J19 : unités de culture avec contour (D-16) : mesure, inclusion à 1 m, chevauchement."""

import pytest

from apps.parcels.tests.test_api import URL, client_for
from apps.parcels.tests.test_parcels import D_LAT, D_LON, LAT, LON, square

pytestmark = pytest.mark.django_db

M = 1 / 111_000  # ~1 m en degrés de latitude


@pytest.fixture
def agent(make_org, make_member):
    org = make_org()
    return client_for(make_member(org, "field_agent")[0], org)


@pytest.fixture
def parcel(agent):
    res = agent.post(URL, {"geometry": square(), "capture_method": "gps_walk"}, format="json")
    assert res.status_code == 201, res.json()
    return res.json()


def add(agent, parcel, **body):
    return agent.post(f"{URL}{parcel['id']}/units/", body, format="json")


def test_unite_incluse_mesuree_code_propose(agent, parcel):
    half = square(dlon=D_LON / 2)
    res = add(agent, parcel, geometry=half, name="Tomate")
    assert res.status_code == 201, res.json()
    unit = res.json()
    assert unit["code"] == "U1" and unit["check"]["status"] == "valid"
    assert 4500 < float(unit["area_m2"]) < 5500  # moitié d'un hectare, mesurée par PostGIS
    assert unit["geometry"]["type"] == "MultiPolygon"
    second = add(agent, parcel, geometry=square(lon=LON + D_LON / 2, dlon=D_LON / 2)).json()
    assert second["code"] == "U2" and second["check"]["status"] == "valid"


def test_debord_tolere_a_un_metre_puis_signale(agent, parcel):
    # 0,5 m de débord : toléré.
    slight = square(lon=LON - 0.5 * M, dlon=D_LON / 3)
    assert add(agent, parcel, geometry=slight).json()["check"]["status"] == "valid"
    # 20 m de débord : signalé, mais enregistré.
    outside = square(
        lon=LON + D_LON / 2, dlon=D_LON / 2 + 20 * M, lat=LAT + D_LAT / 2, dlat=D_LAT / 4
    )
    res = add(agent, parcel, geometry=outside)
    assert res.status_code == 201
    assert res.json()["check"]["flags"] == ["unit_outside_parcel"]


def test_chevauchement_entre_unites_signale(agent, parcel):
    add(agent, parcel, geometry=square(dlon=D_LON / 2))
    res = add(agent, parcel, geometry=square(lon=LON + D_LON / 4, dlon=D_LON / 2))
    assert res.json()["check"]["flags"] == ["unit_overlap"]


def test_sans_contour_et_parcelle_sans_contour(agent):
    point = agent.post(URL, {"position": [LON, LAT]}, format="json").json()
    declared = add(agent, point, area_m2="2500")
    assert declared.status_code == 201 and declared.json()["check"]["status"] == "not_applicable"
    drawn = add(agent, point, geometry=square())
    assert drawn.json()["check"]["flags"] == ["unit_no_parcel_contour"]
    detail = agent.get(f"{URL}{point['id']}/").json()
    assert [u["code"] for u in detail["units"]] == ["U1", "U2"]


def test_contour_invalide_refuse(agent, parcel):
    bow = {
        "type": "Polygon",
        "coordinates": [
            [
                [LON, LAT],
                [LON + D_LON, LAT + D_LAT],
                [LON + D_LON, LAT],
                [LON, LAT + D_LAT],
                [LON, LAT],
            ]
        ],
    }
    assert add(agent, parcel, geometry=bow).status_code == 400
