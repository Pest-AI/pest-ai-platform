"""Génère la liste des pays (indicatif, nom français, longueur des numéros) du Web OS et de l'app.

Usage (hors CI) : pip install phonenumbers babel && python scripts/generate-countries.py
Sources : métadonnées libphonenumber (Google, Apache-2.0) et noms CLDR (Unicode, via Babel).
Écrit frontend/src/lib/countries.ts et mobile/src/lib/countries.ts (même contenu).
"""

import json
import unicodedata
from pathlib import Path

import phonenumbers
from babel import Locale
from phonenumbers import PhoneNumberType

# Pays proposés en tête : Sénégal puis voisins et Afrique de l'Ouest.
FIRST = ["SN", "ML", "MR", "GM", "GN", "GW", "CI", "BF", "NE", "TG", "BJ", "NG", "GH", "CV", "SL", "LR"]

names = Locale("fr").territories
rows = []
for region in sorted(phonenumbers.SUPPORTED_REGIONS):
    if region == "001" or region not in names:
        continue
    example = phonenumbers.example_number_for_type(region, PhoneNumberType.MOBILE)
    length = len(str(example.national_number)) if example else None
    rows.append(
        {
            "iso": region,
            "name": names[region],
            "dial": str(phonenumbers.country_code_for_region(region)),
            "length": length,
        }
    )


def key(row):
    plain = unicodedata.normalize("NFKD", row["name"]).encode("ascii", "ignore").decode().lower()
    return plain


first = [r for code in FIRST for r in rows if r["iso"] == code]
rest = sorted((r for r in rows if r["iso"] not in FIRST), key=key)
body = ",\n".join(
    "  { iso: %s, name: %s, dial: %s, length: %s }"
    % (json.dumps(r["iso"]), json.dumps(r["name"], ensure_ascii=False), json.dumps(r["dial"]), r["length"] or "null")
    for r in first + rest
)
content = f'''/**
 * Pays, indicatifs et longueur des numéros mobiles nationaux.
 * Généré par scripts/generate-countries.py (libphonenumber + CLDR) : ne pas modifier à la main.
 * En tête : Sénégal puis Afrique de l'Ouest ; ensuite ordre alphabétique.
 */
export type Country = {{ iso: string; name: string; dial: string; length: number | null }};

export const FIRST_COUNTRIES = {len(first)};

export const COUNTRIES: Country[] = [
{body},
];
'''
root = Path(__file__).resolve().parent.parent
for target in ("frontend/src/lib/countries.ts", "mobile/src/lib/countries.ts"):
    (root / target).write_text(content, encoding="utf-8")
print(len(rows), "pays")
