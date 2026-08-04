/**
 * Motor de regras do Extrato de Férias — REGRAS ESCALAS.pdf (FÉRIAS /
 * FERIADOS / PENALIDADES). Cada regra é pura: (extrato, config) →
 * Violacao[], com `id` DETERMINÍSTICO (mesma situação → mesmo id) porque o
 * id é a chave do diff/dedup da notificação agregada ao coordenador.
 *
 * Violacao: { id, regra, severidade: 'warning'|'critical', pessoa|null,
 *             pessoaExib|null, referencia, detalhe }
 * `pessoa` = nome da escala (chave); `pessoaExib` = nome completo p/ UI;
 * `detalhe` NÃO repete o nome — a UI/PDF compõem pessoaExib + detalhe.
 *
 * REGRAS FORA DE ESCOPO (a API do Pega Plantão só expõe o ESTADO atual das
 * marcações, nunca QUANDO cada uma foi feita — sem timeline não dá para
 * verificar prazos): marcação 3 meses antes em meses nobres/congressos,
 * desistência 1 mês antes, desmarcação após a escala do dia sair,
 * adiantamento de cota do ano seguinte, dias extras de congresso, 7ª vaga
 * "contando 3 dias" para quem a usou (sem ordem de marcação não há como
 * saber quem foi o 7º — o DIA é alertado sem atribuir culpa).
 */

import { getRecesso } from './feriasFeriados'
import { diaDaSemana, segundaDaSemana, diasUteisDaSemana } from './extratoFerias'

export const MAX_VAGAS_DIA = 6

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

// ============================================================================
// REGRA 1 — máximo 6 pessoas por dia (7ª vaga)
// ============================================================================

/**
 * "Serão disponibilizadas 6 vagas diárias para férias." Dia com 7+ marcados
 * vira UMA violação por dia, sem culpado (a ordem de marcação não é visível).
 * Critical quando o dia cai a ≤1 semana do recesso de fim de ano (7ª vaga
 * proibida ali); sem recesso configurado, warning.
 */
export function regraMaxPorDia(extrato, config = {}) {
  const recesso = config.recesso ?? getRecesso(extrato.ano)
  const violacoes = []
  for (const [data, nomes] of [...extrato.porDia.entries()].sort()) {
    if (nomes.length <= MAX_VAGAS_DIA) continue
    const periRecesso =
      recesso && data >= somarDiasISO(recesso.inicio, -7) && data <= somarDiasISO(recesso.fim, 7)
    violacoes.push({
      id: `max-dia:${data}`,
      regra: 'MAX_POR_DIA',
      severidade: periRecesso ? 'critical' : 'warning',
      pessoa: null,
      pessoaExib: null,
      referencia: data,
      detalhe: `${fmtBr(data)}: ${nomes.length} pessoas marcadas (máx. ${MAX_VAGAS_DIA}; a 7ª vaga conta 3 dias${periRecesso ? ' e é proibida no peri-recesso' : ''})`,
    })
  }
  return violacoes
}

function somarDiasISO(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ============================================================================
// REGRA 2 — máximo 2 segundas e 2 sextas ISOLADAS por semestre
// ============================================================================

/**
 * Segunda isolada = segunda marcada sem o dia útil seguinte da mesma semana;
 * sexta isolada = sexta sem o dia útil anterior. Feriado adjacente não isola
 * (ex.: sexta 22/05 após Corpus Christi na quinta é isolada só se a quarta
 * também não estiver marcada — o vizinho considerado é o dia ÚTIL não-feriado).
 */
export function regraSegundasSextasIsoladas(extrato, config = {}) {
  const feriados = config.feriados ?? new Set()
  const violacoes = []
  for (const pessoa of extrato.porPessoa) {
    const marcados = new Set(pessoa.diasContaveis.concat(pessoa.feriadosNaoContados))
    const porSemestre = { S1: { seg: [], sex: [] }, S2: { seg: [], sex: [] } }

    for (const dia of pessoa.diasContaveis) {
      const dow = diaDaSemana(dia)
      if (dow !== 1 && dow !== 5) continue
      const uteis = diasUteisDaSemana(segundaDaSemana(dia), feriados)
      const idx = uteis.indexOf(dia)
      if (idx === -1) continue
      const vizinho = dow === 1 ? uteis[idx + 1] : uteis[idx - 1]
      const isolado = !vizinho || !marcados.has(vizinho)
      if (!isolado) continue
      const sem = dia.slice(5, 7) <= '06' ? 'S1' : 'S2'
      porSemestre[sem][dow === 1 ? 'seg' : 'sex'].push(dia)
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
          detalhe: `${dias.length} ${label} isoladas no ${sem === 'S1' ? '1º' : '2º'} semestre (máx. 2) — ${dias.map(fmtBr).join(', ')}`,
        })
      }
    }
  }
  return violacoes
}

