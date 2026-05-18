import * as React from "react"
import { motion } from "framer-motion"
import { GraduationCap, CalendarCheck, Flame, BookOpen, Sparkles, Trophy } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * EducacaoSummaryCard — Wave 1.6 T1.6.9
 *
 * Card de Educação Continuada na HomePage. 3 sub-blocos:
 *   1. Desafio do dia (Trophy + score + streak + CTA)
 *   2. Continue de onde parou (mini-card última aula com progresso)
 *   3. Próxima ação / Ranking opt-in (LGPD T1.6.12)
 *
 * Mobile: stack vertical. Desktop (md+): grid 3 colunas.
 *
 * Tokens DS: bg-card, border-border-strong, text-foreground.
 * Accents: category-teal (educação) e category-purple (ROPs).
 *
 * Anti-pattern LGPD: rankingPosition só aparece se rankingOptIn===true.
 * Caso contrário mostra "Seu acerto esta semana: X%".
 */

/**
 * @typedef {Object} EducacaoSummaryCardProps
 * @property {number=} streakDays - dias consecutivos de atividade (Wave 1.1)
 * @property {string=} desafioStatus - "pending" | "completed" | "in_progress"
 * @property {number=} desafioScore - percentual atual do desafio do dia
 * @property {Object=} continueLesson - { title, progress, onResume }
 * @property {Object=} nextAction - { label, href, icon }
 * @property {boolean=} rankingOptIn - se true, mostra posição; senão, score pessoal
 * @property {number=} rankingPosition - posição no ranking (só usada se rankingOptIn)
 * @property {number=} weeklyAccuracy - % de acerto semanal (fallback se sem opt-in)
 * @property {() => void=} onOpenDesafio
 * @property {() => void=} onOpenContinue
 * @property {() => void=} onOpenRanking
 * @property {string=} className
 */

function SubBlock({ icon: Icon, accentBg, accentFg, title, value, subtitle, ctaLabel, onClick, disabled, ariaLabel }) {
  const isClickable = typeof onClick === "function" && !disabled
  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      aria-label={ariaLabel || title}
      className={cn(
        "min-h-[88px] w-full text-left rounded-[16px] p-4 transition-all",
        "border border-border bg-card",
        "shadow-[0_2px_8px_rgba(0,66,37,0.05)]",
        isClickable
          ? "hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
          : "cursor-default opacity-90"
      )}
    >
      <div className="flex items-start gap-3 h-full">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", accentBg)}>
          <Icon className={cn("w-5 h-5", accentFg)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
            {title}
          </p>
          <p className="mt-0.5 text-[16px] font-bold text-foreground leading-tight truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
          {ctaLabel && isClickable && (
            <span className="mt-1 inline-flex text-[12px] font-semibold text-primary">
              {ctaLabel} →
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function EducacaoSummaryCard({
  streakDays = 0,
  desafioStatus = "pending",
  desafioScore = null,
  continueLesson = null,
  nextAction = null,
  rankingOptIn = false,
  rankingPosition = null,
  weeklyAccuracy = null,
  onOpenDesafio,
  onOpenContinue,
  onOpenRanking,
  className,
  ...props
}) {
  const desafioDone = desafioStatus === "completed"
  const desafioValue = desafioDone
    ? `${Math.round(desafioScore ?? 0)}%`
    : streakDays > 0
      ? `${streakDays} ${streakDays === 1 ? "dia" : "dias"}`
      : "Comece hoje"
  const desafioSubtitle = desafioDone
    ? "Concluído"
    : streakDays > 0
      ? "Continue a streak"
      : "10 questões · 5 min"
  const desafioCta = desafioDone ? "Ver resultado" : "Começar"

  return (
    <motion.section
      data-slot="anest-educacao-summary-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "rounded-[20px] p-4 md:p-5",
        "bg-accent dark:bg-card dark:border dark:border-border",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        className
      )}
      aria-labelledby="educacao-summary-title"
      {...props}
    >
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-category-teal-bg flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-category-teal-fg" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-primary">
              EDUCAÇÃO CONTINUADA
            </p>
            <h2 id="educacao-summary-title" className="text-[18px] md:text-[20px] font-bold text-foreground leading-tight truncate">
              Sua jornada de hoje
            </h2>
          </div>
        </div>
        {streakDays > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-[10px] px-[10px] py-[5px] text-[11px] font-semibold bg-category-orange text-category-orange-foreground"
            aria-label={`Streak de ${streakDays} dias`}
          >
            <Flame className="w-3 h-3" />
            {streakDays}
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SubBlock
          icon={desafioDone ? Trophy : CalendarCheck}
          accentBg="bg-category-purple-bg"
          accentFg="text-category-purple-fg"
          title="Desafio do dia"
          value={desafioValue}
          subtitle={desafioSubtitle}
          ctaLabel={desafioCta}
          onClick={onOpenDesafio}
          ariaLabel="Abrir desafio do dia das ROPs"
        />

        <SubBlock
          icon={BookOpen}
          accentBg="bg-category-teal-bg"
          accentFg="text-category-teal-fg"
          title="Continue de onde parou"
          value={continueLesson?.title || "Sem aula em andamento"}
          subtitle={
            continueLesson?.progress != null
              ? `${Math.round(continueLesson.progress)}% concluído`
              : "Explore a biblioteca"
          }
          ctaLabel={continueLesson ? "Retomar" : "Ver aulas"}
          onClick={continueLesson?.onResume || onOpenContinue}
          ariaLabel={continueLesson ? `Retomar aula: ${continueLesson.title}` : "Abrir educação continuada"}
        />

        <SubBlock
          icon={rankingOptIn && rankingPosition ? Trophy : Sparkles}
          accentBg="bg-category-orange-bg"
          accentFg="text-category-orange-fg"
          title={rankingOptIn && rankingPosition ? "Ranking semanal" : "Seu desempenho"}
          value={
            rankingOptIn && rankingPosition
              ? `${rankingPosition}º lugar`
              : weeklyAccuracy != null
                ? `${Math.round(weeklyAccuracy)}%`
                : nextAction?.label || "Faça um quiz"
          }
          subtitle={
            rankingOptIn && rankingPosition
              ? "Esta semana"
              : weeklyAccuracy != null
                ? "Acerto desta semana"
                : "Próxima ação"
          }
          ctaLabel={rankingOptIn && rankingPosition ? "Ver ranking" : nextAction ? "Abrir" : "Ver opções"}
          onClick={rankingOptIn && rankingPosition ? onOpenRanking : nextAction?.onClick || onOpenRanking}
          ariaLabel={
            rankingOptIn && rankingPosition
              ? `Você está em ${rankingPosition}º lugar no ranking semanal`
              : "Abrir educação continuada"
          }
        />
      </div>
    </motion.section>
  )
}

export { EducacaoSummaryCard }
