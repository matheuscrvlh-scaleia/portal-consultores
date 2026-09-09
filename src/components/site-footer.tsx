import { Link } from "@tanstack/react-router";

import proriusAsset from "@/assets/prorius.webp.asset.json";
import scaleiaLogo from "@/assets/scaleia-cropped.png";

/**
 * Rodapé das páginas públicas: créditos institucionais (apoio e
 * desenvolvimento) e link visível para a Política de Privacidade (LGPD).
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="u-eyebrow">Iniciativa dos consultores</p>

        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-12">
          <div className="flex flex-col">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Apoio institucional
            </p>
            <div className="mt-3 flex h-12 items-end">
              <img
                src={proriusAsset.url}
                alt="Prorius — soluções em tecnologia"
                className="h-10 w-auto max-w-full object-contain"
                loading="lazy"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Desenvolvido por
            </p>
            <div className="mt-3 flex h-12 items-end">
              <img
                src={scaleiaLogo}
                alt="Scaleia AI"
                className="h-6 w-auto max-w-full object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <hr className="mt-10 border-border" />
        <div className="mt-6 flex flex-col items-center gap-3 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span className="text-center sm:text-left">Portal dos Consultores</span>
          <Link
            to="/privacidade"
            className="whitespace-nowrap underline underline-offset-4 hover:text-foreground"
          >
            Política de Privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
