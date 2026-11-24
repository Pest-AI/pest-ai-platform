"""J16 : campagnes, cycles, opérations, récoltes ; isolation des deux espaces en base."""

from datetime import date, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, InternalError, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.actors import services as actor_services
from apps.agriculture.models import AgriculturalCampaign, Crop, CropCycle
from apps.organizations import constants as C
from apps.parcels import services as parcel_services
from apps.parcels.tests.test_parcels import LON, square

pytestmark = pytest.mark.django_db
CAMPAIGNS = "/api/v1/campaigns/"
CYCLES = "/api/v1/crop-cycles/"
TODAY = timezone.localdate()


def client_for(user, workspace):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(
        HTTP_X_WORKSPACE=workspace if isinstance(workspace, str) else f"org:{workspace.pk}"
    )
    return client


@pytest.fixture
def orgs(make_org):
    return make_org("Coopérative de Guédé"), make_org("Union de Podor")


@pytest.fixture
def admin_user(orgs, make_member):
    return make_member(orgs[0], "organization_admin")[0]


@pytest.fixture
def admin(admin_user, orgs):
    return client_for(admin_user, orgs[0])


@pytest.fixture
def parcel(admin_user, orgs):
    return parcel_services.create_parcel(
        by=admin_user,
        organization=orgs[0],
        local_name="Casier Nord",
        geometry=square(),
        capture_method="gps_walk",
        gps_accuracy_m=4,
    )


@pytest.fixture
def farmer(admin_user, orgs):
    return actor_services.register_producer(
        organization=orgs[0], registered_by=admin_user, first_name="Awa", last_name="Sow"
    )


@pytest.fixture
def independent(make_user):
    account = make_user(phone_number="+221770002222")
    return actor_services.create_personal_profile(user=account, first_name="Fatou", last_name="Ba")


def campaign_payload(**extra):
    return {
        "name": "Hivernage 2026",
        "season_type": "rainy",
        "year": 2026,
        "start_date": "2026-06-15",
        **extra,
    }


def new_cycle(client, parcel, **extra):
    res = client.post(
        CYCLES, {"parcel": str(parcel.pk), "declared_crop": "rice", **extra}, format="json"
    )
    assert res.status_code == 201, res.json()
    return res.json()


# ── Référentiel ──────────────────────────────────────────────────────────


def test_cinq_cultures_du_mvp(admin):
    res = admin.get("/api/v1/crops/")
    assert res.status_code == 200
    codes = {c["code"]: c for c in res.json()}
    assert set(codes) == {"rice", "onion", "tomato", "maize", "chili"}
    assert all(c["is_ai_supported"] for c in codes.values())
    assert codes["rice"]["name_fr"] == "Riz" and codes["rice"]["name_wo"] == ""


# ── Campagnes ────────────────────────────────────────────────────────────


def test_campagne_creation_et_regles(admin):
    res = admin.post(CAMPAIGNS, campaign_payload(), format="json")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["status"] == "planned" and body["cycle_count"] == 0
    assert (
        admin.post(CAMPAIGNS, campaign_payload(name="hivernage 2026"), format="json").status_code
        == 400
    )
    bad = admin.post(CAMPAIGNS, campaign_payload(name="X", end_date="2026-01-01"), format="json")
    assert bad.status_code == 400 and "end_date" in bad.json()
    assert (
        admin.post(
            CAMPAIGNS, campaign_payload(name="Y", season_type="ete"), format="json"
        ).status_code
        == 400
    )

    url = f"{CAMPAIGNS}{body['id']}/"
    assert admin.patch(url, {"status": "active"}, format="json").json()["status"] == "active"
    assert admin.patch(url, {"status": "planned"}, format="json").status_code == 400
    assert admin.patch(url, {"status": "closed"}, format="json").json()["status"] == "closed"
    assert admin.patch(url, {"name": "Autre"}, format="json").status_code == 400  # clôturée
    res = admin.post(f"{url}archive/", {"reason": "Doublon"}, format="json")
    assert res.json()["is_archived"] is True
    assert admin.get(CAMPAIGNS).json()["count"] == 0
    assert admin.get(f"{CAMPAIGNS}?archived=true").json()["count"] == 1


