/**
 * Email Notification Service — fire-and-forget via Supabase Edge Function
 *
 * Invoca a Edge Function `notify-incident` para enviar emails.
 *
 * Falhas (incl. SMTP_NOT_CONFIGURED após Fase 4.3) emitem CustomEvent
 * `email-notification-failure` no window e vão para o sink de erros do app
 * (`reportError` → Sentry/Analytics). Auditoria 04/09/2026: o insert anterior
 * em `infra_health_history` usava colunas que a tabela não tem (42703) — a
 * falha de e-mail era engolida em silêncio desde a Third-Party Auth (10/06).
 */
import { supabase } from '@/config/supabase'
import { reportError } from './errorReporting'

async function logEmailFailure(category, payload, errorMessage) {
  // Best-effort — falha de log não propaga. Sem dado pessoal: só protocolo e tipo.
  try {
    reportError(new Error(`email_notification_failure(${category}): ${errorMessage || 'unknown'}`), {
      route: 'incidentes',
      fatal: false,
      protocolo: payload?.protocolo || null,
      tipoIdentificacao: payload?.tipoIdentificacao || null,
    })
  } catch (logErr) {
    console.warn('[EmailNotification] Failed to report email failure:', logErr)
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('email-notification-failure', {
      detail: { category, errorMessage, protocolo: payload?.protocolo },
    }))
  }
}

export async function notifyNewIncidentEmail({
  protocolo,
  tipoIdentificacao,
  notificanteName,
  notificanteEmail,
  notificanteFuncao,
  notificanteSetor,
  severidade,
  categoriaIncidente,
  subtipo,
  descricaoResumo,
  isNeverEvent,
  neverEventCode,
  source,
}) {
  const payload = {
    tipo: 'incidente',
    protocolo,
    tipoIdentificacao: tipoIdentificacao || 'anonimo',
  }
  try {
    const isConfidential = tipoIdentificacao === 'confidencial'
    Object.assign(payload, {
      notificanteName: isConfidential ? '' : (notificanteName || ''),
      notificanteEmail: isConfidential ? '' : (notificanteEmail || ''),
      notificanteFuncao: isConfidential ? '' : (notificanteFuncao || ''),
      notificanteSetor: isConfidential ? '' : (notificanteSetor || ''),
      severidade: severidade || '',
      categoria: categoriaIncidente || '',
      subtipo: subtipo || '',
      descricaoResumo: descricaoResumo || '',
      isNeverEvent: !!isNeverEvent,
      neverEventCode: neverEventCode || '',
      source: source || 'app',
    })
    const { data, error } = await supabase.functions.invoke('notify-incident', { body: payload })
    if (error) {
      console.warn('[EmailNotification] Edge function error:', error)
      await logEmailFailure('incidente', payload, error.message || String(error))
      return
    }
    if (data && data.error) {
      console.warn('[EmailNotification] Edge function reported error:', data.error)
      await logEmailFailure('incidente', payload, data.error)
    }
  } catch (err) {
    console.warn('[EmailNotification] Failed to send incident email:', err)
    await logEmailFailure('incidente', payload, err?.message || String(err))
  }
}

export async function notifyNewDenunciaEmail({
  protocolo,
  tipoIdentificacao,
  notificanteName,
  notificanteEmail,
  categoriaDenuncia,
  descricaoResumo,
  source,
}) {
  const payload = {
    tipo: 'denuncia',
    protocolo,
    tipoIdentificacao: tipoIdentificacao || 'anonimo',
  }
  try {
    const isConfidential = tipoIdentificacao === 'confidencial'
    Object.assign(payload, {
      notificanteName: isConfidential ? '' : (notificanteName || ''),
      notificanteEmail: isConfidential ? '' : (notificanteEmail || ''),
      categoria: categoriaDenuncia || '',
      descricaoResumo: descricaoResumo || '',
      source: source || 'app',
    })
    const { data, error } = await supabase.functions.invoke('notify-incident', { body: payload })
    if (error) {
      console.warn('[EmailNotification] Edge function error:', error)
      await logEmailFailure('denuncia', payload, error.message || String(error))
      return
    }
    if (data && data.error) {
      console.warn('[EmailNotification] Edge function reported error:', data.error)
      await logEmailFailure('denuncia', payload, data.error)
    }
  } catch (err) {
    console.warn('[EmailNotification] Failed to send denuncia email:', err)
    await logEmailFailure('denuncia', payload, err?.message || String(err))
  }
}
