/**
 * Paciente na escala cirúrgica — SÓ iniciais (LGPD), na forma que o banco aceita.
 *
 * A CHECK `escala_cirurgica_caso_paciente_iniciais_check` (migration
 * 20260628200000) exige: vazio/NULL, ou até 12 caracteres SEM três letras
 * seguidas. Tudo que chega ao INSERT passa por `iniciaisSeguras` — Vision,
 * Excel, campo livre da conferência, formulário de caso — porque o erro no banco
 * derruba a publicação do HOSPITAL inteiro: em 02/09 a Unimed não subiu por
 * causa de um único paciente que a Vision devolveu com letras seguidas
 * (linhas de EXAMES/IMAGEM trazem "01 EDA" na coluna do paciente).
 *
 * Puro e sem dependências: é importado pelo service (bundle principal) — o
 * parser de Excel, que também usa `iniciais`, puxa a lib `xlsx` e por isso NÃO
 * pode ser a casa desta função.
 */

const up = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase()
const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'])

/** Teto do CHECK do banco (char_length <= 12). */
export const INICIAIS_MAX = 12
const TRES_LETRAS = /\p{L}{3,}/u
const INICIAIS_COLADAS = /^\p{Lu}{3,4}\.?$/u

/** Iniciais do paciente (LGPD): "Cleidiani de Souza Gelda" → "C.S.G." (máx. 4). */
export function iniciais(nome) {
  const tokens = String(nome || '').trim().split(/\s+/).filter(Boolean)
  const letras = tokens
    .filter((t) => !PARTICULAS.has(up(t)))
    .map((t) => up(t)[0])
    .filter(Boolean)
    .slice(0, 4)
  return letras.length ? letras.join('.') + '.' : ''
}

/** O MESMO predicado do CHECK do banco: forma que o INSERT aceita. */
export const ehIniciaisAceitas = (v) => {
  const s = String(v ?? '').trim()
  return s === '' || (s.length <= INICIAIS_MAX && !TRES_LETRAS.test(s))
}

/**
 * Reduz a iniciais o que ainda não está; o que JÁ está em iniciais fica intacto.
 *
 * O `iniciais()` cru não é idempotente — "M.C.G." é um token só e viraria "M.".
 * O guard usa o predicado do CHECK, então ele não afrouxa a regra LGPD: só para
 * de reprocessar o que já passou por ela. Pontos viram separador ("M.C.GOMES" →
 * "M.C.G.") e token sem letra ("01", "03h") não é nome de pessoa — não rende
 * inicial. O resultado SEMPRE satisfaz `ehIniciaisAceitas`.
 */
export function iniciaisSeguras(v) {
  const bruto = String(v ?? '').trim()
  if (ehIniciaisAceitas(bruto)) return bruto
  // "MCS"/"JCSO": iniciais COLADAS (um token só de 3–4 maiúsculas, com ou sem
  // ponto final) — a Vision devolve assim quando some com os pontos, e reduzir
  // a "M." destruiria o dado. Pontuar preserva tudo e passa no CHECK. Um
  // primeiro nome de 3–4 letras sozinho ("ANA") cai aqui também e sai "A.N.A.":
  // sozinho, sem sobrenome, ele não identifica ninguém — e o mapa nunca traz
  // paciente com um nome só.
  if (INICIAIS_COLADAS.test(bruto)) return bruto.replace(/\./g, '').split('').join('.') + '.'
  const soNome = bruto
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter((t) => /\p{L}/u.test(t))
    .join(' ')
  const out = iniciais(soNome)
  return ehIniciaisAceitas(out) ? out : ''
}
