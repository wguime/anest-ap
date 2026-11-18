// AUTO-GERADO por scripts/gerar-libs-ferias-api-v1.mjs a partir de src/lib/feriasCalendario.js
// NÃO EDITAR — edite src/lib/feriasCalendario.js e rode o script.
// deno-lint-ignore-file
/**
 * Calendário de apoio às regras de férias (V-13, V-21, V-22) — dados que o
 * coordenador do comitê pediu para o app PESQUISAR em vez de o comitê
 * alimentar (16/11/2026: "ela tem que pesquisar data de férias da rede
 * particular, e COPA e CBA").
 *
 * FÉRIAS ESCOLARES DE MEIO DE ANO (V-13, "julho"): semanas nobres são só as
 * do calendário escolar de Chapecó — em 2026 caíram em AGOSTO; se as férias começam no meio da semana, a semana
 * inteira conta. As escolas particulares de Chapecó não publicaram o
 * calendário (pesquisa 18/11/2026; o Sinepe/SC tem o ofício 030/2026 só para
 * associados). Até sair, vale a rede estadual de SC (SED) como referência —
 * `fonte` diz qual é. Trocar quando as escolas publicarem.
 * ⚠️ 2027 pode mudar: a Lei 15.421/2026 manda ajustar as férias de meio de ano
 * à Copa do Mundo Feminina (24/06–25/07/2027); SC não é sede e o parecer ainda
 * define onde é obrigatório (re-pesquisa 18/11/2026). Conferir no 1º semestre
 * de 2027 e, se mudar, trocar a janela abaixo.
 *
 * CONGRESSOS (V-21/V-22): congresso nacional (CBA), COPA e prova do TSA. Não
 * é pré-requisito para marcar — o sócio marca com asterisco e anexa o
 * comprovante, e o comitê valida. Servem para o app reconhecer o período e
 * avisar. `confirmado: false` = data ainda não divulgada oficialmente.
 *
 * Puro, só dados + consultas por data ISO.
 */

export const FERIAS_ESCOLARES_JULHO = {
  // Chapecó 2026: o recesso de meio de ano das redes municipal E estadual foi
  // transferido de julho para agosto por causa do Parajasc — começou na segunda
  // 17/08, retorno em 26/08 (Ed. Infantil) e 27/08 (Fundamental). Fonte: ND+,
  // 14/08/2026 (ndmais.com.br, "Redes municipal e estadual de Chapecó iniciam
  // recesso na segunda"). Escolas particulares: sem calendário publicado.
  2026: { inicio: '2026-08-17', fim: '2026-08-25', fonte: 'Redes municipal e estadual de Chapecó (recesso transferido para agosto pelo Parajasc) — particulares sem calendário publicado' },
  2027: { inicio: '2027-07-22', fim: '2027-07-31', fonte: 'Rede estadual de SC (SED, calendário 2027) — escolas particulares de Chapecó sem calendário publicado' },
}

export const CONGRESSOS = {
  2026: [
    { chave: 'copa', nome: 'COPA (Congresso Paulista de Anestesiologia)', inicio: '2026-04-23', fim: '2026-04-26', confirmado: true },
    { chave: 'tsa', nome: 'Prova do TSA (escrita)', inicio: '2026-10-23', fim: '2026-10-23', confirmado: false },
    { chave: 'cba', nome: 'CBA (Congresso Brasileiro de Anestesiologia) — Fortaleza', inicio: '2026-11-26', fim: '2026-11-29', confirmado: true },
  ],
  2027: [
    { chave: 'copa', nome: 'COPA (Congresso Paulista de Anestesiologia)', inicio: '2027-04-22', fim: '2027-04-24', confirmado: true },
    // CBA 2027 e TSA 2027: ainda sem data divulgada (pesquisa 18/11/2026).
  ],
}

function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function segundaDe(iso) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return somarDias(iso, dow === 0 ? -6 : 1 - dow)
}

/**
 * Janela das semanas escolares de julho, ampliada à semana inteira nas duas
 * pontas (V-13: férias que começam no meio da semana → a semana toda é nobre).
 * @returns {{inicio:string, fim:string, fonte:string}|null}
 */
export function semanasEscolaresJulho(ano) {
  const f = FERIAS_ESCOLARES_JULHO[ano]
  if (!f) return null
  return { inicio: segundaDe(f.inicio), fim: somarDias(segundaDe(f.fim), 4), fonte: f.fonte }
}

/** O dia cai numa semana escolar de julho? */
export function ehSemanaEscolarJulho(dataISO) {
  const j = semanasEscolaresJulho(Number(dataISO.slice(0, 4)))
  return Boolean(j && dataISO >= j.inicio && dataISO <= j.fim)
}

/** Congresso (CBA/COPA/TSA) que contém o dia, ou null. */
export function congressoNoDia(dataISO) {
  const lista = CONGRESSOS[Number(dataISO.slice(0, 4))] || []
  return lista.find((c) => dataISO >= c.inicio && dataISO <= c.fim) || null
}
