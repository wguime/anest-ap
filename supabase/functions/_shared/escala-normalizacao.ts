/**
 * Normalização determinística da leitura da escala, no servidor (Onda 4, 4.2).
 *
 * O structured output garante a FORMA do JSON (é um objeto, os campos existem,
 * os enums são os enums). Não garante o CONTEÚDO: `pattern` não é suportado em
 * json_schema, então "01 EDA" continua cabendo num campo de iniciais e "7h30"
 * num campo de hora. Quem garante o conteúdo é este módulo — e é ele que fecha
 * por construção a classe do incidente de 02/09, em que UM paciente com três
 * letras seguidas violou o CHECK do banco e derrubou a publicação da Unimed
 * inteira.
 *
 * A defesa em profundidade continua: `casoToRow` no service aplica
 * `iniciaisSeguras` de novo antes de todo INSERT. A diferença é que agora o
 * valor ruim nem chega à tela da conferência para ser reenviado a cada toque.
 *
 * ⚠️ SALA: aqui só se mexe em espaço em branco. A canonicalização de verdade
 * ("CENTRO CIRÚRGICO - SALA 1" → "CC - Sala 1", a sala do IOSC que o BLOCO
 * corrige) vive em `utils.js` no cliente, roda depois desta e está coberta por
 * teste. Dois normalizadores para o mesmo campo, um de cada lado, é exatamente
 * como "CC - Sala 1" e "Sala 1" viram dois blocos na mesma conferência.
 */

const up = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase()

const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'])

/** Teto do CHECK do banco (char_length <= 12). */
export const INICIAIS_MAX = 12
const TRES_LETRAS = /\p{L}{3,}/u
const INICIAIS_COLADAS = /^\p{Lu}{3,4}\.?$/u

/** Iniciais do paciente (LGPD): "Cleidiani de Souza Gelda" → "C.S.G." (máx. 4). */
export function iniciais(nome: unknown): string {
  const tokens = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  const letras = tokens
    .filter((t) => !PARTICULAS.has(up(t)))
    .map((t) => up(t)[0])
    .filter(Boolean)
    .slice(0, 4)
  return letras.length ? `${letras.join('.')}.` : ''
}

/** O MESMO predicado do CHECK do banco: forma que o INSERT aceita. */
export const ehIniciaisAceitas = (v: unknown): boolean => {
  const s = String(v ?? '').trim()
  return s === '' || (s.length <= INICIAIS_MAX && !TRES_LETRAS.test(s))
}

/**
 * Reduz a iniciais o que ainda não está; o que JÁ está em iniciais fica intacto.
 * Porta EXATA de `src/lib/escalaCirurgicaPaciente.js` — a paridade entre as duas
 * cópias é travada por teste (`escalaNormalizacaoEdge.test.js`). Duas regras de
 * LGPD que divergem em silêncio é pior que uma só no lugar errado.
 */
export function iniciaisSeguras(v: unknown): string {
  const bruto = String(v ?? '').trim()
  if (ehIniciaisAceitas(bruto)) return bruto
  if (INICIAIS_COLADAS.test(bruto)) return `${bruto.replace(/\./g, '').split('').join('.')}.`
  const soNome = bruto
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter((t) => /\p{L}/u.test(t))
    .join(' ')
  const out = iniciais(soNome)
  return ehIniciaisAceitas(out) ? out : ''
}

/** "A SEGUIR"/"À SEGUIR"/"as" — marcador operacional, não hora. */
const SEQUENCIAL = /^(?:AS|A\s+SEGUIR)$/

/**
 * Data colada na frente da hora: "08/09/2026 07:30", "08/09 7h30",
 * "2026-09-08T11:00". A 1ª coluna da planilha da Unimed traz DATA e HORA na
 * mesma célula, e a leitura copia a célula inteira.
 */
const DATA_NA_FRENTE = /^(?:\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{4}-\d{2}-\d{2})[\sT,-]+/

/**
 * Hora em HH:MM. "7:30", "07h30", "0730" e "7" viram "07:30"/"07:00"; o
 * marcador sequencial vira "AS"; o que NÃO dá para interpretar volta como veio.
 *
 * A data que vier junto sai (08/09: 30 cirurgias da Unimed chegaram à
 * conferência com "08/09/2026 07:30" no campo da hora — a validação bloqueava
 * uma a uma e a escala foi publicada sem hora nenhuma). A data já tem campo
 * próprio (`dataDetectada`); aqui só interessa o horário.
 *
 * Devolver o texto original de propósito: hora ilegível é erro de leitura que a
 * conferência precisa MOSTRAR (`validarHorarioImportacao` bloqueia e nomeia a
 * sala). Trocar por vazio esconderia o erro e faria o caso herdar o período.
 */
