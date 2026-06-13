/**
 * Helpers para notificação de cateteres peridurais.
 *
 * Público: TODOS os anestesistas + residentes ativos.
 * LGPD: conteúdo sem nome de paciente, sem dados clínicos. Só iniciais
 *   (2 letras) e hospital/setor + link para o detalhe.
 */
import { normalizeRole } from '@/utils/userTypes';

/**
 * Retorna IDs dos usuários que devem receber notificações de cateter:
 * role normalizado === 'anestesiologista' ou 'medico-residente', ativos.
 * Usa normalizeRole para capturar aliases legados ('medico', 'medico-staff',
 * 'anestesista', 'residente'...).
 */
export function getCateterRecipients(users) {
  if (!Array.isArray(users)) return [];
  return users
    .filter((u) => {
      if (!u?.id) return false;
      if (u.active === false) return false;
      const canonical = normalizeRole(u.role);
      return canonical === 'anestesiologista' || canonical === 'medico-residente';
    })
    .map((u) => u.id);
}

/**
 * Extrai iniciais do nome do paciente (max 2 letras maiúsculas).
 * "João da Silva" → "JS"
 * "Maria Lúcia Pereira Santos" → "MP"
 */
export function pacienteIniciais(nomeCompleto) {
  if (!nomeCompleto || typeof nomeCompleto !== 'string') return '';
  const parts = nomeCompleto
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 && !['de', 'da', 'do', 'das', 'dos'].includes(p.toLowerCase()));
  const first = parts[0]?.[0] || '';
  const last = parts[parts.length - 1]?.[0] || '';
  return (first + last).toUpperCase();
}

/**
 * Thresholds (em horas desde a inserção) que disparam alerta periódico.
 * Alinhado com WARNING_DURATION_HOURS / MAX_DURATION_HOURS de cateterPeridualConfig.
 */
export const CATETER_REMINDER_THRESHOLDS = [
  { hours: 24, key: '24h', label: 'PO1', priority: 'normal' },
  { hours: 48, key: '48h', label: 'PO2', priority: 'normal' },
  { hours: 72, key: '72h', label: 'warning', priority: 'alta' },
  { hours: 96, key: '96h', label: 'critical', priority: 'urgente' },
]

/**
 * Payload de notificação para eventos de cateter peridural.
 * @param {{
 *   evento: 'novo' | 'evolucao' | 'retirada',
 *   cateterId: string,
 *   pacienteNome?: string,
 *   hospital?: string,
 *   setor?: string,
 *   diaPo?: number,
 *   recipientIds: string[],
 * }} args
 */
