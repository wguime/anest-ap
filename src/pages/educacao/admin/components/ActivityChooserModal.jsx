import * as React from "react"
import { Video, BookOpen, ClipboardCheck, Paperclip, MessageSquare, Stethoscope } from "lucide-react"

import { Modal } from "@/design-system/components/ui/modal"
import { cn } from "@/design-system/utils/tokens"

/**
 * T1.5.10 — ActivityChooserModal
 *
 * Grid 2x3 de tipos de atividade que o admin pode adicionar.
 * Inspirado em Moodle 4 Activity Chooser.
 *
 * - Atalhos numéricos 1-6
 * - Navegação por setas (←↑→↓) + Enter
 * - Cores semânticas via tokens `category-*`
 */

const ACTIVITIES = [
  {
    key: "video",
    icon: Video,
    title: "Vídeo",
    description: "Aula com vídeo (YouTube, upload ou URL externa).",
    tag: "Popular",
    color: "category-purple",
  },
  {
    key: "leitura",
    icon: BookOpen,
    title: "Leitura",
    description: "Aula textual com editor rico (BlockNote).",
    tag: null,
    color: "category-blue",
  },
  {
    key: "quiz",
    icon: ClipboardCheck,
    title: "Quiz / ROP",
    description: "Avaliação com questões de múltipla escolha.",
    tag: null,
    color: "category-teal",
  },
  {
    key: "material",
    icon: Paperclip,
    title: "Material complementar",
    description: "PDFs, planilhas e arquivos para download.",
    tag: null,
    color: "category-orange",
  },
  {
    key: "discussao",
    icon: MessageSquare,
    title: "Discussão",
    description: "Fórum ou enquete sobre o tema. (em breve)",
    tag: "Novo",
    color: "category-indigo",
    disabled: true,
  },
  {
    key: "caso",
    icon: Stethoscope,
    title: "Caso Clínico",
    description: "Cenário estruturado com decisão e feedback. (em breve)",
    tag: "Novo",
    color: "category-pink",
    disabled: true,
  },
]

export function ActivityChooserModal({ open, onClose, onChoose }) {
  const [focusedIndex, setFocusedIndex] = React.useState(0)
  const buttonRefs = React.useRef([])

  React.useEffect(() => {
    if (!open) return
    setFocusedIndex(0)
    // foco inicial em 50ms (depois do mount do modal)
    const t = setTimeout(() => buttonRefs.current[0]?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handler = (e) => {
      // Atalhos numéricos 1-6
      if (e.key >= "1" && e.key <= "6") {
        const idx = Number(e.key) - 1
        if (idx < ACTIVITIES.length) {
          e.preventDefault()
          const act = ACTIVITIES[idx]
          if (!act.disabled) {
            onChoose?.(act.key)
            onClose?.()
          }
        }
        return
      }
      // Setas + Enter
      const cols = 2
      let next = focusedIndex
      if (e.key === "ArrowRight") next = Math.min(ACTIVITIES.length - 1, focusedIndex + 1)
      else if (e.key === "ArrowLeft") next = Math.max(0, focusedIndex - 1)
      else if (e.key === "ArrowDown") next = Math.min(ACTIVITIES.length - 1, focusedIndex + cols)
      else if (e.key === "ArrowUp") next = Math.max(0, focusedIndex - cols)
      else return
      e.preventDefault()
      setFocusedIndex(next)
      buttonRefs.current[next]?.focus()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, focusedIndex, onChoose, onClose])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar atividade"
      description="Escolha o tipo de conteúdo. Atalhos numéricos 1-6 ou ↑↓←→."
      size="lg"
    >
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Tipos de atividade">
        {ACTIVITIES.map((act, idx) => {
          const Icon = act.icon
          const isDisabled = !!act.disabled
          return (
            <button
              key={act.key}
              ref={(el) => (buttonRefs.current[idx] = el)}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return
                onChoose?.(act.key)
                onClose?.()
              }}
              className={cn(
                "relative flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-colors min-h-[120px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isDisabled
                  ? "border-border bg-muted/40 cursor-not-allowed opacity-60"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
              )}
              aria-label={`${act.title} — atalho ${idx + 1}`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-10 h-10 rounded-lg",
                    `bg-${act.color}-bg`
                  )}
                  aria-hidden="true"
                >
                  <Icon className={cn("w-5 h-5", `text-${act.color}-fg`)} />
                </span>
                {act.tag && (
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
                      act.tag === "Popular"
                        ? "bg-success/10 text-success"
                        : "bg-info/10 text-info"
                    )}
                  >
                    {act.tag}
                  </span>
                )}
                <span
                  className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-muted-foreground bg-muted"
                  aria-hidden="true"
                  style={act.tag ? { display: "none" } : undefined}
                >
                  {idx + 1}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{act.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {act.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
