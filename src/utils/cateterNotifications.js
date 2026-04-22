/**
 * Helpers para notificação de cateteres peridurais.
 *
 * Público: TODOS os anestesistas + residentes ativos.
 * LGPD: conteúdo sem nome de paciente, sem dados clínicos. Só iniciais
 *   (2 letras) e hospital/setor + link para o detalhe.
 */

/**
 * Retorna IDs dos usuários que devem receber notificações de cateter:
 * role === 'anestesiologista' ou 'medico-residente', ativos.
 */
export function getCateterRecipients(users) {
  if (!Array.isArray(users)) return [];
  return users
    .filter((u) => {
      if (!u?.id) return false;
      if (u.active === false) return false;
      return u.role === 'anestesiologista' || u.role === 'medico-residente';
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

  if (evento === 'novo') {
    subject = 'Novo cateter peridural registrado';
    content = `Cateter peridural inserido${iniciais ? ` (paciente ${iniciais})` : ''}${localSuffix}.`;
    priority = 'alta';
  } else if (evento === 'evolucao') {
    subject = 'Evolução de cateter peridural';
    const diaLabel = diaPo ? ` — ${diaPo}º PO` : '';
    content = `Nova evolução registrada${iniciais ? ` para cateter (paciente ${iniciais})` : ''}${diaLabel}${localSuffix}.`;
  } else if (evento === 'retirada') {
    subject = 'Cateter peridural retirado';
    content = `Cateter peridural retirado${iniciais ? ` (paciente ${iniciais})` : ''}${localSuffix}.`;
  } else {
    subject = 'Atualização de cateter peridural';
    content = `Cateter peridural atualizado${iniciais ? ` (paciente ${iniciais})` : ''}${localSuffix}.`;
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
    relatedEntityId: cateterId,
    dismissable: true,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}
