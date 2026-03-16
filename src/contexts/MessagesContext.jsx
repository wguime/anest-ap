import * as React from "react"
import { useUser } from "@/contexts/UserContext"
import { usePullToRefreshListener } from '@/design-system/components/anest/pull-to-refresh'
// Lazy-loaded services to avoid circular dependency at module init time
let _msgSvc = null
const msgSvc = async () => _msgSvc || (_msgSvc = (await import("@/services/supabaseMessagesService")).default)

let _usrSvc = null
const usrSvc = async () => _usrSvc || (_usrSvc = (await import("@/services/supabaseUsersService")).default)

/**
 * MessagesContext - Contexto para gerenciar mensagens e notificacoes
 *
 * Sistema de comunicacao interna com:
 * - Mensagens privadas entre usuarios (Supabase real-time)
 * - Notificacoes nominais (local state, enhanced later)
 * - Denuncias anonimas com codigo de rastreio (local state, enhanced later)
 *
 * @example
 * <MessagesProvider>
 *   <App />
 * </MessagesProvider>
 *
 * const { messages, sendMessage, unreadCount } = useMessages()
 */

// Categorias de notificacao/denuncia (config, not mock data)
const REPORT_CATEGORIES = [
  { value: "seguranca_paciente", label: "Seguranca do Paciente", icon: "Shield" },
  { value: "equipamentos", label: "Equipamentos/Infraestrutura", icon: "Wrench" },
  { value: "medicamentos", label: "Medicamentos", icon: "Pill" },
  { value: "conduta_profissional", label: "Conduta Profissional", icon: "UserX" },
  { value: "organizacional", label: "Questoes Organizacionais", icon: "Building" },
  { value: "etica", label: "Questoes Eticas", icon: "Scale" },
  { value: "sugestao", label: "Sugestao de Melhoria", icon: "Lightbulb" },
  { value: "outro", label: "Outro", icon: "HelpCircle" },
]

// 11 Categorias de notificacao do sistema
const NOTIFICATION_CATEGORIES = {
  plantao: {
    key: "plantao",
    label: "Plantoes",
    icon: "Stethoscope",
    colorLight: "#16A085",
    colorDark: "#2ECC71",
  },
  comunicado: {
    key: "comunicado",
    label: "Comunicados",
    icon: "Megaphone",
    colorLight: "#F59E0B",
    colorDark: "#F39C12",
  },
  educacao: {
    key: "educacao",
    label: "Educacao",
    icon: "GraduationCap",
    colorLight: "#8B5CF6",
    colorDark: "#A78BFA",
  },
  incidente: {
    key: "incidente",
    label: "Incidentes",
    icon: "AlertTriangle",
    colorLight: "#DC2626",
    colorDark: "#E74C3C",
  },
  qualidade: {
    key: "qualidade",
    label: "Qualidade",
    icon: "Target",
    colorLight: "#10B981",
    colorDark: "#34D399",
  },
  documento: {
    key: "documento",
    label: "Documentos",
    icon: "FileText",
    colorLight: "#3B82F6",
    colorDark: "#60A5FA",
  },
  sistema: {
    key: "sistema",
    label: "Sistema",
    icon: "Settings",
    colorLight: "#6366F1",
    colorDark: "#818CF8",
  },
  reuniao: {
    key: "reuniao",
    label: "Reunioes",
    icon: "Users",
    colorLight: "#EC4899",
    colorDark: "#F472B6",
  },
  faturamento: {
    key: "faturamento",
    label: "Faturamento",
    icon: "DollarSign",
    colorLight: "#F97316",
    colorDark: "#FB923C",
  },
  rops: {
    key: "rops",
    label: "ROPs",
    icon: "Trophy",
    colorLight: "#EAB308",
    colorDark: "#FACC15",
  },
  privada: {
    key: "privada",
    label: "Mensagens",
    icon: "MessageSquare",
    colorLight: "#006837",
    colorDark: "#2ECC71",
  },
}

