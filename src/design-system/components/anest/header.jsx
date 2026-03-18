import * as React from "react"
import { Bell } from "lucide-react"

import { Avatar } from "@/design-system/components/ui"
import { cn } from "@/design-system/utils/tokens"

function getInitials(userName) {
  const name = String(userName ?? "").trim()
  if (!name) return ""
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const first = parts[0]?.[0] ?? ""
  const last = parts[parts.length - 1]?.[0] ?? ""
  return `${first}${last}`.toUpperCase()
}

function formatDateTime() {
  const now = new Date()
  const options = { weekday: 'long', day: 'numeric', month: 'long' }
  const dateStr = now.toLocaleDateString('pt-BR', options)
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  // Capitaliza primeira letra
  return `${dateStr.charAt(0).toUpperCase()}${dateStr.slice(1)} • ${timeStr}`
}

function NotificationBell({ count = 0, onClick }) {
  const hasCount = typeof count === "number" && count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasCount ? `Notificações (${count})` : "Notificações"}
      className={cn(
        "relative inline-flex h-[44px] w-[44px] items-center justify-center rounded-full",
        "bg-[#FFFFFF] shadow-[0_2px_8px_rgba(0,66,37,0.1)]",
        "dark:bg-card dark:border dark:border-border dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
        "transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <Bell
        className="h-5 w-5 text-primary"
        aria-hidden="true"
      />
      {hasCount ? (
        <span
          data-slot="anest-header-notification-count"
          className={cn(
            "absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1",
            "h-[18px] text-[11px] font-bold",
            "bg-destructive text-white dark:bg-destructive dark:text-white"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  )
}

function Header({
  greeting,
  userName,
  notificationCount = 0,
  onNotificationClick,
  onAvatarClick,
  avatarSrc,
  showDateTime = false,
  className,
  ...props
}) {
  const initials = getInitials(userName)
  const [dateTime, setDateTime] = React.useState(formatDateTime())

  // Atualizar data/hora a cada minuto
  React.useEffect(() => {
    if (!showDateTime) return
    const interval = setInterval(() => {
      setDateTime(formatDateTime())
    }, 60000)
    return () => clearInterval(interval)
  }, [showDateTime])

  return (
    <div
      data-slot="anest-header"
      className={cn(
        "flex items-center justify-between gap-4",
        "mb-4",
        className
      )}
      {...props}
    >
      {/* Avatar à esquerda + saudação + data/hora */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onAvatarClick}
          aria-label="Perfil"
          className="shrink-0 inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Avatar
            size="lg"
            initials={initials}
            src={avatarSrc}
            className="dark:text-foreground"
          />
        </button>
        <div className="min-w-0">
          <div
            data-slot="anest-header-greeting"
            className="text-[18px] md:text-[20px] font-bold text-foreground truncate"
          >
            {greeting}
          </div>
          {showDateTime && (
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {dateTime}
            </div>
          )}
        </div>
      </div>

      {/* Notificações à direita */}
      <div data-slot="anest-header-actions" className="flex items-center gap-3 shrink-0">
        <NotificationBell
          count={notificationCount}
          onClick={onNotificationClick}
        />
      </div>
    </div>
  )
}

export { Header }


