/**
 * Parser de Excel da escala cirúrgica (Unimed) — puro, calibrável.
 *
 * O export do hospital NÃO traz o anestesista (a secretária atribui depois). Este
 * parser extrai a base cirúrgica (sala/hora/paciente→iniciais/procedimento/cirurgião/
 * convênio/tempo) de qualquer planilha, detectando a linha de cabeçalho e casando
 * colunas por nome (acento/caixa-insensível). A tela de conferência corrige o resto.
 *
 * LGPD: paciente é convertido para INICIAIS na importação (nome completo nunca é guardado).
 *
 * ⚠️ Calibração: os aliases de cabeçalho abaixo cobrem os nomes mais comuns; ao receber
 * o Excel real da Unimed, ajuste HEADER_ALIASES às colunas exatas.
 */
import * as XLSX from 'xlsx'

import { iniciais } from './escalaCirurgicaPaciente'

const up = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

// `iniciais` mora em `escalaCirurgicaPaciente.js` (puro, sem `xlsx`) para o
// service poder sanitizar na fronteira do banco; segue exportada daqui.
export { iniciais }

const HEADER_ALIASES = {
  sala: ['SALA', 'CENTRO CIRURGICO', 'CC'],
  hora: ['HORA', 'HORARIO', 'INICIO', 'DATA/HORA'],
  idade: ['IDADE'],
  paciente: ['PACIENTE', 'NOME DO PACIENTE', 'NOME'],
  procedimento: ['PROCEDIMENTO', 'CIRURGIA', 'PROC', 'DESCRICAO'],
  tempo: ['TEMPO', 'DURACAO', 'PREVISAO'],
  cirurgiao: ['CIRURGIAO', 'MEDICO', 'MEDICO CIRURGIAO', 'PROFISSIONAL'],
  convenio: ['CONVENIO', 'PLANO', 'CARTEIRA'],
  anestesista: ['ANEST', 'ANESTESISTA'],
}

/** Encontra o índice da coluna cujo cabeçalho casa um dos aliases do campo. */
function acharColuna(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = up(headers[i])
    if (!h) continue
    if (aliases.some((a) => h === a || h.includes(a))) return i
  }
  return -1
}

/** Detecta a linha de cabeçalho: a que casa mais campos conhecidos. */
function detectarHeader(matrix) {
  let best = { idx: -1, score: 0 }
  const limite = Math.min(matrix.length, 15)
  for (let r = 0; r < limite; r++) {
    const row = matrix[r] || []
    let score = 0
    for (const aliases of Object.values(HEADER_ALIASES)) {
      if (acharColuna(row, aliases) >= 0) score++
    }
    if (score > best.score) best = { idx: r, score }
  }
  return best
}

/**
 * Faz parse da primeira aba do Excel para casos da escala (sem anestesista).
 * @param {File|ArrayBuffer} input
 * @returns {Promise<{casos:Array, headerScore:number}>}
 */
export async function parseExcelEscala(input) {
  const buf = input instanceof ArrayBuffer ? input : await input.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  if (!matrix.length) return { casos: [], headerScore: 0 }

  const header = detectarHeader(matrix)
  if (header.idx < 0) return { casos: [], headerScore: 0 }

  const headers = matrix[header.idx]
  const col = {}
  for (const [campo, aliases] of Object.entries(HEADER_ALIASES)) {
    col[campo] = acharColuna(headers, aliases)
  }

  const casos = []
  let salaAtual = ''
  let ordem = 0
  const get = (row, c) => (c >= 0 ? String(row[c] ?? '').trim() : '')

  for (let r = header.idx + 1; r < matrix.length; r++) {
    const row = matrix[r] || []
    const sala = get(row, col.sala)
    const paciente = get(row, col.paciente)
    const procedimento = get(row, col.procedimento)
    // linha de seção (só a sala preenchida) → fixa a sala corrente (carry-down)
    if (sala && !paciente && !procedimento) {
      salaAtual = sala
      ordem = 0
      continue
    }
    if (!paciente && !procedimento && !get(row, col.cirurgiao)) continue // linha vazia
    const convenio = get(row, col.convenio)
    casos.push({
      sala: sala || salaAtual,
      ordem: ordem++,
      hora: get(row, col.hora),
      pacienteIniciais: iniciais(paciente),
      // LGPD: nome completo SÓ p/ convênio PURAMENTE particular — pré-preenche
      // a COBRANÇA (cirurgias_particulares); nunca vai p/ a escala (CASO_FIELDS
      // filtra + CHECK rejeita). Composto ("PART/SC") é ambíguo → não extrai
      // (regra do dono 2026-07-22; espelho de familiaConvenio/fn_convenio_particular).
      pacienteNome: /^PART(ICULAR)?[^A-Z]*$/.test(String(convenio || '').trim().toUpperCase()) ? String(paciente || '').trim() : '',
      idade: get(row, col.idade),
      procedimento,
      cirurgiao: get(row, col.cirurgiao),
      convenio,
      tempoEstimado: get(row, col.tempo),
      anestesista: get(row, col.anestesista), // escala pronta traz o apelido (pré-atribuição via dicionário); export cru vem vazio
      bloco: 'normal',
      isContinuacao: /^\s*continua[çc]/i.test(procedimento), // ancorado: "Continuação" no início (não "sutura contínua")
      semAnestesista: false,
      tipo: /emerg/i.test(procedimento) ? 'emergencia' : /urgenc/i.test(procedimento) ? 'urgencia' : 'eletiva',
    })
  }
  // `headers` sai junto porque o cabeçalho DIZ de quem é a planilha: só o mapa
  // do HRO tem coluna LEITO, só o export da Unimed tem IDADE e TEMPO
  // (`escalaHospitalEstrutura.js`, dono 30/08).
  return { casos, headerScore: header.score, headers: headers.map((h) => String(h ?? '')) }
}
