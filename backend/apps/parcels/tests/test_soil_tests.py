"""J20c : mesures du sol au kit de terrain (pH, conductivité, N, P, K, humidité, température)."""

import uuid

import pytest
from django.db import IntegrityError, transaction

from apps.parcels.models import SoilTest, SoilTestValue
from apps.parcels.tests.test_api import URL, client_for
from apps.parcels.tests.test_parcels import square

pytestmark = pytest.mark.django_db

KIT = {
    "ph": "6.8",
    "ec": "450",
    "nitrogen": "38",
    "phosphorus": "21",
    "potassium": "120",
    "moisture": "18.4",
    "temperature": "29.5",
}


@pytest.fixture
def org(make_org):
    return make_org()


@pytest.fixture
def agent(org, make_member):
    return client_for(make_member(org, "field_agent")[0], org)


@pytest.fixture
def parcel(agent):
    res = agent.post(URL, {"geometry": square(), "capture_method": "gps_walk"}, format="json")
    assert res.status_code == 201
    return res.json()


def test_mesure_du_kit_enregistree_dans_l_ordre_du_referentiel(agent, parcel):
    res = agent.post(
        f"{URL}{parcel['id']}/soil-tests/",
        {
            "values": KIT,
            "device_model": "Testeur 7 en 1",
            "depth_cm": 15,
            "position": [-14.94, 16.67],
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    test = res.json()
    assert test["method"] == "field_kit" and test["depth_cm"] == 15
    assert [v["parameter"] for v in test["values"]] == [
        "ph",
        "ec",
        "nitrogen",
        "phosphorus",
        "potassium",
        "moisture",
        "temperature",
    ]
    ph = test["values"][0]
    assert ph["value"] == "6.8" and ph["unit"] == "" and ph["unusual"] is False
    assert test["values"][1]["unit"] == "µS/cm"
    detail = agent.get(f"{URL}{parcel['id']}/").json()
    assert detail["latest_soil_test"]["id"] == test["id"] and detail["soil_test_count"] == 1
    soil_block = next(b for b in detail["completeness"]["blocks"] if b["key"] == "soil")
    assert soil_block["done"] is True  # sol mesuré au kit


def test_valeur_impossible_refusee_inhabituelle_signalee(agent, parcel):
    bad = agent.post(f"{URL}{parcel['id']}/soil-tests/", {"values": {"ph": "15"}}, format="json")
    assert bad.status_code == 400 and "pH" in str(bad.json())
    odd = agent.post(
        f"{URL}{parcel['id']}/soil-tests/", {"values": {"ph": "3.9", "ec": "6000"}}, format="json"
    )
    assert odd.status_code == 201
    assert all(v["unusual"] for v in odd.json()["values"])
    empty = agent.post(f"{URL}{parcel['id']}/soil-tests/", {"values": {"ph": None}}, format="json")
    assert empty.status_code == 400
    unknown = agent.post(
        f"{URL}{parcel['id']}/soil-tests/", {"values": {"plomb": "3"}}, format="json"
    )
    assert unknown.status_code == 400


def test_historique_plus_recent_d_abord_et_mesures_immuables(agent, parcel):
    url = f"{URL}{parcel['id']}/soil-tests/"
    agent.post(url, {"values": {"ph": "6.1"}, "measured_at": "2026-06-01T09:00:00Z"}, format="json")
    agent.post(url, {"values": {"ph": "6.5"}, "measured_at": "2026-11-20T09:00:00Z"}, format="json")
    history = agent.get(url).json()
    assert [t["values"][0]["value"] for t in history] == ["6.5", "6.1"]
    test = SoilTest.objects.filter(parcel_id=parcel["id"]).first()
    with pytest.raises(IntegrityError), transaction.atomic():
        SoilTest.objects.filter(pk=test.pk).update(notes="modifié")
    with pytest.raises(IntegrityError), transaction.atomic():
        SoilTestValue.objects.filter(soil_test=test).delete()


def test_mesure_a_l_enrolement_et_referentiel(agent):
    refs = agent.get(f"{URL}site-referentials/").json()
    codes = [p["code"] for p in refs["soil_parameters"]]
    assert codes[:5] == ["ph", "ec", "nitrogen", "phosphorus", "potassium"]
    assert {m["value"] for m in refs["soil_test_methods"]} == {"field_kit", "laboratory", "sensor"}
    res = agent.post(
        URL,
        {
            "geometry": square(),
            "capture_method": "gps_walk",
            "soil_test": {"values": {"ph": "7.2", "moisture": "12"}},
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    assert [v["parameter"] for v in res.json()["latest_soil_test"]["values"]] == ["ph", "moisture"]
    # Mesure vide à l'enrôlement (pas de kit) : ignorée, la parcelle est créée.
    skip = agent.post(
        URL,
        {"geometry": square(lon=-14.5), "capture_method": "gps_walk", "soil_test": {"values": {}}},
        format="json",
    )
    assert skip.status_code == 201 and skip.json()["latest_soil_test"] is None


def test_droits_et_isolation(agent, parcel, org, make_org, make_member):
    viewer = client_for(make_member(org, "program_manager")[0], org)
    assert (
        viewer.post(
            f"{URL}{parcel['id']}/soil-tests/", {"values": {"ph": "7"}}, format="json"
        ).status_code
        == 403
    )
    other_org = make_org("Autre coopérative")
    other = client_for(make_member(other_org, "organization_admin")[0], other_org)
    assert other.get(f"{URL}{parcel['id']}/soil-tests/").status_code == 404
    unit = agent.post(f"{URL}{parcel['id']}/units/", {"area_m2": "100"}, format="json").json()
    ok = agent.post(
        f"{URL}{parcel['id']}/soil-tests/",
        {"values": {"ph": "7"}, "cultivation_unit": unit["id"]},
        format="json",
    )
    assert ok.status_code == 201 and ok.json()["cultivation_unit"]["code"] == "U1"
    bad_unit = agent.post(
        f"{URL}{parcel['id']}/soil-tests/",
        {"values": {"ph": "7"}, "cultivation_unit": str(uuid.uuid4())},
        format="json",
    )
    assert bad_unit.status_code == 400
