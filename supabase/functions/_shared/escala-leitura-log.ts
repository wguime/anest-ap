/**
 * Registro de UMA leitura da escala pela Vision — a medida que não existia.
 *
 * Auditoria de 02/09: a edge logava uid, contagem do guardrail e "truncado", e
 * nada mais. Sem tokens, sem latência, sem `stop_reason`, sem modelo, sem versão
 * do prompt e sem as dimensões da imagem, qualquer mudança na leitura (prompt,
 * schema, cache, modelo) era palpite — não havia número ANTES para comparar com
 * o DEPOIS. Este módulo grava esse número, uma linha por chamada.
 *
 * LGPD: a linha NÃO carrega dado de paciente. Nem iniciais, nem procedimento,
 * nem nome de anestesista — só contagens, tokens, tempos e o hash da imagem. O
 * `uid` de quem pediu já é o mesmo que o `console.log` da função registra hoje,
 * e existe para responder "quem mandou esta foto" na trilha de auditoria.
 *
 * Falhar aqui NUNCA derruba a leitura: telemetria que quebra o fluxo clínico é
 * pior que telemetria ausente. Todo caminho de erro é engolido com um log.
 */

export interface LinhaLeitura {
  uid: string
  modo: string
  hospital_hint: string
  hospital_detectado: string
  imagem_hash: string
  imagem_mime: string
  imagem_largura: number | null
  imagem_altura: number | null
  imagem_bytes: number
  modelo: string
  prompt_versao: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  stop_reason: string
  latencia_ms: number
  casos: number
  rodape: number
  ajuda: number
  normalizacoes: Record<string, number>
  origem: string
  erro: string
}

const txt = (v: unknown, max = 80) => String(v ?? '').trim().slice(0, max)
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

/**
 * Monta a linha a gravar. Pura de propósito: é o que os testes conseguem
 * exercitar sem banco, e é onde a promessa "nenhum dado de paciente" é
 * verificável — a função só copia campos escalares de uma lista fechada.
 */
export function montarLinhaLog(e: Partial<LinhaLeitura> & { imagem_hash?: string }): LinhaLeitura {
  const dim = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  const normalizacoes: Record<string, number> = {}
  for (const [k, v] of Object.entries(e.normalizacoes || {})) {
    const n = num(v)
    if (n > 0) normalizacoes[txt(k, 40)] = n
  }
  return {
    uid: txt(e.uid, 128),
    modo: txt(e.modo, 20) || 'dia-util',
    hospital_hint: txt(e.hospital_hint, 20),
    hospital_detectado: txt(e.hospital_detectado, 20),
    imagem_hash: txt(e.imagem_hash, 64),
    imagem_mime: txt(e.imagem_mime, 30),
    imagem_largura: dim(e.imagem_largura),
    imagem_altura: dim(e.imagem_altura),
    imagem_bytes: num(e.imagem_bytes),
    modelo: txt(e.modelo, 60),
    prompt_versao: txt(e.prompt_versao, 30),
    input_tokens: num(e.input_tokens),
    output_tokens: num(e.output_tokens),
    cache_read_tokens: num(e.cache_read_tokens),
    cache_write_tokens: num(e.cache_write_tokens),
    stop_reason: txt(e.stop_reason, 30),
    latencia_ms: num(e.latencia_ms),
    casos: num(e.casos),
    rodape: num(e.rodape),
    ajuda: num(e.ajuda),
    normalizacoes,
    origem: txt(e.origem, 20) || 'modelo',
    erro: txt(e.erro, 200),
  }
}

/** sha256 em hex do base64 da imagem — identidade estável da foto reenviada. */
export async function hashImagem(base64: unknown): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(String(base64 ?? ''))
    const buf = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}

/**
 * Grava a linha via PostgREST com service-role. Sem `await` no caminho quente:
 * quem chama dispara e segue — a resposta da escala não espera telemetria.
 */
export async function registrarLeitura(linha: LinhaLeitura): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('[escala-leitura-log] SUPABASE_URL/SERVICE_ROLE ausentes — leitura não registrada')
    return
  }
  try {
    const res = await fetch(`${url}/rest/v1/escala_leitura_log`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(linha),
    })
    if (!res.ok) {
      console.error(`[escala-leitura-log] insert falhou: ${res.status} ${(await res.text()).slice(0, 200)}`)
    }
  } catch (err) {
    console.error('[escala-leitura-log] insert falhou:', err instanceof Error ? err.message : String(err))
  }
}
