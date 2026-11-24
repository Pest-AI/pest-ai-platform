# App `parcels` — Parcelles et AgroID

Domaine 4 du Database Design v2.2 (« Parcelles, AgroID et géographie »), livré au J11 pour l'identité et les contours (MVP-34, MVP-35).

| Modèle | Rôle |
|---|---|
| `Parcel` | Parcelle identifiée par un **AgroID** permanent (BASE, ARCH, SYNC). Ne porte ni propriétaire ni exploitant. Origine : une organisation (`organization`) ou le producteur lui-même (`producer_self`). Statuts : `draft`, `pending_validation`, `active`, `retired`. |
| `ParcelGeometry` | Versions successives du contour (MultiPolygon WGS 84). Une seule version courante ; append-only. Surface, périmètre et point central calculés par PostGIS. |

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

## Services

| Fonction | Effet |
|---|---|
| `create_parcel(by, organization=… ou producer=…, geometry=…, draft=False)` | Crée la parcelle (et sa version 1 si un contour est fourni) ; AgroID attribué sauf en brouillon |
| `assign_agroid(parcel, by)` | Attribue l'AgroID d'un brouillon ; `draft` → `active` |
| `add_geometry(parcel, geometry, by, capture_method=…)` | Nouveau contour, nouvelle version courante |
| `retire_parcel(parcel, by, reason)` | Retrait (disparue, fusionnée) : `retired` + archivage, AgroID conservé |

## À venir

- **J12** : propriété (`ParcelOwnership`), exploitation (`ParcelOperatorAssignment`), liens aux organisations (`ParcelOrganizationLink`), accès personnels (`ProducerParcelAccess`), unités de culture ; contrôles des contours (surface minimale et maximale, chevauchements, statut `flagged`).
- **J13** : API `/api/v1/parcels/` (création, contour, liste GeoJSON par zone, fiche, historique) et permissions.
- **J14** : couche parcelles sur la carte du Web OS ; **J15** : parcelles dans l'app terrain.
- `administrative_zone`, `agroecological_zone` : avec l'app `geo` ; `source_device` : J18.
- Division et fusion de parcelles : hors MVP (D-29).
