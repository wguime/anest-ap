# ANEST — Continuação Fase 4 (Documentação COMPLETA)

> **Data:** 27 de Dezembro de 2025  
> **Problema atual:** Dark Mode dos componentes QuickLinksGrid e PlantaoListItem foi alterado indevidamente  
> **Status:** Correção pendente

---

## 1. CONTEXTO DO PROJETO

- **Localização**: `/Users/guilherme/Documents/IA/Qmentum/versão-2.0/web/`
- **Stack**: React + Vite + Tailwind CSS + Framer Motion + Shadcn UI
- **Objetivo**: Design System para app ANEST (gestão de qualidade em anestesiologia)

### Arquivos de Referência (FONTE DA VERDADE)
```
/mnt/project/design.json - Tokens oficiais
/mnt/project/AnestHomeFinalPreview.jsx - Referência LIGHT MODE
/mnt/project/AnestHomeDark.jsx - Referência DARK MODE
```

---

## 2. ESTRUTURA ATUAL DO DESIGN SYSTEM

**Todos os arquivos em** `src/design-system/`:

```
src/design-system/
├── DarkMode.jsx
├── LightMode.jsx
├── README.md
├── Tokens.json
├── index.js
├── components/
│   ├── index.js
│   ├── anest/
│   │   ├── index.js
│   │   ├── bottom-nav.jsx
│   │   ├── comunicado-item.jsx
│   │   ├── comunicados-card.jsx
│   │   ├── ferias-list-item.jsx
│   │   ├── header.jsx
│   │   ├── list-item.jsx
│   │   ├── plantao-list-item.jsx      ⚠️ DARK MODE QUEBRADO
│   │   ├── quick-links-grid.jsx       ⚠️ DARK MODE QUEBRADO
│   │   ├── search-bar.jsx
│   │   └── section-card.jsx
│   ├── composed/
│   │   └── index.js
│   └── ui/
│       ├── index.js
│       ├── app-icon.jsx
│       ├── avatar.jsx
│       ├── badge.jsx
│       ├── button.jsx
│       ├── card.jsx
│       ├── input.jsx
│       ├── list-item.jsx
│       ├── quick-links-card.jsx
│       ├── skeleton.jsx
│       ├── widget-card.jsx
│       └── widget-grid.jsx
├── hooks/
│   ├── index.js
│   └── useTheme.js
└── utils/
    ├── index.js
    └── tokens.js
```

---

## 3. PALETA DE CORES OFICIAL

### LIGHT MODE
```
Background página: #F0FFF4
Card branco: #FFFFFF
Card destaque (comunicados): #D4EDDA
Border: #C8E6C9

Verde escuro: #004225
Verde médio: #006837
Verde claro/lime: #9BC53D

Texto título: #000000
Texto secundário: #6B7280
Texto muted: #9CA3AF

Vermelho notificação: #DC2626
```

### DARK MODE
```
Background página: #111916
Card: #1A2420
Card light: #243530
Border: #2A3F36

Verde primário: #2ECC71
Verde light: #58D68D
Verde muted: #1E8449
Verde glow: rgba(46, 204, 113, 0.15)

Texto título: #FFFFFF
Texto secundário: #A3B8B0
Texto muted: #6B8178

Vermelho: #E74C3C
```

---

## 4. 🔴 PROBLEMA ATUAL E ESPECIFICAÇÃO EXATA

O Cursor alterou o Dark Mode quando pedimos para corrigir apenas o Light Mode.
**Precisamos restaurar o Dark Mode para o estado correto baseado em AnestHomeDark.jsx.**

### 4.1 QUICK LINKS GRID - Especificação EXATA

**LIGHT MODE (círculos NÃO highlighted):**
- background: `#004225` (verde escuro sólido)
- border: NENHUMA
- shadow: `0 4px 12px rgba(0,66,37,0.25)`
- Ícone: stroke WHITE (branco)

**LIGHT MODE (círculo highlighted - Calculadoras):**
- background: `linear-gradient(135deg, #006837 0%, #004225 100%)`
- border: `2px solid #9BC53D`
- shadow: `0 6px 16px rgba(0,66,37,0.4)`
- Ícone: stroke WHITE (branco)

**DARK MODE (círculos NÃO highlighted):**
- background: `#243530`
- border: `1px solid #2A3F36`
- shadow: `0 4px 12px rgba(0,0,0,0.3)`
- Ícone: stroke `#2ECC71` (verde)

