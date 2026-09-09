import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugDisponivel, slugify } from "./slug";
import { storageConfig, validateFileSize, validateMimeType } from "./storage.validators";

export type MeuConteudo = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  areaId: string | null;
  area: { slug: string; nome: string } | null;
  videoPath: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  publicado: boolean;
  criadoEm: string;
};

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

async function exigirConsultorId(supabase: ConsultorLookupClient, userId: string): Promise<string> {
  const id = await getMeuConsultorId(supabase, userId);
  if (!id) throw new Error("Nenhum perfil de consultor vinculado a esta conta");
  return id;
}

const SELECT_CONTEUDO =
  "id, slug, titulo, descricao, area_id, video_path, poster_path, publicado, created_at, areas(slug, nome)";

function toMeuConteudo(row: unknown): MeuConteudo {
  const r = row as {
    id: string;
    slug: string;
    titulo: string;
    descricao: string | null;
    area_id: string | null;
    video_path: string | null;
    poster_path: string | null;
    publicado: boolean;
    created_at: string;
    areas: { slug: string; nome: string } | null;
  };
  const area = r.areas ?? null;
  return {
    id: r.id,
    slug: r.slug,
    titulo: r.titulo,
    descricao: r.descricao,
    areaId: r.area_id,
    area,
    videoPath: r.video_path,
    posterPath: r.poster_path,
    posterUrl: r.poster_path ? `/api/media/${r.poster_path}` : null,
    publicado: r.publicado,
    criadoEm: r.created_at,
  };
}

/**
 * Conteúdos do consultor logado (rascunhos e publicados). A consulta é sempre
 * filtrada pelo `consultor_id` do próprio consultor, além da política de dono.
 * Retorna `null` quando a conta não tem perfil vinculado.
 */
export const listarMeusConteudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeuConteudo[] | null> => {
    const { supabase, userId } = context;
    const consultorId = await getMeuConsultorId(supabase as never, userId);
    if (!consultorId) return null;

    const { data, error } = await supabase
      .from("conteudos")
      .select(SELECT_CONTEUDO)
      .eq("consultor_id", consultorId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toMeuConteudo(row));
  });

/** Um conteúdo do próprio consultor, pelo id. `null` quando não é dele. */
export const getMeuConteudo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<MeuConteudo | null> => {
    const { supabase, userId } = context;
    const consultorId = await exigirConsultorId(supabase as never, userId);

    const { data: row, error } = await supabase
      .from("conteudos")
      .select(SELECT_CONTEUDO)
      .eq("id", data.id)
      .eq("consultor_id", consultorId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row ? toMeuConteudo(row) : null;
  });

const campos = z.object({
  titulo: z.string().trim().min(3, "Informe um título").max(160),
  descricao: z.string().trim().max(4000).optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
});

/** Gera um slug livre a partir do título, checando colisão em toda a tabela. */
async function gerarSlug(titulo: string, ignorarId?: string): Promise<string> {
  const base = slugify(titulo);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("conteudos")
    .select("id, slug")
    .like("slug", `${base}%`);

  const usados = new Set(
    (data ?? []).filter((r) => r.id !== ignorarId).map((r) => r.slug as string),
  );
  return slugDisponivel(base, usados);
}

/** Cria um conteúdo em rascunho para o consultor logado. */
export const criarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => campos.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await exigirConsultorId(supabase as never, userId);

    const slug = await gerarSlug(data.titulo);

    const { data: novo, error } = await supabase
      .from("conteudos")
      .insert({
        consultor_id: consultorId,
        tipo: "video" as const,
        titulo: data.titulo,
        slug,
        descricao: data.descricao?.trim().length ? data.descricao.trim() : null,
        area_id: data.areaId ?? null,
        publicado: false,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: novo.id as string, slug };
  });

