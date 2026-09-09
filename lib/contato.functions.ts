import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { createHash } from "crypto";

import { z } from "zod";

import { notificarNovoLead } from "./notificacoes.server";

const LIMITE_POR_HORA = 5;

const contatoSchema = z.object({
  consultorSlug: z.string().trim().min(1).max(160),
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().max(40).optional().nullable(),
  empresa: z.string().trim().max(120).optional().nullable(),
  mensagem: z.string().trim().max(2000).optional().nullable(),
  origem: z.string().trim().max(160).optional().nullable(),
  /** Honeypot: precisa chegar vazio; se vier preenchido, é bot. */
  website: z.string().max(200).optional().nullable(),
});

export type EnviarContatoResultado =
  | { ok: true }
  | { ok: false; motivo: "rate_limit" | "consultor_indisponivel" };

/** Mantém só os dígitos e valida telefone brasileiro (10 ou 11 dígitos, com DDI opcional). */
function normalizarTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "").replace(/^0+/, "");
  const local = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  if (local.length < 10 || local.length > 11) return null;
  return `+55${local}`;
}

export const enviarContato = createServerFn({ method: "POST" })
  .inputValidator((data) => contatoSchema.parse(data))
  .handler(async ({ data }): Promise<EnviarContatoResultado> => {
    // Honeypot preenchido: descarta silenciosamente, respondendo como sucesso.
    if (data.website && data.website.trim().length > 0) return { ok: true };

    let telefone: string | null = null;
    if (data.telefone && data.telefone.trim().length > 0) {
      telefone = normalizarTelefone(data.telefone);
      if (!telefone) throw new Error("Telefone inválido. Use DDD + número.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip = getRequestIP({ xForwardedFor: true }) ?? "desconhecido";
    const ipHash = createHash("sha256").update(ip).digest("hex");

    const { data: permitido, error: limiteError } = await supabaseAdmin.rpc(
      "registrar_tentativa_contato",
      { _ip_hash: ipHash, _limite: LIMITE_POR_HORA },
    );
    if (limiteError) throw new Error(limiteError.message);
    if (permitido === false) return { ok: false, motivo: "rate_limit" };

    const { data: consultor, error: consultorError } = await supabaseAdmin
      .from("consultores")
      .select("id, nome, email")
      .eq("slug", data.consultorSlug)
      .eq("publicado", true)
      .maybeSingle();

    if (consultorError) throw new Error(consultorError.message);
    if (!consultor) return { ok: false, motivo: "consultor_indisponivel" };

    const { error: leadError } = await supabaseAdmin.from("leads").insert({
      consultor_id: consultor.id,
      nome: data.nome,
      email: data.email,
      telefone,
      empresa: data.empresa?.trim() ? data.empresa.trim() : null,
      mensagem: data.mensagem?.trim() ? data.mensagem.trim() : null,
      status: "novo",
      origem: data.origem?.trim() ? data.origem.trim() : data.consultorSlug,
    });

    if (leadError) throw new Error(leadError.message);

    // Notificação nunca deve derrubar o envio do lead.
    try {
      await notificarNovoLead({
        consultorNome: consultor.nome,
        consultorEmail: consultor.email,
        leadNome: data.nome,
        leadMensagem: data.mensagem ?? "",
      });
    } catch (erro) {
      console.error("Falha ao notificar novo lead:", erro);
    }

    return { ok: true };
  });
