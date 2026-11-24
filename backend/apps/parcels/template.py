"""Modèle Excel « Coopérative » (J15d) : producteurs et parcelles d'une organisation.

Généré par le code, pour que les colonnes restent celles que l'import reconnaît. Aucune
ligne d'exemple dans les onglets de données (elle serait importée) : les exemples sont dans
l'onglet « Lisez-moi ».
"""

from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

PRODUCER_HEADERS = [
    ("Prénom", 18, "Obligatoire."),
    ("Nom", 18, "Obligatoire."),
    ("Sexe (F/H)", 11, "F ou H."),
    ("Année de naissance", 12, "Ex. 1978."),
    ("Village / localité", 22, "Sert aussi à repérer les doublons."),
    ("Téléphone", 16, "Ex. 77 123 45 67 ou +221771234567."),
    ("N° d'adhérent", 15, "Relie le producteur à ses parcelles."),
    ("Type de rattachement", 16, "membre, bénéficiaire ou client (membre par défaut)."),
    ("Langue", 11, "français, wolof ou pulaar (français par défaut)."),
]
PARCEL_HEADERS = [
    ("Nom de la parcelle", 24, "Ex. Casier Nord."),
    ("N° d'adhérent de l'exploitant", 18, "Le n° d'adhérent de l'onglet Producteurs."),
    ("Latitude", 12, "Ex. 16.6512 (point au centre du champ)."),
    ("Longitude", 12, "Ex. -14.9634."),
    (
        "Contour (facultatif)",
        48,
        "Relevé KoboToolbox / ODK (« lat lon alt précision; … ») ou WKT.",
    ),
]
README = [
    ("Modèle « Coopérative » — PEST AI OS", True),
    ("", False),
    ("1. Remplissez l'onglet Producteurs : une ligne par producteur.", False),
    ("2. Remplissez l'onglet Parcelles : une ligne par parcelle, avec le n° d'adhérent de", False),
    ("   son exploitant. Position : latitude et longitude, ou contour.", False),
    ("3. Déposez le fichier dans le Web OS : Parcelles & AgroID → Importer un fichier.", False),
    ("   Vous verrez l'aperçu ligne par ligne ; rien n'est créé avant votre confirmation.", False),
    ("", False),
    ("Bon à savoir", True),
    ("• Ne renommez pas les onglets ni les en-têtes. Ne mettez pas de ligne d'exemple.", False),
    (
        "• Un producteur déjà dans votre registre (même n° d'adhérent ou même téléphone) n'est",
        False,
    ),
    ("  pas recréé. Un doublon probable ailleurs (même téléphone, ou même nom dans la même", False),
    ("  localité) est signalé : vous décidez avant la création.", False),
    (
        "• Une parcelle sans contour reçoit son AgroID ; le contour sera relevé sur le terrain.",
        False,
    ),
    ("• Un contour importé reste « à confirmer par un relevé terrain ».", False),
    ("• Google Sheets : Fichier → Télécharger → Microsoft Excel (.xlsx).", False),
    ("• 1 000 lignes au plus par onglet, 10 Mo au plus.", False),
    ("", False),
    ("Exemples de saisie", True),
    ("Téléphone : 77 123 45 67    ou    +221771234567", False),
    ("Latitude / longitude : 16.6512 / -14.9634 (degrés décimaux, point ou virgule)", False),
    (
        "Contour KoboToolbox : 16.6512 -14.9634 0 5; 16.6512 -14.9625 0 5; 16.6503 -14.9625 0 5",
        False,
    ),
]

HEADER_FILL = PatternFill("solid", fgColor="1F4D2B")
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF")
BODY_FONT = Font(name="Arial")
MAX_ROWS = 1001


def _data_sheet(book: Workbook, title: str, headers):
    ws = book.create_sheet(title)
    for col, (label, width, hint) in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=label)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        letter = cell.column_letter
        ws.column_dimensions[letter].width = width
        # Aide au survol de l'en-tête (note Excel), sans ligne d'exemple.
        cell.comment = Comment(hint, "PEST AI OS")
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"
    return ws


def build_template() -> bytes:
    book = Workbook()
    readme = book.active
    readme.title = "Lisez-moi"
    readme.column_dimensions["A"].width = 100
    for row, (text, bold) in enumerate(README, start=1):
        cell = readme.cell(row=row, column=1, value=text)
        cell.font = Font(name="Arial", bold=bold, size=13 if row == 1 else 11)

    producers = _data_sheet(book, "Producteurs", PRODUCER_HEADERS)
    for column, values in (
        ("C", "F,H"),
        ("H", "membre,bénéficiaire,client"),
        ("I", "français,wolof,pulaar"),
    ):
        rule = DataValidation(type="list", formula1=f'"{values}"', allow_blank=True)
        rule.error = "Choisissez une valeur de la liste."
        producers.add_data_validation(rule)
        rule.add(f"{column}2:{column}{MAX_ROWS}")
    year = DataValidation(
        type="whole", operator="between", formula1="1900", formula2="2100", allow_blank=True
    )
    year.error = "Année sur 4 chiffres."
    producers.add_data_validation(year)
    year.add(f"D2:D{MAX_ROWS}")
    for column in ("F", "G"):  # téléphone et n° d'adhérent en texte : zéros et « + » conservés
        producers.column_dimensions[column].number_format = "@"

    parcels = _data_sheet(book, "Parcelles", PARCEL_HEADERS)
    parcels.column_dimensions["B"].number_format = "@"
    for column, low, high in (("C", -90, 90), ("D", -180, 180)):
        rule = DataValidation(
            type="decimal",
            operator="between",
            formula1=str(low),
            formula2=str(high),
            allow_blank=True,
        )
        rule.error = "Degrés décimaux, ex. 16.6512."
        parcels.add_data_validation(rule)
        rule.add(f"{column}2:{column}{MAX_ROWS}")

    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()
