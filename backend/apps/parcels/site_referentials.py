"""Référentiels du profil de site d'une parcelle : sol, eau et irrigation, accès (J18d).

Addendum v2.3 au Database Design. Listes **proposées** le 24/11/2026, en attente de validation
par l'agronome (Déthié Gueye pour la Vallée du Fleuve, Ibrahima Babacar Fall pour les Niayes).
Ajouter ou renommer une valeur se fait ici (avec une migration pour la contrainte en base) ;
une valeur déjà utilisée n'est jamais retirée.

Convention : chaîne vide = non renseigné ; ``unknown`` = « ne sait pas » (réponse donnée).
"""

from django.db import models


class SoilLocalType(models.TextChoices):
    HOLLALDE = "hollalde", "Hollaldé (argileux de cuvette)"
    FONDE = "fonde", "Fondé (levée limoneuse)"
    FALO = "falo", "Falo (berge du fleuve)"
    DIERI = "dieri", "Diéri (sableux, hors crue)"
    DIOR = "dior", "Dior (sableux)"
    DECK = "deck", "Deck (argileux, humifère)"
    DECK_DIOR = "deck_dior", "Deck-dior"
    OTHER = "other", "Autre"
    UNKNOWN = "unknown", "Ne sait pas"


class SoilTexture(models.TextChoices):
    SANDY = "sandy", "Sableuse"
    SANDY_LOAM = "sandy_loam", "Sablo-limoneuse"
    LOAM = "loam", "Limoneuse"
    CLAY_LOAM = "clay_loam", "Argilo-limoneuse"
    CLAY = "clay", "Argileuse"
    UNKNOWN = "unknown", "Ne sait pas"


class Salinity(models.TextChoices):
    NONE = "none", "Aucune"
    SLIGHT = "slight", "Légère"
    STRONG = "strong", "Forte (taches blanches, croûtes)"
    UNKNOWN = "unknown", "Ne sait pas"


class Flooding(models.TextChoices):
    NEVER = "never", "Jamais inondée"
    RAINY_SEASON = "rainy_season", "Inondée en hivernage"
    PROLONGED = "prolonged", "Inondation prolongée"
    UNKNOWN = "unknown", "Ne sait pas"


class Slope(models.TextChoices):
    FLAT = "flat", "Plate"
    GENTLE = "gentle", "Légère pente"
    STEEP = "steep", "Forte pente"
    UNKNOWN = "unknown", "Ne sait pas"


class Fertility(models.TextChoices):
    GOOD = "good", "Bonne"
    MEDIUM = "medium", "Moyenne"
    POOR = "poor", "Faible"
    UNKNOWN = "unknown", "Ne sait pas"


class WaterRegime(models.TextChoices):
    RAINFED = "rainfed", "Pluvial"
    IRRIGATED = "irrigated", "Irrigué"
    FLOOD_RECESSION = "flood_recession", "Décrue"
    MIXED = "mixed", "Mixte"
    UNKNOWN = "unknown", "Ne sait pas"


class WaterSource(models.TextChoices):
    RIVER_CANAL = "river_canal", "Fleuve ou canal"
    BOREHOLE = "borehole", "Forage"
    WELL = "well", "Puits"
    POND = "pond", "Mare ou marigot"
    NETWORK = "network", "Réseau d'eau"
    OTHER = "other", "Autre"
    UNKNOWN = "unknown", "Ne sait pas"


class IrrigationMethod(models.TextChoices):
    GRAVITY = "gravity", "Gravitaire"
    PUMP_GRAVITY = "pump_gravity", "Motopompe puis gravitaire"
    SPRINKLER = "sprinkler", "Aspersion"
    DRIP = "drip", "Goutte-à-goutte"
    MANUAL = "manual", "Manuel (arrosoir)"
    NONE = "none", "Aucune"
    UNKNOWN = "unknown", "Ne sait pas"


class SchemeType(models.TextChoices):
    SAED_LARGE = "saed_large", "Grand aménagement (SAED)"
    PIV = "piv", "Périmètre irrigué villageois (PIV)"
    PRIVATE = "private", "Périmètre privé"
    NONE = "none", "Aucun aménagement"
    UNKNOWN = "unknown", "Ne sait pas"


class PumpAccess(models.TextChoices):
    INDIVIDUAL = "individual", "Individuelle"
    COLLECTIVE = "collective", "Collective (GIE, groupement)"
    RENTED = "rented", "Louée"
    NONE = "none", "Aucune"
    UNKNOWN = "unknown", "Ne sait pas"


class WaterAvailability(models.TextChoices):
    YEAR_ROUND = "year_round", "Toute l'année"
    SEASONAL = "seasonal", "Saisonnière"
    UNKNOWN = "unknown", "Ne sait pas"


class RoadAccess(models.TextChoices):
    ALL_SEASON = "all_season", "En toute saison"
    DRY_SEASON = "dry_season", "En saison sèche seulement"
    UNKNOWN = "unknown", "Ne sait pas"


class Evidence(models.TextChoices):
    DECLARED = "declared", "Déclaré par le producteur"
    OBSERVED = "observed", "Constaté par l'agent"
    MEASURED = "measured", "Mesuré ou analysé"


# Champ du profil → référentiel (sert au modèle, aux contraintes, à l'API et aux écrans).
SITE_FIELDS = {
    "soil_local_type": SoilLocalType,
    "soil_texture": SoilTexture,
    "salinity": Salinity,
    "flooding": Flooding,
    "slope": Slope,
    "perceived_fertility": Fertility,
    "water_regime": WaterRegime,
    "water_source": WaterSource,
    "irrigation_method": IrrigationMethod,
    "scheme_type": SchemeType,
    "pump_access": PumpAccess,
    "water_availability": WaterAvailability,
    "road_access": RoadAccess,
}
SOIL_FIELDS = (
    "soil_local_type",
    "soil_texture",
    "salinity",
    "flooding",
    "slope",
    "perceived_fertility",
)
WATER_FIELDS = (
    "water_regime",
    "water_source",
    "irrigation_method",
    "scheme_type",
    "pump_access",
    "water_availability",
)


def catalog() -> dict:
    """Référentiels exposés aux écrans : {champ: [{value, label}]}."""
    return {
        field: [{"value": value, "label": str(label)} for value, label in choices.choices]
        for field, choices in SITE_FIELDS.items()
    }
