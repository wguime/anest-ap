/**
 * Fila dos plantonistas de FIM DE SEMANA (P1…P12) — Pega Plantão, não escala numérica.
 *
 * A escala numérica do grupo só tem dia útil: no sábado e no domingo a coluna simplesmente
 * não existe. Quem manda no fim de semana é o plantão lançado no Pega Plantão, e lá a ORDEM
 * já vem no nome do setor ("ANESTESIA CHAPECO - 5 - P5" → P5). Não há nada a inferir: o Pn é
 * a posição, e a tela só ordena por ele.
 *
 * ⚠️ O fim de semana é lançado UMA vez, no SÁBADO, e vale as 48 horas (mesmo motivo do
 * `getSabadoDoFDS` do serviço). Consultar o domingo direto devolve quase nada — em 06/09/2026
 * a API trouxe só o P11. Por isso a fila do domingo é ancorada no sábado anterior.
 */

/** Sábado que ancora o fim de semana de `dataISO` (o próprio sábado; domingo → véspera). */
export function sabadoDoFimDeSemana(dataISO) {
  const d = new Date(`${dataISO}T12:00:00`)
  const dia = d.getDay()
  if (dia === 6) return dataISO
  if (dia !== 0) return null
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Plantões do Pega Plantão → fila Pn ordenada pelo NÚMERO do posto (P2 antes de P10).
 * Quem não tem Pn no setor fica de fora: a fila é dos postos numerados.
 */
export function filaPn(plantoes = []) {
  return plantoes
    .map((p) => {
      const m = /^P(\d+)$/i.exec(String(p.setor || '').trim())
      if (!m) return null
      return {
        pn: `P${m[1]}`,
        n: Number(m[1]),
        nome: p.nome,
        faixa: p.horarioFim ? `${p.horario}–${p.horarioFim}` : p.horario,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n)
}
