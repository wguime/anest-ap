// Configuracao de tipos de documentos compartilhada entre BibliotecaPage e PermissionsPage
// Este arquivo centraliza as definicoes para manter sincronizacao

import {
  FileText,
  Scale,
  ClipboardCheck,
  BookOpen,
  BarChart2,
  GitBranch,
  FileSignature,
  AlertTriangle,
  Target
} from 'lucide-react';

// Tipos de documentos com icones, cores e ordem de exibicao
export const TIPO_CONFIG = {
  protocolo: {
    label: 'Protocolos',
    icon: FileText,
    color: '#059669',
    order: 1
  },
  politica: {
    label: 'Políticas',
    icon: Scale,
    color: '#6366F1',
    order: 2
  },
  formulario: {
    label: 'Formulários',
    icon: ClipboardCheck,
    color: '#F59E0B',
    order: 3
  },
  manual: {
    label: 'Manuais',
    icon: BookOpen,
    color: '#EC4899',
    order: 4
  },
  relatorio: {
    label: 'Relatórios',
    icon: BarChart2,
    color: '#3B82F6',
    order: 5
  },
  processo: {
    label: 'Processos',
    icon: GitBranch,
    color: '#8B5CF6',
    order: 6
  },
  termo: {
    label: 'Termos',
    icon: FileSignature,
    color: '#14B8A6',
    order: 7
  },
  risco: {
    label: 'Riscos',
    icon: AlertTriangle,
    color: '#DC2626',
    order: 8
  },
  plano: {
    label: 'Planos',
    icon: Target,
    color: '#0891B2',
    order: 9
  },
  etica: {
    label: 'Ética e Bioética',
    icon: Scale,
    color: '#006837',
    order: 10
  },
};

// Setores disponiveis para documentos
export const SETORES = [
  { id: 'anestesia', nome: 'Anestesia' },
  { id: 'cuidados-gerais', nome: 'Cuidados Gerais' },
  { id: 'seguranca-hospitalar', nome: 'Segurança Hospitalar' },
  { id: 'nutricao', nome: 'Nutrição' },
  { id: 'rpa', nome: 'RPA' },
  { id: 'cirurgia', nome: 'Cirurgia' },
  { id: 'gestao', nome: 'Gestão' },
  { id: 'qmentum', nome: 'Qmentum' },
  { id: 'etica-bioetica', nome: 'Ética e Bioética' },
  { id: 'gestao-dilemas-bioeticos', nome: 'Gestão de Dilemas Bioéticos' },
  { id: 'comite-etica', nome: 'Comitê de Ética' },
];

// Helper para obter configuracao de tipo
export const getTipoConfig = (tipo) => {
  return TIPO_CONFIG[tipo] || { label: tipo, icon: FileText, color: '#059669', order: 99 };
};

// Helper para obter nome do setor
export const getSetorNome = (setorId) => {
  const setor = SETORES.find(s => s.id === setorId);
  return setor?.nome || setorId;
};

// Status de documentos - importar de @/types/documents para o SSOT
// Mantido para retrocompatibilidade visual (label + color)
// SSOT: import { DOCUMENT_STATUS, STATUS_LABELS, STATUS_COLORS } from '@/types/documents'
export { DOCUMENT_STATUS as DOC_STATUS_KEYS, STATUS_LABELS, STATUS_COLORS } from '@/types/documents';

// Helper para formatar data de documento
export const formatDocDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Helpers de revisao - agora importados do SSOT
// Mantidos como re-exports para retrocompatibilidade
export { isRevisaoVencida, diasAteRevisao } from '@/types/documents';
