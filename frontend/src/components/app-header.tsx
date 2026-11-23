import { LogOut } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function AppHeader({ userName }: { userName?: string }) {
  return (
    <header className="bg-forest">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/espaces" aria-label="Accueil">
          <Brand inverted />
        </Link>
        <div className="flex items-center gap-3">
          {userName ? <span className="hidden text-sm text-white/90 sm:inline">{userName}</span> : null}
          <form action="/api/session/logout" method="post">
            <Button variant="ghost" className="text-white hover:bg-white/10" type="submit">
              <LogOut className="size-4" aria-hidden />
              Déconnexion
            </Button>
          </form>
        </div>
      </div>
      <div className="h-1 bg-sun" />
    </header>
  );
}
