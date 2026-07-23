/**
 * Fase noturna da aba Liberações (regras do dono 2026-07-22/23, decisões a/b/c):
 *
 * SEG–SEX (FERIADO INCLUÍDO — decisão c), válido só para a escala de HOJE:
 *   - 19h–22h ('noite'): P3 assume a Unimed como plantonista; P2 cobre a SRPA
 *     da Unimed até 22h; P1 assume o plantão do HRO; P4 é CORINGA — vai a um
 *     dos 3 hospitais conforme a necessidade (decisão b).
 *   - ≥22h ('zerada'): a lista de liberações do dia ZERA (decisão a) — ficam
 *     só os plantonistas noturnos.
 * FDS ou outra data: sempre 'dia' (sem transição).
 *
 * Fonte dos P1–P4: card Plantões da Home (useEscalaDia/PegaPlantao) — itens
 * { setor: 'P1'..'P4', nome, hora }. Tudo DERIVADO do relógio: nenhuma escrita
 * no banco (reescrever o rodapé automaticamente foi a causa da corrupção 22/07).
 */

export const INICIO_NOTURNO_MIN = 19 * 60
export const ZERA_LIBERACOES_MIN = 22 * 60

/** Fase da lista: 'dia' | 'noite' | 'zerada'. */
export function faseLiberacoes({ agoraMin, dataEscala, hojeIso }) {
  if (!dataEscala || dataEscala !== hojeIso) return 'dia'
  const wd = new Date(`${dataEscala}T12:00:00`).getDay()
  if (wd === 0 || wd === 6) return 'dia' // FDS sem transição (feriado seg–sex SEGUE a regra)
  if (agoraMin >= ZERA_LIBERACOES_MIN) return 'zerada'
  if (agoraMin >= INICIO_NOTURNO_MIN) return 'noite'
  return 'dia'
}

/** Extrai { P1..P4: nome } dos plantões do dia (1º nome de cada setor). */
export function plantonistasNoturnos(plantoes) {
  const out = {}
  for (const p of plantoes || []) {
    const setor = String(p?.setor || '').trim().toUpperCase()
    if (/^P[1-4]$/.test(setor) && !out[setor]) {
      const nome = String(p?.nome || '').trim()
      if (nome) out[setor] = nome
    }
  }
  return out
}

/**
 * Candidatos p/ casar o nome do PegaPlantao ("G. Staub", "João Ricardo Moreira",
 * "Dr. Fulano") com o dicionário de vínculos (apelidos + nomes completos).
 * Ordem: nome sem iniciais/honoríficos → primeiro+último → último → primeiro.
 */
export function candidatosNome(nome) {
  const tokens = String(nome || '')
    .replace(/^Dr[a]?\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const significativos = tokens.filter((t) => !/^[A-Za-zÀ-ü]\.?$/.test(t)) // "G." fora
  const t = significativos.length ? significativos : tokens
  if (!t.length) return []
  const c = new Set([t.join(' ')])
  if (t.length > 1) {
    c.add(`${t[0]} ${t[t.length - 1]}`)
    c.add(t[t.length - 1])
    c.add(t[0])
  }
  return [...c]
}

/** Plantonista noturno do hospital (quem manda na lista após 19h). */
export function plantonistaNoturnoDe(chaveHospital, noturnos) {
  if (chaveHospital === 'unimed') return noturnos?.P3 || null
  if (chaveHospital === 'hro') return noturnos?.P1 || null
  return null // materno: coberto pelo P4 conforme necessidade
}

/** Linhas do bloco noturno exibidas na lista do hospital. */
export function linhasNoturnas(chaveHospital, noturnos) {
  const linhas = []
  if (chaveHospital === 'unimed') {
    if (noturnos?.P3) linhas.push({ setor: 'P3', nome: noturnos.P3, papel: 'Plantonista' })
    if (noturnos?.P2) linhas.push({ setor: 'P2', nome: noturnos.P2, papel: 'SRPA · até 22h' })
  }
  if (chaveHospital === 'hro' && noturnos?.P1) {
    linhas.push({ setor: 'P1', nome: noturnos.P1, papel: 'Plantonista' })
  }
  if (noturnos?.P4) linhas.push({ setor: 'P4', nome: noturnos.P4, papel: 'Coringa · conforme necessidade' })
  return linhas
}
