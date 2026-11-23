"""Invitations (J8) : création de compte, code d'activation, droits du gérant de coopérative."""

import pytest

from apps.accounts.models import AccountActivation, User
from apps.organizations.models import OrganizationMembership

pytestmark = pytest.mark.django_db
MEMBERS_URL = "/api/v1/memberships/"
NEW_PHONE = "+221781112233"


def invite(client, **payload):
    return client.post(MEMBERS_URL, payload, format="json")


# --- Création de compte et code ----------------------------------------------
def test_invitation_d_un_nouveau_numero_cree_le_compte_et_renvoie_un_code(
    make_member, make_org, api
):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    response = invite(
        api.as_user(admin, org),
        phone_number="+221 78 111 22 33",
        first_name="Moussa",
        last_name="Diop",
        roles=["field_agent"],
    )
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["status"] == "invited"
    assert body["roles"] == ["field_agent"]
    assert body["user"]["account_activated"] is False
    code = body["activation_code"]
    assert len(code) == 9 and code[4] == "-"

    user = User.objects.get(phone_number=NEW_PHONE)
    assert not user.has_usable_password()
    activation = AccountActivation.objects.get(user=user)
    assert code.replace("-", "") not in activation.code_hash  # jamais stocké en clair


def test_invitation_d_un_compte_existant_ne_renvoie_pas_de_code(
    make_member, make_org, make_user, api
):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    target = make_user()
    response = invite(api.as_user(admin, org), phone_number=target.phone_number)
    assert response.status_code == 201
    assert response.json()["activation_code"] is None
    assert response.json()["user"]["account_activated"] is True


def test_numero_invalide_refuse(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    response = invite(api.as_user(admin, org), phone_number="12", first_name="A", last_name="B")
    assert response.status_code == 400


def test_nouveau_code_annule_le_precedent(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    client = api.as_user(admin, org)
    membership_id = invite(
        client, phone_number=NEW_PHONE, first_name="Awa", last_name="Sall"
    ).json()["id"]

    response = client.post(f"{MEMBERS_URL}{membership_id}/activation-code/")
    assert response.status_code == 200
    assert response.json()["activation_code"]
    user = User.objects.get(phone_number=NEW_PHONE)
    assert AccountActivation.objects.filter(user=user, revoked_at__isnull=True).count() == 1
    assert AccountActivation.objects.filter(user=user).count() == 2


def test_pas_de_code_pour_un_compte_deja_active(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    _, member = make_member(org, "field_agent")
    response = api.as_user(admin, org).post(f"{MEMBERS_URL}{member.pk}/activation-code/")
    assert response.status_code == 400


# --- Droits du gérant de coopérative (décision du 23/11/2026) -----------------
def test_le_gerant_invite_et_attribue_des_roles(make_member, make_org, make_user, api):
    org = make_org()
    manager, _ = make_member(org, "cooperative_manager")
    client = api.as_user(manager, org)
    response = invite(
        client, phone_number=NEW_PHONE, first_name="Fatou", last_name="Ndiaye", roles=["agronomist"]
    )
    assert response.status_code == 201

    _, member = make_member(org, "field_agent")
    assert (
        client.post(
            f"{MEMBERS_URL}{member.pk}/roles/", {"role": "agronomist"}, format="json"
        ).status_code
        == 200
    )


def test_le_gerant_ne_nomme_jamais_d_administrateur(make_member, make_org, api):
    org = make_org()
    manager, _ = make_member(org, "cooperative_manager")
    _, member = make_member(org, "field_agent")
    client = api.as_user(manager, org)
    assert (
        invite(
            client,
            phone_number=NEW_PHONE,
            first_name="A",
            last_name="B",
            roles=["organization_admin"],
        ).status_code
        == 403
    )
    assert not User.objects.filter(phone_number=NEW_PHONE).exists()
    assert (
        client.post(
            f"{MEMBERS_URL}{member.pk}/roles/", {"role": "organization_admin"}, format="json"
        ).status_code
        == 403
    )


def test_le_gerant_ne_touche_pas_a_un_administrateur(make_member, make_org, api):
    org = make_org()
    manager, _ = make_member(org, "cooperative_manager")
    _, admin_membership = make_member(org, "organization_admin")
    client = api.as_user(manager, org)
    for action in ("suspend", "revoke"):
        assert client.post(f"{MEMBERS_URL}{admin_membership.pk}/{action}/").status_code == 403
    assert (
        client.post(
            f"{MEMBERS_URL}{admin_membership.pk}/roles/organization_admin/revoke/"
        ).status_code
        == 403
    )
    admin_membership.refresh_from_db()
    assert admin_membership.status == OrganizationMembership.Status.ACTIVE


def test_personne_ne_se_suspend_ni_ne_se_revoque_soi_meme(make_member, make_org, api):
    org = make_org()
    admin, own = make_member(org, "organization_admin")
    client = api.as_user(admin, org)
    assert client.post(f"{MEMBERS_URL}{own.pk}/suspend/").status_code == 403
    assert client.post(f"{MEMBERS_URL}{own.pk}/revoke/").status_code == 403
    assert client.post(f"{MEMBERS_URL}{own.pk}/roles/organization_admin/revoke/").status_code == 403


def test_l_administrateur_peut_nommer_un_administrateur(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    _, member = make_member(org, "cooperative_manager")
    response = api.as_user(admin, org).post(
        f"{MEMBERS_URL}{member.pk}/roles/", {"role": "organization_admin"}, format="json"
    )
    assert response.status_code == 200
    assert "organization_admin" in response.json()["roles"]
