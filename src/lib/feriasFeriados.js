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
}

/**
 * Recesso de fim de ano (semana peri-natal + peri-réveillon). Datas de 2026
 * confirmadas pelo dono em 04/08/2026: 21/12/2026 a 03/01/2027.
 *
 * Ativa a severidade CRÍTICA da 7ª vaga na janela de ±7 dias em volta do
 * recesso (regra: no peri-recesso a 7ª vaga é proibida, só licença-saúde).
 * Ano sem datas → null e o alerta degrada para warning genérico.
 */
export const RECESSO_FIM_DE_ANO = {
  2026: { inicio: '2026-12-21', fim: '2027-01-03' },
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
