/**
 * Rascunho DURÁVEL da conferência em lote (Onda 2 da auditoria de 02/09; audit A7).
 *
 * A conferência vivia só na memória do React, e o app se recarrega sozinho: `pwaUpdate`
 * recarrega ao voltar do 2º plano quando houve deploy (3 a 5 por dia na janela da escala
 * da tarde) e a cada 15 min com a página visível. Some a isso o "Cancelar" sem
 * confirmação, o gesto da borda e o iOS matando a PWA — é a explicação mais provável de
 * "várias vezes as alterações não persistem".
 *
 * O que este módulo faz, e só isso: serializa, restaura e expira o rascunho de UM lote
 * (data + turno), em `localStorage`, na chave `escala-lote:<data>:<turno>`. É puro e
 * injetável (storage, relógio, timers) para ser testável sem React.
 *
 * O que ele guarda: o RESULTADO da leitura (`lido` — o que a Vision/planilha devolveu, já
 * com a identidade `_lid` de cada linha) e o TRABALHO da secretária (casos editados,
 * atribuições, rodapé, ajuda, decisões). NUNCA a imagem: `montarRascunho` arranca
 * qualquer File/Blob e qualquer string que pareça conteúdo binário. O rascunho é por
 * APARELHO — a publicação continua sendo a fonte da verdade; nada aqui sincroniza.
 *
 * `escalaPublicadaUpdatedAt` por hospital é o que permite avisar, ao restaurar, que a
 * escala publicada mudou DEPOIS do rascunho (outro aparelho publicou, ou a equipe
 * marcou liberações): publicar por cima seria apagar isso.
 */

export const VERSAO_RASCUNHO = 1
export const VALIDADE_RASCUNHO_MS = 24 * 60 * 60 * 1000
export const PREFIXO_RASCUNHO = 'escala-lote:'

const TURNOS = ['matutino', 'vespertino']
const ehISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
// Chaves que nunca entram no rascunho: são o arquivo, ou a imagem em qualquer roupa.
const CHAVES_PROIBIDAS = new Set(['arquivo', 'file', 'files', 'imagem', 'image', 'imageBase64', 'base64', 'dataUrl', 'blob'])
// String grande demais para ser dado de escala — só imagem chega a isso.
const LIMITE_STRING = 20000

/** Chave do rascunho de um lote. `''` quando data ou turno não são válidos. */
export function chaveRascunho(data, turno) {
  if (!ehISO(data) || !TURNOS.includes(turno)) return ''
  return `${PREFIXO_RASCUNHO}${data}:${turno}`
}

/** Lê data e turno de volta de uma chave; `null` se não for uma chave nossa. */
export function decodificarChaveRascunho(chave) {
  const m = /^escala-lote:(\d{4}-\d{2}-\d{2}):(matutino|vespertino)$/.exec(String(chave || ''))
  return m ? { data: m[1], turno: m[2] } : null
}

const ehBinario = (v) => (
  (typeof Blob !== 'undefined' && v instanceof Blob)
  || (typeof ArrayBuffer !== 'undefined' && (v instanceof ArrayBuffer || ArrayBuffer.isView(v)))
)

/**
 * Cópia JSON-segura sem nada binário. Map/Set viram lista/objeto, funções e `undefined`
 * somem — o que sobrevive é exatamente o que `JSON.stringify` gravaria, já sem a imagem.
 */
export function limparParaRascunho(valor) {
  if (valor == null) return valor
  if (typeof valor === 'string') {
    if (valor.length > LIMITE_STRING || /^data:/i.test(valor)) return undefined
    return valor
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (typeof valor === 'function' || ehBinario(valor)) return undefined
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? undefined : valor.toISOString()
  if (valor instanceof Set) return [...valor].map(limparParaRascunho).filter((x) => x !== undefined)
  if (valor instanceof Map) valor = Object.fromEntries(valor)
  if (Array.isArray(valor)) return valor.map((x) => { const y = limparParaRascunho(x); return y === undefined ? null : y })
  if (typeof valor === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(valor)) {
      if (CHAVES_PROIBIDAS.has(k)) continue
      const y = limparParaRascunho(v)
      if (y !== undefined) out[k] = y
    }
    return out
  }
  return undefined
}

