import * as React from "react"
import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  MessageSquare,
  Bell,
  Search,
  Plus,
  ChevronLeft,
  Send,
  Inbox,
  ListFilter,
  Archive,
} from "lucide-react"

import { SectionCard, Badge, Button, Card, CardContent, useTheme } from "@/design-system"
import { Tabs, TabsList, TabsTrigger, TabsContent, Modal } from "@/design-system/components/ui"
// Communication DS components available if needed
// import { MessageList, NotificationCard } from "@/design-system/components/communication"
import { useMessages, NOTIFICATION_CATEGORIES } from "@/contexts/MessagesContext"
import { useEventAlerts } from "@/contexts/EventAlertsContext"
import { useIncidents } from "@/contexts/IncidentsContext"
import { STATUS_CONFIG as INCIDENT_STATUS_CONFIG } from "@/data/incidentesConfig"

/**
 * InboxPage - Pagina principal de mensagens e notificacoes
 *
 * Estilo iOS Mail: lista flat com dot de nao lido, dividers finos,
 * sender + categoria + hora na linha 1, subject na linha 2, preview na linha 3
 */

// Chips de categorias para filtro
const CATEGORY_CHIPS = Object.values(NOTIFICATION_CATEGORIES)

// Formatar hora/data relativa estilo iOS Mail
function formatMailTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }
  if (diffDays === 1) return "Ontem"
  if (diffDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

// Resolve category label for an item
function getCategoryLabel(item, notificationCategories) {
  if (item._itemType === "notification") {
    const cat = notificationCategories?.[item.category]
    return cat?.label || ""
  }
  return item.senderRole || ""
}

/**
 * MailRow - Renderiza um item da lista no estilo iOS Mail
 */
function MailRow({ item, categoryLabel, isLast, onClick }) {
  const isUnread = !item.readAt
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left active:bg-muted dark:active:bg-muted transition-colors"
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        {/* Unread dot */}
        <div className="w-3 pt-1.5 shrink-0 flex justify-center">
          {isUnread && (
            <span className="block w-[10px] h-[10px] rounded-full bg-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Sender ... Category  Time */}
          <div className="flex items-baseline gap-1">
            <span
              className={`text-[15px] truncate max-w-[55%] ${
                isUnread
                  ? "font-bold text-foreground"
                  : "font-semibold text-muted-foreground"
              }`}
            >
              {item.senderName}
            </span>
            <span className="flex-1" />
            {categoryLabel && (
              <span className="text-[13px] text-muted-foreground truncate max-w-[30%] shrink-0">
                {categoryLabel}
              </span>
            )}
            <span className="text-[13px] text-muted-foreground shrink-0 ml-1.5 tabular-nums">
              {formatMailTime(item.createdAt)}
            </span>
          </div>

          {/* Row 2: Subject */}
          <p
            className={`text-[14px] truncate mt-px ${
              isUnread
                ? "font-medium text-foreground"
                : "font-normal text-muted-foreground"
            }`}
          >
            {item.subject}
          </p>

          {/* Row 3: Preview */}
          {item.content && (
            <p className="text-[14px] text-muted-foreground line-clamp-2 mt-px leading-snug">
              {item.content}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      {!isLast && (
        <div className="ml-[52px] mr-0 h-px bg-border" />
      )}
    </button>
  )
}

export default function InboxPage({ onNavigate, goBack }) {
  const {
    unreadCount,
    getInboxMessages,
    markAsRead,
    markAllAsRead,
    archiveMessage,
    isLoading,
    notifications,
    notificationCategories,
    unreadNotificationsCount,
    totalUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    dismissNotification,
    getNotifications,
    getArchivedMessages,
    users,
    sendMessage,
    trackReport,
  } = useMessages()

  const { incidentes, denuncias } = useIncidents()
  const { alerts: eventAlerts, unreadCount: eventAlertsUnread, markAsViewed } = useEventAlerts()
  const { isDark } = useTheme()

  const [activeTab, setActiveTab] = useState("todas")
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [trackingCode, setTrackingCode] = useState("")
  const [trackResult, setTrackResult] = useState(null)
  const [trackError, setTrackError] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  // Compose form state
  const [composeForm, setComposeForm] = useState({
    recipientId: "",
    subject: "",
    content: "",
    priority: "normal",
  })

  const inboxMessages = getInboxMessages()

  // Combined count for "Todas" tab
  const allUnreadCount = totalUnreadCount + eventAlertsUnread

  // Convert event alerts to normalized notification format
  const normalizedEventAlerts = useMemo(() => {
    return eventAlerts.map((alert) => {
      const isReuniao = alert.eventId?.startsWith('reuniao_')
      return {
        id: `event_${alert.id}`,
        type: "notification",
        category: isReuniao ? 'reuniao' : 'plantao',
        subject: alert.message,
        content: `Evento: ${new Date(alert.eventDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        senderName: "Sistema ANEST",
        senderRole: "Alertas",
        createdAt: alert.createdAt || new Date().toISOString(),
        readAt: alert.viewed ? new Date().toISOString() : null,
        priority: alert.alertType === "1hour" ? "urgente" : "alta",
        actionUrl: isReuniao ? 'reuniaoDetalhe' : 'escalas',
        actionLabel: isReuniao ? 'Ver Reunião' : 'Ver Escala',
        actionParams: isReuniao
          ? { id: alert.eventId.replace('reuniao_', '') }
          : undefined,
        dismissable: true,
      }
    })
  }, [eventAlerts])

  // "Todas" - merge messages + notifications + event alerts, sorted by date
  const allItems = useMemo(() => {
    const msgs = inboxMessages.map((m) => ({ ...m, _itemType: "message" }))
    const notifs = notifications.map((n) => ({ ...n, _itemType: "notification" }))
    const events = normalizedEventAlerts.map((e) => ({ ...e, _itemType: "notification" }))
    let items = [...msgs, ...notifs, ...events].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
    if (showUnreadOnly) items = items.filter((i) => !i.readAt)
    return items
  }, [inboxMessages, notifications, normalizedEventAlerts, showUnreadOnly])

  // Filtered messages for "Mensagens" tab
  const displayMessages = useMemo(() => {
    if (showUnreadOnly) return inboxMessages.filter((m) => !m.readAt)
    return inboxMessages
  }, [inboxMessages, showUnreadOnly])

  // Archived messages
  const archivedMessages = useMemo(() => {
    return getArchivedMessages()
  }, [getArchivedMessages])

  // Filtered notifications by category
  const filteredNotifications = useMemo(() => {
    const allNotifs = [...notifications, ...normalizedEventAlerts].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
    let result = categoryFilter ? allNotifs.filter((n) => n.category === categoryFilter) : allNotifs
    if (showUnreadOnly) result = result.filter((n) => !n.readAt)
    return result
  }, [notifications, normalizedEventAlerts, categoryFilter, showUnreadOnly])

  const handleMessageClick = (message) => {
    markAsRead(message.id)
    onNavigate("messageDetail", { messageId: message.id, isNotification: false })
  }

  const handleNotificationClick = (notification) => {
    if (notification.id.startsWith("event_")) {
      markAsViewed(notification.id.replace('event_', ''))
      if (notification.actionUrl) {
        onNavigate(notification.actionUrl, notification.actionParams || undefined)
      }
      return
    }
    markNotificationAsRead(notification.id)
    onNavigate("messageDetail", { messageId: notification.id, isNotification: true })
  }

  const handleNotificationAction = (notification) => {
    if (notification.actionUrl) {
      if (!notification.id.startsWith("event_")) {
        markNotificationAsRead(notification.id)
      }
      onNavigate(notification.actionUrl, notification.actionParams || undefined)
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
    markAllNotificationsAsRead()
  }

  const handleTrack = () => {
    setTrackError("")
    setTrackResult(null)
    if (!trackingCode.trim()) {
      setTrackError("Digite o codigo de rastreio")
      return
    }

    const code = trackingCode.trim().toUpperCase()

    // 1. Buscar no IncidentsContext (incidentes)
    const inc = incidentes.find(i => i.trackingCode === code)
    if (inc) {
      const statusCfg = INCIDENT_STATUS_CONFIG[inc.status] || INCIDENT_STATUS_CONFIG.pending
      setTrackResult({
        subject: inc.incidente?.descricao?.substring(0, 80) || `Incidente: ${inc.protocolo}`,
        description: `Protocolo: ${inc.protocolo} | Tipo: ${inc.incidente?.tipo || 'N/A'}`,
        status: inc.status,
        statusLabel: statusCfg.label,
        responses: inc.gestaoInterna?.historicoStatus?.map((h, i) => ({
          id: `h_${i}`,
          content: h.observacao || statusCfg.label,
          responderName: 'Sistema de Incidentes',
          createdAt: h.data,
          isInternal: false,
        })) || [],
      })
      return
    }

    // 2. Buscar no IncidentsContext (denúncias)
    const den = denuncias.find(d => d.trackingCode === code)
    if (den) {
      const statusCfg = INCIDENT_STATUS_CONFIG[den.status] || INCIDENT_STATUS_CONFIG.pending
      setTrackResult({
        subject: den.denuncia?.titulo || `Denúncia: ${den.protocolo}`,
        description: `Protocolo: ${den.protocolo} | Tipo: ${den.denuncia?.tipo || 'N/A'}`,
        status: den.status,
        statusLabel: statusCfg.label,
        responses: den.gestaoInterna?.historicoStatus?.map((h, i) => ({
          id: `h_${i}`,
          content: h.observacao || statusCfg.label,
          responderName: 'Canal de Denúncias',
          createdAt: h.data,
          isInternal: false,
        })) || [],
      })
      return
    }

    // 3. Fallback: buscar no MessagesContext (reports legado)
    const report = trackReport(code)
    if (report) {
      setTrackResult(report)
      return
    }

    setTrackError("Codigo nao encontrado. Verifique e tente novamente.")
  }

  const handleSendMessage = async () => {
    if (!composeForm.recipientId || !composeForm.subject.trim() || !composeForm.content.trim()) return
    await sendMessage({
      recipientId: composeForm.recipientId,
      subject: composeForm.subject.trim(),
      content: composeForm.content.trim(),
      priority: composeForm.priority,
    })
    setComposeForm({ recipientId: "", subject: "", content: "", priority: "normal" })
    setComposeOpen(false)
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
          <div className="flex items-center gap-2 flex-1 justify-center mx-2">
            <h1 className="text-base font-semibold text-foreground truncate">
              Caixa de Mensagens
            </h1>
            {allUnreadCount > 0 && (
              <Badge variant="destructive" count={allUnreadCount} />
            )}
          </div>
          <div className="min-w-[70px] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUnreadOnly((prev) => !prev)}
              className={`p-1 transition-opacity hover:opacity-70 ${
                showUnreadOnly
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
              aria-label={showUnreadOnly ? "Mostrar todas" : "Filtrar nao lidas"}
            >
              <ListFilter className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <main className="pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="pills" className="w-full">
          {/* Gmail-style category tabs: active = green pill icon+text, inactive = gray pill icon-only */}
          <TabsList className="mx-4 sm:mx-5 mb-3 overflow-visible pb-0 gap-2 flex-nowrap">
            <TabsTrigger
              value="todas"
              icon={<Inbox className="h-[18px] w-[18px]" />}
              className="shrink min-w-0 py-2 px-3 border-transparent gap-0 transition-all duration-200 ease-in-out data-[state=active]:flex-[3] data-[state=active]:gap-2 data-[state=inactive]:flex-1 data-[state=inactive]:justify-center data-[state=inactive]:bg-secondary data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-transparent"
            >
              {activeTab === "todas" ? "Todas" : null}
            </TabsTrigger>
            <TabsTrigger
              value="mensagens"
              icon={<MessageSquare className="h-[18px] w-[18px]" />}
              className="shrink min-w-0 py-2 px-3 border-transparent gap-0 transition-all duration-200 ease-in-out data-[state=active]:flex-[3] data-[state=active]:gap-2 data-[state=inactive]:flex-1 data-[state=inactive]:justify-center data-[state=inactive]:bg-secondary data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-transparent"
            >
              {activeTab === "mensagens" ? "Mensagens" : null}
            </TabsTrigger>
            <TabsTrigger
              value="notificacoes"
              icon={<Bell className="h-[18px] w-[18px]" />}
              className="shrink min-w-0 py-2 px-3 border-transparent gap-0 transition-all duration-200 ease-in-out data-[state=active]:flex-[3] data-[state=active]:gap-2 data-[state=inactive]:flex-1 data-[state=inactive]:justify-center data-[state=inactive]:bg-secondary data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-transparent"
            >
              {activeTab === "notificacoes" ? "Notificacoes" : null}
            </TabsTrigger>
            <TabsTrigger
              value="rastrear"
              icon={<Search className="h-[18px] w-[18px]" />}
              className="shrink min-w-0 py-2 px-3 border-transparent gap-0 transition-all duration-200 ease-in-out data-[state=active]:flex-[3] data-[state=active]:gap-2 data-[state=inactive]:flex-1 data-[state=inactive]:justify-center data-[state=inactive]:bg-secondary data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-transparent"
            >
              {activeTab === "rastrear" ? "Rastrear" : null}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Todas (mescladas por data) - estilo iOS Mail */}
          <TabsContent value="todas" className="px-4 sm:px-5">
            {allItems.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">
                  Nenhuma mensagem ou notificacao
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suas mensagens e notificacoes aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none border border-transparent dark:border-border">
                {allItems.map((item, idx) => (
                  <MailRow
                    key={item.id}
                    item={item}
                    categoryLabel={getCategoryLabel(item, notificationCategories)}
                    isLast={idx === allItems.length - 1}
                    onClick={() =>
                      item._itemType === "notification"
                        ? handleNotificationClick(item)
                        : handleMessageClick(item)
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Mensagens - estilo iOS Mail */}
          <TabsContent value="mensagens" className="px-4 sm:px-5">
            <div className="space-y-3">
              <Button onClick={() => setComposeOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nova Mensagem
              </Button>

              {displayMessages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">
                    {showUnreadOnly ? "Nenhuma mensagem nao lida" : "Nenhuma mensagem"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Suas mensagens privadas aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="bg-card rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none border border-transparent dark:border-border">
                  {displayMessages.map((msg, idx) => (
                    <MailRow
                      key={msg.id}
                      item={{ ...msg, _itemType: "message" }}
                      categoryLabel={msg.senderRole || ""}
                      isLast={idx === displayMessages.length - 1}
                      onClick={() => handleMessageClick(msg)}
                    />
                  ))}
                </div>
              )}

              {archivedMessages.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowArchived((prev) => !prev)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2 px-1"
                  >
                    <Archive className="w-4 h-4" />
                    Arquivadas ({archivedMessages.length})
                    <ChevronLeft className={`w-4 h-4 transition-transform ${showArchived ? "-rotate-90" : ""}`} />
                  </button>
                  {showArchived && (
                    <div className="bg-card rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none border border-transparent dark:border-border opacity-70">
                      {archivedMessages.map((msg, idx) => (
                        <MailRow
                          key={msg.id}
                          item={{ ...msg, _itemType: "message" }}
                          categoryLabel={msg.senderRole || ""}
                          isLast={idx === archivedMessages.length - 1}
                          onClick={() => handleMessageClick(msg)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Notificacoes - estilo iOS Mail com chips de categoria */}
          <TabsContent value="notificacoes" className="px-4 sm:px-5">
            <div className="space-y-3">
              {/* Category filter chips - scroll horizontal */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                    !categoryFilter
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground border border-border"
                  }`}
                >
                  Todas
                </button>
                {CATEGORY_CHIPS.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategoryFilter(categoryFilter === cat.key ? null : cat.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      categoryFilter === cat.key
                        ? "text-white"
                        : "bg-card text-muted-foreground border border-border"
                    }`}
                    style={
                      categoryFilter === cat.key
                        ? { backgroundColor: isDark ? cat.colorDark : cat.colorLight }
                        : undefined
                    }
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Notifications flat list */}
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">
                    Nenhuma notificacao
                    {categoryFilter ? ` em ${notificationCategories?.[categoryFilter]?.label || categoryFilter}` : ""}
                  </p>
                </div>
              ) : (
                <div className="bg-card rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none border border-transparent dark:border-border">
                  {filteredNotifications.map((notif, idx) => (
                    <MailRow
                      key={notif.id}
                      item={{ ...notif, _itemType: "notification" }}
                      categoryLabel={notificationCategories?.[notif.category]?.label || ""}
                      isLast={idx === filteredNotifications.length - 1}
                      onClick={() => handleNotificationClick(notif)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Rastrear */}
          <TabsContent value="rastrear" className="px-4 sm:px-5">
            <SectionCard title="Rastrear Denuncia" subtitle="ACOMPANHAMENTO">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Digite o codigo de rastreio para acompanhar o status da sua denuncia anonima.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => {
                      setTrackingCode(e.target.value)
                      setTrackError("")
                      setTrackResult(null)
                    }}
                    placeholder="Ex: ANEST-2026-A1B2C3"
                    className="flex-1 px-4 py-2 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button onClick={handleTrack}>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </div>
                {trackError && (
                  <p className="text-sm text-destructive">{trackError}</p>
                )}
                {trackResult && (
                  <Card variant="default" className="bg-card">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">
                            {trackResult.subject}
                          </h4>
                          <Badge
                            variant={
                              trackResult.status === "resolved" || trackResult.status === "closed"
                                ? "success"
                                : trackResult.status === "in_review" || trackResult.status === "investigating"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {trackResult.statusLabel || (
                              trackResult.status === "resolved"
                                ? "Resolvido"
                                : trackResult.status === "in_review"
                                  ? "Em análise"
                                  : "Pendente"
                            )}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {trackResult.description}
                        </p>
                        {trackResult.responses?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              RESPOSTAS
                            </p>
                            {trackResult.responses
                              .filter((r) => !r.isInternal)
                              .map((resp) => (
                                <div key={resp.id} className="mb-2">
                                  <p className="text-sm text-foreground">
                                    {resp.content}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {resp.responderName} ·{" "}
                                    {new Date(resp.createdAt).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal: Compose Message */}
      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Nova Mensagem"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Destinatario
            </label>
            <select
              value={composeForm.recipientId}
              onChange={(e) => setComposeForm((p) => ({ ...p, recipientId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Assunto
            </label>
            <input
              type="text"
              value={composeForm.subject}
              onChange={(e) => setComposeForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Assunto da mensagem"
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Mensagem
            </label>
            <textarea
              value={composeForm.content}
              onChange={(e) => setComposeForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Digite sua mensagem..."
              rows={5}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Prioridade
            </label>
            <div className="flex gap-2">
              {["normal", "alta", "urgente"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setComposeForm((prev) => ({ ...prev, priority: p }))}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                    composeForm.priority === p
                      ? p === "urgente"
                        ? "bg-destructive text-white"
                        : p === "alta"
                          ? "bg-warning text-white"
                          : "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 pb-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setComposeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSendMessage}
              disabled={!composeForm.recipientId || !composeForm.subject.trim() || !composeForm.content.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
