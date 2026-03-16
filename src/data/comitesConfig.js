// Configuracao centralizada dos tipos de comites
// Segue o padrao de TIPO_CONFIG de documentTypes.js

import {
  FileText,
  Briefcase,
  DollarSign,
  Users,
  Calendar,
  Cpu,
  Shield,
  BookOpen,
  Scale,
  Flame,
  Network,
} from 'lucide-react';

// Tipos de comites com icones, cores e ordem de exibicao
export const COMITE_TIPO_CONFIG = {
  regimento_interno: {
    label: 'Regimento Interno',
    icon: FileText,
    color: '#2563eb',
    order: 1,
  },
  executivo: {
    label: 'Executivo de Gestão',
    icon: Briefcase,
    color: '#059669',
    order: 2,
  },
  financeiro: {
    label: 'Comitê Financeiro',
    icon: DollarSign,
    color: '#059669',
    order: 3,
  },
  gestao_pessoas: {
    label: 'Gestão de Pessoas',
    icon: Users,
    color: '#7c3aed',
    order: 4,
  },
  escalas: {
    label: 'Comitê de Escalas',
    icon: Calendar,
    color: '#f59e0b',
    order: 5,
  },
  tecnologia: {
    label: 'Tecnologia e Materiais',
    icon: Cpu,
    color: '#2563eb',
    order: 6,
  },
  qualidade: {
    label: 'Comitê de Qualidade',
    icon: Shield,
    color: '#2563eb',
    order: 7,
  },
  educacao: {
    label: 'Educação e Residência',
    icon: BookOpen,
    color: '#dc2626',
    order: 8,
  },
  etica_conduta: {
    label: 'Ética e Conduta',
    icon: Scale,
    color: '#7c3aed',
    order: 9,
  },
  desastres: {
    label: 'Emergências e Desastres',
    icon: Flame,
    color: '#dc2626',
    order: 10,
  },
  organograma: {
    label: 'Organograma Institucional',
    icon: Network,
    color: '#0891b2',
    order: 11,
  },
};

// Helper para obter configuracao de um tipo de comite
export const getComiteConfig = (tipo) => {
  return COMITE_TIPO_CONFIG[tipo] || {
    label: tipo,
    icon: FileText,
    color: '#059669',
    order: 99,
  };
};

// Helper para obter todos os tipos ordenados
export const getComiteTiposOrdenados = () => {
  return Object.entries(COMITE_TIPO_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, config]) => ({ key, ...config }));
};
