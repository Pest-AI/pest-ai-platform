# 0005 — Application mobile React Native (Expo) à la place de la PWA

- **Statut :** Accepté — remplace la décision DEC-14 (PWA)
- **Date :** 22/11/2026
- **Décideurs :** Thierno Bocar Dieng (CEO)

## Contexte

La décision DEC-14 prévoyait une PWA pour le terrain. Or les agents travaillent souvent sans réseau, prennent des photos, capturent des contours GPS et utilisent des téléphones Android d'entrée de gamme. Le stockage hors ligne et l'accès à la caméra et au GPS sont moins fiables en PWA, notamment en arrière-plan.

## Décision

Application mobile **React Native avec Expo** (TypeScript) pour les agents de terrain et les producteurs :

- file d'attente hors ligne avec **expo-sqlite** ;
- **expo-location** (GPS), **expo-camera** (photos), **expo-secure-store** (jetons) ;
- distribution en **APK via EAS Build**, sans passer par le Play Store pour le pilote.

## Options écartées

- **PWA (DEC-14) :** limites du stockage hors ligne et des accès matériels sur le terrain.
- **Flutter / natif :** autre langage que le reste de l'équipe (TypeScript côté web).

## Conséquences

- Positives : fonctionnement hors ligne robuste, accès matériel fiable, partage de TypeScript avec le Web OS.
- Négatives : environ 2 jours de plus dans le planning ; builds et mises à jour mobiles à gérer.
- Actions : initialisation au J9 ; mettre à jour la spécification d'architecture technique (TAS) pour refléter ce choix.
