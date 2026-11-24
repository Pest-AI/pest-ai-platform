/**
 * Contexte commun d'une page d'organisation du Web OS (J17) : session, organisation active,
 * rôles et permissions de l'espace. Redirige si la session ou l'espace manquent.
 * L'API revérifie tout à chaque appel ; ces données servent seulement à l'affichage.
 */
import "server-only";

import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { ORGANIZATION_TYPE_LABELS, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

export async function loadOrgContext() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, contextResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/workspace/", { headers: header }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const permissions = new Set(contextResult.data?.permissions ?? []);
  return {
    api,
    header,
    org,
    typeLabel,
    can: (code: string) => permissions.has(code),
    shell: {
      workspace: { name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) },
      user: { firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) },
    },
  };
}
