/**
 * Validação e simulação da marcação de férias (REGRAS ESCALAS.pdf).
 *
 * Filosofia travada pelo dono (04/08): "confirmação com custo declarado" —
 * dia lotado (7ª vaga = 3 dias) e estouro de cota NÃO bloqueiam, mas o
 * usuário só confirma vendo o custo. O que bloqueia de fato é prazo:
 *  - marcar: dia corrente/passado já está em escala publicada;
 *  - desmarcar: "férias marcadas não poderão ser desmarcadas após a escala
 *    do dia sair à noite (no dia anterior)" — logo, véspera também trava.
 * Os mesmos prazos são reavaliados no servidor (RLS de ferias_movimentacoes):
 * o relógio do device é manipulável.
 *
 * Sem I/O; o "hoje" entra por parâmetro.
 */

import { construirExtrato, ehFimDeSemana } from './extratoFerias'
import { avaliarRegras, MAX_VAGAS_DIA } from './extratoFeriasRegras'
import { aplicarMovimentacoes, chaveDia } from './feriasMovimentacoes'

export const CUSTO_SETIMA_VAGA = 3

/**
 * Data local em ISO. NÃO usar toISOString(): às 21h de 31/12 em UTC-3 ele
 * já responde 01/01 — a virada de ano quebraria prazos e o split
 * Agendados/Usufruídos.
 */
