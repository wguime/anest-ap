/**
 * Configuração compartilhada das 6 macro-áreas ROP — Wave 1.6 T1.6.4 + T1.6.8
 *
 * Substitui os 6 hex hardcoded em MACRO_AREAS:17-60 (regra design-tokens).
 * Single source of truth para icon + tokens DS de cada área.
 *
 * IMPORTANTE: classes Tailwind devem ser strings ESTÁTICAS (JIT não compila
 * concatenação dinâmica). Por isso bg/text/border são literais.
 */
import { Shield, MessageSquare, Pill, Users, Sparkles, AlertTriangle } from 'lucide-react';

export const AREA_CONFIG = {
  'cultura-seguranca': {
    title: 'Cultura de Segurança',
    icon: Shield,
    categoryToken: 'category-purple',
    iconBg: 'bg-category-purple-bg',
    iconFg: 'text-category-purple-fg',
    accentBorder: 'border-category-purple',
    cardAccent: 'bg-category-purple',
  },
  'comunicacao': {
    title: 'Comunicação',
    icon: MessageSquare,
    categoryToken: 'category-teal',
    iconBg: 'bg-category-teal-bg',
    iconFg: 'text-category-teal-fg',
    accentBorder: 'border-category-teal',
    cardAccent: 'bg-category-teal',
  },
  'uso-medicamentos': {
    title: 'Uso de Medicamentos',
    icon: Pill,
    categoryToken: 'category-blue',
    iconBg: 'bg-category-blue-bg',
    iconFg: 'text-category-blue-fg',
    accentBorder: 'border-category-blue',
    cardAccent: 'bg-category-blue',
  },
  'vida-profissional': {
    title: 'Vida Profissional',
    icon: Users,
    categoryToken: 'category-green',
    iconBg: 'bg-category-green-bg',
    iconFg: 'text-category-green-fg',
    accentBorder: 'border-category-green-fg',
    cardAccent: 'bg-category-green-fg',
  },
  'prevencao-infeccoes': {
    title: 'Prevenção de Infecções',
    icon: Sparkles,
    categoryToken: 'category-orange',
    iconBg: 'bg-category-orange-bg',
    iconFg: 'text-category-orange-fg',
    accentBorder: 'border-category-orange',
    cardAccent: 'bg-category-orange',
  },
  'avaliacao-riscos': {
    title: 'Avaliação de Riscos',
    icon: AlertTriangle,
    categoryToken: 'category-cyan',
    iconBg: 'bg-category-cyan-bg',
    iconFg: 'text-category-cyan-fg',
    accentBorder: 'border-category-cyan',
    cardAccent: 'bg-category-cyan',
  },
};

export const AREA_SLUGS = Object.keys(AREA_CONFIG);

export function getAreaConfig(slug) {
  return AREA_CONFIG[slug] || {
    title: slug,
    icon: Shield,
    categoryToken: 'category-teal',
    iconBg: 'bg-muted',
    iconFg: 'text-muted-foreground',
    accentBorder: 'border-border',
    cardAccent: 'bg-muted',
  };
}
