"""J18d : profil de site (sol, eau, irrigation, accès), conditions d'exploitation, complétude."""

import pytest
from django.db import DatabaseError, transaction

from apps.actors import services as actor_services
from apps.parcels.models import ParcelSiteProfile
from apps.parcels.tests.test_api import URL, client_for
from apps.parcels.tests.test_parcels import LAT, LON, square

pytestmark = pytest.mark.django_db

SITE = {
    "soil_local_type": "hollalde",
    "soil_texture": "clay",
    "salinity": "slight",
    "water_regime": "irrigated",
    "water_source": "river_canal",
    "irrigation_method": "pump_gravity",
    "scheme_type": "piv",
    "scheme_name": "PIV de Guédé, casier 3",
    "pump_access": "collective",
    "distance_to_village_km": "2.5",
    "evidence": "observed",
}


@pytest.fixture
def org(make_org):
    return make_org()


@pytest.fixture
def agent(org, make_member):
    return client_for(make_member(org, "field_agent")[0], org)


@pytest.fixture
def farmer(org, make_member):
    owner = make_member(org, "organization_admin")[0]
    return actor_services.register_producer(
        organization=org, registered_by=owner, first_name="Awa", last_name="Sow"
    )


def test_referentiels_exposes(agent):
    body = agent.get(f"{URL}site-referentials/").json()
    assert {"value": "hollalde", "label": "Hollaldé (argileux de cuvette)"} in body["fields"][
        "soil_local_type"
    ]
    assert "piv" in [i["value"] for i in body["fields"]["scheme_type"]]
    assert "communal_allocation" in [i["value"] for i in body["tenure_types"]]
    assert "harvest_share" in [i["value"] for i in body["rent_types"]]


def test_enrolement_complet_et_completude(agent, farmer):
    res = agent.post(
        URL,
        {
            "geometry": square(),
            "capture_method": "gps_walk",
            "operator": str(farmer.pk),
            "arrangement_type": "sharecropping",
            "lease": {"rent_type": "harvest_share", "harvest_share_percent": "33.33"},
            "ownership": {
                "owner": "other",
                "owner_name": "Famille Diallo",
                "tenure_type": "communal_allocation",
            },
            "site": SITE,
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["site_profile"]["irrigation_method"] == "pump_gravity"
    assert body["site_profile"]["scheme_name"] == "PIV de Guédé, casier 3"
    assert body["owners"][0]["tenure_type"] == "communal_allocation"
    assert body["completeness"]["percent"] == 83  # 5 blocs sur 6 : pas encore de cycle
    assert [b["key"] for b in body["completeness"]["blocks"] if not b["done"]] == ["cycle"]
    history = agent.get(f"{URL}{body['id']}/history/").json()
    operator = history["operators"][0]
    assert operator["arrangement_type"] == "sharecropping"
    assert operator["rent_type"] == "harvest_share"
    assert operator["harvest_share_percent"] == "33.33"


def test_profil_historise_jamais_modifie(agent):
    parcel = agent.post(URL, {"position": [LON, LAT]}, format="json").json()
    assert parcel["site_profile"] is None
    assert parcel["completeness"]["percent"] == 0
    url = f"{URL}{parcel['id']}/site/"
    first = agent.post(url, {"water_regime": "rainfed"}, format="json")
    assert first.status_code == 201 and first.json()["evidence"] == "declared"
    second = agent.post(url, {"water_regime": "irrigated", "soil_texture": "sandy"}, format="json")
    assert second.status_code == 201
    site = agent.get(url).json()
    assert site["current"]["water_regime"] == "irrigated"
    assert [v["water_regime"] for v in site["history"]] == ["irrigated", "rainfed"]
    assert agent.post(url, {"notes": "rien"}, format="json").status_code == 400
    assert agent.post(url, {"soil_texture": "lava"}, format="json").status_code == 400

    profile = ParcelSiteProfile.objects.get(pk=first.json()["id"])
    with pytest.raises(DatabaseError), transaction.atomic():
        ParcelSiteProfile.objects.filter(pk=profile.pk).update(water_regime="mixed")
    with pytest.raises(DatabaseError), transaction.atomic():
        ParcelSiteProfile.objects.filter(pk=profile.pk).delete()


def test_profil_autre_organisation_404(agent, make_org, make_member):
    parcel = agent.post(URL, {"position": [LON, LAT]}, format="json").json()
    other_org = make_org("Autre coopérative")
    other = client_for(make_member(other_org, "organization_admin")[0], other_org)
    res = other.post(f"{URL}{parcel['id']}/site/", {"water_regime": "rainfed"}, format="json")
    assert res.status_code == 404


def test_section_du_membre(org, make_member):
    admin = client_for(make_member(org, "cooperative_manager")[0], org)
    res = admin.post(
        "/api/v1/producers/",
        {"first_name": "Samba", "last_name": "Ba", "section": "Section de Guédé-Chantier"},
        format="json",
    )
    assert res.status_code == 201, res.json()
    assert res.json()["assignment"]["section"] == "Section de Guédé-Chantier"
    upd = admin.patch(
        f"/api/v1/producers/{res.json()['id']}/", {"section": "Section Nord"}, format="json"
    )
    assert upd.status_code == 200 and upd.json()["assignment"]["section"] == "Section Nord"
