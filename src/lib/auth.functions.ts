import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POLITICA_PRIVACIDADE_VERSAO } from "@/lib/legal";

/**
 * Papéis e vínculo de consultor do usuário autenticado.
 * Usa `has_role` executando como o próprio usuário (RLS aplicada).
 */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [adminResult, consultorResult, consultorRow] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "consultor" }),
      supabase.from("consultores").select("id, nome, slug").eq("user_id", userId).maybeSingle(),
    ]);

    return {
      userId,
      isAdmin: adminResult.data === true,
      isConsultor: consultorResult.data === true,
      consultor: consultorRow.data ?? null,
    };
  });

const bootstrapSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().max(40).optional().nullable(),
  aceiteLgpd: z.literal(true, {
    message: "É necessário aceitar a política de privacidade para criar a conta.",
  }),
});

/**
 * Cria (de forma idempotente) o papel `visitante` e a linha em `usuarios`
 * para uma conta recém-criada. `user_roles` não tem política de inserção,
 * por isso a gravação do papel acontece no servidor.
 */
export const bootstrapVisitante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    const parsed = bootstrapSchema.safeParse(data);
    if (!parsed.success) {
      // Mensagem serializável e legível (ZodError não atravessa bem o RPC).
      throw new Error(parsed.error.issues[0]?.message ?? "Dados de cadastro inválidos.");
    }
    return parsed.data;
  })

  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims.email as string | undefined) ?? "";

    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // Consultores e admins não são rebaixados nem ganham linha em `usuarios`.
    const hasPrivilegedRole = (existingRoles ?? []).some(
      (r) => r.role === "admin" || r.role === "consultor",
    );
    if (hasPrivilegedRole) {
      return { created: false, reason: "privileged_role" as const };
    }

    if (!(existingRoles ?? []).some((r) => r.role === "visitante")) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "visitante" });
      if (error && error.code !== "23505") throw error;
    }

    const { data: existingUsuario } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingUsuario) {
      const { error } = await supabaseAdmin.from("usuarios").insert({
        user_id: userId,
        nome: data.nome,
        email,
        telefone: data.telefone?.length ? data.telefone : null,
        consentimento_lgpd_em: new Date().toISOString(),
        consentimento_lgpd_versao: POLITICA_PRIVACIDADE_VERSAO,
      });
      if (error && error.code !== "23505") throw error;
    }

    return { created: true, reason: null };
  });
