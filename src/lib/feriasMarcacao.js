/**
 * Validação e simulação da marcação de férias — regras 2026/27 do comitê de
 * escalas (V-01 a V-33), em vigor desde 18/11/2026.
 *
 * Seção 9 do documento: o app TRAVA o que descumpre uma regra [TRAVA],
 * mostra o código e o motivo, e só aceita as exceções previstas. Duas
 * camadas:
 *  - por DIA (avaliarMarcacaoDia): o que se decide olhando um dia só — prazo,
 *    FDS, feriado (V-11), cota do ano (V-05), teto do semestre (V-02), julho
 *    escolar só para quem tem filho até 2 meses antes (V-13);
 *  - pela SELEÇÃO inteira (montarResumoConfirmacao): o motor de regras roda
 *    no estado depois da seleção e as violações NOVAS desta pessoa que são
 *    [TRAVA] viram bloqueio (semanas cheias, segundas/sextas isoladas, meses
 *    nobres, semana com feriado, 1º ano).
 * Dia com as 6 vagas ocupadas NÃO trava: a marcação entra como CANDIDATA
 * (V-10/V-33), sem custo agora, e o comitê é avisado.
 * Prazos também são reavaliados no servidor (RLS de ferias_movimentacoes).
 *
 * Sem I/O; o "hoje" entra por parâmetro.
 */

import { construirExtrato, ehFimDeSemana, segundaDaSemana } from './extratoFerias'
import {
  avaliarRegras, MAX_VAGAS_DIA, REGRAS_TRAVA, REGRA_CODIGO, REGRA_LABEL, mesesAntes,
  ehQuinzenaNobreFimDeAno,
} from './extratoFeriasRegras'
import { aplicarMovimentacoes, chaveDia } from './feriasMovimentacoes'
import { semestreDe, metadesDaCota } from './feriasSemestre'
import { ehSemanaEscolarJulho, congressoNoDia } from './feriasCalendario'

/** Custo de quem FICA com a vaga além das 6 fora dos períodos sem perda (V-10) — decidido pelo comitê. */
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
 * Limites da pessoa para a marcação, já com a seleção pendente somada (sem
 * isso dava para furar o teto marcando vários dias antes de confirmar).
 * @returns {{cota, usadosAno, maxSemestre, semestreLivre, usados:{S1,S2}, temFilho:boolean|null, listaFilhos:boolean}}
 */
export function limitesDaPessoa({ pessoa, pendentes = [], socios = [] }) {
  if (!pessoa) return null
  const { maxSemestre, semestreLivre } = metadesDaCota(pessoa.cota)
  const penal = pessoa.penalidades || []
  const usados = { S1: 0, S2: 0 }
  for (const d of pessoa.diasContaveis || []) usados[semestreDe(d)] += 1
  for (const p of penal) usados[semestreDe(p.data)] += p.diasExtras || 0
  for (const d of pendentes) usados[semestreDe(d)] += 1
  return {
    cota: pessoa.cota,
    usadosAno: (pessoa.diasEfetivos ?? pessoa.diasContados) + pendentes.length,
    maxSemestre,
    semestreLivre,
    usados,
    temFilho: pessoa.filhosIdadeEscolar ?? null,
    // V-13 só trava quando o comitê já cadastrou quem tem filho.
    listaFilhos: socios.some((s) => s.filhosIdadeEscolar === true),
  }
}

/** Como o comitê decide o candidato acima das 6 vagas, conforme o período. */
export function textoCandidato(data) {
  if (ehQuinzenaNobreFimDeAno(data)) {
    return `Dia com as ${MAX_VAGAS_DIA} vagas ocupadas: você entra como candidato. O comitê decide por sorteio ou pelo histórico, e quem fica não perde dias (V-33).`
  }
  if (ehSemanaEscolarJulho(data)) {
    return `Dia com as ${MAX_VAGAS_DIA} vagas ocupadas: você entra como candidato. O comitê decide com preferência a quem tem filho em idade escolar, sem perda de dias (V-13).`
  }
  return `Dia com as ${MAX_VAGAS_DIA} vagas ocupadas: você entra como candidato, só em extrema necessidade. O comitê decide; quem ficar com a vaga perde ${CUSTO_SETIMA_VAGA} dias, e quem não ficar não paga nada (V-10).`
}

