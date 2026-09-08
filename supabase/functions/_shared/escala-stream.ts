/**
 * Leitura do SSE da Anthropic e o veredito "esta leitura está completa?".
 *
 * Streaming não é enfeite: acima de ~16k `max_tokens` a chamada não-streaming
 * arrisca estourar o timeout de HTTP antes da primeira resposta, e a conexão
 * precisa continuar recebendo bytes para o gateway não derrubar a função no
 * meio de uma escala grande.
 *
 * ⚠️ MORA AQUI, fora do `index.ts`, para ter teste: a regra de "leitura
 * incompleta" é a que separa uma escala inteira de meia escala publicada em
 * silêncio, e essa não pode depender de inspeção visual.
 */
export interface UsoLeitura {
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
}

/**
 * `usage` também sai do stream (item 4.1): `message_start` traz os tokens de
 * entrada e o que o cache leu/escreveu; `message_delta` traz os de saída. Sem
 * isso não há custo por leitura — e a regra da Onda 4 é "só entra o que mantém
 * ou reduz o custo", que não dá para verificar sem medir.
 */
export async function lerRespostaStream(
  res: Response,
): Promise<{ texto: string; stopReason: string; uso: UsoLeitura }> {
  let texto = ''
  let stopReason = ''
  let buffer = ''
  const uso: UsoLeitura = {
    input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0,
  }
  const somarUso = (u: Record<string, unknown> | undefined) => {
    if (!u) return
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    if (n(u.input_tokens)) uso.input_tokens = n(u.input_tokens)
    if (n(u.output_tokens)) uso.output_tokens = n(u.output_tokens)
    if (n(u.cache_read_input_tokens)) uso.cache_read_tokens = n(u.cache_read_input_tokens)
    if (n(u.cache_creation_input_tokens)) uso.cache_write_tokens = n(u.cache_creation_input_tokens)
  }
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    // eventos SSE são separados por linha em branco; guarda o resto parcial
    const partes = buffer.split('\n')
    buffer = partes.pop() || ''
    for (const linha of partes) {
      if (!linha.startsWith('data:')) continue
      const payload = linha.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let ev: Record<string, unknown>
      try { ev = JSON.parse(payload) } catch { continue }
      if (ev.type === 'content_block_delta') {
        const d = ev.delta as { type?: string; text?: string } | undefined
        if (d?.type === 'text_delta') texto += d.text || ''
      } else if (ev.type === 'message_delta') {
        const d = ev.delta as { stop_reason?: string } | undefined
        if (d?.stop_reason) stopReason = d.stop_reason
        somarUso(ev.usage as Record<string, unknown> | undefined)
      } else if (ev.type === 'message_start') {
        const m = ev.message as { usage?: Record<string, unknown> } | undefined
        somarUso(m?.usage)
      }
    }
  }
  return { texto, stopReason, uso }
}


/**
 * Um SSE completo SEMPRE termina com `message_delta` trazendo `stop_reason`.
 * Sem ele, a conexão caiu no meio — e o JSON parcial PODE parsear: medido em
 * 08/09, uma foto do HRO voltou com 20 casos e o rodapé VAZIO, entregues como
 * se fossem a escala inteira. É o mesmo modo de falha silencioso de 06/08 (o
 * corte por teto de tokens caindo logo depois de um `}`), por outra porta: lá
 * era o teto, aqui é a conexão. As duas viram `truncado`, e a tela sabe dizer
 * "a leitura foi cortada".
 */
export const ehLeituraIncompleta = (stopReason: unknown): boolean =>
  stopReason === 'max_tokens' || !String(stopReason ?? '').trim()
