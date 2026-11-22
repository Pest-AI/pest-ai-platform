"""Paramètres pour les tests automatisés (pytest, CI)."""

from .base import *  # noqa: F403

DEBUG = False
# Hachage rapide : uniquement pour accélérer les tests, jamais ailleurs.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# GDAL < 3.9 (Postgres.app, Ubuntu 24.04) : avertissement de sécurité gis.W001.
# Toléré en local et en test uniquement. La production (Docker) utilise GDAL >= 3.9
# et ne masque pas cet avertissement. Voir ADR-0007.
SILENCED_SYSTEM_CHECKS = ["gis.W001"]
