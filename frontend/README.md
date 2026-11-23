# PEST AI OS — Web OS (frontend)

Application web de PEST AI OS : un seul site, un espace par rôle.

| Espace | Rôles |
|---|---|
| Console Admin PEST AI | `super_admin` |
| Espace Coopérative | `organization_admin`, `cooperative_manager` |
| Espace Agronome | `agronomist` |
| Espace ONG | `program_manager` |

**Technologies :** Next.js 16 (App Router), TypeScript, Tailwind CSS 4 (charte PEST AI), composants de type shadcn/ui, client API typé généré depuis OpenAPI (`openapi-typescript` + `openapi-fetch`). Hébergement : Vercel ([ADR-0004](../docs/01-architecture/adr/0004-frontend-nextjs.md)).

## Démarrer

```bash
cd frontend
cp .env.example .env.local     # API_BASE_URL=http://127.0.0.1:8000
pnpm install
pnpm dev                       # http://localhost:3000
```

L'API locale doit tourner (`make serveur` depuis la racine). Depuis la racine : `make web`.

## Parcours actuel (J6)

1. `/connexion` : numéro de téléphone + mot de passe.
2. `/espaces` : choix de l'organisation (adhésions actives renvoyées par `/api/v1/me/`).
3. `/tableau-de-bord` : organisation active, rôles, espaces accessibles.

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
│   ├── tableau-de-bord/      Accueil de l'espace
│   └── api/session/          login, logout, workspace (formulaires → cookies)
├── components/               Marque, en-tête, composants d'interface (ui/)
├── lib/
│   ├── api/client.ts         Client API côté serveur (getApi)
│   ├── api/schema.d.ts       Types générés depuis OpenAPI — ne pas modifier
│   ├── session.ts            Cookies, expiration des jetons
│   ├── http.ts               Redirections sur l'origine du navigateur
│   └── spaces.ts             Rôles → espaces, libellés français
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