/**
 * Monta o rascunho a partir do estado do lote. `null` quando não há o que guardar
 * (nenhum hospital lido): rascunho vazio restaurado seria uma faixa sem conteúdo.
 *
 * @param {Object} p
 * @param {string} p.data          ISO do lote
 * @param {string} p.turno         'matutino' | 'vespertino'
 * @param {Object} p.hospitais     hospital -> { lido, trabalho, escalaPublicadaUpdatedAt }
 * @param {Object} [p.decisoes]    decisões de duplicidade do lote
 * @param {Object} [p.trocas]      parceiro escolhido por decisão
 * @param {string[]} [p.publicados] hospitais que já subiram neste lote
 * @param {string|null} [p.abaAtiva]
 * @param {string} [p.criadoEm]    ISO do rascunho anterior (mantido entre gravações)
 */
export function montarRascunho({
  data, turno, hospitais, decisoes = {}, trocas = {}, publicados = [], abaAtiva = null, criadoEm = null,
} = {}, { agora = Date.now() } = {}) {
  if (!chaveRascunho(data, turno)) return null
  const entradas = Object.entries(hospitais || {}).filter(([, v]) => v && v.lido)
  if (!entradas.length) return null
  const agoraIso = new Date(agora).toISOString()
  const hosp = {}
  for (const [h, v] of entradas) {
    hosp[h] = limparParaRascunho({
      lido: v.lido,
      trabalho: v.trabalho || null,
      escalaPublicadaUpdatedAt: v.escalaPublicadaUpdatedAt || null,
    })
  }
  return {
    versao: VERSAO_RASCUNHO,
    data,
    turno,
    criadoEm: criadoEm && !Number.isNaN(Date.parse(criadoEm)) ? criadoEm : agoraIso,
    atualizadoEm: agoraIso,
    hospitais: hosp,
    decisoes: limparParaRascunho(decisoes) || {},
    trocas: limparParaRascunho(trocas) || {},
    publicados: Array.isArray(publicados) ? publicados.filter((x) => typeof x === 'string') : [],
    abaAtiva: typeof abaAtiva === 'string' ? abaAtiva : null,
  }
}

export function serializarRascunho(rascunho) {
  try { return JSON.stringify(rascunho) } catch { return null }
}

export function rascunhoExpirado(rascunho, agora = Date.now()) {
  const t = Date.parse(rascunho?.atualizadoEm || '')
  if (Number.isNaN(t)) return true
  return agora - t > VALIDADE_RASCUNHO_MS
}

/**
 * Valida o que veio do storage. Versão desconhecida, forma estranha ou rascunho velho
 * NÃO restauram — restaurar torto seria pior do que perder: a secretária confiaria numa
 * conferência que não é a dela.
 */
export function restaurarRascunho(bruto, { agora = Date.now() } = {}) {
  if (bruto == null || bruto === '') return { ok: false, motivo: 'vazio' }
  let r = bruto
  if (typeof bruto === 'string') {
    try { r = JSON.parse(bruto) } catch { return { ok: false, motivo: 'invalido' } }
  }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { ok: false, motivo: 'invalido' }
  if (r.versao !== VERSAO_RASCUNHO) return { ok: false, motivo: 'versao' }
  if (!chaveRascunho(r.data, r.turno)) return { ok: false, motivo: 'invalido' }
  if (rascunhoExpirado(r, agora)) return { ok: false, motivo: 'expirado' }
  const hospitais = r.hospitais && typeof r.hospitais === 'object' ? r.hospitais : {}
  const validos = Object.entries(hospitais).filter(([, v]) => v && typeof v === 'object' && v.lido && typeof v.lido === 'object')
  if (!validos.length) return { ok: false, motivo: 'sem_hospitais' }
  return {
    ok: true,
    rascunho: {
      ...r,
      hospitais: Object.fromEntries(validos),
      decisoes: r.decisoes && typeof r.decisoes === 'object' ? r.decisoes : {},
      trocas: r.trocas && typeof r.trocas === 'object' ? r.trocas : {},
      publicados: Array.isArray(r.publicados) ? r.publicados.filter((x) => typeof x === 'string') : [],
      abaAtiva: typeof r.abaAtiva === 'string' ? r.abaAtiva : null,
    },
  }
}

export function hospitaisDoRascunho(rascunho) {
  return Object.keys(rascunho?.hospitais || {})
}

/**
 * A escala publicada de `hospital` mudou DEPOIS do rascunho?
 *
 * Compara o `updated_at` atual com o que o rascunho viu por último. Quando o rascunho
 * nunca viu escala publicada (não havia, ou a busca não tinha voltado), vale a criação
 * do rascunho como referência: escala publicada depois disso é mais nova que ele.
 */
