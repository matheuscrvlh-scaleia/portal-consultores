import { z } from "zod";

/** Redes sociais aceitas no perfil (mesma lista usada no painel do consultor). */
export const REDES_PERMITIDAS = [
  "linkedin",
  "instagram",
  "site",
  "youtube",
  "whatsapp",
] as const;

/** Dados de perfil usados ao criar um consultor junto com a conta de login. */
export const perfilConsultorSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  bio: z.string().trim().max(4000).optional().nullable(),
  tempoDeMercado: z.coerce.number().int().min(0).max(80).optional().nullable(),
  telefone: z.string().trim().max(40).optional().nullable(),
  redes: z
    .array(
      z.object({
        rede: z.enum(REDES_PERMITIDAS),
        url: z.string().trim().url().max(300),
      }),
    )
    .max(10)
    .default([]),
  areaIds: z.array(z.string().uuid()).max(20).default([]),
});


export const atualizarConsultorSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
    .max(120),
  bio: z.string().trim().max(4000).optional().nullable(),
  tempoDeMercado: z.coerce.number().int().min(0).max(80).optional().nullable(),
  telefone: z.string().trim().max(40).optional().nullable(),
  redes: z
    .array(
      z.object({
        rede: z.enum(REDES_PERMITIDAS),
        url: z.string().trim().url().max(300),
      }),
    )
    .max(10)
    .default([]),
  areaIds: z.array(z.string().uuid()).max(20).default([]),
});

export const areaSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
    .max(120)
    .optional()
    .nullable(),
  descricao: z.string().trim().max(1000).optional().nullable(),
});

/** Normaliza telefone brasileiro para dígitos (com DDI opcional). */
export function normalizarTelefone(valor?: string | null): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 0) return null;
  if (digitos.length < 10 || digitos.length > 13) {
    throw new Error("Telefone inválido: informe DDD e número");
  }
  return digitos;
}

/** Converte o jsonb `redes` em pares nome/URL. */
export function parseRedes(value: unknown): { rede: string; url: string }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, url]) => typeof url === "string" && (url as string).trim().length > 0)
    .map(([rede, url]) => ({ rede, url: (url as string).trim() }));
}