// ============================================================================
// REGRA 3 — cota estourada
// ============================================================================

/**
 * Dias contados acima da cota da pessoa. O id NÃO carrega a magnitude:
 * piorar de 36→37 não re-notifica (deliberado — o alerta segue visível na
 * página com o número atual).
 */
export function regraCotaEstourada(extrato) {
  return extrato.porPessoa
    .filter((p) => p.diasContados > p.cota)
    .map((p) => ({
      id: `cota:${slug(p.nome)}:${extrato.ano}`,
      regra: 'COTA_ESTOURADA',
      severidade: 'critical',
      pessoa: p.nome,
      pessoaExib: nomeExib(p),
      referencia: String(extrato.ano),
      detalhe: `${p.diasContados} dias marcados para cota de ${p.cota} (${p.regraCota})`,
    }))
}

// ============================================================================
// REGRA 4 — metade dos dias até fim de junho/julho
// ============================================================================

/**
 * Metade da cota usufruída até 30/06 (sem filhos em idade escolar) ou 31/07
 * (com filhos). filhosIdadeEscolar === null → regra pulada (dado ainda não
 * preenchido pelo dono). Compara contra os DIAS CONTADOS do ano inteiro
 * (férias são marcadas antecipadamente — o estado do ano é conhecido).
 */
export function regraMetadeMeioAno(extrato) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    if (p.filhosIdadeEscolar === null || p.filhosIdadeEscolar === undefined) continue
    if (p.diasContados === 0) continue
    const corte = p.filhosIdadeEscolar ? `${extrato.ano}-07-31` : `${extrato.ano}-06-30`
    const atecorte = p.diasContaveis.filter((d) => d <= corte).length
    const metade = Math.ceil(p.diasContados / 2)
    if (atecorte >= metade) continue
    violacoes.push({
      id: `metade:${slug(p.nome)}:${extrato.ano}`,
      regra: 'METADE_MEIO_ANO',
      severidade: 'warning',
      pessoa: p.nome,
      pessoaExib: nomeExib(p),
      referencia: corte,
      detalhe: `só ${atecorte} de ${p.diasContados} dias até ${fmtBr(corte)} (mínimo: metade — ${metade})`,
    })
  }
  return violacoes
}

// ============================================================================
// REGRA 5 — proporção de semanas inteiras
// ============================================================================

/**
 * "Ao menos 4 semanas inteiras (cota 30); 2 semanas podem ser fracionadas"
 * — formulação MONOTÔNICA para não gerar falso positivo com o ano ainda em
 * marcação: viola quando os dias FORA de semanas inteiras excedem o teto
 * fracionável (cota − 5×mínimo de semanas inteiras = 10 dias nas cotas 30 e
 * 20). Cota de 5 dias (1º ano = 1 semana livre) não tem exigência.
 */
export function regraSemanasInteiras(extrato) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    const minSemanas = p.cota >= 30 ? 4 : p.cota >= 20 ? 2 : 0
    if (!minSemanas) continue
    const limiteFracionado = p.cota - 5 * minSemanas
    const diasEmSemanaInteira = new Set(
      p.semanas.filter((s) => s.inteira).flatMap((s) => s.dias)
    )
    const fracionados = p.diasContaveis.filter((d) => !diasEmSemanaInteira.has(d)).length
    if (fracionados <= limiteFracionado) continue
    violacoes.push({
      id: `semanas:${slug(p.nome)}:${extrato.ano}`,
      regra: 'SEMANAS_INTEIRAS',
      severidade: 'warning',
      pessoa: p.nome,
      pessoaExib: nomeExib(p),
      referencia: String(extrato.ano),
      detalhe: `${fracionados} dias fracionados (máx. ${limiteFracionado} — cota ${p.cota} exige ≥${minSemanas} semanas inteiras)`,
    })
  }
  return violacoes
}

