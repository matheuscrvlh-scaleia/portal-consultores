import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.guard";
import { montarCsv } from "./csv";

const periodoSchema = z.object({
  inicio: z.string().min(8),
  fim: z.string().min(8),
});

export type Periodo = z.infer<typeof periodoSchema>;

/** Converte as datas (YYYY-MM-DD) num intervalo [inicio, fim) em ISO. */
function intervalo(data: Periodo) {
  const inicio = new Date(`${data.inicio}T00:00:00.000Z`);
  const fimExclusivo = new Date(`${data.fim}T00:00:00.000Z`);
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);
  return { _inicio: inicio.toISOString(), _fim: fimExclusivo.toISOString() };
}

export type MetricasResumo = {
  leads: number;
  leadsFechados: number;
  cadastros: number;
  buscas: number;
  taxaFechamento: number;
};

export type LeadsPorConsultor = {
  consultorId: string;
  nome: string;
  total: number;
  fechados: number;
  taxa: number;
};

export type MetricasPainel = {
  resumo: MetricasResumo;
  leadsPorConsultor: LeadsPorConsultor[];
  buscasPorArea: { areaId: string; nome: string; total: number }[];
  termos: { termo: string; total: number }[];
  cadastrosPorDia: { dia: string; total: number }[];
};

/** Todas as métricas do período, agregadas no banco. */
export const getMetricas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodoSchema.parse(input))
  .handler(async ({ data, context }): Promise<MetricasPainel> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const args = intervalo(data);

    const [resumo, porConsultor, porArea, termos, cadastros] = await Promise.all([
      supabase.rpc("admin_metricas_resumo", args),
      supabase.rpc("admin_metricas_leads_por_consultor", args),
      supabase.rpc("admin_metricas_buscas_por_area", args),
      supabase.rpc("admin_metricas_termos", { ...args, _limite: 20 }),
      supabase.rpc("admin_metricas_cadastros_por_dia", args),
    ]);

    for (const r of [resumo, porConsultor, porArea, termos, cadastros]) {
      if (r.error) throw new Error(r.error.message);
    }

    const linhaResumo = resumo.data?.[0];
    const leads = Number(linhaResumo?.leads ?? 0);
    const leadsFechados = Number(linhaResumo?.leads_fechados ?? 0);

    return {
      resumo: {
        leads,
        leadsFechados,
        cadastros: Number(linhaResumo?.cadastros ?? 0),
        buscas: Number(linhaResumo?.buscas ?? 0),
        taxaFechamento: leads === 0 ? 0 : Math.round((leadsFechados * 1000) / leads) / 10,
      },
      leadsPorConsultor: (porConsultor.data ?? []).map((r) => ({
        consultorId: r.consultor_id,
        nome: r.consultor_nome,
        total: Number(r.total),
        fechados: Number(r.fechados),
        taxa: Number(r.taxa),
      })),
      buscasPorArea: (porArea.data ?? []).map((r) => ({
        areaId: r.area_id,
        nome: r.area_nome,
        total: Number(r.total),
      })),
      termos: (termos.data ?? []).map((r) => ({ termo: r.termo, total: Number(r.total) })),
      cadastrosPorDia: (cadastros.data ?? []).map((r) => ({
        dia: r.dia,
        total: Number(r.total),
      })),
    };
  });

/** CSV da base de usuários (visitantes) cadastrados no período. */
export const exportarUsuariosCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);
    const { _inicio, _fim } = intervalo(data);

    const { data: linhas, error } = await supabase
      .from("usuarios")
      .select(
        "nome, email, telefone, created_at, consentimento_lgpd_em, consentimento_lgpd_versao",
      )
      .gte("created_at", _inicio)
      .lt("created_at", _fim)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const csv = montarCsv(
      [
        "nome",
        "email",
        "telefone",
        "data_cadastro",
        "consentimento_em",
        "consentimento_versao",
      ],
      (linhas ?? []).map((u) => [
        u.nome,
        u.email,
        u.telefone,
        u.created_at,
        u.consentimento_lgpd_em,
        u.consentimento_lgpd_versao,
      ]),
    );

    return { csv, linhas: linhas?.length ?? 0 };
  });

/** CSV da base de leads recebidos no período, com o nome do consultor. */
export const exportarLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);
    const { _inicio, _fim } = intervalo(data);

    const { data: linhas, error } = await supabase
      .from("leads")
      .select(
        "id, nome, email, telefone, empresa, mensagem, status, origem, created_at, updated_at, consultor_id, consultores(nome)",
      )
      .gte("created_at", _inicio)
      .lt("created_at", _fim)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const csv = montarCsv(
      [
        "id",
        "nome",
        "email",
        "telefone",
        "empresa",
        "mensagem",
        "status",
        "origem",
        "data_criacao",
        "data_atualizacao",
        "consultor_id",
        "consultor_nome",
      ],
      (linhas ?? []).map((l) => [
        l.id,
        l.nome,
        l.email,
        l.telefone,
        l.empresa,
        l.mensagem,
        l.status,
        l.origem,
        l.created_at,
        l.updated_at,
        l.consultor_id,
        (l.consultores as { nome: string } | null)?.nome ?? null,
      ]),
    );

    return { csv, linhas: linhas?.length ?? 0 };
  });
