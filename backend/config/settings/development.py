"""Paramètres pour le développement local."""

from .base import *  # noqa: F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)

# GDAL < 3.9 (Postgres.app, Ubuntu 24.04) : avertissement de sécurité gis.W001.
# Toléré en local et en test uniquement. La production (Docker) utilise GDAL >= 3.9
# et ne masque pas cet avertissement. Voir ADR-0007.
SILENCED_SYSTEM_CHECKS = ["gis.W001"]
