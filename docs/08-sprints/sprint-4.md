# Sprint 4 — Campagnes, cycles et activités (J16 → J20)

## J16 — Domaine Agriculture (livré)

| Livré | Vérification |
|---|---|
| Mixin SPACE dans `core` : organisation **ou** espace personnel, `space_key` calculé par PostgreSQL, espace immuable (trigger commun), outils de clé étrangère composite | Tests SQL directs (I-25) |
| App `agriculture` : Crop (5 cultures du MVP), CropVariety, AgriculturalCampaign, CropCycle, AgriculturalOperation, HarvestRecord, conformes au Database Design v2.2 | 17 tests, migrations `agriculture 0001-0002`, `parcels 0008` |
| Clés étrangères composites : cycle → campagne, opération → cycle, récolte → cycle (même espace) ; unité du cycle forcément sur sa parcelle ; cycle et récolte jamais supprimés | Tests en SQL brut |
| API `/crops/`, `/campaigns/`, `/crop-cycles/` (+ opérations, récoltes, confirmation, archivage), deux espaces | Tests API et droits |
| Filtres **Campagne** et **Culture** de la carte et de la liste des parcelles, dans le Web OS | Test API + parcours navigateur |

## J17 — Écrans Web OS (livré)

| Livré | Vérification |
|---|---|
| Menu **Campagnes** actif : liste des campagnes (saison, période, statut, nombre de cycles), création, ouverture et clôture | Parcours navigateur |
| Fiche campagne : cycles, surface déclarée, quantité récoltée, répartition par culture | Parcours navigateur |
| **Nouveau cycle** : recherche de parcelle (AgroID, même partiel, ou nom), unité, culture, variété, campagne, semis prévu ou réalisé, surface | Parcours navigateur |
| Fiche cycle : statut (démarrer, récolté, abandonné), dates, confirmation de culture (agronome), opérations, récoltes en sacs ou en kg avec conversion, rendement en t/ha, chevauchements signalés | Parcours navigateur, 4 tests unitaires |
| Liste de tous les cycles avec filtres (statut, culture, campagne) ; cycles sur la fiche parcelle | Parcours navigateur |
| API : recherche de parcelle par morceau d'AgroID | 1 test API |

## Reporté (prévu par le Design, dépend d'autres apps)

- `AgriculturalCampaign.program` : avec les programmes.
- `AgriculturalOperation.product` : avec le catalogue de produits (texte libre `product_text` en attendant).
- `source_device` : avec la synchronisation (J18).
- Saisie des cycles, opérations et récoltes dans l'app terrain (hors ligne) : jours suivants du sprint.

## À valider par le fondateur

1. **Matrice des droits Agriculture** (tableau de `docs-site/docs/agriculture.md`).
2. **Libellés des saisons** (D-18) et noms des cultures en wolof et en pulaar : relecture par l'agronome.
3. **Règles ajoutées au Design** : une opération a au moins une date (réalisée ou prévue) ; une récolte ne se déclare pas avant le semis ni dans le futur ; un cycle ne démarre pas dans une campagne clôturée.
