# App `parcels` — Parcelles et AgroID

Domaine 4 du Database Design v2.2 (« Parcelles, AgroID et géographie »). Identité et contours au J11 (MVP-34, MVP-35) ; relations foncières, accès et contrôle des contours au J12 (MVP-36, MVP-37).

| Modèle | Rôle |
|---|---|
| `Parcel` | Parcelle identifiée par un **AgroID** permanent (BASE, ARCH, SYNC). Ne porte ni propriétaire ni exploitant. Origine : une organisation (`organization`) ou le producteur lui-même (`producer_self`). Statuts : `draft`, `pending_validation`, `active`, `retired`. |
| `ParcelGeometry` | Versions successives du contour (MultiPolygon WGS 84). Une seule version courante ; append-only. Surface, périmètre et point central calculés par PostGIS. |
| `ParcelOwnership` | Propriétaire ou droit foncier, daté : producteur, organisation ou simple nom déclaré (D-07). |
| `ParcelOperatorAssignment` | Exploitant effectif, daté. Un seul principal à la fois, co-exploitants possibles (D-06). |
| `ParcelOrganizationLink` | Organisation qui suit la parcelle. **Seule source de visibilité pour une organisation.** |
| `ProducerParcelAccess` | Accès **personnel** d'un producteur (espace personnel), explicite et révocable (D-02). |
| `CultivationUnit` | Unité de culture (U1, U2…) déclarée par son code et sa surface (D-16). |

## AgroID (F-08, D-05)

- Format **`PAI-SN-XXXXXXXX`** : 8 caractères tirés par un générateur cryptographique dans l'alphabet base32 Crockford (sans I, L, O, U). Exemple : `PAI-SN-7K4M9X2Q`.
- Attribué **par le serveur** : à la création en ligne, ou à la synchronisation d'un brouillon saisi hors ligne (`services.assign_agroid`). Collision : nouveau tirage (contrainte UNIQUE).
- **Distinct de l'UUID**, indépendant du propriétaire et de l'exploitant.
- **Jamais modifié, jamais réattribué** : PostgreSQL refuse tout changement d'un AgroID attribué et toute suppression de parcelle (triggers, migration `0002`). Une parcelle retirée garde son AgroID à vie.
- Saisie humaine tolérée par `selectors.by_agroid` : minuscules, espaces, tirets oubliés, O pour 0, I ou L pour 1.

## Contours

- Entrée GeoJSON `Polygon`, `MultiPolygon` ou `Feature` (longitude, latitude) ; stockage en MultiPolygon SRID 4326.
- Refusés : contour invalide (côtés qui se croisent), vide, hors limites, plus de 5 000 points.
- `services.add_geometry` crée la version suivante ; la précédente est close (`valid_to`) et conservée. `Parcel.current_area_m2` et `Parcel.centroid` reprennent la version courante (lecture rapide pour la carte).
- PostgreSQL refuse la suppression d'une version et toute modification de son contour ; seuls les champs de contrôle (`validation_status`, `validated_by`…) évoluent.

## Qui voit quoi (F-06, D-02, D-03)

- **Une organisation** voit une parcelle si et seulement si elle a un lien **actif et ouvert** (`selectors.visible_parcels`). L'organisation qui enregistre reçoit ce lien automatiquement (`registering`).
- **Parcelle déclarée par le producteur** : une organisation peut demander à la suivre ; le lien reste « en attente » sans aucun accès tant que le producteur n'a pas accepté (`consent_organization_link`). Refus : lien clos.
- **Un producteur** voit une parcelle dans son espace personnel si et seulement s'il a un accès personnel ouvert (`selectors.personal_parcels`) : `manage` pour ses propres déclarations, `view` quand une organisation qui suit la parcelle le lui accorde. La revendication vérifiée (`verified_claim`) n'existe pas au MVP.
- **Propriété et exploitation n'ouvrent jamais d'accès**, et l'une ne vaut jamais l'autre.

