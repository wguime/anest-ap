/**
 * supabaseSubscriptionHelper — transporte por BROADCAST (sinal + busca por chave).
 *
 * Desde 16/09/2026 o helper não assina `postgres_changes` (polling do WAL que
 * era 59 % do tempo de banco): entra num canal PRIVADO cujo nome é o tópico
 * (`t:<tabela>` / `u:<tabela>:<uid>`), recebe o SINAL do trigger `rt_sinal`
 * { table, op, pk, chaves, antes } e busca a linha pela PK via PostgREST, onde a
 * RLS vale. Regras travadas aqui:
 *   1. tópico: filtro de escopo pessoal → u:…; qualquer outro → t:<tabela>;
 *   2. INSERT/UPDATE → busca a linha; linha invisível (RLS) → nada entregue;
 *   3. DELETE → old = pk + chaves, sem busca;
 *   4. conteudo:false → new = pk + chaves, sem busca;
 *   5. filtro col=eq.val vale sobre a linha entregue;
 *   6. um canal por tópico: dois assinantes = 1 channel/1 subscribe; o último
 *      cleanup derruba o canal;
 *   7. CHANNEL_ERROR → retry; SUBSCRIBED depois de retry → onRefetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { estado } = vi.hoisted(() => ({
  estado: {
    canais: [],          // { topic, params, handlers: {evento→cb}, statusCb }
    linhas: {},          // `${table}:${JSON.stringify(pk)}` → row | null
    buscas: [],          // registro das buscas feitas
    removidos: [],
  },
}))

vi.mock('@/config/supabase', () => {
  const makeChannel = (topic, params) => {
    const ch = { topic, params, handlers: {}, statusCb: null }
    ch.on = vi.fn((tipo, cfg, cb) => { ch.handlers[`${tipo}:${cfg?.event}`] = cb; return ch })
    ch.subscribe = vi.fn((cb) => { ch.statusCb = cb; return ch })
    return ch
  }
  const from = vi.fn((table) => {
    const filtros = {}
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn((col, val) => { filtros[col] = val; return q }),
      maybeSingle: vi.fn(async () => {
        estado.buscas.push({ table, filtros: { ...filtros } })
        const chave = `${table}:${JSON.stringify(filtros)}`
        return { data: estado.linhas[chave] ?? null, error: null }
      }),
    }
    return q
  })
  return {
    supabase: {
      channel: vi.fn((topic, params) => {
        const existente = estado.canais.find((c) => c.topic === topic)
        if (existente) return existente // realtime-js devolve o MESMO canal p/ o mesmo tópico
        const ch = makeChannel(topic, params)
        estado.canais.push(ch)
        return ch
      }),
      removeChannel: vi.fn((ch) => {
        estado.removidos.push(ch.topic)
        estado.canais = estado.canais.filter((c) => c !== ch)
      }),
      from,
    },
  }
})

import { createReliableSubscription, topicoDe, __resetCanais } from '@/services/supabaseSubscriptionHelper'
import { supabase } from '@/config/supabase'

const canal = (topic) => estado.canais.find((c) => c.topic === topic)
const emitir = (topic, sinal) => canal(topic).handlers['broadcast:sinal']({ payload: sinal })
const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  __resetCanais()
  estado.canais = []
  estado.linhas = {}
  estado.buscas = []
  estado.removidos = []
  vi.clearAllMocks()
})

describe('topicoDe', () => {
  it('filtro de escopo pessoal vira tópico do usuário; o filtro segue valendo localmente', () => {
    expect(topicoDe('notifications', 'recipient_id=eq.u1')).toEqual({ topic: 'u:notifications:u1', filtroLocal: { coluna: 'recipient_id', valor: 'u1' } })
    expect(topicoDe('messages', 'sender_id=eq.u1').topic).toBe('u:messages:u1')
    expect(topicoDe('incident_notification_settings', 'user_id=eq.u1').topic).toBe('u:incident_notification_settings:u1')
    expect(topicoDe('incidentes', 'user_id=eq.u1').topic).toBe('u:incidentes:u1')
  })
  it('sem filtro, ou filtro fora do escopo pessoal, é o tópico da tabela', () => {
    expect(topicoDe('documentos')).toEqual({ topic: 't:documentos', filtroLocal: null })
    expect(topicoDe('documentos', 'status=eq.pendente')).toEqual({ topic: 't:documentos', filtroLocal: { coluna: 'status', valor: 'pendente' } })
    expect(topicoDe('notifications', 'category=eq.x').topic).toBe('t:notifications')
  })
})

describe('createReliableSubscription — broadcast', () => {
  it('entra num canal privado cujo nome é o tópico e ouve o evento "sinal"', () => {
    createReliableSubscription({ channelName: 'legado', table: 'notifications', filter: 'recipient_id=eq.u1', callback: vi.fn() })
    expect(supabase.channel).toHaveBeenCalledWith('u:notifications:u1', { config: { private: true } })
    const ch = canal('u:notifications:u1')
    expect(ch.on).toHaveBeenCalledWith('broadcast', { event: 'sinal' }, expect.any(Function))
    expect(ch.subscribe).toHaveBeenCalledTimes(1)
  })

  it('INSERT: busca a linha pela PK (RLS do usuário) e entrega com transformRow', async () => {
    const callback = vi.fn()
    estado.linhas['notifications:{"id":"n1"}'] = { id: 'n1', recipient_id: 'u1', subject: 'Oi' }
    createReliableSubscription({ table: 'notifications', filter: 'recipient_id=eq.u1', callback, transformRow: (r) => ({ ...r, t: true }) })
    emitir('u:notifications:u1', { table: 'notifications', op: 'INSERT', pk: { id: 'n1' }, chaves: {} })
    await tick()
    expect(estado.buscas).toEqual([{ table: 'notifications', filtros: { id: 'n1' } }])
    expect(callback).toHaveBeenCalledWith({ eventType: 'INSERT', new: { id: 'n1', recipient_id: 'u1', subject: 'Oi', t: true }, old: null })
  })

  it('linha invisível para este usuário (RLS) → evento descartado, sem callback', async () => {
    const callback = vi.fn()
    createReliableSubscription({ table: 'incidentes', callback })
    emitir('t:incidentes', { table: 'incidentes', op: 'UPDATE', pk: { id: 'i9' }, chaves: { status: 'aberto' }, antes: { status: 'novo' } })
    await tick()
    expect(estado.buscas).toHaveLength(1)
    expect(callback).not.toHaveBeenCalled()
  })

  it('UPDATE entrega old com o status anterior (fila de aprovação compara antes/depois)', async () => {
    const callback = vi.fn()
    estado.linhas['documentos:{"id":"d1"}'] = { id: 'd1', status: 'pendente' }
    createReliableSubscription({ table: 'documentos', event: 'UPDATE', callback })
    emitir('t:documentos', { table: 'documentos', op: 'UPDATE', pk: { id: 'd1' }, chaves: { status: 'pendente' }, antes: { status: 'rascunho' } })
    await tick()
    expect(callback).toHaveBeenCalledWith({ eventType: 'UPDATE', new: { id: 'd1', status: 'pendente' }, old: { id: 'd1', status: 'rascunho' } })
  })

  it('DELETE: old = pk + chaves, sem busca', async () => {
    const callback = vi.fn()
    createReliableSubscription({ table: 'comunicados', callback, transformRow: (r) => r })
    emitir('t:comunicados', { table: 'comunicados', op: 'DELETE', pk: { id: 'c1' }, chaves: { status: 'ativo' } })
    await tick()
    expect(estado.buscas).toHaveLength(0)
    expect(callback).toHaveBeenCalledWith({ eventType: 'DELETE', new: null, old: { id: 'c1', status: 'ativo' } })
  })

  it('conteudo:false entrega só pk + chaves (a escala recarrega sozinha)', async () => {
    const callback = vi.fn()
    createReliableSubscription({ table: 'escala_cirurgica_caso', callback, conteudo: false })
    emitir('t:escala_cirurgica_caso', { table: 'escala_cirurgica_caso', op: 'UPDATE', pk: { id: 'c1' }, chaves: { escala_id: 'e1', turno: 'matutino' }, antes: {} })
    await tick()
    expect(estado.buscas).toHaveLength(0)
    expect(callback).toHaveBeenCalledWith({ eventType: 'UPDATE', new: { id: 'c1', escala_id: 'e1', turno: 'matutino' }, old: { id: 'c1' } })
  })

  it('filtro col=eq.val vale sobre a linha entregue; evento de outra tabela ou de outro tipo é ignorado', async () => {
    const callback = vi.fn()
    estado.linhas['documentos:{"id":"d2"}'] = { id: 'd2', status: 'aprovado' }
    estado.linhas['documentos:{"id":"d3"}'] = { id: 'd3', status: 'pendente' }
    createReliableSubscription({ table: 'documentos', event: 'INSERT', filter: 'status=eq.pendente', callback })
    emitir('t:documentos', { table: 'documentos', op: 'INSERT', pk: { id: 'd2' }, chaves: { status: 'aprovado' } })
    emitir('t:documentos', { table: 'documentos', op: 'UPDATE', pk: { id: 'd3' }, chaves: { status: 'pendente' } })
    emitir('t:documentos', { table: 'outra', op: 'INSERT', pk: { id: 'd3' }, chaves: {} })
    emitir('t:documentos', { table: 'documentos', op: 'INSERT', pk: { id: 'd3' }, chaves: { status: 'pendente' } })
    await tick()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].new.id).toBe('d3')
  })

  it('dois assinantes do mesmo tópico compartilham UM canal; o último cleanup o derruba', () => {
    const a = createReliableSubscription({ table: 'documentos', callback: vi.fn() })
    const b = createReliableSubscription({ table: 'documentos', callback: vi.fn() })
    expect(estado.canais).toHaveLength(1)
    expect(canal('t:documentos').subscribe).toHaveBeenCalledTimes(1)
    a.cleanup()
    expect(estado.removidos).toEqual([])
    b.cleanup()
    expect(estado.removidos).toEqual(['t:documentos'])
  })

  it('CHANNEL_ERROR reassina com backoff e, ao voltar, chama onRefetch de cada assinante', async () => {
    vi.useFakeTimers()
    try {
      const onRefetch = vi.fn()
      createReliableSubscription({ table: 'profiles', callback: vi.fn(), onRefetch }, { initialDelayMs: 10 })
      const primeiro = canal('t:profiles')
      primeiro.statusCb('SUBSCRIBED')
      expect(onRefetch).not.toHaveBeenCalled() // primeira conexão não é reconexão
      primeiro.statusCb('CHANNEL_ERROR')
      await vi.advanceTimersByTimeAsync(15)
      expect(estado.removidos).toEqual(['t:profiles'])
      const segundo = canal('t:profiles')
      expect(segundo).not.toBe(primeiro)
      segundo.statusCb('SUBSCRIBED')
      expect(onRefetch).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
