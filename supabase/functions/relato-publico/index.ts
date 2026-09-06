/**
 * Edge Function: relato-publico
 *
 * Porta única do canal anônimo (o QR code → public/formulario-*.html).
 * Nasceu em 06/09/2026 para resolver duas coisas de uma vez:
 *
 *   1. ANEXO. O formulário público não aceitava arquivo nenhum — quem estava de
 *      fora relatava sem poder mandar a foto ou o PDF, e a apuração começava sem
 *      prova. O caminho do anexo é `pasta/PROTOCOLO/uuid.ext`, mas o protocolo só
 *      nascia DEPOIS do INSERT (trigger). Aqui ele é reservado antes
 *      (rpc_reservar_protocolo), o que permite subir o arquivo já no lugar certo
 *      — e mantém o cleanup de órfãos funcionando, que cruza o 2º segmento do
 *      caminho com a coluna `protocolo`.
 *
 *   2. VOLUME. `rpc_submit_public_incident` era executável direto pela chave
 *      anon, sem IP e sem janela: dava para encher a caixa dos responsáveis. As
 *      três verify-*-public já tinham limite; esta não. Agora todo envio público
 *      passa por aqui e conta no mesmo `documento_api_rate_limit`.
 *
 * Ações (POST, campo `acao`):
 *   preparar → { protocolo, uploads: [{ name, path, signedUrl, token }] }
 *   enviar   → { protocolo, tracking_code }
 * Relato sem anexo chama só `enviar`.
 *
 * O arquivo NÃO passa por aqui: `createSignedUploadUrl` deixa o navegador subir
 * direto no Storage, que aplica `file_size_limit` e `allowed_mime_types` do balde
 * no servidor. Poupa os 256 MB de memória e os 2 s de CPU da função.
 *
 * Deploy: bash scripts/deploy-edge-with-pat.sh relato-publico --no-verify-jwt
 * (chamador é anônimo por desenho; a proteção é o limite por IP, não o JWT).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// CORS '*' como as demais públicas: o QR é aberto de qualquer lugar.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const BUCKET = 'incidentes-anexos'   // hardcoded (padrão pdfa-convert): nunca vem do cliente
const MAX_COUNT = 3                   // decisão do dono 05/09/2026
const MAX_BYTES = 10 * 1024 * 1024    // 10 MB por arquivo no canal público

/**
 * Espelha allowed_mime_types do balde (migration 20260906120000). HEIC/HEIF são
 * o formato padrão da câmera do iPhone — sem eles metade do grupo não anexa foto.
 */
const MIME_PERMITIDOS = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
])
/** Fallback quando o navegador manda `type` vazio (acontece com HEIC). */
const MIME_POR_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
}

interface ArquivoDeclarado { nome?: string; tamanho?: number; mime?: string }
interface AnexoEnviado { path?: string; size?: number; type?: string; name?: string }

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** IP do chamador — primeiro elemento do x-forwarded-for, como nas verify-*-public. */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Extensão segura: só alfanumérica, até 10 chars. Exige ponto no nome — sem
 * isso "arquivo" devolveria a si mesmo e viraria `uuid.arquivo` no caminho.
 * Mesma regra de `anexoExtensao` em public/incidentes-shared.js.
 */
function extensaoSegura(nome: string): string {
  const texto = String(nome || '')
  if (!texto.includes('.')) return ''
  const ext = texto.split('.').pop() || ''
  return /^[a-zA-Z0-9]{1,10}$/.test(ext) ? ext.toLowerCase() : ''
}

function pastaAnexo(tipo: string, anonimo: boolean): string {
  return (tipo === 'denuncia' ? 'denuncias' : 'incidentes') + (anonimo ? '-anon' : '')
}

/**
 * Limite por IP. Erro `rate_limited` (P0001) da RPC vira 429 aqui. Lê o erro como
 * JSON, no padrão da verify-cert-uuid-public (a mais recente), com fallback textual.
 */
