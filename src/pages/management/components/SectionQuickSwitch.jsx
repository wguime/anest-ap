import { useState } from 'react'
import { ChevronDown, LayoutGrid, Check } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/design-system'
import { cn } from '@/design-system/utils/tokens'

/**
 * SectionQuickSwitch — barra de topo (mobile/tablet) dentro de uma seção do
 * Centro de Gestão. "Hub" volta ao grid de cards; o nome da seção atual abre
 * uma bottom-sheet (Drawer) com todas as seções agrupadas para troca rápida
 * sem voltar ao hub.
 *
 * Props:
 * - navigationItems: itens já filtrados por acesso (filteredNavItems)
 * - activeSection: id da seção atual
 * - onSectionChange: (id) => void
 * - onEnterHub: () => void
 * - actionsRight: node opcional (ex.: toggle de busca por seção)
 * - badges: mapa { [sectionId]: number } (nível folha)
 */
const cap = (n) => (n > 99 ? '99+' : n)

function resolveActiveLabel(navigationItems, activeSection) {
  for (const item of navigationItems) {
    if (item.subItems?.length) {
      const sub = item.subItems.find((s) => s.id === activeSection)
      if (sub) return sub.label
    } else if (item.id === activeSection) {
      return item.label
    }
  }
  return 'Seção'
}

// Agrupa para a bottom-sheet: grupos guarda-chuva viram headings; as folhas
// soltas (Documentos, Comunicados, ...) caem num grupo "Áreas".
function buildGroups(navigationItems) {
  const groups = []
  let leaves = []
  const flush = () => {
    if (leaves.length) {
      groups.push({ heading: 'Áreas', items: leaves })
      leaves = []
    }
  }
  for (const item of navigationItems) {
    if (item.subItems?.length) {
      flush()
      groups.push({
        heading: item.label,
        items: item.subItems.map((s) => ({ id: s.id, label: s.label, icon: item.icon })),
      })
    } else {
      leaves.push({ id: item.id, label: item.label, icon: item.icon })
    }
  }
  flush()
  return groups
}

export default function SectionQuickSwitch({
  navigationItems = [],
  activeSection,
  onSectionChange,
  onEnterHub,
  actionsRight = null,
  badges = {},
}) {
  const [open, setOpen] = useState(false)
  const groups = buildGroups(navigationItems)
  const activeLabel = resolveActiveLabel(navigationItems, activeSection)

  const handlePick = (id) => {
    setOpen(false)
    onSectionChange(id)
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
        <button
          type="button"
          onClick={onEnterHub}
          className="inline-flex items-center gap-1 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar ao hub do Centro de Gestão"
        >
          <LayoutGrid className="w-4 h-4" aria-hidden="true" />
          Hub
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] text-sm font-semibold text-foreground"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        </button>

        <div className="min-w-[36px] flex justify-end">{actionsRight}</div>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Trocar de seção</DrawerTitle>
          </DrawerHeader>
          <nav className="overflow-y-auto px-3 pb-4">
            {groups.map((group) => (
              <div key={group.heading} className="mb-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((s) => {
                    const Icon = s.icon
                    const count = badges[s.id] || 0
                    const isActive = s.id === activeSection
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handlePick(s.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 rounded-xl min-h-[48px] text-left transition-colors',
                          isActive
                            ? 'bg-muted text-primary font-semibold'
                            : 'text-foreground hover:bg-muted/60'
                        )}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <Icon
                          className={cn(
                            'w-5 h-5 shrink-0',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-sm truncate">{s.label}</span>
                        {count > 0 && (
                          <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-destructive text-white">
                            {cap(count)}
                          </span>
                        )}
                        {isActive && <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </DrawerContent>
      </Drawer>
    </>
  )
}