// ============================================================================
// REGRA 6 — meses nobres em semanas cheias
// ============================================================================

const PERIODOS_NOBRES = (ano) => [
  { chave: 'jan1q', label: '1ª quinzena de janeiro', inicio: `${ano}-01-01`, fim: `${ano}-01-15` },
  { chave: 'jul', label: 'julho', inicio: `${ano}-07-01`, fim: `${ano}-07-31` },
  { chave: 'dez2q', label: '2ª quinzena de dezembro', inicio: `${ano}-12-16`, fim: `${ano}-12-31` },
]

/**
 * Meses nobres (1ª quinzena jan, julho, 2ª quinzena dez) exigem marcação em
 * semanas CHEIAS; em julho, máximo 1 semana. (A liberação de dias isolados
 * "3 meses antes se sobrar vaga" depende de QUANDO se marcou — invisível à
 * API — então dia isolado em período nobre sai como warning, não critical.)
 */
export function regraMesesNobres(extrato) {
  const violacoes = []
  for (const p of extrato.porPessoa) {
    for (const periodo of PERIODOS_NOBRES(extrato.ano)) {
      const noPeriodo = p.diasContaveis.filter((d) => d >= periodo.inicio && d <= periodo.fim)
      if (!noPeriodo.length) continue

      const semanasInteiras = new Set(
        p.semanas.filter((s) => s.inteira).map((s) => s.segunda)
      )
      const fora = noPeriodo.filter((d) => !semanasInteiras.has(segundaDaSemana(d)))
      if (fora.length) {
        violacoes.push({
          id: `nobre:${slug(p.nome)}:${extrato.ano}-${periodo.chave}`,
          regra: 'MES_NOBRE',
          severidade: 'warning',
          pessoa: p.nome,
          pessoaExib: nomeExib(p),
          referencia: periodo.chave,
          detalhe: `${fora.length} dia${fora.length !== 1 ? 's' : ''} fora de semana cheia na ${periodo.label} — ${fora.map(fmtBr).join(', ')}`,
        })
      }

      if (periodo.chave === 'jul') {
        const semanasNoPeriodo = new Set(
          noPeriodo.map((d) => segundaDaSemana(d)).filter((seg) => semanasInteiras.has(seg))
        )
        if (semanasNoPeriodo.size > 1) {
          violacoes.push({
            id: `nobre:${slug(p.nome)}:${extrato.ano}-jul-excesso`,
            regra: 'MES_NOBRE',
            severidade: 'warning',
            pessoa: p.nome,
            pessoaExib: nomeExib(p),
            referencia: 'jul',
            detalhe: `${semanasNoPeriodo.size} semanas inteiras em julho (máx. 1 no período nobre)`,
          })
        }
      }
    }
  }
  return violacoes
}

// ============================================================================
// AGREGADOR + FINGERPRINT
// ============================================================================

const ORDEM_SEVERIDADE = { critical: 0, warning: 1 }

// Rótulos curtos p/ UI/notificação/PDF (simplificados a pedido do dono 03/08).
// As CHAVES e os ids das violações não mudam — mudam re-notificaria tudo.
export const REGRA_LABEL = {
  MAX_POR_DIA: 'Mais de 6 no mesmo dia',
  SEG_SEX_ISOLADA: 'Muitas segundas/sextas avulsas',
  COTA_ESTOURADA: 'Acima da cota anual',
  METADE_MEIO_ANO: 'Metade não usada no prazo',
  SEMANAS_INTEIRAS: 'Férias fracionadas demais',
  MES_NOBRE: 'Dia avulso em período nobre',
}

/** Roda todas as regras; critical primeiro, depois por referência. */
export function avaliarRegras(extrato, config = {}) {
  const todas = [
    ...regraMaxPorDia(extrato, config),
    ...regraSegundasSextasIsoladas(extrato, config),
    ...regraCotaEstourada(extrato),
    ...regraMetadeMeioAno(extrato),
    ...regraSemanasInteiras(extrato),
    ...regraMesesNobres(extrato),
  ]
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
