"""Génère la liste des pays (indicatif, nom français, longueur des numéros) du Web OS et de l'app.

Périmètre : Afrique de l'Ouest seulement (décision du fondateur, 24/11/2026), Mauritanie comprise
(Afrique de l'Ouest au sens des Nations unies). Pour ouvrir un pays, l'ajouter à COUNTRIES_IN_SCOPE.

Usage (hors CI) : pip install phonenumbers babel && python scripts/generate-countries.py
Sources : métadonnées libphonenumber (Google, Apache-2.0) et noms CLDR (Unicode, via Babel).
Écrit frontend/src/lib/countries.ts et mobile/src/lib/countries.ts (même contenu).
"""

import json
from pathlib import Path

import phonenumbers
from babel import Locale
from phonenumbers import PhoneNumberType

# Pays proposés, dans cet ordre : Sénégal, voisins, puis le reste de l'Afrique de l'Ouest.
COUNTRIES_IN_SCOPE = [
    "SN", "ML", "MR", "GM", "GN", "GW", "CI", "BF", "NE", "TG", "BJ", "NG", "GH", "CV", "SL", "LR",
]

names = Locale("fr").territories
rows = []
for region in sorted(phonenumbers.SUPPORTED_REGIONS):
    if region == "001" or region not in names:
        continue
    example = phonenumbers.example_number_for_type(region, PhoneNumberType.MOBILE)
    # Côte d'Ivoire, Bénin : le 0 initial fait partie du numéro (10 chiffres).
    keep_zero = bool(example and example.italian_leading_zero)
    length = len(str(example.national_number)) + int(keep_zero) if example else None
    rows.append(
        {
            "iso": region,
            "name": names[region],
            "dial": str(phonenumbers.country_code_for_region(region)),
            "length": length,
            "keep_zero": keep_zero,
        }
    )


first = [r for code in COUNTRIES_IN_SCOPE for r in rows if r["iso"] == code]
assert len(first) == len(COUNTRIES_IN_SCOPE), "pays inconnu dans COUNTRIES_IN_SCOPE"
body = ",\n".join(
    "  { iso: %s, name: %s, dial: %s, length: %s, keepZero: %s }"
    % (
        json.dumps(r["iso"]),
        json.dumps(r["name"], ensure_ascii=False),
        json.dumps(r["dial"]),
        r["length"] or "null",
        "true" if r["keep_zero"] else "false",
    )
    for r in first
)
content = f'''/**
 * Pays, indicatifs et longueur des numéros mobiles nationaux.
 * Généré par scripts/generate-countries.py (libphonenumber + CLDR) : ne pas modifier à la main.
 * Afrique de l'Ouest seulement (Mauritanie comprise) : Sénégal, voisins, puis les autres pays.
 */
/** keepZero : le 0 initial fait partie du numéro national (Côte d'Ivoire, Bénin). */
export type Country = {{ iso: string; name: string; dial: string; length: number | null; keepZero: boolean }};

export const COUNTRIES: Country[] = [
{body},
];
'''
root = Path(__file__).resolve().parent.parent
for target in ("frontend/src/lib/countries.ts", "mobile/src/lib/countries.ts"):
    (root / target).write_text(content, encoding="utf-8")
print(len(first), "pays")
