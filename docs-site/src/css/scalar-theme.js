// Habillage de la référence API (Scalar) aux couleurs de la charte PEST AI.
// Partagé par le portail (docusaurus.config.js) ; une copie équivalente est intégrée
// à la page servie par le backend (backend/templates/docs/scalar.html).
module.exports = `
.light-mode {
  --scalar-color-1: #0b1929;
  --scalar-color-2: #3d4b44;
  --scalar-color-3: #5b6b63;
  --scalar-color-accent: #3a9442;
  --scalar-background-1: #ffffff;
  --scalar-background-2: #f3f7f5;
  --scalar-background-3: #e3f1e4;
  --scalar-background-accent: #e3f1e4;
  --scalar-border-color: #d5dcd8;
}
.dark-mode {
  --scalar-color-1: #f3f7f5;
  --scalar-color-2: #c9d4ce;
  --scalar-color-3: #9fb0a7;
  --scalar-color-accent: #e8aa17;
  --scalar-background-1: #0b1929;
  --scalar-background-2: #12253a;
  --scalar-background-3: #184429;
  --scalar-background-accent: #184429;
  --scalar-border-color: #23384f;
}
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
}
.light-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: #f3f7f5;
}
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: #0b1929;
}
`;
