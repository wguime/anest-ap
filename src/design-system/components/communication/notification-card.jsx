import * as React from "react"
import { Clock, X } from "lucide-react"
import {
  Stethoscope,
  Megaphone,
  GraduationCap,
  AlertTriangle,
  Target,
  FileText,
  Settings,
  Users,
  DollarSign,
  Trophy,
  MessageSquare,
} from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge, Button } from "@/design-system/components/ui"

/**
 * NotificationCard - Card de notificacao do sistema
 *
 * Padrao Microsoft Teams: 3 linhas (Ator+Acao, Contexto, Preview)
 * - Circulo colorido (40x40) com icone da categoria
 * - Borda esquerda colorida pela categoria (unread)
 * - Botao de acao CTA inline (padrao Linear)
 * - Botao dismiss (X) se dismissable
 * - Badge de prioridade (normal/alta/urgente)
 * - Timestamp relativo (padrao Notion)
 *
 * @example
 * <NotificationCard
 *   notification={notifObject}
 *   onClick={() => handleClick()}
 *   onDismiss={() => handleDismiss()}
 *   onAction={() => handleAction()}
 * />
 */

const CATEGORY_ICONS = {
  plantao: Stethoscope,
  comunicado: Megaphone,
  educacao: GraduationCap,
  incidente: AlertTriangle,
  qualidade: Target,
  documento: FileText,
  sistema: Settings,
  reuniao: Users,
  faturamento: DollarSign,
  rops: Trophy,
  privada: MessageSquare,
}

const PRIORITY_STYLES = {
  normal: {
    badge: null,
    border: "border-border",
  },
  alta: {
    badge: { text: "Alta", variant: "warning" },
    border: "border-warning/30",
  },
  urgente: {
    badge: { text: "Urgente", variant: "destructive" },
    border: "border-destructive/30",
  },
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Agora"
  if (diffMins < 60) return `${diffMins}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })
}

function NotificationCard({
  notification,
  categoryConfig,
  onClick,
  onDismiss,
  onAction,
  className,
  ...props
}) {
  const {
    subject,
    content,
    senderName,
    senderRole,
    createdAt,
    readAt,
    priority = "normal",
    category = "sistema",
    actionLabel,
    actionUrl,
    dismissable = true,
  } = notification

  const config = PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal
  const isUnread = !readAt
  const isClickable = typeof onClick === "function"
  const hasAction = actionLabel && (onAction || actionUrl)

  const IconComponent = CATEGORY_ICONS[category] || Settings
  const catConfig = categoryConfig || {}
  const colorLight = catConfig.colorLight || "#6366F1"
  const colorDark = catConfig.colorDark || "#818CF8"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      data-slot="notification-card"
      data-priority={priority}
      data-category={category}
      data-unread={isUnread ? "true" : undefined}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      className={cn(
        "rounded-[20px] overflow-hidden",
        "p-4 md:p-5",
        "bg-card",
        "border",
        config.border,
        isUnread && "border-l-4",
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
        isClickable &&
          "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-shadow",
        className
      )}
      style={
        isUnread
          ? { borderLeftColor: `var(--notif-color, ${colorLight})` }
          : undefined
      }
      {...props}
    >
      <div className="flex items-start gap-3">
        {/* Category icon circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, var(--notif-color, ${colorLight}) 15%, transparent)` }}
        >
          <IconComponent
            className="w-5 h-5"
            style={{ color: `var(--notif-color, ${colorLight})` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Sender + Action */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p
              data-slot="notification-card-sender"
              className={cn(
                "text-[13px] truncate",
                "text-muted-foreground"
              )}
            >
              <span className="font-semibold text-foreground">
                {senderName}
              </span>
              {senderRole && senderRole !== "Sistema" ? (
                <span className="ml-1">· {senderRole}</span>
              ) : null}
            </p>

            <div className="flex items-center gap-1.5 shrink-0">
              {config.badge ? (
                <Badge variant={config.badge.variant} badgeStyle="subtle">
                  {config.badge.text}
                </Badge>
              ) : null}

              {dismissable && onDismiss ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDismiss(notification.id)
                  }}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                  aria-label="Dispensar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Line 2: Subject */}
          <h4
            data-slot="notification-card-subject"
            className={cn(
              "text-[14px] truncate mb-1",
              "text-foreground",
              isUnread ? "font-semibold" : "font-medium"
            )}
          >
            {subject}
          </h4>

          {/* Line 3: Content preview */}
          {content ? (
            <p
              data-slot="notification-card-content"
              className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2 mb-2"
            >
              {content}
            </p>
          ) : null}

          {/* Footer: Action + Timestamp */}
          <div className="flex items-center justify-between gap-2">
            {hasAction ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onAction) onAction(notification)
                }}
                className="h-7 px-2.5 text-[12px] font-medium"
                style={{ color: `var(--notif-color, ${colorLight})` }}
              >
                {actionLabel}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{formatRelativeDate(createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS custom property for category color */}
      <style>{`
        [data-slot="notification-card"][data-category="${category}"] {
          --notif-color: ${colorLight};
        }
        .dark [data-slot="notification-card"][data-category="${category}"] {
          --notif-color: ${colorDark};
        }
      `}</style>
    </motion.div>
  )
}

export { NotificationCard }
