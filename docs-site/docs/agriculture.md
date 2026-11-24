---
title: Campagnes et cycles de culture
---

# Campagnes et cycles de culture

Une **campagne** regroupe des cycles d'un même espace sur une période (hivernage, contre-saison). Un **cycle** est une culture pratiquée sur une parcelle, ou une de ses unités, pendant une période : il porte les **opérations** (semis, irrigation, fertilisation, traitement…) et les **récoltes**.

Les deux espaces sont séparés : une organisation ne voit que ses campagnes et cycles, un producteur indépendant que les siens (`X-Workspace: personal`). PostgreSQL le garantit aussi : un cycle ne peut citer qu'une campagne du même espace, une opération ou une récolte qu'un cycle du même espace, et l'espace d'un enregistrement ne change jamais.

## Cultures

`GET /api/v1/crops/` : référentiel (sans `X-Workspace`). MVP : `rice` (riz), `onion` (oignon), `tomato` (tomate), `maize` (maïs), `chili` (piment), toutes prises en charge par le diagnostic IA. Variétés et noms en wolof et en pulaar : saisis par l'équipe agronomique.

## Campagnes

| Méthode | Adresse | Rôle |
|---|---|---|
| GET | `/api/v1/campaigns/` | Liste (filtres `status`, `year`, `season_type`, `archived`) |
| POST | `/api/v1/campaigns/` | Créer : `name` (unique dans l'espace), `season_type`, `year`, `start_date`, `end_date` |
| PATCH | `/api/v1/campaigns/{id}/` | Modifier ; statut `planned` → `active` → `closed` |
| POST | `/api/v1/campaigns/{id}/archive/` | Archiver (motif obligatoire) |

Saisons (D-18) : `rainy` hivernage, `cold_dry` contre-saison froide, `hot_dry` contre-saison chaude, `other`. Une campagne clôturée ne se modifie plus et n'accepte plus de cycle.

## Cycles

| Méthode | Adresse | Rôle |
|---|---|---|
| GET | `/api/v1/crop-cycles/` | Liste (filtres `campaign`, `crop`, `parcel`, `status`, `operator`, `archived`) |
| POST | `/api/v1/crop-cycles/` | Démarrer : `parcel`, `declared_crop` (code), et au choix `cultivation_unit`, `campaign`, `variety`, `operator`, dates, `declared_area_m2`, `status` (`planned` ou `in_progress`) |
| GET | `/api/v1/crop-cycles/{id}/` | Fiche avec opérations, récoltes, total récolté et chevauchements |
| PATCH | `/api/v1/crop-cycles/{id}/` | Dates, surface, variété, campagne, statut |
| POST | `/api/v1/crop-cycles/{id}/confirm-crop/` | Confirmer la culture (agronome) ; la culture déclarée est conservée |
| GET, POST | `/api/v1/crop-cycles/{id}/operations/` | Opérations (date réalisée ou prévue obligatoire) |
| GET, POST | `/api/v1/crop-cycles/{id}/harvests/` | Récoltes : `quantity_kg` (normalisée), unité d'origine facultative (« sac de 80 kg »), méthode `declared`, `weighed` ou `estimated` |
| POST | `/api/v1/crop-cycles/{id}/archive/` | Archiver (motif obligatoire) ; un cycle n'est jamais supprimé |

- **Parcelle** : une parcelle de l'espace (lien actif pour une organisation, accès personnel pour un producteur), non retirée. Elle ne change jamais.
- **Exploitant** : par défaut, l'exploitant principal de la parcelle au démarrage ; dans l'espace personnel, le producteur lui-même.
- **Statut** : `planned` → `in_progress` → `harvested` ; `abandoned` tant que le cycle n'est pas récolté.
- **Chevauchements (D-17)** : deux cycles prévus ou en cours sur la même parcelle (ou la même unité) et des périodes qui se recoupent sont acceptés (cultures associées) et listés dans `overlaps`.
- **Récolte** : pas avant le semis, pas dans le futur, pas sur un cycle prévu ou abandonné.
- **Source d'une opération** : `field_agent` par défaut dans une organisation, `producer_declared` dans l'espace personnel.

## Carte et liste des parcelles

`/api/v1/parcels/` et `/api/v1/parcels/map/` acceptent `campaign` (parcelles portant un cycle de la campagne) et `crop` (cycle de cette culture prévu ou en cours, ou de tout statut avec `campaign`). Culture retenue : la culture confirmée, sinon la culture déclarée. Seuls les cycles de l'espace actif comptent.

## Droits (proposition J16, à valider)

| Rôle | Campagnes | Cycles, opérations, récoltes | Confirmer la culture |
|---|---|---|---|
| Administrateur, gérant | voir, gérer | voir, gérer | oui |
| Agent de terrain | voir | voir, gérer | non |
| Agronome | voir | voir | oui |
| Responsable de programme | voir | voir | non |
| Producteur (rôle d'organisation) | — | — | — |
| Espace personnel | `personal.crop_cycles.manage` : tout dans son espace | | non |
