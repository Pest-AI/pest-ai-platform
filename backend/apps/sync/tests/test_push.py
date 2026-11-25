"""J20 : synchronisation hors ligne — idempotence, références entre opérations, conflits,
droits rejoués, appareil."""

import uuid
from datetime import date

import pytest

from apps.parcels.tests.test_api import client_for
from apps.parcels.tests.test_parcels import square
from apps.sync.models import Device, SyncConflict, SyncOperation, SyncSession

pytestmark = pytest.mark.django_db

PUSH = "/api/v1/sync/push/"
NOW = "2026-11-25T08:00:00Z"


@pytest.fixture
def org(make_org):
    return make_org()


@pytest.fixture
def agent_user(org, make_member):
    return make_member(org, "field_agent")[0]


@pytest.fixture
def agent(agent_user, org):
    return client_for(agent_user, org)


def device(installation=None):
    return {
        "installation_id": str(installation or uuid.uuid4()),
        "platform": "web",
        "app_version": "0.20.0",
    }


def op(entity_type, payload, seq, *, operation="create", params=None, **extra):
    return {
        "id": str(uuid.uuid4()),
        "entity_type": entity_type,
        "operation": operation,
        "params": params or {},
        "payload": payload,
        "client_created_at": NOW,
        "client_sequence": seq,
        **extra,
    }


def push(client, dev, *ops):
    res = client.post(PUSH, {"device": dev, "operations": list(ops)}, format="json")
    assert res.status_code == 200, res.json()
    return res.json()


def test_enrolement_complet_hors_ligne_en_un_lot(agent, org):
    dev = device()
    producer = op("producer", {"first_name": "Samba", "last_name": "Ndiaye"}, 1)
    parcel = op(
        "parcel",
        {
            "geometry": square(),
            "capture_method": "gps_walk",
            "operator": f"@op:{producer['id']}",
        },
        2,
    )
    site = op(
        "parcel_site", {"water_regime": "irrigated"}, 3, params={"parcel": f"@op:{parcel['id']}"}
    )
    unit = op("cultivation_unit", {"name": "Bloc riz"}, 4, params={"parcel": f"@op:{parcel['id']}"})
    cycle = op(
        "crop_cycle",
        {
            "parcel": f"@op:{parcel['id']}",
            "cultivation_unit": f"@op:{unit['id']}",
            "declared_crop": "rice",
            "sowing_date": str(date(2026, 8, 1)),
            "status": "in_progress",
        },
        5,
    )
    operation = op(
        "crop_operation",
        {"operation_type": "weeding", "performed_date": "2026-09-01"},
        6,
        params={"cycle": f"@op:{cycle['id']}"},
    )
    harvest = op(
        "harvest",
        {"harvest_date": "2026-11-20", "quantity_kg": "500", "measurement_method": "declared"},
        7,
        params={"cycle": f"@op:{cycle['id']}"},
    )
    body = push(agent, dev, harvest, operation, cycle, unit, site, parcel, producer)  # désordre
    statuses = {r["id"]: r for r in body["results"]}
    bad = [(r["status"], r["error_code"], r.get("result")) for r in body["results"]]
    assert all(s == "applied" for s, _, _ in bad), [b for b in bad if b[0] != "applied"]
    assert body["status"] == "completed"
    created_parcel = statuses[parcel["id"]]["result"]
    assert created_parcel["agroid"].startswith("PAI-SN-")
    assert statuses[producer["id"]]["result"]["producer_code"].startswith("PRD-SN-")
    assert statuses[producer["id"]]["result"]["membership_number"]
    assert statuses[unit["id"]]["result"]["code"] == "U1"

    detail = agent.get(f"/api/v1/crop-cycles/{statuses[cycle['id']]['result']['id']}/").json()
    assert detail["total_harvest_kg"] == "500.00" and len(detail["operations"]) == 1
    assert detail["parcel"]["agroid"] == created_parcel["agroid"]
    session = SyncSession.objects.get()
    assert (session.ops_received, session.ops_applied) == (7, 7)
    assert session.organization == org


def test_renvoi_idempotent_rien_n_est_cree_deux_fois(agent):
    dev = device()
    producer = op("producer", {"first_name": "Awa", "last_name": "Fall"}, 1)
    first = push(agent, dev, producer)["results"][0]
    again = push(agent, dev, producer)["results"][0]
    assert again["status"] == "duplicate" and again["original_status"] == "applied"
    assert again["result"]["id"] == first["result"]["id"]
    assert agent.get("/api/v1/producers/").json()["count"] == 1
    assert SyncOperation.objects.count() == 1


def test_dependance_absente_reste_en_attente_sans_trace(agent):
    missing = str(uuid.uuid4())
    unit = op("cultivation_unit", {"name": "X"}, 1, params={"parcel": f"@op:{missing}"})
    result = push(agent, device(), unit)["results"][0]
    assert result["status"] == "pending" and result["error_code"] == "dependency_pending"
    assert not SyncOperation.objects.exists()


def test_erreur_de_saisie_refusee_et_annulee(agent):
    bad = op("crop_cycle", {"parcel": str(uuid.uuid4()), "declared_crop": "rice"}, 1)
    result = push(agent, device(), bad)["results"][0]
    assert result["status"] == "rejected" and result["error_code"] == "validation_failed"
    assert "parcel" in result["result"]
    assert SyncOperation.objects.get().status == "rejected"
    assert SyncSession.objects.get().status == "partial"


