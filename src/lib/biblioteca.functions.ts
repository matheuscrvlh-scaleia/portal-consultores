import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConteudoCard = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  posterUrl: string | null;
  consultor: { slug: string; nome: string } | null;
  area: { slug: string; nome: string } | null;
};

export type ConteudoDetalhe = ConteudoCard & {
  tipo: "video" | "texto";
  videoPath: string | null;
};

type ConsultorJoin = { slug: string; nome: string } | null;
type AreaJoin = { slug: string; nome: string } | null;

const SELECT_CONTEUDO =
  "id, slug, titulo, descricao, poster_path, tipo, video_path, consultores(slug, nome), areas(slug, nome)";

function toCard(row: {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  poster_path: string | null;
  consultores: unknown;
  areas: unknown;
}): ConteudoCard {
  const consultor = (row.consultores ?? null) as ConsultorJoin;
  const area = (row.areas ?? null) as AreaJoin;

  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    descricao: row.descricao,
    posterUrl: row.poster_path ? `/api/media/${row.poster_path}` : null,
    consultor: consultor ? { slug: consultor.slug, nome: consultor.nome } : null,
    area: area ? { slug: area.slug, nome: area.nome } : null,
  };
}

const listSchema = z.object({
  area: z.string().trim().max(160).optional().nullable(),
  consultor: z.string().trim().max(160).optional().nullable(),
});

/**
 * Conteúdos publicados da biblioteca, opcionalmente filtrados por slug de área
 * e de consultor. Exige sessão: a biblioteca é fechada a visitantes anônimos.
 */
export const listarConteudosPublicados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => listSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("conteudos")
      .select(SELECT_CONTEUDO)
      .eq("publicado", true)
      .order("created_at", { ascending: false });

    if (data.area) {
      const { data: area } = await supabase
        .from("areas")
        .select("id")
        .eq("slug", data.area)
        .maybeSingle();
      if (!area) return [] as ConteudoCard[];
      query = query.eq("area_id", area.id);
    }

    if (data.consultor) {
      const { data: consultor } = await supabase
        .from("consultores")
        .select("id")
        .eq("slug", data.consultor)
        .maybeSingle();
      if (!consultor) return [] as ConteudoCard[];
      query = query.eq("consultor_id", consultor.id);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => toCard(row as never));
  });

/** Consultores que possuem ao menos um conteúdo publicado (para o filtro). */
export const listarConsultoresComConteudo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conteudos")
      .select("consultores(slug, nome)")
      .eq("publicado", true);

    if (error) throw new Error(error.message);

    const mapa = new Map<string, { slug: string; nome: string }>();
    for (const row of data ?? []) {
      const consultor = (row.consultores ?? null) as ConsultorJoin;
      if (consultor) mapa.set(consultor.slug, consultor);
    }

    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

const slugSchema = z.object({ slug: z.string().trim().min(1).max(160) });

/** Conteúdo publicado pelo slug. Retorna `null` quando não existe ou não está publicado. */
export const getConteudoPublicado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => slugSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conteudos")
      .select(SELECT_CONTEUDO)
      .eq("slug", data.slug)
      .eq("publicado", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    const base = toCard(row as never);
    const detalhe: ConteudoDetalhe = {
      ...base,
      tipo: (row as { tipo: "video" | "texto" }).tipo,
      videoPath: (row as { video_path: string | null }).video_path,
    };
    return detalhe;
  });

const visualizacaoSchema = z.object({ conteudoId: z.string().uuid() });

/**
 * Registra uma visualização do conteúdo pelo usuário autenticado, no máximo
 * uma vez por dia (de-duplicação simples, evita contar cada replay).
 * Contas sem linha em `usuarios` (consultor/admin) não geram registro.
 */
export const registrarVisualizacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => visualizacaoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!usuario) return { registrada: false, motivo: "sem_usuario" as const };

    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const { data: existente } = await supabase
      .from("visualizacoes")
      .select("id")
      .eq("usuario_id", usuario.id)
      .eq("conteudo_id", data.conteudoId)
      .gte("criado_em", inicioDoDia.toISOString())
      .maybeSingle();

    if (existente) return { registrada: false, motivo: "duplicada" as const };

    const { error } = await supabase
      .from("visualizacoes")
      .insert({ usuario_id: usuario.id, conteudo_id: data.conteudoId });

    if (error) throw new Error(error.message);

    return { registrada: true, motivo: null };
  });
