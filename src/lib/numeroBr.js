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
  // ⚠️ `Number(null)` e `Number('')` devolvem 0, que é FINITO: sem esta guarda
  // um campo vazio virava "0" na tela — um zero inventado numa tela clínica é
  // pior que um travessão, porque parece medição.
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/**
 * Como `numeroBr`, mas sem zeros à direita: 0,2 e não "0,20"; 0,04 e não "0,0".
 *
 * Para valor cujo número de casas varia dentro da mesma lista — dose fixa de
 * flumazenil (0,2 mg) ao lado de naloxona (0,04 mg). Casas FIXAS mostrariam
 * "0,0" para a naloxona, que numa tela de dose é pior que inútil.
 */
export function numeroBrEnxuto(valor, maxCasas = 2) {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxCasas });
}

/**
 * Lê um número escrito em qualquer um dos dois formatos.
 *
 * ⚠️ Existe porque campos como `dosePadrao` e `dilution` são ao mesmo tempo
 * EXIBIDOS e PARSEADOS. Enquanto o dado ficou em formato inglês, a tela mostrava
 * "0.5 mg/kg" ao lado de "1,5 mL/kg"; e trocar o dado para vírgula sem trocar o
 * parser faria `parseFloat('0,5')` devolver 0 — dose zero, não erro de estilo.
 *
 * "0,5" → 0.5 · "0.5" → 0.5 · "1.234,5" → 1234.5 · "0,04-0,07" → 0.04 (o 1º)
 */
export function numeroFlexivel(texto) {
  const t = String(texto).trim();
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return parseFloat(limpo);
}

export default numeroBr;
