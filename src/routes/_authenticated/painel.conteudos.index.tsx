import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyAccess } from "@/lib/auth.functions";
import {
  criarConteudo,
  listarMeusConteudos,
  setConteudoPublicado,
} from "@/lib/conteudos-painel.functions";

export const Route = createFileRoute("/_authenticated/painel/conteudos/")({
  head: () => ({
    meta: [
      { title: "Meus conteúdos — Portal dos Consultores" },
      {
        name: "description",
        content:
          "Área do consultor para criar, editar e publicar os próprios conteúdos da biblioteca.",
      },
      { property: "og:title", content: "Meus conteúdos — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Gerencie rascunhos e conteúdos publicados da biblioteca.",
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
  component: MeusConteudosPage,
});

export const conteudosQueryKey = ["painel", "meus-conteudos"] as const;

function MeusConteudosPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");

  const { data: conteudos, isLoading } = useQuery({
    queryKey: conteudosQueryKey,
    queryFn: () => listarMeusConteudos(),
  });

  const criar = useMutation({
    mutationFn: () => criarConteudo({ data: { titulo: titulo.trim() } }),
    onSuccess: async (novo) => {
      setTitulo("");
      await queryClient.invalidateQueries({ queryKey: conteudosQueryKey });
      toast.success("Rascunho criado");
      navigate({ to: "/painel/conteudos/$id", params: { id: novo.id } });
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível criar o conteúdo"),
  });

  const publicar = useMutation({
    mutationFn: (vars: { id: string; publicado: boolean }) => setConteudoPublicado({ data: vars }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: conteudosQueryKey });
      toast.success(res.publicado ? "Conteúdo publicado" : "Conteúdo despublicado");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível alterar a publicação"),
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">Painel</p>
            <h1 className="u-display text-2xl">Meus conteúdos</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie rascunhos, envie vídeo e poster e publique quando estiver pronto.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Novo conteúdo</CardTitle>
            <CardDescription>
              Informe o título para criar um rascunho. Área, descrição, vídeo e poster vêm na tela
              seguinte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (titulo.trim().length < 3) {
                  toast.error("Informe um título com pelo menos 3 caracteres");
                  return;
                }
                criar.mutate();
              }}
            >
              <div className="min-w-[240px] flex-1 space-y-2">
                <Label htmlFor="novo-titulo">Título</Label>
                <Input
                  id="novo-titulo"
                  value={titulo}
                  maxLength={160}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Como estruturar um plano de expansão"
                />
              </div>
              <Button type="submit" disabled={criar.isPending}>
                {criar.isPending ? "Criando…" : "Criar rascunho"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="mt-10 space-y-4">
          {isLoading || conteudos === undefined ? (
            <p className="text-sm text-muted-foreground">Carregando conteúdos…</p>
          ) : conteudos === null ? (
            <p className="text-sm text-muted-foreground">
              Nenhum perfil de consultor está vinculado a esta conta ainda.
            </p>
          ) : conteudos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não criou nenhum conteúdo. Comece criando um rascunho acima.
            </p>
          ) : (
            conteudos.map((conteudo) => (
              <article
                key={conteudo.id}
                className="flex flex-wrap items-center gap-4 border border-border p-4"
              >
                <div
                  className="w-16 shrink-0 overflow-hidden bg-foreground/5"
                  style={{ aspectRatio: "9 / 16" }}
                >
                  {conteudo.posterUrl ? (
                    <img
                      src={conteudo.posterUrl}
                      alt={`Poster do conteúdo ${conteudo.titulo}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      sem poster
                    </span>
                  )}
                </div>

                <div className="min-w-[200px] flex-1">
                  <h2 className="font-medium text-foreground">{conteudo.titulo}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {conteudo.area?.nome ?? "Sem área definida"} ·{" "}
                    {conteudo.publicado ? "Publicado" : "Rascunho"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/painel/conteudos/$id" params={{ id: conteudo.id }}>
                      Editar
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant={conteudo.publicado ? "outline" : "default"}
                    disabled={publicar.isPending}
                    onClick={() =>
                      publicar.mutate({ id: conteudo.id, publicado: !conteudo.publicado })
                    }
                  >
                    {conteudo.publicado ? "Despublicar" : "Publicar"}
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </>
  );
}
