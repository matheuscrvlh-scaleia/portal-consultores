import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyAccess } from "@/lib/auth.functions";
import { getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administração — Portal dos Consultores" },
      {
        name: "description",
        content: "Área administrativa para gerenciar consultores, áreas de atuação e métricas.",
      },
      { property: "og:title", content: "Administração — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Área administrativa para gerenciar consultores, áreas de atuação e métricas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async () => {
    const access = await getMyAccess();
    if (!access.isAdmin) throw redirect({ to: "/sem-permissao" });
    return { overview: await getAdminOverview() };
  },
  component: AdminPage,
});

function AdminPage() {
  const { overview } = Route.useLoaderData();

  const cards = [
    { titulo: "Consultores", valor: overview.consultores, descricao: "Cadastrados no portal" },
    { titulo: "Publicados", valor: overview.publicados, descricao: "Visíveis para visitantes" },
    { titulo: "Áreas", valor: overview.areas, descricao: "Áreas de atuação" },
    { titulo: "Leads", valor: overview.leads, descricao: "Solicitações de contato" },
  ];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Administração</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Visão geral do portal, com métricas detalhadas e exportação em CSV.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>


        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.titulo}>
              <CardHeader className="pb-2">
                <CardDescription>{card.titulo}</CardDescription>
                <CardTitle className="text-3xl">{card.valor}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{card.descricao}</CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuários</CardTitle>
              <CardDescription>
                Criar contas, alterar o papel único (visitante, consultor ou admin) e excluir contas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link to="/admin/usuarios" search={{ q: undefined }}>
                  Gerenciar usuários
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consultores</CardTitle>
              <CardDescription>
                Editar e publicar os perfis dos consultores existentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link to="/admin/consultores">Gerenciar consultores</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Áreas de atuação</CardTitle>
              <CardDescription>Criar, editar e remover áreas sem vínculos.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link to="/admin/areas">Gerenciar áreas</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Métricas</CardTitle>
              <CardDescription>
                Leads por consultor, temas mais buscados, cadastros e exportação em CSV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link
                  to="/admin/metricas"
                  search={{ inicio: "", fim: "", ordem: "total", direcao: "desc" }}
                >
                  Ver métricas
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
