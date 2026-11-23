"""Écritures métier : seule voie de modification des adhésions et des rôles.

Chaque fonction applique les règles du Database Design v2.2 et lève
`django.core.exceptions.ValidationError` en cas de violation.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.audit import MEMBERSHIP_CHANGE, ORGANIZATION_CHANGE, ROLE_CHANGE, security_event
from apps.organizations import constants as C
from apps.organizations.models import (
    MembershipRole,
    Organization,
    OrganizationMembership,
    Permission,
    PlatformRoleAssignment,
    Role,
    RolePermission,
)

Status = OrganizationMembership.Status


# ---------------------------------------------------------------------------
# Référentiel des rôles
# ---------------------------------------------------------------------------
@transaction.atomic
def sync_system_roles() -> None:
    """Crée ou met à jour les 7 rôles, le catalogue de permissions et la matrice. Idempotent."""
    roles = {}
    for code, name, scope, description in C.SYSTEM_ROLES:
        role, _ = Role.objects.update_or_create(
            code=code,
            defaults={"name": name, "scope": scope, "description": description, "is_system": True},
        )
        roles[code] = role
    permissions = {}
    for code, domain, scope, description in C.PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={"domain": domain, "scope": scope, "description": description},
        )
        permissions[code] = permission
    for role_code, permission_codes in C.ROLE_PERMISSIONS.items():
        role = roles[role_code]
        wanted = {permissions[p].pk for p in permission_codes}
        RolePermission.objects.filter(role=role).exclude(permission_id__in=wanted).delete()
        for permission_id in wanted:
            RolePermission.objects.get_or_create(role=role, permission_id=permission_id)


def get_role(code: str) -> Role:
    try:
        return Role.objects.get(code=code, is_system=True)
    except Role.DoesNotExist as exc:
        raise ValidationError({"role": f"Rôle inconnu : {code}."}) from exc


# ---------------------------------------------------------------------------
# Organisations (portée plateforme)
# ---------------------------------------------------------------------------
@transaction.atomic
def create_organization(*, created_by, **fields) -> Organization:
    organization = Organization(created_by=created_by, updated_by=created_by, **fields)
    organization.full_clean()
    organization.save()
    security_event(
        ORGANIZATION_CHANGE, user=created_by, organization=organization, change="created"
    )
    return organization


@transaction.atomic
def archive_organization(*, organization: Organization, archived_by, reason: str) -> Organization:
    """Archive l'organisation : données conservées, adhésions actives suspendues."""
    if organization.is_archived:
        raise ValidationError("Cette organisation est déjà archivée.")
    now = timezone.now()
    organization.is_archived = True
    organization.archived_at = now
    organization.archived_by = archived_by
    organization.archive_reason = reason
    organization.updated_by = archived_by
    organization.save()
    OrganizationMembership.objects.filter(organization=organization, status=Status.ACTIVE).update(
        status=Status.SUSPENDED,
        updated_at=now,
        updated_by=archived_by,
    )
    security_event(
        ORGANIZATION_CHANGE, user=archived_by, organization=organization, change="archived"
    )
    return organization


# ---------------------------------------------------------------------------
# Adhésions
# ---------------------------------------------------------------------------
@transaction.atomic
def invite_member(
    *, organization: Organization, user, invited_by, role_codes=()
) -> OrganizationMembership:
    """Crée une adhésion « invited » et, le cas échéant, ses rôles d'organisation."""
    if organization.is_archived or organization.status == Organization.Status.CLOSED:
        raise ValidationError(
            "Impossible d'inviter un membre dans une organisation archivée ou fermée."
        )
    if (
        OrganizationMembership.objects.not_revoked()
        .filter(user=user, organization=organization)
        .exists()
    ):
        raise ValidationError(
            "Cet utilisateur a déjà une adhésion en cours dans cette organisation."
        )
    membership = OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        status=Status.INVITED,
        invited_by=invited_by,
        created_by=invited_by,
        updated_by=invited_by,
    )
    for code in role_codes:
        assign_role(membership=membership, role_code=code, assigned_by=invited_by)
    security_event(
        MEMBERSHIP_CHANGE,
        user=invited_by,
        organization=organization,
        change="invited",
        member_id=user.pk,
    )
    return membership


