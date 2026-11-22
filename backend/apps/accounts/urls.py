from django.urls import path
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from apps.accounts.views import AcceptInvitationView, MeView, PasswordChangeView

TokenObtain = extend_schema_view(
    post=extend_schema(
        tags=["auth"],
        summary="Se connecter",
        description="Numéro de téléphone (E.164) et mot de passe. Renvoie `access` et `refresh`.",
    )
)(TokenObtainPairView)
TokenRefresh = extend_schema_view(
    post=extend_schema(
        tags=["auth"],
        summary="Renouveler le jeton d'accès",
        description="Renvoie un nouveau `access` et un nouveau `refresh` ; l'ancien est invalidé.",
    )
)(TokenRefreshView)
TokenLogout = extend_schema_view(
    post=extend_schema(
        tags=["auth"],
        summary="Se déconnecter",
        description="Invalide le jeton `refresh` fourni.",
    )
)(TokenBlacklistView)

urlpatterns = [
    # Authentification JWT : connexion par numéro de téléphone + mot de passe.
    path("auth/token/", TokenObtain.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefresh.as_view(), name="token-refresh"),
    path("auth/logout/", TokenLogout.as_view(), name="token-logout"),
    # Compte connecté.
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", PasswordChangeView.as_view(), name="me-password"),
    path(
        "me/memberships/<uuid:membership_id>/accept/",
        AcceptInvitationView.as_view(),
        name="me-accept-invitation",
    ),
]