def test_doublon_de_producteur_signale_avec_candidats(agent):
    dev = device()
    push(
        agent,
        dev,
        op("producer", {"first_name": "Moussa", "last_name": "Sy", "locality_text": "Guédé"}, 1),
    )
    dup = op("producer", {"first_name": "Moussa", "last_name": "Sy", "locality_text": "Guédé"}, 2)
    result = push(agent, dev, dup)["results"][0]
    assert result["status"] == "rejected" and result["error_code"] == "duplicate_candidates"
    assert result["result"]["candidates"]
    forced = op(
        "producer",
        {"first_name": "Moussa", "last_name": "Sy", "locality_text": "Guédé", "confirm_new": True},
        3,
    )
    assert push(agent, dev, forced)["results"][0]["status"] == "applied"


def test_droits_rejoues_par_la_vue_en_ligne(org, make_member):
    # La synchronisation n'ajoute aucun droit : un rôle sans saisie terrain est refusé.
    viewer = client_for(make_member(org, "program_manager")[0], org)
    result = push(viewer, device(), op("producer", {"first_name": "A", "last_name": "B"}, 1))
    assert result["results"][0]["status"] == "rejected"
    assert result["results"][0]["error_code"] == "permission_denied"


def test_modification_sur_version_depassee_devient_conflit(agent, org, make_member):
    dev = device()
    parcel = push(agent, dev, op("parcel", {"geometry": square()}, 1))["results"][0]["result"]
    cycle = push(
        agent, dev, op("crop_cycle", {"parcel": parcel["id"], "declared_crop": "rice"}, 2)
    )["results"][0]["result"]
    url = f"/api/v1/crop-cycles/{cycle['id']}/"
    manager = client_for(make_member(org, "cooperative_manager")[0], org)
    assert manager.patch(url, {"status": "in_progress"}, format="json").status_code == 200

    stale = op(
        "crop_cycle",
        {"status": "abandoned"},
        3,
        operation="update",
        entity_id=cycle["id"],
        base_row_version=cycle["row_version"],
    )
    result = push(agent, dev, stale)["results"][0]
    assert result["status"] == "conflict" and result["error_code"] == "concurrent_update"
    assert agent.get(url).json()["status"] == "in_progress"  # rien n'est écrasé
    conflict = SyncConflict.objects.get()
    assert conflict.resolution_status == "open"
    assert conflict.server_row_version > conflict.client_base_row_version
    assert conflict.server_snapshot["status"] == "in_progress"
    assert conflict.client_payload == {"status": "abandoned"}


def test_appareil_d_un_autre_utilisateur_refuse(agent, org, make_member):
    dev = device()
    push(agent, dev, op("producer", {"first_name": "A", "last_name": "B"}, 1))
    other = client_for(make_member(org, "field_agent")[0], org)
    res = other.post(
        PUSH,
        {"device": dev, "operations": [op("producer", {"first_name": "C", "last_name": "D"}, 1)]},
        format="json",
    )
    assert res.status_code == 403


def test_appareil_revoque_refuse(agent):
    dev = device()
    push(agent, dev, op("producer", {"first_name": "A", "last_name": "B"}, 1))
    Device.objects.update(status="revoked")
    res = agent.post(
        PUSH,
        {"device": dev, "operations": [op("producer", {"first_name": "C", "last_name": "D"}, 2)]},
        format="json",
    )
    assert res.status_code == 403


def test_operation_d_un_autre_utilisateur_non_rejouable(agent, org, make_member):
    producer = op("producer", {"first_name": "A", "last_name": "B"}, 1)
    push(agent, device(), producer)
    other = client_for(make_member(org, "field_agent")[0], org)
    result = push(other, device(), producer)["results"][0]
    assert result["status"] == "rejected" and result["error_code"] == "foreign_operation"


def test_reference_a_l_operation_d_un_autre_utilisateur_ignoree(agent, org, make_member):
    parcel = op("parcel", {"geometry": square()}, 1)
    push(agent, device(), parcel)
    other = client_for(make_member(org, "field_agent")[0], org)
    unit = op("cultivation_unit", {"name": "X"}, 1, params={"parcel": f"@op:{parcel['id']}"})
    assert push(other, device(), unit)["results"][0]["status"] == "pending"


def test_espace_requis_et_lot_borne(agent_user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=agent_user)
    res = client.post(PUSH, {"device": device(), "operations": []}, format="json")
    assert res.status_code == 400  # pas d'espace X-Workspace


def test_mesure_du_sol_hors_ligne_avec_la_parcelle(agent):
    dev = device()
    parcel = op("parcel", {"geometry": square(), "capture_method": "gps_walk"}, 1)
    soil = op(
        "soil_test",
        {"values": {"ph": "6.9", "ec": "380"}},
        2,
        params={"parcel": f"@op:{parcel['id']}"},
    )
    results = push(agent, dev, parcel, soil)["results"]
    assert [r["status"] for r in results] == ["applied", "applied"]
    detail = agent.get(f"/api/v1/parcels/{results[0]['result']['id']}/").json()
    assert detail["soil_test_count"] == 1
