/**
 * Mapeamento de cores por tipo de no do organograma
 * CORES BASEADAS NO PDF Organograma2025.pdf
 *
 * Tipos:
 * - governance: Assembleia Geral (verde escuro #006837)
 * - executive: Coordenador Geral (azul escuro #1565C0)
 * - technical: Responsavel Tecnico (laranja #FF9800)
 * - admin: Auxiliar Administrativo (oliva #7D8B69)
 * - committee: Comites (verde claro #4CAF50)
 * - operational: Areas operacionais (branco #F5F5F5)
 * - advisory: Comites consultivos (branco + borda tracejada)
 */

export const NODE_COLORS = {
  // Assembleia Geral - VERDE ESCURO/TEAL (do PDF)
  governance: {
    label: 'Governanca',
    light: {
      bg: 'bg-[#E8F5E9]',
      bgHover: 'hover:bg-[#C8E6C9]',
      border: 'border-[#006837]',
      text: 'text-[#004225]',
      icon: 'text-[#006837]',
      accent: '#006837',
    },
    dark: {
      bg: 'dark:bg-[#1B5E20]',
      bgHover: 'dark:hover:bg-[#2E7D32]',
      border: 'dark:border-[#2ECC71]',
      text: 'dark:text-[#A5D6A7]',
      icon: 'dark:text-[#2ECC71]',
      accent: '#2ECC71',
    },
    hex: {
      light: { bg: '#E8F5E9', border: '#006837', text: '#004225', accent: '#006837' },
      dark: { bg: '#1B5E20', border: '#2ECC71', text: '#A5D6A7', accent: '#2ECC71' },
    },
  },

  // Coordenador Geral - AZUL ESCURO (do PDF)
  executive: {
    label: 'Executivo',
    light: {
      bg: 'bg-[#E3F2FD]',
      bgHover: 'hover:bg-[#BBDEFB]',
      border: 'border-[#1565C0]',
      text: 'text-[#0D47A1]',
      icon: 'text-[#1565C0]',
      accent: '#1565C0',
    },
    dark: {
      bg: 'dark:bg-[#1A237E]',
      bgHover: 'dark:hover:bg-[#283593]',
      border: 'dark:border-[#64B5F6]',
      text: 'dark:text-[#90CAF9]',
      icon: 'dark:text-[#64B5F6]',
      accent: '#64B5F6',
    },
    hex: {
      light: { bg: '#E3F2FD', border: '#1565C0', text: '#0D47A1', accent: '#1565C0' },
      dark: { bg: '#1A237E', border: '#64B5F6', text: '#90CAF9', accent: '#64B5F6' },
    },
  },

  // Responsavel Tecnico - LARANJA/AMBER (do PDF)
  technical: {
    label: 'Tecnico',
    light: {
      bg: 'bg-[#FFF3E0]',
      bgHover: 'hover:bg-[#FFE0B2]',
      border: 'border-[#FF9800]',
      text: 'text-[#E65100]',
      icon: 'text-[#FF9800]',
      accent: '#FF9800',
    },
    dark: {
      bg: 'dark:bg-[#3E2723]',
      bgHover: 'dark:hover:bg-[#4E342E]',
      border: 'dark:border-[#FFB74D]',
      text: 'dark:text-[#FFB74D]',
      icon: 'dark:text-[#FFB74D]',
      accent: '#FFB74D',
    },
    hex: {
      light: { bg: '#FFF3E0', border: '#FF9800', text: '#E65100', accent: '#FF9800' },
      dark: { bg: '#3E2723', border: '#FFB74D', text: '#FFB74D', accent: '#FFB74D' },
    },
  },

  // Auxiliar Administrativo - VERDE OLIVA/CINZA (do PDF)
  admin: {
    label: 'Administrativo',
    light: {
      bg: 'bg-[#F1F4E9]',
      bgHover: 'hover:bg-[#E4EAD5]',
      border: 'border-[#7D8B69]',
      text: 'text-[#5A6548]',
      icon: 'text-[#7D8B69]',
      accent: '#7D8B69',
    },
    dark: {
      bg: 'dark:bg-[#2A3028]',
      bgHover: 'dark:hover:bg-[#353D32]',
      border: 'dark:border-[#9CA88A]',
      text: 'dark:text-[#B4C4A0]',
      icon: 'dark:text-[#9CA88A]',
      accent: '#9CA88A',
    },
    hex: {
      light: { bg: '#F1F4E9', border: '#7D8B69', text: '#5A6548', accent: '#7D8B69' },
      dark: { bg: '#2A3028', border: '#9CA88A', text: '#B4C4A0', accent: '#9CA88A' },
    },
  },

  // Comites - VERDE CLARO (do PDF)
  committee: {
    label: 'Comite',
    light: {
      bg: 'bg-[#E8F5E9]',
      bgHover: 'hover:bg-[#C8E6C9]',
      border: 'border-[#4CAF50]',
      text: 'text-[#2E7D32]',
      icon: 'text-[#4CAF50]',
      accent: '#4CAF50',
    },
    dark: {
      bg: 'dark:bg-[#2E4A32]',
      bgHover: 'dark:hover:bg-[#3A5A3E]',
      border: 'dark:border-[#66BB6A]',
      text: 'dark:text-[#81C784]',
      icon: 'dark:text-[#66BB6A]',
      accent: '#66BB6A',
    },
    hex: {
      light: { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32', accent: '#4CAF50' },
      dark: { bg: '#2E4A32', border: '#66BB6A', text: '#81C784', accent: '#66BB6A' },
    },
  },

  // Areas Operacionais - BRANCO/MUITO CLARO (do PDF)
  operational: {
    label: 'Operacional',
    light: {
      bg: 'bg-white',
      bgHover: 'hover:bg-[#FAFAFA]',
      border: 'border-[#E0E0E0]',
      text: 'text-[#424242]',
      icon: 'text-[#9E9E9E]',
      accent: '#9E9E9E',
    },
    dark: {
      bg: 'dark:bg-[#1A2420]',
      bgHover: 'dark:hover:bg-[#243530]',
      border: 'dark:border-[#3A4A42]',
      text: 'dark:text-[#B0BEC5]',
      icon: 'dark:text-[#6B8178]',
      accent: '#6B8178',
    },
    hex: {
      light: { bg: '#FFFFFF', border: '#E0E0E0', text: '#424242', accent: '#9E9E9E' },
      dark: { bg: '#1A2420', border: '#3A4A42', text: '#B0BEC5', accent: '#6B8178' },
    },
  },

  // Comites Consultivos - BRANCO + BORDA TRACEJADA (do PDF)
  advisory: {
    label: 'Consultivo',
    light: {
      bg: 'bg-white/90',
      bgHover: 'hover:bg-[#F5F5F5]',
      border: 'border-dashed border-[#9E9E9E]',
      text: 'text-[#616161]',
      icon: 'text-[#757575]',
      accent: '#9E9E9E',
    },
    dark: {
      bg: 'dark:bg-[#1A2420]/70',
      bgHover: 'dark:hover:bg-[#243530]',
      border: 'dark:border-dashed dark:border-[#6B8178]',
      text: 'dark:text-[#A3B8B0]',
      icon: 'dark:text-[#6B8178]',
      accent: '#6B8178',
    },
    hex: {
      light: { bg: '#FFFFFF', border: '#9E9E9E', text: '#616161', accent: '#9E9E9E' },
      dark: { bg: '#1A2420', border: '#6B8178', text: '#A3B8B0', accent: '#6B8178' },
    },
  },
};

/**
 * Retorna as classes Tailwind para um tipo de no
 * @param {string} tipo - Tipo do no
 * @returns {object} Objeto com classes para bg, border, text, icon, accent
 */
export const getNodeClasses = (tipo) => {
  const colors = NODE_COLORS[tipo] || NODE_COLORS.operational;
  return {
    bg: `${colors.light.bg} ${colors.dark.bg}`,
    bgHover: `${colors.light.bgHover} ${colors.dark.bgHover}`,
    border: `${colors.light.border} ${colors.dark.border}`,
    text: `${colors.light.text} ${colors.dark.text}`,
    icon: `${colors.light.icon} ${colors.dark.icon}`,
    accent: colors.light.accent,
    accentDark: colors.dark.accent,
  };
};

/**
 * Retorna as cores hex para um tipo de no
 * @param {string} tipo - Tipo do no
 * @param {boolean} isDark - Se esta em dark mode
 * @returns {object} Objeto com bg, border, text, accent em hex
 */
export const getNodeHexColors = (tipo, isDark = false) => {
  const colors = NODE_COLORS[tipo] || NODE_COLORS.operational;
  return isDark ? colors.hex.dark : colors.hex.light;
};

/**
 * Icones sugeridos para cada tipo de no (Lucide)
 */
export const NODE_ICONS = {
  governance: 'Building2',
  executive: 'UserCog',
  technical: 'Stethoscope',
  admin: 'ClipboardList',
  committee: 'Users',
  operational: 'Briefcase',
  advisory: 'MessageSquare',
};

/**
 * Retorna o nome do icone Lucide para um tipo de no
 * @param {string} tipo - Tipo do no
 * @returns {string} Nome do icone Lucide
 */
export const getNodeIcon = (tipo) => {
  return NODE_ICONS[tipo] || NODE_ICONS.operational;
};

/**
 * Tipos de nos disponiveis para selecao
 */
export const NODE_TYPES = [
  { value: 'governance', label: 'Governanca' },
  { value: 'executive', label: 'Executivo' },
  { value: 'technical', label: 'Tecnico' },
  { value: 'admin', label: 'Administrativo' },
  { value: 'committee', label: 'Comite' },
  { value: 'operational', label: 'Operacional' },
  { value: 'advisory', label: 'Consultivo' },
];

export default NODE_COLORS;