export function buildCateterNotificationPayload({
  evento,
  cateterId,
  followupId,
  pacienteNome,
  hospital,
  setor,
  diaPo,
  recipientIds,
}) {
  const iniciais = pacienteIniciais(pacienteNome);
  const localSuffix = hospital ? ` — ${hospital.toUpperCase()}${setor ? `/${setor}` : ''}` : (setor ? ` — ${setor}` : '');

  let subject;
  let content;
  let priority = 'normal';
  // relatedEntityId precisa ser ÚNICO POR EVENTO. A tabela notifications tem um
  // índice único parcial (related_entity_type, related_entity_id, recipient_id)
  // WHERE related_entity_id IS NOT NULL. Usar só o cateterId fazia a 2ª+ evolução
  // do mesmo cateter colidir e o batch inteiro falhar (silenciado) — por isso as
  // notificações de cateter pararam de chegar. Cada evento ganha uma chave própria;
  // evolução usa o id do followup (idempotente, sem colidir com outras evoluções).
  let relatedEntityId;

  if (evento === 'novo') {
    subject = 'Novo cateter peridural registrado';
    content = `Cateter peridural inserido${iniciais ? ` (paciente ${iniciais})` : ''}${localSuffix}.`;
    priority = 'alta';
    relatedEntityId = `cateter_${cateterId}_novo`;
  } else if (evento === 'evolucao') {
    subject = 'Evolução de cateter peridural';
    const diaLabel = diaPo ? ` — ${diaPo}º PO` : '';
    content = `Nova evolução registrada${iniciais ? ` para cateter (paciente ${iniciais})` : ''}${diaLabel}${localSuffix}.`;
    relatedEntityId = followupId ? `cateter_evolucao_${followupId}` : `cateter_${cateterId}_evolucao`;
  } else if (evento === 'retirada') {
    subject = 'Cateter peridural retirado';
    content = `Cateter peridural retirado${iniciais ? ` (paciente ${iniciais})` : ''}${localSuffix}.`;
    relatedEntityId = `cateter_${cateterId}_retirada`;
  } else {
    subject = 'Atualização de cateter peridural';
    content = `Cateter peridural atualizado${iniciais ? ` (paciente ${iniciais})` : ''}${localSuffix}.`;
    relatedEntityId = `cateter_${cateterId}_update`;
  }

  return {
    category: 'cateter',
    subject,
    content,
    senderName: 'Gestão de Cateteres',
    priority,
    actionUrl: 'cateterDetalhe',
    actionLabel: 'Ver Cateter',
    actionParams: { cateterId },
    relatedEntityType: 'cateter-peridural',
    relatedEntityId,
    dismissable: true,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}

/**
 * Payload de notificação periódica (alerta de duração) para cateter ativo.
 * @param {{
 *   thresholdKey: '24h' | '48h' | '72h' | '96h',
 *   cateterId: string,
 *   pacienteNome?: string,
 *   hospital?: string,
 *   setor?: string,
 *   recipientIds: string[],
 * }} args
 */
export function buildCateterReminderPayload({
  thresholdKey,
  cateterId,
  pacienteNome,
  hospital,
  setor,
  recipientIds,
}) {
  const threshold = CATETER_REMINDER_THRESHOLDS.find((t) => t.key === thresholdKey);
  if (!threshold) {
    throw new Error(`Threshold inválido: ${thresholdKey}`);
  }

  const iniciais = pacienteIniciais(pacienteNome);
  const localSuffix = hospital ? ` — ${hospital.toUpperCase()}${setor ? `/${setor}` : ''}` : (setor ? ` — ${setor}` : '');
  const pacienteSuffix = iniciais ? ` (paciente ${iniciais})` : '';

  let subject;
  let content;
  if (thresholdKey === '24h') {
    subject = 'Cateter peridural ativo há 24h — registrar PO1';
    content = `Cateter peridural completou 24h${pacienteSuffix}${localSuffix}. Registre a avaliação de 1º PO (sítio, neuro, Bromage).`;
  } else if (thresholdKey === '48h') {
    subject = 'Cateter peridural ativo há 48h — registrar PO2';
    content = `Cateter peridural completou 48h${pacienteSuffix}${localSuffix}. Registre a avaliação de 2º PO.`;
  } else if (thresholdKey === '72h') {
    subject = 'Atenção: cateter peridural com 72h ativo';
    content = `Cateter peridural atingiu 72h${pacienteSuffix}${localSuffix}. Próximo do limite de 96h — planejar retirada.`;
  } else if (thresholdKey === '96h') {
    subject = 'CRÍTICO: cateter peridural excedeu 96h';
    content = `Cateter peridural excedeu 96h${pacienteSuffix}${localSuffix}. Retirar imediatamente.`;
  }

  return {
    category: 'cateter',
    subject,
    content,
    senderName: 'Gestão de Cateteres',
    priority: threshold.priority,
    actionUrl: 'cateterDetalhe',
    actionLabel: 'Ver Cateter',
    actionParams: { cateterId },
    relatedEntityType: 'cateter-peridural-reminder',
    relatedEntityId: `cateter-reminder_${cateterId}_${thresholdKey}`,
    dismissable: true,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}
