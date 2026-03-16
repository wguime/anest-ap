/**
 * Email Notification Service — fire-and-forget via Supabase Edge Function
 *
 * Invoca a Edge Function `notify-incident` para enviar emails.
 */
import { supabase } from '@/config/supabase'

export async function notifyNewIncidentEmail({
  protocolo,
  tipoIdentificacao,
  notificanteName,
  notificanteEmail,
  notificanteFuncao,
  notificanteSetor,
  severidade,
  categoriaIncidente,
  descricaoResumo,
}) {
  try {
    // LGPD: strip personal data for confidential reports
    const isConfidential = tipoIdentificacao === 'confidencial';

    const { error } = await supabase.functions.invoke('notify-incident', {
      body: {
        tipo: 'incidente',
        protocolo,
        tipoIdentificacao: tipoIdentificacao || 'anonimo',
        notificanteName: isConfidential ? '' : (notificanteName || ''),
        notificanteEmail: isConfidential ? '' : (notificanteEmail || ''),
        notificanteFuncao: isConfidential ? '' : (notificanteFuncao || ''),
        notificanteSetor: isConfidential ? '' : (notificanteSetor || ''),
        severidade: severidade || '',
        categoria: categoriaIncidente || '',
        descricaoResumo: (descricaoResumo || '').substring(0, 200),
      },
    })
    if (error) console.warn('[EmailNotification] Edge function error:', error)
  } catch (err) {
    console.warn('[EmailNotification] Failed to send incident email:', err)
  }
}

export async function notifyNewDenunciaEmail({
  protocolo,
  tipoIdentificacao,
  notificanteName,
  notificanteEmail,
  categoriaDenuncia,
  descricaoResumo,
}) {
  try {
    // LGPD: strip personal data for confidential reports
    const isConfidential = tipoIdentificacao === 'confidencial';

    const { error } = await supabase.functions.invoke('notify-incident', {
      body: {
        tipo: 'denuncia',
        protocolo,
        tipoIdentificacao: tipoIdentificacao || 'anonimo',
        notificanteName: isConfidential ? '' : (notificanteName || ''),
        notificanteEmail: isConfidential ? '' : (notificanteEmail || ''),
        categoria: categoriaDenuncia || '',
        descricaoResumo: (descricaoResumo || '').substring(0, 200),
      },
    })
    if (error) console.warn('[EmailNotification] Edge function error:', error)
  } catch (err) {
    console.warn('[EmailNotification] Failed to send denuncia email:', err)
  }
}
