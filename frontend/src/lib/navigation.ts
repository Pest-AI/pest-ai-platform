/**
 * Navigation latérale du Web OS, par espace.
 * Une entrée sans `href` n'est pas encore livrée : elle s'affiche « Bientôt » et n'est pas cliquable.
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
  | "map";

export type NavItem = { label: string; icon: NavIcon; href?: string };
export type NavSection = { title?: string; items: NavItem[] };

export const COOPERATIVE_NAV: NavSection[] = [
  { items: [{ label: "Vue d'ensemble", icon: "home", href: "/tableau-de-bord" }] },
  {
    title: "Registre AgroID",
    items: [
      { label: "Carte des parcelles", icon: "map" },
      { label: "Parcelles", icon: "fingerprint" },
      { label: "Producteurs", icon: "users" },
      { label: "Unités de culture", icon: "layers" },
    ],
  },
  {
    title: "Campagnes",
    items: [
      { label: "Campagnes et cycles", icon: "calendar" },
      { label: "Opérations et récoltes", icon: "wheat" },
    ],
  },
  {
    title: "Terrain",
    items: [
      { label: "Missions et visites", icon: "route" },
      { label: "Observations", icon: "eye" },
      { label: "Santé des cultures", icon: "leaf" },
    ],
  },
  {
    title: "Organisation",
    items: [
      { label: "Membres et invitations", icon: "mail", href: "/equipe" },
      { label: "Rapports", icon: "chart" },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  {
    items: [
      { label: "Organisations", icon: "building", href: "/admin/organisations" },
      { label: "Utilisateurs", icon: "users" },
      { label: "Invitations", icon: "mail" },
    ],
  },
  {
    title: "Sécurité",
    items: [
      { label: "Rôles et permissions", icon: "shield" },
      { label: "Journal d'audit", icon: "scroll" },
    ],
  },
];
