import { z } from "zod";

const BUCKETS = {
  FOTOS: "fotos-publico",
  VIDEOS: "videos-privado",
} as const;

const LIMITS = {
  [BUCKETS.FOTOS]: 5 * 1024 * 1024, // 5 MB
  [BUCKETS.VIDEOS]: 50 * 1024 * 1024, // 50 MB
} as const;

const VIDEO_PATH_PREFIXES = {
  PERFIL: "perfil",
  BIBLIOTECA: "biblioteca",
} as const;

const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const storageConfig = {
  buckets: BUCKETS,
  limits: LIMITS,
  videoPrefixes: VIDEO_PATH_PREFIXES,
  allowedMimeTypes: {
    fotos: PHOTO_MIME_TYPES,
    videos: VIDEO_MIME_TYPES,
  },
};

export function validateFileSize(bucket: string, sizeInBytes: number) {
  const limit = LIMITS[bucket as keyof typeof LIMITS];
  if (!limit) {
    throw new Error(`Bucket desconhecido: ${bucket}`);
  }
  if (sizeInBytes > limit) {
    throw new Error(
      `Arquivo excede o limite de ${Math.round(limit / 1024 / 1024)} MB para o bucket ${bucket}`,
    );
  }
}

export function validateMimeType(bucket: "fotos-publico" | "videos-privado", mimeType: string) {
  const allowed = bucket === "fotos-publico" ? PHOTO_MIME_TYPES : VIDEO_MIME_TYPES;
  if (!allowed.includes(mimeType)) {
    throw new Error(`Tipo de arquivo não permitido em ${bucket}: ${mimeType}`);
  }
}

export const signedUrlPathSchema = z
  .string()
  .min(1)
  .regex(/^[^.].*$/, "Caminho não pode começar com ponto")
  .refine((path) => !path.includes(".."), "Caminho não pode conter referências de diretório pai");
