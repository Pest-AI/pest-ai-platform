"""J18c : identifiant producteur PEST AI, numéro d'adhérent obligatoire et proposé, ménage."""

import pytest
from django.core.management import call_command
from django.db import DatabaseError, transaction

from apps.actors import membership_numbers, producer_code, services
from apps.actors.models import Producer, ProducerOrganizationAssignment

URL = "/api/v1/producers/"
pytestmark = pytest.mark.django_db


def _register(org, n=0, **fields):
    fields.setdefault("first_name", f"Moussa{n}")
    fields.setdefault("last_name", "Sow")
    fields.setdefault("confirm_new", True)
    return services.register_producer(organization=org, registered_by=None, **fields)


# --- Identifiant producteur -------------------------------------------------------
def test_identifiant_attribue_unique_et_immuable(make_org):
    org = make_org()
    a, b = _register(org, 1), _register(org, 2)
    assert producer_code.is_valid(a.producer_code) and a.producer_code.startswith("PRD-SN-")
    assert a.producer_code != b.producer_code
    with pytest.raises(DatabaseError), transaction.atomic():
        Producer.objects.filter(pk=a.pk).update(producer_code="PRD-SN-0000AAAA")


def test_espace_personnel_recoit_aussi_un_identifiant(make_user):
    producer = services.create_personal_profile(user=make_user(), first_name="Awa", last_name="Ba")
    assert producer_code.is_valid(producer.producer_code)


def test_saisie_humaine_normalisee():
    assert producer_code.normalize("prd sn 4k7m2x9q") == "PRD-SN-4K7M2X9Q"
    assert producer_code.normalize("PRD-SN-4K7M2X9O") == "PRD-SN-4K7M2X90"
    assert producer_code.normalize("PAI-SN-4K7M2X9Q") is None


# --- Numéro d'adhérent -------------------------------------------------------------
def test_prefixe_deduit_puis_regle(make_org):
    org = make_org("Fédération des Périmètres Irrigués de Podor", short_name="FPIP Podor")
    assert membership_numbers.prefix_for(org) == "FPIP"
    org2 = make_org("Coopérative agricole de Ross Béthio")
    assert membership_numbers.prefix_for(org2) == "RB"
    org2.member_number_prefix = "crb"
    org2.save()
    assert membership_numbers.prefix_for(org2) == "CRB"


def test_membre_numerote_automatiquement_sans_reutilisation(make_org):
    org = make_org(short_name="FPIP")
    first = _register(org, 1).assignments.get()
    second = _register(org, 2).assignments.get()
    assert (first.membership_number, second.membership_number) == ("FPIP-000001", "FPIP-000002")
    services.end_assignment(assignment=second, ended_by=None)
    assert _register(org, 3).assignments.get().membership_number == "FPIP-000003"


def test_numero_saisi_respecte_et_compteur_avance(make_org):
    org = make_org(short_name="FPIP")
    assert _register(
        org, 1, membership_number="fpip-000120"
    ).assignments.get().membership_number == ("FPIP-000120")
    assert _register(org, 2).assignments.get().membership_number == "FPIP-000121"
    assert _register(org, 3, membership_number="ANCIEN-7").assignments.get().membership_number == (
        "ANCIEN-7"
    )
    with pytest.raises(Exception, match="déjà utilisé"):
        _register(org, 4, membership_number="FPIP-000120")


def test_beneficiaire_sans_numero_et_membre_jamais_sans_numero(make_org):
    org = make_org(short_name="FPIP")
    beneficiary = _register(org, 1, relationship_type="beneficiary").assignments.get()
    assert beneficiary.membership_number is None
    member = _register(org, 2).assignments.get()
    with pytest.raises(Exception, match="toujours un numéro"):
        services.update_assignment(assignment=member, updated_by=None, membership_number="")
    services.update_assignment(assignment=beneficiary, updated_by=None, relationship_type="member")
    beneficiary.refresh_from_db()
    assert beneficiary.membership_number == "FPIP-000002"


def test_commande_de_rattrapage(make_org):
    org = make_org(short_name="FPIP")
    producer = _register(org, 1, relationship_type="beneficiary")
    ProducerOrganizationAssignment.objects.filter(producer=producer).update(
        relationship_type="member"
    )
    call_command("assign_membership_numbers", "--dry-run")
    assert producer.assignments.get().membership_number is None
    call_command("assign_membership_numbers")
    assert producer.assignments.get().membership_number == "FPIP-000001"


# --- API ------------------------------------------------------------------------------
def test_api_proposition_creation_recherche_et_menage(make_org, make_member, api):
    org = make_org(short_name="FPIP")
    agent, _ = make_member(org, "field_agent")
    client = api.as_user(agent, org)
    proposal = client.get(f"{URL}membership-number/").json()
    assert proposal == {"proposed": "FPIP-000001", "prefix": "FPIP"}

    res = client.post(
        URL,
        {
            "first_name": "Aliou",
            "last_name": "Kane",
            "household_size": 8,
            "household_farm_workers": 3,
        },
        format="json",
    )
    assert res.status_code == 201, res.json()
    body = res.json()
    assert body["assignment"]["membership_number"] == "FPIP-000001"
    assert body["household_size"] == 8 and body["household_farm_workers"] == 3
    found = client.get(URL, {"q": body["producer_code"].lower().replace("-", " ")}).json()
    assert [p["id"] for p in found["results"]] == [body["id"]]

    bad = client.post(
        URL,
        {"first_name": "A", "last_name": "B", "household_size": 2, "household_farm_workers": 5},
        format="json",
    )
    assert bad.status_code == 400 and "household_farm_workers" in bad.json()


def test_prefixe_modifiable_par_l_administrateur(make_org, make_member, api):
    org = make_org()
    admin, _ = make_member(org, "organization_admin")
    client = api.as_user(admin, org)
    assert (
        client.patch(
            "/api/v1/organization/", {"member_number_prefix": "pd 1"}, format="json"
        ).status_code
        == 400
    )
    res = client.patch("/api/v1/organization/", {"member_number_prefix": "pdr"}, format="json")
    assert res.status_code == 200 and res.json()["member_number_prefix"] == "PDR"
