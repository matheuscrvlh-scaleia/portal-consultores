import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAreas, listConsultoresPublicados, registrarBusca } from "@/lib/vitrine.functions";

const searchSchema = z.object({
  areas: fallback(z.string().array(), []).default([]),
  q: fallback(z.string(), "").default(""),
});

const areasQueryOptions = () => queryOptions({ queryKey: ["areas"], queryFn: () => listAreas() });

const consultoresQueryOptions = (areas: string[], q: string) =>
  queryOptions({
    queryKey: ["consultores-publicados", [...areas].sort().join(","), q],
    queryFn: () => listConsultoresPublicados({ data: { areas, q: q || null } }),
  });

const TITULO = "Portal dos Consultores — Encontre o consultor certo por área";
const DESCRICAO =
  "Consultores independentes por área de atuação: estratégia, gestão financeira, marketing, operações, pessoas, tecnologia, logística e desenvolvimento de produto. Veja o portfólio de cada um e envie sua solicitação de contato.";

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams({ areas: [], q: "" })] },
  loaderDeps: ({ search }) => ({ areas: search.areas, q: search.q }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(areasQueryOptions());
    context.queryClient.ensureQueryData(consultoresQueryOptions(deps.areas, deps.q));
  },
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Portal dos Consultores",
          url: (import.meta.env.VITE_SITE_URL ?? "http://localhost:8080") + "/",
          description: DESCRICAO,
        }),
      },
    ],
  }),

  component: HomePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-20" role="alert">
      <h1 className="u-display text-2xl">Não foi possível carregar a vitrine</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <h1 className="u-display text-2xl">Página não encontrada</h1>
    </div>
  ),
});

function HomePage() {
  const { areas: areasSelecionadas, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data: areas } = useSuspenseQuery(areasQueryOptions());
  const { data: consultores } = useSuspenseQuery(consultoresQueryOptions(areasSelecionadas, q));
  const [termo, setTermo] = useState(q);

  useEffect(() => {
    setTermo(q);
  }, [q]);

  const chaveAreas = [...areasSelecionadas].sort().join(",");

  // Registra a busca/filtro quando a URL muda (uma vez por combinação).
  const ultimoRegistro = useRef<string | null>(null);
  useEffect(() => {
    if (!chaveAreas && !q) return;
    const chave = `${chaveAreas}|${q}`;
    if (ultimoRegistro.current === chave) return;
    ultimoRegistro.current = chave;
    void registrarBusca({
      data: { areas: chaveAreas ? chaveAreas.split(",") : null, termo: q || null },
    }).catch(() => {
      // Métrica de busca é best-effort: nunca bloqueia a vitrine.
    });
  }, [chaveAreas, q]);

  const temFiltro = Boolean(areasSelecionadas.length > 0 || q);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <section className="surface-ink">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="u-eyebrow">Consultoria independente</p>
          <h1 className="u-display mt-3 text-3xl sm:text-4xl lg:text-5xl">
            Encontre o consultor certo para o seu desafio
          </h1>
          <hr className="u-rule mt-6" />
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Profissionais com histórico comprovado, organizados por área de atuação. Compare
            portfólios e fale direto com quem vai executar.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ search: { areas: areasSelecionadas, q: termo.trim() } });
          }}
        >
          <Input
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
            placeholder="Buscar por nome ou palavra-chave"
            aria-label="Buscar consultores"
            className="rounded-none"
          />
          <Button type="submit">Buscar</Button>
        </form>

        <nav aria-label="Filtrar por área" className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={areasSelecionadas.length === 0}
            onClick={() => void navigate({ search: { areas: [], q } })}
            className={`border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              areasSelecionadas.length > 0
                ? "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                : "border-primary bg-primary text-primary-foreground"
            }`}
          >
            Todas as áreas
          </button>
          {areas.map((a) => {
            const ativa = areasSelecionadas.includes(a.slug);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={ativa}
                onClick={() =>
                  void navigate({
                    search: {
                      q,
                      areas: ativa
                        ? areasSelecionadas.filter((slug: string) => slug !== a.slug)
                        : [...areasSelecionadas, a.slug],
                    },
                  })
                }
                className={`border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  ativa
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {a.nome}
              </button>
            );
          })}
        </nav>

        <section className="mt-10">
          <h2 className="u-display text-xl">
            {consultores.length > 0
              ? `${consultores.length} consultor${consultores.length > 1 ? "es" : ""} publicado${
                  consultores.length > 1 ? "s" : ""
                }`
              : "Consultores publicados"}
          </h2>
          <hr className="u-rule mt-4" />

          {consultores.length === 0 ? (
            <div className="mt-8 border-2 border-border p-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                {temFiltro
                  ? "Nenhum consultor publicado corresponde a este filtro."
                  : "Ainda não há consultores publicados nesta vitrine."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {temFiltro
                  ? "Tente outra área de atuação ou um termo diferente."
                  : "Assim que um perfil for publicado, ele aparece aqui."}
              </p>
              {temFiltro && (
                <div className="mt-5">
                  <Button asChild variant="outline">
                    <Link to="/" search={{ areas: [], q: "" }}>
                      Limpar filtros
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {consultores.map((consultor) => (
                <li key={consultor.id} className="border-2 border-border">
                  <Link
                    to="/consultores/$slug"
                    params={{ slug: consultor.slug }}
                    className="block h-full p-5 transition-colors hover:bg-accent"
                  >
                    {consultor.fotoUrl ? (
                      <img
                        src={consultor.fotoUrl}
                        alt={`Foto de ${consultor.nome}`}
                        loading="lazy"
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="flex h-40 w-full items-center justify-center bg-muted"
                      >
                        <span className="u-display text-4xl text-muted-foreground">
                          {consultor.nome.charAt(0)}
                        </span>
                      </div>
                    )}

                    <h3 className="u-display mt-4 text-lg">{consultor.nome}</h3>

                    {consultor.areas.length > 0 && (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {consultor.areas.map((a) => a.nome).join(" · ")}
                      </p>
                    )}

                    {consultor.bio && (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {consultor.bio.length > 160
                          ? `${consultor.bio.slice(0, 160)}…`
                          : consultor.bio}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
