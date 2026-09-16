/**
 * supabaseSubscriptionHelper — assinaturas realtime confiáveis por BROADCAST
 * (sinal + busca por chave), com reconexão e backoff exponencial.
 *
 * Até 16/09/2026 o transporte era `postgres_changes`. Nesse modo o Realtime
 * CONSULTA o WAL a cada ~100 ms enquanto houver UM assinante em qualquer
 * tabela (`realtime.list_changes`, avaliando a RLS por assinante): foi 59 % de
 * todo o tempo de CPU do banco desde fevereiro e chegou a 10–39 s por rodada
 * no dia em que o compute Nano (plano free) saturou na troca de turno. O
 * Broadcast "do banco" é push: o trigger `public.rt_sinal` insere em
 * `realtime.messages` e o Realtime entrega — nada é consultado.
 *
 * O trigger manda só um SINAL `{ table, op, pk, chaves, antes }`, nunca a
 * linha: Broadcast entrega a mesma mensagem a todo assinante do tópico e a RLS
 * da tabela (notificação só do destinatário, incidente só do responsável,
 * documento por sigilo) não vale dentro do canal. Quem precisa do conteúdo o
 * busca pela PK via PostgREST, onde a RLS vale; linha invisível = evento
 * descartado. `conteudo: false` pula a busca — a escala só quer saber QUE
 * mudou e recarrega por conta própria.
 *
 * Tópicos: `t:<tabela>` (qualquer autenticado) e, nas tabelas de escopo
 * pessoal, `u:<tabela>:<uid>` — o trigger escolhe e a policy de
 * `realtime.messages` só deixa cada um entrar no seu. Um filtro
 * `recipient_id=eq.<uid>` vira o tópico pessoal; qualquer `col=eq.val` é
 * aplicado aqui, sobre a linha entregue.
 *
 * Um canal por tópico por cliente: o realtime-js devolve o MESMO canal para o
 * mesmo tópico e `subscribe()` só pode ser chamado uma vez por canal — o
 * registro abaixo compartilha o canal entre assinantes e o derruba quando o
 * último sai.
 */
import { supabase } from '@/config/supabase'

const DEFAULT_OPTIONS = {
  maxRetries: 20,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  onStatusChange: null,
  onReconnect: null,
}

/** Evento do broadcast que o trigger `rt_sinal` emite. */
export const EVENTO_SINAL = 'sinal'

/**
 * Tabelas cujo sinal sai por tópico PESSOAL (`u:<tabela>:<uid>`). Tem de bater
 * com `public.rt_sinal()` e com a policy de realtime.messages na migration
 * 20260916203000_realtime_broadcast_sinal.sql.
 */
export const ESCOPO_PESSOAL = {
  notifications: ['recipient_id'],
  messages: ['sender_id', 'recipient_id'],
  incident_notification_settings: ['user_id'],
  // o canal t:incidentes é só de responsáveis (policy); o autor de um relato
  // identificado acompanha o seu por user_id=eq.<uid>
  incidentes: ['user_id'],
}

const FILTRO_EQ = /^([a-zA-Z_][a-zA-Z0-9_]*)=eq\.(.+)$/

/**
 * Tópico e filtro local a partir de (tabela, filtro PostgREST).
 * `recipient_id=eq.<uid>` numa tabela pessoal → `u:notifications:<uid>`; o
 * filtro continua valendo localmente (em `messages` os dois lados caem no mesmo
 * tópico e cada assinatura fica só com a sua metade).
 */
export function topicoDe(table, filter) {
  const m = filter ? FILTRO_EQ.exec(String(filter).trim()) : null
  const filtroLocal = m ? { coluna: m[1], valor: m[2] } : null
  if (filter && !m) {
    console.warn(`[ReliableSubscription] ${table}: filtro "${filter}" não é col=eq.val — ignorado (tópico da tabela)`)
  }
  const pessoal = ESCOPO_PESSOAL[table]
  if (m && pessoal && pessoal.includes(m[1])) return { topic: `u:${table}:${m[2]}`, filtroLocal }
  return { topic: `t:${table}`, filtroLocal }
}

// ── registro: um canal por tópico, ouvintes compartilhados ─────────────────
const canais = new Map()

