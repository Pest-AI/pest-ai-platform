"""Activation des comptes créés par invitation.

Le gérant invite une personne par son numéro ; si elle n'a pas encore de compte, le compte
est créé sans mot de passe et un code d'activation est émis. La personne saisit ensuite
son numéro, ce code et le mot de passe de son choix sur la page « Activer mon compte ».

Sécurité :
- code de 8 caractères (alphabet Crockford, ~10^12 combinaisons), valable 7 jours ;
- seule une empreinte HMAC (clé SECRET_KEY) est stockée ;
- 5 essais erronés maximum par code, puis le code est annulé ;
- un nouveau code annule les précédents ;
- message d'erreur identique quel que soit le motif (numéro inconnu, code faux, expiré…).
"""

import secrets
from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from apps.accounts.models import AccountActivation, User
from apps.accounts.validators import normalize_phone_number
from apps.core.audit import ACCOUNT_ACTIVATION, security_event

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford : sans I, L, O, U
CODE_LENGTH = 8
VALIDITY = timedelta(days=7)
MAX_FAILED_ATTEMPTS = 5
GENERIC_ERROR = "Numéro ou code d'activation invalide ou expiré."


def _clean(code: str) -> str:
    """Majuscules, sans espaces ni tirets ; O→0, I/L→1 (saisie tolérante)."""
    cleaned = "".join(ch for ch in str(code).upper() if ch.isalnum())
    return cleaned.replace("O", "0").replace("I", "1").replace("L", "1")


def _hash(code: str) -> str:
    return salted_hmac("pestai.account-activation", _clean(code), algorithm="sha256").hexdigest()


def format_code(code: str) -> str:
    """Affichage lisible : ABCD-EF12."""
    return f"{code[:4]}-{code[4:]}"


@transaction.atomic
def issue_activation_code(*, user: User, issued_by) -> tuple[str, AccountActivation]:
    """Émet un nouveau code (annule les précédents). Renvoie le code en clair, une seule fois."""
    if user.has_usable_password():
        raise ValidationError(
            "Ce compte est déjà activé : la personne se connecte avec son mot de passe."
        )
    now = timezone.now()
    AccountActivation.objects.filter(
        user=user, used_at__isnull=True, revoked_at__isnull=True
    ).update(revoked_at=now, updated_at=now, updated_by=issued_by)
    code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
    activation = AccountActivation.objects.create(
        user=user,
        code_hash=_hash(code),
        expires_at=now + VALIDITY,
        created_by=issued_by,
        updated_by=issued_by,
    )
    security_event(ACCOUNT_ACTIVATION, user=issued_by, change="code_issued", account_id=user.pk)
    return format_code(code), activation


def activate_account(*, phone_number: str, code: str, new_password: str) -> User:
    """Vérifie le code et fixe le mot de passe choisi. Lève ValidationError (message générique).

    Pas de transaction englobante : un essai erroné doit rester compté même si une
    exception est levée ensuite.
    """
    phone = normalize_phone_number(phone_number or "")
    user = User.objects.filter(phone_number=phone, is_active=True).first()
    activation = None
    if user is not None:
        activation = (
            AccountActivation.objects.filter(
                user=user,
                used_at__isnull=True,
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )
    if activation is None:
        security_event(ACCOUNT_ACTIVATION, change="refused", reason="no_valid_code")
        raise ValidationError(GENERIC_ERROR)

    if not constant_time_compare(activation.code_hash, _hash(code)):
        attempts = activation.failed_attempts + 1
        AccountActivation.objects.filter(pk=activation.pk).update(
            failed_attempts=F("failed_attempts") + 1,
            revoked_at=timezone.now() if attempts >= MAX_FAILED_ATTEMPTS else None,
            updated_at=timezone.now(),
        )
        security_event(
            ACCOUNT_ACTIVATION, user=user, change="refused", reason="wrong_code", attempts=attempts
        )
        raise ValidationError(GENERIC_ERROR)

    validate_password(new_password, user=user)
    with transaction.atomic():
        # Usage unique garanti même en cas de double envoi simultané.
        consumed = AccountActivation.objects.filter(pk=activation.pk, used_at__isnull=True).update(
            used_at=timezone.now(), updated_at=timezone.now(), updated_by=user
        )
        if not consumed:
            raise ValidationError(GENERIC_ERROR)
        user.set_password(new_password)
        user.updated_by = user
        user.save(update_fields=["password", "updated_by", "updated_at"])
    security_event(ACCOUNT_ACTIVATION, user=user, change="activated")
    return user
