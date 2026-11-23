# Design PEST AI OS

Direction validée par le fondateur le **23/11/2026** (J7).

## Positionnement visuel

PEST AI n'est pas un outil de diagnostic : c'est l'**identité numérique de chaque parcelle** (AgroID). Les écrans mettent d'abord en avant le registre des parcelles, la traçabilité des campagnes et les données terrain ; la santé des cultures est un module parmi d'autres.

## Direction retenue

- **Base « épurée »** (inspirée de Linear / Stripe) : fond clair, filets fins, typographie précise, couleur rare. Navigation latérale claire.
- **Carte immersive** sur les écrans géographiques (fiche parcelle, registre, vue d'ensemble) : contour de la parcelle en or, unités de culture, frise des campagnes.
- **Explorateur cartographique** façon Google Earth Engine (carte plein écran, couches, inspecteur, console) : version **claire par défaut**, version **sombre en option**. Les couches satellite (Sentinel-2, NDVI, humidité) sont affichées « Phase 2 » (décision F-02).
- **Bandeau vert « vitrine »** réservé à la connexion et aux rapports bailleurs de l'espace ONG.
- **Puce AgroID** (marine et or, police IBM Plex Mono) : élément signature de la marque.

## Typographie

Montserrat pour les titres et chiffres clés, Inter pour le texte, IBM Plex Mono pour les identifiants. Century Gothic reste réservée aux documents imprimés (licence web et mobile payante). Montserrat et Inter couvrent les lettres du pulaar (ɓ, ɗ, ŋ, ƴ) ; IBM Plex Mono ne les couvre pas, elle ne sert qu'aux codes.

## Sources

| Source | Contenu |
|---|---|
| Design System PEST AI OS (artifact claude.ai) | Tokens (couleurs clair/sombre, typographie, espacements, rayons), règles d'usage du logo, ton et contenu |
| Projet Subframe « PEST AI OS » | Maquettes validées : connexion, choix de l'espace, vue d'ensemble coopérative, fiche parcelle AgroID, ONG, Console Admin, explorateur cartographique |
| `frontend/src/app/globals.css` | Les mêmes tokens, appliqués au Web OS |
| `frontend/public/brand/` | Logo officiel (complet et symbole) |

Toute nouvelle couleur ou taille est d'abord ajoutée au Design System, puis aux tokens du code.
