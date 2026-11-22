"""Tests du mixin TENANT : rattachement immuable à une organisation."""

import pytest
from django.core.exceptions import ValidationError

from tests.testapp.models import TenantRecord

pytestmark = pytest.mark.django_db


def test_enregistrement_rattache_a_son_organisation(make_org):
    org = make_org()

    record = TenantRecord.objects.create(organization=org, label="A")

    assert record.organization == org


def test_for_organization_ne_renvoie_que_les_lignes_de_l_organisation(two_orgs):
    org_a, org_b = two_orgs
    a = TenantRecord.objects.create(organization=org_a, label="A")
    TenantRecord.objects.create(organization=org_b, label="B")

    assert list(TenantRecord.objects.for_organization(org_a)) == [a]


def test_organisation_non_modifiable_apres_creation(two_orgs):
    org_a, org_b = two_orgs
    record = TenantRecord.objects.create(organization=org_a, label="A")

    record.organization = org_b
    with pytest.raises(ValidationError) as exc:
        record.save()

    assert "organization" in exc.value.message_dict
    record.refresh_from_db()
    assert record.organization == org_a


def test_autres_champs_modifiables(make_org):
    record = TenantRecord.objects.create(organization=make_org(), label="A")

    record.label = "B"
    record.save()

    record.refresh_from_db()
    assert record.label == "B"


def test_organisation_obligatoire():
    with pytest.raises(Exception):  # noqa: B017 (IntegrityError attendue)
        TenantRecord.objects.create(label="Sans organisation")
