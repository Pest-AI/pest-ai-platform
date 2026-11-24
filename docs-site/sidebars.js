// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guides: [
    "intro",
    "premiers-pas",
    {
      type: "category",
      label: "Utiliser l'API",
      collapsed: false,
      items: ["authentification", "espaces-de-travail", "roles-et-permissions", "producteurs", "parcelles", "agriculture", "conventions"],
    },
    "contribuer",
  ],
};

module.exports = sidebars;
