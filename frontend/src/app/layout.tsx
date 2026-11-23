import "@fontsource-variable/inter";
import "@fontsource-variable/montserrat";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

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
