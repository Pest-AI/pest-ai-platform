"""Vues du compte connecté.

Ces routes concernent l'utilisateur lui-même : elles n'utilisent pas l'en-tête X-Workspace.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import services
from apps.accounts.serializers import (
    AccountActivationSerializer,
    MeSerializer,
    MyMembershipSerializer,
    PasswordChangeSerializer,
)
from apps.accounts.throttling import ActivationAttemptThrottle


class MeView(APIView):
    """GET /api/v1/me/ : profil de l'utilisateur connecté.
    PATCH /api/v1/me/ : modifier prénom, nom, e-mail, langue."""

    @extend_schema(tags=["me"], summary="Mon profil et mes adhésions", responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(request.user).data)

    @extend_schema(
        tags=["me"],
        summary="Modifier mon profil",
        request=MeSerializer,
        responses=MeSerializer,
    )
    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = services.update_profile(
            user=request.user, by=request.user, data=serializer.validated_data
        )
        return Response(MeSerializer(user).data)


class PasswordChangeView(APIView):
    """POST /api/v1/me/password/ : changer son mot de passe."""

    @extend_schema(
        tags=["me"],
        summary="Changer mon mot de passe",
        request=PasswordChangeSerializer,
        responses={204: OpenApiResponse(description="Mot de passe changé.")},
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        services.change_password(
            user=request.user, new_password=serializer.validated_data["new_password"]
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptInvitationView(APIView):
    """POST /api/v1/me/memberships/<id>/accept/ : l'invité accepte son invitation."""

    @extend_schema(
        tags=["me"],
        summary="Accepter une invitation",
        request=None,
        responses=MyMembershipSerializer,
    )
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


class AccountActivationView(APIView):
    """POST /api/v1/auth/activate/ : la personne invitée choisit son mot de passe.

    Route publique (pas de jeton), limitée en fréquence par numéro de téléphone. Le message d'erreur
    est le même quel que soit le motif, pour ne pas révéler si un numéro a un compte.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ActivationAttemptThrottle]

    @extend_schema(
        tags=["auth"],
        summary="Activer mon compte",
        description="Numéro de téléphone, code d'activation reçu du gérant et mot de passe choisi. "
        "Le code est valable 7 jours, à usage unique, annulé après 5 essais erronés.",
        request=AccountActivationSerializer,
        responses={
            204: OpenApiResponse(description="Compte activé : la personne peut se connecter."),
            400: OpenApiResponse(
                description="Numéro ou code invalide ou expiré, ou mot de passe trop faible."
            ),
            429: OpenApiResponse(description="Trop de tentatives : réessayez plus tard."),
        },
    )
    def post(self, request):
        from apps.accounts.activation import activate_account

        serializer = AccountActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            activate_account(
                phone_number=data["phone_number"],
                code=data["code"],
                new_password=data["new_password"],
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)
