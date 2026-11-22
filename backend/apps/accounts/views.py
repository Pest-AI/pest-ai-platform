"""Vues du compte connecté.

Ces routes concernent l'utilisateur lui-même : elles n'utilisent pas l'en-tête X-Workspace.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import services
from apps.accounts.serializers import MeSerializer, PasswordChangeSerializer


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
