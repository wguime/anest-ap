// AUTO-GERADO por scripts/gerar-libs-ferias-api-v1.mjs a partir de src/lib/extratoFeriasRegras.js
// NÃO EDITAR — edite src/lib/extratoFeriasRegras.js e rode o script.
// deno-lint-ignore-file
/**
 * Motor de regras do Extrato de Férias — "Regras de Escalação – versão
 * estruturada" (comitê de escalas, 12/11/2026), seção 7 (V-01 a V-33). Valem
 * desde 18/11/2026 (dono: "as novas regras já começam a valer a partir de
 * agora e continuam em 2027"); os dados de 2026 continuam os mesmos, só a
 * leitura das regras mudou.
 *
 * Cada regra é pura: (extrato, config) → Violacao[], com `id` DETERMINÍSTICO
 * (mesma situação → mesmo id) porque o id é a chave do diff/dedup da
 * notificação agregada. Regras que já existiam mantêm o formato do id (cota,
 * segunda/sexta, dia lotado, mês nobre) para não re-notificar o que já foi
 * visto.
 *
 * Violacao: { id, regra, severidade: 'warning'|'critical', pessoa|null,
 *             pessoaExib|null, referencia, detalhe }
 *
 * O MESMO motor serve de TRAVA na marcação: `montarResumoConfirmacao` roda as
 * regras sobre o estado depois da seleção e o que for novo e da pessoa vira
 * bloqueio (REGRAS_TRAVA). Aqui no extrato elas só alertam — o que veio do
 * Pega Plantão é sinalizado ao comitê, nunca apagado (V-01).
 *
 * `config`:
 *  - hojeISO: data de hoje (prazos de 2 meses / 30 dias e semana do 1º ano)
 *  - feriados: Set ISO (para a semana do 1º ano)
 * O "quando foi marcado" de cada dia vem de `pessoa.marcadoEm` (DataCriacao
 * do Pega Plantão ou criado_em da movimentação no app).
 */

import { diaDaSemana, DATA_REGRAS_NOVAS } from './extratoFerias.js'
import { metadesDaCota, semanasCheiasMinimas, semestreDe, semanaCorridaPrimeiroAno, COTA_PRIMEIRO_ANO } from './feriasSemestre.js'
import { semanasEscolaresJulho } from './feriasCalendario.js'

export const MAX_VAGAS_DIA = 6

/** Dia em que as regras novas passaram a valer (definido em extratoFerias, reexportado aqui). */
export { DATA_REGRAS_NOVAS }

const fmtBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Exibição sempre pelo nome completo (dono 03/08); ids seguem no nome da escala.
const nomeExib = (p) => p.nomeCompleto || p.nome

