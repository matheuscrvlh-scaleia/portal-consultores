import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyAccess } from "@/lib/auth.functions";
import { listarMeusConteudos } from "@/lib/conteudos-painel.functions";
import { listarMeusLeads } from "@/lib/painel.functions";


export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({
    meta: [
      { title: "Painel do consultor — Portal dos Consultores" },
      {
        name: "description",
        content: "Área do consultor para acompanhar o próprio perfil, conteúdos e contatos.",
      },
      { property: "og:title", content: "Painel do consultor — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Área do consultor para acompanhar o próprio perfil, conteúdos e contatos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async () => {
    const access = await getMyAccess();
    if (!access.isConsultor) throw redirect({ to: "/sem-permissao" });
    return access;
  },
  component: PainelPage,
});

function PainelPage() {
  const access = Route.useLoaderData();
  const resumo = useQuery({
    queryKey: ["meus-leads-resumo"],
    queryFn: () => listarMeusLeads({ data: {} }),
  });

  const conteudos = useQuery({
    queryKey: ["painel", "meus-conteudos"],
    queryFn: () => listarMeusConteudos(),
  });





  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Olá{access.consultor?.nome ? `, ${access.consultor.nome}` : ""}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este é o seu painel. Em breve você gerencia aqui o seu perfil, portfólio e contatos
              recebidos.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meu perfil</CardTitle>
              <CardDescription>
                {access.consultor
                  ? `Perfil vinculado: ${access.consultor.slug}`
                  : "Nenhum perfil de consultor vinculado a esta conta ainda."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Edite bio, áreas, foto, vídeo e cases, pré-visualize e controle a publicação.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/painel/perfil">Editar meu perfil</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meus contatos</CardTitle>
              <CardDescription>Solicitações enviadas por visitantes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                {!resumo.data
                  ? resumo.isPending
                    ? "Carregando contatos…"
                    : "Nenhum perfil de consultor vinculado a esta conta ainda."
                  : `${resumo.data.contagens.todos} ${
                      resumo.data.contagens.todos === 1 ? "contato recebido" : "contatos recebidos"
                    } · ${resumo.data.contagens.novo} com status “Novo”.`}
              </p>

              <Button asChild size="sm" variant="outline">
                <Link to="/painel/leads">Ver meus contatos</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meus conteúdos</CardTitle>
              <CardDescription>Vídeos da biblioteca publicados por você.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                {!conteudos.data
                  ? conteudos.isPending
                    ? "Carregando conteúdos…"
                    : "Nenhum perfil de consultor vinculado a esta conta ainda."
                  : `${conteudos.data.filter((c) => c.publicado).length} publicado(s) · ${
                      conteudos.data.filter((c) => !c.publicado).length
                    } rascunho(s).`}
              </p>

              <Button asChild size="sm" variant="outline">
                <Link to="/painel/conteudos">Gerenciar conteúdos</Link>
              </Button>
            </CardContent>
          </Card>

        </div>
      </main>
    </>
  );
}
