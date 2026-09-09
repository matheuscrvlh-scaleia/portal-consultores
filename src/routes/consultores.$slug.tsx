import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { stripSearchParams } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { ContatoForm } from "@/components/contato-form";
import { PerfilPublico } from "@/components/perfil-publico";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getConsultorPublicado } from "@/lib/vitrine.functions";

const searchSchema = z.object({
  area: z.string().trim().max(120).default(""),
});

const consultorQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["consultor-publicado", slug],
    queryFn: async () => {
      const consultor = await getConsultorPublicado({ data: { slug } });
      if (!consultor) throw notFound();
      return consultor;
    },
  });

export const Route = createFileRoute("/consultores/$slug")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams({ area: "" })] },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(consultorQueryOptions(params.slug)),

  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Consultor não encontrado — Portal dos Consultores" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const areas = loaderData.areas.map((a) => a.nome);
    const titulo = areas.length
      ? `${loaderData.nome} — ${areas.join(", ")} | Portal dos Consultores`
      : `${loaderData.nome} — Portal dos Consultores`;
    const trechoBio = loaderData.bio?.replace(/\s+/g, " ").trim().slice(0, 120);
    const descricao = [
      loaderData.nome,
      areas.length ? `consultor em ${areas.join(", ")}` : "consultor",
      trechoBio,
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 158);
    const url = loaderData.origin
      ? `${loaderData.origin}/consultores/${params.slug}`
      : `/consultores/${params.slug}`;

    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData.fotoUrlAbsoluta
          ? [
              { property: "og:image", content: loaderData.fotoUrlAbsoluta },
              { name: "twitter:image", content: loaderData.fotoUrlAbsoluta },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: loaderData.nome,
            description: loaderData.bio ?? descricao,
            url,
            ...(loaderData.fotoUrlAbsoluta ? { image: loaderData.fotoUrlAbsoluta } : {}),
            ...(areas.length ? { knowsAbout: areas } : {}),
          }),
        },
      ],
    };
  },
  component: ConsultorPage,
  errorComponent: ConsultorErrorComponent,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Button asChild variant="outline">
          <Link to="/">Voltar para a vitrine</Link>
        </Button>
        <p className="u-eyebrow mt-8">Erro 404</p>
        <h1 className="u-display mt-3 text-3xl">Perfil não encontrado</h1>
        <hr className="u-rule mt-6" />
        <p className="mt-6 text-sm text-muted-foreground">
          Este endereço não corresponde a nenhum consultor publicado.
        </p>
      </main>
      <SiteFooter />
    </div>
  ),
});

function ConsultorErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-20" role="alert">
        <h1 className="u-display text-2xl">Não foi possível carregar o perfil</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Tentar de novo
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}

function ConsultorPage() {
  const { slug } = Route.useParams();
  const { area } = Route.useSearch();
  const { data: consultor } = useSuspenseQuery(consultorQueryOptions(slug));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10">
          <Button asChild variant="outline">
            <Link to="/">Voltar para a vitrine</Link>
          </Button>
        </div>

        <PerfilPublico consultor={consultor}>
          <ContatoForm
            consultorSlug={consultor.slug}
            consultorNome={consultor.nome}
            origem={area ? `area:${area}` : consultor.slug}
          />
        </PerfilPublico>
      </main>

      <SiteFooter />
    </div>
  );
}
