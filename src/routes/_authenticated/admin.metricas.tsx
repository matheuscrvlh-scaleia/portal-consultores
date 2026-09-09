import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyAccess } from "@/lib/auth.functions";
import {
  exportarLeadsCsv,
  exportarUsuariosCsv,
  getMetricas,
  type LeadsPorConsultor,
} from "@/lib/metricas.functions";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function diasAtras(dias: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const searchSchema = z.object({
  inicio: fallback(z.string(), "").default(""),
  fim: fallback(z.string(), "").default(""),
  ordem: fallback(z.string(), "total").default("total"),
  direcao: fallback(z.string(), "desc").default("desc"),
});

export const Route = createFileRoute("/_authenticated/admin/metricas")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Métricas — Administração do Portal" },
      {
        name: "description",
        content:
          "Métricas do Portal dos Consultores: leads por consultor, temas mais buscados, cadastros no período e exportação em CSV.",
      },
      { property: "og:title", content: "Métricas — Administração do Portal" },
      {
        property: "og:description",
        content: "Painel de métricas e exportação de dados do Portal dos Consultores.",
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
  component: AdminMetricasPage,
});

type SearchParams = z.infer<typeof searchSchema>;

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function baixarCsv(nome: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

type ColunaOrdem = "nome" | "total" | "fechados" | "taxa";

function AdminMetricasPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const inicioBruto = DATA_VALIDA.test(search.inicio) ? search.inicio : diasAtras(29);
  const fimBruto = DATA_VALIDA.test(search.fim) ? search.fim : hoje();
  const invertido = fimBruto < inicioBruto;
  const inicio = invertido ? fimBruto : inicioBruto;
  const fim = invertido ? inicioBruto : fimBruto;

  const [rascunhoInicio, setRascunhoInicio] = useState(inicioBruto);
  const [rascunhoFim, setRascunhoFim] = useState(fimBruto);

  const ordem = (["nome", "total", "fechados", "taxa"] as const).includes(
    search.ordem as ColunaOrdem,
  )
    ? (search.ordem as ColunaOrdem)
    : "total";
  const direcao = search.direcao === "asc" ? "asc" : "desc";

  const metricas = useQuery({
    queryKey: ["admin", "metricas", inicio, fim],
    queryFn: () => getMetricas({ data: { inicio, fim } }),
  });

  const usuariosCsv = useServerFn(exportarUsuariosCsv);
  const leadsCsv = useServerFn(exportarLeadsCsv);
  const [exportando, setExportando] = useState<"usuarios" | "leads" | null>(null);

  async function exportar(tipo: "usuarios" | "leads") {
    setExportando(tipo);
    try {
      const fn = tipo === "usuarios" ? usuariosCsv : leadsCsv;
      const resultado = await fn({ data: { inicio, fim } });
      if (resultado.linhas === 0) {
        toast.info("Nenhum dado neste período para exportar.");
        return;
      }
      baixarCsv(`${tipo}-${inicio}-a-${fim}.csv`, resultado.csv);
      toast.success(`${resultado.linhas} linha(s) exportada(s).`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível exportar.");
    } finally {
      setExportando(null);
    }
  }

  function aplicarPeriodo() {
    navigate({
      search: (prev: SearchParams) => ({ ...prev, inicio: rascunhoInicio, fim: rascunhoFim }),
    });
  }

  function ordenarPor(coluna: ColunaOrdem) {
    navigate({
      search: (prev: SearchParams) => ({
        ...prev,
        ordem: coluna,
        direcao: prev.ordem === coluna && prev.direcao === "desc" ? "asc" : "desc",
      }),
    });
  }

  const dados = metricas.data;
  const linhasConsultor: LeadsPorConsultor[] = [...(dados?.leadsPorConsultor ?? [])].sort(
    (a, b) => {
      const fator = direcao === "asc" ? 1 : -1;
      if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR") * fator;
      return (a[ordem] - b[ordem]) * fator;
    },
  );

  const maxCadastros = Math.max(1, ...(dados?.cadastrosPorDia ?? []).map((d) => d.total));

  const cards = [
    { titulo: "Leads no período", valor: dados?.resumo.leads ?? 0 },
    { titulo: "Leads fechados", valor: dados?.resumo.leadsFechados ?? 0 },
    { titulo: "Novos cadastros", valor: dados?.resumo.cadastros ?? 0 },
    { titulo: "Buscas registradas", valor: dados?.resumo.buscas ?? 0 },
    {
      titulo: "Taxa de fechamento",
      valor: `${(dados?.resumo.taxaFechamento ?? 0).toLocaleString("pt-BR")}%`,
    },
  ];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Métricas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Indicadores do portal e exportação de dados no período selecionado.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin">Voltar à administração</Link>
          </Button>
        </div>

        <section className="mt-6 rounded border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <Label htmlFor="inicio">Data inicial</Label>
              <Input
                id="inicio"
                type="date"
                value={rascunhoInicio}
                onChange={(e) => setRascunhoInicio(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="fim">Data final</Label>
              <Input
                id="fim"
                type="date"
                value={rascunhoFim}
                onChange={(e) => setRascunhoFim(e.target.value)}
              />
            </div>
            <Button onClick={aplicarPeriodo}>Aplicar período</Button>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                disabled={exportando !== null}
                onClick={() => exportar("usuarios")}
              >
                {exportando === "usuarios" ? "Gerando…" : "CSV de usuários"}
              </Button>
              <Button
                variant="outline"
                disabled={exportando !== null}
                onClick={() => exportar("leads")}
              >
                {exportando === "leads" ? "Gerando…" : "CSV de leads"}
              </Button>
            </div>
          </div>
          {invertido ? (
            <p className="mt-3 text-xs text-muted-foreground">
              A data final estava antes da inicial — o período foi invertido automaticamente (
              {inicio} a {fim}).
            </p>
          ) : null}
        </section>

        {metricas.isError ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Não foi possível carregar as métricas agora. Ajuste o período e tente novamente.
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.titulo}>
              <CardHeader className="pb-2">
                <CardDescription>{card.titulo}</CardDescription>
                <CardTitle className="text-2xl">{metricas.isPending ? "—" : card.valor}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Leads por consultor</CardTitle>
            <CardDescription>
              Total, fechados e taxa de fechamento no período. Clique nos títulos para ordenar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricas.isPending ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : linhasConsultor.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado neste período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      {(
                        [
                          ["nome", "Consultor"],
                          ["total", "Leads"],
                          ["fechados", "Fechados"],
                          ["taxa", "Taxa"],
                        ] as [ColunaOrdem, string][]
                      ).map(([chave, rotulo]) => (
                        <th key={chave} className="py-2 pr-4">
                          <button
                            type="button"
                            className="font-medium hover:text-foreground"
                            onClick={() => ordenarPor(chave)}
                          >
                            {rotulo}
                            {ordem === chave ? (direcao === "asc" ? " ↑" : " ↓") : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasConsultor.map((linha) => (
                      <tr key={linha.consultorId} className="border-b border-border/60">
                        <td className="py-2 pr-4">{linha.nome}</td>
                        <td className="py-2 pr-4">{linha.total}</td>
                        <td className="py-2 pr-4">{linha.fechados}</td>
                        <td className="py-2 pr-4">{linha.taxa.toLocaleString("pt-BR")}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buscas por área</CardTitle>
              <CardDescription>Áreas mais procuradas no período.</CardDescription>
            </CardHeader>
            <CardContent>
              {metricas.isPending ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (dados?.buscasPorArea.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado neste período</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dados?.buscasPorArea.map((item) => (
                    <li key={item.areaId} className="flex justify-between gap-4">
                      <span>{item.nome}</span>
                      <span className="text-muted-foreground">{item.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Termos livres mais buscados</CardTitle>
              <CardDescription>Palavras digitadas na busca (top 20).</CardDescription>
            </CardHeader>
            <CardContent>
              {metricas.isPending ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (dados?.termos.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado neste período</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {dados?.termos.map((item) => (
                    <li key={item.termo} className="flex justify-between gap-4">
                      <span>{item.termo}</span>
                      <span className="text-muted-foreground">{item.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Cadastros no período</CardTitle>
            <CardDescription>
              Novos visitantes por dia — total de {dados?.resumo.cadastros ?? 0} no período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricas.isPending ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (dados?.cadastrosPorDia.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado neste período</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {dados?.cadastrosPorDia.map((dia) => (
                  <li key={dia.dia} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-muted-foreground">
                      {new Date(`${dia.dia}T00:00:00Z`).toLocaleDateString("pt-BR", {
                        timeZone: "UTC",
                      })}
                    </span>
                    <span
                      className="h-3 bg-primary"
                      style={{ width: `${(dia.total / maxCadastros) * 100}%` }}
                      aria-hidden
                    />
                    <span>{dia.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