**DARK MODE (círculo highlighted - Calculadoras):**
- background: `linear-gradient(135deg, #2ECC71 0%, #1E8449 100%)`
- border: NENHUMA
- shadow: `0 6px 20px rgba(46,204,113,0.4)`
- Ícone: stroke `#0A0F0D` (escuro)

**Labels (ambos modos):**
- Light: `#6B7280`
- Dark: `#6B8178`

**ÍCONES CUSTOMIZADOS (SVG, não Lucide):**

```jsx
// Calculadora (index 0)
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <rect x="4" y="2" width="16" height="20" rx="2"/>
  <rect x="6" y="4" width="12" height="5" rx="1"/>
  <circle cx="8" cy="12" r="1" fill="currentColor"/>
  <circle cx="12" cy="12" r="1" fill="currentColor"/>
  <circle cx="16" cy="12" r="1" fill="currentColor"/>
  <circle cx="8" cy="16" r="1" fill="currentColor"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
  <circle cx="16" cy="16" r="1" fill="currentColor"/>
</svg>

// Reportar (index 1)
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M12 9v4"/>
  <path d="M12 17h.01"/>
  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
</svg>

// Manutenção (index 2)
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
</svg>

// Desafio ROPs (index 3)
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <circle cx="12" cy="12" r="10"/>
  <circle cx="12" cy="12" r="6"/>
  <circle cx="12" cy="12" r="2"/>
</svg>
```

### 4.2 PLANTÃO LIST ITEM - Especificação EXATA

**LIGHT MODE:**
- Ícone container bg: cores variadas (`#B8E0C8`, `#A8D5BA`, `#C5E8D5`, `#D4EDDA`)
- Ícone container border: NENHUMA
- Ícone calendário: stroke `#004225`
- Nome: `#000000`
- Data: `#9CA3AF`
- Hora: `#9BC53D`

**DARK MODE:**
- Ícone container bg: `#243530`
- Ícone container border: `1px solid #2A3F36`
- Ícone calendário: stroke `#2ECC71`
- Nome: `#FFFFFF`
- Data: `#6B8178`
- Hora: `#2ECC71` com glow

**ÍCONE CALENDÁRIO CUSTOMIZADO (SVG, não Lucide):**

```jsx
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="3" y="4" width="18" height="18" rx="2"/>
  <path d="M16 2v4"/>
  <path d="M8 2v4"/>
  <path d="M3 10h18"/>
</svg>
```

---

## 5. CÓDIGO CORRETO PARA RESTAURAÇÃO

### 5.1 quick-links-grid.jsx - CÓDIGO CORRETO

```jsx
import * as React from "react"
import { motion } from "framer-motion"
import { Settings } from "lucide-react"
import { useTheme } from "@/design-system/hooks"
import { cn } from "@/design-system/utils/tokens"

// SVGs customizados
const CustomIcon = ({ index, className }) => {
  if (index === 0) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <rect x="6" y="4" width="12" height="5" rx="1"/>
        <circle cx="8" cy="12" r="1" fill="currentColor"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
        <circle cx="16" cy="12" r="1" fill="currentColor"/>
        <circle cx="8" cy="16" r="1" fill="currentColor"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
        <circle cx="16" cy="16" r="1" fill="currentColor"/>
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M12 9v4"/><path d="M12 17h.01"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    );
  }
  if (index === 3) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    );
  }
  return null;
};

function QuickLinksGrid({ title = "Atalhos Rápidos", onCustomize, items = [], className, ...props }) {
  const { isDark } = useTheme()

  return (
    <div
      data-slot="anest-quick-links-grid"
      className={cn(
        "bg-white rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,66,37,0.06)]",
        "dark:bg-[#1A2420] dark:border dark:border-[#2A3F36] dark:shadow-none",
        className
      )}
      {...props}
    >
      <header className="flex items-start justify-between gap-4">
        <h3 className="text-black text-base font-bold dark:text-white">{title}</h3>
        <button
          type="button"
          onClick={onCustomize}
          className="inline-flex items-center gap-1.5 text-[#006837] text-[13px] font-semibold hover:opacity-90 dark:text-[#2ECC71]"
        >
          <Settings size={16} className="text-[#006837] dark:text-[#2ECC71]" />
          <span>Personalizar</span>
        </button>
      </header>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {items.map((item, idx) => {
          const isHighlighted = Boolean(item.highlighted)

          // Cor do ícone baseada no tema e highlight
          const iconColorClass = isHighlighted
            ? isDark ? "text-[#0A0F0D]" : "text-white"
            : isDark ? "text-[#2ECC71]" : "text-white"

          return (
            <motion.button
              key={`quick-link-${idx}`}
              type="button"
              onClick={item.onClick}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-2 select-none"
            >
              <span
                className={cn(
                  "inline-flex w-[54px] h-[54px] items-center justify-center rounded-full",
                  // NÃO highlighted
                  !isHighlighted && [
                    // Light: verde escuro sólido, sem borda
                    "bg-[#004225] shadow-[0_4px_12px_rgba(0,66,37,0.25)]",
                    // Dark: cinza escuro com borda
                    "dark:bg-[#243530] dark:border dark:border-[#2A3F36] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                  ],
                  // Highlighted
                  isHighlighted && [
                    // Light: borda amarela
                    "border-2 border-[#9BC53D] shadow-[0_6px_16px_rgba(0,66,37,0.4)]",
                    // Dark: sem borda
                    "dark:border-0 dark:shadow-[0_6px_20px_rgba(46,204,113,0.4)]"
                  ]
                )}
                style={
                  isHighlighted
                    ? {
                        background: isDark
                          ? "linear-gradient(135deg, #2ECC71 0%, #1E8449 100%)"
                          : "linear-gradient(135deg, #006837 0%, #004225 100%)"
                      }
                    : undefined
                }
              >
                <CustomIcon index={idx} className={iconColorClass} />
              </span>

              <span className="text-[#6B7280] text-[10px] font-medium dark:text-[#6B8178]">
                {item.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export { QuickLinksGrid }
```

