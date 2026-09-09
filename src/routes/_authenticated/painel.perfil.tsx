import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { PerfilPublico } from "@/components/perfil-publico";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/auth.functions";
import {
  atualizarCase,
  confirmarUpload,
  createUploadUrl,
  criarCase,
  getMeuPerfil,
  removerCase,
  removerVideo,
  reordenarCases,
  setPublicado,
  updateMeuPerfil,
  type MeuPerfil,
} from "@/lib/painel.functions";
import { getPublicProfileVideoUrl } from "@/lib/storage.functions";
import { storageConfig } from "@/lib/storage.validators";

import { listAreas } from "@/lib/vitrine.functions";

export const Route = createFileRoute("/_authenticated/painel/perfil")({
  head: () => ({
    meta: [
      { title: "Editar meu perfil — Portal dos Consultores" },
      {
        name: "description",
        content:
          "Edite bio, áreas de atuação, foto, vídeo e cases do seu perfil de consultor antes de publicar.",
      },
      { property: "og:title", content: "Editar meu perfil — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Área do consultor para manter o próprio perfil público.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async () => {
    const access = await getMyAccess();
    if (!access.isConsultor) throw redirect({ to: "/sem-permissao" });
    return access;
  },
  component: PerfilPainelPage,
});

/** Preview do vídeo salvo, com o mesmo player do perfil público (9:16). */
function VideoPreview({ path, poster }: { path: string; poster: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["video-perfil", path],
    queryFn: () => getPublicProfileVideoUrl({ data: { path } }),
    staleTime: 1000 * 60 * 3,
  });

  return (
    <div className="w-full max-w-[220px]" style={{ aspectRatio: "9 / 16" }}>
      {data?.signedUrl ? (
        <video
          src={data.signedUrl}
          poster={poster ?? undefined}
          controls
          playsInline
          muted
          preload="metadata"
          className="h-full w-full bg-foreground/5 object-cover"
          aria-label="Pré-visualização do vídeo de apresentação"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-foreground/5 text-xs text-muted-foreground">
          {isLoading ? "Carregando vídeo…" : "Vídeo enviado."}
        </div>
      )}
    </div>
  );
}

const REDES = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "site", label: "Site" },
  { key: "youtube", label: "YouTube" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

const perfilQueryKey = ["painel", "meu-perfil"] as const;

type CaseDraft = { cliente: string; descricao: string; resultado: string };

function useUpload(tipo: "foto" | "video") {
  const [enviando, setEnviando] = useState(false);
  const queryClient = useQueryClient();

  const bucket = tipo === "foto" ? storageConfig.buckets.FOTOS : storageConfig.buckets.VIDEOS;
  const limite = storageConfig.limits[bucket];
  const permitidos =
    tipo === "foto" ? storageConfig.allowedMimeTypes.fotos : storageConfig.allowedMimeTypes.videos;

  async function enviar(file: File) {
    if (!permitidos.includes(file.type)) {
      toast.error(`Formato não aceito. Use: ${permitidos.join(", ")}`);
      return;
    }
    if (file.size > limite) {
      toast.error(`Arquivo maior que ${Math.round(limite / 1024 / 1024)} MB`);
      return;
    }

    setEnviando(true);
    try {
      const extensao = (file.name.split(".").pop() ?? "").toLowerCase() || "bin";
      const assinado = await createUploadUrl({
        data: { tipo, contentType: file.type, size: file.size, extensao },
      });

      const { error } = await supabase.storage
        .from(assinado.bucket)
        .uploadToSignedUrl(assinado.path, assinado.token, file, {
          contentType: file.type,
        });
      if (error) throw new Error(error.message);

      await confirmarUpload({ data: { tipo, path: assinado.path } });
      await queryClient.invalidateQueries({ queryKey: perfilQueryKey });
      toast.success(tipo === "foto" ? "Foto atualizada" : "Vídeo atualizado");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha no envio do arquivo");
    } finally {
      setEnviando(false);
    }
  }

  return { enviar, enviando };
}

function PerfilPainelPage() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(false);

  const { data: perfil, isLoading } = useQuery({
    queryKey: perfilQueryKey,
    queryFn: () => getMeuPerfil(),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
    staleTime: 1000 * 60 * 10,
  });

  const [bio, setBio] = useState("");
  const [tempo, setTempo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [redes, setRedes] = useState<Record<string, string>>({});
  const [areaIds, setAreaIds] = useState<string[]>([]);

  useEffect(() => {
    if (!perfil) return;
    setBio(perfil.bio ?? "");
    setTempo(perfil.tempoDeMercado != null ? String(perfil.tempoDeMercado) : "");
    setTelefone(perfil.telefone ?? "");
    setEmailContato(perfil.email ?? "");
    setRedes(Object.fromEntries(perfil.redes.map((r) => [r.rede, r.url])));
    setAreaIds(perfil.areaIds);
    // Só sincroniza na primeira carga (ou ao trocar de registro): uploads,
    // publicação e cases recarregam o perfil e não devem apagar o que ainda
    // não foi salvo no formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const foto = useUpload("foto");
  const video = useUpload("video");

  const invalidar = () => queryClient.invalidateQueries({ queryKey: perfilQueryKey });

  const salvar = useMutation({
    mutationFn: () =>
      updateMeuPerfil({
        data: {
          bio: bio.trim() || null,
          tempoDeMercado: tempo.trim() === "" ? null : Number(tempo),
          telefone: telefone.trim() || null,
          emailContato: emailContato.trim(),

          redes: REDES.filter((r) => (redes[r.key] ?? "").trim().length > 0).map((r) => ({
            rede: r.key,
            url: redes[r.key].trim(),
          })),
          areaIds,
        },
      }),
    onSuccess: async () => {
      await invalidar();
      toast.success("Perfil salvo");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const publicar = useMutation({
    mutationFn: (publicado: boolean) => setPublicado({ data: { publicado } }),
    onSuccess: async (res) => {
      await invalidar();
      toast.success(res.publicado ? "Perfil publicado" : "Perfil despublicado");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-14">
          <p className="text-sm text-muted-foreground">Carregando seu perfil…</p>
        </main>
      </>
    );
  }

  if (!perfil) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-14">
          <Button asChild size="sm" variant="outline">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
          <p className="u-eyebrow mt-8">Painel do consultor</p>
          <h1 className="u-display mt-3 text-3xl">Nenhum perfil vinculado</h1>
          <hr className="u-rule mt-6" />
          <p className="mt-6 text-sm text-muted-foreground">
            Sua conta tem o papel de consultor, mas ainda não existe um perfil de consultor
            vinculado a ela. Fale com o administrador do portal para fazer esse vínculo.
          </p>
        </main>
      </>
    );
  }

  if (preview) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-14">
          <div className="mb-8 flex items-center justify-between gap-4 border-2 border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pré-visualização {perfil.publicado ? "(perfil publicado)" : "(ainda não publicado)"}
            </p>
            <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
              Voltar à edição
            </Button>
          </div>
          <PerfilPublico
            eyebrow="Pré-visualização do perfil"
            consultor={{
              nome: perfil.nome,
              bio: perfil.bio,
              tempoDeMercado: perfil.tempoDeMercado,
              fotoUrl: perfil.fotoUrl,
              telefone: perfil.telefone,
              email: perfil.email,
              videoPath: perfil.videoPath,
              redes: perfil.redes,
              areas: perfil.areas,
              cases: perfil.cases,
            }}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">Painel do consultor</p>
            <h1 className="u-display mt-3 text-3xl">Meu perfil</h1>
            <hr className="u-rule mt-6" />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-2 border-border p-4">
          <span className="text-sm font-semibold text-foreground">
            {perfil.publicado ? "Perfil publicado" : "Perfil não publicado"}
          </span>
          <span className="flex-1 text-xs text-muted-foreground">
            {perfil.publicado
              ? `Visível na vitrine em /consultores/${perfil.slug}`
              : "Enquanto não publicado, o perfil não aparece na vitrine nem por URL direta."}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
            Pré-visualizar
          </Button>
          <Button
            size="sm"
            variant={perfil.publicado ? "secondary" : "default"}
            disabled={publicar.isPending}
            onClick={() => publicar.mutate(!perfil.publicado)}
          >
            {perfil.publicado ? "Despublicar" : "Publicar"}
          </Button>
        </div>

        <form
          className="mt-10 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={7}
              maxLength={4000}
              className="mt-2"
              placeholder="Conte sua trajetória, especialidades e como você ajuda seus clientes."
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="tempo">Tempo de mercado (anos)</Label>
              <Input
                id="tempo"
                type="number"
                min={0}
                max={80}
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone / WhatsApp de contato</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 90000-0000"
                className="mt-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Visível para usuários logados no seu perfil público.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email-contato">E-mail de contato</Label>
              <Input
                id="email-contato"
                type="email"
                required
                value={emailContato}
                onChange={(e) => setEmailContato(e.target.value)}
                placeholder="contato@seudominio.com"
                className="mt-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Este é o e-mail exibido no seu perfil e usado para receber contatos. Ele é
                independente do e-mail que você usa para entrar na plataforma.
              </p>
            </div>
          </div>

          <fieldset>
            <legend className="u-eyebrow">Redes sociais</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {REDES.map((r) => (
                <div key={r.key}>
                  <Label htmlFor={`rede-${r.key}`}>{r.label}</Label>
                  <Input
                    id={`rede-${r.key}`}
                    value={redes[r.key] ?? ""}
                    onChange={(e) => setRedes((atual) => ({ ...atual, [r.key]: e.target.value }))}
                    placeholder="https://"
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="u-eyebrow">Áreas de atuação</legend>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(areas ?? []).map((a) => {
                const marcada = areaIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-start gap-3 border-2 border-border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={(e) =>
                        setAreaIds((atual) =>
                          e.target.checked ? [...atual, a.id] : atual.filter((id) => id !== a.id),
                        )
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-foreground">{a.nome}</span>
                      {a.descricao && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {a.descricao}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>

        <section className="mt-14">
          <h2 className="u-display text-2xl">Foto e vídeo</h2>
          <hr className="u-rule mt-4" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Foto de perfil</CardTitle>
                <CardDescription>JPG, PNG ou WebP, até 5 MB.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {perfil.fotoUrl ? (
                  <img
                    src={perfil.fotoUrl}
                    alt="Foto atual do perfil"
                    className="h-40 w-40 object-cover"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma foto enviada.</p>
                )}
                <Input
                  type="file"
                  accept={storageConfig.allowedMimeTypes.fotos.join(",")}
                  disabled={foto.enviando}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void foto.enviar(file);
                  }}
                />
                {foto.enviando && <p className="text-xs text-muted-foreground">Enviando foto…</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vídeo de apresentação</CardTitle>
                <CardDescription>MP4, WebM ou MOV, até 50 MB. Opcional.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {perfil.videoPath ? (
                  <VideoPreview path={perfil.videoPath} poster={perfil.fotoUrl} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum vídeo enviado.</p>
                )}

                <Input
                  type="file"
                  accept={storageConfig.allowedMimeTypes.videos.join(",")}
                  disabled={video.enviando}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void video.enviar(file);
                  }}
                />
                {video.enviando && <p className="text-xs text-muted-foreground">Enviando vídeo…</p>}
                {perfil.videoPath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await removerVideo();
                      await invalidar();
                      toast.success("Vídeo removido do perfil");
                    }}
                  >
                    Remover vídeo
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <CasesManager cases={perfil.cases} onChange={invalidar} />
      </main>
    </>
  );
}

function CasesManager({
  cases,
  onChange,
}: {
  cases: MeuPerfil["cases"];
  onChange: () => Promise<void> | void;
}) {
  const [novo, setNovo] = useState<CaseDraft>({ cliente: "", descricao: "", resultado: "" });
  const [editando, setEditando] = useState<string | null>(null);
  const [draft, setDraft] = useState<CaseDraft>({ cliente: "", descricao: "", resultado: "" });
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setOcupado(true);
    try {
      await acao();
      await onChange();
      toast.success(mensagem);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível concluir a ação");
    } finally {
      setOcupado(false);
    }
  }

  async function mover(index: number, direcao: -1 | 1) {
    const ids = cases.map((c) => c.id);
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= ids.length) return;
    [ids[index], ids[alvo]] = [ids[alvo], ids[index]];
    await executar(() => reordenarCases({ data: { ids } }), "Ordem atualizada");
  }

  return (
    <section className="mt-14">
      <h2 className="u-display text-2xl">Cases</h2>
      <hr className="u-rule mt-4" />

      <ul className="mt-8 space-y-4">
        {cases.length === 0 && (
          <li className="text-sm text-muted-foreground">Você ainda não cadastrou cases.</li>
        )}
        {cases.map((c, index) => (
          <li key={c.id} className="border-2 border-border p-4">
            {editando === c.id ? (
              <div className="space-y-3">
                <Input
                  value={draft.cliente}
                  onChange={(e) => setDraft({ ...draft, cliente: e.target.value })}
                  placeholder="Cliente"
                />
                <Textarea
                  value={draft.descricao}
                  onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
                  placeholder="Descrição"
                  rows={4}
                />
                <Input
                  value={draft.resultado}
                  onChange={(e) => setDraft({ ...draft, resultado: e.target.value })}
                  placeholder="Resultado"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={ocupado || draft.cliente.trim().length < 2}
                    onClick={() =>
                      executar(async () => {
                        await atualizarCase({
                          data: {
                            id: c.id,
                            cliente: draft.cliente.trim(),
                            descricao: draft.descricao.trim() || null,
                            resultado: draft.resultado.trim() || null,
                          },
                        });
                        setEditando(null);
                      }, "Case atualizado")
                    }
                  >
                    Salvar case
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="u-eyebrow">{c.cliente}</p>
                {c.descricao && <p className="mt-2 text-sm text-muted-foreground">{c.descricao}</p>}
                {c.resultado && (
                  <p className="mt-2 text-sm font-semibold text-foreground">{c.resultado}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditando(c.id);
                      setDraft({
                        cliente: c.cliente,
                        descricao: c.descricao ?? "",
                        resultado: c.resultado ?? "",
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado || index === 0}
                    onClick={() => void mover(index, -1)}
                    aria-label={`Mover case ${c.cliente} para cima`}
                  >
                    Subir
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado || index === cases.length - 1}
                    onClick={() => void mover(index, 1)}
                    aria-label={`Mover case ${c.cliente} para baixo`}
                  >
                    Descer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() =>
                      executar(() => removerCase({ data: { id: c.id } }), "Case removido")
                    }
                  >
                    Remover
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8 border-2 border-border p-4">
        <h3 className="u-eyebrow">Novo case</h3>
        <div className="mt-4 space-y-3">
          <Input
            value={novo.cliente}
            onChange={(e) => setNovo({ ...novo, cliente: e.target.value })}
            placeholder="Cliente"
          />
          <Textarea
            value={novo.descricao}
            onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
            placeholder="Descrição"
            rows={4}
          />
          <Input
            value={novo.resultado}
            onChange={(e) => setNovo({ ...novo, resultado: e.target.value })}
            placeholder="Resultado"
          />
          <Button
            disabled={ocupado || novo.cliente.trim().length < 2}
            onClick={() =>
              executar(async () => {
                await criarCase({
                  data: {
                    cliente: novo.cliente.trim(),
                    descricao: novo.descricao.trim() || null,
                    resultado: novo.resultado.trim() || null,
                  },
                });
                setNovo({ cliente: "", descricao: "", resultado: "" });
              }, "Case adicionado")
            }
          >
            Adicionar case
          </Button>
        </div>
      </div>
    </section>
  );
}
