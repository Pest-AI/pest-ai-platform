"""Domaine Producteurs : modèle, services, API, espace personnel (J9)."""

import datetime

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.actors import services
from apps.actors.models import Producer, ProducerOrganizationAssignment
from apps.organizations import services as org_services

URL = "/api/v1/producers/"


def _register(org, by=None, **fields):
    fields.setdefault("first_name", "Moussa")
    fields.setdefault("last_name", "Sow")
    fields.setdefault("locality_text", "Guédé")
    return services.register_producer(organization=org, registered_by=by, **fields)


# --- Modèle -----------------------------------------------------------------------
def test_organization_channel_requires_organization(db):
    with pytest.raises(IntegrityError), transaction.atomic():
        Producer.objects.create(first_name="A", last_name="B", registration_channel="organization")


def test_self_signup_requires_account_and_no_organization(make_org, make_user):
    with pytest.raises(IntegrityError), transaction.atomic():
        Producer.objects.create(first_name="A", last_name="B", registration_channel="self_signup")
    with pytest.raises(IntegrityError), transaction.atomic():
        Producer.objects.create(
            first_name="A",
            last_name="B",
            registration_channel="self_signup",
            user=make_user(),
            registered_by_organization=make_org(),
        )


def test_one_open_assignment_per_organization(make_org):
    org = make_org()
    producer = _register(org)
    with pytest.raises(IntegrityError), transaction.atomic():
        ProducerOrganizationAssignment.objects.create(
            producer=producer, organization=org, start_date=datetime.date.today()
        )


def test_assignment_history_is_kept(make_org):
    org = make_org()
    producer = _register(org)
    assignment = producer.assignments.get()
    services.end_assignment(assignment=assignment, ended_by=None)
    services.attach_producer(producer=producer, organization=org, attached_by=None)
    assert producer.assignments.count() == 2
    assert producer.assignments.filter(end_date__isnull=True).count() == 1


# --- Services ---------------------------------------------------------------------
def test_register_creates_profile_contact_and_assignment(make_org):
    org = make_org()
    producer = _register(org, phone_number="+221771112233", membership_number="A-12")
    assert producer.registration_channel == "organization"
    assert producer.registered_by_organization == org
    assert producer.user is None  # cas A : sans compte
    assert producer.contacts.get(is_primary=True).value == "+221771112233"
    assert producer.assignments.get().membership_number == "A-12"


def test_duplicate_detected_by_phone_or_name_and_locality(make_org):
    org = make_org()
    _register(org, phone_number="+221771112233")
    with pytest.raises(services.DuplicateProducerError):
        _register(org, first_name="Autre", last_name="Nom", phone_number="+221771112233")
    with pytest.raises(services.DuplicateProducerError):
        _register(org, locality_text=" guédé ")
    # Confirmation explicite : nouvelle fiche créée malgré tout.
    assert _register(org, confirm_new=True).pk


def test_independent_producer_cannot_be_attached_without_consent(make_org, make_user):
    independent = services.create_personal_profile(
        user=make_user(), first_name="Fatou", last_name="Ba"
    )
    with pytest.raises(ValidationError):
        services.attach_producer(producer=independent, organization=make_org(), attached_by=None)


def test_membership_number_unique_within_organization(make_org):
    org = make_org()
    _register(org, membership_number="X1")
    with pytest.raises(ValidationError):
        _register(org, first_name="Awa", last_name="Diop", membership_number="X1", confirm_new=True)


def test_producer_role_requires_attached_profile(make_org, make_member):
    org = make_org()
    user, membership = make_member(org)
    with pytest.raises(ValidationError):
        org_services.assign_role(membership=membership, role_code="producer", assigned_by=None)
    producer = _register(org)
    producer.user = user
    producer.save()
    org_services.assign_role(membership=membership, role_code="producer", assigned_by=None)
    # Fin du rattachement : le rôle producteur est retiré.
    services.end_assignment(assignment=producer.assignments.get(), ended_by=None)
    assert not membership.role_assignments.filter(
        role__code="producer", revoked_at__isnull=True
    ).exists()


# --- API : droits et isolation ------------------------------------------------------
@pytest.mark.parametrize(
    ("role", "can_view", "can_create", "can_manage"),
    [
        ("organization_admin", True, True, True),
        ("cooperative_manager", True, True, True),
        ("field_agent", True, True, False),
        ("agronomist", True, False, False),
        ("producer_like_member", False, False, False),
    ],
)
def test_permission_matrix(role, can_view, can_create, can_manage, make_org, make_member, api):
    org = make_org()
    producer = _register(org)
    roles = () if role == "producer_like_member" else (role,)
    user, _ = make_member(org, *roles)
    client = api.as_user(user, org)
    assert (client.get(URL).status_code == 200) is can_view
    created = client.post(URL, {"first_name": "Awa", "last_name": "Ndiaye"}, format="json")
    assert (created.status_code == 201) is can_create
    patched = client.patch(f"{URL}{producer.pk}/", {"locality_text": "Podor"}, format="json")
    assert (patched.status_code == 200) is can_manage


