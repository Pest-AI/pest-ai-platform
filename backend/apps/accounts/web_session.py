"""Session web de l'app terrain (PWA) : le jeton de renouvellement vit dans un cookie httpOnly.

Dans un navigateur, il n'y a pas de coffre sécurisé comme sur un téléphone. Pour qu'un
script injecté dans la page ne puisse pas voler la session :

- le jeton de renouvellement (7 jours) est posé par l'API dans un cookie `httpOnly`,
  `SameSite=Strict`, limité au chemin `/api/v1/auth/web/` : la page ne peut pas le lire et il
  n'est envoyé qu'à ces trois routes ;
- seul le jeton d'accès (15 minutes) est renvoyé à la page, qui le garde en mémoire ;
- chaque route vérifie que la requête vient d'une origine autorisée
  (`WEB_SESSION_ALLOWED_ORIGINS`), contre les formulaires envoyés depuis un autre site.

L'app est servie sur le même domaine que ces routes (Vercel relaie `/api/` vers l'API) :
le cookie est donc « de premier rang » et n'a besoin d'aucune règle CORS.
"""

import contextlib

from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.throttling import LoginAttemptThrottle

COOKIE_PATH = "/api/v1/auth/web/"

AccessOnly = inline_serializer(name="WebAccessToken", fields={"access": serializers.CharField()})


def _cookie_name() -> str:
    return settings.WEB_SESSION_COOKIE_NAME


def _origin_allowed(request) -> bool:
    origin = request.headers.get("Origin")
    return bool(origin) and origin in settings.WEB_SESSION_ALLOWED_ORIGINS


def _forbidden() -> Response:
    return Response({"detail": "Origine non autorisée."}, status=status.HTTP_403_FORBIDDEN)


def _set_refresh_cookie(response: Response, refresh: str) -> None:
    response.set_cookie(
        _cookie_name(),
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=COOKIE_PATH,
        secure=settings.WEB_SESSION_COOKIE_SECURE,
        httponly=True,
        samesite="Strict",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(_cookie_name(), path=COOKIE_PATH, samesite="Strict")


class _WebSessionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticate_header(self, request):
        # Sans classe d'authentification, DRF transformerait les 401 en 403.
        return 'Bearer realm="api"'

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.origin_ok = _origin_allowed(request)


class WebLoginView(_WebSessionView):
    """POST /api/v1/auth/web/token/ : connexion depuis l'app terrain (navigateur)."""

    throttle_classes = [LoginAttemptThrottle]

    @extend_schema(
        tags=["auth"],
        summary="Se connecter (app terrain, navigateur)",
        description=(
            "Comme `POST /api/v1/auth/token/`, mais le jeton de renouvellement est posé dans un "
            "cookie httpOnly et seul `access` est renvoyé. Réservé aux origines autorisées."
        ),
        request=inline_serializer(
            name="WebLoginRequest",
            fields={"phone_number": serializers.CharField(), "password": serializers.CharField()},
        ),
        responses={
            200: AccessOnly,
            401: OpenApiResponse(description="Identifiants incorrects."),
            403: OpenApiResponse(description="Origine non autorisée."),
            429: OpenApiResponse(description="Trop de tentatives pour ce numéro."),
        },
    )
    def post(self, request):
        if not self.origin_ok:
            return _forbidden()
        serializer = TokenObtainPairSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc
        tokens = serializer.validated_data
        response = Response({"access": tokens["access"]})
        _set_refresh_cookie(response, tokens["refresh"])
        return response


class WebRefreshView(_WebSessionView):
    """POST /api/v1/auth/web/refresh/ : nouveau jeton d'accès à partir du cookie."""

    @extend_schema(
        tags=["auth"],
        summary="Renouveler le jeton d'accès (app terrain, navigateur)",
        description=(
            "Lit le cookie de session, renvoie un nouveau `access` et remplace le cookie "
            "(l'ancien jeton est mis sur liste noire). Sans cookie valide : 401 et cookie effacé."
        ),
        request=None,
        responses={
            200: AccessOnly,
            401: OpenApiResponse(description="Pas de session valide."),
            403: OpenApiResponse(description="Origine non autorisée."),
        },
    )
    def post(self, request):
        if not self.origin_ok:
            return _forbidden()
        refresh = request.COOKIES.get(_cookie_name())
        if not refresh:
            return Response({"detail": "Aucune session."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = TokenRefreshSerializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken):
            response = Response({"detail": "Session expirée."}, status=status.HTTP_401_UNAUTHORIZED)
            _clear_refresh_cookie(response)
            return response
        data = serializer.validated_data
        response = Response({"access": data["access"]})
        _set_refresh_cookie(response, data.get("refresh", refresh))
        return response


class WebLogoutView(_WebSessionView):
    """POST /api/v1/auth/web/logout/ : révoque le jeton du cookie et efface le cookie."""

    @extend_schema(
        tags=["auth"],
        summary="Se déconnecter (app terrain, navigateur)",
        request=None,
        responses={
            204: OpenApiResponse(description="Session fermée."),
            403: OpenApiResponse(description="Origine non autorisée."),
        },
    )
    def post(self, request):
        if not self.origin_ok:
            return _forbidden()
        refresh = request.COOKIES.get(_cookie_name())
        if refresh:
            # Jeton déjà expiré ou révoqué : rien à faire.
            with contextlib.suppress(TokenError):
                RefreshToken(refresh).blacklist()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response
