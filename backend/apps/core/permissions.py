"""Permissions DRF communes.

Usage dans une vue métier :

    permission_classes = [IsAuthenticated, WorkspacePermission]
    required_permissions = {"GET": "memberships.view", "POST": "memberships.manage"}

Une méthode absente de `required_permissions` est refusée (deny by default).
"""

from rest_framework.permissions import BasePermission

from apps.core.audit import ACCESS_DENIED, security_event
from apps.core.workspace import resolve_workspace


def _required_code(view, request):
    required = getattr(view, "required_permissions", None) or {}
    action = getattr(view, "action", None)
    if action and action in required:  # clé par action de ViewSet
        return required[action]
    return required.get(request.method)


class WorkspacePermission(BasePermission):
    """Vérifie le contexte X-Workspace puis la permission requise."""

    message = "Vous n'avez pas la permission d'effectuer cette action dans cette organisation."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        context = resolve_workspace(request)  # 400 / 403 levés ici
        request.workspace = context
        code = _required_code(view, request)
        if code is None or not context.has_permission(code):
            security_event(
                ACCESS_DENIED,
                user=request.user,
                organization=context.organization,
                reason="missing_permission",
                permission=code or "-",
                path=request.path,
            )
            return False
        return True


class PlatformPermission(BasePermission):
    """Actions de portée plateforme : super_admin actif + permission platform requise."""

    message = "Action réservée au Super Admin de la plateforme."

    def has_permission(self, request, view):
        from apps.organizations import selectors

        if not request.user or not request.user.is_authenticated:
            return False
        code = _required_code(view, request)
        granted = selectors.platform_permission_codes(request.user)
        if code is None or code not in granted:
            security_event(
                ACCESS_DENIED,
                user=request.user,
                reason="platform_permission_missing",
                permission=code or "-",
                path=request.path,
            )
            return False
        return True
