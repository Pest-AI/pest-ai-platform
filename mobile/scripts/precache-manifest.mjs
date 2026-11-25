/**
 * Liste des fichiers de l'app à garder hors ligne (PWA), écrite après `expo export`.
 *
 * Expo découpe l'app web en un fichier JavaScript par écran, chargé à la première ouverture de
 * l'écran. Sans cette liste, un écran jamais ouvert avec du réseau ne s'ouvrirait pas hors
 * ligne. Le service worker la lit et télécharge tous ces fichiers dès la première visite.
 *
 *   node scripts/precache-manifest.mjs dist
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.argv[2] ?? "dist";
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push("/" + relative(root, path).split(sep).join("/"));
  }
}
walk(join(root, "_expo"));
const list = files.filter((f) => /\.(js|css)$/.test(f)).sort();
writeFileSync(join(root, "precache.json"), JSON.stringify(list));
console.log(`precache.json : ${list.length} fichiers`);
