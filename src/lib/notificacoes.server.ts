/**
 * Notificação de novo lead.
 *
 * STUB: nenhum provedor de e-mail está configurado/liberado para este projeto
 * ainda (ver BACKEND_TODO.md → "Conectar provedor de e-mail real"). Por
 * enquanto apenas registramos o evento no log do servidor; o lead já foi
 * gravado no banco e aparece para o consultor no painel.
 *
 * Quando o provedor for liberado, implemente o envio AQUI DENTRO — o restante
 * do fluxo de lead não precisa mudar.
 */
export async function notificarNovoLead(params: {
  consultorNome: string;
  consultorEmail: string;
  leadNome: string;
  leadMensagem: string;
}): Promise<{ enviado: boolean }> {
  const resumo = params.leadMensagem.replace(/\s+/g, " ").trim().slice(0, 160);

  console.info(
    `[lead] novo lead para ${params.consultorNome} <${params.consultorEmail}>: ` +
      `${params.leadNome} — "${resumo}" (e-mail não enviado: provedor não configurado)`,
  );

  return { enviado: false };
}
