"""Contraintes d'intégrité en base : organisations, adhésions, rôles, attributions plateforme."""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.organizations.models import (
    MembershipRole,
    Organization,
    OrganizationMembership,
    PlatformRoleAssignment,
    Role,
)

pytestmark = pytest.mark.django_db
S = OrganizationMembership.Status


def db_error(callable_):
    with pytest.raises(IntegrityError), transaction.atomic():
        callable_()


# --- Organisation -----------------------------------------------------------
def test_organization_defaults(make_org):
    org = Organization.objects.create(name="ONG Niayes", organization_type="ngo")
    assert org.status == "pending" and org.country_code == "SN" and not org.is_archived
    assert org.legal_identifier is None and len(str(org.pk)) == 36


def test_legal_identifier_unique_per_country_only_when_present(make_org):
    make_org("A", legal_identifier="NINEA-1")
    make_org("B")  # sans identifiant : autorisé plusieurs fois
    make_org("C")
    make_org("D", legal_identifier="NINEA-1", country_code="ML")  # autre pays : autorisé
    db_error(lambda: make_org("E", legal_identifier="NINEA-1"))


def test_organization_type_and_status_checked_in_database(make_org):
    db_error(lambda: Organization.objects.create(name="X", organization_type="bank"))
    db_error(
        lambda: Organization.objects.create(name="X", organization_type="ngo", status="deleted")
    )
    db_error(
        lambda: Organization.objects.create(name="X", organization_type="ngo", country_code="S1")
    )


def test_organization_cannot_be_its_own_parent(make_org):
    org = make_org()
    org.parent_organization_id = org.pk
    db_error(org.save)


def test_parent_organization_gives_no_implicit_access(make_org, make_member, api):
    union = make_org("Union")
    coop = make_org("Coop", parent_organization=union)
    admin, _ = make_member(union, "organization_admin")
    assert api.as_user(admin, coop).get("/api/v1/organization/").status_code == 403


# --- Adhésions ---------------------------------------------------------------
def test_one_open_membership_per_user_and_org(make_org, make_user):
    org, user = make_org(), make_user()
    OrganizationMembership.objects.create(user=user, organization=org)
    db_error(lambda: OrganizationMembership.objects.create(user=user, organization=org))


def test_new_membership_allowed_after_revocation(make_org, make_user):
    org, user = make_org(), make_user()
    OrganizationMembership.objects.create(
        user=user, organization=org, status=S.REVOKED, ended_at=timezone.now()
    )
    OrganizationMembership.objects.create(user=user, organization=org)  # nouvelle ligne : autorisée
    assert OrganizationMembership.objects.filter(user=user, organization=org).count() == 2


def test_revoked_iff_ended_at(make_org, make_user):
    org, user = make_org(), make_user()
    db_error(
        lambda: OrganizationMembership.objects.create(user=user, organization=org, status=S.REVOKED)
    )
    db_error(
        lambda: OrganizationMembership.objects.create(
            user=user, organization=org, ended_at=timezone.now()
        )
    )


def test_active_membership_requires_joined_at(make_org, make_user):
    db_error(
        lambda: OrganizationMembership.objects.create(
            user=make_user(), organization=make_org(), status=S.ACTIVE
        )
    )


def test_membership_user_and_organization_are_immutable(make_org, make_user):
    org_a, org_b = make_org("A"), make_org("B")
    membership = OrganizationMembership.objects.create(user=make_user(), organization=org_a)
    membership.organization = org_b
    with pytest.raises(ValidationError):
        membership.save()


def test_membership_cannot_be_deleted_while_referenced(make_member, make_org):
    _, membership = make_member(make_org(), "field_agent")
    with pytest.raises(Exception), transaction.atomic():  # noqa: B017 (ProtectedError)
        membership.delete()  # PROTECT : un rôle d'adhésion le référence


# --- Rôles ---------------------------------------------------------------------
def test_database_accepts_only_the_seven_roles(roles):
    db_error(lambda: Role.objects.create(code="auditor", name="Auditor", scope="organization"))


def test_role_scope_must_match_code(roles):
    role = Role.objects.get(code="field_agent")
    role.scope = "platform"
    db_error(role.save)
    super_admin = Role.objects.get(code="super_admin")
    super_admin.scope = "organization"
    db_error(super_admin.save)


def test_membership_role_unique_while_active(make_member, make_org, roles):
    _, membership = make_member(make_org(), "field_agent")
    role = Role.objects.get(code="field_agent")
    db_error(lambda: MembershipRole.objects.create(membership=membership, role=role))


def test_membership_role_rejects_platform_role(make_member, make_org, roles):
    _, membership = make_member(make_org())
    with pytest.raises(ValidationError):
        MembershipRole.objects.create(
            membership=membership, role=Role.objects.get(code="super_admin")
        )


def test_membership_role_revocation_after_assignment(make_member, make_org):
    _, membership = make_member(make_org(), "agronomist")
    assignment = membership.role_assignments.get()
    assignment.revoked_at = assignment.assigned_at - timedelta(days=1)
    db_error(assignment.save)


# --- Attribution plateforme ------------------------------------------------------
def test_platform_assignment_rules(roles, make_user):
    user, author = make_user(), make_user()
    super_admin = Role.objects.get(code="super_admin")
    db_error(
        lambda: PlatformRoleAssignment.objects.create(
            user=user, role=super_admin, granted_by=author, justification="   "
        )
    )
    now = timezone.now()
    db_error(
        lambda: PlatformRoleAssignment.objects.create(
            user=user,
            role=super_admin,
            granted_by=author,
            justification="Support",
            valid_from=now,
            valid_until=now - timedelta(hours=1),
        )
    )
    PlatformRoleAssignment.objects.create(
        user=user, role=super_admin, granted_by=author, justification="Support"
    )
    db_error(
        lambda: PlatformRoleAssignment.objects.create(
            user=user, role=super_admin, granted_by=author, justification="Doublon"
        )
    )


def test_platform_assignment_rejects_organization_role(roles, make_user):
    with pytest.raises(ValidationError):
        PlatformRoleAssignment.objects.create(
            user=make_user(),
            role=Role.objects.get(code="organization_admin"),
            granted_by=make_user(),
            justification="Erreur",
        )
