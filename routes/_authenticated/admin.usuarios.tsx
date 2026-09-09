import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REDES_PERMITIDAS } from "@/lib/admin.schemas";
import { getMyAccess } from "@/lib/auth.functions";
import {
  alterarPapel,
  atualizarEmailConta,
  criarConta,
  definirSenhaConta,
  excluirConta,
  listarContasAdmin,
  PAPEIS,
  type ContaAdmin,
  type Papel,
} from "@/lib/usuarios-admin.functions";
import { listAreas } from "@/lib/vitrine.functions";

const searchSchema = z.object({ q: z.string().trim().max(160).optional() });

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Usuários — Administração do Portal" },
      {
        name: "description",
        content:
          "Gestão de contas do portal: criar usuários, alterar o papel único (visitante, consultor ou admin) e excluir contas.",
      },
      { property: "og:title", content: "Usuários — Administração do Portal" },
      {
        property: "og:description",
        content: "Contas, papéis e exclusão de usuários do Portal dos Consultores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async () => {
    const access = await getMyAccess();
    if (!access.isAdmin) throw redirect({ to: "/sem-permissao" });
    return access;
  },
  component: AdminUsuariosPage,
});

const PAPEL_LABEL: Record<Papel, string> = {
  visitante: "Visitante",
  consultor: "Consultor",
  admin: "Admin",
};

const REDES_LABEL: Record<(typeof REDES_PERMITIDAS)[number], string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  site: "Site",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

type PerfilForm = {
  nome: string;
  bio: string;
  tempo: string;
  telefone: string;
  redes: Record<string, string>;
  areaIds: string[];
};

const perfilVazio: PerfilForm = {
  nome: "",
  bio: "",
  tempo: "",
  telefone: "",
  redes: {},
  areaIds: [],
};

function montarPerfil(form: PerfilForm) {
  return {
    nome: form.nome.trim(),
    bio: form.bio.trim() || null,
    tempoDeMercado: form.tempo.trim() === "" ? null : Number(form.tempo),
    telefone: form.telefone.trim() || null,
    redes: REDES_PERMITIDAS.filter((r) => (form.redes[r] ?? "").trim().length > 0).map((r) => ({
      rede: r,
      url: (form.redes[r] ?? "").trim(),
    })),
    areaIds: form.areaIds,
  };
}

