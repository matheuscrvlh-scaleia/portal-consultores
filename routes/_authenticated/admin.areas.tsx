import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { atualizarArea, criarArea, listarAreasAdmin, removerArea } from "@/lib/admin.functions";
import { getMyAccess } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/admin/areas")({
  head: () => ({
    meta: [
      { title: "Áreas de atuação — Administração do Portal" },
      {
        name: "description",
        content:
          "Gestão das áreas de atuação do portal: criar, editar e remover áreas sem consultores ou conteúdos vinculados.",
      },
      { property: "og:title", content: "Áreas de atuação — Administração do Portal" },
      {
        property: "og:description",
        content: "Administração das áreas de atuação do Portal dos Consultores.",
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
  component: AdminAreasPage,
});

const areasAdminQueryKey = ["admin", "areas"] as const;

function AdminAreasPage() {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  const { data: areas, isLoading } = useQuery({
    queryKey: areasAdminQueryKey,
    queryFn: () => listarAreasAdmin(),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: areasAdminQueryKey });

  const criar = useMutation({
    mutationFn: () =>
      criarArea({ data: { nome: nome.trim(), descricao: descricao.trim() || null } }),
    onSuccess: async () => {
      setNome("");
      setDescricao("");
      await invalidar();
      toast.success("Área criada");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const salvar = useMutation({
    mutationFn: (id: string) =>
      atualizarArea({
        data: { id, nome: editNome.trim(), descricao: editDescricao.trim() || null },
      }),
    onSuccess: async () => {
      setEditando(null);
      await invalidar();
      toast.success("Área atualizada");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const remover = useMutation({
    mutationFn: (id: string) => removerArea({ data: { id } }),
    onSuccess: async (res) => {
      if (!res.removida) {
        toast.error(res.motivo ?? "Área em uso");
        return;
      }
      await invalidar();
      toast.success("Área removida");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">Administração</p>
            <h1 className="u-display mt-3 text-3xl">Áreas de atuação</h1>
            <hr className="u-rule mt-6" />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">Voltar à administração</Link>
          </Button>
        </div>

        <form
          className="mt-8 space-y-4 border-2 border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim().length < 2) {
              toast.error("Informe o nome da área");
              return;
            }
            criar.mutate();
          }}
        >
          <div>
            <Label htmlFor="nova-area">Nova área</Label>
            <Input
              id="nova-area"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-2"
              placeholder="Ex.: Gestão financeira"
            />
          </div>
          <div>
            <Label htmlFor="nova-descricao">Descrição (opcional)</Label>
            <Textarea
              id="nova-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? "Criando…" : "Criar área"}
          </Button>
        </form>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Carregando áreas…</p>
        ) : (areas ?? []).length === 0 ? (
          <p className="mt-10 border-2 border-border p-6 text-sm text-muted-foreground">
            Nenhuma área cadastrada ainda.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {(areas ?? []).map((a) => {
              const emUso = a.consultores > 0 || a.conteudos > 0;
              const motivo = `Não é possível remover: ${[
                a.consultores > 0
                  ? `${a.consultores} ${a.consultores === 1 ? "consultor" : "consultores"}`
                  : null,
                a.conteudos > 0
                  ? `${a.conteudos} ${a.conteudos === 1 ? "conteúdo" : "conteúdos"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" e ")} usam esta área.`;

              return (
                <li key={a.id} className="border-2 border-border p-4">
                  {editando === a.id ? (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editNome.trim().length < 2) {
                          toast.error("Informe o nome da área");
                          return;
                        }
                        salvar.mutate(a.id);
                      }}
                    >
                      <div>
                        <Label htmlFor={`nome-${a.id}`}>Nome</Label>
                        <Input
                          id={`nome-${a.id}`}
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`desc-${a.id}`}>Descrição</Label>
                        <Textarea
                          id={`desc-${a.id}`}
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          rows={3}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={salvar.isPending}>
                          {salvar.isPending ? "Salvando…" : "Salvar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditando(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="min-w-[220px] flex-1">
                        <p className="font-semibold text-foreground">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">/{a.slug}</p>
                        {a.descricao && (
                          <p className="mt-2 text-sm text-muted-foreground">{a.descricao}</p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {a.consultores} {a.consultores === 1 ? "consultor" : "consultores"} ·{" "}
                          {a.conteudos} {a.conteudos === 1 ? "conteúdo" : "conteúdos"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditando(a.id);
                            setEditNome(a.nome);
                            setEditDescricao(a.descricao ?? "");
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={emUso || remover.isPending}
                          title={emUso ? motivo : "Remover área"}
                          onClick={() => remover.mutate(a.id)}
                        >
                          Remover
                        </Button>
                        {emUso && (
                          <span className="max-w-[220px] text-right text-xs text-muted-foreground">
                            {motivo}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
