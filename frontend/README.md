# PEST AI OS — Web OS (frontend)

Application web de PEST AI OS : un seul site, un espace par rôle.

| Espace | Rôles |
|---|---|
| Console Admin PEST AI | `super_admin` |
| Espace Coopérative | `organization_admin`, `cooperative_manager` |
| Espace Agronome | `agronomist` |
| Espace ONG | `program_manager` |

**Technologies :** Next.js 16 (App Router), TypeScript, Tailwind CSS 4 (thème du [Design System PEST AI OS](../docs/07-design/README.md)), polices Montserrat / Inter / IBM Plex Mono auto-hébergées (`@fontsource`), composants de type shadcn/ui, client API typé généré depuis OpenAPI (`openapi-typescript` + `openapi-fetch`). Hébergement : Vercel ([ADR-0004](../docs/01-architecture/adr/0004-frontend-nextjs.md)).

## Démarrer

```bash
cd frontend
cp .env.example .env.local     # API_BASE_URL=http://127.0.0.1:8000
pnpm install
pnpm dev                       # http://localhost:3000
```

L'API locale doit tourner (`make serveur` depuis la racine). Depuis la racine : `make web`.

## Parcours actuel (J7)

1. `/connexion` : numéro de téléphone (indicatif +221 ajouté automatiquement à un numéro sénégalais) + mot de passe.
2. `/espaces` : choix de l'organisation (adhésions actives de `/api/v1/me/`) ; carte « Console d'administration » si `is_platform_admin`.
3. `/tableau-de-bord` : vue d'ensemble de l'espace (navigation latérale, indicateurs, organisation, rôles).
4. `/admin/organisations` : Console Admin, liste des organisations (super-admin uniquement, `GET /api/v1/platform/organizations/`).
5. `/equipe` : membres et invitations de l'organisation (administrateur et gérant) ; actions serveur dans `src/app/equipe/actions.ts`.
6. `/activer` : page publique d'activation d'un compte invité (numéro + code + mot de passe choisi).

Les entrées de navigation marquées « Bientôt » arrivent avec les jours suivants du planning (registre AgroID, campagnes, terrain).

## Session et sécurité ([ADR-0008](../docs/01-architecture/adr/0008-session-web-cookies-httponly.md))

- Le navigateur n'appelle **jamais** l'API directement : le serveur Next.js le fait pour lui.
- Les jetons JWT sont stockés dans des **cookies httpOnly** (`pestai_access`, `pestai_refresh`), illisibles par le code JavaScript de la page ; l'espace choisi dans `pestai_workspace`.
- `src/proxy.ts` protège les pages et **renouvelle automatiquement** le jeton d'accès avant expiration.
- L'API revérifie l'adhésion et les droits à chaque requête : les cookies n'accordent aucun droit par eux-mêmes.

## Structure

```
src/
├── app/
│   ├── connexion/            Page de connexion
│   ├── espaces/              Choix de l'espace de travail
│   ├── tableau-de-bord/      Vue d'ensemble de l'espace
│   ├── admin/organisations/  Console Admin : organisations
│   ├── equipe/               Membres et invitations (actions serveur, fenêtres)
│   ├── activer/              Activation d'un compte invité (page publique)
│   └── api/session/          login, logout, workspace (formulaires → cookies)
├── components/
│   ├── app-shell.tsx         Navigation latérale, fil d'Ariane, en-tête de page, indicateurs
│   ├── logo.tsx              Logo officiel PEST AI (public/brand/)
│   ├── agroid-badge.tsx      Identifiant AgroID (élément signature)
│   └── ui/                   Bouton, champ, badge, alerte, carte
├── lib/
│   ├── api/client.ts         Client API côté serveur (getApi)
│   ├── api/schema.d.ts       Types générés depuis OpenAPI — ne pas modifier
│   ├── session.ts            Cookies, expiration des jetons
│   ├── http.ts               Redirections sur l'origine du navigateur
│   ├── navigation.ts         Menus par espace (entrées « Bientôt » sans lien)
│   ├── phone.ts              Saisie du numéro → format international E.164
│   └── spaces.ts             Rôles → espaces, libellés français, initiales, dates
└── proxy.ts                  Contrôle d'accès et renouvellement des jetons
```

## Appeler l'API (composant serveur)

```ts
const api = await getApi();
const { data: me } = await api.GET("/api/v1/me/");
const { data: org } = await api.GET("/api/v1/organization/", {
  params: { header: { "X-Workspace": workspace } },   // exigé par le type : impossible à oublier
});
```

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm gen:api` | Régénère `src/lib/api/schema.d.ts` depuis `docs-site/static/openapi.yaml` |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Contrôles (aussi : `make web-verifier`) |
| `pnpm build` | Build de production |

Après une modification de l'API : `make api-types` (régénère le schéma puis les types). La CI refuse des types obsolètes.

## Design

- Le style suit le **Design System PEST AI OS** et les maquettes validées le 23/11/2026 ([docs/07-design](../docs/07-design/README.md)).
- Couleurs et polices : uniquement via les tokens de `src/app/globals.css` (`bg-brand-800`, `text-muted`, `font-display`…). Jamais de couleur hexadécimale en dur dans un composant.
- Titres en Montserrat (`font-display`), texte en Inter, identifiants (AgroID, coordonnées) en IBM Plex Mono (`font-mono`). Montserrat et Inter couvrent les lettres du pulaar (ɓ, ɗ, ŋ, ƴ).
