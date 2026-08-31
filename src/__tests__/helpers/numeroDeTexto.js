/**
 * Lê de volta um número escrito no padrão brasileiro.
 *
 * ⚠️ Existe desde 31/08/2026, quando o sistema de calculadoras passou a
 * formatar com `numeroBr` — vírgula decimal e ponto de milhar. Vários testes
 * checam invariante CLÍNICA (a dose escala com o peso, a perda nunca passa da
 * volemia) lendo o texto que a tela mostra, e `parseFloat('1.200,5')` devolve
 * 1.2 em silêncio: a invariante passaria a ser testada contra um número errado.
 *
 * "1.234,5 mL/h" → 1234.5
 */
export function numeroDeTexto(texto) {
  const m = String(texto).match(/-?[\d.]+(?:,\d+)?/);
  if (!m) return NaN;
  return Number(m[0].replace(/\./g, '').replace(',', '.'));
}