### 5.2 plantao-list-item.jsx - CÓDIGO CORRETO

```jsx
import * as React from "react"
import { useTheme } from "@/design-system/hooks"
import { ListItem } from "./list-item"

const LIGHT_ICON_BGS = ["#B8E0C8", "#A8D5BA", "#C5E8D5", "#D4EDDA"]

function hashString(input) {
  const str = String(input ?? "")
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// Ícone calendário customizado
const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4"/>
    <path d="M8 2v4"/>
    <path d="M3 10h18"/>
  </svg>
)

function PlantaoListItem({ hospital, data, hora, showDivider = true, onClick }) {
  const { isDark } = useTheme()

  const lightBg = React.useMemo(() => {
    const idx = hashString(`${hospital}|${data}|${hora}`) % LIGHT_ICON_BGS.length
    return LIGHT_ICON_BGS[idx] ?? "#D4EDDA"
  }, [hospital, data, hora])

  return (
    <ListItem
      icon={<CalendarIcon />}
      iconBg={isDark ? "#243530" : lightBg}
      iconColor={isDark ? "#2ECC71" : "#004225"}
      iconContainerClassName={isDark ? "border border-[#2A3F36]" : undefined}
      title={hospital}
      subtitle={data}
      value={hora}
      showDivider={showDivider}
      onClick={onClick}
    />
  )
}

export { PlantaoListItem }
```

---

## 6. CÓDIGO ATUAL DOS DEMAIS COMPONENTES (FUNCIONANDO)

### 6.1 list-item.jsx (base) - STATUS: ✅ OK

```jsx
import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function ListItem({
  icon,
  iconBg,
  iconColor,
  iconContainerClassName,
  iconClassName,
  title,
  subtitle,
  value,
  valueColor,
  showDivider = true,
  dividerClassName,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"

  return (
    <div
      data-slot="anest-list-item"
      className={cn(
        "flex items-center gap-[14px] py-[14px]",
        showDivider
          ? cn(
              "border-b border-[#F3F4F6] dark:border-[#2A3F36]",
              dividerClassName
            )
          : null,
        isClickable
          ? "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className
      )}
      onClick={onClick}
      role={props.role ?? (isClickable ? "button" : undefined)}
      tabIndex={props.tabIndex ?? (isClickable ? 0 : undefined)}
      onKeyDown={(e) => {
        props.onKeyDown?.(e)
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter") onClick(e)
        if (e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      {...props}
    >
      <div
        data-slot="anest-list-item-icon-container"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]",
          iconBg ? null : "bg-[#F3F4F6] dark:bg-[#243530]",
          iconContainerClassName
        )}
        style={iconBg ? { backgroundColor: iconBg } : undefined}
      >
        <span
          data-slot="anest-list-item-icon"
          aria-hidden="true"
          className={cn(
            "inline-flex [&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.5]",
            iconColor ? null : "text-[#006837] dark:text-[#2ECC71]",
            iconClassName
          )}
          style={iconColor ? { color: iconColor } : undefined}
        >
          {icon}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div
          data-slot="anest-list-item-title"
          className="truncate text-[15px] font-semibold text-[#000000] dark:text-[#FFFFFF]"
        >
          {title}
        </div>
        {subtitle ? (
          <div
            data-slot="anest-list-item-subtitle"
            className="truncate text-[13px] text-[#9CA3AF] dark:text-[#6B8178]"
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {value ? (
        <div
          data-slot="anest-list-item-value"
          className={cn(
            "shrink-0 text-[15px] font-bold",
            valueColor
              ? null
              : "text-[#9BC53D] dark:text-[#2ECC71] dark:drop-shadow-[0_0_6px_rgba(46,204,113,0.35)]"
          )}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </div>
      ) : null}
    </div>
  )
}

export { ListItem }
```

