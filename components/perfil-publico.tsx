import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getPublicProfileVideoUrl } from "@/lib/storage.functions";

export type PerfilPublicoData = {
  slug?: string;
  nome: string;
  bio: string | null;
  tempoDeMercado: number | null;
  fotoUrl: string | null;
  videoPath: string | null;
  telefone?: string | null;
  email?: string | null;
  redes: { rede: string; url: string }[];
  areas: { slug: string; nome: string }[];
  cases: { id: string; cliente: string; descricao: string | null; resultado: string | null }[];
};

/** Telefone e e-mail de contato do consultor, visíveis para qualquer visitante. */
function ContatoDireto({ telefone, email }: { telefone?: string | null; email?: string | null }) {
  if (!telefone && !email) return null;

  const whats = telefone?.replace(/\D/g, "") ?? "";

  return (
    <div className="mt-6">
      <p className="u-eyebrow">Contato direto</p>
      <ul className="mt-3 space-y-1 text-sm">
        {telefone && (
          <li>
            <a
              href={whats.length >= 10 ? `https://wa.me/${whats}` : `tel:${telefone}`}
              target={whats.length >= 10 ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-4"
            >
              {telefone}
            </a>
          </li>
        )}
        {email && (
          <li>
            <a
              href={`mailto:${email}`}
              className="font-semibold text-primary underline underline-offset-4"
            >
              {email}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

function VideoPerfil({ path, poster, nome }: { path: string; poster: string | null; nome: string }) {
  const { data } = useQuery({
    queryKey: ["video-perfil", path],
    queryFn: () => getPublicProfileVideoUrl({ data: { path } }),
    staleTime: 1000 * 60 * 3,
  });

  return (
    <section className="mt-12">
      <h2 className="u-eyebrow">Apresentação em vídeo</h2>
      <div className="mt-4 w-full max-w-[16rem] sm:max-w-xs" style={{ aspectRatio: "9 / 16" }}>
        {data?.signedUrl ? (
          <video
            src={data.signedUrl}
            poster={poster ?? undefined}
            controls
            playsInline
            muted
            preload="metadata"
            className="h-full w-full bg-foreground/5 object-cover"
            aria-label={`Vídeo de apresentação de ${nome}`}
          />
        ) : (
          <div className="h-full w-full bg-foreground/5" aria-hidden />
        )}
      </div>
    </section>
  );
}

/**
 * Layout do perfil público do consultor. Reaproveitado pela rota pública
 * (`/consultores/{slug}`) e pela pré-visualização no painel.
 */
export function PerfilPublico({
  consultor,
  eyebrow = "Perfil do consultor",
  children,
}: {
  consultor: PerfilPublicoData;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <p className="u-eyebrow">{eyebrow}</p>
      <h1 className="u-display mt-3 text-2xl sm:text-3xl">{consultor.nome}</h1>
      <hr className="u-rule mt-6" />

      <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
        {consultor.fotoUrl && (
          <img
            src={consultor.fotoUrl}
            alt={`Foto de ${consultor.nome}`}
            className="h-56 w-full max-w-56 shrink-0 object-cover"
            loading="lazy"
          />
        )}

        <div className="min-w-0 flex-1">
          {consultor.tempoDeMercado != null && (
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
              {consultor.tempoDeMercado} anos de mercado
            </p>
          )}

          {consultor.areas.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Áreas de atuação">
              {consultor.areas.map((a) => (
                <li
                  key={a.slug}
                  className="border-2 border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {a.nome}
                </li>
              ))}
            </ul>
          )}

          {consultor.bio && (
            <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {consultor.bio}
            </p>
          )}

          {consultor.redes.length > 0 && (
            <nav aria-label="Redes sociais" className="mt-6 flex flex-wrap gap-4">
              {consultor.redes.map((r) => (
                <a
                  key={r.rede}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold uppercase tracking-wide text-primary underline underline-offset-4"
                >
                  {r.rede}
                </a>
              ))}
            </nav>
          )}

          <ContatoDireto telefone={consultor.telefone} email={consultor.email} />

        </div>
      </div>

      {consultor.videoPath && (
        <VideoPerfil path={consultor.videoPath} poster={consultor.fotoUrl} nome={consultor.nome} />
      )}

      {consultor.cases.length > 0 && (
        <section className="mt-14">
          <h2 className="u-display text-2xl">Cases</h2>
          <hr className="u-rule mt-4" />
          <ul className="mt-8 space-y-8">
            {consultor.cases.map((c) => (
              <li key={c.id} className="border-t-2 border-border pt-6 first:border-t-0 first:pt-0">
                <p className="u-eyebrow">{c.cliente}</p>
                {c.descricao && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.descricao}</p>
                )}
                {c.resultado && (
                  <p className="mt-3 text-sm font-semibold text-foreground">{c.resultado}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {children}
    </>
  );
}
