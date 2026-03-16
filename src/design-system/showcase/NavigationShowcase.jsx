import { useMemo, useState } from "react"
import {
  Bell,
  ChevronDown,
  FileText,
  Home,
  Settings,
  Shield,
  SlidersHorizontal,
  User,
} from "lucide-react"

import { useTheme } from "../hooks/useTheme.jsx"
import { Button } from "../components/ui/button"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownCheckboxItem,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownLabel,
  DropdownSeparator,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  SidebarTrigger,
  NavLink,
  Pagination,
  Stepper,
} from "../components/ui"

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme()

  return (
    <div className="mb-8 md:mb-12 w-full">
      <h3
        className="text-base md:text-lg font-bold mb-2"
        style={{ color: isDark ? "#FFFFFF" : "#000000" }}
      >
        {title}
      </h3>
      {description ? (
        <p
          className="text-sm mb-3 md:mb-4"
          style={{ color: isDark ? "#A3B8B0" : "#6B7280" }}
        >
          {description}
        </p>
      ) : null}
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          background: isDark ? "#1A2420" : "#E8F5E9",
          border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function NavigationShowcase() {
  const { isDark } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [page, setPage] = useState(6)
  const [currentStep, setCurrentStep] = useState(1)

  const steps = useMemo(
    () => [
      { label: "Identificação", description: "Paciente e equipe" },
      { label: "Checklist", description: "Antes da indução" },
      { label: "Time-out", description: "Antes da incisão" },
      { label: "Sign-out", description: "Antes de sair da sala" },
    ],
    []
  )

  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: isDark ? "#111916" : "#F0FFF4",
        minHeight: "100vh",
        color: isDark ? "#FFFFFF" : "#000000",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
        🧭 Navegação
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: isDark ? "#A3B8B0" : "#6B7280",
          marginBottom: "32px",
        }}
      >
        {isDark ? "Dark Mode" : "Light Mode"} - Tabs, Breadcrumb, Dropdown, Sidebar,
        NavLink, Pagination e Stepper
      </p>

      {/* ================================================================ */}
      {/* TABS */}
      {/* ================================================================ */}
      <ShowcaseSection
        title="🗂️ Tabs"
        description="Horizontal, vertical, com ícones/badges e estados (disabled)"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", opacity: 0.7 }}>
              Horizontal
            </div>
            <Tabs defaultValue="visao-geral" orientation="horizontal">
              <TabsList className="flex-wrap overflow-x-visible">
                <TabsTrigger value="visao-geral" className="shrink min-w-0">
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger value="detalhes" className="shrink min-w-0">
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="historico" disabled className="shrink min-w-0">
                  Histórico
                </TabsTrigger>
              </TabsList>
              <TabsContent value="visao-geral">
                Conteúdo da aba Visão Geral.
              </TabsContent>
              <TabsContent value="detalhes">
                Conteúdo da aba Detalhes.
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", opacity: 0.7 }}>
              Vertical
            </div>
            <Tabs defaultValue="aba-a" orientation="vertical">
              <TabsList>
                <TabsTrigger value="aba-a">Aba A</TabsTrigger>
                <TabsTrigger value="aba-b">Aba B</TabsTrigger>
                <TabsTrigger value="aba-c">Aba C</TabsTrigger>
              </TabsList>
              <TabsContent value="aba-a">Conteúdo A</TabsContent>
              <TabsContent value="aba-b">Conteúdo B</TabsContent>
              <TabsContent value="aba-c">Conteúdo C</TabsContent>
            </Tabs>
          </div>

          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", opacity: 0.7 }}>
              Ícones + Badges
            </div>
            <Tabs defaultValue="inbox" orientation="horizontal">
              <TabsList className="flex-wrap overflow-x-visible">
                <TabsTrigger
                  value="inbox"
                  icon={<Bell size={18} />}
                  badge={3}
                  className="flex-none"
                >
                  Inbox
                </TabsTrigger>
                <TabsTrigger value="docs" icon={<FileText size={18} />} className="flex-none">
                  Documentos
                </TabsTrigger>
                <TabsTrigger
                  value="config"
                  icon={<Settings size={18} />}
                  badge="Novo"
                  className="flex-none"
                >
                  Configurações
                </TabsTrigger>
              </TabsList>
              <TabsContent value="inbox">
                Você tem 3 notificações.
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================ */}
      {/* BREADCRUMB */}
      {/* ================================================================ */}
      <ShowcaseSection
        title="🍞 Breadcrumb"
        description="Simples, com ícones e com truncamento (ellipsis)"
      >
        <div style={{ display: "grid", gap: "16px" }}>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Seção</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Página</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" icon={<Home size={16} />}>
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#" icon={<Shield size={16} />}>
                  Segurança
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Checklist</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbEllipsis />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Seção</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Página Atual</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </ShowcaseSection>

      {/* ================================================================ */}
      {/* DROPDOWN */}
      {/* ================================================================ */}
      <ShowcaseSection
        title="⬇️ Dropdown Menu"
        description="Ícones, atalhos, checkbox items, radio group, separators/labels"
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button rightIcon={<ChevronDown size={16} />}>Menu simples</Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={<User size={16} />}>Perfil</DropdownItem>
              <DropdownItem icon={<Settings size={16} />}>Configurações</DropdownItem>
              <DropdownSeparator />
              <DropdownItem destructive>Excluir</DropdownItem>
            </DropdownContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="outline" rightIcon={<ChevronDown size={16} />}>
                Ícones + Shortcuts
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>Ações</DropdownLabel>
              <DropdownItem icon={<SlidersHorizontal size={16} />} shortcut="Ctrl+K">
                Comando
              </DropdownItem>
              <DropdownItem icon={<FileText size={16} />} shortcut="Ctrl+P">
                Imprimir
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="secondary" rightIcon={<ChevronDown size={16} />}>
                Checkboxes
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>Filtros</DropdownLabel>
              <DropdownCheckboxItem defaultChecked>Ativos</DropdownCheckboxItem>
              <DropdownCheckboxItem>Arquivados</DropdownCheckboxItem>
              <DropdownCheckboxItem disabled>Bloqueados</DropdownCheckboxItem>
            </DropdownContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="ghost" rightIcon={<ChevronDown size={16} />}>
                Radio Group
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>Ordenação</DropdownLabel>
              <DropdownRadioGroup defaultValue="recent">
                <DropdownRadioItem value="recent">Mais recentes</DropdownRadioItem>
                <DropdownRadioItem value="oldest">Mais antigos</DropdownRadioItem>
                <DropdownRadioItem value="alpha">Alfabética</DropdownRadioItem>
              </DropdownRadioGroup>
            </DropdownContent>
          </DropdownMenu>
        </div>
      </ShowcaseSection>

      {/* ================================================================ */}
      {/* SIDEBAR */}
      {/* ================================================================ */}
      <ShowcaseSection title="🧱 Sidebar / Drawer" description="Drawer com overlay, slide e grupos">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={() => setSidebarOpen(true)}>Abrir Sidebar</Button>
          <div style={{ fontSize: "13px", opacity: 0.7 }}>
            Dica: Escape fecha. Clique no overlay também fecha.
          </div>
        </div>

        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} side="left" variant="floating">
          <SidebarHeader className="flex items-center justify-between gap-3">
            <div style={{ fontWeight: 700 }}>Menu</div>
            <SidebarTrigger>Fechar</SidebarTrigger>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Geral</SidebarGroupLabel>
              <SidebarItem icon={<Home size={18} />} active>
                Home
              </SidebarItem>
              <SidebarItem icon={<Shield size={18} />}>Segurança</SidebarItem>
              <SidebarItem icon={<FileText size={18} />} badge={2}>
                Documentos
              </SidebarItem>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Config</SidebarGroupLabel>
              <SidebarItem icon={<Settings size={18} />}>Configurações</SidebarItem>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="flex items-center justify-between">
            <div style={{ fontSize: "12px", opacity: 0.7 }}>ANEST</div>
            <SidebarTrigger collapse>Colapsar</SidebarTrigger>
          </SidebarFooter>
        </Sidebar>
      </ShowcaseSection>

      {/* ================================================================ */}
      {/* NAV LINK */}
      {/* ================================================================ */}
      <ShowcaseSection title="🔗 NavLink" description="Variantes, tamanhos, ícones, badge e estados">
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <NavLink variant="default" icon={<Home />}>
              Default
            </NavLink>
            <NavLink variant="subtle" icon={<Shield />} badge={4}>
              Subtle
            </NavLink>
            <NavLink variant="pill" icon={<Settings />}>
              Pill
            </NavLink>
            <NavLink active icon={<FileText />} badge="Novo">
              Active
            </NavLink>
            <NavLink disabled icon={<User />}>
              Disabled
            </NavLink>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <NavLink size="sm" icon={<Home />}>
              Small
            </NavLink>
            <NavLink size="md" icon={<Home />}>
              Medium
            </NavLink>
            <NavLink size="lg" icon={<Home />} iconPosition="right">
              Large
            </NavLink>
          </div>
        </div>
      </ShowcaseSection>

      {/* ================================================================ */}
      {/* PAGINATION */}
      {/* ================================================================ */}
      <ShowcaseSection title="📄 Pagination" description="Interativa com tamanhos">
        <div style={{ display: "grid", gap: "16px" }}>
          <Pagination currentPage={page} totalPages={20} onPageChange={setPage} />
          <Pagination currentPage={page} totalPages={20} onPageChange={setPage} size="sm" />
          <Pagination currentPage={page} totalPages={20} onPageChange={setPage} size="lg" />
        </div>
      </ShowcaseSection>

      {/* ================================================================ */}
      {/* STEPPER */}
      {/* ================================================================ */}
      <ShowcaseSection title="🪜 Stepper" description="Horizontal/Vertical + avançar/voltar">
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            >
              Voltar
            </Button>
            <Button
              onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
            >
              Avançar
            </Button>
            <div style={{ fontSize: "13px", opacity: 0.7 }}>
              Step atual: {currentStep + 1}/{steps.length}
            </div>
          </div>

          <Stepper
            currentStep={currentStep}
            steps={steps}
            onStepClick={(s) => setCurrentStep(s)}
            clickable
          />

          <div style={{ height: "16px" }} />

          <Stepper
            currentStep={currentStep}
            steps={steps}
            onStepClick={(s) => setCurrentStep(s)}
            clickable
            orientation="vertical"
          />
        </div>
      </ShowcaseSection>
    </div>
  )
}

export default NavigationShowcase


