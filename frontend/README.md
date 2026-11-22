# PEST AI OS — Web OS (frontend)

Application web de PEST AI OS, avec un espace par rôle :

| Espace | Rôles |
|---|---|
| Console Admin PEST AI | `super_admin` |
| Espace Coopérative | `organization_admin`, `cooperative_manager` |
| Espace Agronome | `agronomist` |
| Espace ONG | `program_manager` (organisation de type ONG ; données agrégées, sans nominatif) |

**Technologies :** Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, MapLibre. Hébergement : Vercel. Voir [ADR-0004](../docs/01-architecture/adr/0004-frontend-nextjs.md).

Le code arrive au **J6** du planning.
