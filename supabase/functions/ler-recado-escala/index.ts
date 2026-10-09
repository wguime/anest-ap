// ler-recado-escala — transcreve o PRINT de um recado do WhatsApp (dono 09/10/2026).
//
// "Quero que sejam possíveis enviar prints assim como faço para publicar as escalas aqui."
// Esta edge NÃO interpreta o recado: só devolve as mensagens como texto, no mesmo formato
// que o WhatsApp dá ao copiar. Quem decide o que cada frase vira é `src/lib/escalaRecados.js`
// — o mesmo leitor do texto colado, testado com o recado real. Assim a regra mora num lugar
// só e a IA nunca "decide" uma troca.
//
// Deploy (a função valida o token por dentro, como a parse-escala-cirurgica):
//   bash scripts/deploy-edge-with-pat.sh ler-recado-escala --no-verify-jwt
// Secret: ANTHROPIC_API_KEY (o mesmo da leitura das escalas).
//
// LGPD: recado de escala não traz paciente; mesmo assim nada é gravado aqui — sem log de
// conteúdo, sem cache. Só a contagem vai ao console.

import { verifyAuthHeader } from '../_shared/verify-auth.ts'

/** Transcrição de texto num print é tarefa leve: o modelo menor basta. Se ele não
 *  estiver disponível na conta, cai para o da leitura das escalas (já medido). */
const MODELOS = ['claude-haiku-5-5', 'claude-opus-4-8']

const DEFAULT_ALLOWED_ORIGINS = [
  'https://anest-ap.web.app',
  'https://anest-ap.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
]
const ENV_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...ENV_ORIGINS])

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://anest-ap.web.app'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const SYSTEM = [
  'Você transcreve capturas de tela de conversas do WhatsApp de um grupo de anestesistas.',
  'Transcreva TODAS as mensagens visíveis, de cima para baixo, exatamente como escritas:',
  '- mantenha as menções com @ e o nome como aparece ("@Gabriel Anest", "@Guilherme R1");',
  '- mantenha as quebras de linha DENTRO da mensagem (listas como "P1 @Fulano" ficam uma por linha);',
  '- "hora" é o horário que aparece no balão (HH:MM); vazio se não aparecer;',
  '- ignore cabeçalho do app, barra de digitação, reações e figurinhas;',
  '- mensagem cortada na borda: transcreva o que dá para ler, sem completar;',
  '- não corrija, não resuma, não invente nomes.',
].join('\n')

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mensagens'],
  properties: {
    mensagens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hora', 'texto'],
        properties: { hora: { type: 'string' }, texto: { type: 'string' } },
      },
    },
  },
}

const json = (cors: Record<string, string>, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const auth = await verifyAuthHeader(req.headers.get('authorization'))
  if (!auth.ok) return json(cors, auth.status, { error: 'unauthorized', reason: auth.reason })

  try {
    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return json(cors, 400, { error: 'imageBase64 ausente' })
    const mime = String(mimeType || 'image/png').toLowerCase()
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
      return json(cors, 415, { error: 'mimeType de imagem não suportado' })
    }
    if (String(imageBase64).length > 12_000_000) return json(cors, 413, { error: 'imagem excede o limite de tamanho' })

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json(cors, 200, { error: 'ia_falhou', iaStatus: 401, iaTipo: 'authentication_error', iaMensagem: 'ANTHROPIC_API_KEY não configurado' })

    let ultimo: { status: number; tipo: string; mensagem: string } | null = null
    for (const modelo of MODELOS) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 2000,
          system: SYSTEM,
          output_config: { format: { type: 'json_schema', schema: SCHEMA } },
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } },
              { type: 'text', text: 'Transcreva as mensagens desta captura.' },
            ],
          }],
        }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}))
        ultimo = { status: res.status, tipo: corpo?.error?.type || '', mensagem: corpo?.error?.message || '' }
        // modelo indisponível na conta → tenta o próximo; o resto é falha de verdade
        if (res.status === 404 || corpo?.error?.type === 'not_found_error') continue
        break
      }
      const data = await res.json()
      const texto = (data?.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('')
      let mensagens: Array<{ hora: string; texto: string }> = []
      try { mensagens = JSON.parse(texto)?.mensagens || [] } catch { mensagens = [] }
      mensagens = mensagens
        .map((m) => ({ hora: String(m?.hora || '').trim(), texto: String(m?.texto || '').trim() }))
        .filter((m) => m.texto)
      console.log(`[ler-recado-escala] uid=${auth.uid} modelo=${modelo} mensagens=${mensagens.length} in=${data?.usage?.input_tokens} out=${data?.usage?.output_tokens}`)
      return json(cors, 200, { mensagens, modelo })
    }
    return json(cors, 200, { error: 'ia_falhou', iaStatus: ultimo?.status || 500, iaTipo: ultimo?.tipo || '', iaMensagem: ultimo?.mensagem || '' })
  } catch (err) {
    console.error('[ler-recado-escala] falha', (err as Error)?.message)
    return json(cors, 500, { error: 'falha inesperada' })
  }
})
