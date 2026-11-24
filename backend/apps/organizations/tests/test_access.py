"""Séparation entre organisations, contexte X-Workspace et permissions de l'API."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.organizations import services
from apps.organizations.models import Organization, OrganizationMembership

pytestmark = pytest.mark.django_db
ORG_URL = "/api/v1/organization/"
MEMBERS_URL = "/api/v1/memberships/"


# --- En-tête X-Workspace (D-01) -------------------------------------------------
def test_missing_workspace_header_is_400(make_member, make_org, api):
    user, _ = make_member(make_org(), "organization_admin")
    assert api.as_user(user).get(ORG_URL).status_code == 400


@pytest.mark.parametrize("value", ["org:pas-un-uuid", "organisation", "org:", "ORG:123"])
def test_malformed_workspace_header_is_400(value, make_member, make_org, api):
    user, _ = make_member(make_org(), "organization_admin")
    assert api.as_user(user, value).get(ORG_URL).status_code == 400


def test_personal_workspace_refused_without_producer_profile(make_member, make_org, api):
    user, _ = make_member(make_org(), "field_agent")
    assert api.as_user(user, "personal").get(ORG_URL).status_code == 403


def test_unauthenticated_is_401(make_org, api):
    api.credentials(HTTP_X_WORKSPACE=f"org:{make_org().pk}")
    assert api.get(ORG_URL).status_code == 401


# --- Séparation entre organisations ---------------------------------------------
def test_member_of_a_cannot_enter_workspace_b(two_orgs, make_member, api):
    org_a, org_b = two_orgs
    admin_a, _ = make_member(org_a, "organization_admin")
    assert api.as_user(admin_a, org_a).get(ORG_URL).status_code == 200
    assert api.as_user(admin_a, org_b).get(ORG_URL).status_code == 403
    assert api.as_user(admin_a, org_b).get(MEMBERS_URL).status_code == 403


def test_unknown_organization_is_403_not_404(make_member, make_org, api):
    admin, _ = make_member(make_org(), "organization_admin")
    response = api.as_user(admin, "org:00000000-0000-0000-0000-000000000000").get(ORG_URL)
    assert response.status_code == 403


def test_membership_of_other_org_in_url_is_404(two_orgs, make_member, api):
    org_a, org_b = two_orgs
    admin_a, _ = make_member(org_a, "organization_admin")
    _, membership_b = make_member(org_b, "field_agent")
    client = api.as_user(admin_a, org_a)
    assert client.get(f"{MEMBERS_URL}{membership_b.pk}/").status_code == 404
    assert client.post(f"{MEMBERS_URL}{membership_b.pk}/revoke/").status_code == 404
    membership_b.refresh_from_db()
    assert membership_b.status == OrganizationMembership.Status.ACTIVE


def test_member_list_contains_only_current_organization(two_orgs, make_member, api):
    org_a, org_b = two_orgs
    admin_a, _ = make_member(org_a, "organization_admin")
    make_member(org_a, "field_agent")
    make_member(org_b, "field_agent")
    make_member(org_b, "agronomist")
    results = api.as_user(admin_a, org_a).get(MEMBERS_URL).json()["results"]
    assert len(results) == 2


def test_roles_only_apply_in_their_own_organization(two_orgs, make_member, api):
    """Admin dans A, simple agent dans B : il n'administre pas B."""
    org_a, org_b = two_orgs
    user, _ = make_member(org_a, "organization_admin")
    make_member(org_b, "field_agent", user=user)
    assert api.as_user(user, org_a).get(MEMBERS_URL).status_code == 200
    assert api.as_user(user, org_b).get(MEMBERS_URL).status_code == 403
    assert api.as_user(user, org_b).get(ORG_URL).status_code == 200


def test_suspended_membership_loses_access(make_member, make_org, api):
    org = make_org()
    user, membership = make_member(org, "organization_admin")
    services.suspend_membership(membership=membership, actor=None)
    assert api.as_user(user, org).get(ORG_URL).status_code == 403


