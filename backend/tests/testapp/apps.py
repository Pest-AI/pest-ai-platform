from django.apps import AppConfig


class TestAppConfig(AppConfig):
    """App utilisée uniquement par les tests (jamais installée hors tests)."""

    name = "tests.testapp"
    label = "testapp"
