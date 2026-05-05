/**
 * Email Notification Service — fire-and-forget via Supabase Edge Function
 *
 * Invoca a Edge Function `notify-incident` para enviar emails.
 *
 * Falhas (incl. SMTP_NOT_CONFIGURED após Fase 4.3) emitem CustomEvent
 * `email-notification-failure` no window e gravam linha em
 * `infra_health_history` (retenção 90d) para que admins percebam.
 */
import { supabase } from '@/config/supabase'

async function logEmailFailure(category, payload, errorMessage) {
  // Best-effort log → infra_health_history. Falha de log não propaga.
  try {
    await supabase.from('infra_health_history').insert({
      category: 'email_notification_failure',
      severity: category === 'denuncia' ? 'critical' : 'warning',
      message: errorMessage || 'unknown',
      context: {
        notification_kind: category,
        protocolo: payload?.protocolo || null,
        tipoIdentificacao: payload?.tipoIdentificacao || null,
      },
    })
  } catch (logErr) {
    console.warn('[EmailNotification] Failed to log to infra_health_history:', logErr)
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