async function checarLimite(
  sb: ReturnType<typeof createClient>, ip: string, endpoint: string,
): Promise<{ ok: true } | { ok: false; resposta: Response }> {
  const { error } = await sb.rpc('rpc_check_relato_publico_rate_limit', {
    p_ip: ip, p_endpoint: endpoint,
  })
  if (!error) return { ok: true }

  const texto = `${error.message || ''} ${error.code || ''}`
  if (error.code === 'P0001' || texto.includes('rate_limited')) {
    return {
      ok: false,
      resposta: new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '600' },
      }),
    }
  }
  console.error('relato-publico: rate limit falhou', error.code)
  return { ok: false, resposta: jsonResponse(500, { error: 'internal_error' }) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    console.error('relato-publico: SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
    return jsonResponse(500, { error: 'server_misconfigured' })
  }
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return jsonResponse(400, { error: 'invalid_payload' })
  }

  const acao = String(body.acao || '')
  const tipo = String(body.tipo || '')
  if (tipo !== 'incidente' && tipo !== 'denuncia') {
    return jsonResponse(400, { error: 'invalid_payload' })
  }
  const ip = clientIp(req)

  // ────────────────────────────────────────────────────────────────────────
  // preparar — reserva o protocolo e devolve uma URL de upload por arquivo
  // ────────────────────────────────────────────────────────────────────────
  if (acao === 'preparar') {
    const limite = await checarLimite(sb, ip, 'relato-publico-preparar')
    if (!limite.ok) return limite.resposta

    const anonimo = body.anonimo === true
    const arquivos = Array.isArray(body.arquivos) ? body.arquivos as ArquivoDeclarado[] : []
    if (arquivos.length === 0 || arquivos.length > MAX_COUNT) {
      return jsonResponse(400, { error: 'invalid_files', detail: `1 a ${MAX_COUNT} arquivos` })
    }

    // Validação do que o cliente DECLARA. O que vale de verdade é o balde, que
    // barra tipo e tamanho no servidor — isto aqui só devolve erro legível antes
    // de gastar upload.
    const preparados: { nome: string; ext: string; mime: string }[] = []
    for (const arq of arquivos) {
      const ext = extensaoSegura(String(arq?.nome || ''))
      const mime = String(arq?.mime || '') || MIME_POR_EXT[ext] || ''
      const tamanho = Number(arq?.tamanho)
      if (!ext || !MIME_PERMITIDOS.has(mime)) {
        return jsonResponse(400, { error: 'invalid_file_type' })
      }
      if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > MAX_BYTES) {
        return jsonResponse(400, { error: 'invalid_file_size' })
      }
      preparados.push({ nome: String(arq?.nome || ''), ext, mime })
    }

    const { data: protocolo, error: protoErr } = await sb.rpc('rpc_reservar_protocolo', {
      p_tipo: tipo,
    })
    if (protoErr || !protocolo) {
      console.error('relato-publico: reserva de protocolo falhou', protoErr?.code)
      return jsonResponse(500, { error: 'internal_error' })
    }

    const pasta = pastaAnexo(tipo, anonimo)
    const uploads: { name: string; path: string; signedUrl: string; token: string }[] = []
    for (let i = 0; i < preparados.length; i++) {
      const p = preparados[i]
      const path = `${pasta}/${String(protocolo).replace(/[^a-zA-Z0-9-]/g, '')}/${crypto.randomUUID()}.${p.ext}`
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data) {
        console.error('relato-publico: signed upload url falhou', error?.message?.slice(0, 120))
        return jsonResponse(500, { error: 'internal_error' })
      }
      uploads.push({
        // LGPD B1: em relato anônimo o nome original nunca é persistido — ele
        // embute identidade ("Digitalização de Fulano.pdf", export de WhatsApp).
        name: anonimo ? `evidencia-${i + 1}.${p.ext}` : p.nome,
        path,
        signedUrl: data.signedUrl,
        token: data.token,
      })
    }

    return jsonResponse(200, { protocolo, uploads })
  }

  // ────────────────────────────────────────────────────────────────────────
  // enviar — grava o relato (com ou sem anexo) e dispara o e-mail
  // ────────────────────────────────────────────────────────────────────────
  if (acao === 'enviar') {
    const limite = await checarLimite(sb, ip, 'relato-publico-enviar')
    if (!limite.ok) return limite.resposta

    const notificante = (body.notificante ?? {}) as Record<string, unknown>
    const denunciante = (body.denunciante ?? {}) as Record<string, unknown>
    const identificacao = String(
      (tipo === 'denuncia' ? denunciante.tipoIdentificacao : notificante.tipoIdentificacao) || '',
    )
    const anonimo = identificacao === 'anonimo'

    // O nome é reescrito AQUI, não aceito do cliente: em relato anônimo ele vira
    // evidencia-N e não vaza identidade pelo nome do arquivo.
    const enviados = Array.isArray(body.attachments) ? body.attachments as AnexoEnviado[] : []
    const attachments = enviados.slice(0, MAX_COUNT).map((a, i) => {
      const path = String(a?.path || '')
      const ext = extensaoSegura(path)
      return {
        name: anonimo ? `evidencia-${i + 1}.${ext || 'bin'}` : String(a?.name || ''),
        path,
        size: Number(a?.size) || 0,
        type: String(a?.type || ''),
      }
    })

    const { data, error } = await sb.rpc('rpc_submit_public_incident', {
      p_tipo: tipo,
      p_source: 'formulario_publico',
      p_status: 'pending',
      p_notificante: notificante,
      p_denunciante: denunciante,
      p_incidente_data: body.incidente_data ?? {},
      p_denuncia_data: body.denuncia_data ?? {},
      p_impacto: body.impacto ?? {},
      p_contexto_anest: body.contexto_anest ?? {},
      p_lgpd_consent_at: anonimo ? null : (body.lgpd_consent_at ?? new Date().toISOString()),
      p_protocolo: body.protocolo ?? null,
      p_attachments: attachments,
    })
    if (error) {
      // Mensagem do Postgres não vaza para um endereço público.
      console.error('relato-publico: submit falhou', error.code, error.message?.slice(0, 160))
      const recusa = error.code === '22023'
      return jsonResponse(recusa ? 400 : 500, { error: recusa ? 'invalid_payload' : 'internal_error' })
    }

    const resultado = data as { protocolo?: string; tracking_code?: string } | null

    // E-mail à caixa institucional. Passou a sair daqui (antes era disparo do
    // navegador sem await, que se perdia se a pessoa fechasse a aba na tela de
    // sucesso). Vai com a service role key: o `SUPABASE_ANON_KEY` do ambiente da
    // edge não é o mesmo JWT que está no HTML público, e a chamada voltava 401 —
    // o e-mail do canal público sumiu em silêncio até o teste de 06/09/2026.
    const chaveInterna = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (chaveInterna && resultado?.protocolo) {
      const emailBody = (body.email ?? {}) as Record<string, unknown>
      fetch(`${url}/functions/v1/notify-incident`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${chaveInterna}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...emailBody,
          tipo,
          protocolo: resultado.protocolo,
          tipoIdentificacao: identificacao || 'anonimo',
          source: 'formulario_publico',
        }),
      }).catch((err) => console.warn('relato-publico: notify-incident falhou', String(err).slice(0, 120)))
    }

    return jsonResponse(200, {
      protocolo: resultado?.protocolo ?? null,
      tracking_code: resultado?.tracking_code ?? null,
    })
  }

  return jsonResponse(400, { error: 'invalid_action' })
})
