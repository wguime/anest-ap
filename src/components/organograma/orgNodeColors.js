/**
 * Mapeamento de cores por tipo de nó do organograma.
 *
 * CORES FIÉIS AO PDF Organograma2025.pdf — definidas como tokens CSS
 * `--org-{tipo}-{slot}` em `src/styles/anest-theme.css` (light + dark) e
 * registradas no Tailwind como famílias `org-{tipo}` (tailwind.config.js).
 *
 * Consumo:
 * - Classes Tailwind: `bg-org-{tipo}-bg`, `border-org-{tipo}-border`, etc. → getNodeClasses()
 * - Inline-style dinâmico: `style={{ backgroundColor: colors.bg }}` com var() → getNodeHexColors()
 *
 * Os tokens trocam light/dark automaticamente (antes o dark nunca era aplicado
 * pois getNodeHexColors recebia isDark hardcoded `false`).
 *
 * Tipos:
 * - governance: Assembleia Geral (verde escuro)
 * - executive: Coordenador Geral (azul escuro)
 * - technical: Responsável Técnico (laranja)
 * - admin: Auxiliar Administrativo (oliva)
 * - committee: Comitês (verde claro)
 * - operational: Áreas operacionais (branco)
 * - advisory: Comitês consultivos (branco + borda tracejada)
 */

const LABELS = {
  governance: 'Governanca',
  executive: 'Executivo',
  technical: 'Tecnico',
  admin: 'Administrativo',
  committee: 'Comite',
  operational: 'Operacional',
  advisory: 'Consultivo',
};

/** Referência var() para um slot do tipo (resolve o tema atual automaticamente). */
const token = (tipo, slot) => `var(--org-${tipo}-${slot})`;

/**
 * Mapa de tipos → tokens var() (consumidos via inline-style). Theme-adaptive.
 *
 * Obs.: as cores do organograma são aplicadas via inline-style (`style={{}}`)
 * com `var(--org-*)`, NÃO via classes Tailwind. Classes `bg-org-*` montadas
 * dinamicamente (`bg-org-${tipo}-bg`) seriam purgadas pelo JIT do Tailwind —
 * por isso o consumo é sempre inline via getNodeHexColors().
 */
export const NODE_COLORS = Object.fromEntries(
  Object.keys(LABELS).map((tipo) => [
    tipo,
    {
      label: LABELS[tipo],
      vars: {
        bg: token(tipo, 'bg'),
        border: token(tipo, 'border'),
        text: token(tipo, 'text'),
        icon: token(tipo, 'icon'),
        accent: token(tipo, 'accent'),
      },
    },
  ])
);

const resolveTipo = (tipo) => (NODE_COLORS[tipo] ? tipo : 'operational');

/**
 * Retorna as cores para inline-style (var() — resolvem o tema atual automaticamente).
 * O parâmetro `isDark` é mantido por compatibilidade de assinatura, mas ignorado
 * (os CSS vars já trocam por tema via `.dark`).
 * @param {string} tipo - Tipo do nó
 * @returns {{bg:string,border:string,text:string,accent:string}}
 */
export const getNodeHexColors = (tipo) => {
  const { vars } = NODE_COLORS[resolveTipo(tipo)];
  return { bg: vars.bg, border: vars.border, text: vars.text, accent: vars.accent };
};

/**
 * Ícones sugeridos para cada tipo de nó (Lucide)
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
 * Retorna o nome do ícone Lucide para um tipo de nó
 * @param {string} tipo - Tipo do nó
 * @returns {string} Nome do ícone Lucide
 */
export const getNodeIcon = (tipo) => {
  return NODE_ICONS[tipo] || NODE_ICONS.operational;
};

/**
 * Tipos de nós disponíveis para seleção
 */
export const NODE_TYPES = Object.entries(LABELS).map(([value, label]) => ({ value, label }));

export default NODE_COLORS;
