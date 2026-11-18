// AUTO-GERADO por scripts/gerar-libs-ferias-api-v1.mjs a partir de src/lib/feriasSemestre.js
// NÃO EDITAR — edite src/lib/feriasSemestre.js e rode o script.
// deno-lint-ignore-file
/**
 * Metades do ano no Extrato de Férias — regras de férias 2026/27 (comitê de
 * escalas; valem desde 18/11/2026, decisão do dono).
 *
 * V-02: a cota é dividida meio a meio por semestre; cada semestre aceita até
 * a metade ARREDONDADA PARA CIMA (31 = 16 + 15 ou 15 + 16) e o total do ano
 * não passa da cota. V-03: os dias de cada semestre são usados dentro dele —
 * até 30/06 no 1º e até 31/12 no 2º, prazo IGUAL para todos (o corte de 31/07
 * para quem tem filhos acabou). Dia não usado é perdido.
 *
 * Antes (dono 19/08) o 1º semestre tinha PISO e só o 2º tinha TETO; agora os
 * dois lados têm o mesmo teto, e é ele que a marcação bloqueia.
 *
 * 1º ano (cota 5) continua exceção: escolhe o semestre, e os 5 dias são uma
 * semana de segunda a sexta sem feriado (V-06; semana com feriado só com
 * aprovação do comitê).
 *
 * Puro: sem I/O, sem relógio; datas entram e saem como string ISO.
 */

import { agruparPeriodos } from './extratoFerias.js'

/** Cota do 1º ano de grupo — 1 semana, com regra própria. */
export const COTA_PRIMEIRO_ANO = 5

/** Último dia do 1º semestre — 30/06 para todos (V-03). */
export function corteSemestre({ ano }) {
  return `${ano}-06-30`
}

/** Semestre de uma data ISO: 'S1' até 30/06, 'S2' depois. */
export const semestreDe = (dataISO) => (dataISO.slice(5, 7) <= '06' ? 'S1' : 'S2')

/**
 * Teto de cada semestre (V-02): metade da cota arredondada para cima.
 * @returns {{maxSemestre:number, semestreLivre:boolean}}
 */
export function metadesDaCota(cota = 0) {
  if (cota <= COTA_PRIMEIRO_ANO) return { maxSemestre: cota, semestreLivre: true }
  return { maxSemestre: Math.ceil(cota / 2), semestreLivre: false }
}

/**
 * Mínimo de semanas cheias no semestre (V-06), pela parte da cota que cabe
 * nele: 5 dias = tudo em semana cheia (1 semana) · 10 = 1 semana · 15 a 18 =
 * 2 semanas. Para valores fora da tabela (cota informada atípica) vale a
 * faixa: até 14 dias = 1 semana, 15 ou mais = 2.
 */
export function semanasCheiasMinimas(diasNoSemestre = 0) {
  if (diasNoSemestre <= 0) return 0
  return diasNoSemestre >= 15 ? 2 : 1
}

/**
 * A semana do 1º ano está certa? Exige UMA única semana, INTEIRA e sem
 * feriado (V-06: "uma semana de segunda a sexta sem feriado; semana com
 * feriado só com aprovação do comitê").
 * @returns {{cumprida:boolean, semanas:number, dias:number, motivo:'sem_marcacao'|'fracionada'|'varias_semanas'|'com_feriado'|null}}
 */
export function semanaCorridaPrimeiroAno(pessoa, feriados = new Set()) {
  const semanas = pessoa?.semanas || []
  const dias = semanas.reduce((acc, s) => acc + s.dias.length, 0)
  if (semanas.length === 0) return { cumprida: false, semanas: 0, dias: 0, motivo: 'sem_marcacao' }
  if (semanas.length > 1) return { cumprida: false, semanas: semanas.length, dias, motivo: 'varias_semanas' }
  if (!semanas[0].inteira) return { cumprida: false, semanas: 1, dias, motivo: 'fracionada' }
  if (temFeriadoNaSemana(semanas[0].segunda, feriados)) return { cumprida: false, semanas: 1, dias, motivo: 'com_feriado' }
  return { cumprida: true, semanas: 1, dias, motivo: null }
}

