import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PEST AI OS", template: "%s · PEST AI OS" },
  description: "Plateforme d'intelligence agricole PEST AI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