function PerfilFields({
  form,
  setForm,
  areas,
}: {
  form: PerfilForm;
  setForm: (next: PerfilForm) => void;
  areas: { id: string; nome: string }[];
}) {
  return (
    <div className="space-y-5 border-2 border-border p-4">
      <p className="u-eyebrow">Perfil do consultor (nasce como rascunho)</p>

      <div>
        <Label htmlFor="perfil-nome">Nome do consultor</Label>
        <Input
          id="perfil-nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="mt-2"
          placeholder="Nome completo"
        />
      </div>

      <div>
        <Label htmlFor="perfil-bio">Bio</Label>
        <Textarea
          id="perfil-bio"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          rows={5}
          maxLength={4000}
          className="mt-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="perfil-tempo">Tempo de mercado (anos)</Label>
          <Input
            id="perfil-tempo"
            type="number"
            min={0}
            max={80}
            value={form.tempo}
            onChange={(e) => setForm({ ...form, tempo: e.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="perfil-telefone">Telefone</Label>
          <Input
            id="perfil-telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="(11) 90000-0000"
            className="mt-2"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Redes sociais
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {REDES_PERMITIDAS.map((r) => (
            <div key={r}>
              <Label htmlFor={`perfil-rede-${r}`}>{REDES_LABEL[r]}</Label>
              <Input
                id={`perfil-rede-${r}`}
                value={form.redes[r] ?? ""}
                onChange={(e) => setForm({ ...form, redes: { ...form.redes, [r]: e.target.value } })}
                placeholder="https://"
                className="mt-2"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Áreas de atuação
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {areas.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-start gap-3 border-2 border-border p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={form.areaIds.includes(a.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    areaIds: e.target.checked
                      ? [...form.areaIds, a.id]
                      : form.areaIds.filter((x) => x !== a.id),
                  })
                }
                className="mt-1"
              />
              <span className="font-semibold text-foreground">{a.nome}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function AdminUsuariosPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const access = Route.useLoaderData();

  const [busca, setBusca] = useState(search.q ?? "");
  const contasQueryKey = ["admin", "contas", search.q ?? ""] as const;

  const { data: contas, isLoading } = useQuery({
    queryKey: contasQueryKey,
    queryFn: () => listarContasAdmin({ data: { termo: search.q ?? "" } }),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
    staleTime: 1000 * 60 * 10,
  });

  // Criação
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papelNovo, setPapelNovo] = useState<Papel>("visitante");
  const [perfilNovo, setPerfilNovo] = useState<PerfilForm>(perfilVazio);

  // Alteração de papel / exclusão
  const [alvo, setAlvo] = useState<{ conta: ContaAdmin; papel: Papel } | null>(null);
  const [perfilAlvo, setPerfilAlvo] = useState<PerfilForm>(perfilVazio);
  const [confirmacao, setConfirmacao] = useState("");
  const [exclusao, setExclusao] = useState<ContaAdmin | null>(null);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");

  // Trocar senha / editar e-mail
  const [senhaAlvo, setSenhaAlvo] = useState<ContaAdmin | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [emailAlvo, setEmailAlvo] = useState<ContaAdmin | null>(null);
  const [novoEmail, setNovoEmail] = useState("");

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "contas"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "consultores"] });
  };

  const criar = useMutation({
    mutationFn: () =>
      criarConta({
        data: {
          email: email.trim(),
          senha,
          papel: papelNovo,
          perfil: papelNovo === "consultor" ? montarPerfil(perfilNovo) : null,
        },
      }),
    onSuccess: async () => {
      setEmail("");
      setSenha("");
      setPapelNovo("visitante");
      setPerfilNovo(perfilVazio);
      await invalidar();
      toast.success("Conta criada");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mudarPapel = useMutation({
    mutationFn: () => {
      if (!alvo) throw new Error("Nenhuma conta selecionada");
      return alterarPapel({
        data: {
          userId: alvo.conta.id,
          papel: alvo.papel,
          perfil:
            alvo.papel === "consultor" && alvo.conta.papel !== "consultor"
              ? montarPerfil(perfilAlvo)
              : null,
          confirmacao: confirmacao.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      setAlvo(null);
      setPerfilAlvo(perfilVazio);
      setConfirmacao("");
      await invalidar();
      toast.success("Papel atualizado");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const remover = useMutation({
    mutationFn: () => {
      if (!exclusao) throw new Error("Nenhuma conta selecionada");
      return excluirConta({
        data: { userId: exclusao.id, confirmacao: confirmacaoExclusao.trim() || null },
      });
    },
    onSuccess: async () => {
      setExclusao(null);
      setConfirmacaoExclusao("");
      await invalidar();
      toast.success("Conta excluída");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const trocarSenha = useMutation({
    mutationFn: () => {
      if (!senhaAlvo) throw new Error("Nenhuma conta selecionada");
      return definirSenhaConta({ data: { userId: senhaAlvo.id, senha: novaSenha } });
    },
    onSuccess: () => {
      setSenhaAlvo(null);
      setNovaSenha("");
      toast.success("Senha redefinida");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const editarEmail = useMutation({
    mutationFn: () => {
      if (!emailAlvo) throw new Error("Nenhuma conta selecionada");
      return atualizarEmailConta({ data: { userId: emailAlvo.id, email: novoEmail.trim() } });
    },
    onSuccess: async () => {
      setEmailAlvo(null);
      setNovoEmail("");
      await invalidar();
      toast.success("E-mail atualizado");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const fecharPaineis = () => {
    setAlvo(null);
    setExclusao(null);
    setSenhaAlvo(null);
    setEmailAlvo(null);
  };

  const abrirAlteracao = (conta: ContaAdmin, papel: Papel) => {
    fecharPaineis();
    setConfirmacao("");
    setPerfilAlvo({ ...perfilVazio, nome: conta.email.split("@")[0] ?? "" });
    setAlvo({ conta, papel });
  };

  const abrirSenha = (conta: ContaAdmin) => {
    fecharPaineis();
    setNovaSenha("");
    setSenhaAlvo(conta);
  };

  const abrirEdicao = (conta: ContaAdmin) => {
    fecharPaineis();
    setNovoEmail(conta.email);
    setEmailAlvo(conta);
  };

  const lista = contas ?? [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">Administração</p>
            <h1 className="u-display mt-3 text-3xl">Usuários</h1>
            <hr className="u-rule mt-6" />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">Voltar à administração</Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Cada conta tem exatamente um papel: Visitante, Consultor ou Admin. Trocar para Consultor
          cria o perfil vinculado; sair de Consultor apaga o perfil e tudo ligado a ele.
        </p>

        <form
          className="mt-8 space-y-5 border-2 border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (papelNovo === "consultor" && perfilNovo.nome.trim().length < 2) {
              toast.error("Informe o nome do consultor");
              return;
            }
            criar.mutate();
          }}
        >
          <h2 className="text-base font-semibold text-foreground">Criar usuário</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="novo-email">E-mail</Label>
              <Input
                id="novo-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                placeholder="nome@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="nova-senha">Senha inicial</Label>
              <Input
                id="nova-senha"
                type="text"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-2"
                placeholder="mín. 8 caracteres"
              />
            </div>
            <div>
              <Label htmlFor="novo-papel">Papel inicial</Label>
              <select
                id="novo-papel"
                value={papelNovo}
                onChange={(e) => setPapelNovo(e.target.value as Papel)}
                className="mt-2 h-10 w-full border-2 border-border bg-background px-3 text-sm"
              >
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>
                    {PAPEL_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A conta nasce confirmada. Combine a senha inicial com a pessoa por um canal seguro — não
            existe recuperação de senha no portal ainda.
          </p>

          {papelNovo === "consultor" && (
            <PerfilFields form={perfilNovo} setForm={setPerfilNovo} areas={areas ?? []} />
          )}

          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? "Criando…" : "Criar usuário"}
          </Button>
        </form>

        <form
          className="mt-10 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/admin/usuarios", search: { q: busca.trim() || undefined } });
          }}
        >
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por e-mail"
            aria-label="Buscar contas por e-mail"
          />
          <Button type="submit" variant="outline" size="sm">
            Buscar
          </Button>
        </form>

        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Carregando contas…</p>
        ) : lista.length === 0 ? (
          <p className="mt-8 border-2 border-border p-6 text-sm text-muted-foreground">
            Nenhuma conta encontrada com esse e-mail.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {lista.map((conta) => {
              const propria = conta.id === access.userId;
              return (
                <li key={conta.id} className="border-2 border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[240px] flex-1">
                      <p className="font-semibold text-foreground">{conta.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {conta.papel ? PAPEL_LABEL[conta.papel] : "sem papel"} · cadastro em{" "}
                        {new Date(conta.criadoEm).toLocaleDateString("pt-BR")}
                      </p>
                      {conta.consultor && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Perfil: {conta.consultor.nome} ·{" "}
                          {conta.consultor.publicado ? "publicado" : "rascunho"} ·{" "}
                          <Link
                            to="/admin/consultores/$id"
                            params={{ id: conta.consultor.id }}
                            className="underline"
                          >
                            editar perfil
                          </Link>
                        </p>
                      )}
                      {propria && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Esta é a sua conta: papel e exclusão ficam bloqueados.
                        </p>
                      )}
                    </div>

                    {!propria && (
                      <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              Ações
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Papel</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={conta.papel ?? ""}
                              onValueChange={(valor) => {
                                if (valor === (conta.papel ?? "")) return;
                                abrirAlteracao(conta, valor as Papel);
                              }}
                            >
                              {PAPEIS.map((p) => (
                                <DropdownMenuRadioItem
                                  key={p}
                                  value={p}
                                  disabled={p === conta.papel}
                                >
                                  {PAPEL_LABEL[p]}
                                  {p === conta.papel ? " (atual)" : ""}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => abrirSenha(conta)}>
                              Trocar senha
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => abrirEdicao(conta)}>
                              Editar e-mail
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            fecharPaineis();
                            setConfirmacaoExclusao("");
                            setExclusao(conta);
                          }}
                        >
                          Excluir conta
                        </Button>
                      </div>
                    )}
                  </div>

                  {alvo?.conta.id === conta.id && (
                    <form
                      className="mt-4 space-y-4 border-2 border-border p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        mudarPapel.mutate();
                      }}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Alterar papel para {PAPEL_LABEL[alvo.papel]}
                      </p>

                      {conta.papel === "consultor" ? (
                        <>
                          <p className="text-sm text-foreground">
                            Ação irreversível. Serão apagados: foto, vídeo e posters nos buckets,
                            visualizações, conteúdos, cases, leads, áreas vinculadas e o perfil de{" "}
                            <strong>{conta.consultor?.nome}</strong>. Só depois o papel muda.
                          </p>
                          <div>
                            <Label htmlFor={`conf-${conta.id}`}>
                              Digite o nome do consultor para confirmar
                            </Label>
                            <Input
                              id={`conf-${conta.id}`}
                              value={confirmacao}
                              onChange={(e) => setConfirmacao(e.target.value)}
                              className="mt-2"
                              placeholder={conta.consultor?.nome ?? ""}
                            />
                          </div>
                        </>
                      ) : alvo.papel === "consultor" ? (
                        <PerfilFields form={perfilAlvo} setForm={setPerfilAlvo} areas={areas ?? []} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Troca direta de papel, sem efeitos colaterais.
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button type="submit" disabled={mudarPapel.isPending}>
                          {mudarPapel.isPending ? "Aplicando…" : "Confirmar alteração"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setAlvo(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}

                  {senhaAlvo?.id === conta.id && (
                    <form
                      className="mt-4 space-y-4 border-2 border-border p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        trocarSenha.mutate();
                      }}
                    >
                      <p className="text-sm font-semibold text-foreground">Trocar senha</p>
                      <div>
                        <Label htmlFor={`senha-${conta.id}`}>Nova senha</Label>
                        <Input
                          id={`senha-${conta.id}`}
                          type="text"
                          value={novaSenha}
                          onChange={(e) => setNovaSenha(e.target.value)}
                          className="mt-2"
                          placeholder="mín. 8 caracteres"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A senha é aplicada na hora, sem e-mail de recuperação. Combine a nova senha
                        com a pessoa por um canal seguro — não existe recuperação de senha no portal
                        ainda.
                      </p>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={trocarSenha.isPending}>
                          {trocarSenha.isPending ? "Aplicando…" : "Definir nova senha"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setSenhaAlvo(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}

                  {emailAlvo?.id === conta.id && (
                    <form
                      className="mt-4 space-y-4 border-2 border-border p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        editarEmail.mutate();
                      }}
                    >
                      <p className="text-sm font-semibold text-foreground">Editar e-mail de login</p>
                      <div>
                        <Label htmlFor={`email-${conta.id}`}>E-mail</Label>
                        <Input
                          id={`email-${conta.id}`}
                          type="email"
                          value={novoEmail}
                          onChange={(e) => setNovoEmail(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Só o e-mail de login muda — papel e perfil ficam como estão.
                      </p>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={editarEmail.isPending}>
                          {editarEmail.isPending ? "Salvando…" : "Salvar e-mail"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setEmailAlvo(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}


                  {exclusao?.id === conta.id && (
                    <form
                      className="mt-4 space-y-4 border-2 border-border p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        remover.mutate();
                      }}
                    >
                      <p className="text-sm font-semibold text-foreground">Excluir conta</p>
                      <p className="text-sm text-foreground">
                        O login deixa de existir — para voltar, a pessoa precisa se cadastrar de
                        novo.
                        {conta.papel === "consultor" &&
                          " Antes disso, todo o material do consultor (arquivos, conteúdos, cases, leads e perfil) é apagado."}
                      </p>
                      {conta.papel === "consultor" && (
                        <div>
                          <Label htmlFor={`conf-del-${conta.id}`}>
                            Digite o nome do consultor para confirmar
                          </Label>
                          <Input
                            id={`conf-del-${conta.id}`}
                            value={confirmacaoExclusao}
                            onChange={(e) => setConfirmacaoExclusao(e.target.value)}
                            className="mt-2"
                            placeholder={conta.consultor?.nome ?? ""}
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" disabled={remover.isPending}>
                          {remover.isPending ? "Excluindo…" : "Excluir definitivamente"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setExclusao(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
