/**
 * Feriados oficiais da escala do grupo — fonte: férias/FERIADOS 2026.pdf.
 *
 * A escala do grupo tem 10 feriados e INCLUI Carnaval (o grupo folga em
 * metades nesse dia, como nos demais). 01/01 e 25/12 NÃO entram aqui: o
 * fim de ano segue o esquema de RECESSO (metade peri-natal, metade
 * peri-réveillon — REGRAS ESCALAS.pdf), não a escala de feriados.
 *
 * O PDF também traz QUEM trabalha em cada feriado (20 nomes por coluna) —
 * dado ainda não consumido pelo app; se virar feature, entra aqui.
 *
 * Manutenção anual: adicionar o ano novo em FERIADOS_UTEIS (o teste
 * tripwire em __tests__/lib/feriasFeriados.test.js quebra em 01/01 se o
 * ano corrente não existir — é deliberado).
 */

export const FERIADOS_UTEIS = {
  2026: [
    '2026-02-17', // Carnaval
    '2026-04-03', // Sexta-feira Santa
    '2026-04-21', // Tiradentes
    '2026-05-01', // Dia do Trabalho
    '2026-06-04', // Corpus Christi
    '2026-08-25', // Dia do Município (Chapecó)
    '2026-09-07', // Independência
    '2026-10-12', // N. Sra. Aparecida
    '2026-11-02', // Finados
    '2026-11-20', // Consciência Negra
  ],
  // 2027 (18/11/2026): mesmo critério da escala de 2026 — nacionais, Chapecó,
  // Carnaval e Corpus Christi; só os que caem em dia útil (01/05 e 20/11 são
  // sábado). 01/01 e 25/12 seguem como recesso. Regras novas: "feriados,
  // conforme a lista que você informar" — o comitê confere.
  2027: [
    '2027-02-09', // Carnaval
    '2027-03-26', // Sexta-feira Santa
    '2027-04-21', // Tiradentes
    '2027-05-27', // Corpus Christi
    '2027-08-25', // Dia do Município (Chapecó)
    '2027-09-07', // Independência
    '2027-10-12', // N. Sra. Aparecida
    '2027-11-02', // Finados
    '2027-11-15', // Proclamação da República
  ],
}

/**
 * Recesso de fim de ano (F-03: metade do grupo folga no peri-natal, metade
 * no peri-réveillon). Datas do comitê de escalas (regras 2026/27):
 * 2026/27 = 23/12/2026 a 02/01/2027 (antes o app usava 21/12–03/01, data de
 * 04/08 superada) e 2027/28 = 24/12/2027 a 02/01/2028 (confirmada 16/11).
 *
 * Desde as regras novas o peri-recesso não proíbe nada: acima das 6 vagas o
 * sócio vira candidato e o comitê decide (V-10/V-33). Ano sem datas → null.
 */
export const RECESSO_FIM_DE_ANO = {
  2026: { inicio: '2026-12-23', fim: '2027-01-02' },
  2027: { inicio: '2027-12-24', fim: '2028-01-02' },
}

/** @returns {Set<string>} datas ISO dos feriados do ano (vazio se ano não configurado). */
export function getFeriados(ano) {
  const lista = FERIADOS_UTEIS[ano]
  if (!lista) {
    console.warn(`[feriasFeriados] Feriados de ${ano} não configurados — extrato conta feriados como dias comuns`)
    return new Set()
  }
  return new Set(lista)
}

/** @returns {{inicio: string, fim: string} | null} */
export function getRecesso(ano) {
  return RECESSO_FIM_DE_ANO[ano] ?? null
}
