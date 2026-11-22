"""Tests de la documentation de l'API (schéma OpenAPI et référence interactive)."""

import pytest
import yaml
from django.urls import reverse

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema(client):
    response = client.get(reverse("api-schema"))
    assert response.status_code == 200
    return yaml.safe_load(response.content)


def test_schema_accessible_sans_authentification(client):
    assert client.get(reverse("api-schema")).status_code == 200


def test_schema_decrit_les_routes_principales(schema):
    for path in ["/api/v1/auth/token/", "/api/v1/me/", "/api/v1/memberships/"]:
        assert path in schema["paths"]


def test_x_workspace_documente_sur_les_routes_d_organisation(schema):
    parameters = schema["paths"]["/api/v1/memberships/"]["get"]["parameters"]

    header = next(p for p in parameters if p["name"] == "X-Workspace")
    assert header["in"] == "header"
    assert header["required"] is True


def test_x_workspace_absent_des_routes_personnelles(schema):
    parameters = schema["paths"]["/api/v1/me/"]["get"].get("parameters", [])

    assert all(p["name"] != "X-Workspace" for p in parameters)


def test_authentification_bearer_declaree(schema):
    assert "jwtAuth" in schema["components"]["securitySchemes"]


def test_page_de_reference_interactive(client):
    response = client.get(reverse("api-docs"))

    assert response.status_code == 200
    assert b"api-reference" in response.content
