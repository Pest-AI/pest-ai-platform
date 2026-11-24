"""API Parcelles (J13, MVP-38/39) : deux espaces, GeoJSON, emprise, droits, 404 hors périmètre."""

import pytest
from rest_framework.test import APIClient

from apps.actors import services as actor_services
from apps.parcels.models import Parcel
from apps.parcels.tests.test_parcels import D_LAT, D_LON, LAT, LON, square

pytestmark = pytest.mark.django_db

URL = "/api/v1/parcels/"
BBOX = f"{LON - 0.01},{LAT - 0.01},{LON + 0.01},{LAT + 0.01}"
FAR_BBOX = "-17.5,14.6,-17.4,14.7"  # Dakar


def client_for(user, workspace):
    client = APIClient()
    client.force_authenticate(user=user)
    header = workspace if isinstance(workspace, str) else f"org:{workspace.pk}"
    client.credentials(HTTP_X_WORKSPACE=header)
    return client


@pytest.fixture
def orgs(make_org):
    return make_org("Coopérative de Guédé"), make_org("Union de Podor")


@pytest.fixture
def admin(orgs, make_member):
    return client_for(make_member(orgs[0], "organization_admin")[0], orgs[0])


@pytest.fixture
def created(admin):
    res = admin.post(
        URL,
        {
            "local_name": "Champ du fleuve",
            "geometry": square(),
            "capture_method": "gps_walk",
            "gps_accuracy_m": 4,
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    return res.json()


@pytest.fixture
def independent(make_user):
    account = make_user(phone_number="+221770002222")
    return actor_services.create_personal_profile(user=account, first_name="Fatou", last_name="Ba")


# ── Espace d'organisation ────────────────────────────────────────────────


def test_creation_renvoie_la_fiche(created):
    assert created["agroid"].startswith("PAI-SN-")
    assert created["status"] == "active"
    assert created["access"] == "manage"
    geom = created["current_geometry"]
    assert geom["version"] == 1
    assert geom["geometry"]["type"] == "MultiPolygon"
    assert geom["validation"]["status"] == "valid"
    assert 9000 < float(created["current_area_m2"]) < 11000
    lon, lat = created["centroid"]
    assert abs(lon - LON) < 0.01 and abs(lat - LAT) < 0.01


def test_contour_invalide_400_explicite(admin):
    bowtie = {
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
    res = admin.post(URL, {"geometry": bowtie}, format="json")
    assert res.status_code == 400
    assert "invalide" in str(res.json()["geometry"])
    assert not Parcel.objects.exists()


def test_parcelle_sans_contour(admin):
    res = admin.post(URL, {"local_name": "À relever"}, format="json")
    assert res.status_code == 201
    assert res.json()["current_geometry"] is None


def test_liste_recherche_et_filtres(admin, created):
    assert admin.get(URL).json()["count"] == 1
    agroid = created["agroid"]
    assert admin.get(URL, {"q": agroid.lower().replace("-", " ")}).json()["count"] == 1
    assert admin.get(URL, {"q": "fleuve"}).json()["count"] == 1
    assert admin.get(URL, {"q": "PAI-SN-00000000"}).json()["count"] == 0
    assert admin.get(URL, {"status": "pending_validation"}).json()["count"] == 0
    assert admin.get(URL, {"bbox": BBOX}).json()["count"] == 1
    assert admin.get(URL, {"bbox": FAR_BBOX}).json()["count"] == 0


@pytest.mark.parametrize("bbox", ["1,2,3", "a,b,c,d", "10,10,5,5", "-200,0,0,10"])
def test_emprise_invalide(admin, bbox):
    res = admin.get(URL, {"bbox": bbox})
    assert res.status_code == 400 and "bbox" in res.json()


def test_carte_geojson(admin, created):
    assert admin.get(f"{URL}map/").status_code == 400  # emprise obligatoire
    data = admin.get(f"{URL}map/", {"bbox": BBOX}).json()
    assert data["type"] == "FeatureCollection" and data["truncated"] is False
    feature = data["features"][0]
    assert feature["id"] == created["id"]
    assert feature["geometry"]["type"] == "MultiPolygon"
    assert feature["properties"]["agroid"] == created["agroid"]
    assert admin.get(f"{URL}map/", {"bbox": FAR_BBOX}).json()["features"] == []


def test_nouveau_contour_et_historique(admin, created):
    url = f"{URL}{created['id']}/"
    res = admin.post(
        f"{url}geometries/",
        {"geometry": square(dlon=2 * D_LON), "capture_method": "gps_walk"},
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["current_geometry"]["version"] == 2
    history = admin.get(f"{url}history/").json()
    assert [g["version"] for g in history["geometries"]] == [2, 1]
    assert history["geometries"][1]["valid_to"] is not None


def test_renommer(admin, created):
    res = admin.patch(f"{URL}{created['id']}/", {"local_name": "Grand champ"}, format="json")
    assert res.status_code == 200 and res.json()["local_name"] == "Grand champ"


def test_retrait(admin, created):
    url = f"{URL}{created['id']}/retire/"
    assert admin.post(url, {}, format="json").status_code == 400  # motif obligatoire
    res = admin.post(url, {"reason": "Fusionnée"}, format="json")
    assert res.json()["status"] == "retired" and res.json()["agroid"] == created["agroid"]


def test_autre_organisation_404(orgs, make_member, created):
    other = client_for(make_member(orgs[1], "organization_admin")[0], orgs[1])
    assert other.get(f"{URL}{created['id']}/").status_code == 404
    assert (
        other.post(
            f"{URL}{created['id']}/geometries/", {"geometry": square()}, format="json"
        ).status_code
        == 404
    )
    assert other.get(URL).json()["count"] == 0
    assert other.get(f"{URL}map/", {"bbox": BBOX}).json()["features"] == []


def test_sans_x_workspace_400(orgs, make_member):
    user = make_member(orgs[0], "organization_admin")[0]
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.get(URL).status_code == 400


@pytest.mark.parametrize(
    ("role", "can_view", "can_create", "can_manage", "can_review"),
    [
        ("cooperative_manager", True, True, True, True),
        ("field_agent", True, True, False, False),
        ("agronomist", True, False, False, True),
        ("program_manager", True, False, False, False),
    ],
)
def test_matrice_des_roles(
    orgs, make_member, created, role, can_view, can_create, can_manage, can_review
):
    client = client_for(make_member(orgs[0], role)[0], orgs[0])
    url = f"{URL}{created['id']}/"
    assert (client.get(url).status_code == 200) is can_view
    created_status = client.post(URL, {"local_name": "x"}, format="json").status_code
    assert (created_status == 201) is can_create
    manage = client.post(f"{url}units/", {"code": f"U-{role[:3]}"}, format="json").status_code
    assert (manage == 201) is can_manage
    review = client.post(
        f"{url}geometries/{created['current_geometry']['id']}/review/",
        {"decision": "valid"},
        format="json",
    ).status_code
    # Un contour déjà valide renvoie 400 (rien à trancher) : la permission est bien passée.
    assert (review == 400) is can_review
    if not can_review:
        assert review == 403


def test_role_producteur_sans_acces_aux_parcelles(orgs, make_member, created, user):
    farmer = actor_services.register_producer(
        organization=orgs[0], registered_by=user, first_name="Moussa", last_name="Sow"
    )
    account, membership = make_member(orgs[0])
    farmer.user = account
    farmer.save(update_fields=["user"])
    from apps.organizations import services as org_services

    org_services.assign_role(membership=membership, role_code="producer", assigned_by=user)
    client = client_for(account, orgs[0])
    assert client.get(URL).status_code == 403


def test_revue_d_un_contour_signale(admin, orgs, make_member):
    res = admin.post(URL, {"geometry": square(), "gps_accuracy_m": 40}, format="json").json()
    assert res["status"] == "pending_validation"
    assert res["current_geometry"]["validation"]["labels"] == ["Précision GPS insuffisante"]
    agronomist = client_for(make_member(orgs[0], "agronomist")[0], orgs[0])
    review_url = f"{URL}{res['id']}/geometries/{res['current_geometry']['id']}/review/"
    assert agronomist.post(review_url, {"decision": "rejected"}, format="json").status_code == 400
    done = agronomist.post(
        review_url, {"decision": "valid", "note": "Vu sur place"}, format="json"
    ).json()
    assert done["status"] == "active"
    assert done["current_geometry"]["validation"]["review"]["note"] == "Vu sur place"


def test_proprietaires_et_exploitants(admin, orgs, created, user):
    url = f"{URL}{created['id']}/"
    farmer = actor_services.register_producer(
        organization=orgs[0], registered_by=user, first_name="Moussa", last_name="Sow"
    )
    owner = admin.post(
        f"{url}owners/",
        {"tenure_type": "family_land", "start_date": "2024-01-01", "owner_name": "Famille Diallo"},
        format="json",
    )
    assert owner.status_code == 201 and owner.json()["owner_display"] == "Famille Diallo"
    op = admin.post(
        f"{url}operators/",
        {"producer": str(farmer.pk), "operator_role": "primary", "start_date": "2024-01-01"},
        format="json",
    )
    assert op.status_code == 201 and op.json()["verification_status"] == "confirmed_by_organization"
    detail = admin.get(url).json()
    assert detail["primary_operator"]["name"] == "Moussa Sow"
    assert [o["owner_display"] for o in detail["owners"]] == ["Famille Diallo"]
    assert admin.get(URL, {"producer": str(farmer.pk)}).json()["count"] == 1
    end = admin.post(
        f"{url}owners/{owner.json()['id']}/end/", {"end_date": "2025-01-01"}, format="json"
    )
    assert end.status_code == 200 and end.json()["is_current"] is False
    assert admin.get(url).json()["owners"] == []
    assert len(admin.get(f"{url}history/").json()["owners"]) == 1


def test_exploitant_hors_organisation_refuse(admin, orgs, created, user):
    stranger = actor_services.register_producer(
        organization=orgs[1], registered_by=user, first_name="Awa", last_name="Ndiaye"
    )
    res = admin.post(
        f"{URL}{created['id']}/operators/",
        {"producer": str(stranger.pk), "operator_role": "primary", "start_date": "2024-01-01"},
        format="json",
    )
    assert res.status_code == 400 and "producer" in res.json()


def test_chevauchement_sans_reveler_l_autre_organisation(orgs, make_member, created):
    other = client_for(make_member(orgs[1], "organization_admin")[0], orgs[1])
    res = other.post(URL, {"geometry": square(lon=LON + D_LON / 2)}, format="json").json()
    overlap = res["current_geometry"]["validation"]["overlaps"][0]
    assert overlap["agroid"] is None and overlap["parcel_id"] is None
    assert overlap["label"] == "Parcelle hors de votre périmètre"
    assert created["agroid"] not in str(res)


# ── Accompagnement, accès personnel, espace personnel ────────────────────


def test_organisation_d_accompagnement_en_lecture(orgs, make_member, created):
    other = client_for(make_member(orgs[1], "organization_admin")[0], orgs[1])
    res = other.post(f"{URL}link-requests/", {"agroid": created["agroid"].lower()}, format="json")
    assert res.status_code == 201 and res.json()["status"] == "active"
    detail = other.get(f"{URL}{created['id']}/").json()
    assert detail["access"] == "view"
    assert (
        other.post(
            f"{URL}{created['id']}/geometries/", {"geometry": square()}, format="json"
        ).status_code
        == 403
    )
    assert (
        other.post(f"{URL}link-requests/", {"agroid": "PAI-SN-00000000"}, format="json").status_code
        == 404
    )


def test_espace_personnel_declarer_et_gerer(independent, orgs, make_member, created):
    me = client_for(independent.user, "personal")
    res = me.post(
        URL, {"local_name": "Mon champ", "geometry": square(lon=LON + 0.05)}, format="json"
    )
    assert res.status_code == 201
    mine = res.json()
    assert mine["access"] == "manage" and mine["registration_channel"] == "producer_self"
    assert me.get(URL).json()["count"] == 1
    assert me.get(f"{URL}{created['id']}/").status_code == 404  # parcelle de coopérative
    assert me.post(f"{URL}{mine['id']}/units/", {"code": "U1"}, format="json").status_code == 201
    own = me.post(
        f"{URL}{mine['id']}/operators/",
        {"producer": str(independent.pk), "operator_role": "primary", "start_date": "2024-01-01"},
        format="json",
    )
    assert own.status_code == 201 and own.json()["verification_status"] == "declared"
    # Actions d'organisation interdites dans l'espace personnel.
    assert (
        me.post(f"{URL}link-requests/", {"agroid": created["agroid"]}, format="json").status_code
        == 403
    )


def test_demande_de_suivi_et_accord(independent, orgs, make_member):
    me = client_for(independent.user, "personal")
    mine = me.post(URL, {"geometry": square(lon=LON + 0.05)}, format="json").json()
    coop = client_for(make_member(orgs[0], "organization_admin")[0], orgs[0])
    asked = coop.post(f"{URL}link-requests/", {"agroid": mine["agroid"]}, format="json")
    assert asked.json()["status"] == "pending_producer_consent"
    assert coop.get(f"{URL}{mine['id']}/").status_code == 404  # rien avant l'accord
    pending = me.get("/api/v1/me/parcel-links/").json()
    assert [p["organization"] for p in pending] == ["Coopérative de Guédé"]
    accepted = me.post(f"/api/v1/me/parcel-links/{pending[0]['id']}/accept/")
    assert accepted.status_code == 200 and accepted.json()["status"] == "active"
    detail = coop.get(f"{URL}{mine['id']}/").json()
    assert detail["access"] == "view"  # la coopérative suit, le producteur reste maître
    assert (
        coop.post(
            f"{URL}{mine['id']}/geometries/", {"geometry": square()}, format="json"
        ).status_code
        == 403
    )


def test_refus_de_suivi(independent, orgs, make_member):
    me = client_for(independent.user, "personal")
    mine = me.post(URL, {"geometry": square(lon=LON + 0.05)}, format="json").json()
    coop = client_for(make_member(orgs[0], "organization_admin")[0], orgs[0])
    link_id = coop.post(f"{URL}link-requests/", {"agroid": mine["agroid"]}, format="json").json()[
        "id"
    ]
    assert me.post(f"/api/v1/me/parcel-links/{link_id}/decline/").json()["status"] == "ended"
    assert coop.get(f"{URL}{mine['id']}/").status_code == 404


def test_acces_personnel_accorde_par_l_organisation(admin, orgs, created, independent, user):
    farmer = actor_services.register_producer(
        organization=orgs[0], registered_by=user, first_name="Ousmane", last_name="Fall"
    )
    # Le producteur rattaché obtient un compte.
    from apps.accounts.models import User

    farmer.user = User.objects.create_user(
        phone_number="+221770003333",
        password="Un-mot-de-passe-2026",
        first_name="Ousmane",
        last_name="Fall",
    )
    farmer.save(update_fields=["user"])
    admin.post(
        f"{URL}{created['id']}/owners/",
        {"tenure_type": "family_land", "start_date": "2024-01-01", "owner_name": "Famille Diallo"},
        format="json",
    )
    res = admin.post(
        f"{URL}{created['id']}/personal-access/", {"producer": str(farmer.pk)}, format="json"
    )
    assert res.status_code == 201 and res.json()["access_level"] == "view"
    mine = client_for(farmer.user, "personal")
    detail = mine.get(f"{URL}{created['id']}/").json()
    assert detail["access"] == "view"
    assert detail["owners"] == []  # le nom d'un tiers ne sort pas de l'organisation (D-07)
    assert (
        mine.post(f"{URL}{created['id']}/units/", {"code": "U9"}, format="json").status_code == 403
    )
    revoke = admin.post(
        f"{URL}{created['id']}/personal-access/{res.json()['id']}/revoke/",
        {"reason": "Erreur"},
        format="json",
    )
    assert revoke.status_code == 204
    assert mine.get(f"{URL}{created['id']}/").status_code == 404


def test_schema_documente_le_geojson(api):
    schema = APIClient().get("/api/schema/").content.decode()
    assert "/api/v1/parcels/map/" in schema
    assert "FeatureCollection" in schema and "minLon,minLat,maxLon,maxLat" in schema


def test_resume(admin, created):
    admin.post(URL, {"geometry": square(lon=LON + 0.01), "gps_accuracy_m": 40}, format="json")
    data = admin.get(f"{URL}summary/").json()
    assert data["count"] == 2
    assert data["by_status"] == {"active": 1, "pending_validation": 1}
    assert data["to_review"] == 1
    assert 19000 < float(data["total_area_m2"]) < 22000
    min_lon, min_lat, max_lon, max_lat = data["bbox"]
    assert min_lon < LON + 0.001 < max_lon + 0.001 and min_lat < LAT + 0.001


def test_resume_vide(orgs, make_member):
    other = client_for(make_member(orgs[1], "organization_admin")[0], orgs[1])
    assert other.get(f"{URL}summary/").json() == {
        "count": 0,
        "by_status": {},
        "total_area_m2": "0",
        "to_review": 0,
        "bbox": None,
    }


# ── Saisie dans le Web OS (J15c) : position seule, exploitant à la création ──


@pytest.fixture
def farmer(orgs, make_member):
    owner = make_member(orgs[0], "organization_admin")[0]
    return actor_services.register_producer(
        organization=orgs[0], registered_by=owner, first_name="Awa", last_name="Sow"
    )


def test_creation_par_position_sans_contour(admin):
    res = admin.post(URL, {"local_name": "Jardin", "position": [LON, LAT]}, format="json")
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["current_geometry"] is None and body["status"] == "active"
    assert body["centroid"] == [LON, LAT]


def test_contour_et_position_exclusifs(admin):
    res = admin.post(URL, {"geometry": square(), "position": [LON, LAT]}, format="json")
    assert res.status_code == 400 and "position" in res.json()
    res = admin.post(URL, {"position": [LAT, 200]}, format="json")
    assert res.status_code == 400


def test_creation_avec_exploitant(admin, farmer):
    res = admin.post(
        URL,
        {"geometry": square(), "capture_method": "manual_drawing", "operator": str(farmer.pk)},
        format="json",
    )
    assert res.status_code == 201, res.json()
    assert res.json()["primary_operator"]["name"] == "Awa Sow"


def test_exploitant_hors_organisation_rien_n_est_cree(admin, orgs, make_member):
    other_admin = make_member(orgs[1], "organization_admin")[0]
    stranger = actor_services.register_producer(
        organization=orgs[1], registered_by=other_admin, first_name="Moussa", last_name="Ba"
    )
    before = Parcel.objects.count()
    res = admin.post(URL, {"position": [LON, LAT], "operator": str(stranger.pk)}, format="json")
    assert res.status_code == 400 and Parcel.objects.count() == before


def test_recherche_par_morceau_d_agroid(admin, created):
    part = created["agroid"][:9]  # « PAI-SN-XX »
    assert admin.get(f"{URL}?q={part}").json()["count"] == 1
    assert admin.get(f"{URL}?q={created['agroid'][-4:].lower()}").json()["count"] == 1
    assert admin.get(f"{URL}?q=fleuve").json()["count"] == 1


def test_enrolement_avec_foncier_exploitant_proprietaire(admin, farmer):
    res = admin.post(
        URL,
        {
            "geometry": square(),
            "capture_method": "gps_walk",
            "operator": str(farmer.pk),
            "ownership": {"owner": "operator", "tenure_type": "customary_right"},
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert [o["owner_display"] for o in body["owners"]] == ["Awa Sow"]
    assert body["owners"][0]["tenure_type"] == "customary_right"
    assert body["owners"][0]["verification_status"] == "declared"
    history = admin.get(f"{URL}{body['id']}/history/").json()
    assert history["operators"][0]["arrangement_type"] == "owner_operated"


def test_enrolement_parcelle_louee(admin, farmer):
    res = admin.post(
        URL,
        {
            "position": [LON, LAT],
            "operator": str(farmer.pk),
            "arrangement_type": "rental",
            "ownership": {
                "owner": "other",
                "owner_name": "Famille Diallo",
                "tenure_type": "family_land",
            },
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    assert res.json()["owners"][0]["owner_display"] == "Famille Diallo"
    history = admin.get(f"{URL}{res.json()['id']}/history/").json()
    assert history["operators"][0]["arrangement_type"] == "rental"


def test_enrolement_foncier_incoherent_rien_n_est_cree(admin):
    before = Parcel.objects.count()
    no_operator = admin.post(
        URL,
        {"position": [LON, LAT], "ownership": {"owner": "operator", "tenure_type": "lease"}},
        format="json",
    )
    assert no_operator.status_code == 400 and "ownership" in no_operator.json()
    no_name = admin.post(
        URL,
        {"position": [LON, LAT], "ownership": {"owner": "other", "tenure_type": "lease"}},
        format="json",
    )
    assert no_name.status_code == 400
    assert Parcel.objects.count() == before
