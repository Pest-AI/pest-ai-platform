// Police de la maquette AI Studio : Century Gothic si elle est installée sur l'appareil,
// sinon Questrial (libre, auto-hébergée), très proche. Chiffres : JetBrains Mono.
import "@fontsource/questrial/400.css";
import "@fontsource-variable/jetbrains-mono";

import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PEST AI OS", template: "%s · PEST AI OS" },
  description: "L'identité numérique de chaque parcelle agricole : registre AgroID, campagnes et données terrain.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#184429" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