def test_invited_membership_has_no_access_until_accepted(roles, make_org, make_user, api):
    org, user = make_org(), make_user()
    membership = services.invite_member(
        organization=org, user=user, invited_by=None, role_codes=["organization_admin"]
    )
    assert api.as_user(user, org).get(ORG_URL).status_code == 403
    response = api.as_user(user).post(f"/api/v1/me/memberships/{membership.pk}/accept/")
    assert response.status_code == 200
    assert api.as_user(user, org).get(ORG_URL).status_code == 200


def test_cannot_accept_someone_elses_invitation(roles, make_org, make_user, api):
    membership = services.invite_member(organization=make_org(), user=make_user(), invited_by=None)
    response = api.as_user(make_user()).post(f"/api/v1/me/memberships/{membership.pk}/accept/")
    assert response.status_code == 404


def test_inactive_or_archived_organization_closes_workspace(make_member, make_org, api):
    org = make_org()
    user, _ = make_member(org, "organization_admin")
    Organization.objects.filter(pk=org.pk).update(status=Organization.Status.SUSPENDED)
    assert api.as_user(user, org).get(ORG_URL).status_code == 403


def test_deactivated_account_loses_access(make_member, make_org, api):
    org = make_org()
    user, _ = make_member(org, "organization_admin")
    user.is_active = False
    user.save()
    assert api.as_user(user, org).get(ORG_URL).status_code in (401, 403)


# --- Permissions par rôle -----------------------------------------------------------
@pytest.mark.parametrize("role", ["field_agent", "agronomist", "program_manager"])
def test_only_admin_or_manager_can_invite(role, make_member, make_org, make_user, api):
    org = make_org()
    user, _ = make_member(org, role)
    target = make_user()
    response = api.as_user(user, org).post(
        MEMBERS_URL, {"phone_number": target.phone_number}, format="json"
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "role, expected",
    [
        ("organization_admin", 200),
        ("cooperative_manager", 200),
        ("field_agent", 403),
        ("agronomist", 403),
        ("program_manager", 403),
    ],
)
def test_member_list_visibility_by_role(role, expected, make_member, make_org, api):
    org = make_org()
    user, _ = make_member(org, role)
    assert api.as_user(user, org).get(MEMBERS_URL).status_code == expected


def test_member_without_role_has_no_permission(make_member, make_org, api):
    org = make_org()
    user, _ = make_member(org)
    assert api.as_user(user, org).get(ORG_URL).status_code == 403


