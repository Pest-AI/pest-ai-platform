"""Agents terrain recrutés et affectés par PEST AI uniquement (décision du 24/11/2026)."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.organizations import services

pytestmark = pytest.mark.django_db
AGENTS_URL = "/api/v1/platform/agents/"
MEMBERS_URL = "/api/v1/memberships/"
NEW_PHONE = "+221781234567"


@pytest.fixture
def super_admin(roles, make_user):
    user = make_user()
    services.grant_platform_role(
        user=user,
        granted_by=make_user(),
        justification="Exploitation plateforme",
        valid_until=timezone.now() + timedelta(days=30),
    )
    return user


def create_agent(client, org, phone=NEW_PHONE):
    return client.post(
        AGENTS_URL,
        {
            "organization": str(org.pk),
            "phone_number": phone,
            "first_name": "Awa",
            "last_name": "Diop",
        },
        format="json",
    )


# --- La coopérative ne gère pas les agents ------------------------------------
@pytest.mark.parametrize("role", ["organization_admin", "cooperative_manager"])
def test_la_cooperative_n_invite_pas_d_agent(role, make_member, make_org, api):
    org = make_org()
    user, _ = make_member(org, role)
    response = api.as_user(user, org).post(
        MEMBERS_URL,
        {"phone_number": NEW_PHONE, "first_name": "A", "last_name": "B", "roles": ["field_agent"]},
        format="json",
    )
    assert response.status_code == 403
    assert "PEST AI" in response.json()["detail"]


def test_la_cooperative_ne_touche_pas_a_un_agent(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    _, agent = make_member(org, "field_agent")
    _, other = make_member(org, "program_manager")
    client = api.as_user(admin, org)
    for path in ("suspend/", "revoke/", "roles/field_agent/revoke/", "activation-code/"):
        assert client.post(f"{MEMBERS_URL}{agent.pk}/{path}").status_code == 403, path
    assert (
        client.post(
            f"{MEMBERS_URL}{agent.pk}/roles/", {"role": "agronomist"}, format="json"
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"{MEMBERS_URL}{other.pk}/roles/", {"role": "field_agent"}, format="json"
        ).status_code
        == 403
    )
    # La coopérative voit toujours ses agents dans l'équipe.
    ids = {m["id"] for m in client.get(MEMBERS_URL).json()["results"]}
    assert str(agent.pk) in ids


# --- PEST AI crée et affecte ----------------------------------------------------
def test_pest_ai_cree_un_agent_et_l_affecte(super_admin, make_org, api):
    org = make_org()
    client = api.as_user(super_admin)
    response = create_agent(client, org)
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["roles"] == ["field_agent"]
    assert body["status"] == "invited"
    assert body["organization"]["id"] == str(org.pk)
    assert len(body["activation_code"]) == 9

    listed = client.get(AGENTS_URL, {"organization": str(org.pk)}).json()["results"]
    assert [a["id"] for a in listed] == [body["id"]]
    assert client.get(AGENTS_URL, {"organization": "x"}).status_code == 400


def test_un_agent_peut_servir_plusieurs_organisations(super_admin, make_org, api):
    org_a, org_b = make_org("Coopérative A"), make_org("Coopérative B")
    client = api.as_user(super_admin)
    assert create_agent(client, org_a).status_code == 201
    second = create_agent(client, org_b)
    assert second.status_code == 201
    assert second.json()["activation_code"]  # compte jamais activé : nouveau code
    assert len(client.get(AGENTS_URL).json()["results"]) == 2


def test_pest_ai_suspend_reactive_retire_et_renouvelle_le_code(super_admin, make_org, api):
    org = make_org()
    client = api.as_user(super_admin)
    agent_id = create_agent(client, org).json()["id"]
    assert client.post(f"{AGENTS_URL}{agent_id}/activation-code/").status_code == 200
    assert client.post(f"{AGENTS_URL}{agent_id}/suspend/").status_code == 400  # pas encore actif
    response = client.post(f"{AGENTS_URL}{agent_id}/revoke/")
    assert response.status_code == 200 and response.json()["status"] == "revoked"
    assert client.get(AGENTS_URL).json()["results"] == []


def test_agent_actif_suspendu_puis_reactive(super_admin, make_member, make_org, api):
    org = make_org()
    _, agent = make_member(org, "field_agent")
    client = api.as_user(super_admin)
    assert client.post(f"{AGENTS_URL}{agent.pk}/suspend/").json()["status"] == "suspended"
    assert client.post(f"{AGENTS_URL}{agent.pk}/reactivate/").json()["status"] == "active"


def test_routes_agents_reservees_a_la_plateforme(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    client = api.as_user(admin)
    assert client.get(AGENTS_URL).status_code == 403
    assert create_agent(client, org).status_code == 403