### 6.2 ferias-list-item.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"
import { User } from "lucide-react"

import { useTheme } from "@/design-system/hooks"
import { ListItem } from "./list-item"

function FeriasListItem({ nome, periodo, showDivider = true, onClick }) {
  const { isDark } = useTheme()

  return (
    <ListItem
      icon={<User />}
      iconBg={isDark ? "#243530" : "#F3F4F6"}
      iconColor={isDark ? "#4A5B54" : "#6B7280"}
      iconContainerClassName={isDark ? "border border-[#2A3F36]" : undefined}
      title={nome}
      subtitle={periodo}
      showDivider={showDivider}
      onClick={onClick}
    />
  )
}

export { FeriasListItem }
```

### 6.3 header.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"

import { Bell } from "lucide-react"

import { useTheme } from "@/design-system/hooks"
import { cn } from "@/design-system/utils/tokens"
import { Avatar } from "@/design-system/components/ui/avatar"
import { Badge } from "@/design-system/components/ui/badge"

function AnestHeader({
  greeting = "Olá",
  userName,
  notificationCount = 0,
  avatarUrl,
  onNotificationClick,
  onAvatarClick,
  className,
  ...props
}) {
  const { isDark } = useTheme()

  const initials = React.useMemo(() => {
    if (!userName) return "?"
    const parts = userName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }, [userName])

  return (
    <header
      data-slot="anest-header"
      className={cn(
        "flex items-center justify-between gap-4 mb-6",
        className
      )}
      {...props}
    >
      <p
        data-slot="anest-header-greeting"
        className="text-[20px] font-bold text-[#004225] dark:text-white"
      >
        {greeting}
      </p>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button
          type="button"
          onClick={onNotificationClick}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full",
            "bg-white dark:bg-[#1A2420]",
            "border border-transparent dark:border-[#2A3F36]",
            "shadow-[0_2px_8px_rgba(0,66,37,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
            "transition-transform active:scale-95"
          )}
          aria-label={`Notificações${notificationCount > 0 ? ` (${notificationCount} novas)` : ""}`}
        >
          <Bell
            size={22}
            className="text-[#004225] dark:text-[#2ECC71]"
            strokeWidth={2}
          />
          {notificationCount > 0 && (
            <Badge
              variant="notification"
              className="absolute -right-1 -top-1"
            >
              {notificationCount > 99 ? "99+" : notificationCount}
            </Badge>
          )}
        </button>

        {/* Avatar */}
        <button
          type="button"
          onClick={onAvatarClick}
          className="transition-transform active:scale-95"
          aria-label="Perfil do usuário"
        >
          <Avatar
            src={avatarUrl}
            fallback={initials}
            size="lg"
            className={cn(
              "ring-0",
              isDark
                ? "shadow-[0_4px_20px_rgba(46,204,113,0.4)]"
                : "shadow-[0_4px_16px_rgba(0,66,37,0.3)]"
            )}
            style={{
              background: isDark
                ? "linear-gradient(135deg, #2ECC71 0%, #1E8449 100%)"
                : "linear-gradient(135deg, #004225 0%, #006837 100%)"
            }}
          />
        </button>
      </div>
    </header>
  )
}

export { AnestHeader }
```

### 6.4 search-bar.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"

