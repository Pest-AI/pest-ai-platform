"""Identifiant producteur PEST AI (décision du fondateur, 24/11/2026).

Format : ``PRD-<pays>-<8 caractères>``, par exemple ``PRD-SN-4K7M2X9Q`` — même principe que
l'AgroID des parcelles (D-05) : tirage cryptographique dans l'alphabet base32 de Crockford
(sans I, L, O, U), aucun compteur, attribué par le serveur, jamais modifié ni réutilisé.

Il suit le producteur sur toute la plateforme, quelle que soit sa coopérative ; le numéro
d'adhérent, lui, appartient à la coopérative.
"""

from __future__ import annotations

import re
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
LENGTH = 8
PREFIX = "PRD"
PATTERN = r"^PRD-[A-Z]{2}-[0-9A-HJKMNP-TV-Z]{8}$"  # identique à la contrainte CHECK
_RE = re.compile(PATTERN)
_CONFUSABLE = str.maketrans({"I": "1", "L": "1", "O": "0"})


def generate(country_code: str = "SN") -> str:
    country = (country_code or "SN").upper()
    if not re.fullmatch(r"[A-Z]{2}", country):
        raise ValueError("Code pays sur deux lettres attendu, par exemple SN.")
    return f"{PREFIX}-{country}-" + "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def is_valid(value: str | None) -> bool:
    return bool(value) and _RE.fullmatch(value) is not None


def normalize(value: str) -> str | None:
    """« prd sn 4k7m2x9q » → « PRD-SN-4K7M2X9Q », ou None si ce n'est pas un identifiant."""
    compact = re.sub(r"[\s\-_.]", "", (value or "").upper())
    if len(compact) != len(PREFIX) + 2 + LENGTH or not compact.startswith(PREFIX):
        return None
    candidate = f"{PREFIX}-{compact[3:5]}-{compact[5:].translate(_CONFUSABLE)}"
    return candidate if is_valid(candidate) else None