def test_admin_invites_and_assigns_roles(make_member, make_org, make_user, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    target = make_user()
    client = api.as_user(admin, org)
    response = client.post(
        MEMBERS_URL,
        {"phone_number": target.phone_number, "roles": ["program_manager"]},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "invited" and body["roles"] == ["program_manager"]
    response = client.post(
        f"{MEMBERS_URL}{body['id']}/roles/", {"role": "agronomist"}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["roles"] == ["agronomist", "program_manager"]
    response = client.post(f"{MEMBERS_URL}{body['id']}/roles/program_manager/revoke/")
    assert response.status_code == 200 and response.json()["roles"] == ["agronomist"]


def test_admin_cannot_assign_super_admin_or_producer(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    _, member = make_member(org, "program_manager")
    client = api.as_user(admin, org)
    assert (
        client.post(
            f"{MEMBERS_URL}{member.pk}/roles/", {"role": "super_admin"}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"{MEMBERS_URL}{member.pk}/roles/", {"role": "producer"}, format="json"
        ).status_code
        == 400
    )


def test_invite_unknown_phone_without_names_is_400(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    response = api.as_user(admin, org).post(
        MEMBERS_URL, {"phone_number": "+221789999999"}, format="json"
    )
    assert response.status_code == 400
    assert "first_name" in response.json()


def test_organization_id_is_never_taken_from_payload(two_orgs, make_member, make_user, api):
    org_a, org_b = two_orgs
    admin_a, _ = make_member(org_a, "organization_admin")
    target = make_user()
    api.as_user(admin_a, org_a).post(
        MEMBERS_URL,
        {"phone_number": target.phone_number, "organization": str(org_b.pk)},
        format="json",
    )
    assert OrganizationMembership.objects.get(user=target).organization_id == org_a.pk


def test_org_admin_updates_own_organization_but_not_status(make_member, make_org, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    response = api.as_user(admin, org).patch(
        ORG_URL, {"short_name": "CP", "status": "closed"}, format="json"
    )
    assert response.status_code == 200
    org.refresh_from_db()
    assert org.short_name == "CP" and org.status == Organization.Status.ACTIVE


def test_field_agent_cannot_update_organization(make_member, make_org, api):
    org = make_org()
    agent, _ = make_member(org, "field_agent")
    assert (
        api.as_user(agent, org).patch(ORG_URL, {"short_name": "X"}, format="json").status_code
        == 403
    )


# --- Super Admin (portée plateforme) --------------------------------------------------
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


def test_platform_routes_refused_to_organization_admin(make_member, make_org, api):
    admin, _ = make_member(make_org(), "organization_admin")
    assert api.as_user(admin).get("/api/v1/platform/organizations/").status_code == 403


def test_technical_superuser_is_not_platform_admin(roles, api):
    from apps.accounts.models import User

    tech = User.objects.create_superuser(
        phone_number="+221770001000", password="x" * 12, first_name="T", last_name="T"
    )
    assert api.as_user(tech).get("/api/v1/platform/organizations/").status_code == 403


def test_super_admin_creates_organization_and_designates_admin(super_admin, make_user, api):
    client = api.as_user(super_admin)
    response = client.post(
        "/api/v1/platform/organizations/",
        {"name": "GIE Ndiawdoune", "organization_type": "cooperative"},
        format="json",
    )
    assert response.status_code == 201
    org_id = response.json()["id"]
    assert response.json()["status"] == "pending"
    future_admin = make_user()
    response = client.post(
        f"/api/v1/platform/organizations/{org_id}/admins/",
        {"phone_number": future_admin.phone_number},
        format="json",
    )
    assert response.status_code == 201 and response.json()["roles"] == ["organization_admin"]


def test_super_admin_reads_any_org_read_only(super_admin, make_org, api):
    org = make_org()
    client = api.as_user(super_admin, org)
    assert client.get(ORG_URL).status_code == 200
    assert client.get(MEMBERS_URL).status_code == 200
    assert client.patch(ORG_URL, {"short_name": "X"}, format="json").status_code == 403


def test_expired_super_admin_has_no_access(roles, make_user, make_org, api):
    user = make_user()
    assignment = services.grant_platform_role(
        user=user,
        granted_by=make_user(),
        justification="Mission",
        valid_until=timezone.now() + timedelta(days=1),
    )
    services.end_platform_role(assignment=assignment, ended_by=user)
    assert api.as_user(user).get("/api/v1/platform/organizations/").status_code == 403
    assert api.as_user(user, make_org()).get(ORG_URL).status_code == 403


def test_my_organizations_lists_only_active_memberships(
    two_orgs, make_member, make_user, roles, api
):
    org_a, org_b = two_orgs
    user, _ = make_member(org_a, "field_agent")
    services.invite_member(organization=org_b, user=user, invited_by=None)
    names = [o["name"] for o in api.as_user(user).get("/api/v1/organizations/").json()["results"]]
    assert names == ["Coopérative A"]


def test_me_lists_memberships_with_workspace_value(two_orgs, make_member, api):
    org_a, _ = two_orgs
    user, _ = make_member(org_a, "agronomist")
    body = api.as_user(user).get("/api/v1/me/").json()
    assert body["memberships"][0]["workspace"] == f"org:{org_a.pk}"
    assert body["memberships"][0]["roles"] == ["agronomist"]
