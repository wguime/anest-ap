import { WidgetCard } from '@/design-system'

/**
 * CentroGestaoHub — grid de entrada (mobile/tablet) do Centro de Gestão.
 *
 * Renderiza os itens top-level de NAVIGATION_ITEMS como cards (2 colunas).
 * Cards guarda-chuva (Usuários, Painel) abrem no 1º subitem; a troca entre
 * irmãos acontece no SectionQuickSwitch. Badges de alerta (vermelho) somam
 * os contadores dos subitens quando o card é um grupo.
 *
 * Props:
 * - navigationItems: itens já filtrados por acesso (filteredNavItems)
 * - badges: mapa { [sectionId]: number } (nível folha) vindo do dashboard
 * - onSelect: (sectionId) => void
 */
const cap = (n) => (n > 99 ? '99+' : n)

export default function CentroGestaoHub({ navigationItems = [], badges = {}, onSelect }) {
  const badgeFor = (item) => {
    const total = item.subItems?.length
      ? item.subItems.reduce((acc, s) => acc + (badges[s.id] || 0), 0)
      : badges[item.id] || 0
    return total > 0 ? cap(total) : undefined
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 ds-stagger-in">
      {navigationItems.map((item) => {
        const Icon = item.icon
        const target = item.subItems?.length ? item.subItems[0].id : item.id
        return (
          <WidgetCard
            key={item.id}
            icon={<Icon className="w-6 h-6" />}
            title={item.label}
            variant="interactive"
            badge={badgeFor(item)}
            badgeVariant="destructive"
            onClick={() => onSelect(target)}
          />
        )
      })}
    </div>
  )
}
