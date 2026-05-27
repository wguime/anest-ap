/**
 * Constantes compartilhadas do módulo Reuniões.
 * Fonte única de verdade — consumido por ReunioesPage, ReuniaoCard,
 * ReuniaoDetalhePage e NovaReuniaoModal.
 *
 * Cores mapeadas para tokens do DS (Tailwind) — NUNCA hex hardcoded.
 */
import { Users, ShieldCheck, Stethoscope, BookOpen, CalendarClock, ClipboardList } from 'lucide-react';

export const TIPOS_REUNIAO = [
  {
    id: 'comite_qualidade',
    title: 'Comitê de Qualidade',
    subtitle: 'Análise crítica mensal',
    icon: ShieldCheck,
    iconWrapperClass: 'bg-success/15',
    iconClass: 'text-success',
    badgeClass: 'bg-success/15 text-success',
    frequencia: 'Mensal',
  },
  {
    id: 'reuniao_equipe',
    title: 'Reunião de Equipe',
    subtitle: 'Alinhamento operacional',
    icon: Users,
    iconWrapperClass: 'bg-info/15',
    iconClass: 'text-info',
    badgeClass: 'bg-info/15 text-info',
    frequencia: 'Semanal',
  },
  {
    id: 'morbimortalidade',
    title: 'Morbimortalidade',
    subtitle: 'Revisão de casos clínicos',
    icon: Stethoscope,
    iconWrapperClass: 'bg-destructive/15',
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
    frequencia: 'Mensal',
  },
  {
    id: 'sessao_cientifica',
    title: 'Sessão Científica',
    subtitle: 'Atualização e educação',
    icon: BookOpen,
    iconWrapperClass: 'bg-category-purple/15',
    iconClass: 'text-category-purple',
    badgeClass: 'bg-category-purple/15 text-category-purple',
    frequencia: 'Quinzenal',
  },
  {
    id: 'planejamento',
    title: 'Planejamento',
    subtitle: 'Metas e estratégia',
    icon: CalendarClock,
    iconWrapperClass: 'bg-warning/15',
    iconClass: 'text-warning',
    // text-warning (âmbar) garante contraste em light+dark; text-warning-foreground
    // era preto em ambos os modos → ilegível sobre bg-warning/15 no dark.
    badgeClass: 'bg-warning/15 text-warning',
    frequencia: 'Trimestral',
  },
  {
    id: 'auditoria_interna',
    title: 'Auditoria Interna',
    subtitle: 'Revisão de conformidade',
    icon: ClipboardList,
    iconWrapperClass: 'bg-muted',
    iconClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
    frequencia: 'Semestral',
  },
];

export const TIPO_REUNIAO_BY_ID = Object.fromEntries(
  TIPOS_REUNIAO.map(t => [t.id, t])
);

export function getTipoReuniao(id) {
  return TIPO_REUNIAO_BY_ID[id] || TIPOS_REUNIAO[1];
}

/**
 * Badge DS variant config per meeting type.
 * Use with <Badge variant={...} badgeStyle={...}> instead of manual span+badgeClass.
 */
export const TIPO_BADGE_CONFIG = {
  comite_qualidade: { variant: 'success', badgeStyle: 'subtle' },
  reuniao_equipe: { variant: 'info', badgeStyle: 'subtle' },
  morbimortalidade: { variant: 'destructive', badgeStyle: 'subtle' },
  sessao_cientifica: { variant: 'default', badgeStyle: 'subtle' },
  planejamento: { variant: 'warning', badgeStyle: 'subtle' },
  auditoria_interna: { variant: 'secondary', badgeStyle: 'subtle' },
};

/**
 * Perfis convocáveis para uma reunião.
 * Usados como chips categóricos → tokens DS (semânticos + categóricos).
 */
export const PERFIS_CONVOCADOS = [
  {
    key: 'anestesiologista',
    label: 'Anestesiologista',
    chipSolidClass: 'bg-info text-info-foreground',
    chipSoftClass: 'bg-info/15 text-info',
  },
  {
    key: 'medico-residente',
    label: 'Médico Residente',
    chipSolidClass: 'bg-category-purple text-category-purple-foreground',
    chipSoftClass: 'bg-category-purple/15 text-category-purple',
  },
  {
    key: 'enfermeiro',
    label: 'Enfermeiro',
    chipSolidClass: 'bg-success text-success-foreground',
    chipSoftClass: 'bg-success/15 text-success',
  },
  {
    key: 'tec-enfermagem',
    label: 'Téc. Enfermagem',
    chipSolidClass: 'bg-category-cyan text-category-cyan-foreground',
    chipSoftClass: 'bg-category-cyan/15 text-category-cyan',
  },
  {
    key: 'farmaceutico',
    label: 'Farmacêutico',
    chipSolidClass: 'bg-category-pink text-category-pink-foreground',
    chipSoftClass: 'bg-category-pink/15 text-category-pink',
  },
  {
    key: 'colaborador',
    label: 'Colaborador',
    chipSolidClass: 'bg-category-indigo text-category-indigo-foreground',
    chipSoftClass: 'bg-category-indigo/15 text-category-indigo',
  },
  {
    key: 'secretaria',
    label: 'Secretária',
    chipSolidClass: 'bg-warning text-warning-foreground',
    chipSoftClass: 'bg-warning/15 text-warning',
  },
];

export const PERFIL_CONVOCADO_BY_KEY = Object.fromEntries(
  PERFIS_CONVOCADOS.map(p => [p.key, p])
);

// ============================================================================
// DELIBERAÇÕES & VOTAÇÕES
// ============================================================================

export const DELIBERACAO_TIPOS = [
  { value: 'aprovacao', label: 'Aprovação', variant: 'success' },
  { value: 'recomendacao', label: 'Recomendação', variant: 'info' },
  { value: 'encaminhamento', label: 'Encaminhamento', variant: 'warning' },
  { value: 'informativa', label: 'Informativa', variant: 'secondary' },
];

export const DELIBERACAO_STATUS = {
  aberta: { label: 'Aberta', variant: 'success' },
  fechada: { label: 'Fechada', variant: 'secondary' },
  aprovada: { label: 'Aprovada', variant: 'info' },
  rejeitada: { label: 'Rejeitada', variant: 'destructive' },
  adiada: { label: 'Adiada', variant: 'warning' },
};

export const VOTO_OPTIONS = [
  { value: 'favor', label: 'A favor' },
  { value: 'contra', label: 'Contra' },
  { value: 'abstencao', label: 'Abstenção' },
];

export const VOTO_VARIANT_MAP = {
  favor: 'success',
  contra: 'destructive',
  abstencao: 'secondary',
};
