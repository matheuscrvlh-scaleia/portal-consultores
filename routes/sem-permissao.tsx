import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-auth";

export const Route = createFileRoute("/sem-permissao")({
  head: () => ({
    meta: [
      { title: "Sem permissão — Portal dos Consultores" },
      {
        name: "description",
        content: "Esta área do Portal dos Consultores exige um perfil de acesso diferente.",
      },
      { property: "og:title", content: "Sem permissão — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Esta área do Portal dos Consultores exige um perfil de acesso diferente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SemPermissaoPage,
});

function SemPermissaoPage() {
  const signOut = useSignOut();

  return (
    <main className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
          <Button onClick={() => void signOut()}>Sair da conta</Button>
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Sem permissão</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sua conta está conectada, mas não tem o perfil necessário para acessar esta área. Se você
            deveria ter acesso, fale com o administrador do portal.
          </p>
        </div>
      </div>
    </main>
  );
}
