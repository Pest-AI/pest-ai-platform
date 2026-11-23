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

## Structure des écrans (maquette AI Studio, 23/11 au soir)

Toutes les pages de travail reprennent la structure et la police de la maquette Google AI Studio du fondateur :
- **barre latérale** vert forêt : logo + « Espace … », carte « Périmètre actif », liste plate, élément actif en pastille blanche, « Aide et support » et « Paramètres » en bas ;
- **barre du haut** : espace actif / page, recherche globale (producteurs), notifications, menu profil ;
- **en-tête de page** : ligne de contexte (organisation · type), titre, sous-titre, actions (Exporter, action principale) ;
- **indicateurs** : étiquette, chiffre en IBM Plex Mono, précision colorée, icône à droite ;
- **carte de filtres** : recherche, compteur « n sur N », bascule Tableau / Cartes, filtres (listes déroulantes ou onglets avec compteurs) ;
- **tableaux** : identifiants et téléphones en police à chasse fixe, pastilles de statut, bouton « Profil » / « Gérer ».

Restent hors de cette structure (validés tels quels) : connexion, activation, choix de l'espace et fond photo de la vue d'ensemble.

Typographie (décision du fondateur, 23/11 au soir, remplace Montserrat + Inter) : **Century Gothic** comme la maquette AI Studio, sur toute l'application. Elle n'est jamais téléchargée par le site (licence web payante) : elle s'affiche si l'appareil l'a (Windows et Mac avec Office) ; sinon **Questrial**, sa version libre auto-hébergée. Chiffres et identifiants : **JetBrains Mono**. Tailles : titres de page 26–28 px, titres de carte 16–18 px, texte 14 px, étiquettes 12–13 px ; pas d'espacement négatif entre les lettres (police large). Attention : ni Century Gothic ni Questrial ne couvrent sûrement les lettres du pulaar (ɓ, ɗ, ŋ, ƴ), qui s'afficheront dans la police de secours.

## Navigation (plan MVP)

| Espace | Entrées | Livraison |
|---|---|---|
| Coopérative | Vue d'ensemble · Parcelles & AgroID · Producteurs · Campagnes · Observations terrain · Diagnostics · Équipe | J9 → J23 |
| Console Admin | Organisations · Utilisateurs · Journal d'audit | J8, puis consolidation |

Les modules d'après le MVP (recommandations, programmes ONG, rapports) n'apparaissent qu'une fois planifiés.

## Écrans d'accès

Connexion et activation partagent `AuthLayout` : mobile = bandeau visuel + feuille blanche ; tablette = visuel plein écran + carte flottante ; ordinateur = panneau visuel à gauche, formulaire à droite.

## Typographie

Voir « Structure des écrans » ci-dessus : Century Gothic (ou Questrial) et JetBrains Mono depuis le 23/11 au soir.

## Sources

| Source | Contenu |
|---|---|
| Design System PEST AI OS (artifact claude.ai) | Tokens (couleurs clair/sombre, typographie, espacements, rayons), règles d'usage du logo, ton et contenu |
| Projet Subframe « PEST AI OS » | Maquettes validées : connexion, choix de l'espace, vue d'ensemble coopérative, fiche parcelle AgroID, ONG, Console Admin, explorateur cartographique |
| `frontend/src/app/globals.css` | Les mêmes tokens, appliqués au Web OS |
| `frontend/public/brand/` | Logo officiel (complet et symbole) |

Toute nouvelle couleur ou taille est d'abord ajoutée au Design System, puis aux tokens du code.
