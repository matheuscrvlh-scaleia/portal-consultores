/**
 * Normalização de slug usada em consultores e conteúdos: minúsculas, sem
 * acentos, apenas letras, números e hifens.
 */
export function slugify(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Acrescenta sufixo numérico enquanto o slug já estiver em uso. */
export function slugDisponivel(base: string, usados: Set<string>): string {
  const raiz = base.length > 0 ? base : "conteudo";
  if (!usados.has(raiz)) return raiz;
  let n = 2;
  while (usados.has(`${raiz}-${n}`)) n += 1;
  return `${raiz}-${n}`;
}
