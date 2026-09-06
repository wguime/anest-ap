/**
 * Edge Function: notify-incident
 *
 * Envia email de notificacao ao criar incidente ou denuncia.
 * Usa Gmail SMTP com App Password.
 *
 * Env vars necessarias:
 *   SMTP_USER - email Gmail remetente (ex: anestcomiteetica@gmail.com)
 *   SMTP_PASS - App Password de 16 caracteres
 *
 * Auth (auditoria 04/09/2026): deploy com --no-verify-jwt. Com verify_jwt=true o
 * gateway rejeitava o ID token Firebase RS256 (401 UNAUTHORIZED_ASYMMETRIC_JWT) —
 * desde a Third-Party Auth (10/06) nenhum e-mail do app saía. A verificação passa
 * a ser feita aqui: Firebase RS256 ou HS256 legado via _shared/verify-auth.ts, e
 * a anon key do projeto (formulário público, sem sessão) continua aceita como antes.
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"
import { verifyAuthHeader } from '../_shared/verify-auth.ts'
import { jwtVerify } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface NotifyPayload {
  tipo: 'incidente' | 'denuncia'
  protocolo: string
  tipoIdentificacao: 'identificado' | 'confidencial' | 'anonimo'
  notificanteName?: string
  notificanteEmail?: string
  notificanteFuncao?: string
  notificanteSetor?: string
  severidade?: string
  categoria?: string
  subtipo?: string
  descricaoResumo?: string
  isNeverEvent?: boolean
  neverEventCode?: string
  source?: 'app' | 'formulario_publico' | 'externo' | 'interno'
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildNotificanteSection(payload: NotifyPayload): string {
  switch (payload.tipoIdentificacao) {
    case 'identificado':
      return `
        <tr><td style="padding:4px 8px;color:#666">Notificante:</td><td style="padding:4px 8px">${escapeHtml(payload.notificanteName || 'N/A')}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Funcao:</td><td style="padding:4px 8px">${escapeHtml(payload.notificanteFuncao || 'N/A')}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Setor:</td><td style="padding:4px 8px">${escapeHtml(payload.notificanteSetor || 'N/A')}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Email:</td><td style="padding:4px 8px">${escapeHtml(payload.notificanteEmail || 'N/A')}</td></tr>
      `
    case 'confidencial':
      return `
        <tr><td colspan="2" style="padding:4px 8px;color:#D97706;font-weight:bold">CONFIDENCIAL - Dados restritos ao gestor externo</td></tr>
      `
    case 'anonimo':
    default:
      return `
        <tr><td colspan="2" style="padding:4px 8px;color:#6B7280;font-style:italic">Relato Anonimo</td></tr>
      `
  }
}

function buildEmailHtml(payload: NotifyPayload): string {
  const isTipo = payload.tipo === 'incidente'
  const title = isTipo ? 'Nova Notificacao de Incidente' : 'Nova Denuncia Registrada'
  // NE override: incidente Never Event tem header em vermelho urgente.
  const isUrgent = !!payload.isNeverEvent
  const color = isUrgent ? '#B91C1C' : (isTipo ? '#006837' : '#DC2626')
  const categoriaText = payload.categoria
    ? (payload.subtipo ? `${payload.categoria} → ${payload.subtipo}` : payload.categoria)
    : ''
  const sourceLabel = payload.source === 'formulario_publico'
    ? 'Submetido via formulário público (QR/link)'
    : payload.source === 'externo'
    ? 'Submetido via canal externo'
    : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:${color};padding:20px;text-align:center">
      <h1 style="color:white;margin:0;font-size:20px">${title}</h1>
      ${isUrgent ? `<p style="color:#FEE2E2;margin:8px 0 0;font-size:13px;font-weight:bold;letter-spacing:0.5px">NEVER EVENT — RCA obrigatoria em 45 dias (JCAHO)${payload.neverEventCode ? ' · ' + escapeHtml(payload.neverEventCode) : ''}</p>` : ''}
    </div>
    <div style="padding:20px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:4px 8px;color:#666">Protocolo:</td><td style="padding:4px 8px;font-weight:bold;font-family:monospace;font-size:16px">${escapeHtml(payload.protocolo)}</td></tr>
        ${categoriaText ? `<tr><td style="padding:4px 8px;color:#666">Categoria:</td><td style="padding:4px 8px">${escapeHtml(categoriaText)}</td></tr>` : ''}
        ${payload.severidade ? `<tr><td style="padding:4px 8px;color:#666">Severidade:</td><td style="padding:4px 8px">${escapeHtml(payload.severidade)}</td></tr>` : ''}
        ${sourceLabel ? `<tr><td style="padding:4px 8px;color:#666">Origem:</td><td style="padding:4px 8px;font-style:italic">${escapeHtml(sourceLabel)}</td></tr>` : ''}
        ${buildNotificanteSection(payload)}
      </table>
      ${payload.descricaoResumo ? `
        <div style="background:#f9fafb;padding:12px;border-radius:6px;border-left:4px solid ${color}">
          <p style="margin:0 0 4px;font-size:12px;color:#666">Descricao:</p>
          <p style="margin:0;font-size:14px;word-wrap:break-word;white-space:pre-wrap">${escapeHtml(payload.descricaoResumo)}</p>
        </div>
      ` : ''}
      <div style="margin-top:20px;text-align:center">
        <a href="https://anest-ap.web.app" style="display:inline-block;background:${color};color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          Acessar Sistema ANEST
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:12px;text-align:center;font-size:11px;color:#999">
      Este email foi gerado automaticamente pelo sistema ANEST. Nao responda a este email.
    </div>
  </div>
</body>
</html>`
}

/**
 * Quem pode disparar o e-mail: usuário autenticado (Firebase RS256 ou HS256
 * legado) OU o formulário público, que chama com a anon key como Bearer —
 * exatamente o que o gateway já aceitava com verify_jwt=true.
 */
