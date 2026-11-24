---
sidebar_position: 6
---

# Parcelles et AgroID

Chaque parcelle reçoit un **AgroID**, son identité numérique permanente : `PAI-SN-7K4M9X2Q`. Il est attribué par le serveur, n'est jamais modifié et n'est jamais redonné à une autre parcelle, même si celle-ci est retirée. Il est distinct de l'`id` technique (UUID) et indépendant du propriétaire comme de l'exploitant.

Toutes les routes demandent un jeton et l'en-tête `X-Workspace`.

## Qui voit quoi

| Espace | Parcelles visibles | Modification |
|---|---|---|
| `org:<uuid>` | Parcelles que l'organisation **suit** (enregistrées par elle, ou suivies avec accord) | Seulement les parcelles qu'elle a enregistrées ; une organisation d'accompagnement consulte |
| `personal` | Parcelles auxquelles le producteur a un **accès personnel** | Ses propres déclarations (`access: "manage"`) |

Une parcelle hors de votre périmètre renvoie **`404`** : son existence n'est jamais révélée. Le champ `access` de la fiche (`view` ou `manage`) indique ce que l'espace actif peut faire.

## Routes

| Méthode et route | Rôle |
|---|---|
| `GET /api/v1/parcels/` | Liste paginée (50). Filtres : `q` (AgroID ou nom), `status`, `producer` (exploitant en cours), `bbox` |
| `GET /api/v1/parcels/map/?bbox=…` | Contours pour la carte (GeoJSON `FeatureCollection`) |
| `POST /api/v1/parcels/` | Enregistrer une parcelle (AgroID attribué) |
| `GET /api/v1/parcels/{id}/` | Fiche : contour courant, contrôle, propriétaires, exploitants, unités |
| `PATCH /api/v1/parcels/{id}/` | Renommer (`local_name`) |
| `POST /api/v1/parcels/{id}/geometries/` | Nouveau contour (nouvelle version) |
| `GET /api/v1/parcels/{id}/history/` | Toutes les versions du contour, propriétaires et exploitants passés |
| `POST /api/v1/parcels/{id}/geometries/{geometry_id}/review/` | Trancher un contour signalé (`valid` ou `rejected`) |
| `POST /api/v1/parcels/{id}/owners/` · `…/owners/{owner_id}/end/` | Propriétaire : ajouter, clore |
| `POST /api/v1/parcels/{id}/operators/` · `…/operators/{operator_id}/end/` | Exploitant : désigner, clore |
| `POST /api/v1/parcels/{id}/units/` · `…/units/{unit_id}/retire/` | Unités de culture |
| `POST /api/v1/parcels/{id}/retire/` | Retirer la parcelle (AgroID conservé) |
| `POST /api/v1/parcels/link-requests/` | Organisation : demander à suivre une parcelle par son AgroID |
| `POST /api/v1/parcels/{id}/personal-access/` · `…/personal-access/{access_id}/revoke/` | Organisation : ouvrir ou retirer l'accès personnel d'un producteur |
| `GET /api/v1/me/parcel-links/` · `POST …/{id}/accept/` · `POST …/{id}/decline/` | Espace personnel : répondre aux demandes de suivi |

## Contours en GeoJSON

