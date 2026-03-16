import * as React from "react"
import { Inbox, Plus } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Badge, Button } from "@/design-system/components/ui"
import { SectionCard } from "@/design-system/components/anest"
import { MessageList } from "./message-list"

/**
 * InboxSection - Secao wrapper para caixa de entrada
 *
 * Container para a lista de mensagens com:
 * - Header com titulo e badge de nao lidas
 * - Botao para nova mensagem
 * - MessageList integrada
 *
 * @example
 * <InboxSection
 *   onComposeClick={() => setComposeOpen(true)}
 *   onMessageClick={(msg) => navigate(`/message/${msg.id}`)}
 * />
 */

function InboxSection({
  messages = [],
  unreadCount = 0,
  maxItems,
  showHeader = true,
  showFilters = true,
  showSearch = true,
  onComposeClick,
  onMessageClick,
  onMarkAsRead,
  onArchive,
  onFilterChange,
  loading = false,
  className,
  ...props
}) {
  // Limita itens se maxItems for definido
  const displayMessages = maxItems ? messages.slice(0, maxItems) : messages

  return (
    <SectionCard
      title="Caixa de Entrada"
      subtitle="MENSAGENS"
      badge={
        unreadCount > 0
          ? { text: `${unreadCount} ${unreadCount === 1 ? "nova" : "novas"}`, variant: "default" }
          : null
      }
      action={
        onComposeClick
          ? {
              icon: <Plus className="h-4 w-4" />,
              label: "Nova",
              onClick: onComposeClick,
            }
          : null
      }
      className={className}
      {...props}
    >
      <MessageList
        messages={displayMessages}
        unreadCount={unreadCount}
        showFilters={showFilters}
        showSearch={showSearch}
        onMessageClick={onMessageClick}
        onMarkAsRead={onMarkAsRead}
        onArchive={onArchive}
        onFilterChange={onFilterChange}
        loading={loading}
      />
    </SectionCard>
  )
}

/**
 * InboxWidget - Versao compacta para widgets/dashboard
 *
 * @example
 * <InboxWidget
 *   messages={recentMessages}
 *   unreadCount={5}
 *   onViewAll={() => navigate('/inbox')}
 * />
 */
function InboxWidget({
  messages = [],
  unreadCount = 0,
  maxItems = 3,
  onMessageClick,
  onViewAll,
  className,
  ...props
}) {
  const displayMessages = messages.slice(0, maxItems)

  return (
    <SectionCard
      title="Mensagens"
      subtitle="COMUNICACAO"
      badge={
        unreadCount > 0
          ? { text: `${unreadCount}`, variant: "default" }
          : null
      }
      action={
        onViewAll
          ? {
              icon: <Inbox className="h-4 w-4" />,
              label: "Ver todas",
              onClick: onViewAll,
            }
          : null
      }
      className={className}
      {...props}
    >
      <MessageList
        messages={displayMessages}
        showFilters={false}
        showSearch={false}
        onMessageClick={onMessageClick}
      />
    </SectionCard>
  )
}

export { InboxSection, InboxWidget }
