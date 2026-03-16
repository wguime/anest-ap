import * as React from "react"
import { ChevronRight, Clock, Paperclip, User } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Avatar, Badge } from "@/design-system/components/ui"

/**
 * MessageCard - Card individual de mensagem privada
 *
 * Card para exibir uma mensagem na caixa de entrada com:
 * - Avatar e nome do remetente
 * - Assunto e preview do conteudo
 * - Indicador de nao lido
 * - Badge de prioridade
 * - Indicador de anexos
 *
 * @example
 * <MessageCard
 *   message={messageObject}
 *   onClick={() => handleClick()}
 *   onMarkAsRead={() => handleMarkAsRead()}
 * />
 */

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

// Formatar data relativa
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

function MessageCard({
  message,
  isSelected = false,
  compact = false,
  onClick,
  onMarkAsRead,
  onArchive,
  onDelete,
  className,
  ...props
}) {
  const {
    senderName,
    senderRole,
    senderAvatar,
    subject,
    content,
    createdAt,
    readAt,
    priority = "normal",
    attachments = [],
  } = message

  const config = PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal
  const isUnread = !readAt
  const isClickable = typeof onClick === "function"
  const hasAttachments = attachments.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      data-slot="message-card"
      data-priority={priority}
      data-unread={isUnread ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
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
        compact ? "p-3" : "p-4 md:p-5",
        // Background
        "bg-card",
        // Border
        "border",
        config.border,
        // Selected state
        isSelected && "ring-2 ring-primary",
        // Unread state - subtle left accent
        isUnread && "border-l-4 border-l-primary",
        // Shadow
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
        // Interactive
        isClickable &&
          "cursor-pointer hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition-shadow",
        className
      )}
      {...props}
    >
      {/* Header row with avatar and sender info */}
      <div className="flex items-start gap-3 mb-2">
        {/* Unread dot + Avatar */}
        <div className="relative shrink-0">
          {isUnread ? (
            <span
              data-slot="message-card-unread-dot"
              className="absolute -left-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-primary"
              aria-label="Nao lida"
            />
          ) : null}
          <Avatar
            src={senderAvatar}
            name={senderName}
            size={compact ? "sm" : "md"}
            className="ring-2 ring-card"
          />
        </div>

        {/* Sender info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3
                data-slot="message-card-sender"
                className={cn(
                  "font-semibold truncate",
                  compact ? "text-[13px]" : "text-[14px] md:text-[15px]",
                  "text-foreground",
                  isUnread && "font-bold"
                )}
              >
                {senderName}
              </h3>
              {!compact && senderRole ? (
                <p className="text-[12px] text-muted-foreground truncate">
                  {senderRole}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {config.badge ? (
                <Badge variant={config.badge.variant} badgeStyle="subtle">
                  {config.badge.text}
                </Badge>
              ) : null}

              {isClickable ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Subject */}
      <h4
        data-slot="message-card-subject"
        className={cn(
          "font-medium truncate mb-1",
          compact ? "text-[13px]" : "text-[14px]",
          "text-foreground",
          isUnread && "font-semibold"
        )}
      >
        {subject}
      </h4>

      {/* Content preview */}
      {!compact && content ? (
        <p
          data-slot="message-card-content"
          className={cn(
            "text-[14px] leading-relaxed mb-3",
            "text-muted-foreground",
            "line-clamp-2"
          )}
        >
          {content}
        </p>
      ) : null}

      {/* Footer with attachments and date */}
      <div
        data-slot="message-card-footer"
        className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground"
      >
        <div className="flex items-center gap-3">
          {hasAttachments ? (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {attachments.length} {attachments.length === 1 ? "anexo" : "anexos"}
              </span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{formatRelativeDate(createdAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

export { MessageCard }
