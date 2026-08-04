/**
 * Marcação de férias no app — replay das movimentações sobre os registros
 * do Pega Plantão (event-sourcing leve).
 *
 * O extrato passou a ter DUAS fontes: os registros que vêm do PP e as
 * marcações/desmarcações feitas aqui (tabela ferias_movimentacoes,
 * append-only). Esta lib funde as duas em "registros efetivos" com o MESMO
 * shape que o downstream (construirExtrato/avaliarRegras/Mapa) já consome —
 * com 0 movimentações o resultado é idêntico à lista do PP.
 *
 * Regra de resolução por (nome, data): LAST-WINS cronológico. O estado
 * nunca sai da soma do log — sempre do replay.
 *
 * Sem I/O e sem relógio (prazos ficam em feriasMarcacao.js).
 */

import { ehFimDeSemana } from './extratoFerias'

export const chaveDia = (nome, data) => `${nome}|${data}`

/** Ordena movimentações por (criadoEm, id) — tie-break determinístico. */
function ordenarCronologico(movimentacoes) {
  return [...movimentacoes].sort(
    (a, b) =>
      String(a.criadoEm).localeCompare(String(b.criadoEm)) ||
      String(a.id).localeCompare(String(b.id))
  )
}

/**
 * Registros do PP + movimentações → registros EFETIVOS.
 *
 * Por (nome, data): parte dos códigos do PP; `desmarcar` com codigoPp remove
 * SÓ aquele código (código ausente = no-op — a desmarcação já foi transcrita
 * no PP); `desmarcar` de origem app desliga a marcação do app; `marcar`
 * (re)liga. No fim, o dia rende os códigos do PP ainda ativos e, se não
 * sobrou nenhum e a marcação do app está ligada, um registro sintético
 * `app:<id>` — é o dedup do caso "marquei aqui e depois transcrevi no PP":
 * conta UM dia, com o registro do PP como canônico.
 *
 * @param {Array<{codigo,nome,data,ehFimDeSemana}>} registrosPP
 * @param {Array<{id,nome,data,acao,origemDia,codigoPp,criadoEm}>} movimentacoes
 * @returns {Array<{codigo,nome,data,ehFimDeSemana,origem:'pp'|'app'}>}
 */
export function aplicarMovimentacoes(registrosPP = [], movimentacoes = []) {
  if (!movimentacoes.length) {
    return registrosPP.map((r) => ({ ...r, origem: 'pp' }))
  }

  // Estado inicial: códigos do PP por (nome, data)
  const estado = new Map()
  for (const r of registrosPP) {
    const k = chaveDia(r.nome, r.data)
    if (!estado.has(k)) {
      estado.set(k, { nome: r.nome, data: r.data, codigosPP: [], appMarcado: false, appId: null })
    }
    estado.get(k).codigosPP.push(r.codigo)
  }

  for (const mov of ordenarCronologico(movimentacoes)) {
    const k = chaveDia(mov.nome, mov.data)
    if (!estado.has(k)) {
      estado.set(k, { nome: mov.nome, data: mov.data, codigosPP: [], appMarcado: false, appId: null })
    }
    const e = estado.get(k)

    if (mov.acao === 'marcar') {
      e.appMarcado = true
      e.appId = mov.id
      continue
    }
    // desmarcar
    if (mov.codigoPp) {
      e.codigosPP = e.codigosPP.filter((c) => c !== mov.codigoPp)
    } else {
      e.appMarcado = false
      e.appId = null
    }
  }

  const efetivos = []
  for (const e of estado.values()) {
    const fds = ehFimDeSemana(e.data)
    for (const codigo of e.codigosPP) {
      efetivos.push({ codigo, nome: e.nome, data: e.data, ehFimDeSemana: fds, origem: 'pp' })
    }
    if (e.appMarcado && e.codigosPP.length === 0) {
      efetivos.push({
        codigo: `app:${e.appId}`,
        nome: e.nome,
        data: e.data,
        ehFimDeSemana: fds,
        origem: 'app',
      })
    }
  }
  return efetivos
}

/**
 * Map `${nome}|${data}` → {codigo, origem} dos dias ATIVOS — a UI de seleção
 * usa para saber o que já é meu e, ao desmarcar, qual código anular.
 */
export function indexarPorPessoaDia(registrosEfetivos = []) {
  const out = new Map()
  for (const r of registrosEfetivos) {
    // 1º código vence (dia com 2 códigos do PP: desmarcar mira o primeiro)
    const k = chaveDia(r.nome, r.data)
    if (!out.has(k)) out.set(k, { codigo: r.codigo, origem: r.origem || 'pp' })
  }
  return out
}

/**
 * First-seen das marcações feitas no app — timestamp REAL (o do PP é
 * aproximado por varredura). Alimenta o "último a marcar" da 7ª vaga.
 * @returns {Map<string, {nome, data, firstSeenAt}>} keyed por codigo sintético
 */
export function vistasDasMovimentacoes(movimentacoes = []) {
  const out = new Map()
  for (const mov of movimentacoes) {
    if (mov.acao !== 'marcar') continue
    out.set(`app:${mov.id}`, { nome: mov.nome, data: mov.data, firstSeenAt: mov.criadoEm })
  }
  return out
}

/**
 * Preflight anti-corrida (2 devices do mesmo usuário): descarta linhas que
 * já viraram no-op contra o estado FRESCO — marcar dia que já está ativo,
 * desmarcar dia que já não está.
 * @param {Array} rowsPropostas saída de montarMovimentacoesParaInsert
 */
export function filtrarNoOps(rowsPropostas = [], movimentacoesFrescas = [], registrosPP = []) {
  const efetivos = aplicarMovimentacoes(registrosPP, movimentacoesFrescas)
  const ativos = indexarPorPessoaDia(efetivos)
  return rowsPropostas.filter((row) => {
    const ativo = ativos.get(chaveDia(row.nome, row.data))
    return row.acao === 'marcar' ? !ativo : !!ativo
  })
}
