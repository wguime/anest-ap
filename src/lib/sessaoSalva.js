/**
 * Sessão salva — o perfil do último login CONFIRMADO, para o app abrir direto na
 * Home sem esperar o Firebase ir à rede (abertura instantânea, 15/10/2026).
 *
 * Por que existe: o Firebase Auth só anuncia o usuário depois de confirmar o
 * token no servidor (accounts:lookup, e antes um securetoken quando o token de
 * 1h venceu — o caso de quem abre o app de manhã). Medido em produção: 1,2 a
 * 1,9 s de spinner em TODA abertura, e até 30–60 s com rede de hospital
 * pendurada. Os dados da Home já vinham de cache; quem segurava era o portão.
 *
 * Como funciona: com sessão salva o UserContext nasce autenticado com este
 * perfil e o Firebase confirma em segundo plano. Nada de dado de negócio passa
 * por aqui — Supabase e Firestore esperam o Firebase confirmar antes de qualquer
 * leitura (getSupabaseToken aguarda o `_authReady`; o Firestore enfileira até o
 * primeiro usuário). Se o Firebase disser que não há sessão (conta desativada,
 * token revogado), o perfil salvo é apagado e o app vai para o login.
 *
 * LGPD: é o perfil da própria pessoa, no próprio aparelho — o mesmo documento que
 * o cache persistente do Firestore já guarda em IndexedDB. Tokens de push ficam
 * de fora (são do aparelho e não servem para desenhar tela). Sai no logout.
 */

export const CHAVE_SESSAO = 'anest-sessao-v1'

/** Campos que nunca vão para o disco. */
const CAMPOS_FORA = new Set(['fcmToken', 'fcmTokens', 'fcmTokenUpdatedAt'])

const PROFUNDIDADE_MAX = 6

/**
 * Data do Firestore restaurada do disco: mesma API de leitura do `Timestamp`
 * (`toDate`, `toMillis`, `seconds`…) para quem formata datas do perfil não
 * quebrar no segundo que antecede o perfil vivo.
 */
export class TimestampSalvo {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6) }
  toDate() { return new Date(this.toMillis()) }
  valueOf() { return this.toMillis() }
  isEqual(outro) { return !!outro && outro.seconds === this.seconds && outro.nanoseconds === this.nanoseconds }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds } }
}

const ehTimestamp = (v) =>
  !!v && typeof v === 'object' && typeof v.toDate === 'function'
  && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number'

/** Converte o perfil em algo que o JSON guarda sem perder o tipo das datas. */
function paraDisco(valor, nivel = 0) {
  if (valor == null || typeof valor !== 'object') return valor
  if (nivel > PROFUNDIDADE_MAX) return undefined
  if (ehTimestamp(valor)) return { __ts: [valor.seconds, valor.nanoseconds] }
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : { __dt: valor.toISOString() }
  if (Array.isArray(valor)) return valor.map((v) => paraDisco(v, nivel + 1))
  const out = {}
  for (const [k, v] of Object.entries(valor)) {
    if (nivel === 0 && CAMPOS_FORA.has(k)) continue
    if (typeof v === 'function') continue
    const convertido = paraDisco(v, nivel + 1)
    if (convertido !== undefined) out[k] = convertido
  }
  return out
}

function doDisco(_chave, valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    if (Array.isArray(valor.__ts) && Object.keys(valor).length === 1) {
      return new TimestampSalvo(Number(valor.__ts[0]) || 0, Number(valor.__ts[1]) || 0)
    }
    if (typeof valor.__dt === 'string' && Object.keys(valor).length === 1) return new Date(valor.__dt)
  }
  return valor
}

const armazenamento = (storage) => {
  if (storage) return storage
  try { return globalThis.localStorage || null } catch { return null }
}

/**
 * Lê a sessão salva. Devolve `{ uid, perfil, salvaEm }` ou `null` — inclusive
 * quando o storage está bloqueado (aba privada) ou o conteúdo não confere.
 */
export function lerSessaoSalva(storage) {
  try {
    const st = armazenamento(storage)
    const bruto = st?.getItem(CHAVE_SESSAO)
    if (!bruto) return null
    const s = JSON.parse(bruto, doDisco)
    if (!s || typeof s.uid !== 'string' || !s.uid) return null
    if (!s.perfil || typeof s.perfil !== 'object' || Array.isArray(s.perfil)) return null
    const uidPerfil = s.perfil.uid || s.perfil.id
    if (uidPerfil && uidPerfil !== s.uid) return null
    return s
  } catch {
    return null
  }
}

/** Grava o perfil confirmado pelo Firebase (falha de storage é silenciosa). */
export function gravarSessao(uid, perfil, storage) {
  if (!uid || !perfil || typeof perfil !== 'object') return
  try {
    const st = armazenamento(storage)
    st?.setItem(CHAVE_SESSAO, JSON.stringify({ uid, salvaEm: Date.now(), perfil: paraDisco(perfil) }))
  } catch { /* quota/aba privada: a próxima abertura só não será instantânea */ }
}

export function limparSessao(storage) {
  try { armazenamento(storage)?.removeItem(CHAVE_SESSAO) } catch { /* idem */ }
}
