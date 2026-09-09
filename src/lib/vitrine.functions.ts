import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

type PublicClient = ReturnType<typeof createClient<Database>>;

function getPublicClient(): PublicClient {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
}

export type AreaResumo = { id: string; slug: string; nome: string; descricao: string | null };

export type ConsultorCard = {
  id: string;
  slug: string;
  nome: string;
  bio: string | null;
  fotoUrl: string | null;
  areas: { slug: string; nome: string }[];
};

/** Lista as áreas de atuação (leitura pública). */
export const listAreas = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, slug, nome, descricao")
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AreaResumo[];
});

const listSchema = z.object({
  areas: z.array(z.string().trim().max(120)).max(50).optional().nullable(),
  q: z.string().trim().max(120).optional().nullable(),
});

/**
 * Consultores publicados, opcionalmente filtrados por várias áreas (slugs) e
 * termo livre (nome ou bio). Só usa políticas públicas (`publicado = true`).
 */
export const listConsultoresPublicados = createServerFn({ method: "GET" })
  .inputValidator((data) => listSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();

    const slugs = (data.areas ?? []).filter((s) => s.length > 0);
    let consultorIdsPorArea: string[] | null = null;
    if (slugs.length > 0) {
      const { data: areas } = await supabase.from("areas").select("id").in("slug", slugs);

      if (!areas || areas.length === 0) return [] as ConsultorCard[];

      const { data: vinculos, error: vinculosError } = await supabase
        .from("consultor_areas")
        .select("consultor_id")
        .in(
          "area_id",
          areas.map((a) => a.id),
        );

      if (vinculosError) throw new Error(vinculosError.message);
      consultorIdsPorArea = [...new Set((vinculos ?? []).map((v) => v.consultor_id))];
      if (consultorIdsPorArea.length === 0) return [] as ConsultorCard[];
    }

    let query = supabase
      .from("consultores")
      .select("id, slug, nome, bio, foto_path, ordem")
      .eq("publicado", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (consultorIdsPorArea) query = query.in("id", consultorIdsPorArea);

    const termo = data.q?.trim();
    if (termo) {
      const like = `%${termo.replace(/[%_]/g, "")}%`;
      query = query.or(`nome.ilike.${like},bio.ilike.${like}`);
    }

    const { data: consultores, error } = await query;
    if (error) throw new Error(error.message);
    if (!consultores || consultores.length === 0) return [] as ConsultorCard[];

    const ids = consultores.map((c) => c.id);
    const { data: vinculos } = await supabase
      .from("consultor_areas")
      .select("consultor_id, areas(slug, nome)")
      .in("consultor_id", ids);

    const areasPorConsultor = new Map<string, { slug: string; nome: string }[]>();
    for (const vinculo of vinculos ?? []) {
      const area = vinculo.areas as { slug: string; nome: string } | null;
      if (!area) continue;
      const atual = areasPorConsultor.get(vinculo.consultor_id) ?? [];
      atual.push({ slug: area.slug, nome: area.nome });
      areasPorConsultor.set(vinculo.consultor_id, atual);
    }

    return consultores.map<ConsultorCard>((c) => ({
      id: c.id,
      slug: c.slug,
      nome: c.nome,
      bio: c.bio,
      fotoUrl: c.foto_path ? `/api/media/${c.foto_path}` : null,
      areas: areasPorConsultor.get(c.id) ?? [],
    }));
  });

const buscaSchema = z.object({
  areas: z.array(z.string().trim().max(120)).max(50).optional().nullable(),
  termo: z.string().trim().max(200).optional().nullable(),
});

/**
 * Registra uma busca da vitrine. Uma linha por área selecionada (`area_id`
 * resolvido no servidor); sem áreas, tenta casar o termo livre com o nome de
 * uma área e registra uma única linha.
 */
export const registrarBusca = createServerFn({ method: "POST" })
  .inputValidator((data) => buscaSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    const termo = data.termo?.trim() ? data.termo.trim() : null;
    const slugs = (data.areas ?? []).filter((s) => s.length > 0);
    let areaIds: string[] = [];

    if (slugs.length > 0) {
      const { data: areas } = await supabase.from("areas").select("id").in("slug", slugs);
      areaIds = (areas ?? []).map((a) => a.id);
    } else if (termo) {
      const { data: area } = await supabase
        .from("areas")
        .select("id")
        .ilike("nome", termo)
        .maybeSingle();
      if (area) areaIds = [area.id];
    }

    if (areaIds.length === 0 && !termo) return { registrada: false };

    const linhas: { area_id: string | null; termo: string | null }[] =
      areaIds.length > 0
        ? areaIds.map((areaId) => ({ area_id: areaId, termo }))
        : [{ area_id: null, termo }];

    const { error } = await supabase.from("buscas").insert(linhas);
    if (error) throw new Error(error.message);

    return { registrada: true };
  });

const consultorSchema = z.object({ slug: z.string().trim().min(1).max(160) });

export type ConsultorCase = {
  id: string;
  cliente: string;
  descricao: string | null;
  resultado: string | null;
};

export type ConsultorRede = { rede: string; url: string };

export type ConsultorPerfil = {
  id: string;
  slug: string;
  nome: string;
  bio: string | null;
  tempoDeMercado: number | null;
  fotoUrl: string | null;
  fotoUrlAbsoluta: string | null;
  telefone: string | null;
  email: string | null;
  videoPath: string | null;
  origin: string;
  redes: ConsultorRede[];
  areas: { slug: string; nome: string }[];
  cases: ConsultorCase[];
};

function parseRedes(value: unknown): ConsultorRede[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, url]) => typeof url === "string" && url.trim().length > 0)
    .map(([rede, url]) => ({ rede, url: (url as string).trim() }));
}

/** Consultor publicado por slug, para a página de perfil pública. */
export const getConsultorPublicado = createServerFn({ method: "GET" })
  .inputValidator((data) => consultorSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getPublicClient();

    const { data: consultor, error } = await supabase
      .from("consultores")
      .select(
        "id, slug, nome, bio, foto_path, tempo_de_mercado, video_path, redes, telefone, email",
      )
      .eq("slug", data.slug)
      .eq("publicado", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!consultor) return null;

    const [{ data: vinculos }, { data: cases }] = await Promise.all([
      supabase.from("consultor_areas").select("areas(slug, nome)").eq("consultor_id", consultor.id),
      supabase
        .from("cases")
        .select("id, cliente, descricao, resultado")
        .eq("consultor_id", consultor.id)
        .order("created_at", { ascending: true }),
    ]);

    const request = getRequest();
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host") ?? "";
    const origin = host ? `${proto}://${host}` : "";
    const fotoUrl = consultor.foto_path ? `/api/media/${consultor.foto_path}` : null;

    return {
      id: consultor.id,
      slug: consultor.slug,
      nome: consultor.nome,
      bio: consultor.bio,
      tempoDeMercado: consultor.tempo_de_mercado,
      fotoUrl,
      fotoUrlAbsoluta: fotoUrl && origin ? `${origin}${fotoUrl}` : null,
      telefone: consultor.telefone,
      email: consultor.email,
      videoPath: consultor.video_path,
      origin,
      redes: parseRedes(consultor.redes),
      areas: (vinculos ?? [])
        .map((v) => v.areas as { slug: string; nome: string } | null)
        .filter((a): a is { slug: string; nome: string } => Boolean(a)),
      cases: (cases ?? []) as ConsultorCase[],
    } satisfies ConsultorPerfil;
  });
