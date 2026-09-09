import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.guard";
import { normalizarTelefone, perfilConsultorSchema } from "./admin.schemas";
import { slugDisponivel, slugify } from "./slug";
import {
  buscarConsultorDaConta,
  listarUsuariosAuth,
  removerConsultorCompleto,
  trocarPapel,
} from "./usuarios-admin.server";

export const PAPEIS = ["visitante", "consultor", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export type ContaAdmin = {
  id: string;
  email: string;
  papel: Papel | null;
  criadoEm: string;
  consultor: { id: string; nome: string; slug: string; publicado: boolean } | null;
};

/** Todas as contas de login com o papel atual e o perfil de consultor, se houver. */
export const listarContasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ termo: z.string().trim().max(160).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<ContaAdmin[]> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const contas = await listarUsuariosAuth(supabaseAdmin);

    const [{ data: papeis }, { data: consultores }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("consultores").select("id, nome, slug, publicado, user_id"),
    ]);

    const termo = (data.termo ?? "").toLowerCase();

    return contas
      .filter((c) => Boolean(c.email))
      .filter((c) => (termo ? (c.email ?? "").toLowerCase().includes(termo) : true))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((c) => {
        const papel = (papeis ?? []).find((p) => p.user_id === c.id)?.role ?? null;
        const consultor = (consultores ?? []).find((x) => x.user_id === c.id) ?? null;
        return {
          id: c.id,
          email: c.email as string,
          papel: (papel as Papel | null) ?? null,
          criadoEm: c.created_at,
          consultor: consultor
            ? {
                id: consultor.id,
                nome: consultor.nome,
                slug: consultor.slug,
                publicado: consultor.publicado,
              }
            : null,
        };
      });
  });

const criarContaSchema = z
  .object({
    email: z.string().trim().email("E-mail inválido").max(255),
    senha: z.string().min(8, "A senha inicial precisa ter ao menos 8 caracteres").max(72),
    papel: z.enum(PAPEIS),
    perfil: perfilConsultorSchema.optional().nullable(),
  })
  .refine((v) => v.papel !== "consultor" || Boolean(v.perfil), {
    message: "Preencha os dados de perfil do consultor.",
    path: ["perfil"],
  });

/**
 * Cria a conta de login com senha definida pelo admin (já confirmada) e o
 * papel único escolhido. Para consultor, cria também o perfil vinculado em
 * rascunho — se o perfil falhar, a conta recém-criada é desfeita.
 */
export const criarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    const parsed = criarContaSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    const existentes = await listarUsuariosAuth(supabaseAdmin);
    if (existentes.some((c) => (c.email ?? "").toLowerCase() === email)) {
      throw new Error("Já existe uma conta com este e-mail.");
    }

    const telefone = data.perfil ? normalizarTelefone(data.perfil.telefone) : null;

    const { data: criada, error: criarError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.senha,
      email_confirm: true,
    });
    if (criarError || !criada?.user) {
      throw new Error(criarError?.message ?? "Não foi possível criar a conta.");
    }

    const novoUserId = criada.user.id;

    try {
      await trocarPapel(supabaseAdmin, novoUserId, data.papel);

      if (data.papel === "consultor" && data.perfil) {
        const { data: slugsExistentes } = await supabaseAdmin.from("consultores").select("slug");
        const usados = new Set((slugsExistentes ?? []).map((c) => c.slug));
        const slug = slugDisponivel(slugify(data.perfil.nome) || "consultor", usados);

        const { data: consultor, error } = await supabaseAdmin
          .from("consultores")
          .insert({
            user_id: novoUserId,
            nome: data.perfil.nome,
            email,
            slug,
            bio: data.perfil.bio?.trim().length ? data.perfil.bio.trim() : null,
            tempo_de_mercado: data.perfil.tempoDeMercado ?? null,
            telefone,
            redes: Object.fromEntries(data.perfil.redes.map((r) => [r.rede, r.url])),
            publicado: false,
          })
          .select("id, slug")
          .single();
        if (error) throw new Error(error.message);

        if (data.perfil.areaIds.length > 0) {
          const { error: areasError } = await supabaseAdmin
            .from("consultor_areas")
            .insert(
              data.perfil.areaIds.map((area_id) => ({ consultor_id: consultor.id, area_id })),
            );
          if (areasError) throw new Error(areasError.message);
        }

        return { id: novoUserId, email, papel: data.papel, consultorId: consultor.id };
      }

      return { id: novoUserId, email, papel: data.papel, consultorId: null };
    } catch (erro) {
      // Desfaz a conta para não deixar login órfão sem papel/perfil.
      await supabaseAdmin.auth.admin.deleteUser(novoUserId);
      throw erro instanceof Error ? erro : new Error("Não foi possível criar a conta.");
    }
  });

const alterarPapelSchema = z.object({
  userId: z.string().uuid(),
  papel: z.enum(PAPEIS),
  perfil: perfilConsultorSchema.optional().nullable(),
  confirmacao: z.string().trim().max(200).optional().nullable(),
});

