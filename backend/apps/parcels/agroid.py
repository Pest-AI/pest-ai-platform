"""AgroID : identité numérique permanente d'une parcelle (F-08, décision D-05).

Format : ``PAI-<pays>-<8 caractères>``, par exemple ``PAI-SN-7K4M9X2Q``.

- Les 8 caractères sont tirés par un générateur cryptographique dans l'alphabet base32
  de Crockford (chiffres et lettres sans I, L, O, U, pour éviter les confusions à la
  lecture : 1/I/L, 0/O). 32^8 ≈ 1,1 × 10^12 combinaisons.
- Tirage aléatoire, pas de compteur : l'identifiant ne révèle ni volume ni ordre.
- Pas de clé de contrôle (format validé par le fondateur).
- Attribué par le serveur uniquement ; l'unicité est garantie par la base (contrainte
  UNIQUE) avec un nouveau tirage en cas de collision (voir services.assign_agroid).
"""

from __future__ import annotations

import re
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # base32 Crockford : sans I, L, O, U
LENGTH = 8
PREFIX = "PAI"
PATTERN = r"^PAI-[A-Z]{2}-[0-9A-HJKMNP-TV-Z]{8}$"  # identique à la contrainte CHECK
_RE = re.compile(PATTERN)
# Saisie humaine : lettres ambiguës ramenées à leur chiffre (règle Crockford).
_CONFUSABLE = str.maketrans({"I": "1", "L": "1", "O": "0"})


def generate(country_code: str = "SN") -> str:
    """Tire un AgroID au hasard. L'unicité est vérifiée par la base, pas ici."""
    country = country_code.upper()
    if not re.fullmatch(r"[A-Z]{2}", country):
        raise ValueError("Code pays sur deux lettres attendu, par exemple SN.")
    code = "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))
    return f"{PREFIX}-{country}-{code}"


def is_valid(value: str | None) -> bool:
    return bool(value) and _RE.fullmatch(value) is not None


def normalize(value: str) -> str | None:
    """Ramène une saisie humaine à un AgroID canonique, ou None si ce n'en est pas un.

    Accepte minuscules, espaces, tirets absents ou en trop, et les lettres ambiguës
    (« o » pour 0, « i » ou « l » pour 1) : « pai sn 7k4m9x2q » → « PAI-SN-7K4M9X2Q ».
    """
    compact = re.sub(r"[\s\-_.]", "", (value or "").upper())
    if len(compact) != len(PREFIX) + 2 + LENGTH or not compact.startswith(PREFIX):
        return None
    country = compact[3:5]
    code = compact[5:].translate(_CONFUSABLE)
    candidate = f"{PREFIX}-{country}-{code}"
    return candidate if is_valid(candidate) else None
