import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { MessageSquare, Bell, Search, Plus, ChevronLeft, Send, Inbox, ListFilter, Archive, Check, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Fuse from "fuse.js"
import { useDebouncedCallback } from "use-debounce"

import { SectionCard, Badge, Button, Card, CardContent, Select, useTheme } from "@/design-system"
import { PageHeader } from "@/components"
import { Tabs, TabsList, TabsTrigger, TabsContent, Modal } from "@/design-system/components/ui"
import { FileUpload } from "@/design-system/components/ui/file-upload"
import { SearchToggleButton } from "@/design-system/components/anest/search-toggle-button"
import { formatDate, formatTime } from "@/utils/formatters"
import { useMessages, NOTIFICATION_CATEGORIES } from "@/contexts/MessagesContext"
import { useEventAlerts } from "@/contexts/EventAlertsContext"
import { STATUS_CONFIG as INCIDENT_STATUS_CONFIG } from "@/data/incidentesConfig"
import supabaseIncidentsService from "@/services/supabaseIncidentsService"

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
    return formatTime(date)
  }
  if (diffDays === 1) return "Ontem"
  if (diffDays < 7) {
    return formatDate(date, { weekday: "short" }).replace(".", "")
  }
  return formatDate(date, { day: "2-digit", month: "2-digit" })
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
function MailRow({ item, categoryLabel, isLast, onClick, selectionMode, isSelected, onToggleSelect }) {
  const isUnread = !item.readAt
  return (
    <button
      type="button"
      onClick={selectionMode ? () => onToggleSelect(item.id) : onClick}
      onContextMenu={(e) => {
        if (!selectionMode) {
          e.preventDefault()
          onToggleSelect?.(item.id)
        }
      }}
      className="w-full text-left active:bg-muted dark:active:bg-muted transition-colors"
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        {/* Unread dot or selection checkbox */}
        <div className="w-4 pt-1 shrink-0 flex justify-center">
          {selectionMode ? (
            <span className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
              {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
            </span>
          ) : isUnread ? (
            <span className="block w-[10px] h-[10px] rounded-full bg-primary mt-0.5" />
          ) : null}
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
    _unreadCount,
    getInboxMessages,
    markAsRead,
    markAllAsRead,
    archiveMessage,
    _isLoading,
    notifications,
    notificationCategories,
    _unreadNotificationsCount,
    totalUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    _dismissNotification,
    _getNotifications,
    getArchivedMessages,
    users,
    sendMessage,
  } = useMessages()

  const { alerts: eventAlerts, unreadCount: eventAlertsUnread, markAsViewed } = useEventAlerts()
  const { isDark } = useTheme()

  const [activeTab, setActiveTab] = useState("todas")
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [trackingCode, setTrackingCode] = useState("")
  const [trackResult, setTrackResult] = useState(null)
  const [trackError, setTrackError] = useState("")
  const [trackLoading, setTrackLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState(null)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectionMode, setSelectionMode] = useState(false)

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [])

  // Compose form state
  const [composeForm, setComposeForm] = useState({
    recipientId: "",
    subject: "",
    content: "",
    priority: "normal",
  })
  const [composeAttachments, setComposeAttachments] = useState([])

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
        content: `Evento: ${formatDate(new Date(alert.eventDate), "datetime")}`,
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

  // Fuse.js search
  const fuse = useMemo(() => {
    return new Fuse(allItems, {
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: "subject", weight: 0.5 },
        { name: "senderName", weight: 0.3 },
        { name: "content", weight: 0.2 },
      ],
    })
  }, [allItems])

  const debouncedSearch = useDebouncedCallback((query) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    const results = fuse.search(query).map((r) => r.item)
    setSearchResults(results)
  }, 200)

  const handleSearchChange = useCallback((val) => {
    setSearchQuery(val)
    debouncedSearch(val)
  }, [debouncedSearch])

  const displayAllItems = searchResults !== null ? searchResults : allItems

  // Constrói lista de irmãos {id, isNotification} para passar ao detalhe.
  // Filtra event_* (alertas locais) que não vão para messageDetail.
  const buildSiblings = (list) =>
    (list || [])
      .filter((it) => !String(it.id).startsWith("event_"))
      .map((it) => ({
        id: it.id,
        isNotification: it._itemType
          ? it._itemType === "notification"
          : it.category != null,
      }))

  const handleMessageClick = (message, listContext) => {
    markAsRead(message.id)
    onNavigate("messageDetail", {
      messageId: message.id,
      isNotification: false,
      siblings: buildSiblings(listContext),
    })
  }

  const handleNotificationClick = (notification, listContext) => {
    if (notification.id.startsWith("event_")) {
      markAsViewed(notification.id.replace('event_', ''))
      if (notification.actionUrl) {
        onNavigate(notification.actionUrl, notification.actionParams || undefined)
      }
      return
    }
    markNotificationAsRead(notification.id)
    onNavigate("messageDetail", {
      messageId: notification.id,
      isNotification: true,
      siblings: buildSiblings(listContext),
    })
  }

  const _handleNotificationAction = (notification) => {
    if (notification.actionUrl) {
      if (!notification.id.startsWith("event_")) {
        markNotificationAsRead(notification.id)
      }
      onNavigate(notification.actionUrl, notification.actionParams || undefined)
    }
  }

  const _handleMarkAllRead = () => {
    markAllAsRead()
    markAllNotificationsAsRead()
  }

  const handleTrack = async () => {
    setTrackError("")
    setTrackResult(null)
    if (!trackingCode.trim()) {
      setTrackError("Digite o codigo de rastreio")
      return
    }

    const code = trackingCode.trim().toUpperCase()
    setTrackLoading(true)

    try {
      const result = await supabaseIncidentsService.fetchByTrackingCode(code)
      if (result) {
        const statusCfg = INCIDENT_STATUS_CONFIG[result.status] || INCIDENT_STATUS_CONFIG.pending
        const isDenuncia = result.tipo === 'denuncia'
        const historico = Array.isArray(result.historicoStatus) ? result.historicoStatus : []
        setTrackResult({
          subject: isDenuncia
            ? (result.denunciaTitulo || `Denúncia: ${result.protocolo}`)
            : (result.incidenteResumo?.substring(0, 80) || `Incidente: ${result.protocolo}`),
          description: `Protocolo: ${result.protocolo} | Tipo: ${isDenuncia ? (result.denunciaTipo || 'N/A') : (result.incidenteTipo || 'N/A')}`,
          status: result.status,
          statusLabel: statusCfg.label,
          responses: historico.map((h, i) => ({
            id: `h_${i}`,
            content: h.observacao || statusCfg.label,
            responderName: isDenuncia ? 'Canal de Denúncias' : 'Sistema de Incidentes',
            createdAt: h.data,
            isInternal: false,
          })),
        })
        return
      }

      setTrackError("Codigo nao encontrado. Verifique e tente novamente.")
    } catch {
      setTrackError("Erro ao buscar. Tente novamente.")
    } finally {
      setTrackLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!composeForm.recipientId || !composeForm.subject.trim() || !composeForm.content.trim()) return
    await sendMessage({
      recipientId: composeForm.recipientId,
      subject: composeForm.subject.trim(),
      content: composeForm.content.trim(),
      priority: composeForm.priority,
      attachments: composeAttachments.length > 0
        ? composeAttachments.map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, type: f.type }))
        : undefined,
    })
    setComposeForm({ recipientId: "", subject: "", content: "", priority: "normal" })
    setComposeAttachments([])
    setComposeOpen(false)
  }

  const handleBulkMarkRead = async () => {
    const ids = [...selectedIds]
    ids.forEach((id) => markAsRead(id))
    clearSelection()
  }

  const handleBulkArchive = async () => {
    const ids = [...selectedIds]
    for (const id of ids) {
      try { await archiveMessage(id) } catch { /* individual fail ok */ }
    }
    clearSelection()
  }

  // Header
  const header = (
    <PageHeader
      title={
        <span className="flex items-center gap-2 justify-center">
          <span className="truncate">Caixa de Mensagens</span>
          {allUnreadCount > 0 && (
            <Badge variant="destructive" count={allUnreadCount} />
          )}
        </span>
      }
      onBack={goBack}
      actions={
        <div className="flex items-center gap-1.5">
          <SearchToggleButton
            active={searchOpen}
            onClick={() => {
              setSearchOpen((prev) => !prev)
              if (searchOpen) {
                setSearchQuery("")
                setSearchResults(null)
              }
            }}
            controlsId="inbox-search"
          />
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
      }
    />
  )

  return (
    <div className="min-h-dvh bg-background pb-32 overflow-x-hidden">
      {header}

      {/* Collapsible search bar */}
      {searchOpen && (
        <div id="inbox-search" className="px-4 sm:px-5 pt-3 pb-1">
          <input
            type="search"
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar mensagens e notificações..."
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchResults !== null && (
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

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
            {displayAllItems.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">
                  {searchQuery ? "Nenhum resultado encontrado" : "Nenhuma mensagem ou notificacao"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? "Tente outros termos de busca" : "Suas mensagens e notificacoes aparecerão aqui"}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none border border-transparent dark:border-border">
                {displayAllItems.map((item, idx) => (
                  <MailRow
                    key={item.id}
                    item={item}
                    categoryLabel={getCategoryLabel(item, notificationCategories)}
                    isLast={idx === displayAllItems.length - 1}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={(id) => {
                      toggleSelect(id)
                      if (!selectionMode) setSelectionMode(true)
                    }}
                    onClick={() =>
                      item._itemType === "notification"
                        ? handleNotificationClick(item, displayAllItems)
                        : handleMessageClick(item, displayAllItems)
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
                      onClick={() => handleMessageClick(msg, displayMessages)}
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
                          onClick={() => handleMessageClick(msg, archivedMessages)}
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
                      onClick={() => handleNotificationClick(notif, filteredNotifications)}
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
                  <Button onClick={handleTrack} disabled={trackLoading}>
                    <Search className="h-4 w-4 mr-2" />
                    {trackLoading ? "Buscando..." : "Buscar"}
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
                                    {formatDate(new Date(resp.createdAt))}
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
            <Select
              label="Destinatario"
              placeholder="Selecione..."
              searchable
              value={composeForm.recipientId}
              onChange={(val) => setComposeForm((p) => ({ ...p, recipientId: val }))}
              options={users.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.role})`,
              }))}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-primary mb-1 block">
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
            <label className="text-sm font-semibold text-primary mb-1 block">
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
            <FileUpload
              onChange={setComposeAttachments}
              value={composeAttachments}
              multiple
              maxSize={20 * 1024 * 1024}
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

      {/* Floating Action Bar for bulk selection */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 left-4 right-4 z-sticky bg-card border border-border rounded-2xl shadow-lg p-3 flex items-center gap-3 max-w-lg mx-auto"
          >
            <span className="text-sm font-medium text-foreground flex-1">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <Button size="sm" variant="outline" onClick={handleBulkMarkRead}>
              <Check className="w-4 h-4 mr-1" />
              Lido
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkArchive}>
              <Archive className="w-4 h-4 mr-1" />
              Arquivar
            </Button>
            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cancelar seleção"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
