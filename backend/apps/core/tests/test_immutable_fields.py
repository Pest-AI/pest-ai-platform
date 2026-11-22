"""Tests de ImmutableFieldsMixin."""

import pytest
from django.core.exceptions import ValidationError

from tests.testapp.models import SampleRecord

pytestmark = pytest.mark.django_db


def test_champ_immuable_modifiable_a_la_creation():
    record = SampleRecord.objects.create(reference="R1")

    assert record.reference == "R1"


def test_champ_immuable_refuse_apres_la_creation():
    record = SampleRecord.objects.create(reference="R1")

    record.reference = "R2"
    with pytest.raises(ValidationError) as exc:
        record.save()

    assert "reference" in exc.value.message_dict
    record.refresh_from_db()
    assert record.reference == "R1"


def test_autres_champs_restent_modifiables():
    record = SampleRecord.objects.create(reference="R1")

    record.label = "Nouveau libellé"
    record.save()

    record.refresh_from_db()
    assert record.label == "Nouveau libellé"
