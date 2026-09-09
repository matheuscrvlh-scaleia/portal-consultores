import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signedUrlPathSchema } from "./storage.validators";

const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutos

const profileVideoSchema = z.object({
  path: signedUrlPathSchema,
});

const libraryVideoSchema = z.object({
  path: signedUrlPathSchema,
});

/**
 * Emite URL assinada de curta duração para vídeo de perfil público.
 * Pode ser chamada por visitantes anônimos.
 * Requer que o bucket `videos-privado` tenha uma política de SELECT para `anon`
 * no prefixo `perfil/`.
 */
export const getPublicProfileVideoUrl = createServerFn({ method: "GET" })
  .inputValidator((data) => profileVideoSchema.parse(data))
  .handler(async ({ data }) => {
    if (!data.path.startsWith("perfil/")) {
      throw new Error("Caminho de vídeo de perfil inválido");
    }

    const { data: signed, error } = await supabase.storage
      .from("videos-privado")
      .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

    if (error || !signed?.signedUrl) {
      throw new Error(error?.message ?? "Não foi possível gerar URL do vídeo");
    }

    return { signedUrl: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  });

/**
 * Emite URL assinada de curta duração para vídeo da biblioteca de conteúdos.
 * Exige usuário autenticado.
 * Requer que o bucket `videos-privado` tenha uma política de SELECT para
 * `authenticated` no prefixo `biblioteca/`.
 */
export const getLibraryVideoUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => libraryVideoSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith("biblioteca/")) {
      throw new Error("Caminho de vídeo da biblioteca inválido");
    }

    const { data: signed, error } = await context.supabase.storage
      .from("videos-privado")
      .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

    if (error || !signed?.signedUrl) {
      throw new Error(error?.message ?? "Não foi possível gerar URL do vídeo");
    }

    return { signedUrl: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  });
