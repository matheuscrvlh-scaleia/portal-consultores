import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { storageConfig, validateFileSize, validateMimeType } from "./storage.validators";

type ConsultorLookupClient = {
  from: (table: "consultores") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

/** Consultor vinculado ao usuário autenticado (ou `null`). */
async function getMeuConsultorId(
  supabase: ConsultorLookupClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("consultores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export type MeuCase = {
  id: string;
  cliente: string;
  descricao: string | null;
  resultado: string | null;
  ordem: number;
};

export type MeuPerfil = {
  id: string;
  slug: string;
  nome: string;
  email: string;
  bio: string | null;
  tempoDeMercado: number | null;
  telefone: string | null;
  redes: { rede: string; url: string }[];
  fotoPath: string | null;
  fotoUrl: string | null;
  videoPath: string | null;
  publicado: boolean;
  areaIds: string[];
  areas: { slug: string; nome: string }[];
  cases: MeuCase[];
};

function parseRedes(value: unknown): { rede: string; url: string }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, url]) => typeof url === "string" && (url as string).trim().length > 0)
    .map(([rede, url]) => ({ rede, url: (url as string).trim() }));
}

/** Perfil do consultor logado, com áreas e cases. Retorna `null` sem vínculo. */
export const getMeuPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: consultor, error } = await supabase
      .from("consultores")
      .select(
        "id, slug, nome, email, bio, tempo_de_mercado, telefone, redes, foto_path, video_path, publicado",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!consultor) return null;

    const [{ data: vinculos }, { data: cases }] = await Promise.all([
      supabase
        .from("consultor_areas")
        .select("area_id, areas(slug, nome)")
        .eq("consultor_id", consultor.id),
      supabase
        .from("cases")
        .select("id, cliente, descricao, resultado, ordem")
        .eq("consultor_id", consultor.id)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    return {
      id: consultor.id,
      slug: consultor.slug,
      nome: consultor.nome,
      email: consultor.email,
      bio: consultor.bio,
      tempoDeMercado: consultor.tempo_de_mercado,
      telefone: consultor.telefone,
      redes: parseRedes(consultor.redes),
      fotoPath: consultor.foto_path,
      fotoUrl: consultor.foto_path ? `/api/media/${consultor.foto_path}` : null,
      videoPath: consultor.video_path,
      publicado: consultor.publicado,
      areaIds: (vinculos ?? []).map((v) => v.area_id),
      areas: (vinculos ?? [])
        .map((v) => v.areas as { slug: string; nome: string } | null)
        .filter((a): a is { slug: string; nome: string } => Boolean(a)),
      cases: (cases ?? []) as MeuCase[],
    } satisfies MeuPerfil;
  });

const REDES_PERMITIDAS = ["linkedin", "instagram", "site", "youtube", "whatsapp"] as const;

const perfilSchema = z.object({
  bio: z.string().trim().max(4000).optional().nullable(),
  tempoDeMercado: z.coerce.number().int().min(0).max(80).optional().nullable(),
  telefone: z.string().trim().max(40).optional().nullable(),
  emailContato: z.string().trim().email("E-mail de contato inválido").max(255),
  redes: z
    .array(
      z.object({
        rede: z.enum(REDES_PERMITIDAS),
        url: z.string().trim().url().max(300),
      }),
    )
    .max(10)
    .default([]),
  areaIds: z.array(z.string().uuid()).max(20).default([]),
});

/** Normaliza telefone brasileiro para dígitos (com DDI opcional). */
function normalizarTelefone(valor?: string | null): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 0) return null;
  if (digitos.length < 10 || digitos.length > 13) {
    throw new Error("Telefone inválido: informe DDD e número");
  }
  return digitos;
}

/** Atualiza os dados editáveis do próprio perfil e sincroniza as áreas. */
export const updateMeuPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => perfilSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const redes = Object.fromEntries(data.redes.map((r) => [r.rede, r.url]));

    const { error } = await supabase
      .from("consultores")
      .update({
        bio: data.bio?.trim().length ? data.bio.trim() : null,
        tempo_de_mercado: data.tempoDeMercado ?? null,
        telefone: normalizarTelefone(data.telefone),
        email: data.emailContato.toLowerCase(),
        redes,
      })
      .eq("id", consultorId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    const { data: atuais, error: atuaisError } = await supabase
      .from("consultor_areas")
      .select("area_id")
      .eq("consultor_id", consultorId);
    if (atuaisError) throw new Error(atuaisError.message);

    const atuaisSet = new Set((atuais ?? []).map((a) => a.area_id));
    const alvoSet = new Set(data.areaIds);

    const remover = [...atuaisSet].filter((id) => !alvoSet.has(id));
    const inserir = [...alvoSet].filter((id) => !atuaisSet.has(id));

    if (remover.length) {
      const { error: delError } = await supabase
        .from("consultor_areas")
        .delete()
        .eq("consultor_id", consultorId)
        .in("area_id", remover);
      if (delError) throw new Error(delError.message);
    }

    if (inserir.length) {
      const { error: insError } = await supabase
        .from("consultor_areas")
        .insert(inserir.map((area_id) => ({ consultor_id: consultorId, area_id })));
      if (insError) throw new Error(insError.message);
    }

    return { ok: true };
  });

/** Publica ou despublica o próprio perfil. */
export const setPublicado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ publicado: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const { error } = await supabase
      .from("consultores")
      .update({ publicado: data.publicado })
      .eq("id", consultorId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { publicado: data.publicado };
  });

