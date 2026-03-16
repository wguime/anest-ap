import * as React from "react"
import { Bell, FileText, Inbox, Search } from "lucide-react"
import { motion } from "framer-motion"
import { durations, prefersReducedMotion } from "@/design-system/utils/motion"

import { cn } from "@/design-system/utils/tokens"
import { Button } from "./button"

const SIZE_CLASSES = {
  sm: {
    padding: "p-8",
    icon: "h-12 w-12",
    title: "text-[16px]",
  },
  md: {
    padding: "p-12",
    icon: "h-16 w-16",
    title: "text-[18px]",
  },
  lg: {
    padding: "p-16",
    icon: "h-20 w-20",
    title: "text-[20px]",
  },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
}) {
  const s = SIZE_CLASSES[size] ?? SIZE_CLASSES.md
  const reduced = prefersReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduced ? { duration: 0 } : { duration: durations.slow, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "flex flex-col items-center text-center",
        s.padding,
        className
      )}
    >
      {icon ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: durations.slow, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className={cn("mb-6 text-muted-foreground", s.icon)}
        >
          {icon}
        </motion.div>
      ) : null}

      <div className={cn("font-semibold text-foreground", s.title)}>
        {title}
      </div>

      {description ? (
        <div className="mt-2 max-w-[400px] text-[14px] leading-5 text-muted-foreground">
          {description}
        </div>
      ) : null}

      {action ? (
        <div className="mt-6">
          <Button
            variant={action.variant ?? "default"}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      ) : null}

      {secondaryAction ? (
        <div className={cn(action ? "mt-3" : "mt-6")}>
          <Button variant="ghost" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        </div>
      ) : null}
    </motion.div>
  )
}

export function EmptySearch(props) {
  return (
    <EmptyState
      icon={<Search className="h-full w-full" aria-hidden="true" />}
      title="Nenhum resultado encontrado"
      {...props}
    />
  )
}

export function EmptyList(props) {
  return (
    <EmptyState
      icon={<Inbox className="h-full w-full" aria-hidden="true" />}
      title="Nenhum item na lista"
      {...props}
    />
  )
}

export function EmptyNotifications(props) {
  return (
    <EmptyState
      icon={<Bell className="h-full w-full" aria-hidden="true" />}
      title="Nenhuma notificação"
      {...props}
    />
  )
}

export function EmptyDocuments(props) {
  return (
    <EmptyState
      icon={<FileText className="h-full w-full" aria-hidden="true" />}
      title="Nenhum documento"
      {...props}
    />
  )
}