/** Atualiza título (e slug), descrição e área de um conteúdo próprio. */
export const atualizarConteudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => campos.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await exigirConsultorId(supabase as never, userId);

    const { data: atual, error: atualError } = await supabase
      .from("conteudos")
      .select("id, titulo, slug")
      .eq("id", data.id)
      .eq("consultor_id", consultorId)
      .maybeSingle();
    if (atualError) throw new Error(atualError.message);
    if (!atual) throw new Error("Conteúdo não encontrado entre os seus");

    const slug =
      slugify(data.titulo) === slugify(atual.titulo)
        ? atual.slug
        : await gerarSlug(data.titulo, data.id);

    const { error } = await supabase
      .from("conteudos")
      .update({
        titulo: data.titulo,
        slug,
        descricao: data.descricao?.trim().length ? data.descricao.trim() : null,
        area_id: data.areaId ?? null,
      })
      .eq("id", data.id)
      .eq("consultor_id", consultorId);

    if (error) throw new Error(error.message);
    return { id: data.id, slug };
  });

/** Publica ou despublica um conteúdo próprio. Publicar exige área e vídeo. */
export const setConteudoPublicado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), publicado: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await exigirConsultorId(supabase as never, userId);

    const { data: atual, error: atualError } = await supabase
      .from("conteudos")
      .select("id, titulo, area_id, video_path")
      .eq("id", data.id)
      .eq("consultor_id", consultorId)
      .maybeSingle();
    if (atualError) throw new Error(atualError.message);
    if (!atual) throw new Error("Conteúdo não encontrado entre os seus");

    if (data.publicado) {
      const faltando: string[] = [];
      if (!atual.titulo?.trim()) faltando.push("título");
      if (!atual.area_id) faltando.push("área");
      if (!atual.video_path) faltando.push("vídeo");
      if (faltando.length) {
        throw new Error(`Para publicar, falta preencher: ${faltando.join(", ")}`);
      }
    }

    const { error } = await supabase
      .from("conteudos")
      .update({ publicado: data.publicado })
      .eq("id", data.id)
      .eq("consultor_id", consultorId);

    if (error) throw new Error(error.message);
    return { id: data.id, publicado: data.publicado };
  });

const uploadSchema = z.object({
  conteudoId: z.string().uuid(),
  tipo: z.enum(["poster", "video"]),
  contentType: z.string().trim().min(3).max(120),
  size: z.number().int().positive(),
  extensao: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{2,5}$/i, "Extensão inválida"),
});

/**
 * Emite URL de upload assinada para o poster (bucket público) ou o vídeo
 * (bucket privado) de um conteúdo do próprio consultor. Revalida tipo e
 * tamanho no servidor e só assina após confirmar a posse do conteúdo.
 */
export const createConteudoUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => uploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await exigirConsultorId(supabase as never, userId);

    const { data: conteudo } = await supabase
      .from("conteudos")
      .select("id")
      .eq("id", data.conteudoId)
      .eq("consultor_id", consultorId)
      .maybeSingle();
    if (!conteudo) throw new Error("Conteúdo não encontrado entre os seus");

    const bucket =
      data.tipo === "poster" ? storageConfig.buckets.FOTOS : storageConfig.buckets.VIDEOS;

    validateMimeType(bucket, data.contentType);
    validateFileSize(bucket, data.size);

    const nome = `${crypto.randomUUID()}.${data.extensao.toLowerCase()}`;
    const path = `biblioteca/${data.conteudoId}/${nome}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !signed) throw new Error(error?.message ?? "Não foi possível iniciar o upload");

    return { bucket, path: signed.path, token: signed.token };
  });

const confirmarSchema = z.object({
  conteudoId: z.string().uuid(),
  tipo: z.enum(["poster", "video"]),
  path: z.string().trim().min(1).max(400),
});

/** Grava o caminho enviado em `poster_path` ou `video_path` do conteúdo. */
export const confirmarConteudoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => confirmarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const consultorId = await exigirConsultorId(supabase as never, userId);

    if (data.path.includes("..") || !data.path.startsWith(`biblioteca/${data.conteudoId}/`)) {
      throw new Error("Caminho de arquivo inválido para este conteúdo");
    }

    const patch = data.tipo === "poster" ? { poster_path: data.path } : { video_path: data.path };

    const { data: atualizados, error } = await supabase
      .from("conteudos")
      .update(patch)
      .eq("id", data.conteudoId)
      .eq("consultor_id", consultorId)
      .select("id");

    if (error) throw new Error(error.message);
    if (!atualizados || atualizados.length === 0) {
      throw new Error("Conteúdo não encontrado entre os seus");
    }

    return { ok: true, path: data.path };
  });
