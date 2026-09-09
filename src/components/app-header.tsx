import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useAccess, useSignOut } from "@/hooks/use-auth";

export function AppHeader() {
  const { session, access } = useAccess();
  const signOut = useSignOut();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="min-w-0 truncate text-sm font-semibold text-foreground">
          Portal dos Consultores
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2">
          {session && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/conteudos" search={{ area: "", consultor: "" }}>
                Conteúdos
              </Link>
            </Button>
          )}

          {access?.isConsultor && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/painel">Painel</Link>
            </Button>
          )}
          {access?.isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {session ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {session.user.email}
              </span>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
