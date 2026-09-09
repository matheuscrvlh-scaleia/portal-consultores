import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { listarConsultoresComConteudo, listarConteudosPublicados } from "@/lib/biblioteca.functions";
import { listAreas } from "@/lib/vitrine.functions";

const searchSchema = z.object({
  area: fallback(z.string(), "").default(""),
  consultor: fallback(z.string(), "").default(""),
});

const areasQueryOptions = () => queryOptions({ queryKey: ["areas"], queryFn: () => listAreas() });

const autoresQueryOptions = () =>
  queryOptions({
    queryKey: ["biblioteca-consultores"],
    queryFn: () => listarConsultoresComConteudo(),
  });

const conteudosQueryOptions = (area: string, consultor: string) =>
  queryOptions({
    queryKey: ["biblioteca-conteudos", area, consultor],
    queryFn: () =>
      listarConteudosPublicados({ data: { area: area || null, consultor: consultor || null } }),
  });

const TITULO = "Biblioteca de conteúdos — Portal dos Consultores";
const DESCRICAO =
  "Vídeos e materiais publicados pelos consultores do portal, organizados por área de atuação e por autor.";

export const Route = createFileRoute("/_authenticated/conteudos/")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams({ area: "", consultor: "" })] },
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BibliotecaPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-20" role="alert">
      <h1 className="u-display text-2xl">Não foi possível carregar a biblioteca</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <h1 className="u-display text-2xl">Página não encontrada</h1>
    </div>
  ),
});

function BibliotecaPage() {
  const { area, consultor } = Route.useSearch();
  const { data: areas } = useSuspenseQuery(areasQueryOptions());
  const { data: autores } = useSuspenseQuery(autoresQueryOptions());
  const { data: conteudos } = useSuspenseQuery(conteudosQueryOptions(area, consultor));

  const temFiltro = Boolean(area || consultor);
  const nomeArea = areas.find((a) => a.slug === area)?.nome;
  const nomeAutor = autores.find((a) => a.slug === consultor)?.nome;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <section className="surface-ink">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <p className="u-eyebrow">Área do usuário</p>
          <h1 className="u-display mt-3 text-4xl">Biblioteca de conteúdos</h1>
          <hr className="u-rule mt-6" />
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Vídeos publicados pelos consultores do portal. Filtre por área de atuação ou por autor.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <nav aria-label="Filtrar por área" className="flex flex-wrap gap-2">
          <Link
            to="/conteudos"
            search={{ area: "", consultor }}
            className={`border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              area
                ? "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                : "border-primary bg-primary text-primary-foreground"
            }`}
          >
            Todas as áreas
          </Link>
          {areas.map((a) => (
            <Link
              key={a.id}
              to="/conteudos"
              search={{ area: a.slug, consultor }}
              className={`border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                a.slug === area
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {a.nome}
            </Link>
          ))}
        </nav>

        {autores.length > 0 && (
          <nav aria-label="Filtrar por consultor" className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/conteudos"
              search={{ area, consultor: "" }}
              className={`border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                consultor
                  ? "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  : "border-foreground bg-foreground text-background"
              }`}
            >
              Todos os consultores
            </Link>
            {autores.map((a) => (
              <Link
                key={a.slug}
                to="/conteudos"
                search={{ area, consultor: a.slug }}
                className={`border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  a.slug === consultor
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {a.nome}
              </Link>
            ))}
          </nav>
        )}

        <section className="mt-10">
          <h2 className="u-display text-xl">
            {conteudos.length > 0
              ? `${conteudos.length} conteúdo${conteudos.length > 1 ? "s" : ""} publicado${
                  conteudos.length > 1 ? "s" : ""
                }`
              : "Conteúdos publicados"}
          </h2>
          <hr className="u-rule mt-4" />

          {conteudos.length === 0 ? (
            <div className="mt-8 border-2 border-border p-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                {temFiltro
                  ? `Nenhum conteúdo publicado${nomeArea ? ` na área ${nomeArea}` : ""}${
                      nomeAutor ? ` de ${nomeAutor}` : ""
                    }.`
                  : "Ainda não há conteúdos publicados na biblioteca."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {temFiltro
                  ? "Tente outra área ou outro consultor."
                  : "Assim que um consultor publicar um vídeo, ele aparece aqui."}
              </p>
              {temFiltro && (
                <div className="mt-5">
                  <Button asChild variant="outline">
                    <Link to="/conteudos" search={{ area: "", consultor: "" }}>
                      Limpar filtros
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {conteudos.map((conteudo) => (
                <li key={conteudo.id} className="border-2 border-border">
                  <Link
                    to="/conteudos/$slug"
                    params={{ slug: conteudo.slug }}
                    className="block h-full p-5 transition-colors hover:bg-accent"
                  >
                    <div className="w-full" style={{ aspectRatio: "9 / 16" }}>
                      {conteudo.posterUrl ? (
                        <img
                          src={conteudo.posterUrl}
                          alt={`Capa do conteúdo ${conteudo.titulo}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="flex h-full w-full items-center justify-center bg-muted"
                        >
                          <span className="u-display text-3xl text-muted-foreground">
                            {conteudo.titulo.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="u-display mt-4 text-lg">{conteudo.titulo}</h3>

                    {conteudo.area && (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {conteudo.area.nome}
                      </p>
                    )}

                    {conteudo.consultor && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {conteudo.consultor.nome}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
