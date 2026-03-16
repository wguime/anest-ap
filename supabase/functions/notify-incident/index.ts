/**
 * Edge Function: notify-incident
 *
 * Envia email de notificacao ao criar incidente ou denuncia.
 * Usa Gmail SMTP com App Password.
 *
 * Env vars necessarias:
 *   SMTP_USER - email Gmail remetente (ex: anestcomiteetica@gmail.com)
 *   SMTP_PASS - App Password de 16 caracteres
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

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
  descricaoResumo?: string
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
  const color = isTipo ? '#006837' : '#DC2626'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:${color};padding:20px;text-align:center">
      <h1 style="color:white;margin:0;font-size:20px">${title}</h1>
    </div>
    <div style="padding:20px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:4px 8px;color:#666">Protocolo:</td><td style="padding:4px 8px;font-weight:bold;font-family:monospace;font-size:16px">${escapeHtml(payload.protocolo)}</td></tr>
        ${payload.categoria ? `<tr><td style="padding:4px 8px;color:#666">Categoria:</td><td style="padding:4px 8px">${escapeHtml(payload.categoria)}</td></tr>` : ''}
        ${payload.severidade ? `<tr><td style="padding:4px 8px;color:#666">Severidade:</td><td style="padding:4px 8px">${escapeHtml(payload.severidade)}</td></tr>` : ''}
        ${buildNotificanteSection(payload)}
      </table>
      ${payload.descricaoResumo ? `
        <div style="background:#f9fafb;padding:12px;border-radius:6px;border-left:4px solid ${color}">
          <p style="margin:0 0 4px;font-size:12px;color:#666">Descricao resumida:</p>
          <p style="margin:0;font-size:14px">${escapeHtml(payload.descricaoResumo)}</p>
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    if (!smtpUser || !smtpPass) {
      console.warn('[notify-incident] SMTP_USER/SMTP_PASS not set, skipping email')
      return new Response(
        JSON.stringify({ skipped: true, reason: 'SMTP credentials not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
