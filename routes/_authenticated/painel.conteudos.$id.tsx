import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/auth.functions";
import {
  atualizarConteudo,
  confirmarConteudoUpload,
  createConteudoUploadUrl,
  getMeuConteudo,
  setConteudoPublicado,
} from "@/lib/conteudos-painel.functions";
import { getLibraryVideoUrl } from "@/lib/storage.functions";
import { storageConfig } from "@/lib/storage.validators";
import { listAreas } from "@/lib/vitrine.functions";

export const Route = createFileRoute("/_authenticated/painel/conteudos/$id")({
  head: () => ({
    meta: [
      { title: "Editar conteúdo — Portal dos Consultores" },
      {
        name: "description",
        content:
          "Edite título, área, descrição, vídeo e poster de um conteúdo da biblioteca antes de publicar.",
      },
      { property: "og:title", content: "Editar conteúdo — Portal dos Consultores" },
      {
        property: "og:description",
        content: "Área do consultor para manter os próprios conteúdos.",
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
  component: EditarConteudoPage,
});

/** Preview do vídeo da biblioteca, mesmo player 9:16 do player público. */
function VideoPreview({ path, poster }: { path: string; poster: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["video-biblioteca", path],
    queryFn: () => getLibraryVideoUrl({ data: { path } }),
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
          aria-label="Pré-visualização do vídeo do conteúdo"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-foreground/5 text-xs text-muted-foreground">
          {isLoading ? "Carregando vídeo…" : "Vídeo enviado."}
        </div>
      )}
    </div>
  );
}

function EditarConteudoPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ["painel", "conteudo", id] as const;

  const { data: conteudo, isLoading } = useQuery({
    queryKey,
    queryFn: () => getMeuConteudo({ data: { id } }),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
    staleTime: 1000 * 60 * 10,
  });

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [enviando, setEnviando] = useState<"poster" | "video" | null>(null);
  const [previewLocal, setPreviewLocal] = useState<{
    tipo: "poster" | "video";
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!conteudo) return;
    setTitulo(conteudo.titulo);
    setDescricao(conteudo.descricao ?? "");
    setAreaId(conteudo.areaId ?? "");
    // Só sincroniza ao trocar de conteúdo, para o refetch não apagar o que
    // está sendo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudo?.id]);

  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal.url);
    };
  }, [previewLocal]);

  const invalidar = async () => {
    await queryClient.refetchQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ["painel", "meus-conteudos"] });
  };


  const salvar = useMutation({
    mutationFn: () =>
      atualizarConteudo({
        data: {
          id,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          areaId: areaId || null,
        },
      }),
    onSuccess: async () => {
      await invalidar();
      toast.success("Conteúdo salvo");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar"),
  });

  const publicar = useMutation({
    mutationFn: (publicado: boolean) => setConteudoPublicado({ data: { id, publicado } }),
    onSuccess: async (res) => {
      await invalidar();
      toast.success(res.publicado ? "Conteúdo publicado" : "Conteúdo despublicado");
    },
    onError: (erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível alterar a publicação"),
  });

  async function enviarArquivo(tipo: "poster" | "video", file: File) {
    const bucket =
      tipo === "poster" ? storageConfig.buckets.FOTOS : storageConfig.buckets.VIDEOS;
    const limite = storageConfig.limits[bucket];
    const permitidos =
      tipo === "poster"
        ? storageConfig.allowedMimeTypes.fotos
        : storageConfig.allowedMimeTypes.videos;

    if (!permitidos.includes(file.type)) {
      toast.error(`Formato não aceito. Use: ${permitidos.join(", ")}`);
      return;
    }
    if (file.size > limite) {
      toast.error(`Arquivo maior que ${Math.round(limite / 1024 / 1024)} MB`);
      return;
    }

    const caminhoAnterior = tipo === "video" ? conteudo?.videoPath : null;
    const urlLocal = URL.createObjectURL(file);
    setPreviewLocal((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior.url);
      return { tipo, url: urlLocal };
    });
    setEnviando(tipo);
    try {
      const extensao = (file.name.split(".").pop() ?? "").toLowerCase() || "bin";
      const assinado = await createConteudoUploadUrl({
        data: { conteudoId: id, tipo, contentType: file.type, size: file.size, extensao },
      });

      const { error } = await supabase.storage
        .from(assinado.bucket)
        .uploadToSignedUrl(assinado.path, assinado.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);

      await confirmarConteudoUpload({ data: { conteudoId: id, tipo, path: assinado.path } });
      if (caminhoAnterior) {
        queryClient.removeQueries({ queryKey: ["video-biblioteca", caminhoAnterior] });
      }
      await invalidar();
      toast.success(tipo === "poster" ? "Poster atualizado" : "Vídeo atualizado");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha no envio do arquivo");
    } finally {
      setEnviando(null);
      setPreviewLocal((atual) => {
        if (atual?.url === urlLocal) {
          URL.revokeObjectURL(urlLocal);
          return null;
        }
        return atual;
      });
    }
  }


  if (isLoading || conteudo === undefined) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm text-muted-foreground">Carregando conteúdo…</p>
        </main>
      </>
    );
  }

  if (conteudo === null) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <Button asChild size="sm" variant="outline">
            <Link to="/painel/conteudos">Voltar para meus conteúdos</Link>
          </Button>
          <h1 className="u-display mt-6 text-2xl">Conteúdo não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este conteúdo não existe ou não pertence à sua conta.
          </p>
        </main>
      </>
    );
  }

  const faltando = [
    titulo.trim().length < 3 ? "título" : null,
    areaId ? null : "área",
    conteudo.videoPath ? null : "vídeo",
  ].filter((f): f is string => Boolean(f));

  // O caminho muda a cada upload, então o endereço muda junto e o navegador
  // não reaproveita a imagem antiga do cache.
  const posterSrc = conteudo.posterUrl
    ? `${conteudo.posterUrl}?v=${encodeURIComponent(conteudo.posterPath ?? "")}`
    : null;



  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="u-eyebrow">{conteudo.publicado ? "Publicado" : "Rascunho"}</p>
            <h1 className="u-display text-2xl">Editar conteúdo</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Endereço público: /conteudos/{conteudo.slug}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/painel/conteudos">Meus conteúdos</Link>
          </Button>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Dados do conteúdo</CardTitle>
            <CardDescription>
              O endereço público é gerado a partir do título, sem repetir endereços já usados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                maxLength={160}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                rows={4}
                maxLength={4000}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Área</legend>
              <div className="flex flex-wrap gap-2">
                {(areas ?? []).map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setAreaId(area.id)}
                    aria-pressed={areaId === area.id}
                    className={`border px-3 py-1.5 text-sm transition-colors ${
                      areaId === area.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {area.nome}
                  </button>
                ))}
              </div>
            </fieldset>

            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Vídeo</CardTitle>
            <CardDescription>Arquivo de até 50 MB (MP4, WebM ou MOV).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewLocal?.tipo === "video" ? (
              <div className="w-full max-w-[220px]" style={{ aspectRatio: "9 / 16" }}>
                <video
                  src={previewLocal.url}
                  controls
                  playsInline
                  muted
                  preload="metadata"
                  className="h-full w-full bg-foreground/5 object-cover"
                  aria-label="Pré-visualização do vídeo selecionado"
                />
              </div>
            ) : conteudo.videoPath ? (
              <VideoPreview path={conteudo.videoPath} poster={posterSrc} />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum vídeo enviado ainda.</p>
            )}

            <Input
              type="file"
              accept={storageConfig.allowedMimeTypes.videos.join(",")}
              disabled={enviando !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void enviarArquivo("video", file);
                e.target.value = "";
              }}
            />
            {enviando === "video" ? (
              <p className="text-xs text-muted-foreground">Enviando vídeo…</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Poster (opcional)</CardTitle>
            <CardDescription>
              Imagem de capa de até 5 MB. Sem poster, o card usa um fundo neutro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewLocal?.tipo === "poster" ? (
              <img
                src={previewLocal.url}
                alt="Pré-visualização do poster selecionado"
                className="w-full max-w-[220px] object-cover"
                style={{ aspectRatio: "9 / 16" }}
              />
            ) : posterSrc ? (
              <img
                key={posterSrc}
                src={posterSrc}
                alt={`Poster do conteúdo ${conteudo.titulo}`}
                className="w-full max-w-[220px] object-cover"
                style={{ aspectRatio: "9 / 16" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum poster enviado ainda.</p>
            )}

            <Input
              type="file"
              accept={storageConfig.allowedMimeTypes.fotos.join(",")}
              disabled={enviando !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void enviarArquivo("poster", file);
                e.target.value = "";
              }}
            />
            {enviando === "poster" ? (
              <p className="text-xs text-muted-foreground">Enviando poster…</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Publicação</CardTitle>
            <CardDescription>
              Só conteúdos publicados aparecem na biblioteca para visitantes logados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!conteudo.publicado && faltando.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Para publicar, falta preencher e salvar: {faltando.join(", ")}.
              </p>
            ) : null}
            <Button
              variant={conteudo.publicado ? "outline" : "default"}
              disabled={publicar.isPending || (!conteudo.publicado && faltando.length > 0)}
              onClick={() => publicar.mutate(!conteudo.publicado)}
            >
              {conteudo.publicado ? "Despublicar" : "Publicar"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