export function horaCanonica(v: unknown): string {
  const bruto = String(v ?? '').trim()
  if (!bruto) return ''
  const s = up(bruto).replace(/\s+/g, ' ').replace(DATA_NA_FRENTE, '')
  if (SEQUENCIAL.test(s)) return 'AS'
  const m = s.match(/^(\d{1,2})\s*(?:[:H.]\s*|\s)?(\d{2})?(?::\d{2})?\s*H?$/)
  if (!m) return bruto
  const h = Number(m[1])
  const min = m[2] == null ? 0 : Number(m[2])
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return bruto
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Duração ("1:15", "01h15", "2H") em HH:MM. Aceita mais de 23h. */
export function tempoCanonico(v: unknown): string {
  const bruto = String(v ?? '').trim()
  if (!bruto) return ''
  const s = up(bruto).replace(/\s+/g, ' ')
  const m = s.match(/^(\d{1,2})\s*(?:[:H.]\s*|\s)?(\d{2})?\s*H?$/)
  if (!m) return bruto
  const h = Number(m[1])
  const min = m[2] == null ? 0 : Number(m[2])
  if (!Number.isInteger(h) || !Number.isInteger(min) || min > 59) return bruto
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Só espaço em branco — a canonicalização por hospital é do cliente. */
export const salaCanonica = (v: unknown): string =>
  String(v ?? '').replace(/\s+/g, ' ').trim()

interface CasoBruto extends Record<string, unknown> {
  sala?: unknown
  hora?: unknown
  tempoEstimado?: unknown
  pacienteIniciais?: unknown
  procedimento?: unknown
  cirurgiao?: unknown
  anestesista?: unknown
}

export interface ResultadoNormalizacao<T> {
  casos: T[]
  contagem: Record<string, number>
}

/**
 * Aplica as normalizações e devolve, junto, QUANTAS vezes cada uma precisou
 * agir. A contagem vai para `escala_leitura_log.normalizacoes` e separa duas
 * coisas que a auditoria tratava como uma: quanto o modelo erra de FORMA (isto
 * aqui conserta) e quanto erra de CONTEÚDO (só o gabarito do eval mede).
 */
export function normalizarCasos<T extends CasoBruto>(casos: T[]): ResultadoNormalizacao<T> {
  const contagem: Record<string, number> = {}
  const conta = (k: string) => { contagem[k] = (contagem[k] || 0) + 1 }

  const normalizados = (casos || []).map((c) => {
    const sala = salaCanonica(c.sala)
    const hora = horaCanonica(c.hora)
    const tempo = tempoCanonico(c.tempoEstimado)
    const ini = iniciaisSeguras(c.pacienteIniciais)
    if (sala !== String(c.sala ?? '')) conta('sala')
    if (hora !== String(c.hora ?? '').trim()) conta('hora')
    if (tempo !== String(c.tempoEstimado ?? '').trim()) conta('tempo')
    if (ini !== String(c.pacienteIniciais ?? '').trim()) conta('iniciais')
    return { ...c, sala, hora, tempoEstimado: tempo, pacienteIniciais: ini }
  })

  // DEDUPE: a mesma linha lida duas vezes acontece quando o modelo repete um
  // bloco. Só cai fora o que é idêntico em TODOS os campos que identificam a
  // cirurgia — duas cataratas às 08:00 na mesma sala com pacientes diferentes
  // continuam sendo duas cirurgias.
  const vistos = new Set<string>()
  const unicos: T[] = []
  for (const c of normalizados) {
    const chave = [c.sala, c.hora, c.pacienteIniciais, c.procedimento, c.cirurgiao, c.anestesista]
      .map((v) => up(v)).join('|')
    if (chave.replace(/\|/g, '') && vistos.has(chave)) { conta('duplicada'); continue }
    vistos.add(chave)
    unicos.push(c as T)
  }

  // ORDEM sai do modelo e passa a ser POSIÇÃO dentro da sala. O modelo devolvia
  // um índice que ninguém conferia; a posição é derivável e não pode divergir
  // do que a tela mostra.
  const porSala = new Map<string, number>()
  const comOrdem = unicos.map((c) => {
    const k = up(c.sala)
    const n = porSala.get(k) ?? 0
    porSala.set(k, n + 1)
    if (Number(c.ordem) !== n) conta('ordem')
    return { ...c, ordem: n }
  })

  return { casos: comOrdem as T[], contagem }
}
