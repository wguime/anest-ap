import * as React from "react"
import {
  Settings,
  Calculator,
  AlertTriangle,
  Wrench,
  Target,
  CheckSquare,
  FileCheck,
  TrendingUp,
  ClipboardCheck,
  Scale,
  ShieldAlert,
  Pill,
  BookOpen,
  Library,
  Bug,
  Headphones,
  GraduationCap,
  Network,
  Users,
  Megaphone,
  ClipboardList,
  DollarSign,
  CalendarDays,
  ShieldCheck,
  BookMarked,
  Calendar,
  Briefcase,
  Receipt,
  AlertOctagon,
  FileBarChart,
  FolderOpen,
  Trophy,
  Mail,
  FileSearch,
} from "lucide-react"
import { useTheme } from "@/design-system/hooks"
import { AppIcon } from "@/design-system/components/ui/app-icon"
import { cn } from "@/design-system/utils/tokens"

/**
 * Mapeamento de nomes de ícones para componentes Lucide
 * Expandido para suportar todos os 33 atalhos disponíveis
 */
const iconMap = {
  // Ferramentas
  Calculator,
  CheckSquare,
  Wrench,
  FileCheck,
  // Gestão
  DollarSign,
  CalendarDays,
  ShieldCheck,
  Briefcase,
  Receipt,
  // Qualidade
  AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  Scale,
  ShieldAlert,
  Pill,
  AlertOctagon,
  FileBarChart,
  // Documentos
  BookOpen,
  Library,
  Bug,
  FolderOpen,
  // Educação
  Target,
  Headphones,
  GraduationCap,
  BookMarked,
  Trophy,
  // Organização
  Network,
  Users,
  Calendar,
  // Comunicação
  Megaphone,
  ClipboardList,
  Mail,
  FileSearch,
}

/**
 * QuickLinksGrid - Grid de Atalhos Rápidos
 * 
 * Usa o componente AppIcon para garantir consistência visual
 * com a seção "App Icons Estilo iPhone"
 */
function QuickLinksGrid({
  title = "Atalhos Rápidos",
  onCustomize,
  items = [],
  className,
  ...props
}) {
  const { isDark } = useTheme()

  // Cores de texto
  const titleColor = isDark ? '#FFFFFF' : '#000000'
  const customizeColor = isDark ? '#2ECC71' : '#006837'

  // Estilo do container
  const containerStyle = isDark
    ? {
        background: '#1A2420',
        borderRadius: '20px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2A3F36',
      }
    : {
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 12px rgba(0,66,37,0.06)',
      }

  return (
    <div style={containerStyle} className={className} {...props}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 700,
          color: titleColor,
          margin: 0,
        }}>
          {title}
        </h3>
        <button
          type="button"
          onClick={onCustomize}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: customizeColor,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Settings size={14} color={customizeColor} />
          Personalizar
        </button>
      </div>

      {/* Grid de Atalhos - Usa AppIcon diretamente */}
      <div className="grid grid-cols-4 gap-1.5 md:gap-2 xl:grid-cols-6 2xl:grid-cols-8">
        {items.map((item, index) => {
          // Resolve o ícone: pode ser string (nome) ou componente React
          let IconComponent = null
          if (typeof item.icon === 'string') {
            IconComponent = iconMap[item.icon]
          }
          
          const iconElement = IconComponent 
            ? <IconComponent /> 
            : item.icon

          return (
            <AppIcon
              key={index}
              icon={iconElement}
              label={item.label || item.nome}
              onClick={item.onClick}
            />
          )
        })}
      </div>
    </div>
  )
}

export { QuickLinksGrid }