export function escalaMudouDepoisDoRascunho(rascunho, hospital, updatedAtAtual) {
  const atual = Date.parse(updatedAtAtual || '')
  if (Number.isNaN(atual)) return false
  const visto = Date.parse(rascunho?.hospitais?.[hospital]?.escalaPublicadaUpdatedAt || '')
  if (!Number.isNaN(visto)) return atual > visto
  const criado = Date.parse(rascunho?.criadoEm || '')
  if (Number.isNaN(criado)) return false
  return atual > criado
}

/** "12:41" no mesmo dia; "ontem às 22:41" quando o rascunho é de outro dia. */
export function descreverMomentoRascunho(rascunho, agora = Date.now()) {
  const t = new Date(rascunho?.atualizadoEm || NaN)
  if (Number.isNaN(t.getTime())) return ''
  const hora = t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date(agora)
  const mesmoDia = t.getFullYear() === hoje.getFullYear() && t.getMonth() === hoje.getMonth() && t.getDate() === hoje.getDate()
  if (mesmoDia) return hora
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
  const ehOntem = t.getFullYear() === ontem.getFullYear() && t.getMonth() === ontem.getMonth() && t.getDate() === ontem.getDate()
  return ehOntem ? `ontem às ${hora}` : `${t.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`
}

// ── STORAGE ───────────────────────────────────────────────────────────────────────
// localStorage e não IndexedDB: o rascunho é texto (30–80 KB, sem imagem), a API é
// síncrona — o que importa no `pagehide` do iOS, onde não há tempo para uma transação —
// e jsdom a tem de fábrica. Tudo em try/catch: modo privado e quota cheia não podem
// derrubar a conferência.

function storagePadrao() {
  try { return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null } catch { return null }
}

export function gravarRascunho(chave, rascunho, { storage = storagePadrao() } = {}) {
  if (!chave || !rascunho || !storage) return false
  const texto = serializarRascunho(rascunho)
  if (!texto) return false
  try { storage.setItem(chave, texto); return true } catch { return false }
}

export function apagarRascunho(chave, { storage = storagePadrao() } = {}) {
  if (!chave || !storage) return
  try { storage.removeItem(chave) } catch { /* nada a fazer */ }
}

/**
 * Lê e valida. Rascunho inválido ou expirado é APAGADO na leitura — ficar no storage só
 * ocuparia espaço até o próximo dia com a mesma data e turno.
 */
export function lerRascunho(chave, { storage = storagePadrao(), agora = Date.now() } = {}) {
  if (!chave || !storage) return { ok: false, motivo: 'vazio' }
  let bruto = null
  try { bruto = storage.getItem(chave) } catch { return { ok: false, motivo: 'vazio' } }
  const r = restaurarRascunho(bruto, { agora })
  if (!r.ok && r.motivo !== 'vazio') apagarRascunho(chave, { storage })
  return r
}

/** Varre só as chaves do prefixo e apaga as vencidas. Devolve quantas saíram. */
export function limparRascunhosExpirados({ storage = storagePadrao(), agora = Date.now() } = {}) {
  if (!storage) return 0
  const chaves = []
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i)
      if (k && k.startsWith(PREFIXO_RASCUNHO)) chaves.push(k)
    }
  } catch { return 0 }
  let n = 0
  for (const k of chaves) {
    const r = lerRascunho(k, { storage, agora })
    if (!r.ok) n += 1
  }
  return n
}

/**
 * Gravador com debounce: cada mudança agenda; só a última de cada 500 ms grava.
 * `flush` grava o pendente AGORA (usar em `pagehide`/`visibilitychange` e ao desmontar:
 * o iOS mata a PWA em 2º plano sem esperar timer nenhum).
 */
export function criarGravadorRascunho({
  chave, storage = storagePadrao(), debounceMs = 500,
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms), clearTimeoutFn = (id) => clearTimeout(id),
} = {}) {
  let timer = null
  let pendente = null
  const cancelar = () => {
    if (timer != null) { clearTimeoutFn(timer); timer = null }
    pendente = null
  }
  const flush = () => {
    if (timer != null) { clearTimeoutFn(timer); timer = null }
    if (!pendente) return false
    const r = pendente
    pendente = null
    return gravarRascunho(chave, r, { storage })
  }
  return {
    chave,
    agendar(rascunho) {
      if (!rascunho) return
      pendente = rascunho
      if (timer != null) clearTimeoutFn(timer)
      timer = setTimeoutFn(flush, debounceMs)
    },
    flush,
    cancelar,
    apagar() { cancelar(); apagarRascunho(chave, { storage }) },
    temPendente: () => pendente != null,
  }
}
