// @ts-check
// Portail de documentation développeurs de PEST AI OS.
// Guides (Markdown, dossier docs/) + référence API interactive (Scalar, schéma static/openapi.yaml).

const scalarThemeCss = require("./src/css/scalar-theme.js");

// Serveurs proposés dans la référence API (bouton « Send »).
const apiServers = [
  { url: "https://api-staging.pestai.africa", description: "Staging" },
  { url: "http://127.0.0.1:8000", description: "Serveur local" },
];

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "PEST AI OS — Documentation développeurs",
  tagline: "Guides et référence de l'API PEST AI OS",
  url: process.env.DOCS_SITE_URL || "https://docs.pestai.africa",
  baseUrl: "/",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: "fr", locales: ["fr"] },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: "/", // les guides sont la page d'accueil
          sidebarPath: "./sidebars.js",
          editUrl: "https://github.com/Pest-AI/pest-ai-platform/edit/main/docs-site/",
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      }),
    ],
  ],

  plugins: [
    [
      "@scalar/docusaurus",
      {
        label: "Référence API",
        route: "/reference",
        showNavLink: true,
        configuration: {
          url: "/openapi.yaml",
          servers: apiServers,
          defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
          customCss: scalarThemeCss,
        },
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "PEST AI OS",
        items: [
          { type: "docSidebar", sidebarId: "guides", position: "left", label: "Guides" },
          {
            href: "https://github.com/Pest-AI/pest-ai-platform",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        copyright: `© ${new Date().getFullYear()} Ecliptix SAS — PEST AI. Documentation interne.`,
      },
      colorMode: { respectPrefersColorScheme: true },
    }),
};

module.exports = config;
