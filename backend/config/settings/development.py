"""Paramètres pour le développement local."""

from .base import *  # noqa: F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)

# App terrain en local : serveur Expo (8081) et aperçu de la version publiée (4173), en HTTP.
WEB_SESSION_ALLOWED_ORIGINS = env.list(
    "WEB_SESSION_ALLOWED_ORIGINS",
    default=["http://localhost:8081", "http://localhost:4173", "http://127.0.0.1:4173"],
)
WEB_SESSION_COOKIE_SECURE = env.bool("WEB_SESSION_COOKIE_SECURE", default=False)

# GDAL < 3.9 (Postgres.app, Ubuntu 24.04) : avertissement de sécurité gis.W001.
# Toléré en local et en test uniquement. La production (Docker) utilise GDAL >= 3.9
# et ne masque pas cet avertissement. Voir ADR-0007.
SILENCED_SYSTEM_CHECKS = ["gis.W001"]