const slug = (nome) =>
  nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ´`']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function somarDiasISO(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Mesma data N meses antes (dia limitado ao fim do mês). */
export function mesesAntes(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 - n, 1, 12))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0, 12)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}

const semestreLabel = (s) => (s === 'S1' ? '1º' : '2º')

/** Data (ISO) em que o dia foi marcado, ou null se desconhecida; nunca depois de hoje (simulação). */
function marcadoEm(pessoa, data, hojeISO) {
  const ts = pessoa.marcadoEm?.[data]
  if (!ts) return null
  const dia = String(ts).slice(0, 10)
  return hojeISO && dia > hojeISO ? hojeISO : dia
}

/** Quinzenas nobres de fim de ano: 2ª quinzena de dezembro e 1ª de janeiro. */
export const ehQuinzenaNobreFimDeAno = (dataISO) => {
  const md = dataISO.slice(5)
  return md >= '12-16' || md <= '01-15'
}

/** Semana escolar de julho (V-13), pela tabela de feriasCalendario. */
function ehJulhoEscolar(dataISO) {
  const j = semanasEscolaresJulho(Number(dataISO.slice(0, 4)))
  return Boolean(j && dataISO >= j.inicio && dataISO <= j.fim)
}

// ============================================================================
// V-09/V-10/V-33 — mais de 6 no mesmo dia: o excedente é CANDIDATO
// ============================================================================

/**
 * 6 vagas por dia (férias + congresso). Não existe 7ª vaga: quem passa das 6
 * é candidato e o comitê decide. Uma violação por dia, sem culpado — quem
 * fica com a vaga é decisão do comitê, não do relógio de marcação.
 */
export function regraMaxPorDia(extrato) {
  const violacoes = []
  for (const [data, nomes] of [...extrato.porDia.entries()].sort()) {
    if (nomes.length <= MAX_VAGAS_DIA) continue
    const excedente = nomes.length - MAX_VAGAS_DIA
    const como = ehQuinzenaNobreFimDeAno(data)
      ? 'o comitê decide por sorteio ou pelo histórico, sem perda de dias (V-33)'
      : ehJulhoEscolar(data)
        ? 'o comitê decide com preferência a quem tem filho em idade escolar, sem perda de dias (V-13)'
        : 'só em extrema necessidade; o comitê decide e quem ficar com a vaga perde 3 dias (V-10)'
    violacoes.push({
      id: `max-dia:${data}`,
      regra: 'MAX_POR_DIA',
      severidade: 'warning',
      pessoa: null,
      pessoaExib: null,
      referencia: data,
      detalhe: `${fmtBr(data)}: ${nomes.length} marcados para ${MAX_VAGAS_DIA} vagas — ${excedente} candidato${excedente !== 1 ? 's' : ''}; ${como}`,
    })
  }
  return violacoes
}

// ============================================================================
// V-07 — máximo 2 segundas e 2 sextas ISOLADAS por semestre
// ============================================================================

/**
 * Isolada = o dia sozinho. Os períodos emendam por dia útil, então sexta +
 * segunda seguinte é um bloco (V-07) e feriado no meio não quebra o bloco.
 */
export function regraSegundasSextasIsoladas(extrato) {
  const violacoes = []
  for (const pessoa of extrato.porPessoa) {
    const porSemestre = { S1: { seg: [], sex: [] }, S2: { seg: [], sex: [] } }

    for (const periodo of pessoa.periodos || []) {
      if (periodo.diasUteis !== 1) continue
      const dia = periodo.inicio
      const dow = diaDaSemana(dia)
      if (dow !== 1 && dow !== 5) continue
      porSemestre[semestreDe(dia)][dow === 1 ? 'seg' : 'sex'].push(dia)
    }

    for (const sem of ['S1', 'S2']) {
      for (const [tipo, label] of [['seg', 'segundas'], ['sex', 'sextas']]) {
        const dias = porSemestre[sem][tipo]
        if (dias.length <= 2) continue
        violacoes.push({
          id: `seg-sex:${slug(pessoa.nome)}:${extrato.ano}-${sem}:${tipo}`,
          regra: 'SEG_SEX_ISOLADA',
          severidade: 'warning',
          pessoa: pessoa.nome,
          pessoaExib: nomeExib(pessoa),
          referencia: `${extrato.ano}-${sem}`,
          detalhe: `${dias.length} ${label} isoladas no ${semestreLabel(sem)} semestre (máx. 2; a 3ª só na semana vigente, avisando o comitê) — ${dias.map(fmtBr).join(', ')}`,
        })
      }
    }
  }
  return violacoes
}

// ============================================================================
// V-02/V-05 — cota do ano
// ============================================================================

/**
 * Dias efetivos (marcados + penalidade) acima da cota. Adiantamento só com
 * aprovação do comitê (V-05). O id não carrega a magnitude.
 */
export function regraCotaEstourada(extrato) {
  return extrato.porPessoa
    .map((p) => ({ p, efetivos: p.diasEfetivos ?? p.diasContados }))
    .filter(({ p, efetivos }) => efetivos > p.cota)
    .map(({ p, efetivos }) => {
      const penalidade = p.diasPenalidade ?? 0
      return {
        id: `cota:${slug(p.nome)}:${extrato.ano}`,
        regra: 'COTA_ESTOURADA',
        severidade: 'critical',
        pessoa: p.nome,
        pessoaExib: nomeExib(p),
        referencia: String(extrato.ano),
        detalhe: (penalidade
          ? `${efetivos} dias para uma cota de ${p.cota} — ${p.diasContados} marcados + ${penalidade} de penalidade`
          : `${efetivos} dias marcados para uma cota de ${p.cota}`) + ' (adiantamento só com aprovação do comitê)',
      }
    })
}

// ============================================================================
// V-02 — teto de cada semestre (metade da cota, arredondada para cima)
// ============================================================================

export function regraSemestre(extrato) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    const { maxSemestre, semestreLivre } = metadesDaCota(p.cota)
    if (semestreLivre) continue
    const penal = p.penalidades || []
    for (const sem of ['S1', 'S2']) {
      const total =
        p.diasContaveis.filter((d) => semestreDe(d) === sem).length +
        penal.filter((x) => semestreDe(x.data) === sem).reduce((a, x) => a + (x.diasExtras || 0), 0)
      if (total <= maxSemestre) continue
      violacoes.push({
        id: `semestre:${slug(p.nome)}:${extrato.ano}-${sem}`,
        regra: 'SEMESTRE_EXCEDIDO',
        severidade: 'warning',
        pessoa: p.nome,
        pessoaExib: nomeExib(p),
        referencia: `${extrato.ano}-${sem}`,
        detalhe: `${total} dias no ${semestreLabel(sem)} semestre (máx. ${maxSemestre}, metade da cota de ${p.cota})`,
      })
    }
  }
  return violacoes
}

// ============================================================================
// V-06 — mínimo de semanas cheias por semestre
// ============================================================================

/**
 * Formulação MONOTÔNICA (não acusa quem ainda está marcando): viola quando os
 * dias AVULSOS do semestre passam do que sobra depois das semanas cheias
 * mínimas. O mínimo é contado em SEMANAS: semana com feriado conta como cheia
 * com 4 dias, e o dia que sobra vira avulso (ex.: 15 dias = 1 semana normal +
 * 1 com feriado + 6 avulsos).
 */
export function regraSemanasInteiras(extrato) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    const { maxSemestre, semestreLivre } = metadesDaCota(p.cota)
    if (semestreLivre) continue // 1º ano: regra própria (regraPrimeiroAno)
    const minSemanas = semanasCheiasMinimas(maxSemestre)
    for (const sem of ['S1', 'S2']) {
      const cheias = (p.semanas || []).filter((s) => s.inteira && semestreDe(s.segunda) === sem)
      const diasCheios = new Set(cheias.flatMap((s) => s.dias))
      const avulsos = p.diasContaveis.filter((d) => semestreDe(d) === sem && !diasCheios.has(d)).length
      const comFeriado = Math.min(minSemanas, cheias.filter((s) => s.comFeriado).length)
      const permitidos = maxSemestre - 5 * minSemanas + comFeriado
      if (avulsos <= permitidos) continue
      violacoes.push({
        id: `semanas:${slug(p.nome)}:${extrato.ano}-${sem}`,
        regra: 'SEMANAS_INTEIRAS',
        severidade: 'warning',
        pessoa: p.nome,
        pessoaExib: nomeExib(p),
        referencia: `${extrato.ano}-${sem}`,
        detalhe: `${avulsos} dias avulsos no ${semestreLabel(sem)} semestre (máx. ${permitidos} — exige ${minSemanas} semana${minSemanas !== 1 ? 's' : ''} cheia${minSemanas !== 1 ? 's' : ''})`,
      })
    }
  }
  return violacoes
}

// ============================================================================
// V-06 (1º ano) — os 5 dias são UMA semana de segunda a sexta sem feriado
// ============================================================================

export function regraPrimeiroAno(extrato, config = {}) {
  const feriados = config.feriados || new Set()
  const violacoes = []
  for (const p of extrato.porPessoa) {
    if (p.cota > COTA_PRIMEIRO_ANO || !(p.semanas || []).length) continue
    const r = semanaCorridaPrimeiroAno(p, feriados)
    if (r.cumprida) continue
    // Semana ainda em montagem (futura e incompleta) não é infração.
    if (r.motivo === 'fracionada') {
      const sextaDaSemana = somarDiasISO(p.semanas[0].segunda, 4)
      if (!config.hojeISO || sextaDaSemana >= config.hojeISO) continue
    }
    const texto = {
      varias_semanas: `${r.dias} dias repartidos em ${r.semanas} semanas — no 1º ano são 5 dias numa semana só`,
      fracionada: `${r.dias} dia${r.dias !== 1 ? 's' : ''} numa semana incompleta — no 1º ano a semana é de segunda a sexta`,
      com_feriado: 'semana com feriado — no 1º ano só com aprovação do comitê',
    }[r.motivo]
    violacoes.push({
      id: `primeiro-ano:${slug(p.nome)}:${extrato.ano}`,
      regra: 'PRIMEIRO_ANO',
      severidade: 'warning',
      pessoa: p.nome,
      pessoaExib: nomeExib(p),
      referencia: String(extrato.ano),
      detalhe: texto,
    })
  }
  return violacoes
}

// ============================================================================
// V-08 — segunda ou sexta isolada em semana de feriado
// ============================================================================

export function regraFeriadoSegSex(extrato) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    const semanasComFeriado = new Set((p.semanas || []).filter((s) => s.comFeriado).map((s) => s.segunda))
    for (const periodo of p.periodos || []) {
      if (periodo.diasUteis !== 1) continue
      const dia = periodo.inicio
      const dow = diaDaSemana(dia)
      if (dow !== 1 && dow !== 5) continue
      if (!semanasComFeriado.has(somarDiasISO(dia, 1 - dow))) continue
      violacoes.push({
        id: `feriado-isolado:${slug(p.nome)}:${dia}`,
        regra: 'FERIADO_SEG_SEX',
        severidade: 'warning',
        pessoa: p.nome,
        pessoaExib: nomeExib(p),
        referencia: dia,
        detalhe: `${dow === 1 ? 'segunda' : 'sexta'} ${fmtBr(dia)} isolada em semana com feriado — nessas semanas a prioridade é a semana cheia`,
      })
    }
  }
  return violacoes
}

// ============================================================================
// V-12/V-13 — meses nobres em semanas cheias
// ============================================================================

const PERIODOS_NOBRES = (ano) => {
  const lista = [
    { chave: 'jan1q', label: 'na 1ª quinzena de janeiro', inicio: `${ano}-01-01`, fim: `${ano}-01-15` },
    { chave: 'dez2q', label: 'na 2ª quinzena de dezembro', inicio: `${ano}-12-16`, fim: `${ano}-12-31` },
  ]
  const julho = semanasEscolaresJulho(ano)
  if (julho) lista.push({ chave: 'jul', label: 'nas semanas das férias escolares de meio de ano', inicio: julho.inicio, fim: julho.fim })
  return lista
}

/**
 * Meses nobres exigem semanas cheias. Dia isolado só se sobrou vaga e foi
 * marcado a partir de 2 meses antes (V-12). Julho é nobre só nas semanas do
 * calendário escolar, sem limite de semanas por sócio (V-13). Dia sem data
 * de marcação conhecida é sinalizado (o comitê confere).
 */
export function regraMesesNobres(extrato, config = {}) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    const cheias = new Set((p.semanas || []).filter((s) => s.inteira).map((s) => s.segunda))
    for (const periodo of PERIODOS_NOBRES(extrato.ano)) {
      const fora = p.diasContaveis.filter((d) => {
        if (d < periodo.inicio || d > periodo.fim) return false
        if (cheias.has(somarDiasISO(d, 1 - diaDaSemana(d)))) return false
        const quando = marcadoEm(p, d, config.hojeISO)
        const lotado = (extrato.porDia.get(d)?.length || 0) > MAX_VAGAS_DIA
        return !quando || quando < mesesAntes(d, 2) || lotado
      })
      if (!fora.length) continue
      violacoes.push({
        id: `nobre:${slug(p.nome)}:${extrato.ano}-${periodo.chave}`,
        regra: 'MES_NOBRE',
        severidade: 'warning',
        pessoa: p.nome,
        pessoaExib: nomeExib(p),
        referencia: periodo.chave,
        detalhe: `${fora.length} dia${fora.length !== 1 ? 's' : ''} fora de semana cheia ${periodo.label} (isolado só com vaga e marcado a partir de 2 meses antes) — ${fora.map(fmtBr).join(', ')}`,
      })
    }
  }
  return violacoes
}

// ============================================================================
// V-15/V-16/V-17 — 1 semana com feriado por semestre
// ============================================================================

/**
 * Cada sócio tira 1 semana cheia com feriado por semestre a qualquer momento
 * (a 1ª que ele marcar). Extras só a partir de 30 dias antes do feriado.
 * Dias soltos em semana com feriado não gastam a "1 por semestre" (V-16).
 */
export function regraSemanaComFeriado(extrato, config = {}) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    for (const sem of ['S1', 'S2']) {
      const semanas = (p.semanas || [])
        .filter((s) => s.inteira && s.comFeriado && semestreDe(s.segunda) === sem)
        .map((s) => {
          const datas = s.dias.map((d) => marcadoEm(p, d, config.hojeISO)).filter(Boolean)
          return { ...s, marcadaEm: datas.length === s.dias.length ? datas.sort()[0] : null }
        })
        // "Primeira" = a primeira que o sócio marcou; sem data conhecida vai para o fim.
        .sort((a, b) => (a.marcadaEm || '9999').localeCompare(b.marcadaEm || '9999') || a.segunda.localeCompare(b.segunda))
      for (const s of semanas.slice(1)) {
        const feriado = (extrato.feriadosLista || []).find((f) => f >= s.segunda && f <= somarDiasISO(s.segunda, 4)) || s.segunda
        if (s.marcadaEm && s.marcadaEm >= somarDiasISO(feriado, -30)) continue
        violacoes.push({
          id: `feriado-semana:${slug(p.nome)}:${extrato.ano}-${sem}:${s.segunda}`,
          regra: 'SEMANA_FERIADO_EXTRA',
          severidade: 'warning',
          pessoa: p.nome,
          pessoaExib: nomeExib(p),
          referencia: s.segunda,
          detalhe: `2ª semana com feriado no ${semestreLabel(sem)} semestre (${fmtBr(s.segunda)}) — extras só a partir de 30 dias antes do feriado, com vaga sobrando`,
        })
      }
    }
  }
  return violacoes
}

// ============================================================================
// AGREGADOR + FINGERPRINT
// ============================================================================

const ORDEM_SEVERIDADE = { critical: 0, warning: 1 }

// Rótulos curtos p/ UI/notificação/PDF. As CHAVES antigas e os ids não mudam.
export const REGRA_LABEL = {
  MAX_POR_DIA: 'Mais de 6 no mesmo dia',
  SEG_SEX_ISOLADA: 'Muitas segundas/sextas isoladas',
  COTA_ESTOURADA: 'Acima da cota anual',
  SEMESTRE_EXCEDIDO: 'Acima da metade no semestre',
  SEMANAS_INTEIRAS: 'Poucas semanas cheias',
  PRIMEIRO_ANO: 'Semana do 1º ano fora da regra',
  FERIADO_SEG_SEX: 'Segunda/sexta solta em semana de feriado',
  MES_NOBRE: 'Dia avulso em período nobre',
  SEMANA_FERIADO_EXTRA: 'Semana com feriado a mais',
}

/**
 * Regras que TRAVAM a marcação no app (seção 9: "O app trava (férias)"). Dia
 * lotado não trava — vira candidato (V-10).
 */
export const REGRAS_TRAVA = new Set([
  'COTA_ESTOURADA', 'SEMESTRE_EXCEDIDO', 'SEMANAS_INTEIRAS', 'PRIMEIRO_ANO',
  'SEG_SEX_ISOLADA', 'FERIADO_SEG_SEX', 'MES_NOBRE', 'SEMANA_FERIADO_EXTRA',
])

/** Código da regra no documento do comitê, para citar na tela (seção 1). */
export const REGRA_CODIGO = {
  MAX_POR_DIA: 'V-10',
  SEG_SEX_ISOLADA: 'V-07',
  COTA_ESTOURADA: 'V-05',
  SEMESTRE_EXCEDIDO: 'V-02',
  SEMANAS_INTEIRAS: 'V-06',
  PRIMEIRO_ANO: 'V-06',
  FERIADO_SEG_SEX: 'V-08',
  MES_NOBRE: 'V-12',
  SEMANA_FERIADO_EXTRA: 'V-16',
}

/**
 * Último dia do período a que a violação se refere — para saber se ele já
 * tinha terminado quando as regras novas entraram.
 */
function fimDoPeriodo(v, ano) {
  const ref = String(v.referencia || '')
  if (/^\d{4}-S1$/.test(ref)) return `${ref.slice(0, 4)}-06-30`
  if (/^\d{4}-S2$/.test(ref)) return `${ref.slice(0, 4)}-12-31`
  if (ref === 'jan1q') return `${ano}-01-15`
  if (ref === 'jul') return semanasEscolaresJulho(ano)?.fim ?? `${ano}-07-31`
  if (ref === 'dez2q') return `${ano}-12-31`
  if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) return v.regra === 'SEMANA_FERIADO_EXTRA' ? somarDiasISO(ref, 4) : ref
  return null // cota do ano, 1º ano: sempre avaliadas
}

/**
 * Roda todas as regras; critical primeiro, depois por id.
 *
 * Alertas: o ano INTEIRO é julgado pelas regras novas (dono 18/11/2026: "quero
 * que os alertas já sejam contabilizados agora em 2026, atualize todos os
 * alertas") — o comitê vê tudo o que destoa, inclusive o 1º semestre. Só o
 * CUSTO (feriado pago em `contarDias`, penalidade da 7ª vaga) segue o corte de
 * DATA_REGRAS_NOVAS, para não mudar saldo de férias já tiradas.
 * `config.desde` (opcional) volta a ignorar períodos terminados antes dele.
 */
export function avaliarRegras(extrato, config = {}) {
  const desde = config.desde ?? null
  const todas = [
    ...regraMaxPorDia(extrato, config),
    ...regraSegundasSextasIsoladas(extrato, config),
    ...regraCotaEstourada(extrato, config),
    ...regraSemestre(extrato, config),
    ...regraSemanasInteiras(extrato, config),
    ...regraPrimeiroAno(extrato, config),
    ...regraFeriadoSegSex(extrato, config),
    ...regraMesesNobres(extrato, config),
    ...regraSemanaComFeriado(extrato, config),
  ].filter((v) => {
    if (!desde) return true
    const fim = fimDoPeriodo(v, extrato.ano)
    return !fim || fim >= desde
  })
  return todas.sort(
    (a, b) =>
      ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
      a.id.localeCompare(b.id)
  )
}

/** Hash curto e estável (djb2/base36) do conjunto de ids — invariante à ordem. */
export function fingerprintViolacoes(violacoes = []) {
  const base = violacoes.map((v) => v.id).sort().join('|')
  let h = 5381
  for (let i = 0; i < base.length; i++) {
    h = ((h << 5) + h + base.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}
