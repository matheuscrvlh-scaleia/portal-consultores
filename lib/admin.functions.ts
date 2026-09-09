import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.guard";
import {
  areaSchema,
  atualizarConsultorSchema,
  normalizarTelefone,
  parseRedes,
} from "./admin.schemas";
import { slugDisponivel, slugify } from "./slug";

export type ConsultorAdminResumo = {
  id: string;
  nome: string;
  email: string;
  slug: string;
  publicado: boolean;
  fotoUrl: string | null;
  areas: { id: string; nome: string }[];
  contaEmail: string | null;
  userId: string | null;
  leads: number;
  conteudos: number;
};

export type AreaAdmin = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  consultores: number;
  conteudos: number;
};

/** Contadores do painel administrativo. RLS de admin controla a leitura. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const [consultores, publicados, areas, leads] = await Promise.all([
      supabase.from("consultores").select("id", { count: "exact", head: true }),
      supabase
        .from("consultores")
        .select("id", { count: "exact", head: true })
        .eq("publicado", true),
      supabase.from("areas").select("id", { count: "exact", head: true }),
      supabase.from("leads").select("id", { count: "exact", head: true }),
    ]);

    return {
      consultores: consultores.count ?? 0,
      publicados: publicados.count ?? 0,
      areas: areas.count ?? 0,
      leads: leads.count ?? 0,
    };
  });

/** Lista todos os consultores (publicados ou não) com áreas, conta vinculada e contagens. */
export const listarConsultoresAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsultorAdminResumo[]> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const [{ data: consultores, error }, { data: vinculos }, { data: leads }, { data: conteudos }] =
      await Promise.all([
        supabase
          .from("consultores")
          .select("id, nome, email, slug, publicado, foto_path, user_id")
          .order("nome", { ascending: true }),
        supabase.from("consultor_areas").select("consultor_id, areas(id, nome)"),
        supabase.from("leads").select("consultor_id"),
        supabase.from("conteudos").select("consultor_id"),
      ]);

    if (error) throw new Error(error.message);

    const userIds = (consultores ?? [])
      .map((c) => c.user_id)
      .filter((id): id is string => Boolean(id));

    const emails = new Map<string, string>();
    if (userIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: contas } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      for (const conta of contas?.users ?? []) {
        if (conta.email) emails.set(conta.id, conta.email);
      }
    }

    const contar = (rows: { consultor_id: string | null }[] | null, id: string) =>
      (rows ?? []).filter((r) => r.consultor_id === id).length;

    return (consultores ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      email: c.email,
      slug: c.slug,
      publicado: c.publicado,
      fotoUrl: c.foto_path ? `/api/media/${c.foto_path}` : null,
      areas: (vinculos ?? [])
        .filter((v) => v.consultor_id === c.id)
        .map((v) => v.areas as { id: string; nome: string } | null)
        .filter((a): a is { id: string; nome: string } => Boolean(a)),
      contaEmail: c.user_id ? (emails.get(c.user_id) ?? null) : null,
      userId: c.user_id ?? null,
      leads: contar(leads, c.id),
      conteudos: contar(conteudos, c.id),
    }));
  });

/** Consultor completo para edição pelo admin. */
export const getConsultorAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { data: consultor, error } = await supabase
      .from("consultores")
      .select(
        "id, slug, nome, email, bio, tempo_de_mercado, telefone, redes, foto_path, video_path, publicado, user_id",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!consultor) throw new Error("Consultor não encontrado");

    const [{ data: vinculos }, { data: cases }] = await Promise.all([
      supabase
        .from("consultor_areas")
        .select("area_id, areas(slug, nome)")
        .eq("consultor_id", consultor.id),
      supabase
        .from("cases")
        .select("id, cliente, descricao, resultado, ordem")
        .eq("consultor_id", consultor.id)
        .order("ordem", { ascending: true }),
    ]);

    let contaEmail: string | null = null;
    if (consultor.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: conta } = await supabaseAdmin.auth.admin.getUserById(consultor.user_id);
      contaEmail = conta?.user?.email ?? null;
    }

    return {
      id: consultor.id,
      slug: consultor.slug,
      nome: consultor.nome,
      email: consultor.email,
      bio: consultor.bio,
      tempoDeMercado: consultor.tempo_de_mercado,
      telefone: consultor.telefone,
      redes: parseRedes(consultor.redes),
      fotoUrl: consultor.foto_path ? `/api/media/${consultor.foto_path}` : null,
      temVideo: Boolean(consultor.video_path),
      publicado: consultor.publicado,
      userId: consultor.user_id ?? null,
      contaEmail,
      areaIds: (vinculos ?? []).map((v) => v.area_id),
      areas: (vinculos ?? [])
        .map((v) => v.areas as { slug: string; nome: string } | null)
        .filter((a): a is { slug: string; nome: string } => Boolean(a)),
      cases: (cases ?? []).map((c) => ({
        id: c.id,
        cliente: c.cliente,
        descricao: c.descricao,
        resultado: c.resultado,
        ordem: c.ordem,
      })),
    };
  });

