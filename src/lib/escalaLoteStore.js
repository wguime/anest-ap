/**
 * UMA FONTE DE VERDADE POR LOTE (Onda 2, item 2.1; audit A2/A3/A7).
 *
 * O estado do lote do dia útil vivia espalhado em `useState`s do pai e das três abas, e
 * três caminhos legítimos — trocar o período, reanexar, resolver "de qual hospital é?" —
 * voltavam à leitura e descartavam o trabalho. Aqui ele é um objeto só, num reducer puro:
 *
 *   leitura[h]   — o que a Vision/planilha devolveu, IMUTÁVEL depois de lida (a foto
 *                  nova substitui, nunca edita); cada linha já nasce com `_lid`
 *   trabalho[h]  — o que a secretária fez (ver `trabalhoConferencia.js`); zera quando a
 *                  leitura daquele hospital é substituída, e só aí
 *   decisoes / trocas — duplicidades respondidas e parceiro escolhido, do LOTE (a
 *                  duplicidade é da pessoa, não da aba — dono 30/08)
 *   publicados   — quem já subiu neste lote (publicar só o que falta — dono 03/09)
 *   abaAtiva     — hospital em conferência
 *
 * É este objeto que o rascunho grava e restaura. Puro: sem React, sem storage.
 */
import { normalizarTrabalho } from '@/pages/escala-cirurgica/trabalhoConferencia'

const HOSPITAIS = ['unimed', 'hro', 'materno']

export function estadoInicialLote({ abaAtiva = null } = {}) {
  return {
    leitura: {},
    trabalho: {},
    decisoes: {},
    trocas: {},
    publicados: [],
    abaAtiva: HOSPITAIS.includes(abaAtiva) ? abaAtiva : null,
  }
}

const aplicar = (updater, atual) => (typeof updater === 'function' ? updater(atual) : updater)
const semChaves = (obj, chaves) => {
  const p = { ...obj }
  for (const k of chaves) delete p[k]
  return p
}

/** Hospitais do lote, na ordem canônica (a mesma das abas). */
export function hospitaisDoLote(estado) {
  return HOSPITAIS.filter((h) => estado?.leitura?.[h])
}

/** Aba efetiva: a escolhida se ainda está no lote; senão a primeira. */
export function abaDoLote(estado) {
  const hs = hospitaisDoLote(estado)
  return estado?.abaAtiva && estado.leitura[estado.abaAtiva] ? estado.abaAtiva : hs[0] || null
}

export function reduzirLote(estado, acao) {
  switch (acao?.type) {
    // Leitura(s) nova(s): entram por cima da do mesmo hospital, e o trabalho daquele
    // hospital ZERA — a aba recarrega a conferência a partir da leitura nova. Os outros
    // hospitais não são tocados.
    case 'leituras_recebidas': {
      const novos = acao.itens || {}
      const hs = Object.keys(novos).filter((h) => HOSPITAIS.includes(h) && novos[h]?.lote)
      if (!hs.length) return estado
      const leitura = { ...estado.leitura }
      for (const h of hs) leitura[h] = { ...novos[h], hospital: h }
      return {
        ...estado,
        leitura,
        trabalho: semChaves(estado.trabalho, hs),
        // quem foi relido não está mais "publicado" com a leitura antiga
        publicados: estado.publicados.filter((h) => !hs.includes(h)),
        abaAtiva: estado.abaAtiva || hs[0],
      }
    }
    case 'leitura_removida': {
      const h = acao.hospital
      if (!estado.leitura[h]) return estado
      return {
        ...estado,
        leitura: semChaves(estado.leitura, [h]),
        trabalho: semChaves(estado.trabalho, [h]),
        publicados: estado.publicados.filter((x) => x !== h),
        abaAtiva: null,
      }
    }
    // Trabalho de UMA aba, por updater (a aba escreve como escrevia num setState).
    // Devolver o mesmo objeto quando nada muda evita laço nos efeitos da aba.
    case 'trabalho_atualizado': {
      const h = acao.hospital
      const atual = estado.trabalho[h] || null
      const novo = aplicar(acao.updater, atual)
      if (novo === atual) return estado
      return { ...estado, trabalho: { ...estado.trabalho, [h]: novo } }
    }
    case 'decisoes_definidas': {
      const novo = aplicar(acao.updater, estado.decisoes)
      return novo === estado.decisoes ? estado : { ...estado, decisoes: novo || {} }
    }
    case 'trocas_definidas': {
      const novo = aplicar(acao.updater, estado.trocas)
      return novo === estado.trocas ? estado : { ...estado, trocas: novo || {} }
    }
    case 'publicados_definidos': {
      const lista = [...new Set(aplicar(acao.updater, estado.publicados) || [])]
      return { ...estado, publicados: lista }
    }
    case 'aba_definida': {
      const novo = aplicar(acao.updater, estado.abaAtiva)
      return novo === estado.abaAtiva ? estado : { ...estado, abaAtiva: novo || null }
    }
    // Trocar o dia ou o período do lote invalida toda decisão já tomada (as duplicidades
    // são do dia/turno). Leitura e trabalho ficam: o trabalho é filtrado por turno na aba.
    case 'contexto_mudou':
      return { ...estado, decisoes: {}, trocas: {} }
    // Rascunho restaurado (ver `escalaLoteRascunho.js`): o lote inteiro volta.
    case 'rascunho_restaurado': {
      const r = acao.rascunho
      const leitura = {}
      const trabalho = {}
      for (const [h, v] of Object.entries(r?.hospitais || {})) {
        if (!HOSPITAIS.includes(h) || !v?.lido?.lote) continue
        leitura[h] = { hospital: h, nome: v.lido.nome || '', truncado: !!v.lido.truncado, lote: v.lido.lote }
        if (v.trabalho) trabalho[h] = normalizarTrabalho(v.trabalho)
      }
      if (!Object.keys(leitura).length) return estado
      return {
        leitura,
        trabalho,
        decisoes: r.decisoes && typeof r.decisoes === 'object' ? r.decisoes : {},
        trocas: r.trocas && typeof r.trocas === 'object' ? r.trocas : {},
        publicados: (r.publicados || []).filter((h) => leitura[h]),
        abaAtiva: r.abaAtiva && leitura[r.abaAtiva] ? r.abaAtiva : Object.keys(leitura)[0],
      }
    }
    case 'lote_descartado':
      return estadoInicialLote()
    default:
      return estado
  }
}

/** Entrada de `montarRascunho` a partir do estado (o `updated_at` publicado vem dos resumos). */
export function hospitaisParaRascunho(estado, resumos = {}) {
  return Object.fromEntries(hospitaisDoLote(estado).map((h) => [h, {
    lido: { nome: estado.leitura[h].nome, truncado: !!estado.leitura[h].truncado, lote: estado.leitura[h].lote },
    trabalho: estado.trabalho[h] || null,
    escalaPublicadaUpdatedAt: resumos[h]?.publicadaAtualizadaEm || null,
  }]))
}

export { HOSPITAIS as HOSPITAIS_DO_LOTE }
