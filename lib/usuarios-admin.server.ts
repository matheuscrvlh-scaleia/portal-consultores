/**
 * Helpers server-only da gestão de contas em /admin/usuarios.
 *
 * A remoção de um consultor é destrutiva e precisa acontecer numa ordem
 * específica (arquivos → visualizações → conteúdos → cases → leads → áreas →
 * consultor). Postgres não dá transação através do PostgREST, então o helper
 * acumula falhas e aborta antes de qualquer passo seguinte, para nunca deixar
 * o papel trocado com dados órfãos.
 */

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type ConsultorParaRemover = {
  id: string;
  nome: string;
};

/** Localiza o perfil de consultor de uma conta, se existir. */
export async function buscarConsultorDaConta(
  supabaseAdmin: Admin,
  userId: string,
): Promise<ConsultorParaRemover | null> {
  const { data, error } = await supabaseAdmin
    .from("consultores")
    .select("id, nome")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id, nome: data.nome } : null;
}

/**
 * Apaga tudo que pertence a um consultor: arquivos nos buckets, visualizações
 * dos conteúdos dele, conteúdos, cases, leads, vínculos de áreas e a própria
 * linha em `consultores`. Lança erro descrevendo o que não pôde ser removido.
 */
export async function removerConsultorCompleto(supabaseAdmin: Admin, consultorId: string) {
  const falhas: string[] = [];

  const { data: consultor, error: consultorError } = await supabaseAdmin
    .from("consultores")
    .select("id, foto_path, video_path")
    .eq("id", consultorId)
    .maybeSingle();
  if (consultorError) throw new Error(consultorError.message);
  if (!consultor) return { removido: false as const, semPerfil: true as const };

  const { data: conteudos, error: conteudosError } = await supabaseAdmin
    .from("conteudos")
    .select("id, video_path, poster_path")
    .eq("consultor_id", consultorId);
  if (conteudosError) throw new Error(conteudosError.message);

  const conteudoIds = (conteudos ?? []).map((c) => c.id);

  const fotos = [
    consultor.foto_path,
    ...(conteudos ?? []).map((c) => c.poster_path),
  ].filter((p): p is string => Boolean(p));

  const videos = [
    consultor.video_path,
    ...(conteudos ?? []).map((c) => c.video_path),
  ].filter((p): p is string => Boolean(p));

  // 1) Arquivos primeiro: se falharem, nada no banco é tocado.
  if (fotos.length > 0) {
    const { error } = await supabaseAdmin.storage.from("fotos-publico").remove(fotos);
    if (error) falhas.push(`imagens (${error.message})`);
  }
  if (videos.length > 0) {
    const { error } = await supabaseAdmin.storage.from("videos-privado").remove(videos);
    if (error) falhas.push(`vídeos (${error.message})`);
  }

  if (falhas.length > 0) {
    throw new Error(
      `Nada foi removido. Não foi possível apagar ${falhas.join(" e ")}. Tente novamente.`,
    );
  }

  // 2) Banco, na ordem de dependência.
  if (conteudoIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("visualizacoes")
      .delete()
      .in("conteudo_id", conteudoIds);
    if (error) throw new Error(`Falha ao remover visualizações: ${error.message}`);
  }

  const passos: {
    rotulo: string;
    run: () => PromiseLike<{ error: { message: string } | null }>;
  }[] = [
    {
      rotulo: "conteúdos",
      run: () => supabaseAdmin.from("conteudos").delete().eq("consultor_id", consultorId),
    },
    {
      rotulo: "cases",
      run: () => supabaseAdmin.from("cases").delete().eq("consultor_id", consultorId),
    },
    {
      rotulo: "leads",
      run: () => supabaseAdmin.from("leads").delete().eq("consultor_id", consultorId),
    },
    {
      rotulo: "áreas vinculadas",
      run: () => supabaseAdmin.from("consultor_areas").delete().eq("consultor_id", consultorId),
    },
    {
      rotulo: "perfil do consultor",
      run: () => supabaseAdmin.from("consultores").delete().eq("id", consultorId),
    },
  ];

  for (const passo of passos) {
    const { error } = await passo.run();
    if (error) {
      throw new Error(
        `Remoção interrompida ao apagar ${passo.rotulo}: ${error.message}. ` +
          "Os itens anteriores já foram removidos; repita a operação para concluir.",
      );
    }
  }

  return { removido: true as const, semPerfil: false as const };
}

/** Troca o papel da conta respeitando a regra de papel único. */
export async function trocarPapel(
  supabaseAdmin: Admin,
  userId: string,
  papel: "visitante" | "consultor" | "admin",
) {
  const { error: delError } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (delError) throw new Error(delError.message);

  const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: papel });
  if (error) throw new Error(error.message);
}

/** Lista todas as contas de login (limite prático de 1000 por página). */
export async function listarUsuariosAuth(supabaseAdmin: Admin) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data?.users ?? [];
}