def test_campagnes_isolees_entre_organisations(admin, orgs, make_member):
    admin.post(CAMPAIGNS, campaign_payload(), format="json")
    other = client_for(make_member(orgs[1], "organization_admin")[0], orgs[1])
    assert other.get(CAMPAIGNS).json()["count"] == 0
    # Le même nom est permis dans un autre espace.
    assert other.post(CAMPAIGNS, campaign_payload(), format="json").status_code == 201


# ── Cycles ───────────────────────────────────────────────────────────────


def test_cycle_complet(admin, parcel, farmer, admin_user):
    parcel_services.assign_operator(
        parcel,
        farmer,
        by=admin_user,
        role="primary",
        start_date=TODAY,
        recorded_by_organization=parcel.registered_by_organization,
    )
    campaign = admin.post(CAMPAIGNS, campaign_payload(), format="json").json()
    sowing = TODAY - timedelta(days=60)
    cycle = new_cycle(
        admin,
        parcel,
        campaign=campaign["id"],
        sowing_date=str(sowing),
        expected_harvest_date=str(TODAY + timedelta(days=30)),
        declared_area_m2="5000",
        status="in_progress",
    )
    assert cycle["operator"]["name"] == "Awa Sow"  # copie de l'exploitant principal
    assert cycle["crop"]["code"] == "rice" and cycle["campaign"]["name"] == "Hivernage 2026"
    assert cycle["parcel"]["agroid"] == parcel.agroid and cycle["overlaps"] == []
    url = f"{CYCLES}{cycle['id']}/"

    op = admin.post(
        f"{url}operations/",
        {
            "operation_type": "fertilization",
            "performed_date": str(sowing + timedelta(days=20)),
            "product_text": "Urée",
            "quantity": "50",
            "quantity_unit": "kg",
        },
        format="json",
    )
    assert op.status_code == 201 and op.json()["source"] == "field_agent"
    assert (
        admin.post(f"{url}operations/", {"operation_type": "weeding"}, format="json").status_code
        == 400
    )

    h = admin.post(
        f"{url}harvests/",
        {
            "harvest_date": str(TODAY),
            "quantity_kg": "3200",
            "original_quantity": "40",
            "original_unit": "sac de 80 kg",
            "measurement_method": "declared",
        },
        format="json",
    )
    assert h.status_code == 201, h.json()
    early = admin.post(
        f"{url}harvests/",
        {
            "harvest_date": str(sowing - timedelta(days=1)),
            "quantity_kg": "1",
            "measurement_method": "declared",
        },
        format="json",
    )
    assert early.status_code == 400
    future = admin.post(
        f"{url}harvests/",
        {
            "harvest_date": str(TODAY + timedelta(days=2)),
            "quantity_kg": "1",
            "measurement_method": "declared",
        },
        format="json",
    )
    assert future.status_code == 400

    detail = admin.get(url).json()
    assert len(detail["operations"]) == 1 and detail["total_harvest_kg"] == "3200.00"
    assert admin.get(f"{CAMPAIGNS}{campaign['id']}/").json()["cycle_count"] == 1
    assert admin.patch(url, {"status": "harvested"}, format="json").json()["status"] == "harvested"
    assert admin.patch(url, {"status": "in_progress"}, format="json").status_code == 400


def test_filtres_de_liste(admin, parcel):
    campaign = admin.post(CAMPAIGNS, campaign_payload(), format="json").json()
    new_cycle(admin, parcel, campaign=campaign["id"])
    new_cycle(admin, parcel, declared_crop="onion")
    assert admin.get(f"{CYCLES}?crop=rice").json()["count"] == 1
    assert admin.get(f"{CYCLES}?campaign={campaign['id']}").json()["count"] == 1
    assert admin.get(f"{CYCLES}?parcel={parcel.pk}").json()["count"] == 2
    assert admin.get(f"{CYCLES}?parcel=pas-un-uuid").status_code == 400


