/**
 * notificacaoEducacaoService.js
 * Serviço de notificações para prazos de educação continuada.
 *
 * Verifica prazos de cursos/trilhas e gera notificações:
 *  - Cursos com prazo < 7 dias  → tipo "warning" (amarelo)
 *  - Cursos atrasados (prazo expirado) → tipo "error" (vermelho)
 *
 * Retorna array de objetos de notificação para consumo pelo componente de UI.
 */

import { calcularDiasRestantes } from '../pages/educacao/data/educacaoUtils';

/**
 * @typedef {Object} NotificacaoEducacao
 * @property {'warning'|'error'} tipo - Tipo da notificação
 * @property {string} mensagem - Mensagem descritiva
 * @property {string} cursoId - ID do curso relacionado
 * @property {string|null} trilhaId - ID da trilha relacionada (se aplicável)
 * @property {Date|null} dataLimite - Data limite para conclusão
 * @property {number|null} diasRestantes - Dias restantes (negativo = atrasado)
 */

/**
 * Gera notificações de prazo para um usuário baseado nos seus progressos e trilhas.
 *
 * @param {Object} params
 * @param {Array} params.trilhas - Todas as trilhas ativas
 * @param {Array} params.cursos - Todos os cursos
 * @param {Array} params.progressos - Progressos do usuário (array de { cursoId, progresso, ... })
 * @param {string} params.userId - ID do usuário
 * @param {Object} [params.userProfile] - Perfil do usuário (para dataAdmissao em trilhas de orientação)
 * @returns {NotificacaoEducacao[]} Array de notificações ordenadas por urgência
 */
export function gerarNotificacoesEducacao({ trilhas, cursos, progressos, userId, userProfile }) {
  const notificacoes = [];

  if (!trilhas?.length || !cursos?.length) return notificacoes;

  const progressoMap = new Map();
  (progressos || []).forEach((p) => {
    progressoMap.set(p.cursoId || p.id, p);
  });

  // Para cada trilha obrigatória, verificar prazos dos cursos
  trilhas.forEach((trilha) => {
    if (!trilha.obrigatoria || !trilha.prazoConclusao) return;
    if (trilha.ativo === false) return;

    const cursosNaTrilha = (trilha.cursos || [])
      .map((id) => cursos.find((c) => c.id === id))
      .filter(Boolean);

    cursosNaTrilha.forEach((curso) => {
      const prog = progressoMap.get(curso.id);
      const progresso = prog?.progresso || 0;

      // Já concluiu — sem notificação
      if (progresso >= 100) return;

      // Calcular dias restantes
      // Para trilhas de orientação, usar dataAdmissao do usuário
      const dataAdmissao = trilha.isOrientacao ? userProfile?.dataAdmissao : null;
      const dataBase = dataAdmissao || trilha.createdAt;
      const diasRestantes = calcularDiasRestantes(dataBase, trilha.prazoConclusao);

      if (diasRestantes === null) return;

      // Calcular data limite para exibição
      const raw = typeof dataBase?.toDate === 'function' ? dataBase.toDate()
        : typeof dataBase?.seconds === 'number' ? new Date(dataBase.seconds * 1000)
        : dataBase;
      const dataLimite = new Date(raw);
      dataLimite.setDate(dataLimite.getDate() + trilha.prazoConclusao);

      if (diasRestantes < 0) {
        // Atrasado
        notificacoes.push({
          tipo: 'error',
          mensagem: `"${curso.titulo}" esta atrasado por ${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) !== 1 ? 's' : ''} na trilha "${trilha.titulo}"`,
          cursoId: curso.id,
          trilhaId: trilha.id,
          dataLimite,
          diasRestantes,
        });
      } else if (diasRestantes <= 7) {
        // Prazo próximo
        notificacoes.push({
          tipo: 'warning',
          mensagem: diasRestantes === 0
            ? `"${curso.titulo}" vence hoje na trilha "${trilha.titulo}"`
            : `"${curso.titulo}" vence em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} na trilha "${trilha.titulo}"`,
          cursoId: curso.id,
          trilhaId: trilha.id,
          dataLimite,
          diasRestantes,
        });
      }
    });
  });

  // Ordenar: erros primeiro, depois por dias restantes (mais urgente primeiro)
  notificacoes.sort((a, b) => {
    if (a.tipo === 'error' && b.tipo !== 'error') return -1;
    if (a.tipo !== 'error' && b.tipo === 'error') return 1;
    return (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0);
  });

  return notificacoes;
}

// ============================================================================
// Qmentum: Notificacoes persistentes (Q1/Q3)
// ============================================================================

/**
 * Notifica gestor que um colaborador tem treinamento vencido.
 * Usa o central NotificationService pattern (notify callback).
 *
 * @param {Function} notify - Callback de notificacao (createSystemNotification)
 * @param {string} gestorId - ID do gestor destinatario
 * @param {string} userId - ID do colaborador
 * @param {string} userName - Nome do colaborador
 * @param {string} trilhaTitulo - Titulo da trilha vencida
 */
export function notificarTreinamentoVencido(notify, { gestorId, userId, userName, trilhaTitulo }) {
  if (!notify) return;
  notify({
    category: 'educacao',
    subject: 'Treinamento obrigatorio vencido',
    content: `O colaborador ${userName} esta com o treinamento "${trilhaTitulo}" vencido. Acesse o painel de controle para detalhes.`,
    senderName: 'Educacao Continuada',
    priority: 'urgente',
    dismissable: false,
    actionUrl: 'controleEducacao',
    actionLabel: 'Ver Controle',
    recipientId: gestorId,
  });
}

/**
 * Notifica usuario que um certificado esta expirando.
 *
 * @param {Function} notify - Callback de notificacao (createSystemNotification)
 * @param {string} userId - ID do usuario
 * @param {string} certificadoTitulo - Titulo do certificado
 * @param {number} diasRestantes - Dias ate a expiracao
 */
export function notificarCertificadoExpirando(notify, { userId, certificadoTitulo, diasRestantes }) {
  if (!notify) return;
  notify({
    category: 'educacao',
    subject: 'Certificado expirando',
    content: `Seu certificado "${certificadoTitulo}" expira em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}. Conclua o treinamento novamente para renova-lo.`,
    senderName: 'Educacao Continuada',
    priority: diasRestantes <= 7 ? 'urgente' : 'alta',
    dismissable: true,
    actionUrl: 'educacao',
    actionLabel: 'Ver Treinamentos',
    recipientId: userId,
  });
}