## Propriété et exploitation (F-09)

- Chaque relation a une date de début et, une fois close, une date de fin. Un changement clôt la ligne et en crée une nouvelle : l'historique n'est jamais écrasé. Les champs de fond sont figés ; seuls le statut de vérification et la date de fin évoluent.
- Une déclaration du producteur reste « déclarée » : il ne peut ni la justifier ni la confirmer lui-même (contrainte en base pour l'exploitation).
- PostgreSQL refuse toute suppression dans ces tables (migration `0004`).

## Contrôle des contours (D-19)

| Contrôle | Seuil de départ (`PARCEL_GEOMETRY_RULES`) | Résultat |
|---|---|---|
| Côtés qui se croisent, anneau non fermé, SRID ≠ 4326 | — | **Refusé** : jamais enregistré |
| Surface | < 50 m² ou > 50 ha | Signalé |
| Précision GPS déclarée | > 10 m | Signalé |
| Chevauchement avec le contour courant d'une autre parcelle non retirée | > 5 % de la surface | Signalé |

- Un contour **signalé** est enregistré (le terrain n'est jamais bloqué) et la parcelle passe « en attente de validation », AgroID compris. Le rapport (`validation_report`) garde les mesures, les chevauchements et les seuils appliqués.
- `review_geometry` : une personne habilitée confirme (`valid`, la parcelle redevient active) ou refuse (`rejected`, motif obligatoire ; un nouveau contour est alors attendu).
- Les seuils se règlent par variables d'environnement (`PARCEL_MIN_AREA_M2`, `PARCEL_MAX_AREA_M2`, `PARCEL_MAX_GPS_ACCURACY_M`, `PARCEL_MAX_OVERLAP_PERCENT`) et seront ajustés après le pilote (petits maraîchages des Niayes).

## Services

| Fonction | Effet |
|---|---|
| `create_parcel(by, organization=… ou producer=…, geometry=…, draft=False)` | Crée la parcelle (et sa version 1 si un contour est fourni) ; AgroID attribué sauf en brouillon |
| `assign_agroid(parcel, by)` | Attribue l'AgroID d'un brouillon ; `draft` → `active` |
| `add_geometry(parcel, geometry, by, capture_method=…)` | Nouveau contour, nouvelle version courante |
| `retire_parcel(parcel, by, reason)` | Retrait (disparue, fusionnée) : `retired` + archivage, AgroID conservé |
| `review_geometry(version, decision, by, note)` | Confirme ou refuse un contour signalé |
| `record_ownership`, `end_ownership`, `set_ownership_verification` | Propriété |
| `assign_operator(…, replace_primary=False)`, `end_operator` | Exploitation |
| `request_organization_link`, `consent_organization_link`, `decline_organization_link`, `end_organization_link` | Suivi par une organisation |
| `grant_personal_access`, `revoke_personal_access` | Accès personnel |
| `create_cultivation_unit`, `retire_cultivation_unit` | Unités de culture |

## À venir

- **J13** : API `/api/v1/parcels/` (création, contour, liste GeoJSON par zone, fiche, historique, propriétaires et exploitants) et permissions, dont `parcels.grant_personal_access` (D-02) et `personal.parcels.consent_link` (D-03). Les rapports de chevauchement n'exposeront jamais l'AgroID d'une parcelle que l'organisation ne voit pas.
- Contour des unités de culture (inclus dans la parcelle à 1 m près, sinon signalé) : avec la saisie sur la carte.
- Expiration des demandes de suivi sans réponse (30 jours proposés, D-03) et notification au producteur : avec les notifications.
- **J14** : couche parcelles sur la carte du Web OS ; **J15** : parcelles dans l'app terrain.
- `administrative_zone`, `agroecological_zone` : avec l'app `geo` ; `source_device` : J18.
- Division et fusion de parcelles : hors MVP (D-29).