@transaction.atomic
def invite_by_phone(
    *,
    organization: Organization,
    phone_number: str,
    invited_by,
    first_name: str = "",
    last_name: str = "",
    role_codes=(),
):
    """Invite une personne par son numéro, en créant son compte si elle n'en a pas.

    Renvoie (adhésion, code d'activation en clair ou None). Un code est émis quand le
    compte n'a pas encore de mot de passe (compte créé ici, ou invitation précédente
    jamais activée).
    """
    from django.contrib.auth import get_user_model

    from apps.accounts.activation import issue_activation_code

    User = get_user_model()
    user = User.objects.filter(phone_number=phone_number).first()
    if user is not None and not user.is_active:
        raise ValidationError("Ce compte est désactivé : contactez PEST AI.")
    if user is None:
        if not first_name.strip() or not last_name.strip():
            raise ValidationError(
                {
                    "first_name": "Aucun compte pour ce numéro : indiquez le prénom et le nom "
                    "pour le créer."
                }
            )
        user = User.objects.create_user(
            phone_number,
            password=None,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            created_by=invited_by,
            updated_by=invited_by,
        )
    membership = invite_member(
        organization=organization, user=user, invited_by=invited_by, role_codes=role_codes
    )
    code = None
    if not user.has_usable_password():
        code, _ = issue_activation_code(user=user, issued_by=invited_by)
    return membership, code


def _set_status(membership, *, allowed_from, new_status, actor, **extra):
    if membership.status not in allowed_from:
        raise ValidationError(f"Transition impossible : {membership.status} -> {new_status}.")
    membership.status = new_status
    membership.updated_by = actor
    for key, value in extra.items():
        setattr(membership, key, value)
    membership.save()
    security_event(
        MEMBERSHIP_CHANGE,
        user=actor,
        organization=membership.organization,
        change=new_status,
        membership_id=membership.pk,
    )
    return membership


@transaction.atomic
def accept_invitation(*, membership: OrganizationMembership, user) -> OrganizationMembership:
    """L'utilisateur invité accepte lui-même son invitation."""
    if membership.user_id != user.pk:
        raise ValidationError("Seul l'utilisateur invité peut accepter cette invitation.")
    if not membership.organization.is_operational:
        raise ValidationError("L'organisation n'est pas active.")
    return _set_status(
        membership,
        allowed_from={Status.INVITED},
        new_status=Status.ACTIVE,
        actor=user,
        joined_at=timezone.now(),
    )


@transaction.atomic
def suspend_membership(*, membership, actor):
    return _set_status(
        membership, allowed_from={Status.ACTIVE}, new_status=Status.SUSPENDED, actor=actor
    )


@transaction.atomic
def reactivate_membership(*, membership, actor):
    if not membership.organization.is_operational:
        raise ValidationError("L'organisation n'est pas active.")
    return _set_status(
        membership, allowed_from={Status.SUSPENDED}, new_status=Status.ACTIVE, actor=actor
    )


@transaction.atomic
def revoke_membership(*, membership, actor):
    """Révoque l'adhésion (ligne conservée) et clôt ses rôles actifs. Le compte n'est pas touché."""
    now = timezone.now()
    _set_status(
        membership,
        allowed_from={Status.INVITED, Status.ACTIVE, Status.SUSPENDED},
        new_status=Status.REVOKED,
        actor=actor,
        ended_at=now,
    )
    MembershipRole.objects.active().filter(membership=membership).update(
        revoked_at=now, updated_at=now, updated_by=actor
    )
    return membership


