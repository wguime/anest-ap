/**
 * Cache de 24 h da leitura, por hash da foto (Onda 4, item 4.9).
 *
 * Reanexar a MESMA foto paga a leitura inteira de novo — e o fluxo reenvia por
 * desenho: "reler com hint", depois de resolver "de qual hospital é?", manda
 * exatamente a mesma imagem outra vez. Em 17–18/08, com a chave sem crédito, a
 * mesma escala foi reenviada oito vezes.
 *
 * LGPD (decisão do dono, 07/09): guarda o JSON JÁ SANITIZADO — o mesmo que a
 * tela recebe, com paciente só por iniciais — nunca a imagem, e nunca uma
 * leitura que traga `pacienteNome`. Esse campo só existe em convênio PARTICULAR
 * puro, para a cobrança, e 24 h de nome completo de paciente numa tabela de
 * conveniência não se justifica pelo que economiza.
 */

const url = () => Deno.env.get('SUPABASE_URL') || ''
const key = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

/**
 * Chave do cache. Tudo que muda o resultado esperado entra: bumpar
 * PROMPT_VERSAO invalida o cache inteiro sozinho, sem precisar limpar nada.
 *
 * ⚠️ RECEBE O HASH DA IMAGEM, NUNCA A IMAGEM. A primeira versão concatenava o
 * base64 inteiro numa string nova e o digeria de novo — uma cópia de centenas de
 * KB mais um segundo SHA-256 do arquivo todo, em cima do que a telemetria já
 * fazia. O isolate da edge tem teto de memória, e o preço apareceu medido em
 * 08/09: uma leitura de 16 morreu com `WORKER_RESOURCE_LIMIT` e outras duas
 * voltaram com o stream cortado. Hasheando o hash, esta função passa a operar
 * sobre 64 caracteres.
 */
export async function chaveCache(partes: {
  imagemHash: unknown
  hospital?: unknown
  modo?: unknown
  promptVersao?: unknown
  vocabulario?: string[]
  secoesTurno?: boolean
}): Promise<string> {
  try {
    const imagem = String(partes.imagemHash ?? '')
    if (!imagem) return ''
    const texto = [
      imagem,
      String(partes.hospital ?? ''),
      String(partes.modo ?? ''),
      String(partes.promptVersao ?? ''),
      (partes.vocabulario || []).join(','),
      partes.secoesTurno ? 'turno' : '',
      // separador em quebra de linha, VISÍVEL: um byte NUL aqui funcionava para
      // o hash e fazia o git tratar o arquivo inteiro como binário — diff
      // inútil e um caractere que ninguém enxerga no meio do código
    ].join('\n')
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}

/**
 * Resposta guardada, ou null. Filtra por `expira_em` na própria consulta: linha
 * vencida nunca é servida, mesmo antes de a purga de hora em hora passar.
 */
export async function lerCache(chave: string): Promise<Record<string, unknown> | null> {
  if (!chave || !url() || !key()) return null
  try {
    const res = await fetch(
      `${url()}/rest/v1/escala_leitura_cache?chave=eq.${encodeURIComponent(chave)}`
      + `&expira_em=gt.${encodeURIComponent(new Date().toISOString())}&select=resposta&limit=1`,
      { headers: { apikey: key(), Authorization: `Bearer ${key()}` } },
    )
    if (!res.ok) return null
    const linhas = await res.json()
    const resposta = Array.isArray(linhas) && linhas[0]?.resposta
    return resposta && typeof resposta === 'object' ? resposta as Record<string, unknown> : null
  } catch {
    return null // cache é aceleração: falha nele nunca atrapalha a leitura
  }
}

/** true quando a resposta traz nome completo de paciente — essa não é cacheada. */
export function temNomeDePaciente(resposta: Record<string, unknown>): boolean {
  const casos = Array.isArray(resposta?.casos) ? resposta.casos : []
  return casos.some((c: Record<string, unknown>) => String(c?.pacienteNome ?? '').trim())
}

export async function gravarCache(
  chave: string, resposta: Record<string, unknown>,
  meta: { modo?: string; promptVersao?: string },
): Promise<void> {
  if (!chave || !url() || !key()) return
  if (temNomeDePaciente(resposta)) {
    console.log('[escala-leitura-cache] leitura com pacienteNome (particular) não é cacheada — LGPD')
    return
  }
  try {
    await fetch(`${url()}/rest/v1/escala_leitura_cache`, {
      method: 'POST',
      headers: {
        apikey: key(),
        Authorization: `Bearer ${key()}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        chave,
        modo: meta.modo || 'dia-util',
        prompt_versao: meta.promptVersao || '',
        resposta,
        expira_em: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }),
    })
  } catch (err) {
    console.error('[escala-leitura-cache] gravação falhou:', err instanceof Error ? err.message : String(err))
  }
}

/** Status que valem uma segunda tentativa: fila cheia, sobrecarga e falha do lado de lá. */
export const ehStatusRetentavel = (status: number): boolean =>
  status === 429 || status === 529 || (status >= 500 && status < 600)

/**
 * Chama a Anthropic com UMA segunda tentativa em 429/529/5xx.
 *
 * Um 529 (sobrecarga) virava "tente de novo" na tela da secretária, às 22h,
 * com o mapa na mão — quando a resposta certa era esperar dois segundos. Uma
 * tentativa só, de propósito: mais que isso empurra a espera para além do que
 * alguém aguenta olhando a tela, e o erro passa a ser informação útil.
 */
export async function fetchComRetry(
  url: string, init: RequestInit, { esperaMs = 2000 } = {},
): Promise<{ res: Response; tentativas: number }> {
  let res = await fetch(url, init)
  if (res.ok || !ehStatusRetentavel(res.status)) return { res, tentativas: 1 }
  console.log(`[parse-escala-cirurgica] ${res.status} da Anthropic — repetindo em ${esperaMs}ms`)
  // o corpo da 1ª resposta precisa ser drenado, senão a conexão fica presa
  try { await res.text() } catch { /* já veio vazio */ }
  await new Promise((r) => setTimeout(r, esperaMs))
  res = await fetch(url, init)
  return { res, tentativas: 2 }
}
