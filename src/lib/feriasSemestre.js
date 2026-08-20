/**
 * Metades do ano no Extrato de Férias — REGRAS ESCALAS.pdf (seção FÉRIAS)
 * + decisões do dono em 19/08.
 *
 * O documento diz duas coisas que só fazem sentido juntas: "é necessário
 * que metade dos dias sejam usufruídos até final de junho (ou final de
 * julho para colegas com filhos em idade escolar)" e "os dias de férias
 * não usufruídos em cada semestre serão perdidos". Dono 19/08: a metade é
 * metade da COTA — pode-se usar MAIS que a metade no 1º semestre, nunca
 * mais que a metade no 2º. Por isso o 2º semestre tem TETO (`maxS2`), e é
 * esse teto que o app impede de estourar na hora de marcar; o 1º semestre
 * tem PISO (`minS1`), que o app só mostra (o dia que passou não volta).
 *
 * 1º ano (cota 5) é exceção nos dois eixos: o PDF deixa a semana livre
 * entre os semestres ("colegas no primeiro ano poderão usufruir no
 * primeiro ou segundo semestre, conforme queiram") e o dono fechou que ela
 * tem de ser CORRIDA — segunda a sexta, sem fracionar.
 *
 * A fronteira dos semestres é o CORTE (30/06, ou 31/07 para quem tem
 * filhos em idade escolar): é a data da regra, não a metade do calendário.
 * Hoje `filhosIdadeEscolar` é null para todos em feriasSocios.js, então o
 * corte cai em 30/06 e "1º semestre" é literal.
 *
 * Puro: sem I/O, sem relógio; datas entram e saem como string ISO.
 */

import { agruparPeriodos } from './extratoFerias'

/** Cota do 1º ano de grupo — 1 semana, com regra própria. */
export const COTA_PRIMEIRO_ANO = 5

/**
 * Último dia que conta para a metade do 1º semestre.
 * `filhosIdadeEscolar` true estende o prazo a 31/07 (PDF); null/false = 30/06.
 */
export function corteSemestre({ ano, filhosIdadeEscolar = null }) {
  return filhosIdadeEscolar ? `${ano}-07-31` : `${ano}-06-30`
}

/**
 * Piso do 1º semestre e teto do 2º. Cota ímpar sobra para o 1º semestre
 * (é o lado que pode receber mais — "nunca mais que a metade" só limita o 2º).
 * @returns {{minS1:number, maxS2:number, semestreLivre:boolean}}
 */
export function metadesDaCota(cota = 0) {
  if (cota <= COTA_PRIMEIRO_ANO) return { minS1: 0, maxS2: cota, semestreLivre: true }
  return { minS1: Math.ceil(cota / 2), maxS2: Math.floor(cota / 2), semestreLivre: false }
}

/**
 * A semana do 1º ano está corrida? Exige UMA única semana e ela INTEIRA —
 * `semanas[].inteira` já compara contra os dias úteis não-feriado, então
 * feriado no meio não descaracteriza a semana cheia.
 * @returns {{cumprida:boolean, semanas:number, dias:number, motivo:'sem_marcacao'|'fracionada'|'varias_semanas'|null}}
 */
export function semanaCorridaPrimeiroAno(pessoa) {
  const semanas = pessoa?.semanas || []
  const dias = semanas.reduce((acc, s) => acc + s.dias.length, 0)
  if (semanas.length === 0) return { cumprida: false, semanas: 0, dias: 0, motivo: 'sem_marcacao' }
  if (semanas.length > 1) return { cumprida: false, semanas: semanas.length, dias, motivo: 'varias_semanas' }
  if (!semanas[0].inteira) return { cumprida: false, semanas: 1, dias, motivo: 'fracionada' }
  return { cumprida: true, semanas: 1, dias, motivo: null }
}

/**
 * Dias que ainda cabem no 2º semestre — o número que a marcação consulta.
 * Cota do 1º ano é livre entre os semestres → Infinity (nada a bloquear).
 */
export function vagasRestantesSegundoSemestre({ cota = 0, diasNoSegundo = 0 }) {
  const { maxS2, semestreLivre } = metadesDaCota(cota)
  if (semestreLivre) return Infinity
  return Math.max(0, maxS2 - diasNoSegundo)
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
  const corte = corteSemestre({ ano, filhosIdadeEscolar: pessoa?.filhosIdadeEscolar })
  const cota = pessoa?.cota ?? 0
  const { minS1, maxS2, semestreLivre } = metadesDaCota(cota)

  const noPrimeiro = (d) => d <= corte
  const somaPenal = (filtro) =>
    penalidades.filter((p) => filtro(p.data)).reduce((acc, p) => acc + (p.diasExtras || 0), 0)

  const montar = (filtro) => {
    const dias = (pessoa?.dias || []).filter(filtro)
    const contados = (pessoa?.diasContaveis || []).filter(filtro).length
    const penalidade = somaPenal(filtro)
    return {
      dias,
      periodos: agruparPeriodos(dias, feriados),
      contados,
      penalidade,
      total: contados + penalidade,
    }
  }

  const base1 = montar(noPrimeiro)
  const base2 = montar((d) => !noPrimeiro(d))

  const s1 = {
    ...base1,
    chave: 's1',
    label: '1º semestre',
    minimo: minS1,
    // Falta é o que ainda cabe no piso; excedente é o que passou dele (permitido).
    falta: Math.max(0, minS1 - base1.total),
    excedente: Math.max(0, base1.total - minS1),
    ok: base1.total >= minS1,
  }

  const s2 = {
    ...base2,
    chave: 's2',
    label: '2º semestre',
    maximo: maxS2,
    restante: semestreLivre ? Infinity : Math.max(0, maxS2 - base2.total),
    excede: semestreLivre ? 0 : Math.max(0, base2.total - maxS2),
    ok: semestreLivre || base2.total <= maxS2,
  }

  return {
    corte,
    prazoEstendido: Boolean(pessoa?.filhosIdadeEscolar),
    semestreLivre,
    cota,
    primeiroAno: semestreLivre ? semanaCorridaPrimeiroAno(pessoa) : null,
    s1,
    s2,
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
        r.s1.falta > 0 ? `faltam ${r.s1.falta} no 1º` : null,
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
          : 'Sem férias marcadas no ano'

  return {
    nome: pessoa.nome,
    nomeCompleto: pessoa.nomeCompleto || pessoa.nome,
    primeiroAnoDetalhe,
    anoEntrada: pessoa.anoEntrada,
    cota: r.cota,
    semestreLivre: r.semestreLivre,
    s1Total: r.s1.total,
    s1Minimo: r.s1.minimo,
    s1Falta: r.s1.falta,
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
