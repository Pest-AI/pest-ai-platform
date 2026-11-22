"""Vérifie que GeoDjango trouve les bibliothèques GDAL et GEOS de la machine."""

from django.contrib.gis.gdal import gdal_version
from django.contrib.gis.geos import Point, geos_version


def test_gdal_est_charge():
    assert gdal_version()


def test_geos_calcule_une_geometrie():
    assert geos_version()
    # Point à Saint-Louis (Vallée du Fleuve Sénégal), en WGS 84.
    point = Point(-16.4896, 16.0179, srid=4326)
    assert point.buffer(1).area > 3