/** Atualiza qualquer consultor e sincroniza as áreas vinculadas. */
export const atualizarConsultorAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => atualizarConsultorSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { data: existentes } = await supabase.from("consultores").select("id, slug");
    const usados = new Set(
      (existentes ?? []).filter((c) => c.id !== data.id).map((c) => c.slug),
    );
    const slug = slugDisponivel(slugify(data.slug) || "consultor", usados);

    const redes = Object.fromEntries(data.redes.map((r) => [r.rede, r.url]));

    const { error } = await supabase
      .from("consultores")
      .update({
        nome: data.nome,
        email: data.email,
        slug,
        bio: data.bio?.trim().length ? data.bio.trim() : null,
        tempo_de_mercado: data.tempoDeMercado ?? null,
        telefone: normalizarTelefone(data.telefone),
        redes,
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    const { data: atuais, error: atuaisError } = await supabase
      .from("consultor_areas")
      .select("area_id")
      .eq("consultor_id", data.id);
    if (atuaisError) throw new Error(atuaisError.message);

    const atuaisSet = new Set((atuais ?? []).map((a) => a.area_id));
    const alvoSet = new Set(data.areaIds);
    const remover = [...atuaisSet].filter((id) => !alvoSet.has(id));
    const inserir = [...alvoSet].filter((id) => !atuaisSet.has(id));

    if (remover.length) {
      const { error: delError } = await supabase
        .from("consultor_areas")
        .delete()
        .eq("consultor_id", data.id)
        .in("area_id", remover);
      if (delError) throw new Error(delError.message);
    }

    if (inserir.length) {
      const { error: insError } = await supabase
        .from("consultor_areas")
        .insert(inserir.map((area_id) => ({ consultor_id: data.id, area_id })));
      if (insError) throw new Error(insError.message);
    }

    return { ok: true, slug };
  });

/** Publica ou despublica qualquer consultor. */
export const setPublicadoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), publicado: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { error } = await supabase
      .from("consultores")
      .update({ publicado: data.publicado })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id, publicado: data.publicado };
  });

/** Áreas com a contagem de consultores e conteúdos que as usam. */
export const listarAreasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AreaAdmin[]> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const [{ data: areas, error }, { data: vinculos }, { data: conteudos }] = await Promise.all([
      supabase.from("areas").select("id, slug, nome, descricao").order("nome"),
      supabase.from("consultor_areas").select("area_id"),
      supabase.from("conteudos").select("area_id"),
    ]);
    if (error) throw new Error(error.message);

    return (areas ?? []).map((a) => ({
      id: a.id,
      slug: a.slug,
      nome: a.nome,
      descricao: a.descricao,
      consultores: (vinculos ?? []).filter((v) => v.area_id === a.id).length,
      conteudos: (conteudos ?? []).filter((c) => c.area_id === a.id).length,
    }));
  });

/** Cria uma área nova, com slug gerado a partir do nome. */
export const criarArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => areaSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { data: existentes } = await supabase.from("areas").select("slug");
    const usados = new Set((existentes ?? []).map((a) => a.slug));
    const slug = slugDisponivel(slugify(data.slug ?? data.nome) || "area", usados);

    const { data: nova, error } = await supabase
      .from("areas")
      .insert({
        nome: data.nome,
        slug,
        descricao: data.descricao?.trim().length ? data.descricao.trim() : null,
      })
      .select("id, slug")
      .single();

    if (error) throw new Error(error.message);
    return { id: nova.id, slug: nova.slug };
  });

/** Atualiza nome, slug e descrição de uma área. */
export const atualizarArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => areaSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { data: existentes } = await supabase.from("areas").select("id, slug");
    const usados = new Set(
      (existentes ?? []).filter((a) => a.id !== data.id).map((a) => a.slug),
    );
    const slug = slugDisponivel(slugify(data.slug ?? data.nome) || "area", usados);

    const { error } = await supabase
      .from("areas")
      .update({
        nome: data.nome,
        slug,
        descricao: data.descricao?.trim().length ? data.descricao.trim() : null,
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true, slug };
  });

/** Remove uma área somente quando nenhum consultor ou conteúdo a usa. */
export const removerArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const [{ count: consultores }, { count: conteudos }] = await Promise.all([
      supabase
        .from("consultor_areas")
        .select("id", { count: "exact", head: true })
        .eq("area_id", data.id),
      supabase
        .from("conteudos")
        .select("id", { count: "exact", head: true })
        .eq("area_id", data.id),
    ]);

    const usoConsultores = consultores ?? 0;
    const usoConteudos = conteudos ?? 0;

    if (usoConsultores > 0 || usoConteudos > 0) {
      const partes = [
        usoConsultores > 0
          ? `${usoConsultores} ${usoConsultores === 1 ? "consultor" : "consultores"}`
          : null,
        usoConteudos > 0
          ? `${usoConteudos} ${usoConteudos === 1 ? "conteúdo" : "conteúdos"}`
          : null,
      ].filter(Boolean);
      return {
        removida: false as const,
        motivo: `Não é possível remover: ${partes.join(" e ")} ${
          partes.length > 1 || usoConsultores > 1 || usoConteudos > 1 ? "usam" : "usa"
        } esta área.`,
      };
    }

    const { error } = await supabase.from("areas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { removida: true as const, motivo: null };
  });
