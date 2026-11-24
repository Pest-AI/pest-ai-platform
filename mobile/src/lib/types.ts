/** Types de l'API, générés depuis docs-site/static/openapi.yaml (npm run api:types). */
import type { components } from "./schema";

type S = components["schemas"];
export type Me = S["Me"];
export type MyMembership = S["MyMembership"];
export type Producer = S["Producer"];
export type Organization = S["Organization"];
export type WorkspaceContext = S["WorkspaceContext"];
export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
