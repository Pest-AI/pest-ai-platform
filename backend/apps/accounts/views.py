"""Vues du compte connecté.

Ces routes concernent l'utilisateur lui-même : elles n'utilisent pas l'en-tête X-Workspace.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import services
from apps.accounts.serializers import (
    MeSerializer,
    MyMembershipSerializer,
    PasswordChangeSerializer,
)


class MeView(APIView):
    """GET /api/v1/me/ : profil de l'utilisateur connecté.
    PATCH /api/v1/me/ : modifier prénom, nom, e-mail, langue."""

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = services.update_profile(
            user=request.user, by=request.user, data=serializer.validated_data
        )
        return Response(MeSerializer(user).data)


class PasswordChangeView(APIView):
    """POST /api/v1/me/password/ : changer son mot de passe."""

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        services.change_password(
            user=request.user, new_password=serializer.validated_data["new_password"]
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptInvitationView(APIView):
    """POST /api/v1/me/memberships/<id>/accept/ : l'invité accepte son invitation."""

    def post(self, request, membership_id):
        from apps.organizations import services as org_services
        from apps.organizations.models import OrganizationMembership

        # Filtré sur l'utilisateur connecté : l'invitation d'un autre renvoie 404.
        membership = get_object_or_404(
            OrganizationMembership.objects.select_related("organization"),
            pk=membership_id,
            user=request.user,
        )
        try:
            org_services.accept_invitation(membership=membership, user=request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(MyMembershipSerializer(membership).data, status=status.HTTP_200_OK)
