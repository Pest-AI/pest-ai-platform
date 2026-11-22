"""Les sept rôles système, leurs portées et le catalogue de permissions."""

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command

from apps.organizations import constants as C
from apps.organizations import services
from apps.organizations.models import Permission, Role, RolePermission

pytestmark = pytest.mark.django_db

EXPECTED = {
    "super_admin": "platform",
    "organization_admin": "organization",
    "cooperative_manager": "organization",
    "field_agent": "organization",
    "agronomist": "organization",
    "producer": "organization",
    "program_manager": "organization",
}


def test_exactly_seven_system_roles_with_expected_scopes(roles):
    assert dict(Role.objects.values_list("code", "scope")) == EXPECTED
    assert Role.objects.filter(is_system=True).count() == 7


def test_seed_is_idempotent(roles):
    call_command("seed_roles")
    call_command("seed_roles")
    assert Role.objects.count() == 7
    assert Permission.objects.count() == len(C.PERMISSIONS)


def test_role_permissions_share_role_scope(roles):
    for link in RolePermission.objects.select_related("role", "permission"):
        assert link.permission.scope == link.role.scope
        assert link.permission.scope != "personal"


def test_role_permission_scope_mismatch_rejected(roles):
    with pytest.raises(ValidationError):
        RolePermission.objects.create(
            role=Role.objects.get(code="field_agent"),
            permission=Permission.objects.get(code="platform.organizations.view"),
        )


def test_personal_permission_never_granted_by_role(roles):
    personal = Permission.objects.create(
        code="personal.parcels.view", domain="parcels", scope="personal"
    )
    with pytest.raises(ValidationError):
        RolePermission.objects.create(role=Role.objects.get(code="producer"), permission=personal)


@pytest.mark.parametrize(
    "code",
    ["organization_admin", "cooperative_manager", "field_agent", "agronomist", "program_manager"],
)
def test_organization_roles_assignable_by_membership(code, make_member, make_org):
    _, membership = make_member(make_org(), code)
    assert list(membership.role_assignments.values_list("role__code", flat=True)) == [code]


def test_super_admin_never_assignable_by_membership(make_member, make_org):
    _, membership = make_member(make_org())
    with pytest.raises(ValidationError):
        services.assign_role(membership=membership, role_code="super_admin", assigned_by=None)


def test_producer_role_requires_producer_domain(make_member, make_org):
    """v2.2 : producer exige un profil Producer rattaché ; domaine non encore développé."""
    _, membership = make_member(make_org())
    with pytest.raises(ValidationError):
        services.assign_role(membership=membership, role_code="producer", assigned_by=None)


def test_unknown_role_rejected(make_member, make_org):
    _, membership = make_member(make_org())
    with pytest.raises(ValidationError):
        services.assign_role(membership=membership, role_code="auditor", assigned_by=None)


def test_a_member_can_cumulate_roles(make_member, make_org):
    _, membership = make_member(make_org(), "organization_admin", "agronomist")
    assert set(membership.role_assignments.values_list("role__code", flat=True)) == {
        "organization_admin",
        "agronomist",
    }
