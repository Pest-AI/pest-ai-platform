# Design PEST AI OS

Direction validée par le fondateur le **23/11/2026** (J7), révisée le même jour d'après la maquette Google AI Studio (référence de mise en page, pas de contenu).

## Positionnement visuel

PEST AI n'est pas un outil de diagnostic : c'est l'**identité numérique de chaque parcelle** (AgroID). Les écrans mettent d'abord en avant le registre des parcelles, la traçabilité des campagnes et les données terrain ; la santé des cultures est un module parmi d'autres.

## Direction retenue

- **Coquille** : barre latérale **vert forêt** (élément actif en pastille blanche, espace actif en haut, profil en bas), contenu sur fond blanc cassé. Petit écran : barre du haut + tiroir de menu.
- **Couleurs équilibrées** : forêt pour la navigation et le bouton principal ; vert feuille pour les états « actif / sain » ; **or réservé à l'attention** (alertes, invitations, parcelle sélectionnée, focus clavier) ; bleu nuit pour le texte.
- **Peu de texte** : un titre court par page, une ligne de contexte au plus ; indicateurs = un chiffre + une étiquette ; les explications vont dans les états vides et les fenêtres d'action.
- **Indicateurs** en cartes compactes avec une icône discrète ; **listes responsives** (tableau sur écran large, cartes empilées sur mobile, jamais de défilement horizontal).
- **Parcours** : « Pour démarrer » sur la vue d'ensemble (organisation → équipe → producteurs → parcelles) ; chaque module non livré s'affiche « Bientôt ».
- **Visuel parcelles** (`FieldVisual`, SVG) : vue aérienne d'un périmètre irrigué, parcelle AgroID en or. Sert à la connexion, à l'activation, au choix de l'espace et à l'aperçu de carte. Une photo aérienne réelle pourra le remplacer.
- **Carte immersive** et **explorateur** façon Google Earth Engine pour les écrans géographiques (J14) ; couches satellite en Phase 2 (F-02).
- **Puce AgroID** (marine et or, IBM Plex Mono) : élément signature.

## Navigation (plan MVP)

| Espace | Entrées | Livraison |
|---|---|---|
| Coopérative | Vue d'ensemble · Parcelles & AgroID · Producteurs · Campagnes · Observations terrain · Diagnostics · Équipe | J9 → J23 |
| Console Admin | Organisations · Utilisateurs · Journal d'audit | J8, puis consolidation |

Les modules d'après le MVP (recommandations, programmes ONG, rapports) n'apparaissent qu'une fois planifiés.

## Écrans d'accès

Connexion et activation partagent `AuthLayout` : mobile = bandeau visuel + feuille blanche ; tablette = visuel plein écran + carte flottante ; ordinateur = panneau visuel à gauche, formulaire à droite.

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
