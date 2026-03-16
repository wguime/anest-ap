// Configuracao de tipos de auditorias para AuditoriasPage e PermissionsPage
// Estrutura igual ao TIPO_CONFIG de documentTypes.js

import {
  Droplets,
  Pill,
  Ban,
  Shield,
  Eye,
  FileBarChart,
  ClipboardCheck,
  FileCheck,
  Stethoscope,
  Syringe,
  Activity,
  Heart,
  Thermometer,
  Droplet,
} from 'lucide-react';

// Tipos de auditorias com icones, ordem de exibicao (cor unificada DS primary)
const DS_PRIMARY = '#006837'
export const AUDITORIA_TIPO_CONFIG = {
  higiene_maos: {
    label: 'Higiene das Mãos',
    icon: Droplets,
    color: DS_PRIMARY,
    order: 1,
    frequenciaDias: 30,
    amostraLabel: 'Profissionais a observar',
    amostraDefault: 30,
  },
  uso_medicamentos: {
    label: 'Uso de Medicamentos',
    icon: Pill,
    color: DS_PRIMARY,
    order: 2,
    frequenciaDias: 90,
    amostraLabel: 'Prontuários a revisar',
    amostraDefault: 20,
  },
  abreviaturas: {
    label: 'Abreviaturas Perigosas',
    icon: Ban,
    color: DS_PRIMARY,
    order: 3,
    frequenciaDias: 90,
    amostraLabel: 'Prescrições a revisar',
    amostraDefault: 20,
  },
  politica_qualidade: {
    label: 'Política de Gestão da Qualidade',
    icon: Shield,
    color: DS_PRIMARY,
    order: 4,
    frequenciaDias: 180,
    amostraLabel: 'Processos a avaliar',
    amostraDefault: 10,
  },
  politica_disclosure: {
    label: 'Política de Disclosure',
    icon: Eye,
    color: DS_PRIMARY,
    order: 5,
    frequenciaDias: 180,
    amostraLabel: 'Registros a revisar',
    amostraDefault: 10,
  },
  relatorio_rops: {
    label: 'Relatório de Auditorias ROPs',
    icon: FileBarChart,
    color: DS_PRIMARY,
    order: 6,
    frequenciaDias: 90,
    amostraLabel: 'Prontuários a revisar',
    amostraDefault: 20,
  },
  operacional: {
    label: 'Auditorias Operacionais',
    icon: ClipboardCheck,
    color: DS_PRIMARY,
    order: 7,
    frequenciaDias: 30,
    amostraLabel: 'Procedimentos a avaliar',
    amostraDefault: 10,
  },
  conformidade: {
    label: 'Conformidade e Políticas',
    icon: FileCheck,
    color: DS_PRIMARY,
    order: 8,
    frequenciaDias: 180,
    amostraLabel: 'Prontuários a revisar',
    amostraDefault: 20,
  },
  procedimento: {
    label: 'Procedimentos Clínicos',
    icon: Stethoscope,
    color: DS_PRIMARY,
    order: 9,
    frequenciaDias: 30,
    amostraLabel: 'Pacientes a auditar',
    amostraDefault: 20,
  },
  seguranca_paciente: {
    label: 'Segurança do Paciente',
    icon: Heart,
    color: DS_PRIMARY,
    order: 10,
    frequenciaDias: 90,
    amostraLabel: 'Pacientes a auditar',
    amostraDefault: 20,
  },
  controle_infeccao: {
    label: 'Controle de Infecção',
    icon: Droplet,
    color: DS_PRIMARY,
    order: 11,
    frequenciaDias: 30,
    amostraLabel: 'Procedimentos a avaliar',
    amostraDefault: 20,
  },
  equipamentos: {
    label: 'Equipamentos Médicos',
    icon: Activity,
    color: DS_PRIMARY,
    order: 12,
    frequenciaDias: 30,
    amostraLabel: 'Equipamentos a avaliar',
    amostraDefault: 10,
  },
  vida_profissional: {
    label: 'Vida Profissional',
    icon: Heart,
    color: DS_PRIMARY,
    order: 13,
    frequenciaDias: 90,
    amostraLabel: 'Profissionais a avaliar',
    amostraDefault: 10,
  },
};

// Helper para obter configuracao de tipo
export const getAuditoriaTipoConfig = (tipo) => {
  return AUDITORIA_TIPO_CONFIG[tipo] || {
    label: tipo,
    icon: ClipboardCheck,
    color: DS_PRIMARY,
    order: 99,
    amostraLabel: 'Itens a auditar',
    amostraDefault: 10,
  };
};

// Status possiveis de auditorias
export const AUDITORIA_STATUS = {
  ativo: { label: 'Ativo', color: '#059669' },
  arquivado: { label: 'Arquivado', color: '#6B7280' },
  pendente: { label: 'Pendente', color: '#F59E0B' },
  em_revisao: { label: 'Em Revisão', color: '#3B82F6' },
};

// Helper para formatar data de auditoria
export const formatAuditoriaDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Helper para verificar se auditoria esta vencida
export const isAuditoriaVencida = (proximaAuditoria) => {
  if (!proximaAuditoria) return false;
  return new Date(proximaAuditoria) < new Date();
};

// Helper para calcular dias ate proxima auditoria
export const diasAteAuditoria = (proximaAuditoria) => {
  if (!proximaAuditoria) return null;
  const hoje = new Date();
  const auditoria = new Date(proximaAuditoria);
  const diff = auditoria.getTime() - hoje.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Categorias/Setores para auditorias
export const AUDITORIA_SETORES = [
  { id: 'ambulatorio', nome: 'Ambulatório' },
  { id: 'anestesia', nome: 'Anestesia' },
  { id: 'ccih', nome: 'CCIH' },
  { id: 'centro_cirurgico', nome: 'Centro Cirúrgico' },
  { id: 'cme', nome: 'CME' },
  { id: 'infeccao', nome: 'Controle de Infecção' },
  { id: 'emergencia', nome: 'Emergência' },
  { id: 'endoscopia', nome: 'Endoscopia' },
  { id: 'enfermaria', nome: 'Enfermaria' },
  { id: 'farmacia', nome: 'Farmácia' },
  { id: 'qualidade', nome: 'Gestão da Qualidade' },
  { id: 'imagem', nome: 'Imagem' },
  { id: 'seguranca', nome: 'Segurança do Paciente' },
  { id: 'srpa', nome: 'SRPA' },
  { id: 'uti', nome: 'UTI' },
];

// Helper para obter nome do setor
export const getAuditoriaSetorNome = (setorId) => {
  const setor = AUDITORIA_SETORES.find(s => s.id === setorId);
  return setor?.nome || setorId;
};
