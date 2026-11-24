/**
 * Navigation latérale du Web OS, par espace.
 *
 * Les entrées suivent les modules du plan MVP (J9 → J23). Une entrée sans `href`
 * n'est pas encore livrée : elle s'affiche « Bientôt » et n'est pas cliquable.
 * Les modules d'après le MVP (recommandations, programmes, rapports) n'apparaissent
 * pas tant qu'ils ne sont pas planifiés dans le sprint en cours.
 */
export type NavIcon =
  | "home"
  | "fingerprint"
  | "users"
  | "layers"
  | "calendar"
  | "wheat"
  | "route"
  | "eye"
  | "leaf"
  | "chart"
  | "building"
  | "mail"
  | "shield"
  | "scroll"
  | "map"
  | "team";

export type NavItem = { label: string; icon: NavIcon; href?: string };
export type NavSection = { title?: string; items: NavItem[] };

export const COOPERATIVE_NAV: NavSection[] = [
  {
    items: [
      { label: "Vue d'ensemble", icon: "home", href: "/tableau-de-bord" },
      { label: "Parcelles & AgroID", icon: "map", href: "/parcelles" }, // J14
      { label: "Producteurs", icon: "users", href: "/producteurs" }, // J9
    ],
  },
  {
    title: "Production",
    items: [
      { label: "Campagnes", icon: "calendar", href: "/campagnes" }, // J16 → J17
      { label: "Observations terrain", icon: "eye" }, // J17 → J19
      { label: "Diagnostics", icon: "leaf" }, // J21 → J23
    ],
  },
  {
    title: "Organisation",
    items: [{ label: "Équipe", icon: "team", href: "/equipe" }],
  },
];

export const ADMIN_NAV: NavSection[] = [
  {
    items: [
      { label: "Organisations", icon: "building", href: "/admin/organisations" },
      { label: "Agents terrain", icon: "route", href: "/admin/agents" },
      { label: "Utilisateurs", icon: "users" },
    ],
  },
  {
    title: "Sécurité",
    items: [{ label: "Journal d'audit", icon: "scroll" }],
  },
];
