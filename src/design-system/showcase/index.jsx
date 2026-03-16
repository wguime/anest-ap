// ShowcaseIndex.jsx
// Página principal do Showcase - Une todos os showcases com navegação

import { useState } from 'react';
import {
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  Palette,
  LayoutGrid,
  Compass,
  ClipboardList,
  MessageSquare,
  Smartphone,
  BarChart3,
  Wrench,
  Gamepad2,
  Stethoscope,
  Layers,
  Calculator,
  Calendar,
  FolderOpen,
  Settings,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';
import { Button } from '../components';
import { ColorPalette } from './ColorPalette';
import { ComponentShowcase } from './ComponentShowcase';
import { AnestShowcase } from './AnestShowcase';
import { FormShowcase } from './FormShowcase';
import { FeedbackShowcase } from './FeedbackShowcase';
import { NavigationShowcase } from './NavigationShowcase';
import { ResponsiveShowcase } from './ResponsiveShowcase';
import { DataDisplayShowcase } from './DataDisplayShowcase';
import { UtilitiesShowcase } from './UtilitiesShowcase';
import GamificationShowcase from './GamificationShowcase';
import { NewComponentsShowcase } from './NewComponentsShowcase';
import { PagesShowcase } from './PagesShowcase';
import { CalculatorShowcase } from './CalculatorShowcase';
import { PlantoesShowcase } from './PlantoesShowcase';
import { GestaoDocumentalShowcase } from './GestaoDocumentalShowcase';
import { EducacaoContinuadaShowcase } from './EducacaoContinuadaShowcase';
import { CentroGestaoShowcase } from './CentroGestaoShowcase';

// ============================================================================
// DESIGN SYSTEM TOKENS
// ============================================================================

const TOKENS = {
  light: {
    background: {
      primary: '#F0FFF4',
      cardHighlight: '#D4EDDA',
    },
    green: {
      dark: '#004225',
      medium: '#006837',
    },
    text: {
      primary: '#000000',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    },
    border: {
      default: '#C8E6C9',
    },
  },
  dark: {
    background: {
      darkest: '#0A0F0D',
      card: '#1A2420',
      cardLight: '#243530',
    },
    green: {
      primary: '#2ECC71',
      muted: '#1E8449',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3B8B0',
      muted: '#6B8178',
    },
    border: {
      default: '#2A3F36',
    },
  },
};

// ============================================================================
// CONFIGURAÇÃO DAS SEÇÕES
// ============================================================================

const SECTIONS = [
  { id: 'new', label: 'Novos', Icon: Plus },
  { id: 'educacao', label: 'Educacao', Icon: Layers },
  { id: 'gestaoDocumental', label: 'Gestao Documental', Icon: FolderOpen },
  { id: 'centroGestao', label: 'Centro de Gestao', Icon: Settings },
  { id: 'plantoes', label: 'Plantoes', Icon: Calendar },
  { id: 'calculators', label: 'Calculadoras', Icon: Calculator },
  { id: 'pages', label: 'Páginas', Icon: LayoutGrid },
  { id: 'colors', label: 'Cores', Icon: Palette },
  { id: 'components', label: 'UI', Icon: LayoutGrid },
  { id: 'navigation', label: 'Navegação', Icon: Compass },
  { id: 'forms', label: 'Formulários', Icon: ClipboardList },
  { id: 'feedback', label: 'Feedback', Icon: MessageSquare },
  { id: 'responsive', label: 'Responsivo', Icon: Smartphone },
  { id: 'data', label: 'Data Display', Icon: BarChart3 },
  { id: 'utilities', label: 'Utilitários', Icon: Wrench },
  { id: 'gamification', label: 'Gamificação', Icon: Gamepad2 },
  { id: 'anest', label: 'ANEST', Icon: Stethoscope },
];

const COMPONENTS_MAP = {
  new: NewComponentsShowcase,
  educacao: EducacaoContinuadaShowcase,
  gestaoDocumental: GestaoDocumentalShowcase,
  centroGestao: CentroGestaoShowcase,
  plantoes: PlantoesShowcase,
  calculators: CalculatorShowcase,
  pages: PagesShowcase,
  colors: ColorPalette,
  components: ComponentShowcase,
  navigation: NavigationShowcase,
  forms: FormShowcase,
  feedback: FeedbackShowcase,
  responsive: ResponsiveShowcase,
  data: DataDisplayShowcase,
  utilities: UtilitiesShowcase,
  gamification: GamificationShowcase,
  anest: AnestShowcase,
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ShowcaseIndex({ onClose }) {
  const { isDark, toggleTheme } = useTheme();
  // Ao entrar no Showcase, abrir nos novos componentes por padrão.
  const [activeSection, setActiveSection] = useState('new');
  // No mobile, abrir a aba lateral automaticamente (para facilitar navegação ao entrar via botão "Showcase").
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024; // Tailwind `lg`
  });

  const ActiveComponent = COMPONENTS_MAP[activeSection];

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
    setSidebarOpen(false); // Fecha sidebar no mobile após seleção
  };

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: isDark ? TOKENS.dark.background.darkest : TOKENS.light.background.primary,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {/* ================================================================== */}
      {/* MOBILE HEADER */}
      {/* ================================================================== */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
        style={{
          background: isDark ? TOKENS.dark.background.card : TOKENS.light.background.cardHighlight,
          borderBottom: `1px solid ${isDark ? TOKENS.dark.border.default : TOKENS.light.border.default}`,
        }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: isDark ? TOKENS.dark.background.cardLight : TOKENS.light.background.cardHighlight,
            color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.dark,
          }}
          aria-label="Menu"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold"
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${TOKENS.dark.green.primary} 0%, ${TOKENS.dark.green.muted} 100%)`
                : `linear-gradient(135deg, ${TOKENS.light.green.medium} 0%, ${TOKENS.light.green.dark} 100%)`,
              color: isDark ? TOKENS.dark.background.darkest : '#FFFFFF',
            }}
          >
            A
          </span>
          <span
            className="font-bold"
            style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.dark }}
          >
            ANEST
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: isDark ? TOKENS.dark.background.cardLight : TOKENS.light.background.cardHighlight,
            color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.dark,
          }}
          aria-label={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {/* ================================================================== */}
      {/* SIDEBAR OVERLAY (Mobile) */}
      {/* ================================================================== */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================================================================== */}
      {/* SIDEBAR */}
      {/* ================================================================== */}
      <nav
        className={`
          fixed lg:fixed top-0 left-0 h-full z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-64 lg:w-60
          overflow-y-auto
          flex flex-col
          pt-14 lg:pt-0
        `}
        style={{
          background: isDark ? TOKENS.dark.background.card : TOKENS.light.background.cardHighlight,
          borderRight: `1px solid ${isDark ? TOKENS.dark.border.default : TOKENS.light.border.default}`,
        }}
      >
        <div className="p-4 lg:p-6 flex flex-col h-full">
          {/* Logo / Title - Desktop only */}
          <div className="hidden lg:block mb-6">
            <h1
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: isDark ? TOKENS.dark.green.primary : TOKENS.light.green.dark }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-lg text-base"
                style={{
                  background: isDark
                    ? `linear-gradient(135deg, ${TOKENS.dark.green.primary} 0%, ${TOKENS.dark.green.muted} 100%)`
                    : `linear-gradient(135deg, ${TOKENS.light.green.medium} 0%, ${TOKENS.light.green.dark} 100%)`,
                  color: isDark ? TOKENS.dark.background.darkest : '#FFFFFF',
                }}
              >
                A
              </span>
              ANEST
            </h1>
            <p
              className="text-xs ml-10"
              style={{ color: isDark ? TOKENS.dark.text.muted : TOKENS.light.text.secondary }}
            >
              Design System v2.0
            </p>
          </div>

          {/* Ações no topo da sidebar (tema + fechar Showcase) */}
          <div className="mb-6 space-y-2">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={toggleTheme}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? "Light" : "Dark"}
            </Button>
            {typeof onClose === 'function' ? (
              <Button
                variant="destructive"
                className="w-full flex items-center justify-center gap-2"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
                Fechar Showcase
              </Button>
            ) : null}
          </div>

          {/* Navigation Label */}
          <div
            className="text-[11px] font-semibold uppercase tracking-wider mb-3 px-3"
            style={{ color: isDark ? TOKENS.dark.text.muted : TOKENS.light.text.muted }}
          >
            Documentação
          </div>

          {/* Navigation Items */}
          <div className="flex-1 space-y-1">
            {SECTIONS.map((section) => {
              const IconComponent = section.Icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.id)}
                  className="w-full py-3 px-4 rounded-xl text-left font-semibold text-sm transition-all flex items-center gap-3"
                  style={{
                    background: isActive
                      ? isDark
                        ? `linear-gradient(135deg, ${TOKENS.dark.green.primary} 0%, ${TOKENS.dark.green.muted} 100%)`
                        : `linear-gradient(135deg, ${TOKENS.light.green.medium} 0%, ${TOKENS.light.green.dark} 100%)`
                      : 'transparent',
                    color: isActive
                      ? isDark
                        ? TOKENS.dark.background.darkest
                        : '#FFFFFF'
                      : isDark
                      ? TOKENS.dark.text.secondary
                      : TOKENS.light.text.secondary,
                    boxShadow: isActive
                      ? isDark
                        ? '0 4px 12px rgba(46, 204, 113, 0.25)'
                        : '0 4px 12px rgba(0, 66, 37, 0.25)'
                      : 'none',
                  }}
                >
                  <IconComponent className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-6">
            <div
              className="p-4 rounded-xl text-xs"
              style={{
                background: isDark ? TOKENS.dark.background.cardLight : TOKENS.light.background.cardHighlight,
              }}
            >
              <div
                className="font-semibold mb-1"
                style={{ color: isDark ? TOKENS.dark.text.primary : TOKENS.light.text.primary }}
              >
                ANEST Showcase
              </div>
              <div style={{ color: isDark ? TOKENS.dark.text.muted : TOKENS.light.text.secondary }}>
                Documentação visual do Design System.
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ================================================================== */}
      {/* MAIN CONTENT */}
      {/* ================================================================== */}
      <main
        className="flex-1 min-h-screen w-full lg:ml-60 pt-14 lg:pt-0 overflow-x-hidden"
        style={{
          maxWidth: '100%',
        }}
      >
        <div className="w-full">
          {/* key força remount ao mudar de seção, garantindo reset de estado */}
          {ActiveComponent && <ActiveComponent key={activeSection} />}
        </div>
      </main>
    </div>
  );
}

export default ShowcaseIndex;