# ---------------------------------------------------------------------------
# Rôles d'adhésion
# ---------------------------------------------------------------------------
@transaction.atomic
def assign_role(
    *, membership: OrganizationMembership, role_code: str, assigned_by
) -> MembershipRole:
    role = get_role(role_code)
    if role.scope != C.SCOPE_ORGANIZATION:
        raise ValidationError(
            {"role": "super_admin ne s'attribue jamais par une adhésion (PlatformRoleAssignment)."}
        )
    if role.code == C.PRODUCER:
        # v2.2 : le rôle producer exige un profil Producer, lié au compte de ce membre,
        # avec un ProducerOrganizationAssignment actif dans cette organisation.
        from apps.actors.selectors import has_active_assignment

        if not has_active_assignment(user=membership.user, organization=membership.organization):
            raise ValidationError(
                {
                    "role": "Le rôle producteur exige une fiche producteur liée à ce compte et "
                    "rattachée à cette organisation."
                }
            )
    if membership.status == Status.REVOKED:
        raise ValidationError("Impossible d'attribuer un rôle sur une adhésion révoquée.")
    if MembershipRole.objects.active().filter(membership=membership, role=role).exists():
        raise ValidationError({"role": "Ce rôle est déjà actif pour cette adhésion."})
    assignment = MembershipRole.objects.create(
        membership=membership,
        role=role,
        assigned_by=assigned_by,
        created_by=assigned_by,
        updated_by=assigned_by,
    )
    security_event(
        ROLE_CHANGE,
        user=assigned_by,
        organization=membership.organization,
        change="assigned",
        role=role.code,
        membership_id=membership.pk,
    )
    return assignment


@transaction.atomic
def revoke_role(
    *, membership: OrganizationMembership, role_code: str, revoked_by
) -> MembershipRole:
    assignment = (
        MembershipRole.objects.active().filter(membership=membership, role__code=role_code).first()
    )
    if assignment is None:
        raise ValidationError({"role": "Aucun rôle actif de ce type sur cette adhésion."})
    assignment.revoked_at = timezone.now()
    assignment.updated_by = revoked_by
    assignment.save(update_fields=["revoked_at", "updated_by", "updated_at"])
    security_event(
        ROLE_CHANGE,
        user=revoked_by,
        organization=membership.organization,
        change="revoked",
        role=role_code,
        membership_id=membership.pk,
    )
    return assignment


# ---------------------------------------------------------------------------
# Rôle plateforme
# ---------------------------------------------------------------------------
@transaction.atomic
def grant_platform_role(
    *, user, granted_by, justification: str, valid_until=None
) -> PlatformRoleAssignment:
    """Attribue super_admin (seul rôle de portée platform). Justification obligatoire."""
    if not justification or not justification.strip():
        raise ValidationError({"justification": "Une justification est obligatoire."})
    role = get_role(C.SUPER_ADMIN)
    if PlatformRoleAssignment.objects.active().filter(user=user, role=role).exists():
        raise ValidationError("Cet utilisateur a déjà un rôle super_admin actif.")
    assignment = PlatformRoleAssignment.objects.create(
        user=user,
        role=role,
        granted_by=granted_by,
        justification=justification.strip(),
        valid_until=valid_until,
        created_by=granted_by,
        updated_by=granted_by,
    )
    security_event(ROLE_CHANGE, user=granted_by, change="platform_granted", grantee_id=user.pk)
    return assignment


@transaction.atomic
def end_platform_role(*, assignment: PlatformRoleAssignment, ended_by) -> PlatformRoleAssignment:
    now = timezone.now()
    if assignment.valid_until is not None and assignment.valid_until <= now:
        raise ValidationError("Cette attribution est déjà terminée.")
    assignment.valid_until = now
    assignment.updated_by = ended_by
    assignment.save(update_fields=["valid_until", "updated_by", "updated_at"])
    security_event(
        ROLE_CHANGE, user=ended_by, change="platform_ended", grantee_id=assignment.user_id
    )
    return assignment