def test_other_organization_producer_is_404(two_orgs, make_member, api):
    org_a, org_b = two_orgs
    producer_b = _register(org_b)
    admin_a, _ = make_member(org_a, "organization_admin")
    client = api.as_user(admin_a, org_a)
    assert client.get(f"{URL}{producer_b.pk}/").status_code == 404
    assert client.get(URL).json()["count"] == 0


def test_detached_producer_disappears_but_history_stays(make_org, make_member, api):
    org = make_org()
    producer = _register(org)
    admin, _ = make_member(org, "organization_admin")
    client = api.as_user(admin, org)
    assert client.post(f"{URL}{producer.pk}/detach/", {}, format="json").status_code == 204
    assert client.get(f"{URL}{producer.pk}/").status_code == 404
    assert producer.assignments.get().end_date == datetime.date.today()


# --- API : création, doublons, rattachement -----------------------------------------
def test_create_and_search(make_org, make_member, api):
    org = make_org()
    agent, _ = make_member(org, "field_agent")
    client = api.as_user(agent, org)
    response = client.post(
        URL,
        {
            "first_name": "Aïssatou",
            "last_name": "Diallo",
            "sex": "female",
            "birth_year": 1985,
            "locality_text": "Donaye",
            "phone_number": "+221 77 523 44 12",
            "membership_number": "PDR-0042",
        },
        format="json",
    )
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["phone_number"] == "+221775234412"
    assert body["assignment"]["membership_number"] == "PDR-0042"
    assert body["has_account"] is False
    assert client.get(URL, {"q": "donaye"}).json()["count"] == 1
    assert client.get(URL, {"q": "PDR-0042"}).json()["count"] == 1
    assert client.get(URL, {"q": "zzz"}).json()["count"] == 0


def test_duplicate_returns_409_with_minimal_info_then_attach(two_orgs, make_member, api):
    org_a, org_b = two_orgs
    _register(org_b, first_name="Oumar", last_name="Tall", phone_number="+221707782164")
    admin_a, _ = make_member(org_a, "organization_admin")
    client = api.as_user(admin_a, org_a)
    response = client.post(
        URL,
        {"first_name": "Oumar", "last_name": "Tall", "phone_number": "+221707782164"},
        format="json",
    )
    assert response.status_code == 409
    candidate = response.json()["candidates"][0]
    assert candidate["display_name"] == "Oumar T."  # minimisation hors de l'organisation
    assert candidate["phone_hint"] == "•• 64"
    assert candidate["can_attach"] is True and candidate["in_organization"] is False
    attached = client.post(f"{URL}attach/", {"producer_id": candidate["id"]}, format="json")
    assert attached.status_code == 201
    assert client.get(URL).json()["count"] == 1


def test_organization_cannot_edit_independent_producer(make_org, make_member, make_user, api):
    org = make_org()
    independent = services.create_personal_profile(
        user=make_user(), first_name="Fatou", last_name="Ba"
    )
    # Un rattachement existant (créé avec son accord, à venir) ne donne pas
    # le droit de modifier son profil.
    ProducerOrganizationAssignment.objects.create(
        producer=independent, organization=org, start_date=datetime.date.today()
    )
    admin, _ = make_member(org, "organization_admin")
    response = api.as_user(admin, org).patch(
        f"{URL}{independent.pk}/", {"first_name": "X"}, format="json"
    )
    assert response.status_code == 400


# --- Espace personnel (cas B) ------------------------------------------------------
def test_personal_workspace_opens_with_producer_profile(make_user, api):
    user = make_user()
    client = api.as_user(user, "personal")
    assert client.get("/api/v1/workspace/").status_code == 403
    assert (
        client.post(
            "/api/v1/me/producer/", {"first_name": "Fatou", "last_name": "Ba"}, format="json"
        ).status_code
        == 201
    )
    context = client.get("/api/v1/workspace/").json()
    assert context["kind"] == "personal"
    assert "personal.parcels.register" in context["permissions"]
    assert context["roles"] == []
    # Les droits personnels n'ouvrent aucune route d'organisation.
    assert client.get("/api/v1/organization/").status_code == 403
    assert client.get(URL).status_code == 403


def test_one_personal_profile_per_account(make_user, api):
    client = api.as_user(make_user())
    payload = {"first_name": "Fatou", "last_name": "Ba"}
    assert client.post("/api/v1/me/producer/", payload, format="json").status_code == 201
    assert client.post("/api/v1/me/producer/", payload, format="json").status_code == 400
    assert client.get("/api/v1/me/producer/").json()["registration_channel"] == "self_signup"


def test_workspace_context_for_organization(make_org, make_member, api):
    org = make_org()
    user, _ = make_member(org, "field_agent")
    context = api.as_user(user, org).get("/api/v1/workspace/").json()
    assert context["kind"] == "organization"
    assert context["roles"] == ["field_agent"]
    assert "producers.create" in context["permissions"]
    assert "producers.manage" not in context["permissions"]
    assert not any(p.startswith("personal.") for p in context["permissions"])
