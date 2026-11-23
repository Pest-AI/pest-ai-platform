# App `actors` — Producteurs

Domaine 3 du Database Design v2.2 (« Producteurs, agents et agronomes »), livré au J9 pour la partie producteurs.

| Modèle | Rôle |
|---|---|
| `Producer` | Profil central du producteur, distinct du compte `User` (BASE, ARCH, SYNC). Cas A : inscrit par une organisation (`registration_channel = organization`, compte facultatif). Cas B : inscrit lui-même (`self_signup`, compte obligatoire, sans organisation). |
| `ProducerContact` | Moyens de contact ; un seul contact principal. |
| `ProducerOrganizationAssignment` | Rattachement historisé à une organisation (jamais supprimé : clos par `end_date`). Seule voie de visibilité d'un producteur par une organisation. |

## Règles

- **Visibilité** : `selectors.visible_producers(org)` = rattachement actif ; tout autre identifiant renvoie 404.
- **Doublons (D-28)** : à la création, même téléphone ou même nom dans la même localité → 409 avec des candidats minimaux (prénom + initiale, localité, 2 derniers chiffres du téléphone). Rattacher (`/producers/attach/`) ou confirmer (`confirm_new`).
- **Indépendant (cas B)** : une organisation ne peut ni le rattacher seule (son accord sera nécessaire, avec les consentements) ni modifier son profil.
- **Rôle `producer`** : attribuable seulement si le compte du membre est lié à une fiche rattachée à l'organisation ; retiré à la clôture du rattachement.
- **Espace personnel** : `X-Workspace: personal` exige un profil `Producer` actif lié au compte ; il donne les 9 permissions `personal.*` (D-11), jamais un rôle.

## Reporté

- `Producer.locality_zone` (FK `geo.GeographicZone`) : avec l'app `geo` ; `locality_text` en attendant.
- `source_device` (SYNC) : J18, avec `Device`.
- `FieldAgent`, `AgronomistProfile`, `AgronomistAssignment` (MVP-25) : avec les missions (J17) et la revue des diagnostics (J21).
- Fusion de doublons : hors MVP (D-28).
