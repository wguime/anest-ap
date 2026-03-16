import * as React from "react"
import { Search, Inbox, Send, Archive, Mail } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Input, Tabs, TabsList, TabsTrigger, TabsContent, EmptyList, Spinner } from "@/design-system/components/ui"
import { MessageCard } from "./message-card"

/**
 * MessageList - Lista de mensagens com filtros e busca
 *
 * Componente para exibir lista de mensagens com:
 * - Tabs de filtro (Todas, Nao lidas, Enviadas, Arquivadas)
 * - Campo de busca
 * - Lista de MessageCards
 * - Estado vazio personalizado
 *
 * @example
 * <MessageList
 *   messages={messages}
 *   onMessageClick={(msg) => handleClick(msg)}
 *   onFilterChange={(filter) => setFilter(filter)}
 * />
 */

const FILTER_TABS = [
  { value: "all", label: "Todas", icon: Inbox },
  { value: "unread", label: "Nao lidas", icon: Mail },
  { value: "sent", label: "Enviadas", icon: Send },
  { value: "archived", label: "Arquivadas", icon: Archive },
]

function MessageList({
  messages = [],
  filter = "all",
  showFilters = true,
  showSearch = true,
  onMessageClick,
  onFilterChange,
  onMarkAsRead,
  onArchive,
  emptyState,
  loading = false,
  unreadCount = 0,
  className,
  ...props
}) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeFilter, setActiveFilter] = React.useState(filter)

  // Atualiza filtro externo quando muda
  React.useEffect(() => {
    setActiveFilter(filter)
  }, [filter])

  // Filtra mensagens
  const filteredMessages = React.useMemo(() => {
    let result = messages

    // Filtro por tab
    if (activeFilter === "unread") {
      result = result.filter((m) => !m.readAt)
    } else if (activeFilter === "sent") {
      // Assume que mensagens enviadas tem senderId diferente do recipientId
      result = result.filter((m) => m.isSent || m.senderId === "current_user")
    } else if (activeFilter === "archived") {
      result = result.filter((m) => m.isArchived)
    } else {
      // "all" - exclui arquivadas por padrao
      result = result.filter((m) => !m.isArchived)
    }

    // Filtro por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.subject?.toLowerCase().includes(query) ||
          m.content?.toLowerCase().includes(query) ||
          m.senderName?.toLowerCase().includes(query)
      )
    }

    return result
  }, [messages, activeFilter, searchQuery])

  const handleFilterChange = (value) => {
    setActiveFilter(value)
    onFilterChange?.(value)
  }

  // Renderiza conteudo da lista
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )
    }

    if (filteredMessages.length === 0) {
      return (
        emptyState || (
          <EmptyList
            title={
              searchQuery
                ? "Nenhuma mensagem encontrada"
                : activeFilter === "unread"
                ? "Nenhuma mensagem nao lida"
                : activeFilter === "sent"
                ? "Nenhuma mensagem enviada"
                : activeFilter === "archived"
                ? "Nenhuma mensagem arquivada"
                : "Sua caixa de entrada esta vazia"
            }
            description={
              searchQuery
                ? "Tente buscar por outro termo"
                : "Novas mensagens aparecerao aqui"
            }
          />
        )
      )
    }

    return (
      <div className="flex flex-col gap-3">
        {filteredMessages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            onClick={() => onMessageClick?.(message)}
            onMarkAsRead={() => onMarkAsRead?.(message.id)}
            onArchive={() => onArchive?.(message.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      {/* Filters */}
      {showFilters ? (
        <Tabs
          value={activeFilter}
          onValueChange={handleFilterChange}
          className="w-full mb-4"
        >
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon
              const count = tab.value === "unread" ? unreadCount : null
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {count ? (
                    <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                      {count}
                    </span>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      ) : null}

      {/* Search */}
      {showSearch ? (
        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar mensagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      ) : null}

      {/* Message List */}
      {renderContent()}
    </div>
  )
}

export { MessageList }
