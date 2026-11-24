import type { ExpoConfig } from "expo/config";

/**
 * Configuration de l'app mobile PEST AI OS.
 * EXPO_PUBLIC_API_BASE_URL : adresse de l'API (défaut : staging). Jamais de secret ici :
 * tout ce qui est dans l'app est lisible par quiconque installe l'APK.
 */
const config: ExpoConfig = {
  name: "PEST AI OS",
  slug: "pest-ai-os",
  scheme: "pestai",
  version: "0.0.1",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: { supportsTablet: true, bundleIdentifier: "africa.pestai.os" },
  android: {
    // Pas de sauvegarde Android des données de l'app (les jetons restent sur l'appareil).
    allowBackup: false,
    package: "africa.pestai.os",
    adaptiveIcon: {
      backgroundColor: "#184429",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/favicon.png", bundler: "metro" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-image",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 160, backgroundColor: "#FFFFFF" }],
  ],
  experiments: { typedRoutes: false },
};

export default config;
