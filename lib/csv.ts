/** Utilitário de montagem de CSV para as exportações administrativas. */

type Valor = string | number | boolean | null | undefined;

function escapar(valor: Valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  if (/[",;\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/** Monta um CSV com BOM (para abrir corretamente no Excel) e quebras CRLF. */
export function montarCsv(cabecalho: string[], linhas: Valor[][]) {
  const corpo = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(",")).join("\r\n");
  return `\uFEFF${corpo}\r\n`;
}
