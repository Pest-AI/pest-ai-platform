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

## J18c — Identité du producteur (livré)

Décisions du fondateur du 24/11/2026 (addendum v2.3, partie Producteur).

| Livré | Vérification |
|---|---|
| **Identifiant producteur PEST AI** `PRD-SN-XXXXXXXX` : tiré au hasard (base32 Crockford, comme l'AgroID), unique sur la plateforme, attribué à la création (y compris espace personnel) et aux producteurs existants par la migration ; modification interdite par PostgreSQL ; recherche par identifiant (saisie tolérante) | 4 tests |
| **Numéro d'adhérent obligatoire pour un membre**, unique dans l'organisation, **jamais réutilisé** ; proposé automatiquement « PRÉFIXE-000123 » (préfixe réglable par organisation, sinon déduit du nom court) ; un numéro saisi (numérotation existante) est accepté et fait avancer le compteur ; bénéficiaires et clients sans numéro | 5 tests |
| API : `GET /api/v1/producers/membership-number/` (numéro proposé) ; `member_number_prefix` sur l'organisation | 2 tests |
| **Ménage** : nombre de personnes et d'actifs aux champs (actifs ≤ personnes, contrôlé en base) | 1 test |
| Web OS et app terrain : numéro proposé dans les formulaires, identifiant et ménage sur la fiche ; préfixe à la création d'une organisation | Parcours navigateur |
| Commande `manage.py assign_membership_numbers [--dry-run]` : numéros pour les membres actuels qui n'en ont pas (ajout seulement) | 1 test |

Migrations : `organizations 0002`, `actors 0002` (ajout de colonnes, identifiants des producteurs existants, déclencheur d'immuabilité ; aucune donnée modifiée ni supprimée). Photo du producteur : avec les pièces jointes (J21). Pièce d'identité : non collectée (décision du 24/11).

## J18d — Données d'enrôlement : sol, eau, foncier, cycle (livré)

Addendum v2.3 au Database Design. **Listes proposées, en attente de validation par l'agronome** (Déthié Gueye, Vallée ; Ibrahima Babacar Fall, Niayes) : elles sont servies par l'API (`/api/v1/parcels/site-referentials/`), les apps n'ont pas à être republiées quand elles changent.

| Livré | Vérification |
|---|---|
| **Profil de site historisé** (`ParcelSiteProfile`) : sol (nom local hollaldé, fondé, falo, diéri, dior, deck…, texture, salinité, inondation, pente, fertilité perçue), eau et irrigation (régime, source, mode, aménagement SAED/PIV/privé + nom du périmètre, motopompe, disponibilité), accès (route, distance au village) ; niveau de preuve (déclaré, constaté, mesuré). Chaque mise à jour ajoute une version complète ; PostgreSQL interdit de modifier ou supprimer une version | 4 tests API |
| **Foncier complété** : type de droit « affectation communale (domaine national) » ; conditions d'exploitation (contrepartie en argent, part de récolte, en nature, gratuit ; loyer en FCFA, part en %, fin de l'accord) | 1 test API |
| **Cycle de culture** : origine de la semence, semis direct ou repiquage, saison précédente (culture ou jachère, exclusifs) | 1 test API |
| **Section ou groupement** du membre dans l'organisation | 1 test API |
| **Taux de complétude de la fiche AgroID** : contour relevé, exploitant, foncier, eau, sol, cycle | Tests API, parcours navigateur |
| App terrain : étapes Eau et irrigation, Sol, Accès à l'enrôlement (facultatives, « Ne sait pas » possible) ; contrepartie de la location ; fiche avec complétude et « Sol et eau » ; écran « Sol, eau et accès » pour compléter plus tard | Parcours navigateur |
| Web OS : fiche parcelle avec complétude, « Sol et eau » (mise à jour en fenêtre), mode d'exploitation et contrepartie ; cycle avec semence, implantation, saison précédente ; section du membre | Parcours navigateur |

Migrations : `actors 0003`, `parcels 0009`, `agriculture 0003` (ajouts seulement).

## J19 — Unités de culture, cycles dans l'app terrain, QR code AgroID (livré)

| Livré | Vérification |
|---|---|
| **Unités de culture avec contour** (D-16) : relevé au GPS dans l'app (tour de la zone, coin par coin) avec le contour de la parcelle en repère, ou tracé sur l'image satellite dans le Web OS ; ou surface seule. Code U1, U2… proposé ; surface mesurée par PostGIS. **Contrôle** : inclusion dans la parcelle à 1 m près (`ST_Within(ST_Buffer(unité, −1 m), parcelle)`), chevauchement de plus de 5 % avec une autre unité ; signalé, jamais refusé. Ajout ouvert à l'agent terrain (`parcels.create`) | 5 tests API, parcours navigateur |
| **Cycles dans l'app terrain** : depuis la fiche parcelle, démarrer un cycle (culture, variété, unité, campagne ouverte, semis fait ou prévu, surface, semence, implantation, saison précédente) ; fiche cycle : démarrer, marquer récolté, abandonner ; opérations (type, date, produit, quantité) ; récoltes en sacs × kg ou en kg, mesure déclarée/pesée/estimée ; total et rendement | Parcours navigateur |
| **QR code AgroID** : sur la fiche (app et Web OS) ; **fiche AgroID imprimable** (QR, AgroID en clair, parcelle, exploitant, surface) à plastifier ; lien `terrain.pestai.africa/a/PAI-SN-…` (et `/a/…` dans le Web OS) qui ouvre la fiche si la parcelle est suivie par l'espace | 2 + 1 tests unitaires, parcours navigateur |
| **Scanner** dans l'app : caméra arrière du téléphone (détecteur du navigateur, sinon jsQR), saisie de l'AgroID en secours ; copie locale d'abord (hors ligne), puis l'API | Parcours navigateur (saisie ; caméra non testable en automatique) |

Dépendances ajoutées : `qrcode-generator` 2.0.4 (MIT, sans dépendance ; Web OS et app), `jsqr` 1.4.0 (Apache-2.0, sans dépendance ; app, chargé seulement si le navigateur n'a pas de détecteur de QR code). Aucune migration.

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
