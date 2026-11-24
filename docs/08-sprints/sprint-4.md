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

## J18 — Enrôlement terrain (livré)

| Livré | Vérification |
|---|---|
| **Choix du pays** pour tous les numéros (245 pays, drapeau et indicatif ; Sénégal et Afrique de l'Ouest en tête ; recherche par nom ou indicatif) : connexion, activation, invitation, producteurs, création d'organisation (Web OS) ; connexion, activation, enrôlement (app terrain). Le numéro est envoyé au format international | 8 + 8 tests unitaires, parcours navigateur (Web OS et app) |
| App terrain : **activation du compte avec le code** directement dans l'app (plus de passage par le Web OS) | Parcours navigateur |
| App terrain : **enrôlement d'un producteur** (identité, village, téléphone, n° d'adhérent, langue) ; doublons possibles proposés au rattachement (D-28) | Parcours navigateur |
| App terrain : **enrôlement d'une parcelle** — exploitant, nom, puis **tour du champ** au GPS (points ajoutés en marchant, retour au départ détecté), **coin par coin**, ou simple position ; aperçu du contour, surface, périmètre, précision ; **AgroID affiché** à l'envoi ; contour signalé selon D-19 | 3 tests unitaires, parcours navigateur (position simulée) |
| Accès : boutons affichés selon les droits (`producers.create`, `parcels.create`, `personal.parcels.register`) ; « Enrôler une parcelle » depuis l'accueil et depuis la fiche producteur | Parcours navigateur |

Limites assumées : l'enrôlement demande le réseau (message clair sinon ; la file hors ligne arrive au J20) ; le relevé GPS se fait dans l'app navigateur (`terrain.pestai.africa`), le module natif d'Expo viendra avec les stores ; **vérification OTP par SMS reportée** par le fondateur (D-14).

## J18b — Accès, agents et foncier (livré)

Décisions du fondateur du 24/11/2026.

| Livré | Vérification |
|---|---|
| **Web OS réservé** à l'administration PEST AI, aux administrateurs et gérants d'organisation, aux agronomes et aux gestionnaires de programme. Agent terrain ou producteur : connexion refusée avec renvoi vers l'app terrain ; session existante effacée ; espaces sans rôle de gestion masqués | 2 tests unitaires, parcours navigateur |
| **Agents terrain gérés par PEST AI seulement** : une organisation ne peut ni inviter un agent, ni lui attribuer ou retirer un rôle, ni le suspendre, ni lui renvoyer un code (403) ; elle voit ses agents (« Géré par PEST AI ») | 3 tests API |
| Console d'administration : page **Agents terrain** (création et affectation à une coopérative, filtre par coopérative, nouveau code, suspension, retrait) ; message WhatsApp avec lien d'activation de l'app terrain qui préremplit le numéro. API `/api/v1/platform/agents/` | 5 tests API, parcours navigateur |
| **Pays : Afrique de l'Ouest seulement** (16 pays, Mauritanie comprise). Côte d'Ivoire et Bénin : le 0 initial fait partie du numéro (10 chiffres). Un numéro étranger déjà enregistré reste conservé tel quel | 9 + 9 tests unitaires |
| **Foncier à l'enrôlement** : propriétaire (l'exploitant, une autre personne, ne sait pas), type de droit, mode d'exploitation (location, métayage, prêt) ; enregistré avec la parcelle, statut « déclarée ». API : champs `ownership` et `arrangement_type` à la création | 3 tests API, parcours navigateur |

Hors J18b (propositions à valider) : rôle d'administrateur plateforme distinct du super-administrateur ; code PIN à 6 chiffres pour les agents ; espace agronome ; données sol et eau (addendum v2.3 du Design).

## Reporté (prévu par le Design, dépend d'autres apps)

- `AgriculturalCampaign.program` : avec les programmes.
- `AgriculturalOperation.product` : avec le catalogue de produits (texte libre `product_text` en attendant).
- `source_device` : avec la synchronisation (J20).
- Unités de culture avec contour (relevé GPS, dessin Web OS, contrôle d'inclusion D-16) puis cycles, opérations et récoltes dans l'app terrain : J19.
- Enrôlement hors ligne et synchronisation : J20.
- Vérification OTP par SMS (D-14) : reportée par le fondateur.

## À valider par le fondateur

1. **Matrice des droits Agriculture** (tableau de `docs-site/docs/agriculture.md`).
2. **Libellés des saisons** (D-18) et noms des cultures en wolof et en pulaar : relecture par l'agronome.
3. **Règles ajoutées au Design** : une opération a au moins une date (réalisée ou prévue) ; une récolte ne se déclare pas avant le semis ni dans le futur ; un cycle ne démarre pas dans une campagne clôturée.
