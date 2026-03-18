// UtilitiesShowcase.jsx
// Showcase visual dos componentes utilitários - Fase 7

import { useState } from 'react';
import { Info, Settings, HelpCircle, ChevronRight, Image, Film, Square, ChevronsUpDown } from 'lucide-react';

import { useTheme } from '../hooks/useTheme.jsx';

// Components
import { Button } from '../components/ui/button';
import { Tooltip } from '../components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '../components/ui/popover';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { AspectRatio } from '../components/ui/aspect-ratio';

// ============================================================================
// HELPERS
// ============================================================================

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme();

  return (
    <section className="mb-8 md:mb-12 w-full">
      <h3
        className="text-base md:text-lg font-bold mb-2"
        style={{ color: isDark ? '#FFFFFF' : '#000000' }}
      >
        {title}
      </h3>
      {description ? (
        <p
          className="text-sm mb-3 md:mb-4"
          style={{ color: isDark ? '#A3B8B0' : '#6B7280' }}
        >
          {description}
        </p>
      ) : null}
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          // Light mode: section containers use cardElevated (#E8F5E9) for better card contrast
          // ANEST tokens: light background.cardElevated (#E8F5E9) + border.strong (#A5D6A7)
          background: isDark ? '#1A2420' : '#E8F5E9',
          border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function ComponentBox({ title, children }) {
  const { isDark } = useTheme();

  return (
    <div className="mb-4 md:mb-6">
      {title && (
        <h4 className="text-sm font-semibold mb-2" style={{ color: isDark ? '#A3B8B0' : '#6B7280' }}>
          {title}
        </h4>
      )}
      <div
        className="p-4 md:p-6 rounded-xl md:rounded-2xl"
        style={{
          // Light mode: cards inside sections use white (bg-card) for good contrast
          background: isDark ? '#243530' : '#FFFFFF',
          border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PropsTable({ props }) {
  const { isDark } = useTheme();

  return (
    <div className="hidden md:block" style={{ marginTop: '16px', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}`,
            }}
          >
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                fontWeight: 600,
                color: isDark ? '#A3B8B0' : '#6B7280',
              }}
            >
              Prop
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                fontWeight: 600,
                color: isDark ? '#A3B8B0' : '#6B7280',
              }}
            >
              Tipo
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '8px',
                fontWeight: 600,
                color: isDark ? '#A3B8B0' : '#6B7280',
              }}
            >
              Descrição
            </th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop) => (
            <tr
              key={prop.name}
              style={{
                borderBottom: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}`,
              }}
            >
              <td
                style={{
                  padding: '8px',
                  fontFamily: 'monospace',
                  color: isDark ? '#2ECC71' : '#006837',
                }}
              >
                {prop.name}
              </td>
              <td
                style={{
                  padding: '8px',
                  color: isDark ? '#6B8178' : '#9CA3AF',
                }}
              >
                {prop.type}
              </td>
              <td
                style={{
                  padding: '8px',
                  color: isDark ? '#FFFFFF' : '#000000',
                }}
              >
                {prop.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UtilitiesShowcase() {
  const { isDark } = useTheme();
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);

  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: isDark ? '#111916' : '#F0FFF4',
        minHeight: '100vh',
        color: isDark ? '#FFFFFF' : '#000000',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div className="mb-8 md:mb-10">
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          🛠️ Utilitários
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: isDark ? '#A3B8B0' : '#6B7280',
          }}
        >
          Componentes auxiliares para overlays, layout e interações
        </p>
      </div>

      {/* ================================================================== */}
      {/* TOOLTIP */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="Tooltip"
        description="Dica flutuante exibida ao passar o mouse ou focar em um elemento. Acessível com ARIA e keyboard."
      >
        <ComponentBox title="Posições">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Tooltip content="Tooltip no topo" side="top">
              <Button variant="outline">Top</Button>
            </Tooltip>
            <Tooltip content="Tooltip na direita" side="right">
              <Button variant="outline">Right</Button>
            </Tooltip>
            <Tooltip content="Tooltip embaixo" side="bottom">
              <Button variant="outline">Bottom</Button>
            </Tooltip>
            <Tooltip content="Tooltip na esquerda" side="left">
              <Button variant="outline">Left</Button>
            </Tooltip>
          </div>
        </ComponentBox>

        <ComponentBox title="Com ícones">
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <Tooltip content="Informações adicionais sobre este item">
              <Info size={20} className="text-muted-foreground dark:text-muted-foreground cursor-help" />
            </Tooltip>
            <Tooltip content="Abrir configurações do sistema">
              <Settings size={20} className="text-muted-foreground dark:text-muted-foreground cursor-help" />
            </Tooltip>
            <Tooltip content="Precisa de ajuda? Clique aqui">
              <HelpCircle size={20} className="text-muted-foreground dark:text-muted-foreground cursor-help" />
            </Tooltip>
          </div>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'content', type: 'ReactNode', description: 'Conteúdo do tooltip' },
            { name: 'side', type: "'top' | 'right' | 'bottom' | 'left'", description: 'Posição do tooltip' },
            { name: 'align', type: "'start' | 'center' | 'end'", description: 'Alinhamento' },
            { name: 'sideOffset', type: 'number', description: 'Distância do trigger (px)' },
            { name: 'delayShow', type: 'number', description: 'Delay para mostrar (ms)' },
            { name: 'delayHide', type: 'number', description: 'Delay para esconder (ms)' },
          ]}
        />
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* POPOVER */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="Popover"
        description="Conteúdo flutuante interativo acionado por clique. Suporta focus trap e click outside."
      >
        <ComponentBox title="Básico">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Abrir Popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <h4 className="font-semibold text-[15px] mb-2 text-foreground dark:text-white">
                  Título do Popover
                </h4>
                <p className="text-[13px] text-muted-foreground dark:text-muted-foreground">
                  Este é o conteúdo do popover. Pode conter texto, formulários ou outros elementos interativos.
                </p>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button>Com botão de fechar</Button>
              </PopoverTrigger>
              <PopoverContent showClose>
                <h4 className="font-semibold text-[15px] mb-2 text-foreground dark:text-white">
                  Popover com X
                </h4>
                <p className="text-[13px] text-muted-foreground dark:text-muted-foreground mb-3">
                  Clique no X ou fora do popover para fechar.
                </p>
                <PopoverClose asChild>
                  <Button size="sm" className="w-full">Entendi</Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>
          </div>
        </ComponentBox>

        <ComponentBox title="Posições">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['top', 'right', 'bottom', 'left'].map((side) => (
              <Popover key={side}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">{side}</Button>
                </PopoverTrigger>
                <PopoverContent side={side}>
                  <p className="text-[13px] text-muted-foreground dark:text-muted-foreground">
                    Popover posicionado em <strong>{side}</strong>
                  </p>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'open', type: 'boolean', description: 'Controla estado (controlled)' },
            { name: 'onOpenChange', type: 'function', description: 'Callback de mudança' },
            { name: 'side', type: "'top' | 'right' | 'bottom' | 'left'", description: 'Posição preferida' },
            { name: 'align', type: "'start' | 'center' | 'end'", description: 'Alinhamento' },
            { name: 'sideOffset', type: 'number', description: 'Distância do trigger' },
            { name: 'showClose', type: 'boolean', description: 'Mostra botão X' },
            { name: 'modal', type: 'boolean', description: 'Modo modal com backdrop' },
          ]}
        />
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* ACCORDION */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="Accordion"
        description="Seções colapsáveis para organizar conteúdo extenso. Suporta modo single ou múltiplo."
      >
        <ComponentBox title="Single (só uma aberta)">
          <Accordion type="single" collapsible className="w-full max-w-lg">
            <AccordionItem value="item-1">
              <AccordionTrigger>O que é o ANEST?</AccordionTrigger>
              <AccordionContent>
                ANEST é um sistema de gestão de qualidade para anestesiologia, com quizzes gamificados,
                documentos, indicadores e muito mais.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Como funciona a gamificação?</AccordionTrigger>
              <AccordionContent>
                Você ganha pontos ao completar quizzes sobre ROPs (Required Organizational Practices),
                subindo no ranking e conquistando badges.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Posso acessar pelo celular?</AccordionTrigger>
              <AccordionContent>
                Sim! O ANEST é uma PWA (Progressive Web App) que funciona perfeitamente em dispositivos
                móveis, com suporte offline.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ComponentBox>

        <ComponentBox title="Multiple (várias abertas)">
          <Accordion type="multiple" className="w-full max-w-lg">
            <AccordionItem value="doc-1">
              <AccordionTrigger>Protocolos Clínicos</AccordionTrigger>
              <AccordionContent>
                Acesso a todos os protocolos clínicos do serviço, incluindo TEV, sepse, dor aguda e mais.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="doc-2">
              <AccordionTrigger>Políticas Institucionais</AccordionTrigger>
              <AccordionContent>
                Documentos de políticas e diretrizes do hospital, atualizados conforme regulamentação.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="doc-3">
              <AccordionTrigger>Manuais Técnicos</AccordionTrigger>
              <AccordionContent>
                Manuais de equipamentos, procedimentos técnicos e guias operacionais.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'type', type: "'single' | 'multiple'", description: 'Uma ou várias abertas' },
            { name: 'collapsible', type: 'boolean', description: 'Permite fechar todas (single mode)' },
            { name: 'defaultValue', type: 'string | string[]', description: 'Valor inicial' },
            { name: 'value', type: 'string | string[]', description: 'Valor controlado' },
            { name: 'onValueChange', type: 'function', description: 'Callback de mudança' },
          ]}
        />
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* COLLAPSIBLE */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="Collapsible"
        description="Componente simples de show/hide para conteúdo individual."
      >
        <ComponentBox>
          <Collapsible
            open={isCollapsibleOpen}
            onOpenChange={setIsCollapsibleOpen}
            className="w-full max-w-lg"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-background dark:bg-card rounded-lg">
              <span className="text-[14px] font-medium text-foreground dark:text-white">
                @joao.silva tem 3 repositórios favoritos
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronsUpDown size={16} />
                  <span className="sr-only">Toggle</span>
                </Button>
              </CollapsibleTrigger>
            </div>

            <div className="mt-2 rounded-lg border border-border px-4 py-3 bg-background dark:bg-transparent">
              <p className="text-[14px] text-muted-foreground dark:text-muted-foreground">
                anest-design-system
              </p>
            </div>

            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                <div className="rounded-lg border border-border px-4 py-3 bg-background dark:bg-transparent">
                  <p className="text-[14px] text-muted-foreground dark:text-muted-foreground">
                    qmentum-app
                  </p>
                </div>
                <div className="rounded-lg border border-border px-4 py-3 bg-background dark:bg-transparent">
                  <p className="text-[14px] text-muted-foreground dark:text-muted-foreground">
                    anest-mobile
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'open', type: 'boolean', description: 'Estado controlado' },
            { name: 'onOpenChange', type: 'function', description: 'Callback de mudança' },
            { name: 'defaultOpen', type: 'boolean', description: 'Estado inicial' },
            { name: 'disabled', type: 'boolean', description: 'Desabilita interação' },
          ]}
        />
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* SCROLL AREA */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="ScrollArea"
        description="Área de scroll com scrollbars customizadas e consistentes entre browsers."
      >
        <ComponentBox title="Scroll Vertical">
          {/* Não aplicar “card” no ScrollArea para evitar card dentro de card (ComponentBox já é o container) */}
          <ScrollArea className="h-[200px] w-full max-w-sm">
            <div className="p-4">
              <h4 className="mb-4 text-[15px] font-semibold text-foreground dark:text-white">
                Lista de Protocolos
              </h4>
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="py-3 border-b border-border last:border-0"
                >
                  <p className="text-[14px] text-muted-foreground dark:text-muted-foreground">
                    Protocolo {i + 1} - Descrição do documento
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </ComponentBox>

        <ComponentBox title="Scroll Horizontal">
          <ScrollArea orientation="horizontal" className="w-full max-w-lg">
            <div className="flex gap-4 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[150px] h-[100px] rounded-lg bg-card dark:bg-card border border-border flex items-center justify-center"
                >
                  <span className="text-[14px] font-medium text-muted-foreground dark:text-muted-foreground">
                    Card {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'orientation', type: "'vertical' | 'horizontal' | 'both'", description: 'Direção do scroll' },
            { name: 'type', type: "'hover' | 'scroll' | 'always' | 'auto'", description: 'Quando mostrar scrollbar' },
            { name: 'scrollbarSize', type: 'number', description: 'Espessura da scrollbar (px)' },
            { name: 'hideScrollbar', type: 'boolean', description: 'Oculta scrollbar' },
          ]}
        />
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* SEPARATOR */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="Separator"
        description="Divisor visual semântico para separar conteúdo."
      >
        <ComponentBox title="Orientações">
          <div className="space-y-6">
            {/* Horizontal */}
            <div>
              <p className="text-[14px] text-muted-foreground dark:text-muted-foreground mb-2">Seção 1</p>
              <Separator />
              <p className="text-[14px] text-muted-foreground dark:text-muted-foreground mt-2">Seção 2</p>
            </div>

            {/* Vertical */}
            <div className="flex items-center h-8 gap-4">
              <span className="text-[14px] text-muted-foreground dark:text-muted-foreground">Item A</span>
              <Separator orientation="vertical" />
              <span className="text-[14px] text-muted-foreground dark:text-muted-foreground">Item B</span>
              <Separator orientation="vertical" />
              <span className="text-[14px] text-muted-foreground dark:text-muted-foreground">Item C</span>
            </div>
          </div>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'orientation', type: "'horizontal' | 'vertical'", description: 'Direção do divisor' },
            { name: 'decorative', type: 'boolean', description: 'Se true, apenas visual (aria-hidden)' },
          ]}
        />
      </ShowcaseSection>

      {/* ================================================================== */}
      {/* ASPECT RATIO */}
      {/* ================================================================== */}
      <ShowcaseSection
        title="AspectRatio"
        description="Container que mantém proporção de aspecto para imagens e vídeos."
      >
        <ComponentBox title="Proporções comuns">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { ratio: 1, label: '1:1 (Quadrado)', icon: Square },
              { ratio: 16 / 9, label: '16:9 (Vídeo)', icon: Film },
              { ratio: 4 / 3, label: '4:3 (Clássico)', icon: Image },
              { ratio: 3 / 2, label: '3:2 (Foto)', icon: Image },
            ].map((item) => (
              <div key={item.label} className="text-center">
                {/* Evita “card dentro de card”: o arredondamento fica no container (AspectRatio), não no conteúdo */}
                <AspectRatio ratio={item.ratio} className="mb-2 overflow-hidden rounded-lg">
                  <div className="w-full h-full bg-gradient-to-br from-[#006837] to-[#2ECC71] flex items-center justify-center">
                    <item.icon size={32} className="text-white/80" />
                  </div>
                </AspectRatio>
                <span className="text-[12px] text-muted-foreground dark:text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </ComponentBox>

        <ComponentBox title="Com imagem">
          <div className="max-w-sm">
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg">
              <img
                src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&h=338&fit=crop"
                alt="Cirurgia"
                className="w-full h-full object-cover"
              />
            </AspectRatio>
          </div>
        </ComponentBox>

        <PropsTable
          props={[
            { name: 'ratio', type: 'number', description: 'Proporção (largura / altura)' },
          ]}
        />
      </ShowcaseSection>
    </div>
  );
}

export default UtilitiesShowcase;