function obterCanal(topic, opts) {
  let entrada = canais.get(topic)
  if (entrada) return entrada
  entrada = {
    topic,
    channel: null,
    ouvintes: new Set(), // { onSinal, onStatus, onRefetch, onReconnect }
    retryCount: 0,
    retryTimer: null,
    opts,
    subscribe() {
      if (this.channel) {
        supabase.removeChannel(this.channel)
        this.channel = null
      }
      // o nome do canal É o tópico: é o que o trigger endereça e o que a
      // policy de realtime.messages enxerga em realtime.topic()
      const channel = supabase
        .channel(this.topic, { config: { private: true } })
        .on('broadcast', { event: EVENTO_SINAL }, (msg) => {
          const sinal = msg?.payload
          this.ouvintes.forEach((o) => o.onSinal(sinal))
        })
        .subscribe((status) => {
          if (!canais.has(this.topic)) return
          this.ouvintes.forEach((o) => o.onStatus?.(status))
          if (status === 'SUBSCRIBED') {
            if (this.retryCount > 0) {
              this.retryCount = 0
              this.ouvintes.forEach((o) => { o.onRefetch?.(); o.onReconnect?.() })
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[ReliableSubscription] ${this.topic}: ${status}, scheduling retry...`)
            this.scheduleRetry()
          }
        })
      this.channel = channel
    },
    scheduleRetry() {
      if (!canais.has(this.topic)) return
      if (this.retryCount >= this.opts.maxRetries) {
        console.error(`[ReliableSubscription] ${this.topic}: max retries (${this.opts.maxRetries}) exceeded`)
        return
      }
      const delay = Math.min(this.opts.initialDelayMs * Math.pow(2, this.retryCount), this.opts.maxDelayMs)
      this.retryCount++
      this.retryTimer = setTimeout(() => { if (canais.has(this.topic)) this.subscribe() }, delay)
    },
    destruir() {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
      if (this.channel) {
        supabase.removeChannel(this.channel)
        this.channel = null
      }
      canais.delete(this.topic)
    },
  }
  canais.set(topic, entrada)
  entrada.subscribe()
  return entrada
}

/** Só para testes: derruba todos os canais e zera o registro. */
export function __resetCanais() {
  for (const entrada of Array.from(canais.values())) entrada.destruir()
  canais.clear()
}

/**
 * Busca a linha pela PK via PostgREST (a RLS do usuário vale aqui).
 * null = invisível para este usuário ou já apagada → o evento é descartado.
 */
async function buscarLinha(table, pk) {
  let q = supabase.from(table).select('*')
  for (const [col, val] of Object.entries(pk || {})) q = q.eq(col, val)
  const { data, error } = await q.maybeSingle()
  if (error) {
    console.warn(`[ReliableSubscription] ${table}: busca da linha falhou:`, error.message)
    return null
  }
  return data || null
}

const casaFiltro = (filtro, row) => !filtro || String(row?.[filtro.coluna]) === filtro.valor

/**
 * Creates a reliable realtime subscription (broadcast + busca por chave).
 *
 * @param {Object} config
 * @param {string} config.channelName - Nome legado; hoje só identifica nos logs (o canal É o tópico)
 * @param {string} config.table - Postgres table to subscribe to
 * @param {string} [config.schema='public'] - Postgres schema (informativo)
 * @param {string} [config.event='*'] - Event filter: '*', 'INSERT', 'UPDATE', 'DELETE'
 * @param {string} [config.filter] - `col=eq.val` (tópico pessoal quando for a coluna de escopo)
 * @param {Function} config.callback - Called with { eventType, new, old }
 * @param {Function} [config.transformRow] - Optional row transformer (e.g. toCamelCase)
 * @param {Function} [config.onRefetch] - Called on reconnection to re-fetch full data
 * @param {boolean} [config.conteudo=true] - false = entrega só { ...pk, ...chaves }, sem buscar a linha
 * @param {Object} [options] - Override default options
 * @returns {{ cleanup: Function }} - Call cleanup() to tear down the subscription
 */
export function createReliableSubscription(config, options = {}) {
  const {
    table,
    event = '*',
    filter,
    callback,
    transformRow,
    onRefetch,
    conteudo = true,
  } = config

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { topic, filtroLocal } = topicoDe(table, filter)
  const transformar = (row) => (row && transformRow ? transformRow(row) : row)

  let destroyed = false
  // resposta velha não atropela: por PK, só a busca mais recente entrega
  const seqPorPk = new Map()

  async function onSinal(sinal) {
    if (destroyed || !sinal || sinal.table !== table) return
    const op = sinal.op
    if (event !== '*' && event !== op) return
    const pk = sinal.pk || {}
    const chaves = { ...pk, ...(sinal.chaves || {}) }
    const antes = sinal.antes ? { ...pk, ...sinal.antes } : null

    let novo = null
    let velho = null
    if (op === 'DELETE') {
      velho = chaves
    } else if (conteudo) {
      const chave = JSON.stringify(pk)
      const seq = (seqPorPk.get(chave) || 0) + 1
      seqPorPk.set(chave, seq)
      const linha = await buscarLinha(table, pk)
      if (destroyed || seqPorPk.get(chave) !== seq) return
      if (!linha) return // RLS esconde ou já sumiu: nada a entregar
      novo = linha
      velho = antes
    } else {
      novo = chaves
      velho = antes
    }
    if (!casaFiltro(filtroLocal, novo || velho)) return
    callback({ eventType: op, new: transformar(novo), old: transformar(velho) })
  }

  const ouvinte = {
    onSinal,
    onStatus: opts.onStatusChange || null,
    onRefetch: onRefetch || null,
    onReconnect: opts.onReconnect || null,
  }
  const entrada = obterCanal(topic, opts)
  entrada.ouvintes.add(ouvinte)

  function cleanup() {
    destroyed = true
    entrada.ouvintes.delete(ouvinte)
    if (entrada.ouvintes.size === 0) entrada.destruir()
  }

  return { cleanup }
}

export default createReliableSubscription
