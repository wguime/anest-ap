// Configuracao centralizada dos tipos de documentos de desastres
// Segue o padrao de COMITE_TIPO_CONFIG de comitesConfig.js

import {
  BookOpen,
  UsersRound,
  HeartHandshake,
  ClipboardList,
} from 'lucide-react';

export const DESASTRE_TIPO_CONFIG = {
  manual_gestao: {
    label: 'Manual de Gestão',
    icon: BookOpen,
    color: '#2563eb',
    order: 1,
  },
  times_gerenciamento: {
    label: 'Times de Gerenciamento',
    icon: UsersRound,
    color: '#059669',
    order: 2,
  },
  apoio_psicologico: {
    label: 'Apoio Psicológico',
    icon: HeartHandshake,
    color: '#059669',
    order: 3,
  },
  simulado_srpa: {
    label: 'Simulados de Emergência',
    icon: ClipboardList,
    color: '#64748b',
    order: 4,
  },
};

export const getDesastreConfig = (tipo) => {
  return DESASTRE_TIPO_CONFIG[tipo] || {
    label: tipo,
    icon: BookOpen,
    color: '#059669',
    order: 99,
  };
};
