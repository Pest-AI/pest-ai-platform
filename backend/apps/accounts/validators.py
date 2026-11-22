"""Validation et normalisation des numéros de téléphone (format E.164)."""

import re

from django.core.exceptions import ValidationError

E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
_SEPARATORS = re.compile(r"[\s\-\.\(\)]")


def normalize_phone_number(value: str) -> str:
    """Supprime espaces et séparateurs ; « 00 » initial devient « + »."""
    if value is None:
        return value
    cleaned = _SEPARATORS.sub("", str(value).strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    return cleaned


def validate_e164(value: str) -> None:
    """Exige un numéro international E.164, par exemple +221771234567."""
    if not E164_PATTERN.match(value or ""):
        raise ValidationError(
            "Numéro invalide : format international attendu, par exemple +221771234567.",
            code="invalid_phone_number",
        )
