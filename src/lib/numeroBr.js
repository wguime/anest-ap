/**
 * Número no padrão brasileiro — o separador decimal é VÍRGULA.
 *
 * ⚠️ Existe porque `toFixed()` devolve PONTO. Num app brasileiro, o formato do
 * número é tão português quanto as palavras: "12.75" ao lado de "1,5 mL/kg" na
 * mesma tela faz duvidar da conta. O defeito era sistêmico — a skill de
 * calculadoras MANDAVA usar `toFixed`, então cada calculadora nova nascia com
 * ele (130 usos contra 2 de `toLocaleString` quando isto foi escrito, 31/08/2026).
 *
 * Separa milhar de quebra: "4.900 ml" em vez de "4900 ml".
 *
 * @param {number|string} valor
 * @param {number} casas  casas decimais (padrão 0)
 * @returns {string} o número formatado, ou '—' quando não é número
 */
export function numeroBr(valor, casas = 0) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export default numeroBr;
