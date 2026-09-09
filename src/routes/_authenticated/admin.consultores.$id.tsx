import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  atualizarConsultorAdmin,
  getConsultorAdmin,
  setPublicadoAdmin,
} from "@/lib/admin.functions";
import { REDES_PERMITIDAS } from "@/lib/admin.schemas";
import { getMyAccess } from "@/lib/auth.functions";
import { listAreas } from "@/lib/vitrine.functions";

export const Route = createFileRoute("/_authenticated/admin/consultores/$id")({
  head: () => ({
    meta: [
      { title: "Editar consultor — Administração do Portal" },
      {
        name: "description",
        content:
          "Edição administrativa de um consultor: dados de perfil, áreas, publicação e vínculo com a conta de login.",
      },
      { property: "og:title", content: "Editar consultor — Administração do Portal" },
      {
        property: "og:description",
        content: "Edição administrativa do perfil de um consultor do portal.",
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
  component: AdminConsultorPage,
});

const REDES_LABEL: Record<(typeof REDES_PERMITIDAS)[number], string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  site: "Site",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

function AdminConsultorPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const consultorQueryKey = ["admin", "consultor", id] as const;

  const { data: consultor, isLoading } = useQuery({
    queryKey: consultorQueryKey,
    queryFn: () => getConsultorAdmin({ data: { id } }),
  });

  const { data: areas } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
    staleTime: 1000 * 60 * 10,
  });

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [tempo, setTempo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [redes, setRedes] = useState<Record<string, string>>({});
  const [areaIds, setAreaIds] = useState<string[]>([]);

  useEffect(() => {
    if (!consultor) return;
    setNome(consultor.nome);
    setEmail(consultor.email);
    setSlug(consultor.slug);
    setBio(consultor.bio ?? "");
    setTempo(consultor.tempoDeMercado != null ? String(consultor.tempoDeMercado) : "");
    setTelefone(consultor.telefone ?? "");
    setRedes(Object.fromEntries(consultor.redes.map((r) => [r.rede, r.url])));
    setAreaIds(consultor.areaIds);
    // Só sincroniza na primeira carga (ou ao trocar de registro): publicar ou
    // despublicar recarrega o consultor e não deve descartar edições pendentes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultor?.id]);

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: consultorQueryKey });
    await queryClient.invalidateQueries({ queryKey: ["admin", "consultores"] });
  };

  const salvar = useMutation({
    mutationFn: () =>
      atualizarConsultorAdmin({
        data: {
          id,
          nome: nome.trim(),
          email: email.trim(),
          slug: slug.trim(),
          bio: bio.trim() || null,
          tempoDeMercado: tempo.trim() === "" ? null : Number(tempo),
          telefone: telefone.trim() || null,
          redes: REDES_PERMITIDAS.filter((r) => (redes[r] ?? "").trim().length > 0).map((r) => ({
            rede: r,
            url: (redes[r] ?? "").trim(),
          })),
          areaIds,
        },
      }),
    onSuccess: async () => {
      await invalidar();
      toast.success("Consultor atualizado");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const publicar = useMutation({
    mutationFn: (publicado: boolean) => setPublicadoAdmin({ data: { id, publicado } }),
    onSuccess: async (res) => {
      await invalidar();
      toast.success(res.publicado ? "Consultor publicado" : "Consultor despublicado");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  if (isLoading || !consultor) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-14">
          <p className="text-sm text-muted-foreground">Carregando consultor…</p>
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
            <p className="u-eyebrow">Administração</p>
            <h1 className="u-display mt-3 text-3xl">{consultor.nome}</h1>
            <hr className="u-rule mt-6" />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/consultores">Voltar à lista</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-2 border-border p-4">
          <span className="text-sm font-semibold text-foreground">
            {consultor.publicado ? "Publicado" : "Rascunho"}
          </span>
          <span className="flex-1 text-xs text-muted-foreground">
            {consultor.publicado
              ? `Visível na vitrine em /consultores/${consultor.slug}`
              : "Enquanto não publicado, o perfil não aparece na vitrine nem por URL direta."}
          </span>
          {consultor.publicado && (
            <Button asChild size="sm" variant="outline">
              <Link to="/consultores/$slug" params={{ slug: consultor.slug }}>
                Ver perfil público
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            variant={consultor.publicado ? "secondary" : "default"}
            disabled={publicar.isPending}
            onClick={() => publicar.mutate(!consultor.publicado)}
          >
            {consultor.publicado ? "Despublicar" : "Publicar"}
          </Button>
        </div>

        <form
          className="mt-10 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail de contato</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="slug">Slug do perfil</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Usado na URL pública: /consultores/{slug || "slug"}
            </p>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={7}
              maxLength={4000}
              className="mt-2"
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
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 90000-0000"
                className="mt-2"
              />
            </div>
          </div>

          <fieldset>
            <legend className="u-eyebrow">Redes sociais</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {REDES_PERMITIDAS.map((r) => (
                <div key={r}>
                  <Label htmlFor={`rede-${r}`}>{REDES_LABEL[r]}</Label>
                  <Input
                    id={`rede-${r}`}
                    value={redes[r] ?? ""}
                    onChange={(e) => setRedes((atual) => ({ ...atual, [r]: e.target.value }))}
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
              {(areas ?? []).map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-start gap-3 border-2 border-border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={areaIds.includes(a.id)}
                    onChange={(e) =>
                      setAreaIds((atual) =>
                        e.target.checked ? [...atual, a.id] : atual.filter((x) => x !== a.id),
                      )
                    }
                    className="mt-1"
                  />
                  <span className="font-semibold text-foreground">{a.nome}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>

        <section className="mt-12 border-2 border-border p-4">
          <h2 className="text-base font-semibold text-foreground">Mídia e cases</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Foto: {consultor.fotoUrl ? "enviada" : "não enviada"} · Vídeo:{" "}
            {consultor.temVideo ? "enviado" : "não enviado"} · {consultor.cases.length}{" "}
            {consultor.cases.length === 1 ? "case" : "cases"} cadastrados. Uploads e cases são
            mantidos pelo próprio consultor em /painel/perfil.
          </p>
        </section>
      </main>
    </>
  );
}
