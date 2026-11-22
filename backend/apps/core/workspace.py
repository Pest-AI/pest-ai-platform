"""Contexte d'espace de chaque requête (décision D-01).

L'en-tête `X-Workspace` vaut `org:<uuid>` ou `personal`. Il désigne l'espace
dans lequel l'utilisateur agit mais n'est JAMAIS une preuve : le serveur vérifie
l'adhésion active et charge les rôles de cette seule organisation.

- en-tête absent ou mal formé  -> 400
- espace non autorisé          -> 403 (journalisé)
- objet d'une autre organisation dans l'URL -> 404 (querysets filtrés)

Note technique : la vérification est faite dans une permission DRF et non dans
un middleware Django, car l'utilisateur JWT n'est connu qu'au niveau de DRF.
C'est toujours un mécanisme unique, partagé par toutes les vues métier.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from rest_framework.exceptions import ParseError, PermissionDenied

from apps.core.audit import ACCESS_DENIED, CROSS_ORG_ACCESS, security_event

HEADER = "X-Workspace"
ORG_PREFIX = "org:"
PERSONAL = "personal"


@dataclass(frozen=True)
class WorkspaceContext:
    """Espace vérifié de la requête, disponible dans `request.workspace`."""

    kind: str  # "organization" ou "personal"
    organization: object | None = None
    membership: object | None = None
    role_codes: frozenset[str] = field(default_factory=frozenset)
    permission_codes: frozenset[str] = field(default_factory=frozenset)
    is_platform_access: bool = False  # lecture exceptionnelle d'un super_admin

    def has_permission(self, code: str) -> bool:
        return code in self.permission_codes


def parse_header(raw: str | None) -> tuple[str, uuid.UUID | None]:
    """Valide la forme de l'en-tête et renvoie (type, uuid d'organisation)."""
    if raw is None or not raw.strip():
        raise ParseError(f"L'en-tête {HEADER} est obligatoire (« org:<uuid> » ou « personal »).")
    value = raw.strip()
    if value == PERSONAL:
        return PERSONAL, None
    if value.startswith(ORG_PREFIX):
        try:
            return "organization", uuid.UUID(value[len(ORG_PREFIX) :])
        except ValueError:
            pass
    raise ParseError(f"En-tête {HEADER} invalide : attendu « org:<uuid> » ou « personal ».")


def resolve_workspace(request) -> WorkspaceContext:
    """Construit le contexte vérifié de la requête ou lève 400 / 403."""
    # Import local : évite une dépendance circulaire core -> organizations au chargement.
    from apps.organizations import selectors

    kind, organization_id = parse_header(request.headers.get(HEADER))
    user = request.user

    if kind == PERSONAL:
        # L'espace personnel exige un profil Producer actif (domaine Producteurs,
        # mission ultérieure). Aucun compte n'en possède encore : refus explicite.
        security_event(ACCESS_DENIED, user=user, reason="personal_workspace_unavailable")
        raise PermissionDenied("Aucun profil producteur actif n'est associé à ce compte.")

    membership = selectors.get_active_membership(user=user, organization_id=organization_id)
    if membership is not None:
        roles = selectors.active_role_codes(membership)
        return WorkspaceContext(
            kind="organization",
            organization=membership.organization,
            membership=membership,
            role_codes=frozenset(roles),
            permission_codes=frozenset(selectors.permission_codes_for_roles(roles)),
        )

    # Exception contrôlée (section 9.7) : un super_admin actif peut CONSULTER
    # une organisation sans en être membre. Lecture seule, toujours journalisée.
    if request.method in ("GET", "HEAD", "OPTIONS") and selectors.has_active_platform_role(user):
        organization = selectors.get_organization_for_platform(organization_id)
        if organization is not None:
            security_event(
                CROSS_ORG_ACCESS,
                user=user,
                organization=organization,
                method=request.method,
                path=request.path,
            )
            return WorkspaceContext(
                kind="organization",
                organization=organization,
                permission_codes=frozenset(selectors.PLATFORM_READ_PERMISSIONS),
                is_platform_access=True,
            )

    security_event(
        ACCESS_DENIED,
        user=user,
        reason="no_active_membership",
        requested_organization_id=organization_id,
        path=request.path,
    )
    raise PermissionDenied("Vous n'avez pas d'adhésion active dans cette organisation.")
