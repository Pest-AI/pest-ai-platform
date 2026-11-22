"""Cycle de vie des adhésions, rôles et attributions plateforme (couche service)."""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.organizations import selectors, services
from apps.organizations.models import Organization, OrganizationMembership

pytestmark = pytest.mark.django_db
S = OrganizationMembership.Status


def test_invitation_then_acceptance(roles, make_org, make_user):
    org, user, admin = make_org(), make_user(), make_user()
    membership = services.invite_member(
        organization=org, user=user, invited_by=admin, role_codes=["field_agent"]
    )
    assert membership.status == S.INVITED and membership.joined_at is None
    services.accept_invitation(membership=membership, user=user)
    membership.refresh_from_db()
    assert membership.status == S.ACTIVE and membership.joined_at is not None


def test_only_invited_user_can_accept(roles, make_org, make_user):
    membership = services.invite_member(organization=make_org(), user=make_user(), invited_by=None)
    with pytest.raises(ValidationError):
        services.accept_invitation(membership=membership, user=make_user())


def test_cannot_accept_in_inactive_organization(roles, make_org, make_user):
    org = make_org(status=Organization.Status.PENDING)
    user = make_user()
    membership = services.invite_member(organization=org, user=user, invited_by=None)
    with pytest.raises(ValidationError):
        services.accept_invitation(membership=membership, user=user)


def test_duplicate_open_invitation_rejected(roles, make_org, make_user):
    org, user = make_org(), make_user()
    services.invite_member(organization=org, user=user, invited_by=None)
    with pytest.raises(ValidationError):
        services.invite_member(organization=org, user=user, invited_by=None)


def test_suspend_reactivate_revoke(make_member, make_org):
    org = make_org()
    user, membership = make_member(org, "field_agent")
    services.suspend_membership(membership=membership, actor=None)
    assert selectors.get_active_membership(user=user, organization_id=org.pk) is None
    services.reactivate_membership(membership=membership, actor=None)
    assert selectors.get_active_membership(user=user, organization_id=org.pk) is not None
    services.revoke_membership(membership=membership, actor=None)
    membership.refresh_from_db()
    assert membership.status == S.REVOKED and membership.ended_at is not None
    assert not membership.role_assignments.filter(revoked_at__isnull=True).exists()
    assert membership.role_assignments.count() == 1  # historique conservé


def test_revoking_one_membership_keeps_account_and_other_memberships(make_member, make_org):
    org_a, org_b = make_org("A"), make_org("B")
    user, membership_a = make_member(org_a, "field_agent")
    _, membership_b = make_member(org_b, "agronomist", user=user)
    services.revoke_membership(membership=membership_a, actor=None)
    user.refresh_from_db()
    membership_b.refresh_from_db()
    assert user.is_active and membership_b.status == S.ACTIVE


def test_invalid_transitions_rejected(make_member, make_org):
    _, membership = make_member(make_org())
    with pytest.raises(ValidationError):
        services.reactivate_membership(membership=membership, actor=None)  # déjà active
    services.revoke_membership(membership=membership, actor=None)
    with pytest.raises(ValidationError):
        services.suspend_membership(membership=membership, actor=None)  # révoquée : définitif


def test_role_revocation_keeps_history(make_member, make_org):
    _, membership = make_member(make_org(), "agronomist")
    services.revoke_role(membership=membership, role_code="agronomist", revoked_by=None)
    services.assign_role(membership=membership, role_code="agronomist", assigned_by=None)
    assert membership.role_assignments.count() == 2
    assert membership.role_assignments.filter(revoked_at__isnull=True).count() == 1


def test_archiving_organization_suspends_memberships(make_member, make_org, make_user):
    org = make_org()
    user, membership = make_member(org, "organization_admin")
    services.archive_organization(organization=org, archived_by=make_user(), reason="Fusion")
    membership.refresh_from_db()
    org.refresh_from_db()
    assert org.is_archived and membership.status == S.SUSPENDED
    assert selectors.get_active_membership(user=user, organization_id=org.pk) is None


def test_cannot_invite_into_archived_organization(make_member, make_org, make_user):
    org = make_org()
    services.archive_organization(organization=org, archived_by=None, reason="Fermeture")
    with pytest.raises(ValidationError):
        services.invite_member(organization=org, user=make_user(), invited_by=None)


def test_platform_role_requires_justification(roles, make_user):
    with pytest.raises(ValidationError):
        services.grant_platform_role(user=make_user(), granted_by=make_user(), justification=" ")


def test_platform_role_activity_window(roles, make_user):
    user, author = make_user(), make_user()
    assignment = services.grant_platform_role(
        user=user,
        granted_by=author,
        justification="Astreinte",
        valid_until=timezone.now() + timedelta(days=1),
    )
    assert selectors.has_active_platform_role(user)
    services.end_platform_role(assignment=assignment, ended_by=author)
    assert not selectors.has_active_platform_role(user)


def test_effective_permissions_are_union_of_active_roles(make_member, make_org):
    _, membership = make_member(make_org(), "cooperative_manager", "field_agent")
    codes = selectors.permission_codes_for_roles(selectors.active_role_codes(membership))
    assert codes == {"organization.view", "memberships.view"}
