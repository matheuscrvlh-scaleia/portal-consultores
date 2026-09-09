import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarConsultoresAdmin, setPublicadoAdmin } from "@/lib/admin.functions";
import { getMyAccess } from "@/lib/auth.functions";

const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["todos", "publicado", "rascunho"]).optional(),
});

export const Route = createFileRoute("/_authenticated/admin/consultores/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Consultores — Administração do Portal" },
      {
        name: "description",
        content:
          "Listagem administrativa de consultores: publicação e dados de perfil de cada consultor.",
      },
      { property: "og:title", content: "Consultores — Administração do Portal" },
      {
        property: "og:description",
        content: "Gestão de consultores do Portal dos Consultores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async () => {
    const access = await getMyAccess();
    if (!access.isAdmin) throw redirect({ to: "/sem-permissao" });
    return access;
  },
  component: AdminConsultoresPage,
});

export const consultoresAdminQueryKey = ["admin", "consultores"] as const;

const STATUS = [
  { key: "todos", label: "Todos" },
  { key: "publicado", label: "Publicados" },
  { key: "rascunho", label: "Rascunhos" },
] as const;

function AdminConsultoresPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const statusAtual = search.status ?? "todos";
  const termo = (search.q ?? "").toLowerCase();

  const [busca, setBusca] = useState(search.q ?? "");

  const { data: consultores, isLoading } = useQuery({
    queryKey: consultoresAdminQueryKey,
    queryFn: () => listarConsultoresAdmin(),
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: consultoresAdminQueryKey });

  const publicar = useMutation({
    mutationFn: (vars: { id: string; publicado: boolean }) => setPublicadoAdmin({ data: vars }),
    onSuccess: async (res) => {
      await invalidar();
      toast.success(res.publicado ? "Consultor publicado" : "Consultor despublicado");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const lista = (consultores ?? [])
    .filter((c) =>
      statusAtual === "todos"
        ? true
        : statusAtual === "publicado"
          ? c.publicado
          : !c.publicado,
    )
    .filter((c) =>
      termo
        ? c.nome.toLowerCase().includes(termo) ||
          c.email.toLowerCase().includes(termo) ||
          (c.contaEmail ?? "").toLowerCase().includes(termo)
        : true,
    );

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">Administração</p>
            <h1 className="u-display mt-3 text-3xl">Consultores</h1>
            <hr className="u-rule mt-6" />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">Voltar à administração</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={statusAtual === s.key ? "default" : "outline"}
                onClick={() =>
                  navigate({
                    to: "/admin/consultores",
                    search: {
                      q: search.q,
                      status: s.key === "todos" ? undefined : s.key,
                    },
                  })
                }
              >
                {s.label}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({
                to: "/admin/consultores",
                search: { status: search.status, q: busca.trim() || undefined },
              });
            }}
          >

            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar consultores"
            />
            <Button type="submit" variant="outline" size="sm">
              Buscar
            </Button>
          </form>
        </div>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Carregando consultores…</p>
        ) : lista.length === 0 ? (
          <p className="mt-10 border-2 border-border p-6 text-sm text-muted-foreground">
            Nenhum consultor encontrado com esse filtro.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {lista.map((c) => (
              <li key={c.id} className="border-2 border-border p-4">
                <div className="flex flex-wrap items-start gap-4">
                  {c.fotoUrl ? (
                    <img src={c.fotoUrl} alt={`Foto de ${c.nome}`} className="h-16 w-16 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center bg-foreground/5 text-xs text-muted-foreground">
                      sem foto
                    </div>
                  )}
                  <div className="min-w-[220px] flex-1">
                    <p className="font-semibold text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      /{c.slug} · {c.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Conta de login: {c.contaEmail ?? c.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.areas.length > 0
                        ? c.areas.map((a) => a.nome).join(" · ")
                        : "sem áreas definidas"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.leads} {c.leads === 1 ? "lead" : "leads"} · {c.conteudos}{" "}
                      {c.conteudos === 1 ? "conteúdo" : "conteúdos"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {c.publicado ? "Publicado" : "Rascunho"}
                    </span>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/consultores/$id" params={{ id: c.id }}>
                          Editar
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant={c.publicado ? "secondary" : "default"}
                        disabled={publicar.isPending}
                        onClick={() => publicar.mutate({ id: c.id, publicado: !c.publicado })}
                      >
                        {c.publicado ? "Despublicar" : "Publicar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
