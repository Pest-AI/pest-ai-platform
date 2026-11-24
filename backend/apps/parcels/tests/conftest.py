"""Tests Parcelles : la règle « relevé terrain » (option A) est neutralisée par défaut.

Les tests historiques créent leurs contours en « tracé manuel » pour éprouver d'autres
règles (surface, chevauchement, précision). Les tests de la règle elle-même la réactivent
avec le marqueur `field_survey`.
"""

import pytest
from django.conf import settings as django_settings


@pytest.fixture(autouse=True)
def _field_survey_rule(request, settings):
    rules = dict(django_settings.PARCEL_GEOMETRY_RULES)
    if request.node.get_closest_marker("field_survey") is None:
        rules["FIELD_SURVEY_REQUIRED_METHODS"] = []
    settings.PARCEL_GEOMETRY_RULES = rules


def pytest_configure(config):
    config.addinivalue_line("markers", "field_survey: active la règle du relevé terrain (option A)")
