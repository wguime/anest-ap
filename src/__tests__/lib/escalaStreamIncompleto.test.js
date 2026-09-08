/**
 * Leitura cortada no meio do stream (Onda 4, correção de 08/09).
 *
 * O pior erro deste módulo não é falhar — é ENTREGAR MEIA ESCALA como se fosse
 * inteira. Em 06/08 isso aconteceu pelo teto de tokens: o corte caía logo depois
 * de um `}`, o `JSON.parse` passava e a escala publicava sem os últimos casos.
 * Em 08/09 aconteceu de novo por outra porta: a conexão caiu aos 29s e uma foto
 * do HRO voltou com 20 casos e o rodapé VAZIO — sem erro nenhum, sem
 * `stop_reason`, sem aviso na tela.
 *
 * A regra que fecha as duas portas: um SSE completo SEMPRE termina com
 * `message_delta` trazendo `stop_reason`. Sem ele, a leitura é incompleta,
 * mesmo que o JSON feche.
 */
import { describe, it, expect } from 'vitest'
import {
  lerRespostaStream, ehLeituraIncompleta,
} from '../../../supabase/functions/_shared/escala-stream.ts'

/** Monta uma Response com corpo SSE, como a da Anthropic. */
function sse(eventos) {
  const corpo = eventos.map((e) => `data: ${JSON.stringify(e)}\n`).join('\n')
  return new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(corpo)); c.close() },
  }))
}

const texto = (t) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } })

describe('ehLeituraIncompleta', () => {
  it('stream sem stop_reason é incompleto — a conexão caiu', () => {
    expect(ehLeituraIncompleta('')).toBe(true)
    expect(ehLeituraIncompleta(undefined)).toBe(true)
    expect(ehLeituraIncompleta(null)).toBe(true)
    expect(ehLeituraIncompleta('   ')).toBe(true)
  })

  it('max_tokens continua incompleto (o corte de 06/08)', () => {
    expect(ehLeituraIncompleta('max_tokens')).toBe(true)
  })

  it('end_turn é a única leitura inteira', () => {
    expect(ehLeituraIncompleta('end_turn')).toBe(false)
  })
})

describe('lerRespostaStream', () => {
  it('junta o texto e captura o stop_reason de uma leitura inteira', async () => {
    const r = await lerRespostaStream(sse([
      { type: 'message_start', message: { usage: { input_tokens: 1200, cache_read_input_tokens: 7700 } } },
      texto('{"casos":'), texto('[]}'),
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2100 } },
    ]))
    expect(r.texto).toBe('{"casos":[]}')
    expect(r.stopReason).toBe('end_turn')
    expect(ehLeituraIncompleta(r.stopReason)).toBe(false)
    expect(r.uso.input_tokens).toBe(1200)
    expect(r.uso.cache_read_tokens).toBe(7700)
    expect(r.uso.output_tokens).toBe(2100)
  })

  it('⚠️ JSON que FECHA sozinho num stream cortado ainda é incompleto', async () => {
    // é o caso real de 08/09: o array de casos fechou, o rodapé nunca veio, e o
    // `JSON.parse` passa. Só a ausência de stop_reason denuncia.
    const r = await lerRespostaStream(sse([
      { type: 'message_start', message: { usage: { input_tokens: 1100 } } },
      texto('{"casos":[{"sala":"Sala 1"}]'), texto('}'),
      // sem message_delta: a conexão caiu aqui
    ]))
    expect(JSON.parse(r.texto)).toEqual({ casos: [{ sala: 'Sala 1' }] })
    expect(r.stopReason).toBe('')
    expect(ehLeituraIncompleta(r.stopReason)).toBe(true)
  })

  it('reconhece o corte por teto de tokens', async () => {
    const r = await lerRespostaStream(sse([
      texto('{"casos":['),
      { type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 32000 } },
    ]))
    expect(r.stopReason).toBe('max_tokens')
    expect(ehLeituraIncompleta(r.stopReason)).toBe(true)
    expect(r.uso.output_tokens).toBe(32000)
  })

  it('ignora evento malformado e o [DONE] sem perder o resto', async () => {
    const corpo = 'data: {lixo\n\ndata: [DONE]\n\n'
      + `data: ${JSON.stringify(texto('ok'))}\n\n`
      + `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } })}\n\n`
    const res = new Response(new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(corpo)); c.close() },
    }))
    const r = await lerRespostaStream(res)
    expect(r.texto).toBe('ok')
    expect(r.stopReason).toBe('end_turn')
  })

  it('stream vazio não vira leitura boa', async () => {
    const r = await lerRespostaStream(sse([]))
    expect(r.texto).toBe('')
    expect(ehLeituraIncompleta(r.stopReason)).toBe(true)
  })
})
