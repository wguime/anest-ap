/**
 * feriasDuplas — duplas de férias que aparecem juntas no card.
 *
 * Regra de negócio: certas funcionárias/profissionais trabalham em dupla e são
 * tratadas como uma unidade que sai de férias junto. Quando a API PegaPlantão
 * reporta UMA da dupla de férias, a dupla vira uma única linha "A / B" no card
 * (herdando o período de quem apareceu de férias). Os nomes são por primeiro
 * nome porque o dado da API pode vir como nome completo.
 */

/** Cada par: se qualquer um aparecer de férias, o outro também aparece. */
export const FERIAS_DUPLAS = [
  ['Aline', 'Rosemary'],
  ['Humberto', 'Roberta'],
];

const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** true se `nome` (possivelmente completo) contém `primeiroNome` como palavra. */
function nomeContem(nome, primeiroNome) {
  const alvo = norm(primeiroNome);
  return norm(nome).split(/\s+/).includes(alvo);
}

/**
 * Mescla cada dupla numa única linha "A / B" quando qualquer membro está de
 * férias. Não muta a lista original; a linha herda período/tipo do membro que
 * apareceu de férias. Se ambos aparecem, colapsa numa linha só (sem duplicar).
 * A ordem do rótulo segue a definição da dupla, não quem apareceu primeiro.
 *
 * @param {Array<{nome:string, periodo?:string, tipo?:string}>} ferias
 * @param {Array<[string,string]>} [duplas]
 * @returns {Array<{nome:string, periodo?:string, tipo?:string}>}
 */
export function aplicarDuplasFerias(ferias = [], duplas = FERIAS_DUPLAS) {
  const resultado = [];
  const duplasEmitidas = new Set();

  for (const entry of ferias) {
    const dupla = duplas.find(([a, b]) => nomeContem(entry.nome, a) || nomeContem(entry.nome, b));
    if (!dupla) {
      resultado.push(entry);
      continue;
    }
    const label = dupla.join(' / ');
    if (duplasEmitidas.has(label)) continue; // o outro membro já colapsou a dupla
    duplasEmitidas.add(label);
    resultado.push({ ...entry, nome: label });
  }

  return resultado;
}
