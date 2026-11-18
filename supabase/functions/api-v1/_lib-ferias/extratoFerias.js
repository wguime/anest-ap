// AUTO-GERADO por scripts/gerar-libs-ferias-api-v1.mjs a partir de src/lib/extratoFerias.js
// NÃO EDITAR — edite src/lib/extratoFerias.js e rode o script.
// deno-lint-ignore-file
/**
 * Extrato de Férias — contagem pura sobre os registros do Pega Plantão.
 *
 * Modelo de dados da API: cada registro de férias é UM DIA (plantão com
 * Setor "Férias", Inicio/Fim no mesmo dia). Regras de contagem do grupo
 * (REGRAS ESCALAS.pdf, seções FÉRIAS/FERIADOS):
 *  - fim de semana nunca conta (marcação em FDS é erro → fdsIgnorados);
 *  - feriado marcado só NÃO conta se a pessoa tirou a semana inteira dele
 *    (todos os dias úteis não-feriado da semana marcados);
 *  - datas comparadas como strings ISO (sem new Date() em data pura — a
 *    virada de dia em UTC-3 já causou bug real no módulo de escalas).
 *
 * Sem I/O e sem relógio interno: ano/hoje entram por parâmetro (testável;
 * compatível com resume de workflows).
 */

/**
 * Dia em que as regras de férias 2026/27 passaram a valer (dono 18/11/2026:
 * "valem a partir de agora"; os dados de 2026 não podem mudar). O que é
 * anterior a isto segue a leitura antiga.
 */
export const DATA_REGRAS_NOVAS = '2026-11-18'

// ============================================================================
// HELPERS DE DATA (ISO string in, ISO string out)
// ============================================================================

/** Dia da semana 0=dom..6=sáb de uma data ISO, imune a timezone. */
export function diaDaSemana(dataISO) {
  return new Date(`${dataISO}T12:00:00Z`).getUTCDay()
}

export function ehFimDeSemana(dataISO) {
  const d = diaDaSemana(dataISO)
  return d === 0 || d === 6
}