def test_chevauchement_signale_jamais_bloque(admin, parcel):
    """D-17 : cultures associées autorisées, mais signalées."""
    first = new_cycle(admin, parcel, sowing_date="2026-07-01", expected_harvest_date="2026-11-01")
    second = new_cycle(
        admin,
        parcel,
        declared_crop="maize",
        sowing_date="2026-08-01",
        expected_harvest_date="2026-10-15",
    )
    assert [o["id"] for o in second["overlaps"]] == [first["id"]]
    later = new_cycle(admin, parcel, declared_crop="onion", sowing_date="2026-12-01")
    assert later["overlaps"] == []


def test_variete_et_unite_controlees(admin, parcel, admin_user):
    rice = Crop.objects.get(code="rice")
    variety = rice.varieties.create(name="Sahel 108")
    onion_variety = Crop.objects.get(code="onion").varieties.create(name="Violet de Galmi")
    ok = new_cycle(admin, parcel, variety=str(variety.pk))
    assert ok["variety"]["name"] == "Sahel 108"
    res = admin.post(
        CYCLES,
        {"parcel": str(parcel.pk), "declared_crop": "rice", "variety": str(onion_variety.pk)},
        format="json",
    )
    assert res.status_code == 400 and "variety" in res.json()
    other_parcel = parcel_services.create_parcel(
        by=admin_user,
        organization=parcel.registered_by_organization,
        geometry=square(lon=LON + 0.02),
        capture_method="gps_walk",
        gps_accuracy_m=4,
    )
    unit = parcel_services.create_cultivation_unit(other_parcel, by=admin_user, code="U1")
    res = admin.post(
        CYCLES,
        {"parcel": str(parcel.pk), "declared_crop": "rice", "cultivation_unit": str(unit.pk)},
        format="json",
    )
    assert res.status_code == 400 and "cultivation_unit" in res.json()


def test_campagne_cloturee_refuse_un_cycle(admin, parcel):
    campaign = admin.post(CAMPAIGNS, campaign_payload(status="closed"), format="json").json()
    res = admin.post(
        CYCLES,
        {"parcel": str(parcel.pk), "declared_crop": "rice", "campaign": campaign["id"]},
        format="json",
    )
    assert res.status_code == 400 and "campaign" in res.json()


def test_parcelle_hors_espace(admin, orgs, make_member):
    owner = make_member(orgs[1], "organization_admin")[0]
    elsewhere = parcel_services.create_parcel(
        by=owner,
        organization=orgs[1],
        geometry=square(),
        capture_method="gps_walk",
        gps_accuracy_m=4,
    )
    res = admin.post(CYCLES, {"parcel": str(elsewhere.pk), "declared_crop": "rice"}, format="json")
    assert res.status_code == 400 and "parcel" in res.json()


# ── Droits ───────────────────────────────────────────────────────────────


def test_matrice_des_droits(admin, parcel, orgs, make_member):
    cycle = new_cycle(admin, parcel)
    url = f"{CYCLES}{cycle['id']}/"
    agent = client_for(make_member(orgs[0], "field_agent")[0], orgs[0])
    agronomist = client_for(make_member(orgs[0], "agronomist")[0], orgs[0])
    program = client_for(make_member(orgs[0], "program_manager")[0], orgs[0])

    assert agent.post(CAMPAIGNS, campaign_payload(), format="json").status_code == 403
    assert (
        agent.post(
            f"{url}operations/",
            {"operation_type": "weeding", "performed_date": str(TODAY)},
            format="json",
        ).status_code
        == 201
    )
    assert agent.post(f"{url}confirm-crop/", {"crop": "maize"}, format="json").status_code == 403

    assert agronomist.get(url).status_code == 200
    assert (
        agronomist.post(
            f"{url}operations/",
            {"operation_type": "weeding", "performed_date": str(TODAY)},
            format="json",
        ).status_code
        == 403
    )
    res = agronomist.post(f"{url}confirm-crop/", {"crop": "maize"}, format="json")
    assert res.status_code == 200
    body = res.json()
    assert body["crop"]["code"] == "maize" and body["declared_crop"]["code"] == "rice"
    assert body["confirmed_at"] is not None
    assert admin.get(f"{CYCLES}?crop=maize").json()["count"] == 1  # culture confirmée

    assert program.get(CYCLES).status_code == 200
    assert program.patch(url, {"declared_area_m2": "10"}, format="json").status_code == 403