// Funcao para gerar codigo de rastreio
function generateTrackingCode() {
  const year = new Date().getFullYear()
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `ANEST-${year}-${code}`
}

// Context
const MessagesContext = React.createContext(null)

// Provider
export function MessagesProvider({ children }) {
  const { user } = useUser()

  const [messages, setMessages] = React.useState([])
  const [threads, setThreads] = React.useState([])
  const [reports, setReports] = React.useState([])
  const [notifications, setNotifications] = React.useState([])
  const [users, setUsers] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(false)

  // Derive currentUser from UserContext
  const currentUser = React.useMemo(() => {
    if (!user) return null
    return {
      id: user.uid || user.id,
      name: user.displayName || user.nome || 'Usuario',
      role: user.role || '',
      avatar: user.photoURL || user.avatar || null,
      email: user.email,
    }
  }, [user])

  // Stable ref for currentUser to avoid stale closures in callbacks
  const currentUserRef = React.useRef(currentUser)
  currentUserRef.current = currentUser

  // ====================================================================
  // FETCH MESSAGES + NOTIFICATIONS ON MOUNT (Supabase)
  // ====================================================================

  React.useEffect(() => {
    const uid = user?.uid || user?.id
    if (!uid) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        const svc = await msgSvc()
        const [msgs, notifs] = await Promise.all([
          svc.fetchMessages(uid),
          svc.fetchNotifications(uid),
        ])
        setMessages(msgs)
        setNotifications(notifs)
      } catch (err) {
        // Expected when tables don't exist yet or userId format mismatch — suppress
        if (!err.message?.includes('TABLE_NOT_FOUND')) {
          console.warn('[MessagesContext] Could not load messages/notifications:', err.message)
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [user?.uid, user?.id])

  // ====================================================================
  // FETCH USERS LIST (for compose/recipient picker)
  // ====================================================================

  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const svc = await usrSvc()
        const allUsers = await svc.fetchAllUsers({ active: true })
        // Map Supabase profile fields to the shape expected by components
        // Supabase profiles use `nome` and `id`; components expect `name` and `id`
        const mapped = allUsers.map((u) => ({
          id: u.id,
          name: u.nome || u.email || 'Usuario',
          role: u.role || '',
          avatar: u.avatar || null,
          email: u.email,
        }))
        setUsers(mapped)
      } catch (err) {
        console.error('[MessagesContext] Error loading users list:', err)
      }
    }
    // Only fetch users once the current user is authenticated
    if (user?.uid || user?.id) {
      loadUsers()
    }
  }, [user?.uid, user?.id])

  // ====================================================================
  // REAL-TIME SUBSCRIPTION (Supabase)
  // ====================================================================

  React.useEffect(() => {
    const uid = user?.uid || user?.id
    if (!uid) return

    let cleanupFn = null
    let cancelled = false

    ;(async () => {
      const svc = await msgSvc()
      if (cancelled) return

      const handleRefetch = async () => {
        try {
          const msgs = await svc.fetchMessages(uid)
          setMessages(msgs)
        } catch (err) {
          console.error('[MessagesContext] Error refetching messages:', err)
        }
      }

      const { cleanup } = svc.subscribeToMessages(
        uid,
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev
              return [payload.new, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            )
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) =>
              prev.filter((m) => m.id !== payload.old.id)
            )
          }
        },
        handleRefetch
      )
      cleanupFn = cleanup
    })()

    return () => {
      cancelled = true
      cleanupFn?.()
    }
  }, [user?.uid, user?.id])

  // ====================================================================
  // REAL-TIME SUBSCRIPTION — NOTIFICATIONS (Supabase)
  // ====================================================================

  React.useEffect(() => {
    const uid = user?.uid || user?.id
    if (!uid) return

    let cleanupFn = null
    let cancelled = false

    ;(async () => {
      const svc = await msgSvc()
      if (cancelled) return

      const handleRefetch = async () => {
        try {
          const notifs = await svc.fetchNotifications(uid)
          setNotifications(notifs)
        } catch (err) {
          console.error('[MessagesContext] Error refetching notifications:', err)
        }
      }

      const { cleanup } = svc.subscribeToNotifications(
        uid,
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications((prev) => {
              if (prev.some((n) => n.id === payload.new.id)) return prev
              return [payload.new, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? payload.new : n))
            )
          } else if (payload.eventType === 'DELETE') {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== payload.old.id)
            )
          }
        },
        handleRefetch
      )
      cleanupFn = cleanup
    })()

    return () => {
      cancelled = true
      cleanupFn?.()
    }
  }, [user?.uid, user?.id])

  // ====================================================================
  // CONTADORES
  // ====================================================================

  const unreadCount = React.useMemo(() => {
    if (!currentUser) return 0
    return messages.filter(
      (m) => m.recipientId === currentUser.id && !m.readAt && !m.isArchived
    ).length
  }, [messages, currentUser])

  const pendingReportsCount = React.useMemo(() => {
    return reports.filter((r) => r.status === "pending" || r.status === "in_review")
      .length
  }, [reports])

  const unreadNotificationsCount = React.useMemo(() => {
    return notifications.filter((n) => !n.readAt).length
  }, [notifications])

  const totalUnreadCount = React.useMemo(() => {
    return unreadCount + unreadNotificationsCount
  }, [unreadCount, unreadNotificationsCount])

  // ====================================================================
  // ACOES - MENSAGENS (Supabase backed)
  // ====================================================================

  const sendMessage = React.useCallback(
    async (data) => {
      const cu = currentUserRef.current
      if (!cu) throw new Error('Usuario nao autenticado')

      // Resolve recipient name from users list
      const recipient = users.find((u) => u.id === data.recipientId)

      const messageData = {
        subject: data.subject,
        content: data.content,
        senderId: cu.id,
        senderName: cu.name,
        senderRole: cu.role,
        senderAvatar: cu.avatar,
        recipientId: data.recipientId,
        recipientName: recipient?.name || 'Usuario',
        priority: data.priority || 'normal',
        attachments: data.attachments || [],
        threadId: data.threadId || null,
        parentMessageId: data.parentMessageId || null,
      }

      // Optimistic update
      const optimisticId = `temp_${Date.now()}`
      const optimistic = {
        ...messageData,
        id: optimisticId,
        type: 'private',
        readAt: null,
        isArchived: false,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [optimistic, ...prev])

      try {
        const svc = await msgSvc()
        const created = await svc.sendMessage(messageData)
        // Replace optimistic entry with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? created : m))
        )
        return created
      } catch (err) {
        // Remove optimistic entry on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        console.error('[MessagesContext] Error sending message:', err)
        throw err
      }
    },
    [users]
  )

  const replyToMessage = React.useCallback(
    async (threadId, data) => {
      const cu = currentUserRef.current
      if (!cu) return null

      const originalMessage = messages.find((m) => m.threadId === threadId)
      if (!originalMessage) return null

      const recipientId =
        originalMessage.senderId === cu.id
          ? originalMessage.recipientId
          : originalMessage.senderId

      return sendMessage({
        ...data,
        threadId,
        parentMessageId: originalMessage.id,
        recipientId,
        subject: `Re: ${originalMessage.subject}`,
      })
    },
    [messages, sendMessage]
  )

  const markAsRead = React.useCallback((messageId) => {
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, readAt: new Date().toISOString() } : m
      )
    )
    // Fire-and-forget Supabase update
    msgSvc().then(svc => svc.markAsRead(messageId)).catch((err) => {
      console.error('[MessagesContext] Error marking as read:', err)
    })
  }, [])

  const markAsUnread = React.useCallback((messageId) => {
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, readAt: null } : m))
    )
    // Fire-and-forget Supabase update
    msgSvc().then(svc => svc.markAsUnread(messageId)).catch((err) => {
      console.error('[MessagesContext] Error marking as unread:', err)
    })
  }, [])

  const markAllAsRead = React.useCallback(() => {
    const cu = currentUserRef.current
    if (!cu) return

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.recipientId === cu.id && !m.readAt
          ? { ...m, readAt: new Date().toISOString() }
          : m
      )
    )
    // Fire-and-forget Supabase update
    msgSvc().then(svc => svc.markAllAsRead(cu.id)).catch((err) => {
      console.error('[MessagesContext] Error marking all as read:', err)
    })
  }, [])

  const archiveMessage = React.useCallback((messageId) => {
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isArchived: true } : m))
    )
    // Fire-and-forget Supabase update
    msgSvc().then(svc => svc.archiveMessage(messageId)).catch((err) => {
      console.error('[MessagesContext] Error archiving message:', err)
    })
  }, [])

  const deleteMessage = React.useCallback((messageId) => {
    // Optimistic update
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    // Fire-and-forget Supabase delete
    msgSvc().then(svc => svc.deleteMessage(messageId)).catch((err) => {
      console.error('[MessagesContext] Error deleting message:', err)
    })
  }, [])

  // ====================================================================
  // ACOES - THREADS
  // ====================================================================

  const getThread = React.useCallback(
    (threadId) => {
      return threads.find((t) => t.threadId === threadId) || null
    },
    [threads]
  )

  const getThreadMessages = React.useCallback(
    (threadId) => {
      return messages.filter((m) => m.threadId === threadId)
    },
    [messages]
  )

  // ====================================================================
  // ACOES - REPORTS (local state for now, Supabase later)
  // ====================================================================

  const submitReport = React.useCallback(
    async (data) => {
      const cu = currentUserRef.current
      const isAnonymous = data.isAnonymous !== false
      const trackingCode = isAnonymous ? generateTrackingCode() : null

      const newReport = {
        id: `report_${Date.now()}`,
        type: isAnonymous ? "anonymous_report" : "notification",
        isAnonymous,
        reporterId: isAnonymous ? null : cu?.id || null,
        reporterName: isAnonymous ? null : cu?.name || null,
        trackingCode,
        category: data.category,
        subject: data.subject,
        description: data.description,
        status: "pending",
        assignedTo: null,
        responses: [],
        attachments: data.attachments || [],
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      }

      setReports((prev) => [newReport, ...prev])
      return { trackingCode, report: newReport }
    },
    []
  )

  const trackReport = React.useCallback(
    (trackingCode) => {
      return reports.find((r) => r.trackingCode === trackingCode) || null
    },
    [reports]
  )

  // ====================================================================
  // ACOES - ADMIN (local state for now)
  // ====================================================================

  const respondToReport = React.useCallback(
    async (reportId, data) => {
      const cu = currentUserRef.current
      const response = {
        id: `resp_${Date.now()}`,
        responderId: cu?.id || null,
        responderName: cu?.name || 'Admin',
        content: data.content,
        createdAt: new Date().toISOString(),
        isInternal: data.isInternal || false,
      }

      setReports((prev) =>
        prev.map((r) => {
          if (r.id === reportId) {
            return {
              ...r,
              responses: [...r.responses, response],
              status: data.newStatus || r.status,
              resolvedAt:
                data.newStatus === "resolved" ? new Date().toISOString() : r.resolvedAt,
            }
          }
          return r
        })
      )
    },
    []
  )

  const updateReportStatus = React.useCallback(async (reportId, status) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status,
              resolvedAt: status === "resolved" ? new Date().toISOString() : r.resolvedAt,
            }
          : r
      )
    )
  }, [])

  // ====================================================================
  // ACOES - NOTIFICATIONS (local state for now, Supabase later)
  // ====================================================================

  const createSystemNotification = React.useCallback((data) => {
    const cu = currentUserRef.current
    const baseNotif = {
      category: data.category || "sistema",
      subject: data.subject,
      content: data.content,
      senderName: data.senderName || "Sistema ANEST",
      priority: data.priority || "normal",
      actionUrl: data.actionUrl || null,
      actionLabel: data.actionLabel || null,
      actionParams: data.actionParams || null,
      dismissable: data.dismissable !== false,
      relatedEntityType: data.relatedEntityType || null,
      relatedEntityId: data.relatedEntityId || null,
    }

    // Determine recipients
    const recipientIds = data.recipientIds || (data.recipientId ? [data.recipientId] : null)

    if (recipientIds && recipientIds.length > 0) {
      // Targeted notification — persist to Supabase for each recipient
      msgSvc().then(svc => svc.createNotificationBatch(recipientIds, baseNotif)).catch((err) => {
        console.error('[MessagesContext] Error persisting batch notification:', err)
      })

      // If current user is among recipients, add optimistically to local state
      if (cu && recipientIds.includes(cu.id)) {
        const optimistic = {
          ...baseNotif,
          id: `notif_${Date.now()}`,
          recipientId: cu.id,
          readAt: null,
          createdAt: new Date().toISOString(),
        }
        setNotifications((prev) => [optimistic, ...prev])
        return optimistic
      }
      return null
    }

    // No specific recipient — broadcast to current user locally
    // (fallback for legacy callers that don't pass recipientId)
    const localNotif = {
      ...baseNotif,
      id: `notif_${Date.now()}`,
      recipientId: cu?.id || null,
      readAt: null,
      createdAt: new Date().toISOString(),
    }
    setNotifications((prev) => [localNotif, ...prev])

    // Also persist to Supabase for the current user if authenticated
    if (cu?.id) {
      msgSvc().then(svc => svc.createNotification({
        ...baseNotif,
        recipientId: cu.id,
      })).catch((err) => {
        console.error('[MessagesContext] Error persisting notification:', err)
      })
    }

    return localNotif
  }, [])

  const markNotificationAsRead = React.useCallback((notifId) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notifId ? { ...n, readAt: new Date().toISOString() } : n
      )
    )
    // Fire-and-forget Supabase update (skip temp IDs)
    if (!String(notifId).startsWith('notif_')) {
      msgSvc().then(svc => svc.markNotificationAsRead(notifId)).catch((err) => {
        console.error('[MessagesContext] Error marking notification as read:', err)
      })
    }
  }, [])

  const markAllNotificationsAsRead = React.useCallback(() => {
    const cu = currentUserRef.current
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (!n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
    )
    // Fire-and-forget Supabase update
    if (cu?.id) {
      msgSvc().then(svc => svc.markAllNotificationsAsRead(cu.id)).catch((err) => {
        console.error('[MessagesContext] Error marking all notifications as read:', err)
      })
    }
  }, [])

  const dismissNotification = React.useCallback((notifId) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== notifId))
    // Fire-and-forget Supabase delete (skip temp IDs)
    if (!String(notifId).startsWith('notif_')) {
      msgSvc().then(svc => svc.dismissNotification(notifId)).catch((err) => {
        console.error('[MessagesContext] Error dismissing notification:', err)
      })
    }
  }, [])

  // ====================================================================
  // FILTROS - NOTIFICATIONS
  // ====================================================================

  const getNotifications = React.useCallback(
    (categoryFilter = null) => {
      if (categoryFilter) {
        return notifications.filter((n) => n.category === categoryFilter)
      }
      return notifications
    },
    [notifications]
  )

  const getMessagesByCategory = React.useCallback(
    (category) => {
      return notifications.filter((n) => n.category === category)
    },
    [notifications]
  )

  // ====================================================================
  // FILTROS - MENSAGENS
  // ====================================================================

  const getInboxMessages = React.useCallback(() => {
    if (!currentUser) return []
    return messages.filter(
      (m) => m.recipientId === currentUser.id && !m.isArchived
    )
  }, [messages, currentUser])

  const getSentMessages = React.useCallback(() => {
    if (!currentUser) return []
    return messages.filter((m) => m.senderId === currentUser.id)
  }, [messages, currentUser])

  const getArchivedMessages = React.useCallback(() => {
    if (!currentUser) return []
    return messages.filter(
      (m) =>
        (m.recipientId === currentUser.id || m.senderId === currentUser.id) &&
        m.isArchived
    )
  }, [messages, currentUser])

  const searchMessages = React.useCallback(
    (query) => {
      const lowerQuery = query.toLowerCase()
      return messages.filter(
        (m) =>
          (m.subject || '').toLowerCase().includes(lowerQuery) ||
          (m.content || '').toLowerCase().includes(lowerQuery) ||
          (m.senderName || '').toLowerCase().includes(lowerQuery)
      )
    },
    [messages]
  )

  // ====================================================================
  // REFRESH
  // ====================================================================

  const refresh = React.useCallback(async () => {
    const uid = user?.uid || user?.id
    if (!uid) return

    setIsLoading(true)
    try {
      const svc = await msgSvc()
      const [msgs, notifs] = await Promise.all([
        svc.fetchMessages(uid),
        svc.fetchNotifications(uid),
      ])
      setMessages(msgs)
      setNotifications(notifs)
    } catch (err) {
      console.error('[MessagesContext] Error refreshing:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid, user?.id])

  // Pull-to-refresh: recarrega mensagens quando o usuário puxa a página
  usePullToRefreshListener(refresh)

  // ====================================================================
  // VALUE
  // ====================================================================

  const value = React.useMemo(
    () => ({
      // Estado
      messages,
      threads,
      reports,
      notifications,
      currentUser,
      users,
      categories: REPORT_CATEGORIES,
      notificationCategories: NOTIFICATION_CATEGORIES,

      // Contadores
      unreadCount,
      pendingReportsCount,
      unreadNotificationsCount,
      totalUnreadCount,

      // Loading
      isLoading,

      // Acoes - Mensagens
      sendMessage,
      replyToMessage,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      archiveMessage,
      deleteMessage,

      // Acoes - Threads
      getThread,
      getThreadMessages,

      // Acoes - Notifications
      createSystemNotification,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      dismissNotification,

      // Acoes - Reports
      submitReport,
      trackReport,

      // Admin
      respondToReport,
      updateReportStatus,

      // Filtros
      getInboxMessages,
      getSentMessages,
      getArchivedMessages,
      searchMessages,
      getNotifications,
      getMessagesByCategory,

      // Refresh
      refresh,
    }),
    [
      messages,
      threads,
      reports,
      notifications,
      currentUser,
      users,
      unreadCount,
      pendingReportsCount,
      unreadNotificationsCount,
      totalUnreadCount,
      isLoading,
      sendMessage,
      replyToMessage,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      archiveMessage,
      deleteMessage,
      getThread,
      getThreadMessages,
      createSystemNotification,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      dismissNotification,
      submitReport,
      trackReport,
      respondToReport,
      updateReportStatus,
      getInboxMessages,
      getSentMessages,
      getArchivedMessages,
      searchMessages,
      getNotifications,
      getMessagesByCategory,
      refresh,
    ]
  )

  return (
    <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
  )
}

// Hook para consumir o contexto
export function useMessages() {
  const context = React.useContext(MessagesContext)
  if (!context) {
    throw new Error("useMessages deve ser usado dentro de um MessagesProvider")
  }
  return context
}

// Exports adicionais
export { REPORT_CATEGORIES, NOTIFICATION_CATEGORIES, generateTrackingCode }