/**
 * Pode marcar este dia?
 *
 * @param {object} [limites] saída de limitesDaPessoa (null = sem trava de cota/semestre)
 * @param {boolean} [socioNoAno] false quando o sócio não está na lista do ano (ex.: saiu do grupo)
 * @returns {{ok:boolean, bloqueio?:{tipo,msg}, avisos:Array<{tipo,msg,custoDias?}>, custoDias:number}}
 */
export function avaliarMarcacaoDia({ data, nome, porDia = new Map(), estadoPorDia = new Map(), hojeISO, feriados = new Set(), limites = null, socioNoAno = true }) {
  const vazio = { avisos: [], custoDias: 1 }
  const trava = (tipo, msg) => ({ ok: false, bloqueio: { tipo, msg }, ...vazio })

  if (ehFimDeSemana(data)) return trava('FDS', 'Férias contam só em dias úteis.')
  if (data <= hojeISO) return trava('PASSADO', 'A escala deste dia já saiu — só é possível marcar a partir de amanhã.')
  if (estadoPorDia.get(chaveDia(nome, data))) return trava('JA_MARCADO', 'Você já tem férias neste dia.')
  if (!socioNoAno) return trava('FORA_DO_GRUPO', `Você não está na lista de sócios de ${data.slice(0, 4)}.`)
  if (feriados.has(data)) {
    return trava('FERIADO', 'V-11: ninguém marca férias no dia do feriado. Marque os outros dias da semana — tirando a semana toda, o feriado não conta.')
  }
  if (limites) {
    if (limites.usadosAno >= limites.cota) {
      return trava('COTA', `V-05: sua cota de ${limites.cota} dias já está completa. Adiantamento só com aprovação do comitê de escalas.`)
    }
    const sem = semestreDe(data)
    if (!limites.semestreLivre && limites.usados[sem] >= limites.maxSemestre) {
      return trava('SEMESTRE', `V-02: no máximo ${limites.maxSemestre} dias no ${sem === 'S1' ? '1º' : '2º'} semestre (metade da cota) — você já está com ${limites.usados[sem]}.`)
    }
    if (limites.listaFilhos && limites.temFilho !== true && ehSemanaEscolarJulho(data)) {
      const abre = mesesAntes(segundaDaSemana(data), 2)
      if (hojeISO < abre) {
        return trava('JULHO_ESCOLAR', `V-13: nas semanas escolares de julho, até ${abre.split('-').reverse().join('/')} só marca quem tem filho em idade escolar. Depois disso, havendo vaga, qualquer sócio marca.`)
      }
    }
  }

  const avisos = []
  const ocupacao = porDia.get(data)?.length || 0
  if (ocupacao >= MAX_VAGAS_DIA) {
    avisos.push({ tipo: 'CANDIDATO', msg: textoCandidato(data) })
  }
  if (data === somarDiasISO(hojeISO, 1)) {
    avisos.push({ tipo: 'VESPERA', msg: 'É a véspera: a escala de amanhã sai hoje à noite e, depois disso, este dia não poderá mais ser desmarcado (V-27).' })
  }
  const congresso = congressoNoDia(data)
  if (congresso) {
    avisos.push({
      tipo: 'CONGRESSO',
      msg: `Período de ${congresso.nome}. Indo ao evento, até 2 dias por ano não descontam da cota mediante comprovante (V-22) — avise o comitê de escalas para registrar.`,
    })
  }

  return { ok: true, avisos, custoDias: 1 }
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
  // Penalidade da 7ª vaga que a pessoa JÁ carrega (vem do extrato da página).
  // Entra nos dois lados da conta para o "antes → depois" bater com o que o
  // Individual mostra; o custo desta seleção é somado só no "depois".
  penalidadeAtual = 0,
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
  const violacoesDepois = avaliarRegras(extratoDepois, { feriados, hojeISO })

  // Diff contra o estado ANTES calculado aqui mesmo (mesmo motor, mesma
  // config) — comparar com as violações da página misturaria versões.
  const efetivosAntes = aplicarMovimentacoes(registrosPP, movimentacoes)
  const extratoAntes = construirExtrato({ registros: efetivosAntes, ano, socios, feriados })
  const violacoesAntes = avaliarRegras(extratoAntes, { feriados, hojeISO })
  const idsAtuais = new Set([...violacoesAntes, ...violacoesAtuais].map((v) => v.id))
  const novas = violacoesDepois.filter((v) => !idsAtuais.has(v.id))

  // TRAVA (seção 9): violação nova, da própria pessoa, de regra [TRAVA].
  // Exceção da V-07: a 3ª segunda/sexta isolada vale na semana vigente — vira
  // aviso ao comitê em vez de bloqueio.
  const semanaVigente = segundaDaSemana(hojeISO)
  const tudoNaSemanaVigente = marcar.length > 0 && marcar.every((d) => segundaDaSemana(d) === semanaVigente)
  const bloqueios = []
  const avisosNovos = []
  for (const v of novas) {
    const ehTrava = REGRAS_TRAVA.has(v.regra) && v.pessoa === nome &&
      !(v.regra === 'SEG_SEX_ISOLADA' && tudoNaSemanaVigente)
    if (ehTrava) bloqueios.push({ ...v, codigo: REGRA_CODIGO[v.regra], label: REGRA_LABEL[v.regra] })
    else avisosNovos.push(v)
  }

  // Desistência (V-25/V-32): o que se desmarca de semana em mês nobre ou de
  // semana cheia com feriado. Olha o estado ANTES (a semana que existia).
  const pessoaAntesCheias = new Map(
    (extratoAntes.porPessoa.find((p) => p.nome === nome)?.semanas || [])
      .filter((sem) => sem.inteira)
      .map((sem) => [sem.segunda, sem])
  )
  const avisosDesmarcar = []
  for (const data of desmarcar) {
    const semana = pessoaAntesCheias.get(segundaDaSemana(data))
    if (!semana) continue
    if (semana.comFeriado) {
      if (hojeISO > mesesAntes(semana.segunda, 2)) {
        avisosDesmarcar.push({
          data,
          tipo: 'DESISTENCIA_FERIADO',
          msg: 'V-32: desmarcar semana cheia com feriado com menos de 2 meses de antecedência desconta 1 dia da sua cota. O comitê de escalas registra.',
        })
      }
      continue
    }
    const nobre = ehQuinzenaNobreFimDeAno(data) || ehSemanaEscolarJulho(data)
    if (nobre && hojeISO > mesesAntes(semana.segunda, 1)) {
      bloqueios.push({
        id: `desistencia:${data}`,
        regra: 'DESISTENCIA_NOBRE',
        codigo: 'V-25',
        label: 'Desistência fora do prazo',
        pessoa: nome,
        detalhe: `${data.split('-').reverse().join('/')}: semana em período nobre só pode ser desmarcada até 1 mês antes. Depois disso os dias contam igual.`,
      })
    }
  }
  const pessoaAntes = extratoAntes.porPessoa.find((p) => p.nome === nome)
  const pessoaDepois = extratoDepois.porPessoa.find((p) => p.nome === nome)

  const custoDeclaradoExtra = linhas
    .filter((l) => l.acao === 'marcar')
    .reduce((acc, l) => acc + (l.custoDias - 1), 0)

  // Dono 04/08: o custo extra da 7ª vaga é DEBITADO e conta como dia de
  // férias. Por isso o resumo declara o efetivo (marcados + penalidade), e
  // não só os dias marcados — senão o sheet prometeria um saldo que o
  // extrato não confirma depois.
  const diasAntes = (pessoaAntes?.diasContados ?? 0) + penalidadeAtual
  const diasDepois = (pessoaDepois?.diasContados ?? 0) + penalidadeAtual + custoDeclaradoExtra
  const cota = pessoaDepois?.cota ?? pessoaAntes?.cota ?? 0

  for (const a of avisosDesmarcar) {
    const linha = linhas.find((l) => l.acao === 'desmarcar' && l.data === a.data)
    if (linha) linha.avisos.push({ tipo: a.tipo, msg: a.msg })
  }

  return {
    bloqueios,
    candidaturas: linhas.filter((l) => l.avisos.some((a) => a.tipo === 'CANDIDATO')).map((l) => l.data),
    linhas,
    saldoAntes: (pessoaAntes?.cota ?? cota) - diasAntes,
    saldoDepois: cota - diasDepois,
    diasAntes,
    diasDepois,
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
