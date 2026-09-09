import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const BUCKET = "fotos-publico";

/**
 * URL estável (não expira) para imagens públicas do bucket `fotos-publico`.
 * A leitura acontece no servidor; nenhuma URL assinada é exposta no HTML.
 */
export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params._splat ?? "").replace(/^\/+/, "");

        if (!path || path.includes("..") || path.startsWith(".")) {
          return new Response("Caminho inválido", { status: 400 });
        }

        const extension = path.split(".").pop()?.toLowerCase() ?? "";
        const contentType = ALLOWED_EXTENSIONS[extension];
        if (!contentType) {
          return new Response("Tipo de arquivo não permitido", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);

        if (error || !data) {
          return new Response("Imagem não encontrada", { status: 404 });
        }

        return new Response(await data.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
