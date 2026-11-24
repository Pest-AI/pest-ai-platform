"""Option A (24/11/2026) : contour tracé à la main ou importé, « à confirmer » sur le terrain."""

import pytest

from apps.parcels import imports, selectors, services
from apps.parcels.tests.test_import import geojson, kml, ring
from apps.parcels.tests.test_parcels import LON, square

pytestmark = [pytest.mark.django_db, pytest.mark.field_survey]


@pytest.fixture
def org(make_org):
    return make_org("Coopérative de Guédé")


@pytest.fixture
def user(org, make_member):
    return make_member(org, "organization_admin")[0]


def test_trace_manuel_a_confirmer(org, user):
    p = services.create_parcel(by=user, organization=org, geometry=square())
    geom = selectors.current_geometry(p)
    assert geom.validation_status == "flagged"
    assert "field_survey_required" in geom.validation_report["flags"]
    p.refresh_from_db()
    assert p.status == "pending_validation" and p.agroid


def test_releve_gps_valide_directement(org, user):
    p = services.create_parcel(
        by=user, organization=org, geometry=square(), capture_method="gps_walk", gps_accuracy_m=4
    )
    assert selectors.current_geometry(p).validation_status == "valid"


def test_nouveau_releve_gps_confirme_la_parcelle(org, user):
    p = services.create_parcel(by=user, organization=org, geometry=square())
    services.add_geometry(p, square(), by=user, capture_method="gps_walk", gps_accuracy_m=3)
    p.refresh_from_db()
    assert p.status == "active"


def test_import_a_confirmer(org, user):
    record, rows = imports.start_import(
        organization=org, by=user, file_name="c.kml", data=kml([("A", ring())])
    )
    assert rows[0]["status"] == "ok"  # la ligne reste importable sans case à cocher
    imports.commit(record, by=user)
    parcel = record.parcels.get()
    assert parcel.status == "pending_validation"
    assert "field_survey_required" in selectors.current_geometry(parcel).validation_report["flags"]


def test_point_sans_contour_reste_actif(org, user):
    data = geojson([({"nom": "P"}, {"type": "Point", "coordinates": [LON, 16.6]})])
    record, _ = imports.start_import(organization=org, by=user, file_name="p.geojson", data=data)
    imports.commit(record, by=user)
    assert record.parcels.get().status == "active"


def test_coordonnees_saisies_a_confirmer(org, user):
    p = services.create_parcel(
        by=user, organization=org, geometry=square(), capture_method="manual_coordinates"
    )
    assert selectors.current_geometry(p).validation_status == "flagged"