def test_matrice_dans_le_catalogue():
    assert "crop_cycles.confirm" in C.ROLE_PERMISSIONS[C.AGRONOMIST]
    assert "crop_cycles.manage" in C.ROLE_PERMISSIONS[C.FIELD_AGENT]
    assert "campaigns.manage" not in C.ROLE_PERMISSIONS[C.FIELD_AGENT]
    assert not set(C.AGRICULTURE_MANAGERS) & set(C.ROLE_PERMISSIONS[C.PRODUCER])


# ── Espace personnel ─────────────────────────────────────────────────────


def test_espace_personnel(independent, admin, parcel):
    me = client_for(independent.user, "personal")
    mine = me.post(
        "/api/v1/parcels/",
        {"local_name": "Mon champ", "geometry": square(lon=LON + 0.05)},
        format="json",
    ).json()
    campaign = me.post(CAMPAIGNS, campaign_payload(), format="json").json()
    cycle = me.post(
        CYCLES,
        {"parcel": mine["id"], "declared_crop": "onion", "campaign": campaign["id"]},
        format="json",
    )
    assert cycle.status_code == 201, cycle.json()
    assert cycle.json()["operator"]["name"] == "Fatou Ba"
    url = f"{CYCLES}{cycle.json()['id']}/"
    op = me.post(
        f"{url}operations/",
        {"operation_type": "irrigation", "performed_date": str(TODAY)},
        format="json",
    )
    assert op.json()["source"] == "producer_declared"
    assert me.post(f"{url}confirm-crop/", {"crop": "rice"}, format="json").status_code == 403
    # Parcelle de coopérative : hors de son espace.
    res = me.post(CYCLES, {"parcel": str(parcel.pk), "declared_crop": "rice"}, format="json")
    assert res.status_code == 400
    # Les deux espaces ne se voient jamais.
    org_cycle = new_cycle(admin, parcel)
    assert me.get(f"{CYCLES}{org_cycle['id']}/").status_code == 404
    assert admin.get(url).status_code == 404
    assert admin.get(f"{CAMPAIGNS}{campaign['id']}/").status_code == 404
    # Une campagne personnelle n'est pas utilisable depuis l'organisation.
    res = admin.post(
        CYCLES,
        {"parcel": str(parcel.pk), "declared_crop": "rice", "campaign": campaign["id"]},
        format="json",
    )
    assert res.status_code == 400 and "campaign" in res.json()


# ── Garanties PostgreSQL (I-25) ──────────────────────────────────────────


def _org_cycle(admin, parcel):
    return CropCycle.objects.get(pk=new_cycle(admin, parcel)["id"])


def test_base_refuse_le_melange_d_espaces(admin, parcel, independent):
    """Un cycle d'organisation ne peut pas citer une campagne personnelle, même en SQL brut."""
    cycle = _org_cycle(admin, parcel)
    personal = AgriculturalCampaign.objects.create(
        personal_producer=independent,
        name="Perso",
        season_type="rainy",
        year=2026,
        start_date=date(2026, 6, 1),
    )
    assert personal.space_key == f"personal:{independent.pk}"
    assert cycle.space_key.startswith("org:")
    with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cur:
        cur.execute(
            "UPDATE agriculture_crop_cycle SET campaign_id = %s WHERE id = %s",
            [personal.pk, cycle.pk],
        )


