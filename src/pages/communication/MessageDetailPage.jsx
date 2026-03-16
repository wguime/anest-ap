import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  ChevronLeft,
  Reply,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  Paperclip,
  Send,
  ExternalLink,
  Clock,
} from "lucide-react"
import {
  Stethoscope,
  Megaphone,
  GraduationCap,
  AlertTriangle,
  Target,
  FileText,
  Settings,
  Users as UsersIcon,
  DollarSign,
  Trophy,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, Avatar, Badge, Button, useTheme } from "@/design-system"
import { useMessages } from "@/contexts/MessagesContext"

const CATEGORY_ICONS = {
  plantao: Stethoscope,
  comunicado: Megaphone,
  educacao: GraduationCap,
  incidente: AlertTriangle,
  qualidade: Target,
  documento: FileText,
  sistema: Settings,
  reuniao: UsersIcon,
  faturamento: DollarSign,
  rops: Trophy,
  privada: MessageSquare,
}

function formatFullDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Agora"
  if (diffMins < 60) return `ha ${diffMins} min`
  if (diffHours < 24) return `ha ${diffHours}h`
  if (diffDays < 7) return `ha ${diffDays} dia${diffDays > 1 ? "s" : ""}`
  return formatFullDate(dateString)
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MessageDetailPage({ onNavigate, goBack, params }) {
  const {
    messages,
    notifications,
    notificationCategories,
    markAsRead,
    markAsUnread,
    markNotificationAsRead,
    archiveMessage,
    deleteMessage,
    dismissNotification,
    getThreadMessages,
    replyToMessage,
  } = useMessages()

  const { isDark } = useTheme()
  const [replyContent, setReplyContent] = useState("")
  const [showReply, setShowReply] = useState(false)

  const messageId = params?.messageId
  const isNotification = params?.isNotification

  // Find the message or notification
  const item = isNotification
    ? notifications.find((n) => n.id === messageId)
    : messages.find((m) => m.id === messageId)

  // Auto-mark as read on mount
  useEffect(() => {
    if (item && !item.readAt) {
      if (isNotification) {
        markNotificationAsRead(item.id)
      } else {
        markAsRead(item.id)
      }
    }
  }, [item?.id, isNotification])

  // Get thread messages for private messages
  const threadMessages = !isNotification && item?.threadId
    ? getThreadMessages(item.threadId).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      )
    : []

  const handleReply = async () => {
    if (!replyContent.trim() || !item?.threadId) return
    await replyToMessage(item.threadId, {
      content: replyContent.trim(),
      priority: "normal",
    })
    setReplyContent("")
    setShowReply(false)
  }

  const handleArchive = () => {
    if (!isNotification && item) {
      archiveMessage(item.id)
      goBack()
    }
  }

  const handleDelete = () => {
    if (isNotification && item) {
      dismissNotification(item.id)
    } else if (item) {
      deleteMessage(item.id)
    }
    goBack()
  }

  const handleMarkUnread = () => {
    if (isNotification) {
      goBack()
      return
    }
    markAsUnread(item.id)
    goBack()
  }

  const handleAction = () => {
    if (isNotification && item?.actionUrl) {
      onNavigate(item.actionUrl)
    }
  }

  // Category config for notifications
  const catConfig = isNotification && item?.category
    ? notificationCategories?.[item.category] || {}
    : {}
  const CatIcon = isNotification ? (CATEGORY_ICONS[item?.category] || Settings) : null
  const catColor = isDark
    ? (catConfig.colorDark || "#2ECC71")
    : (catConfig.colorLight || "#006837")

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Mensagem nao encontrada</p>
      </div>
    )
  }

  // Header via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            {isNotification ? "Notificacao" : "Mensagem"}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Subject + Priority */}
        <div>
          <div className="flex items-start gap-2 mb-2">
            {item.priority && item.priority !== "normal" && (
              <Badge
                variant={item.priority === "urgente" ? "destructive" : "warning"}
                badgeStyle="subtle"
                className="mt-0.5 shrink-0"
              >
                {item.priority === "urgente" ? "Urgente" : "Alta"}
              </Badge>
            )}
            <h2 className="text-lg font-bold text-foreground leading-tight">
              {item.subject}
            </h2>
          </div>
        </div>

        {/* Sender info */}
        <Card variant="default" className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {isNotification && CatIcon ? (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${catColor} 15%, transparent)` }}
                >
                  <CatIcon className="w-5 h-5" style={{ color: catColor }} />
                </div>
              ) : (
                <Avatar
                  name={item.senderName}
                  src={item.senderAvatar}
                  size="md"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-[15px]">
                  {item.senderName}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {item.senderRole}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12px] text-muted-foreground">
                  {formatRelativeDate(item.createdAt)}
                </p>
                {isNotification && catConfig.label && (
                  <Badge
                    badgeStyle="subtle"
                    variant="secondary"
                    className="mt-1"
                    style={{ color: catColor }}
                  >
                    {catConfig.label}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card variant="default" className="bg-card">
          <CardContent className="p-4">
            <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
              {item.content}
            </p>
          </CardContent>
        </Card>

        {/* Attachments (private messages only) */}
        {!isNotification && item.attachments?.length > 0 && (
          <Card variant="default" className="bg-card">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Anexos ({item.attachments.length})
              </h3>
              <div className="space-y-2">
                {item.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border"
                  >
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {att.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(att.size)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-primary" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notification Action Button */}
        {isNotification && item.actionLabel && item.actionUrl && (
          <Button
            onClick={handleAction}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {item.actionLabel}
          </Button>
        )}

        {/* Thread Messages (private messages) */}
        {!isNotification && threadMessages.length > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Conversa ({threadMessages.length} mensagens)
            </h3>
            <div className="space-y-3">
              {threadMessages.map((msg) => (
                <Card
                  key={msg.id}
                  variant="default"
                  className={`bg-card ${
                    msg.id === item.id ? "ring-2 ring-primary/30" : ""
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar name={msg.senderName} size="sm" />
                      <span className="text-[13px] font-semibold text-foreground">
                        {msg.senderName}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {formatRelativeDate(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed">
                      {msg.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Reply compose (private messages only) */}
        {!isNotification && showReply && (
          <Card variant="default" className="bg-card">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Responder
              </h3>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Digite sua resposta..."
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowReply(false)
                    setReplyContent("")
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyContent.trim()}
                >
                  <Send className="w-4 h-4 mr-1" />
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {!isNotification && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReply(!showReply)}
              className="flex-1"
            >
              <Reply className="w-4 h-4 mr-1" />
              Responder
            </Button>
          )}
          {!isNotification && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="flex-1"
            >
              <Archive className="w-4 h-4 mr-1" />
              Arquivar
            </Button>
          )}
          {!isNotification && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkUnread}
              className="flex-1"
            >
              <Mail className="w-4 h-4 mr-1" />
              Nao lida
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="flex-1 text-destructive hover:text-destructive border-destructive/30"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  )
}