function temFeriadoNaSemana(segundaISO, feriados) {
  const d = new Date(`${segundaISO}T12:00:00Z`)
  for (let i = 0; i < 5; i++) {
    if (feriados.has(d.toISOString().slice(0, 10))) return true
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return false
}

/**
 * Dias que ainda cabem no semestre — o número que a marcação consulta.
 * Cota do 1º ano é livre entre os semestres → Infinity (o teto é a cota).
 */
export function vagasRestantesNoSemestre({ cota = 0, diasNoSemestre = 0 }) {
  const { maxSemestre, semestreLivre } = metadesDaCota(cota)
  if (semestreLivre) return Infinity
  return Math.max(0, maxSemestre - diasNoSemestre)
}

/**
 * Extrato de UMA pessoa dividido pelas duas metades do ano.
 *
 * O total de cada metade é o que conta CONTRA A COTA: dias contáveis
 * (feriado de semana inteira já fora) + os dias extras da 7ª vaga que
 * caíram naquele semestre — é assim que a página soma o ano, e as duas
 * contas têm de fechar.
 *
 * Os períodos são reagrupados DENTRO de cada metade (e não filtrados da
 * lista anual) para que um bloco que atravessa o corte apareça partido nos
 * dois lados, com os dias certos de cada um.
 *
 * @param {object} pessoa entrada de `construirExtrato().porPessoa`
 * @param {object} opts
 * @param {number} opts.ano
 * @param {Set<string>} opts.feriados
 * @param {Array<{data:string, diasExtras:number}>} opts.penalidades da 7ª vaga
 */
export function resumoSemestres(pessoa, { ano, feriados = new Set(), penalidades = [] } = {}) {
  const corte = corteSemestre({ ano })
  const cota = pessoa?.cota ?? 0
  const { maxSemestre, semestreLivre } = metadesDaCota(cota)

  const noPrimeiro = (d) => d <= corte
  const somaPenal = (filtro) =>
    penalidades.filter((p) => filtro(p.data)).reduce((acc, p) => acc + (p.diasExtras || 0), 0)

  const montar = (filtro, chave, label) => {
    const dias = (pessoa?.dias || []).filter(filtro)
    const contados = (pessoa?.diasContaveis || []).filter(filtro).length
    const penalidade = somaPenal(filtro)
    const total = contados + penalidade
    return {
      chave,
      label,
      dias,
      periodos: agruparPeriodos(dias, feriados),
      contados,
      penalidade,
      total,
      maximo: maxSemestre,
      restante: semestreLivre ? Infinity : Math.max(0, maxSemestre - total),
      excede: semestreLivre ? 0 : Math.max(0, total - maxSemestre),
      ok: semestreLivre || total <= maxSemestre,
    }
  }

  return {
    corte,
    semestreLivre,
    cota,
    primeiroAno: semestreLivre ? semanaCorridaPrimeiroAno(pessoa, feriados) : null,
    s1: montar(noPrimeiro, 's1', '1º semestre'),
    s2: montar((d) => !noPrimeiro(d), 's2', '2º semestre'),
  }
}

/**
 * Uma linha de análise do grupo (export PDF/Excel): quanto cada sócio já
 * usufruiu e quanto ainda tem agendado em cada metade do ano.
 *
 * O 2º semestre vem QUEBRADO em usufruído × agendado porque é a pergunta
 * de quem coordena — o que já foi não volta, o que está agendado ainda dá
 * para remanejar. O 1º semestre não ganha a quebra: depois do corte tudo
 * nele é passado (e antes do corte a distinção não muda decisão nenhuma).
 *
 * `usufruído` usa os dias CONTÁVEIS (feriado de semana inteira já fora),
 * então usufruído + agendado fecha com `contados`; a penalidade da 7ª vaga
 * entra só no total, que é o número que a regra compara com a metade.
 */
export function linhaAnaliseSemestre(pessoa, { ano, feriados = new Set(), hojeISO }) {
  const r = resumoSemestres(pessoa, { ano, feriados, penalidades: pessoa?.penalidades || [] })
  const contaveis = new Set(pessoa?.diasContaveis || [])
  const parte = (dias, passado) =>
    dias.filter((d) => contaveis.has(d) && (passado ? d < hojeISO : d >= hojeISO)).length

  // ⚠️ nada de sinal de menos tipográfico (−, U+2212) aqui: o PDF é WinAnsi
  // e o caractere SUMIA — "1º sem. −4" virava "1º sem. 4", que se lê como o
  // valor em vez do que falta. Palavra em vez de símbolo resolve de vez.
  // (º e acento passam: estão no Latin-1.)
  const situacao = r.semestreLivre
    ? (r.primeiroAno?.cumprida ? 'Semana corrida' : 'Semana fracionada')
    : [
        r.s1.excede > 0 ? `${r.s1.excede} a mais no 1º` : null,
        r.s2.excede > 0 ? `${r.s2.excede} a mais no 2º` : null,
      ].filter(Boolean).join(' · ') || 'Dentro da regra'

  // Frase do 1º ano: "não cumpriu" sem dizer o QUE está errado obriga a abrir
  // o extrato da pessoa para descobrir. O detalhe cabe numa coluna.
  const pa = r.primeiroAno
  const primeiroAnoDetalhe = !pa
    ? null
    : pa.cumprida
      ? 'Uma semana corrida, de segunda a sexta'
      : pa.motivo === 'varias_semanas'
        ? `${pa.dias} dias repartidos em ${pa.semanas} semanas diferentes`
        : pa.motivo === 'fracionada'
          ? `${pa.dias} dia${pa.dias !== 1 ? 's' : ''} avulso${pa.dias !== 1 ? 's' : ''} numa semana só — falta fechar a semana`
          : pa.motivo === 'com_feriado'
            ? 'Semana com feriado — só vale com aprovação do comitê'
            : 'Sem férias marcadas no ano'

  return {
    nome: pessoa.nome,
    nomeCompleto: pessoa.nomeCompleto || pessoa.nome,
    primeiroAnoDetalhe,
    anoEntrada: pessoa.anoEntrada,
    cota: r.cota,
    semestreLivre: r.semestreLivre,
    s1Total: r.s1.total,
    s1Maximo: r.s1.maximo,
    s1Excede: r.s1.excede,
    s1Usufruido: parte(r.s1.dias, true),
    s1Agendado: parte(r.s1.dias, false),
    // Penalidade POR SEMESTRE, não só do ano: sem ela a linha não fecha na
    // tabela (já tirou 5 + ainda vai tirar 10 mostrando total 17 faz o leitor
    // procurar o erro que não existe — os 2 que faltam são a 7ª vaga).
    s1Penalidade: r.s1.penalidade,
    s2Total: r.s2.total,
    s2Maximo: r.s2.maximo,
    s2Excede: r.s2.excede,
    s2Usufruido: parte(r.s2.dias, true),
    s2Agendado: parte(r.s2.dias, false),
    s2Penalidade: r.s2.penalidade,
    penalidade: pessoa.diasPenalidade || 0,
    total: pessoa.diasEfetivos ?? pessoa.diasContados,
    saldo: pessoa.saldo,
    situacao,
  }
}