def test_base_refuse_une_unite_d_une_autre_parcelle(admin, parcel, admin_user):
    cycle = _org_cycle(admin, parcel)
    other = parcel_services.create_parcel(
        by=admin_user,
        organization=parcel.registered_by_organization,
        geometry=square(lon=LON + 0.02),
        capture_method="gps_walk",
        gps_accuracy_m=4,
    )
    unit = parcel_services.create_cultivation_unit(other, by=admin_user, code="U1")
    with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cur:
        cur.execute(
            "UPDATE agriculture_crop_cycle SET cultivation_unit_id = %s WHERE id = %s",
            [unit.pk, cycle.pk],
        )


def test_base_espace_immuable_et_un_seul_espace(admin, parcel, independent):
    cycle = _org_cycle(admin, parcel)
    with (
        pytest.raises((IntegrityError, InternalError)),
        transaction.atomic(),
        connection.cursor() as cur,
    ):
        cur.execute(
            "UPDATE agriculture_crop_cycle SET organization_id = NULL, personal_producer_id = %s "
            "WHERE id = %s",
            [independent.pk, cycle.pk],
        )
    with pytest.raises(IntegrityError), transaction.atomic():
        AgriculturalCampaign.objects.create(
            name="Sans espace", season_type="rainy", year=2026, start_date=date(2026, 6, 1)
        )
    cycle.personal_producer, cycle.organization = independent, None
    with pytest.raises(ValidationError):
        cycle.save()


def test_base_cycle_jamais_supprime(admin, parcel):
    cycle = _org_cycle(admin, parcel)
    with (
        pytest.raises((IntegrityError, InternalError)),
        transaction.atomic(),
        connection.cursor() as cur,
    ):
        cur.execute("DELETE FROM agriculture_crop_cycle WHERE id = %s", [cycle.pk])
    with pytest.raises(ValidationError):
        cycle.delete()


# ── Filtres Campagne et Culture des parcelles (carte) ────────────────────


def test_filtres_campagne_et_culture_des_parcelles(admin, parcel, admin_user, independent):
    other = parcel_services.create_parcel(
        by=admin_user,
        organization=parcel.registered_by_organization,
        geometry=square(lon=LON + 0.02),
        capture_method="gps_walk",
        gps_accuracy_m=4,
    )
    campaign = admin.post(CAMPAIGNS, campaign_payload(), format="json").json()
    new_cycle(admin, parcel, campaign=campaign["id"])
    harvested = new_cycle(admin, other, declared_crop="tomato", status="in_progress")
    parcels = "/api/v1/parcels/"
    bbox = f"{LON - 0.01},16.5,{LON + 0.05},16.8"

    def ids(query):
        res = admin.get(f"{parcels}?{query}")
        assert res.status_code == 200, res.json()
        return {p["id"] for p in res.json()["results"]}

    assert ids(f"campaign={campaign['id']}") == {str(parcel.pk)}
    assert ids("crop=rice") == {str(parcel.pk)}
    assert ids("crop=tomato") == {str(other.pk)}
    assert ids(f"campaign={campaign['id']}&crop=tomato") == set()
    assert admin.get(f"{parcels}?campaign=x").status_code == 400
    features = admin.get(f"{parcels}map/?bbox={bbox}&crop=rice").json()["features"]
    assert [f["id"] for f in features] == [str(parcel.pk)]
    # Un cycle récolté ne compte plus pour la culture « en cours »…
    url = f"{CYCLES}{harvested['id']}/"
    admin.patch(url, {"status": "harvested"}, format="json")
    assert ids("crop=tomato") == set()
    # …et les cycles d'un autre espace ne comptent jamais.
    me = client_for(independent.user, "personal")
    assert me.get(f"{parcels}?crop=rice").json()["count"] == 0