import { Search } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Buscar...",
  className,
  ...props
}) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.(value)
  }

  return (
    <form
      data-slot="anest-search-bar"
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center gap-[14px] rounded-[16px] px-[18px] py-4",
        "bg-white dark:bg-[#1A2420]",
        "border border-[#C8E6C9] dark:border-[#2A3F36]",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        "mb-6",
        className
      )}
      {...props}
    >
      <Search
        size={22}
        className="shrink-0 text-[#006837] dark:text-[#2ECC71]"
        strokeWidth={2.5}
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "flex-1 bg-transparent text-base outline-none",
          "text-black dark:text-white",
          "placeholder:text-[#6B7280] dark:placeholder:text-[#6B8178]"
        )}
      />
    </form>
  )
}

export { SearchBar }
```

### 6.5 section-card.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"

import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

function SectionCard({
  title,
  titleClassName,
  children,
  className,
  animate = true,
  ...props
}) {
  const Wrapper = animate ? motion.div : "div"
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: "easeOut" },
      }
    : {}

  return (
    <Wrapper
      data-slot="anest-section-card"
      className={cn(
        "rounded-[20px] p-5",
        "bg-white dark:bg-[#1A2420]",
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none",
        "dark:border dark:border-[#2A3F36]",
        className
      )}
      {...motionProps}
      {...props}
    >
      {title && (
        <h3
          data-slot="anest-section-card-title"
          className={cn(
            "mb-4 text-lg font-bold text-black dark:text-white",
            titleClassName
          )}
        >
          {title}
        </h3>
      )}
      {children}
    </Wrapper>
  )
}

export { SectionCard }
```

### 6.6 comunicados-card.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"

import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

