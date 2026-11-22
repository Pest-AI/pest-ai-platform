"""Vues des organisations et adhésions.

Deux familles :
- routes d'organisation : en-tête X-Workspace obligatoire, données limitées à
  l'organisation du contexte (WorkspacePermission) ;
- routes plateforme (/platform/...) : réservées au super_admin actif.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Prefetch
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import PlatformPermission, WorkspacePermission
from apps.organizations import constants as C
from apps.organizations import services
from apps.organizations.models import MembershipRole, Organization, OrganizationMembership
from apps.organizations.serializers import (
    ArchiveSerializer,
    InviteMemberSerializer,
    MembershipSerializer,
    OrganizationAdminSerializer,
    OrganizationSerializer,
    PlatformOrganizationSerializer,
    RoleCodeSerializer,
)


def _run(service, **kwargs):
    """Exécute un service et convertit ses erreurs métier en 400 DRF."""
    try:
        return service(**kwargs)
    except DjangoValidationError as exc:
        detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
        raise ValidationError(detail) from exc


# ---------------------------------------------------------------------------
# Routes d'organisation (X-Workspace)
# ---------------------------------------------------------------------------
class CurrentOrganizationView(generics.RetrieveUpdateAPIView):
    """GET / PATCH /api/v1/organization/ : l'organisation du contexte."""

    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, WorkspacePermission]
    required_permissions = {
        "GET": "organization.view",
        "HEAD": "organization.view",
        "OPTIONS": "organization.view",
        "PATCH": "organization.manage",
    }
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.workspace.organization

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class MembershipViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Membres de l'organisation du contexte.

    Un identifiant d'adhésion d'une autre organisation renvoie 404 : le queryset
    est toujours filtré sur l'organisation vérifiée.
    """

    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, WorkspacePermission]
    required_permissions = {
        "list": "memberships.view",
        "retrieve": "memberships.view",
        "create": "memberships.manage",
        "suspend": "memberships.manage",
        "reactivate": "memberships.manage",
        "revoke": "memberships.manage",
        "assign_role": "roles.assign",
        "revoke_role": "roles.assign",
    }

    def get_queryset(self):
        return (
            OrganizationMembership.objects.for_organization(self.request.workspace.organization)
            .select_related("user", "organization")
            .prefetch_related(
                Prefetch("role_assignments", queryset=MembershipRole.objects.select_related("role"))
            )
            .order_by("user__last_name", "user__first_name")
        )

    def create(self, request, *args, **kwargs):
        serializer = InviteMemberSerializer(data=request.data, context={})
        serializer.is_valid(raise_exception=True)
        membership = _run(
            services.invite_member,
            organization=request.workspace.organization,
            user=serializer.context["invited_user"],
            invited_by=request.user,
            role_codes=serializer.validated_data["roles"],
        )
        return Response(
            self.get_serializer(self.get_queryset().get(pk=membership.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def _respond(self, membership):
        return Response(self.get_serializer(self.get_queryset().get(pk=membership.pk)).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._respond(
            _run(services.suspend_membership, membership=self.get_object(), actor=request.user)
        )

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        return self._respond(
            _run(services.reactivate_membership, membership=self.get_object(), actor=request.user)
        )

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        return self._respond(
            _run(services.revoke_membership, membership=self.get_object(), actor=request.user)
        )

    @action(detail=True, methods=["post"], url_path="roles")
    def assign_role(self, request, pk=None):
        membership = self.get_object()
        serializer = RoleCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(
            services.assign_role,
            membership=membership,
            role_code=serializer.validated_data["role"],
            assigned_by=request.user,
        )
        return self._respond(membership)

    @action(detail=True, methods=["post"], url_path=r"roles/(?P<role_code>[a-z_]+)/revoke")
    def revoke_role(self, request, pk=None, role_code=None):
        membership = self.get_object()
        _run(
            services.revoke_role,
            membership=membership,
            role_code=role_code,
            revoked_by=request.user,
        )
        return self._respond(membership)


# ---------------------------------------------------------------------------
# Routes plateforme (super_admin)
# ---------------------------------------------------------------------------
class PlatformOrganizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestion des organisations par le Super Admin. Chaque appel est journalisé."""

    serializer_class = PlatformOrganizationSerializer
    permission_classes = [IsAuthenticated, PlatformPermission]
    queryset = Organization.objects.all().order_by("name")
    http_method_names = ["get", "post", "patch", "head", "options"]
    required_permissions = {
        "list": "platform.organizations.view",
        "retrieve": "platform.organizations.view",
        "create": "platform.organizations.manage",
        "partial_update": "platform.organizations.manage",
        "archive": "platform.organizations.manage",
        "designate_admin": "platform.organizations.manage",
    }

    def perform_create(self, serializer):
        data = serializer.validated_data
        serializer.instance = _run(
            services.create_organization, created_by=self.request.user, **data
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        serializer = ArchiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = _run(
            services.archive_organization,
            organization=self.get_object(),
            archived_by=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(self.get_serializer(organization).data)

    @action(detail=True, methods=["post"], url_path="admins")
    def designate_admin(self, request, pk=None):
        """Invite un utilisateur comme organization_admin (amorçage d'une organisation)."""
        organization = self.get_object()
        serializer = OrganizationAdminSerializer(data=request.data, context={})
        serializer.is_valid(raise_exception=True)
        membership = _run(
            services.invite_member,
            organization=organization,
            user=serializer.context["admin_user"],
            invited_by=request.user,
            role_codes=[C.ORGANIZATION_ADMIN],
        )
        membership = (
            OrganizationMembership.objects.select_related("user")
            .prefetch_related("role_assignments__role")
            .get(pk=membership.pk)
        )
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


class MyOrganizationsView(generics.ListAPIView):
    """GET /api/v1/organizations/ : organisations où l'utilisateur a une adhésion active
    (sert à choisir l'espace de travail ; aucun en-tête X-Workspace requis)."""

    serializer_class = OrganizationSerializer

    def get_queryset(self):
        return (
            Organization.objects.filter(
                memberships__user=self.request.user,
                memberships__status=OrganizationMembership.Status.ACTIVE,
            )
            .distinct()
            .order_by("name")
        )
