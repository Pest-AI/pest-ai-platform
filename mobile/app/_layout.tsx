import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { Questrial_400Regular, useFonts } from "@expo-google-fonts/questrial";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/offline-banner";
import { registerServiceWorker } from "@/lib/pwa";
import { SessionProvider } from "@/lib/session";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F7FAF8" } }} />
          <OfflineBanner />
        </View>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