export function hojeLocalISO(now = new Date()) {
  const ano = now.getFullYear()
  const mes = String(now.getMonth() + 1).padStart(2, '0')
  const dia = String(now.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function somarDiasISO(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Pode marcar este dia?
 * @returns {{ok:boolean, bloqueio?:{tipo,msg}, avisos:Array<{tipo,msg,custoDias?}>, custoDias:number}}
 */
export function avaliarMarcacaoDia({ data, nome, porDia = new Map(), estadoPorDia = new Map(), hojeISO, feriados = new Set() }) {
  const vazio = { avisos: [], custoDias: 1 }
  if (ehFimDeSemana(data)) {
    return { ok: false, bloqueio: { tipo: 'FDS', msg: 'Férias contam só em dias úteis.' }, ...vazio }
  }
  if (data <= hojeISO) {
    return {
      ok: false,
      bloqueio: { tipo: 'PASSADO', msg: 'A escala deste dia já saiu — só é possível marcar a partir de amanhã.' },
      ...vazio,
    }
  }
  if (estadoPorDia.get(chaveDia(nome, data))) {
    return { ok: false, bloqueio: { tipo: 'JA_MARCADO', msg: 'Você já tem férias neste dia.' }, ...vazio }
  }

  const avisos = []
  let custoDias = 1

  const ocupacao = porDia.get(data)?.length || 0
  if (ocupacao >= MAX_VAGAS_DIA) {
    custoDias = CUSTO_SETIMA_VAGA
    avisos.push({
      tipo: 'SETIMA_VAGA',
      msg: `Dia com as ${MAX_VAGAS_DIA} vagas ocupadas — usar a ${MAX_VAGAS_DIA + 1}ª vaga custa ${CUSTO_SETIMA_VAGA} dias de férias.`,
      custoDias: CUSTO_SETIMA_VAGA,
    })
  }
  if (data === somarDiasISO(hojeISO, 1)) {
    avisos.push({ tipo: 'VESPERA', msg: 'É a véspera: a escala de amanhã sai hoje à noite e não poderá ser desmarcada.' })
  }
  if (feriados.has(data)) {
    avisos.push({ tipo: 'FERIADO', msg: 'É feriado — só não conta como dia de férias se você pegar a semana inteira.' })
  }

  return { ok: true, avisos, custoDias }
}

/**
 * Pode desmarcar este dia? Prazo é bloqueio duro (a escala da véspera já saiu).
 * @returns {{ok:boolean, bloqueio?:{tipo,msg}}}
 */
export function avaliarDesmarcacaoDia({ data, nome, estadoPorDia = new Map(), hojeISO }) {
  if (!estadoPorDia.get(chaveDia(nome, data))) {
    return { ok: false, bloqueio: { tipo: 'NAO_MARCADO', msg: 'Você não tem férias neste dia.' } }
  }
  if (data <= somarDiasISO(hojeISO, 1)) {
    return {
      ok: false,
      bloqueio: {
        tipo: 'PRAZO',
        msg: 'Regra do grupo: férias não podem ser desmarcadas depois que a escala do dia sai (na véspera à noite).',
      },
    }
  }
  return { ok: true }
}

/**
 * Simula o pós-confirmação: monta movimentações provisórias, aplica sobre
 * os registros do PP e roda contagem + regras, devolvendo saldo antes/depois
 * e SÓ as violações que a seleção cria (diff contra as atuais).
 */
export function montarResumoConfirmacao({
  registrosPP = [], movimentacoes = [], selecoes, nome, ano, socios, feriados,
  hojeISO, violacoesAtuais = [], estadoPorDia = new Map(), porDia = new Map(),
}) {
  const marcar = [...(selecoes?.marcar || [])].sort()
  const desmarcar = [...(selecoes?.desmarcar || [])].sort()

  const linhas = [
    ...marcar.map((data) => {
      const av = avaliarMarcacaoDia({ data, nome, porDia, estadoPorDia, hojeISO, feriados })
      return { data, acao: 'marcar', custoDias: av.custoDias, avisos: av.avisos }
    }),
    ...desmarcar.map((data) => ({ data, acao: 'desmarcar', custoDias: 0, avisos: [] })),
  ]

  // Movimentações provisórias: criadoEm no futuro p/ vencerem o histórico
  const provisorias = linhas.map((l, i) => {
    const alvo = estadoPorDia.get(chaveDia(nome, l.data))
    return {
      id: `sim-${i}`,
      nome,
      data: l.data,
      acao: l.acao,
      origemDia: l.acao === 'marcar' ? 'app' : alvo?.origem === 'pp' ? 'pegaplantao' : 'app',
      codigoPp: l.acao === 'desmarcar' && alvo?.origem === 'pp' ? alvo.codigo : null,
      criadoEm: '9999-12-31T23:59:59.999Z',
    }
  })

  const efetivosDepois = aplicarMovimentacoes(registrosPP, [...movimentacoes, ...provisorias])
  const extratoDepois = construirExtrato({ registros: efetivosDepois, ano, socios, feriados })
  const violacoesDepois = avaliarRegras(extratoDepois, { feriados })

  const idsAtuais = new Set(violacoesAtuais.map((v) => v.id))
  const avisosNovos = violacoesDepois.filter((v) => !idsAtuais.has(v.id))

  const efetivosAntes = aplicarMovimentacoes(registrosPP, movimentacoes)
  const extratoAntes = construirExtrato({ registros: efetivosAntes, ano, socios, feriados })
  const pessoaAntes = extratoAntes.porPessoa.find((p) => p.nome === nome)
  const pessoaDepois = extratoDepois.porPessoa.find((p) => p.nome === nome)

  const custoDeclaradoExtra = linhas
    .filter((l) => l.acao === 'marcar')
    .reduce((acc, l) => acc + (l.custoDias - 1), 0)

  return {
    linhas,
    saldoAntes: pessoaAntes?.saldo ?? 0,
    saldoDepois: pessoaDepois?.saldo ?? 0,
    diasAntes: pessoaAntes?.diasContados ?? 0,
    diasDepois: pessoaDepois?.diasContados ?? 0,
    custoDeclaradoExtra,
    custoTotal: linhas.filter((l) => l.acao === 'marcar').reduce((a, l) => a + l.custoDias, 0),
    avisosNovos,
    totalMarcar: marcar.length,
    totalDesmarcar: desmarcar.length,
  }
}

/**
 * Seleção confirmada → linhas prontas para o INSERT (snake_case do banco).
 * `reqId` é o uuid do lote — o índice único (req_id, data, acao) torna a
 * confirmação retry-safe.
 */
export function montarMovimentacoesParaInsert({ selecoes, nome, ano, estadoPorDia = new Map(), resumo, userId, reqId }) {
  const custoPorDia = new Map((resumo?.linhas || []).map((l) => [`${l.acao}|${l.data}`, l]))

  const marcar = [...(selecoes?.marcar || [])].sort().map((data) => {
    const l = custoPorDia.get(`marcar|${data}`)
    return {
      ano,
      nome,
      data,
      acao: 'marcar',
      origem_dia: 'app',
      codigo_pp: null,
      custo_dias: l?.custoDias ?? 1,
      avisos_aceitos: l?.avisos?.length ? l.avisos : null,
      user_id: userId,
      req_id: reqId,
    }
  })

  const desmarcar = [...(selecoes?.desmarcar || [])].sort().map((data) => {
    const alvo = estadoPorDia.get(chaveDia(nome, data))
    const doPP = alvo?.origem === 'pp'
    return {
      ano,
      nome,
      data,
      acao: 'desmarcar',
      origem_dia: doPP ? 'pegaplantao' : 'app',
      codigo_pp: doPP ? alvo.codigo : null,
      custo_dias: 0,
      avisos_aceitos: null,
      user_id: userId,
      req_id: reqId,
    }
  })

  return [...marcar, ...desmarcar]
}
