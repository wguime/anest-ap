/**
 * Prévia da publicação no desktop (dono 09/10/2026, modelo P): a fila de cada hospital como
 * o grupo vai ver na aba Liberações, com as marcas — e as trocas registradas no lote,
 * por hospital. Puro: lê o que cada aba conta ao lote (`resumoAba`).
 */
import { stripNotaRodape, rotuloNota } from './colunaLiberacao'
import { montarVisaoPorFila, normNomeFila } from './escalaVisaoPorFila'

/** A fila de um hospital como o grupo vai ver na aba Liberações (marcas incluídas). */
export function filaDaPrevia(resumo, { resolver, trocas = [] } = {}) {
  if (!resumo) return []
  const ordem = resumo.ordemLiberacao || []
  const v = montarVisaoPorFila({ casos: resumo.casos || [], ordem, ajuda: resumo.ajudaExterna || [], resolver })
  const equipes = new Set((resumo.equipes || []).map(normNomeFila))
  const trocaDe = (nome) => trocas.find((t) => normNomeFila(t.nome) === normNomeFila(nome) || (resolver?.(nome) && t.uid === resolver(nome)))
  const sala = (indices) => (indices.length ? (resumo.casos[indices[0]]?.sala || '') : '')
  const linhas = v.pessoas.map((p) => ({
    pos: p.pos + 1, nome: p.nome, papel: p.papel, ajuda: p.ajuda, local: rotuloNota(p.nota),
    equipe: equipes.has(normNomeFila(p.nome)), troca: trocaDe(p.nome)?.parceiro || '', sala: sala(p.indices), casos: p.indices.length,
  }))
  for (const f of v.fora) {
    linhas.push({ pos: null, nome: f.nome, ajuda: f.ajuda, sala: sala(f.indices), casos: f.indices.length, fora: !f.ajuda })
  }
  return linhas
}


/** Trocas registradas no lote, por hospital — para a prévia mostrar o selo. */
export function trocasDoLote({ decisoes = {}, conferencias = {}, hospitais = [], resumos = {}, resolver }) {
  const out = Object.fromEntries(hospitais.map((h) => [h, []]))
  for (const d of [...Object.values(decisoes || {}), ...Object.values(conferencias || {})]) {
    if (!d || d.tipo !== 'troca') continue
    const parceiro = d.parceiroNome || ''
    for (const h of hospitais) {
      if (d.hospitalVaga && d.hospitalVaga !== h) continue
      const ordem = resumos[h]?.ordemLiberacao || []
      const presente = ordem.some((n) => (d.uid && resolver?.(stripNotaRodape(n)) === d.uid) || (d.nomeNorm && normNomeFila(n) === d.nomeNorm))
      if (!presente) continue
      const nome = ordem.find((n) => (d.uid && resolver?.(stripNotaRodape(n)) === d.uid) || (d.nomeNorm && normNomeFila(n) === d.nomeNorm))
      out[h].push({ nome: stripNotaRodape(nome), uid: d.uid || null, parceiro })
    }
  }
  return out
}

