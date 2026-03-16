import { ShieldAlert, AlertTriangle } from 'lucide-react';

/**
 * Configuração de temas para páginas de acompanhamento
 * Permite unificar o layout entre denúncias e incidentes
 */
export const TRACKING_THEMES = {
  denuncia: {
    type: 'denuncia',
    pageTitle: 'Acompanhar Denúncia',
    summaryTitle: 'Resumo da Denúncia',
    notFoundTitle: 'Denúncia não encontrada',
    notFoundDescription: 'O relato solicitado não foi encontrado ou você não tem permissão para visualizá-lo.',
    primaryColor: '#EF4444',
    primaryColorDark: '#F87171',
    trackingCodeVariant: 'error',
    conclusionVariant: 'error',
    defaultResponder: 'Comitê de Ética',
    footerContact: 'Em caso de dúvidas, entre em contato com o Comitê de Ética',
    showPrivacyNote: true,
    Icon: ShieldAlert,
  },
  incidente: {
    type: 'incidente',
    pageTitle: 'Acompanhar Relato',
    summaryTitle: 'Resumo do Relato',
    notFoundTitle: 'Incidente não encontrado',
    notFoundDescription: 'O relato solicitado não foi encontrado ou você não tem permissão para visualizá-lo.',
    primaryColor: '#006837',
    primaryColorDark: '#2ECC71',
    trackingCodeVariant: 'warning',
    conclusionVariant: 'success',
    defaultResponder: 'Equipe de Qualidade',
    footerContact: 'Seus dados estão protegidos conforme a LGPD',
    showPrivacyNote: false,
    Icon: AlertTriangle,
  },
};

/**
 * Função utilitária para formatar datas
 */
export const formatDate = (dateStr, includeTime = false) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('pt-BR', options);
};

/**
 * Mapeamento de status do histórico para status do Timeline DS
 */
export const mapStatusToTimelineStatus = (status, isLast) => {
  // O último item é sempre 'active', os anteriores são 'completed'
  if (isLast) return 'active';
  return 'completed';
};
