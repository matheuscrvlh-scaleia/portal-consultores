import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { getConteudoPublicado, registrarVisualizacao } from "@/lib/biblioteca.functions";
import { getLibraryVideoUrl } from "@/lib/storage.functions";

const conteudoQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["biblioteca-conteudo", slug],
    queryFn: async () => {
      const conteudo = await getConteudoPublicado({ data: { slug } });
      if (!conteudo) throw notFound();
      return conteudo;
    },
  });

export const Route = createFileRoute("/_authenticated/conteudos/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Conteúdo — Portal dos Consultores` },
      {
        name: "description",
        content: `Assista ao conteúdo ${params.slug} publicado na biblioteca do Portal dos Consultores.`,
      },
      { property: "og:title", content: "Conteúdo — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Biblioteca de conteúdos do Portal dos Consultores.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConteudoPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-20" role="alert">
      <h1 className="u-display text-2xl">Não foi possível carregar o conteúdo</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Button asChild variant="outline">
          <Link to="/conteudos" search={{ area: "", consultor: "" }}>
            Voltar para a biblioteca
          </Link>
        </Button>
        <p className="u-eyebrow mt-8">Erro 404</p>
        <h1 className="u-display mt-3 text-3xl">Conteúdo não encontrado</h1>
        <hr className="u-rule mt-6" />
        <p className="mt-6 text-sm text-muted-foreground">
          Este conteúdo não existe ou não está publicado.
        </p>
      </main>
    </div>
  ),
});

function PlayerVideo({
  path,
  poster,
  titulo,
}: {
  path: string;
  poster: string | null;
  titulo: string;
}) {
  const { data, isError } = useQuery({
    queryKey: ["biblioteca-video", path],
    queryFn: () => getLibraryVideoUrl({ data: { path } }),
    staleTime: 1000 * 60 * 3,
  });

  return (
    <div className="mt-8 w-full max-w-xs" style={{ aspectRatio: "9 / 16" }}>
      {data?.signedUrl ? (
        <video
          src={data.signedUrl}
          poster={poster ?? undefined}
          controls
          playsInline
          muted
          preload="metadata"
          className="h-full w-full bg-foreground/5 object-cover"
          aria-label={`Vídeo: ${titulo}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-foreground/5">
          <span className="px-4 text-center text-xs text-muted-foreground">
            {isError ? "Não foi possível carregar o vídeo agora." : "Carregando vídeo…"}
          </span>
        </div>
      )}
    </div>
  );
}

function ConteudoPage() {
  const { slug } = Route.useParams();
  const { data: conteudo } = useSuspenseQuery(conteudoQueryOptions(slug));

  // Uma tentativa de registro por conteúdo por montagem; a de-duplicação
  // definitiva (uma vez por dia) acontece no servidor.
  const registrado = useRef<string | null>(null);
  useEffect(() => {
    if (registrado.current === conteudo.id) return;
    registrado.current = conteudo.id;
    void registrarVisualizacao({ data: { conteudoId: conteudo.id } }).catch(() => {
      // Métrica best-effort: nunca bloqueia a reprodução.
    });
  }, [conteudo.id]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link
          to="/conteudos"
          search={{ area: "", consultor: "" }}
          className="text-xs font-semibold uppercase tracking-wide text-primary underline underline-offset-4"
        >
          ← Biblioteca de conteúdos
        </Link>

        <p className="u-eyebrow mt-8">{conteudo.area?.nome ?? "Conteúdo"}</p>
        <h1 className="u-display mt-3 text-3xl">{conteudo.titulo}</h1>
        <hr className="u-rule mt-6" />

        {conteudo.consultor && (
          <p className="mt-6 text-sm text-muted-foreground">
            Por{" "}
            <Link
              to="/consultores/$slug"
              params={{ slug: conteudo.consultor.slug }}
              className="font-semibold text-foreground underline underline-offset-4"
            >
              {conteudo.consultor.nome}
            </Link>
          </p>
        )}

        {conteudo.videoPath ? (
          <PlayerVideo
            path={conteudo.videoPath}
            poster={conteudo.posterUrl}
            titulo={conteudo.titulo}
          />
        ) : null}

        {conteudo.descricao && (
          <p className="mt-8 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {conteudo.descricao}
          </p>
        )}
      </main>
    </div>
  );
}
