"""Lectures en base utilisées par le contrôle d'accès (aucune écriture ici)."""

from apps.organizations import constants as C
from apps.organizations.models import (
    MembershipRole,
    Organization,
    OrganizationMembership,
    Permission,
    PlatformRoleAssignment,
)

# Permissions accordées à un super_admin qui CONSULTE une organisation sans en être membre.
PLATFORM_READ_PERMISSIONS = ("organization.view", "memberships.view")


def get_active_membership(*, user, organization_id):
    """Adhésion ACTIVE de l'utilisateur dans une organisation active et non archivée."""
    return (
        OrganizationMembership.objects.select_related("organization")
        .filter(
            user=user,
            organization_id=organization_id,
            status=OrganizationMembership.Status.ACTIVE,
            organization__status=Organization.Status.ACTIVE,
            organization__is_archived=False,
            user__is_active=True,
        )
        .first()
    )


def active_role_codes(membership) -> list[str]:
    return list(
        MembershipRole.objects.active()
        .filter(membership=membership)
        .values_list("role__code", flat=True)
    )


def permission_codes_for_roles(role_codes) -> set[str]:
    """Union des permissions des rôles actifs (jamais de portée personal)."""
    return set(
        Permission.objects.filter(roles__code__in=list(role_codes))
        .exclude(scope=C.SCOPE_PERSONAL)
        .values_list("code", flat=True)
    )


def active_platform_assignments(user):
    return PlatformRoleAssignment.objects.active().filter(
        user=user,
        user__is_active=True,
        role__code=C.SUPER_ADMIN,
        role__is_system=True,
    )


def has_active_platform_role(user) -> bool:
    return active_platform_assignments(user).exists()


def platform_permission_codes(user) -> set[str]:
    if not has_active_platform_role(user):
        return set()
    return set(
        Permission.objects.filter(roles__code=C.SUPER_ADMIN, scope=C.SCOPE_PLATFORM).values_list(
            "code", flat=True
        )
    )


def get_organization_for_platform(organization_id):
    return Organization.objects.filter(pk=organization_id).first()


def memberships_of_user(user):
    """Adhésions non révoquées d'un utilisateur (pour /me et le choix d'espace)."""
    return (
        OrganizationMembership.objects.not_revoked()
        .filter(user=user)
        .select_related("organization")
        .prefetch_related("role_assignments__role")
        .order_by("organization__name")
    )
