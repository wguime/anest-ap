import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  GraduationCap,
  Clock,
  Shield,
  MessageCircle,
  Pill,
  Briefcase,
  Bug,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { Button, Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { prefersReducedMotion } from '@/design-system/utils/motion';
import { formatDuracao, formatData } from '../data/educacaoUtils';

/* ------------------------------------------------------------------ */
/*  getCategoryTokens — maps categoriaId to DS category token classes */
/* ------------------------------------------------------------------ */

const CATEGORY_MAP = {
  seguranca: {
    bg: 'bg-category-teal-bg',
    fg: 'text-category-teal-fg',
    bgSoft: 'bg-category-teal-bg',
    fgStrong: 'text-category-teal-fg',
    gradientFrom: 'from-category-teal-bg',
    gradientTo: 'to-category-cyan-bg',
    Icon: Shield,
  },
  comunicacao: {
    bg: 'bg-category-blue-bg',
    fg: 'text-category-blue-fg',
    bgSoft: 'bg-category-blue-bg',
    fgStrong: 'text-category-blue-fg',
    gradientFrom: 'from-category-blue-bg',
    gradientTo: 'to-category-cyan-bg',
    Icon: MessageCircle,
  },
  medicamentos: {
    bg: 'bg-category-purple-bg',
    fg: 'text-category-purple-fg',
    bgSoft: 'bg-category-purple-bg',
    fgStrong: 'text-category-purple-fg',
    gradientFrom: 'from-category-purple-bg',
    gradientTo: 'to-category-indigo-bg',
    Icon: Pill,
  },
  'vida-profissional': {
    bg: 'bg-category-orange-bg',
    fg: 'text-category-orange-fg',
    bgSoft: 'bg-category-orange-bg',
    fgStrong: 'text-category-orange-fg',
    gradientFrom: 'from-category-orange-bg',
    gradientTo: 'to-category-teal-bg',
    Icon: Briefcase,
  },
  infeccoes: {
    bg: 'bg-category-pink-bg',
    fg: 'text-category-pink-fg',
    bgSoft: 'bg-category-pink-bg',
    fgStrong: 'text-category-pink-fg',
    gradientFrom: 'from-category-pink-bg',
    gradientTo: 'to-category-purple-bg',
    Icon: Bug,
  },
  riscos: {
    bg: 'bg-category-indigo-bg',
    fg: 'text-category-indigo-fg',
    bgSoft: 'bg-category-indigo-bg',
    fgStrong: 'text-category-indigo-fg',
    gradientFrom: 'from-category-indigo-bg',
    gradientTo: 'to-category-blue-bg',
    Icon: AlertTriangle,
  },
};

const DEFAULT_CATEGORY = {
  bg: 'bg-category-teal-bg',
  fg: 'text-category-teal-fg',
  bgSoft: 'bg-category-teal-bg',
  fgStrong: 'text-category-teal-fg',
  gradientFrom: 'from-category-teal-bg',
  gradientTo: 'to-category-cyan-bg',
  Icon: GraduationCap,
};

/**
 * Returns category design tokens based on categoriaId.
 * @param {string} categoriaId
 * @returns {{ bg, fg, bgSoft, fgStrong, gradientFrom, gradientTo, Icon }}
 */
function getCategoryTokens(categoriaId) {
  if (!categoriaId || categoriaId === 'sem-categoria') return DEFAULT_CATEGORY;
  return CATEGORY_MAP[categoriaId] || DEFAULT_CATEGORY;
}

/* ------------------------------------------------------------------ */
/*  CursoCard — redesigned to match EducacaoSummaryCard pattern       */
/* ------------------------------------------------------------------ */

/**
 * CursoCard — card de curso na listagem.
 *
 * Wave 1.7 T1.7.10: este componente NÃO consome `mockCategorias` diretamente
 * (a categoria do curso já vem embutida em `curso.categoria` via
 * `EducacaoContinuadaPage` → `useEducacao`). Quando o parent migrar para
 * `useCategorias()`, o shape de `curso.categoria` permanece o mesmo (string).
 */
export const CursoCard = memo(function CursoCard({ curso, onClick }) {
  const reduced = prefersReducedMotion();

  /* ---- Button text logic (preserved) ---- */
  const buttonText = (() => {
    switch (curso.status) {
      case 'nao_iniciado':
        return 'Iniciar';
      case 'em_andamento':
        return 'Continuar →';
      case 'concluido':
      case 'aprovado':
        return 'Revisar';
      default:
        return 'Ver Detalhes';
    }
  })();

  /* ---- Category tokens ---- */
  const catId = curso.categoria || curso.categoriaId || 'sem-categoria';
  const cat = getCategoryTokens(catId);
  const CategoryIcon = cat.Icon;

  /* ---- Progress calculation ---- */
  const totalAulas = curso.modulos?.length || 0;
  const completedAulas = curso.modulosCompletos?.length || 0;
  const progressPercent = Number(curso.progresso) || 0;

  const progressBarColor =
    progressPercent >= 80
      ? 'bg-success'
      : progressPercent >= 30
        ? 'bg-warning'
        : 'bg-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      className={cn(
        'rounded-[20px] bg-card border border-border overflow-hidden',
        'shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none',
        'hover:-translate-y-px transition-all duration-200'
      )}
    >
      {/* ---- Thumbnail area ---- */}
      <div
        className={cn(
          'aspect-video rounded-t-[20px] flex items-center justify-center',
          'bg-gradient-to-br',
          cat.gradientFrom,
          cat.gradientTo
        )}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/60 dark:bg-white/20 flex items-center justify-center">
          <CategoryIcon className={cn('w-8 h-8', cat.fg)} aria-hidden="true" />
        </div>
      </div>

      {/* ---- Content area ---- */}
      <div className="p-4 space-y-2.5">
        {/* Title row: icon circle + title + metadata */}
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
              cat.bgSoft
            )}
          >
            <BookOpen className={cn('w-4 h-4', cat.fgStrong)} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-foreground leading-snug line-clamp-2">
              {curso.titulo}
            </h3>
            {/* Meta badges inline */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {curso.obrigatorio && (
                <Badge variant="default" badgeStyle="solid" className="text-[10px] px-1.5 py-0">
                  Obrigatório
                </Badge>
              )}
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {(() => {
                  const total = curso.duracaoMinutos;
                  const status = curso.status;
                  const prog = progressPercent;
                  if (!total) return formatDuracao(total);
                  if (status === 'concluido' || status === 'aprovado') return 'Concluído';
                  if (status === 'em_andamento' && prog > 0 && prog < 100) {
                    const restante = Math.max(1, Math.round(total * (1 - prog / 100)));
                    return `~${formatDuracao(restante)}`;
                  }
                  return formatDuracao(total);
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Progress section */}
        {totalAulas > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{completedAulas}/{totalAulas}</span>{' '}
                aulas
              </span>
              <span className="font-semibold text-foreground">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-300', progressBarColor)}
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Date / release info */}
        {curso.dataLiberacao && (
          <p className="text-xs text-muted-foreground">
            Liberado em {formatData(curso.dataLiberacao)}
          </p>
        )}

        {/* CTA Button */}
        <Button
          onClick={onClick}
          variant="default"
          className="w-full py-2.5 rounded-xl min-h-[44px]"
          rightIcon={
            curso.status !== 'concluido' && curso.status !== 'aprovado' ? (
              <ChevronRight className="w-4 h-4" />
            ) : undefined
          }
        >
          {buttonText}
        </Button>
      </div>
    </motion.div>
  );
});