/**
 * Troca o papel único da conta. Virar consultor cria o perfil vinculado; sair
 * de consultor apaga arquivos, conteúdos, cases, leads e o perfil antes da
 * troca, exigindo o nome do consultor como confirmação.
 */
export const alterarPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    const parsed = alterarPapelSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    if (data.userId === userId) {
      throw new Error("Você não pode alterar o papel da sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: papelAtualRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    const papelAtual = (papelAtualRow?.role as Papel | undefined) ?? null;

    if (papelAtual === data.papel) {
      return { ok: true as const, papel: data.papel, semMudanca: true as const };
    }

    const consultor = await buscarConsultorDaConta(supabaseAdmin, data.userId);

    // Saindo de consultor: limpeza destrutiva antes da troca.
    if (papelAtual === "consultor" && consultor) {
      const informado = (data.confirmacao ?? "").trim().toLowerCase();
      if (informado !== consultor.nome.trim().toLowerCase()) {
        throw new Error(
          `Confirmação inválida: digite exatamente o nome do consultor (${consultor.nome}).`,
        );
      }
      await removerConsultorCompleto(supabaseAdmin, consultor.id);
      await trocarPapel(supabaseAdmin, data.userId, data.papel);
      return { ok: true as const, papel: data.papel, semMudanca: false as const };
    }

    // Virando consultor: cria o perfil na mesma operação.
    if (data.papel === "consultor") {
      if (consultor) {
        await trocarPapel(supabaseAdmin, data.userId, data.papel);
        return { ok: true as const, papel: data.papel, semMudanca: false as const };
      }
      if (!data.perfil) throw new Error("Preencha os dados de perfil do consultor.");

      const telefone = normalizarTelefone(data.perfil.telefone);
      const { data: conta } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      const email = conta?.user?.email ?? "";

      const { data: slugsExistentes } = await supabaseAdmin.from("consultores").select("slug");
      const usados = new Set((slugsExistentes ?? []).map((c) => c.slug));
      const slug = slugDisponivel(slugify(data.perfil.nome) || "consultor", usados);

      const { data: novo, error } = await supabaseAdmin
        .from("consultores")
        .insert({
          user_id: data.userId,
          nome: data.perfil.nome,
          email,
          slug,
          bio: data.perfil.bio?.trim().length ? data.perfil.bio.trim() : null,
          tempo_de_mercado: data.perfil.tempoDeMercado ?? null,
          telefone,
          redes: Object.fromEntries(data.perfil.redes.map((r) => [r.rede, r.url])),
          publicado: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (data.perfil.areaIds.length > 0) {
        const { error: areasError } = await supabaseAdmin
          .from("consultor_areas")
          .insert(data.perfil.areaIds.map((area_id) => ({ consultor_id: novo.id, area_id })));
        if (areasError) throw new Error(areasError.message);
      }

      await trocarPapel(supabaseAdmin, data.userId, data.papel);
      return { ok: true as const, papel: data.papel, semMudanca: false as const };
    }

    // Visitante ↔ Admin: troca direta.
    await trocarPapel(supabaseAdmin, data.userId, data.papel);
    return { ok: true as const, papel: data.papel, semMudanca: false as const };
  });

const excluirContaSchema = z.object({
  userId: z.string().uuid(),
  confirmacao: z.string().trim().max(200).optional().nullable(),
});

/**
 * Remove a conta de login por completo. Se for consultor, faz antes a mesma
 * limpeza destrutiva da troca de papel, com a mesma confirmação forte.
 */
export const excluirConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => excluirContaSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    if (data.userId === userId) {
      throw new Error("Você não pode excluir a sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const consultor = await buscarConsultorDaConta(supabaseAdmin, data.userId);
    if (consultor) {
      const informado = (data.confirmacao ?? "").trim().toLowerCase();
      if (informado !== consultor.nome.trim().toLowerCase()) {
        throw new Error(
          `Confirmação inválida: digite exatamente o nome do consultor (${consultor.nome}).`,
        );
      }
      await removerConsultorCompleto(supabaseAdmin, consultor.id);
    }

    const { error: usuariosError } = await supabaseAdmin
      .from("usuarios")
      .delete()
      .eq("user_id", data.userId);
    if (usuariosError) throw new Error(usuariosError.message);

    const { error: papelError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (papelError) throw new Error(papelError.message);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

const definirSenhaSchema = z.object({
  userId: z.string().uuid(),
  senha: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres").max(72),
});

/**
 * Define uma nova senha para a conta pela Auth Admin API: sem e-mail de
 * recuperação e sem exigir a senha atual — é o admin agindo por fora.
 */
export const definirSenhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    const parsed = definirSenhaSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

const atualizarEmailSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email("E-mail inválido").max(255),
});

/**
 * Corrige o e-mail de login da conta. Não toca papel nem perfil de consultor;
 * recusa se o e-mail já pertencer a outra conta.
 */
export const atualizarEmailConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    const parsed = atualizarEmailSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase as never, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const contas = await listarUsuariosAuth(supabaseAdmin);
    const conflito = contas.find(
      (c) => (c.email ?? "").toLowerCase() === email && c.id !== data.userId,
    );
    if (conflito) throw new Error("Já existe outra conta com este e-mail.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, email };
  });