Les contours suivent le [GeoJSON (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946) : coordonnées **`[longitude, latitude]`** en WGS 84, anneau **fermé** (le dernier point répète le premier).

- En entrée : `Polygon`, `MultiPolygon` ou `Feature`.
- En sortie : toujours `MultiPolygon`.

```json title="POST /api/v1/parcels/"
{
  "local_name": "Champ du fleuve",
  "capture_method": "gps_walk",
  "gps_accuracy_m": 4.5,
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-14.9600, 16.6500], [-14.9591, 16.6500], [-14.9591, 16.6509],
      [-14.9600, 16.6509], [-14.9600, 16.6500]
    ]]
  }
}
```

Méthodes de relevé (`capture_method`) : `gps_walk` (contour marché), `gps_points`, `manual_drawing` (tracé sur la carte), `import_geojson`, `import_kml`.

La surface (`area_m2`), le périmètre et le point central (`centroid`, garanti à l'intérieur du contour) sont calculés par le serveur. Ne les envoyez pas.

## Carte : emprise (`bbox`)

```http
GET /api/v1/parcels/map/?bbox=-15.1,16.5,-14.8,16.8
```

- `bbox` = `minLon,minLat,maxLon,maxLat` (degrés WGS 84) ; garde les parcelles dont le contour courant touche l'emprise.
- Réponse : `FeatureCollection` ; chaque `Feature` porte `id` et les propriétés `agroid`, `local_name`, `status`, `area_m2`, `validation_status`.
- Au plus **1 000** parcelles : si `truncated` vaut `true`, zoomez.
- Emprise absente ou incohérente : `400` avec un message sur `bbox`.

## Contrôle des contours

| Cas | Réponse |
|---|---|
| Contour impossible : côtés qui se croisent, anneau non fermé, coordonnées hors limites, GeoJSON illisible | **`400`**, rien n'est enregistré : `{"geometry": ["Contour invalide (côtés qui se croisent…) : …"]}` |
| Surface < 50 m² ou > 50 ha, précision GPS > 10 m, chevauchement > 5 % avec une autre parcelle | **`201`**, contour enregistré mais **signalé** ; la parcelle passe `pending_validation` |

La fiche détaille le contrôle dans `current_geometry.validation` : `status`, `flags`, `labels` (motifs lisibles) et `overlaps`. Un chevauchement avec une parcelle hors de votre périmètre est indiqué sans son AgroID (« Parcelle hors de votre périmètre »). Une personne habilitée (`parcels.validate_geometry`) tranche ensuite avec `…/review/`.

## Propriété et exploitation

- **Propriétaire** : exactement un parmi `owner_producer`, `owner_organization` ou `owner_name` (propriétaire non enregistré, par exemple « Famille Diallo »).
- **Exploitant** : un seul exploitant principal à la fois ; `replace_primary: true` clôt le principal en cours. Dans une organisation, l'exploitant doit être un producteur rattaché.
- Un changement = **clore** la relation en cours, puis en créer une nouvelle. L'historique n'est jamais réécrit ni supprimé.
- **Ni la propriété ni l'exploitation ne donnent accès à la parcelle.**
- Dans l'espace personnel, seules les relations qui concernent le producteur lui-même apparaissent.

## Suivi par une organisation et accès personnel

1. Le producteur communique l'AgroID de sa parcelle ; l'organisation appelle `POST /api/v1/parcels/link-requests/` avec `{"agroid": "…"}`.
2. Parcelle déclarée par le producteur : la demande reste **en attente** ; l'organisation ne voit rien.
3. Le producteur l'accepte ou la refuse dans son espace (`/api/v1/me/parcel-links/`). Accepté : l'organisation suit la parcelle, **en lecture**. Rien de l'espace personnel ne lui est transmis.

Une organisation qui suit une parcelle peut aussi ouvrir à un producteur rattaché (avec un compte) l'accès **en consultation** dans son espace personnel (`…/personal-access/`), et le lui retirer avec un motif.

## Saisie dans le Web OS

Pour une parcelle notée sur papier ou relevée hors de l'app terrain (**Parcelles & AgroID → Nouvelle parcelle**). L'agent de terrain reste le moyen principal d'enregistrement.

| Mode | Envoi à l'API | Contour |
|---|---|---|
| Tracer sur la carte | `geometry`, `capture_method: "manual_drawing"` | À confirmer par un relevé terrain |
| Saisir des coordonnées (décimales ou degrés-minutes-secondes, latitude d'abord) | `geometry`, `capture_method: "manual_coordinates"` | À confirmer par un relevé terrain |
| Position seulement | `position: [longitude, latitude]` | À relever |
| Sans localisation | ni l'un ni l'autre | À relever |

`operator` (facultatif) désigne l'exploitant principal dès la création ; parcelle et exploitant sont enregistrés ensemble, ou pas du tout.

**Relevé terrain (décision du 24/11/2026).** Un contour tracé à la main, saisi en coordonnées ou importé est signalé « À confirmer par un relevé terrain » : la parcelle reste « à vérifier » jusqu'à un nouveau contour relevé au GPS (`gps_walk`, `gps_points`) ou la décision d'une personne habilitée (`…/review/`). Liste des méthodes concernées réglable par `PARCEL_FIELD_SURVEY_REQUIRED_METHODS`.

## Import par fichier

Enregistre plusieurs parcelles à la fois. Espace d'organisation seulement, permission `parcels.manage` (administrateur et gérant). Dans le Web OS : **Parcelles & AgroID → Importer un fichier**.

| Format | Contenu attendu |
|---|---|
| KML, KMZ | Polygones (Google Earth, application GPS). Le nom du polygone devient le nom de la parcelle. |
| Shapefile | Archive `.zip` avec `.shp`, `.shx`, `.dbf` **et `.prj`** (sans projection : refusé). Toute projection est convertie en WGS 84. |
| GeoJSON | `FeatureCollection` de polygones ou de points. |
| CSV | Colonne `wkt` (contour), ou `latitude` et `longitude` (point : contour à relever). Séparateur `,` ou `;`, virgule décimale acceptée. |

Limites : 10 Mo, 1 000 parcelles par fichier. KML déclarant des entités XML refusé ; dans une archive, chemins sortants ignorés, 40 fichiers et 60 Mo décompressés au plus.

**Rien n'est créé avant la confirmation.**

1. `POST /api/v1/parcel-imports/` (multipart, champ `file`) : lit le fichier et renvoie l'aperçu (`rows`). Chaque ligne est `ok` (prête), `flagged` (à vérifier : surface hors bornes, chevauchement > 5 % avec une parcelle existante ou une autre ligne, exploitant introuvable) ou `refused` (géométrie absente ou impossible, doublon dans le fichier).
2. `POST …/{id}/preview/` : choisit la colonne du nom (`name_column`) et celle de l'exploitant (`operator_column`, avec `operator_key` = `membership_number` ou `phone`). Un numéro local à 9 chiffres est lu comme sénégalais (+221).
3. `POST …/{id}/commit/` : crée les lignes `ok` (et `flagged` si `include_flagged: true`) en une seule fois, chacune avec son AgroID ; l'exploitant reconnu devient exploitant principal. Le bilan ligne par ligne (`report`, avec les AgroID) reste consultable ; les contours du fichier ne sont plus conservés.
4. `POST …/{id}/discard/` : abandonne l'aperçu.

Les contours importés sont « à confirmer par un relevé terrain ». Un import n'est jamais supprimé. Le Web OS propose un **rapport CSV** (séparateur `;`, ouvrable dans Excel) avant et après confirmation.