async function authorize(req: Request): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const header = req.headers.get('authorization')
  const auth = await verifyAuthHeader(header)
  if (auth.ok) return { ok: true }

  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : ''

  // Chamada interna do próprio projeto: a edge `relato-publico` (canal público do
  // QR code) manda a service role key. Comparação por IGUALDADE, não por
  // assinatura: as chaves novas do Supabase (sb_secret_…, sb_publishable_…) não
  // são JWT, e verificar assinatura devolvia 401 — foi assim que o e-mail do
  // formulário público sumiu no teste de 06/09/2026.
  const interna = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (bearer && interna && bearer.length === interna.length && bearer === interna) {
    return { ok: true }
  }

  // Formulário público antigo: supabase-js sem sessão mandava a anon key como
  // Bearer — JWT HS256 do projeto com role=anon e sem `sub` (por isso
  // verifyAuthHeader recusa). Mantido para não quebrar página em cache.
  const jwtSecret = Deno.env.get('JWT_SECRET')
  if (bearer && jwtSecret) {
    try {
      const { payload } = await jwtVerify(bearer, new TextEncoder().encode(jwtSecret), { algorithms: ['HS256'] })
      if (payload.role === 'anon' || payload.role === 'service_role') return { ok: true }
    } catch {
      // não é chave do projeto — cai no erro do helper abaixo
    }
  }
  return { ok: false, status: auth.status, reason: auth.reason }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authz = await authorize(req)
  if (!authz.ok) {
    return new Response(
      JSON.stringify({ error: authz.reason }),
      { status: authz.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    if (!smtpUser || !smtpPass) {
      // Fase 4.3 — fail-loud: retornar 500 para que o caller registre falha em
      // infra_health_history e admins saibam que a notificacao nao foi entregue.
      // Antes retornavamos 200 com `skipped:true`, mascarando ausencia de SMTP em prod.
      console.error('[notify-incident] SMTP_USER/SMTP_PASS not set — email NOT sent')
      return new Response(
        JSON.stringify({
          error: 'SMTP_NOT_CONFIGURED',
          message: 'Edge Function notify-incident sem credenciais SMTP. Configure SMTP_USER + SMTP_PASS via supabase secrets set.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload: NotifyPayload = await req.json()

    if (!payload.tipo || !payload.protocolo) {
      return new Response(
        JSON.stringify({ error: 'Missing tipo or protocolo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const to = payload.tipo === 'denuncia'
      ? 'anestdenuncia@gmail.com'
      : 'anestnotificacao@gmail.com'

    const subject = payload.tipo === 'denuncia'
      ? `[ANEST] Nova Denuncia - ${payload.protocolo}`
      : `[ANEST] Nova Notificacao de Incidente - ${payload.protocolo}`

    const html = buildEmailHtml(payload)

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    await client.send({
      from: `ANEST <${smtpUser}>`,
      to: to,
      subject,
      content: "auto",
      html,
    })

    await client.close()

    console.log('[notify-incident] Email sent to:', to)

    return new Response(
      JSON.stringify({ success: true, to }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[notify-incident] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