const caseCampos = z.object({
  cliente: z.string().trim().min(2).max(160),
  descricao: z.string().trim().max(2000).optional().nullable(),
  resultado: z.string().trim().max(500).optional().nullable(),
});

/** Cria um case para o consultor logado, no fim da lista. */
export const criarCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => caseCampos.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const { data: ultimo } = await supabase
      .from("cases")
      .select("ordem")
      .eq("consultor_id", consultorId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: novo, error } = await supabase
      .from("cases")
      .insert({
        consultor_id: consultorId,
        cliente: data.cliente,
        descricao: data.descricao?.trim().length ? data.descricao.trim() : null,
        resultado: data.resultado?.trim().length ? data.resultado.trim() : null,
        ordem: (ultimo?.ordem ?? -1) + 1,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: novo.id };
  });

/** Atualiza um case do consultor logado. */
export const atualizarCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => caseCampos.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const { error } = await supabase
      .from("cases")
      .update({
        cliente: data.cliente,
        descricao: data.descricao?.trim().length ? data.descricao.trim() : null,
        resultado: data.resultado?.trim().length ? data.resultado.trim() : null,
      })
      .eq("id", data.id)
      .eq("consultor_id", consultorId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove um case do consultor logado. */
export const removerCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const { error } = await supabase
      .from("cases")
      .delete()
      .eq("id", data.id)
      .eq("consultor_id", consultorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Regrava a ordem dos cases do consultor logado. */
export const reordenarCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    for (const [index, id] of data.ids.entries()) {
      const { error } = await supabase
        .from("cases")
        .update({ ordem: index })
        .eq("id", id)
        .eq("consultor_id", consultorId);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

const uploadSchema = z.object({
  tipo: z.enum(["foto", "video"]),
  contentType: z.string().trim().min(3).max(120),
  size: z.number().int().positive(),
  extensao: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{2,5}$/i, "Extensão inválida"),
});

/**
 * Emite URL de upload assinada para foto (bucket público) ou vídeo de perfil
 * (bucket privado). Revalida tipo e tamanho no servidor e só assina depois de
 * confirmar que o usuário é dono de um perfil de consultor.
 */
export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => uploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const bucket =
      data.tipo === "foto" ? storageConfig.buckets.FOTOS : storageConfig.buckets.VIDEOS;

    validateMimeType(bucket, data.contentType);
    validateFileSize(bucket, data.size);

    const nome = `${crypto.randomUUID()}.${data.extensao.toLowerCase()}`;
    const path = `perfil/${consultorId}/${nome}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !signed) throw new Error(error?.message ?? "Não foi possível iniciar o upload");

    return { bucket, path: signed.path, token: signed.token };
  });

const confirmarSchema = z.object({
  tipo: z.enum(["foto", "video"]),
  path: z.string().trim().min(1).max(400),
});

/** Grava o caminho enviado em `foto_path` ou `video_path` do próprio perfil. */
export const confirmarUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => confirmarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    if (data.path.includes("..") || !data.path.startsWith(`perfil/${consultorId}/`)) {
      throw new Error("Caminho de arquivo inválido para este perfil");
    }

    const patch = data.tipo === "foto" ? { foto_path: data.path } : { video_path: data.path };

    const { error } = await supabase
      .from("consultores")
      .update(patch)
      .eq("id", consultorId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { ok: true, path: data.path };
  });

/** Remove o vídeo de apresentação do próprio perfil (campo opcional). */
export const removerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const { error } = await supabase
      .from("consultores")
      .update({ video_path: null })
      .eq("id", consultorId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const LEAD_STATUS = ["novo", "em_contato", "fechado", "perdido"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export type MeuLead = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  empresa: string | null;
  mensagem: string | null;
  origem: string | null;
  status: LeadStatus;
  criadoEm: string;
};

export type MeusLeads = {
  leads: MeuLead[];
  contagens: Record<"todos" | LeadStatus, number>;
};

/**
 * Leads do consultor logado. A consulta é sempre filtrada pelo `consultor_id`
 * do próprio consultor (além da política de dono no banco).
 * Retorna `null` quando a conta não tem perfil vinculado.
 */
export const listarMeusLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ status: z.enum(LEAD_STATUS).optional().nullable() })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<MeusLeads | null> => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) return null;

    const { data: rows, error } = await supabase
      .from("leads")
      .select("id, nome, email, telefone, empresa, mensagem, origem, status, created_at")
      .eq("consultor_id", consultorId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const todos = (rows ?? []).map((row) => ({
      id: row.id,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      empresa: row.empresa,
      mensagem: row.mensagem,
      origem: row.origem,
      status: row.status as LeadStatus,
      criadoEm: row.created_at,
    }));

    const contagens = {
      todos: todos.length,
      novo: todos.filter((l) => l.status === "novo").length,
      em_contato: todos.filter((l) => l.status === "em_contato").length,
      fechado: todos.filter((l) => l.status === "fechado").length,
      perdido: todos.filter((l) => l.status === "perdido").length,
    };

    const filtro = data?.status ?? null;
    return {
      leads: filtro ? todos.filter((l) => l.status === filtro) : todos,
      contagens,
    };
  });

/** Atualiza o status de um lead do próprio consultor. */
export const atualizarStatusLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(LEAD_STATUS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) throw new Error("Nenhum perfil de consultor vinculado a esta conta");

    const { data: atualizados, error } = await supabase
      .from("leads")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("consultor_id", consultorId)
      .select("id");

    if (error) throw new Error(error.message);
    if (!atualizados || atualizados.length === 0) {
      throw new Error("Lead não encontrado entre os seus contatos");
    }

    return { id: data.id, status: data.status };
  });
