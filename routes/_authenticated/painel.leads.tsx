import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { LeadDetalheDialog, STATUS_LABEL } from "@/components/leads/lead-detalhe-dialog";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyAccess } from "@/lib/auth.functions";
import {
  atualizarStatusLead,
  LEAD_STATUS,
  listarMeusLeads,
  type LeadStatus,
  type MeuLead,
  type MeusLeads,
} from "@/lib/painel.functions";

const searchSchema = z.object({
  status: fallback(z.string(), "todos").default("todos"),
});

export const Route = createFileRoute("/_authenticated/painel/leads")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Meus contatos — Portal dos Consultores" },
      {
        name: "description",
        content:
          "Acompanhe os contatos recebidos pelo seu perfil em um quadro e mova cada cartão pelo funil.",
      },
      { property: "og:title", content: "Meus contatos — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Área do consultor para acompanhar os leads recebidos.",
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
  component: LeadsPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-4 py-16" role="alert">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar seus contatos agora. {error.message}
      </p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm text-muted-foreground">Página não encontrada.</p>
    </main>
  ),
});

const QUERY_KEY = ["meus-leads", null] as const;

function LeadsPage() {
  const { status } = Route.useSearch();
  const queryClient = useQueryClient();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const destaque: LeadStatus | null = (LEAD_STATUS as readonly string[]).includes(status)
    ? (status as LeadStatus)
    : null;

  const leadsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listarMeusLeads({ data: { status: null } }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: LeadStatus }) => atualizarStatusLead({ data: vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const anterior = queryClient.getQueryData<MeusLeads | null>(QUERY_KEY);
      queryClient.setQueryData<MeusLeads | null>(QUERY_KEY, (atual) =>
        atual
          ? {
              ...atual,
              leads: atual.leads.map((lead) =>
                lead.id === vars.id ? { ...lead, status: vars.status } : lead,
              ),
            }
          : atual,
      );
      return { anterior };
    },
    onSuccess: (_res, vars) => {
      toast.success(`Status atualizado para “${STATUS_LABEL[vars.status]}”.`);
    },
    onError: (error: Error, _vars, contexto) => {
      if (contexto?.anterior !== undefined) {
        queryClient.setQueryData(QUERY_KEY, contexto.anterior);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["meus-leads"] });
      queryClient.invalidateQueries({ queryKey: ["meus-leads-resumo"] });
    },
  });

  const dados = leadsQuery.data;
  const selecionado: MeuLead | null =
    dados?.leads.find((lead) => lead.id === selecionadoId) ?? null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">Painel do consultor</p>
            <h1 className="u-display mt-2 text-2xl">Meus contatos</h1>
            <div className="u-rule mt-3 w-16" />
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              Arraste um cartão para outra coluna para trocar o status. Clique no cartão para ver
              os dados completos do contato.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
        </div>

        <div className="mt-8">
          {leadsQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Carregando contatos…</p>
          ) : dados === null ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nenhum perfil vinculado</CardTitle>
                <CardDescription>
                  Esta conta ainda não está vinculada a um perfil de consultor. Fale com o
                  administrador do portal para fazer o vínculo.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : dados && dados.leads.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                Nenhum contato recebido ainda.
              </CardContent>
            </Card>
          ) : (
            <LeadsKanban
              leads={dados?.leads ?? []}
              destaque={destaque}
              onOpen={(lead) => setSelecionadoId(lead.id)}
              onMover={(id, novoStatus) => mutation.mutate({ id, status: novoStatus })}
            />
          )}
        </div>
      </main>

      <LeadDetalheDialog
        lead={selecionado}
        onOpenChange={(aberto) => {
          if (!aberto) setSelecionadoId(null);
        }}
        onStatusChange={(novoStatus) => {
          if (selecionado && novoStatus !== selecionado.status) {
            mutation.mutate({ id: selecionado.id, status: novoStatus });
          }
        }}
      />
    </>
  );
}
