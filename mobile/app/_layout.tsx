import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { Questrial_400Regular, useFonts } from "@expo-google-fonts/questrial";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AutoSync } from "@/components/auto-sync";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { registerServiceWorker } from "@/lib/pwa";
import { SessionProvider } from "@/lib/session";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Grand écran (navigateur d'ordinateur) : l'app garde un format de téléphone, centrée.
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width > 640;
  const [loaded] = useFonts({ Questrial_400Regular, JetBrainsMono_500Medium });
  useEffect(() => {
    registerServiceWorker();
  }, []);
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <AutoSync />
        <View style={wide ? frame.outer : { flex: 1 }}>
          <View style={wide ? frame.phone : { flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F7FAF8" } }} />
            <OfflineBanner />
            <BottomNav />
          </View>
        </View>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const frame = {
  outer: { flex: 1, backgroundColor: "#DCE6E0", alignItems: "center" as const },
  phone: {
    flex: 1,
    width: "100%" as const,
    maxWidth: 480,
    overflow: "hidden" as const,
    backgroundColor: "#F7FAF8",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#CBD6D0",
  },
};