function somarDias(dataISO, n) {
  const d = new Date(`${dataISO}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Segunda-feira da semana da data (domingo pertence à semana anterior). */
export function segundaDaSemana(dataISO) {
  const dow = diaDaSemana(dataISO)
  return somarDias(dataISO, dow === 0 ? -6 : 1 - dow)
}

/** Dias úteis NÃO-feriado (seg–sex) da semana que começa em segundaISO. */
export function diasUteisDaSemana(segundaISO, feriadosSet) {
  const dias = []
  for (let i = 0; i < 5; i++) {
    const d = somarDias(segundaISO, i)
    if (!feriadosSet.has(d)) dias.push(d)
  }
  return dias
}

// ============================================================================
// NORMALIZAÇÃO DOS REGISTROS DA API
// ============================================================================

const RE_FERIAS = /f[ée]rias/i

/**
 * Plantões crus da API → registros de férias normalizados (1 por dia),
 * dedup por CodigoPlantao. A data sai do slice da string Inicio (horário
 * local da API) — nunca por Date.
 *
 * `criadoEm` = DataCriacao do Pega Plantão (descoberta na sonda 04/08: o
 * payload sempre teve o timestamp da marcação, que o app aproximava por
 * varredura). É a ordem REAL de marcação — usada na regra da 7ª vaga.
 * @returns {Array<{codigo, nome, data, ehFimDeSemana, criadoEm}>}
 */
export function normalizarRegistrosFerias(plantoesRaw = []) {
  const vistos = new Set()
  const out = []
  for (const p of plantoesRaw) {
    if (!p?.Setor || !RE_FERIAS.test(p.Setor)) continue
    const nome = (p.ProfDePlantao || p.ProfFixo || '').trim().toUpperCase()
    if (!nome) continue
    const data = String(p.Inicio || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue
    const codigo = p.CodigoPlantao || `${nome}|${data}`
    if (vistos.has(codigo)) continue
    vistos.add(codigo)
    out.push({
      codigo,
      nome,
      data,
      ehFimDeSemana: ehFimDeSemana(data),
      criadoEm: p.DataCriacao || null,
    })
  }
  return out
}

// ============================================================================
// COTAS (progressão por tempo de grupo)
// ============================================================================

/**
 * Cota anual de dias úteis de férias.
 * anosDeGrupo = anoRef − anoEntrada. 0 → 5 (1º ano) · 1–2 → 20 (2º–3º) ·
 * 3–25 → 30 · depois +1 por ano além do 25º, teto 35 — observação do
 * COTAS_FERIAS_2027.pdf: "após 25 anos de grupo, cada ano a mais soma 1 dia,
 * até o máximo de 35; quem tem 30 anos de grupo tem 35" (antes o app somava
 * a partir do 25º, um ano cedo).
 *
 * `cotaInformada` (regras 2026/27: "cota de cada sócio informada sócio a
 * sócio") vence o cálculo quando existe.
 */
export function calcularCota({ anoEntrada, anoRef, cotaInformada = null }) {
  const anosDeGrupo = anoRef - anoEntrada
  if (Number.isFinite(cotaInformada)) return { cota: cotaInformada, anosDeGrupo, regra: 'cota informada pelo comitê' }
  if (anosDeGrupo <= 0) return { cota: 5, anosDeGrupo, regra: '1º ano de grupo' }
  if (anosDeGrupo <= 2) return { cota: 20, anosDeGrupo, regra: '2º–3º ano de grupo' }
  if (anosDeGrupo <= 25) return { cota: 30, anosDeGrupo, regra: '4º ano em diante' }
  const cota = Math.min(35, 30 + (anosDeGrupo - 25))
  return { cota, anosDeGrupo, regra: 'mais de 25 anos de grupo' }
}

// ============================================================================
// CONTAGEM (regra de feriado + fds)
// ============================================================================

/**
 * Conta os dias de férias de UMA pessoa.
 *
 * Feriado (regras 2026/27, V-11/V-18/V-19): ninguém marca o dia do feriado.
 * Semana com feriado tirada INTEIRA (todos os dias úteis não-feriado) → o
 * feriado não conta. Férias em semana com feriado SEM ser a semana toda → o
 * feriado conta como dia de férias ("paga" 1 dia a mais), esteja ele marcado
 * ou não. Vale para 2026 INTEIRO (dono 18/11/2026: "descontos no saldo podem
 * ser retroativos"); o que passar da cota vai para o ano seguinte
 * (`excessoDoAno`). `desde` (opcional) restringe a cobrança a feriados a
 * partir dessa data — os anteriores só contam se vieram marcados.
 *
 * @param {string[]} diasISO datas marcadas (podem incluir FDS/feriado)
 * @param {Set<string>} feriadosSet
 */
export function contarDias(diasISO = [], feriadosSet = new Set(), { desde = '' } = {}) {
  const marcados = new Set(diasISO)
  const fdsIgnorados = []

  // Semanas: agrupa os dias úteis marcados (feriado incluso) por segunda-feira.
  const porSemana = new Map()
  for (const dia of [...marcados].sort()) {
    if (ehFimDeSemana(dia)) {
      fdsIgnorados.push(dia)
      continue
    }
    const seg = segundaDaSemana(dia)
    if (!porSemana.has(seg)) porSemana.set(seg, [])
    porSemana.get(seg).push(dia)
  }

  const semanas = []
  const diasContaveis = []
  const feriadosContados = []
  const feriadosNaoContados = []

  for (const [segunda, dias] of porSemana) {
    const uteis = diasUteisDaSemana(segunda, feriadosSet)
    const inteira = uteis.length > 0 && uteis.every((d) => marcados.has(d))
    const feriadosDaSemana = []
    for (let i = 0; i < 5; i++) {
      const d = somarDias(segunda, i)
      if (feriadosSet.has(d)) feriadosDaSemana.push(d)
    }
    const naoFeriado = dias.filter((d) => !feriadosSet.has(d))
    diasContaveis.push(...naoFeriado)
    if (inteira) {
      feriadosNaoContados.push(...feriadosDaSemana)
    } else {
      // Paga o feriado da semana (V-19), marcado ou não.
      const pagos = feriadosDaSemana.filter((f) => f >= desde || marcados.has(f))
      feriadosContados.push(...pagos)
      diasContaveis.push(...pagos)
    }
    semanas.push({ segunda, dias, inteira, comFeriado: feriadosDaSemana.length > 0 })
  }

  diasContaveis.sort()
  feriadosContados.sort()
  feriadosNaoContados.sort()
  semanas.sort((x, y) => x.segunda.localeCompare(y.segunda))

  return {
    diasContados: diasContaveis.length,
    diasContaveis,
    feriadosNaoContados,
    feriadosContados,
    fdsIgnorados,
    semanas,
  }
}

/**
 * Agrupa dias marcados (úteis) em períodos de exibição, emendando buracos
 * que sejam só fim de semana e/ou feriado ("13/07–24/07 · 10 dias úteis").
 */
export function agruparPeriodos(diasISO = [], feriadosSet = new Set()) {
  const dias = [...new Set(diasISO)].filter((d) => !ehFimDeSemana(d)).sort()
  const periodos = []
  for (const dia of dias) {
    const atual = periodos[periodos.length - 1]
    if (atual && proximoDiaUtil(atual.fim, feriadosSet) === dia) {
      atual.fim = dia
      atual.diasUteis += 1
    } else {
      periodos.push({ inicio: dia, fim: dia, diasUteis: 1 })
    }
  }
  return periodos
}

/** Próximo dia útil não-feriado depois de dataISO. */
function proximoDiaUtil(dataISO, feriadosSet) {
  let d = somarDias(dataISO, 1)
  while (ehFimDeSemana(d) || feriadosSet.has(d)) d = somarDias(d, 1)
  return d
}

// ============================================================================
// EXTRATO COMPLETO
// ============================================================================

/**
 * Monta o extrato do ano: uma entrada por sócio (mesmo com 0 dias), mapa
 * de ocupação por dia e nomes da API fora da lista de sócios.
 *
 * @param {object} args
 * @param {Array} args.registros saída de normalizarRegistrosFerias
 * @param {number} args.ano
 * @param {Array<{nome, anoEntrada, filhosIdadeEscolar}>} args.socios
 * @param {Set<string>} args.feriados
 */
export function construirExtrato({ registros = [], ano, socios = [], feriados = new Set() }) {
  const diasPorNome = new Map()
  // Quando cada dia foi marcado (DataCriacao do PP ou criado_em do app): as
  // regras de prazo (2 meses nos meses nobres, 30 dias na semana com feriado)
  // dependem disso. Dia com dois registros fica com o mais antigo.
  const marcadoEmPorNome = new Map()
  for (const r of registros) {
    if (!diasPorNome.has(r.nome)) diasPorNome.set(r.nome, [])
    diasPorNome.get(r.nome).push(r.data)
    if (r.criadoEm) {
      if (!marcadoEmPorNome.has(r.nome)) marcadoEmPorNome.set(r.nome, {})
      const m = marcadoEmPorNome.get(r.nome)
      if (!m[r.data] || String(r.criadoEm) < String(m[r.data])) m[r.data] = r.criadoEm
    }
  }

  const nomesSocios = new Set(socios.map((s) => s.nome))

  const porPessoa = socios.map((socio) => {
    const dias = (diasPorNome.get(socio.nome) || []).sort()
    const contagem = contarDias(dias, feriados)
    const { cota, anosDeGrupo, regra } = calcularCota({ anoEntrada: socio.anoEntrada, anoRef: ano, cotaInformada: socio.cota ?? null })

    const porMes = {}
    for (const d of contagem.diasContaveis) {
      const mes = d.slice(0, 7)
      porMes[mes] = (porMes[mes] || 0) + 1
    }

    return {
      nome: socio.nome,
      nomeCompleto: socio.nomeCompleto || socio.nome,
      anoEntrada: socio.anoEntrada,
      filhosIdadeEscolar: socio.filhosIdadeEscolar,
      cota,
      anosDeGrupo,
      regraCota: regra,
      dias,
      diasContados: contagem.diasContados,
      diasContaveis: contagem.diasContaveis,
      feriadosNaoContados: contagem.feriadosNaoContados,
      feriadosContados: contagem.feriadosContados,
      fdsIgnorados: contagem.fdsIgnorados,
      semanas: contagem.semanas,
      saldo: cota - contagem.diasContados,
      periodos: agruparPeriodos(dias, feriados),
      porMes,
      marcadoEm: marcadoEmPorNome.get(socio.nome) || {},
    }
  })

  // Ocupação por dia útil (vagas diárias): todo dia útil MARCADO ocupa vaga,
  // inclusive feriado marcado — a regra das 6 vagas governa a marcação.
  const porDia = new Map()
  for (const r of registros) {
    if (r.ehFimDeSemana) continue
    if (!porDia.has(r.data)) porDia.set(r.data, [])
    porDia.get(r.data).push(r.nome)
  }

  const naoReconhecidosMap = new Map()
  for (const [nome, dias] of diasPorNome) {
    if (!nomesSocios.has(nome)) naoReconhecidosMap.set(nome, dias.length)
  }

  return {
    ano,
    feriadosLista: [...feriados].sort(),
    porPessoa,
    porDia,
    naoReconhecidos: [...naoReconhecidosMap.entries()].map(([nome, dias]) => ({ nome, dias })),
    totalDiasContados: porPessoa.reduce((acc, p) => acc + p.diasContados, 0),
    totalPessoasComFerias: porPessoa.filter((p) => p.diasContados > 0).length,
  }
}
