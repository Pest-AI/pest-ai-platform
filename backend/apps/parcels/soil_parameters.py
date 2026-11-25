"""Paramètres mesurés au sol (J20c) : kit de terrain des agents (testeur « 7 en 1 » par
défaut), extensible aux analyses de laboratoire et aux capteurs.

Chaque paramètre a une unité fixe (les valeurs restent comparables d'une mesure à l'autre),
des limites physiques (au-delà : refus, c'est une erreur de saisie) et une plage habituelle
(au-delà : signalé « inhabituel », jamais refusé). Plages à valider par l'agronome.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.db import models


class SoilTestMethod(models.TextChoices):
    FIELD_KIT = "field_kit", "Kit de terrain"
    LABORATORY = "laboratory", "Laboratoire"
    SENSOR = "sensor", "Capteur installé"


@dataclass(frozen=True)
class SoilParameter:
    code: str
    label: str
    unit: str
    min: Decimal  # limite physique basse (refus en dessous)
    max: Decimal  # limite physique haute (refus au-dessus)
    usual_min: Decimal  # plage habituelle : en dehors, valeur signalée
    usual_max: Decimal
    decimals: int
    kit: bool  # mesuré par le kit de terrain


def _p(code, label, unit, lo, hi, ulo, uhi, decimals, kit=True):
    return SoilParameter(
        code, label, unit, Decimal(lo), Decimal(hi), Decimal(ulo), Decimal(uhi), decimals, kit
    )


PARAMETERS: tuple[SoilParameter, ...] = (
    _p("ph", "pH", "", "0", "14", "4.5", "9", 1),
    _p("ec", "Conductivité (salinité)", "µS/cm", "0", "20000", "0", "4000", 0),
    _p("nitrogen", "Azote (N)", "mg/kg", "0", "2000", "0", "300", 0),
    _p("phosphorus", "Phosphore (P)", "mg/kg", "0", "2000", "0", "300", 0),
    _p("potassium", "Potassium (K)", "mg/kg", "0", "4000", "0", "600", 0),
    _p("moisture", "Humidité", "%", "0", "100", "2", "60", 1),
    _p("temperature", "Température du sol", "°C", "-5", "70", "10", "45", 1),
    # Laboratoire (plus tard, saisie depuis un rapport).
    _p("organic_matter", "Matière organique", "%", "0", "100", "0.2", "5", 2, kit=False),
)

BY_CODE = {p.code: p for p in PARAMETERS}


def catalog() -> list[dict]:
    return [
        {
            "code": p.code,
            "label": p.label,
            "unit": p.unit,
            "min": str(p.min),
            "max": str(p.max),
            "usual_min": str(p.usual_min),
            "usual_max": str(p.usual_max),
            "decimals": p.decimals,
            "kit": p.kit,
        }
        for p in PARAMETERS
    ]


def is_unusual(code: str, value: Decimal) -> bool:
    p = BY_CODE[code]
    return value < p.usual_min or value > p.usual_max