function ComunicadosCard({
  label = "ÚLTIMOS",
  title = "Comunicados",
  badgeText,
  items = [],
  onViewAll,
  className,
  ...props
}) {
  return (
    <motion.div
      data-slot="anest-comunicados-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileTap={{ scale: 0.99 }}
      onClick={onViewAll}
      className={cn(
        "cursor-pointer rounded-[20px] p-5",
        "bg-[#D4EDDA] dark:bg-[#1A2420]",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        "dark:border dark:border-[#2A3F36]",
        "transition-transform",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#006837] dark:text-[#2ECC71]">
            {label}
          </p>
          <h2 className="text-xl font-bold text-[#002215] dark:text-white">
            {title}
          </h2>
        </div>
        {badgeText && (
          <span
            className={cn(
              "rounded-[10px] px-2.5 py-1 text-[11px] font-bold",
              "bg-[#004225] text-white",
              "dark:bg-gradient-to-br dark:from-[#2ECC71] dark:to-[#1E8449] dark:text-[#0A0F0D]",
              "dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]"
            )}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="mb-3.5 flex flex-col gap-2.5">
        {items.map((text, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            <span
              className={cn(
                "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                "bg-[#006837] dark:bg-[#2ECC71] dark:shadow-[0_0_6px_#2ECC71]"
              )}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-[#002215] dark:text-[#A3B8B0]">
              {text}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#006837] dark:text-[#2ECC71]">
          Ver todos
          <ChevronRight size={16} strokeWidth={2.5} />
        </span>
      </div>
    </motion.div>
  )
}

export { ComunicadosCard }
```

### 6.7 bottom-nav.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"

import { motion } from "framer-motion"
import { Home, Shield, FileText, Menu } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const ICONS = {
  Home,
  Shield,
  FileText,
  Menu,
}

function BottomNav({ items = [], onItemClick, className, ...props }) {
  return (
    <nav
      data-slot="anest-bottom-nav"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 w-full",
        "pt-3 px-10 pb-7",
        "bg-white dark:bg-[#1A2420]",
        "border-t border-[#C8E6C9] dark:border-[#2A3F36]",
        "shadow-[0_-4px_12px_rgba(0,66,37,0.08)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-around">
        {items.map((item, index) => {
          const isActive = Boolean(item.active)
          const iconName = typeof item.icon === "string" ? item.icon : null
          const activeIconName =
            typeof item.activeIcon === "string" ? item.activeIcon : iconName

          const Icon =
            (activeIconName && ICONS[activeIconName]) ||
            (iconName && ICONS[iconName]) ||
            null

          const key = `${item.href ?? "item"}-${iconName ?? "custom"}-${index}`
          const label = iconName ?? "Navigation"

          const commonClassName = cn(
            "relative flex items-center justify-center p-3 rounded-2xl",
            "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "transition-all duration-200 ease-in-out",
            isActive
              ? "text-[#006837] dark:text-[#2ECC71]"
              : "text-[#6B7280] dark:text-[#6B8178]"
          )

          const content = (
            <span aria-hidden="true" className="inline-flex">
              {Icon ? (
                <Icon
                  width={28}
                  height={28}
                  stroke="currentColor"
                  fill={isActive ? "currentColor" : "none"}
                />
              ) : (
                item.icon
              )}
            </span>
          )

          if (item.href) {
            return (
              <motion.a
                key={key}
                href={item.href}
                onClick={(e) => {
                  if (typeof onItemClick === "function") {
                    e.preventDefault()
                    onItemClick(item)
                  }
                }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={commonClassName}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                {content}
              </motion.a>
            )
          }

          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => {
                if (typeof onItemClick === "function") onItemClick(item)
              }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={commonClassName}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}

export { BottomNav }
```

### 6.8 comunicado-item.jsx - STATUS: ✅ OK

```jsx
import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function ComunicadoItem({ text, isNew = false, className, ...props }) {
  return (
    <div
      data-slot="anest-comunicado-item"
      className={cn("flex items-start gap-[10px]", className)}
      {...props}
    >
      <span
        data-slot="anest-comunicado-bullet"
        aria-hidden="true"
        className={cn(
          "mt-[7px] inline-block h-[6px] w-[6px] shrink-0 rounded-full",
          isNew
            ? "bg-[#006837] dark:bg-[#2ECC71] dark:shadow-[0_0_6px_#2ECC71]"
            : "bg-[#C8E6C9] dark:bg-[#344840]"
        )}
      />
      <p
        data-slot="anest-comunicado-text"
        className="text-[14px] font-medium text-[#002215] dark:text-[#A3B8B0]"
      >
        {text}
      </p>
    </div>
  )
}

export { ComunicadoItem }
```

### 6.9 index.js (exports) - STATUS: ✅ OK

```js
export { AnestHeader } from "./header"
export { BottomNav } from "./bottom-nav"
export { ComunicadoItem } from "./comunicado-item"
export { ComunicadosCard } from "./comunicados-card"
export { FeriasListItem } from "./ferias-list-item"
export { ListItem } from "./list-item"
export { PlantaoListItem } from "./plantao-list-item"
export { QuickLinksGrid } from "./quick-links-grid"
export { SearchBar } from "./search-bar"
export { SectionCard } from "./section-card"
```

---

## 7. HOOKS E UTILS

### 7.1 useTheme.js

O hook useTheme fornece:
- `isDark`: boolean indicando se está no dark mode
- `theme`: "light" | "dark"
- `toggleTheme`: função para alternar
- `setTheme`: função para definir tema específico
- `colors`, `shadows`, `typography`, etc.: tokens do tema atual

### 7.2 tokens.js

```js
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

---

## 8. FASES DO PROJETO

| Fase | Status |
|------|--------|
| Fase 1: Fundação (hooks, utils) | ✅ COMPLETA |
| Fase 2: Button + Card | ✅ COMPLETA |
| Fase 3: Badge, Avatar, Input, Skeleton, Widgets | ✅ COMPLETA |
| Fase 4: Componentes ANEST | ⚠️ EM CORREÇÃO |
| Fase 5: Documentação | ⏳ Pendente |
| Fase 6: Integração | ⏳ Pendente |

---

## 9. PROMPT PARA RESTAURAR

Cole este prompt EXATAMENTE no Cursor para corrigir os componentes:

```
RESTAURAR COMPONENTES - NÃO INTERPRETAR, APENAS SUBSTITUIR O CÓDIGO.

Substitua o conteúdo COMPLETO de:

1. web/src/design-system/components/anest/quick-links-grid.jsx
   Por o código da seção "5.1 quick-links-grid.jsx - CÓDIGO CORRETO" deste documento.

2. web/src/design-system/components/anest/plantao-list-item.jsx
   Por o código da seção "5.2 plantao-list-item.jsx - CÓDIGO CORRETO" deste documento.

NÃO ADICIONE NADA. NÃO REMOVA NADA. NÃO INTERPRETE. APENAS SUBSTITUA.
```

---

## 10. PRÓXIMOS PASSOS

1. **RESTAURAR** os arquivos quick-links-grid.jsx e plantao-list-item.jsx com o código correto
2. **TESTAR** em Light e Dark mode para confirmar que está igual ao app em produção
3. **Validar** todos os componentes contra as referências (AnestHomeFinalPreview.jsx e AnestHomeDark.jsx)
4. **Continuar** para Fase 5 (Documentação) ou Fase 6 (Integração)

---

*Documento criado em 27/12/2025 para continuação do projeto ANEST Design System*
