"""Vérifie la connexion réelle à PostgreSQL et la présence de PostGIS."""

import pytest
from django.db import connection

pytestmark = pytest.mark.django_db


def test_postgis_est_disponible():
    with connection.cursor() as cursor:
        cursor.execute("SELECT postgis_version()")
        version = cursor.fetchone()[0]

    assert version.startswith("3.")


def test_postgresql_version_16_ou_plus():
    assert connection.pg_version >= 160000
