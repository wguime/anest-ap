/**
 * TrilhaCard.jsx
 * Card para exibição de trilhas de aprendizado
 * Redesigned to match EducacaoSummaryCard visual pattern.
 * Supports full (with thumbnail) and compact (list-item) variants.
 */

import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Badge, Progress, Button } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { GitBranch, Clock, BookOpen, AlertTriangle, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { calcularProgressoTrilha, calcularDiasRestantes, TIPOS_USUARIO } from '../data/educacaoUtils';

/* ──────────────────────────────────────────────
 * Status → progress bar color mapping
 * ────────────────────────────────────────────── */
const PROGRESS_COLOR = {
  concluida:    '[&>div]:bg-primary',
  expirada:     '[&>div]:bg-destructive',
  urgente:      '[&>div]:bg-destructive',
  em_andamento: '[&>div]:bg-primary',
  nao_iniciada: '[&>div]:bg-muted',
};

/**
 * TrilhaCard - Card de trilha personalizada
 *
 * @param {Object} trilha - Dados da trilha
 * @param {string} userId - ID do usuário atual
 * @param {function} onClick - Callback de clique
 * @param {boolean} compact - Versão compacta (list-item style)
 * @param {string} className - Classes extras
 */
export const TrilhaCard = memo(function TrilhaCard({
  trilha,
  userId,
  onClick,
  compact = false,
  className,
  cursos = [],
  aulas = [],
  visualizacoes = [],
}) {
  // Calcular progresso da trilha (uses real data passed via props)
  const progresso = useMemo(() => {
    return calcularProgressoTrilha(
      trilha,
      userId,
      visualizacoes,
      cursos,
      aulas
    );
  }, [trilha, userId, visualizacoes, cursos, aulas]);

  // Calcular dias restantes
  const diasRestantes = useMemo(() => {
    if (!trilha.prazoConclusao) return null;
    return calcularDiasRestantes(trilha.createdAt, trilha.prazoConclusao);
  }, [trilha]);

  // Determinar status da trilha
  const status = useMemo(() => {
    if (progresso === 100) return 'concluida';
    if (diasRestantes !== null && diasRestantes < 0) return 'expirada';
    if (diasRestantes !== null && diasRestantes <= 7) return 'urgente';
    if (progresso > 0) return 'em_andamento';
    return 'nao_iniciada';
  }, [progresso, diasRestantes]);

  // Labels de status
  const statusConfig = {
    concluida: {
      label: 'Concluída',
      variant: 'success',
      icon: CheckCircle,
    },
    expirada: {
      label: 'Expirada',
      variant: 'destructive',
      icon: AlertCircle,
    },
    urgente: {
      label: `${diasRestantes} dias restantes`,
      variant: 'warning',
      icon: AlertTriangle,
    },
    em_andamento: {
      label: 'Em Andamento',
      variant: 'info',
      icon: Clock,
    },
    nao_iniciada: {
      label: 'Não Iniciada',
      variant: 'secondary',
      icon: BookOpen,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Contar cursos na trilha (safe access)
  const totalCursos = trilha.cursos?.length || 0;
  const cursosConcluidos = useMemo(() => {
    if (!trilha.cursos?.length) return 0;
    // Approximate: use overall progress ratio against total courses
    return Math.round((progresso / 100) * totalCursos);
  }, [trilha.cursos, progresso, totalCursos]);

  // Labels dos tipos de usuário (safe access)
  const tiposLabels = (trilha.tiposUsuario || [])
    .map(t => TIPOS_USUARIO[t]?.label || t)
    .join(', ');

  /* ──────────────────────────────────────────────
   * COMPACT variant — list-item style
   * ────────────────────────────────────────────── */
  if (compact) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-[20px] min-h-[72px]",
          "bg-card border border-border text-left",
          "shadow-[0_2px_8px_rgba(0,66,37,0.04)] dark:shadow-none",
          "transition-all hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
      >
        {/* Left — icon */}
        <div className="w-10 h-10 rounded-xl bg-category-teal-bg flex items-center justify-center flex-shrink-0">
          <GitBranch className="w-5 h-5 text-category-teal-fg" />
        </div>

        {/* Center — title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-foreground truncate">
            {trilha.titulo}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
            {totalCursos} {totalCursos === 1 ? 'curso' : 'cursos'} · {cursosConcluidos} {cursosConcluidos === 1 ? 'concluído' : 'concluídos'}
          </p>
        </div>

        {/* Right — circular progress indicator + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            status === 'concluida' ? "bg-primary/10" :
            status === 'expirada' || status === 'urgente' ? "bg-destructive/10" :
            progresso > 0 ? "bg-primary/10" : "bg-muted"
          )}>
            <span className={cn(
              "text-[11px] font-bold",
              status === 'concluida' ? "text-primary" :
              status === 'expirada' || status === 'urgente' ? "text-destructive" :
              progresso > 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {progresso}%
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </motion.button>
    );
  }

  /* ──────────────────────────────────────────────
   * FULL variant — card with optional thumbnail
   * ────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={cn(
        "rounded-[20px] bg-card border border-border overflow-hidden cursor-pointer",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        "transition-all hover:-translate-y-px hover:shadow-elevation-2 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {/* ── Thumbnail area ── */}
      {trilha.banner ? (
        <div className="relative aspect-video rounded-t-[20px] overflow-hidden">
          <img
            src={trilha.banner}
            alt={trilha.titulo}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
          {/* Subtle overlay for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ) : (
        <div className="aspect-video rounded-t-[20px] overflow-hidden bg-gradient-to-br from-category-teal-bg to-secondary flex items-center justify-center">
          <GitBranch className="w-12 h-12 text-category-teal-fg opacity-40" />
        </div>
      )}

      {/* ── Content ── */}
      <div className="p-4 space-y-3">
        {/* Row: icon + title + subtitle */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-category-teal-bg flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-5 h-5 text-category-teal-fg" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-foreground leading-tight line-clamp-2">
              {trilha.titulo}
            </h3>
            {trilha.descricao && (
              <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">
                {trilha.descricao}
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Obrigatoria badge */}
          {trilha.obrigatoria && (
            <Badge
              variant="destructive"
              badgeStyle="subtle"
              className="bg-destructive/10 text-destructive"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Obrigatória
            </Badge>
          )}

          {/* Status badge */}
          <Badge variant={config.variant} badgeStyle="subtle">
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>

          {/* Cursos count */}
          <Badge variant="secondary" badgeStyle="subtle">
            <BookOpen className="w-3 h-3 mr-1" />
            {totalCursos} {totalCursos === 1 ? 'curso' : 'cursos'}
          </Badge>

          {/* T1.5.4 — Tempo restante (se backend agrega duracaoMinutosTotal) */}
          {trilha.duracaoMinutosTotal && status !== 'concluida' && status !== 'expirada' && (
            <Badge variant="secondary" badgeStyle="subtle">
              <Clock className="w-3 h-3 mr-1" />
              {(() => {
                const total = Number(trilha.duracaoMinutosTotal) || 0;
                const restanteMin = Math.max(1, Math.round(total * (1 - progresso / 100)));
                const horas = Math.floor(restanteMin / 60);
                const min = restanteMin % 60;
                return horas > 0
                  ? `~${horas}h${min > 0 ? ` ${min}min` : ''} restantes`
                  : `~${min} min restantes`;
              })()}
            </Badge>
          )}

          {trilha.prazoConclusao && status !== 'concluida' && (
            <Badge variant="secondary" badgeStyle="subtle">
              <Clock className="w-3 h-3 mr-1" />
              Prazo: {trilha.prazoConclusao} dias
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {cursosConcluidos}/{totalCursos} cursos
            </span>
            <span className="text-[13px] font-semibold text-foreground">{progresso}%</span>
          </div>
          <Progress
            value={progresso}
            size="sm"
            className={cn("h-2", PROGRESS_COLOR[status])}
          />
        </div>

        {/* Tipos de usuário */}
        {tiposLabels && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium">Para:</span> {tiposLabels}
          </p>
        )}

        {/* CTA button */}
        <Button
          variant={status === 'concluida' ? 'outline' : 'default'}
          className="w-full py-2.5 rounded-xl min-h-[44px]"
          rightIcon={<ChevronRight className="w-4 h-4" />}
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        >
          {status === 'concluida' ? 'Ver Detalhes' :
           progresso > 0 ? 'Continuar' : 'Iniciar'}
        </Button>
      </div>
    </motion.div>
  );
});

/**
 * TrilhaCardSkeleton - Skeleton loading
 */
export function TrilhaCardSkeleton() {
  return (
    <div className="rounded-[20px] border border-border bg-card overflow-hidden animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="aspect-video bg-muted" />
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded-lg w-3/4" />
            <div className="h-3 bg-muted rounded-lg w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-5 bg-muted rounded-[10px] w-24" />
          <div className="h-5 bg-muted rounded-[10px] w-20" />
        </div>
        <div className="h-2 bg-muted rounded-full" />
        <div className="h-[44px] bg-muted rounded-xl" />
      </div>
    </div>
  );
}

export default TrilhaCard;
