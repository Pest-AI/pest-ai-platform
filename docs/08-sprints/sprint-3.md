# Sprint 3 — Parcelles et AgroID (J11 → J15b)

Jalon JAL-04 « AgroID ». Revue préparée le 24/11/2026 (sprint planifié du 07 au 11/12/2026 : environ deux semaines d'avance).

## Livré

| Jour | Contenu | Critère du plan | Vérification |
|---|---|---|---|
| J11 | Parcelle, AgroID `PAI-SN-XXXXXXXX` (tirage cryptographique, D-05), contours versionnés | AgroID unique, permanent, jamais réattribué | Tests ; garanties PostgreSQL (AgroID non modifiable, aucune suppression) |
| J12 | Propriété, exploitation, liens aux organisations (accord du producteur), accès personnels, unités ; contrôle des contours (D-19) | Propriété et exploitation distinctes et historisées ; contours suspects signalés | Tests ; historique jamais supprimé (PostgreSQL) |
| J13 | API `/api/v1/parcels/` dans les deux espaces, carte GeoJSON par emprise, documentation | GeoJSON valide ; filtre `bbox` ; 404 hors périmètre ; documentation à jour | 31 tests d'API ; guide « Parcelles et AgroID » |
| J14 | Carte des parcelles (vue d'ensemble), page Parcelles & AgroID, fiche parcelle, décision sur un contour signalé | Parcelles de l'organisation sur la carte ; fiche avec AgroID et historique | Contrôles dans un navigateur ; 2 tests Playwright |
| J15 | Parcelles dans l'app terrain, consultables hors ligne | Parcelles consultables hors ligne après un premier chargement | Test navigateur en mode avion (liste, carte, fiche), effacement à la déconnexion |
| J15b | Import de parcelles par fichier (KML, KMZ, Shapefile, GeoJSON, CSV) avec aperçu | Aucune parcelle créée avant confirmation ; rapport CSV avec les AgroID | 26 tests (formats, sécurité des fichiers, aperçu, confirmation, droits) ; parcours navigateur complet |

Tests au 24/11 : backend 322, Web OS 31 + 14 de bout en bout, app terrain 24.

## À valider par le fondateur

1. **Matrice des droits Parcelles** (proposée au J13) : l'agronome tranche les contours signalés ; l'agent terrain enregistre et relève, sans gérer propriété ni exploitation.
2. **Seuils D-19** à confirmer sur le terrain (pilote) : 50 m² minimum (petits maraîchages des Niayes), 50 ha maximum, précision GPS 10 m, chevauchement 5 %.
3. **Test sur appareil** : PWA `terrain.pestai.africa` sur un Android d'entrée de gamme, en mode avion (plan : MVP-44).

## Reporté

| Élément | Vers |
|---|---|
| Relevé du contour depuis le téléphone (GPS) et création de parcelle sur le terrain | Collecte terrain (sprint 4, avec la synchronisation J18) |
| Copie hors ligne sur l'app installée (SQLite) ; la PWA utilise déjà IndexedDB | J18 |
| Contour des unités de culture (inclusion à 1 m près, D-16) | Saisie sur la carte |
| Expiration des demandes de suivi sans réponse (30 jours, D-03) et notification au producteur | Notifications |
| Zones administratives et agro-écologiques des parcelles | App `geo` |
| Fond satellite hors ligne dans l'app terrain | Après le MVP (stockage des tuiles, licence) |

## Décision

Sprint 3 : **à valider** par le fondateur après le test sur appareil et la confirmation des deux points ci-dessus.
