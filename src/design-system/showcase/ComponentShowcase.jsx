// ComponentShowcase.jsx
// Showcase visual de todos os componentes UI do Design System ANEST

import { useState } from 'react';
import { Calculator, AlertTriangle, Wrench, ChevronRight, Bell, Search, Mail } from 'lucide-react';

import { useTheme } from '../hooks/useTheme.jsx';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Avatar } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { AppIcon } from '../components/ui/app-icon';
import { WidgetCard } from '../components/ui/widget-card';
import { WidgetGrid } from '../components/ui/widget-grid';

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme();

  return (
    <div className="mb-8 md:mb-12 w-full">
      <h3
        className="text-base md:text-lg font-bold mb-2"
        style={{ color: isDark ? '#FFFFFF' : '#000000' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mb-3 md:mb-4"
          style={{ color: isDark ? '#A3B8B0' : '#6B7280' }}
        >
          {description}
        </p>
      )}
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          background: isDark ? '#1A2420' : '#E8F5E9',
          border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
          overflow: 'visible',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ComponentGrid({ children, cols = 4, stretch = false }) {
  const colsClass =
    cols === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : cols === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : cols === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div
      className={[
        'grid gap-4',
        colsClass,
        stretch ? 'items-stretch' : 'items-start',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function ComponentLabel({ children }) {
  const { isDark } = useTheme();

  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 500,
        color: isDark ? '#6B8178' : '#9CA3AF',
        marginTop: '8px',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

function CodeBlock({ code }) {
  const { isDark } = useTheme();

  return (
    <pre
      style={{
        background: isDark ? '#0A0F0D' : '#F3F4F6',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        overflow: 'auto',
        color: isDark ? '#A3B8B0' : '#374151',
        marginTop: '16px',
        border: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}`,
      }}
    >
      <code>{code}</code>
    </pre>
  );
}

// ============================================================================
// SHOWCASES DE COMPONENTES
// ============================================================================

function ButtonShowcase() {
  return (
    <ShowcaseSection
      title="🔘 Button"
      description="Botões com múltiplas variantes, tamanhos e estados"
    >
      {/* Variantes */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>
          Variantes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>

      {/* Tamanhos */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>
          Tamanhos
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><Bell /></Button>
        </div>
      </div>

      {/* Estados */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>
          Estados
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button leftIcon={<Calculator />}>Com Ícone</Button>
          <Button rightIcon={<ChevronRight />}>Com Ícone</Button>
        </div>
      </div>

      <CodeBlock
        code={`<Button variant="default" size="default">
  Botão
</Button>

<Button variant="success" leftIcon={<Check />}>
  Salvar
</Button>

<Button loading>
  Processando...
</Button>`}
      />
    </ShowcaseSection>
  );
}

function BadgeShowcase() {
  return (
    <ShowcaseSection
      title="🏷️ Badge"
      description="Badges para status, contadores e categorias"
    >
      {/* Variantes */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>
          Variantes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </div>

      {/* Estilos */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>
          Estilos
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Badge badgeStyle="solid">Solid</Badge>
          <Badge badgeStyle="outline">Outline</Badge>
          <Badge badgeStyle="subtle">Subtle</Badge>
        </div>
      </div>

      {/* Com dot e count */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>
          Com Dot e Count
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <Badge dot>Com Dot</Badge>
          <Badge count={5} />
          <Badge variant="destructive" count={99} />
        </div>
      </div>

      <CodeBlock
        code={`<Badge variant="success">Ativo</Badge>

<Badge variant="destructive" badgeStyle="outline">
  Urgente
</Badge>

<Badge count={5} />`}
      />
    </ShowcaseSection>
  );
}

function CardShowcase() {
  return (
    <ShowcaseSection
      title="📦 Card"
      description="Containers com diferentes variantes e estrutura"
    >
      {/* Mesmo padrão de grid usado no Design System (ver `web/src/App.jsx`) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          variant="default"
          className="bg-card border-border dark:bg-card dark:border-border"
        >
            <CardHeader>
              <CardTitle>Card Default</CardTitle>
            </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Conteúdo simples com texto auxiliar para explicar o contexto.
            </CardContent>
          </Card>

        <Card
          variant="highlight"
          className="bg-accent border-border dark:bg-card dark:border-[#344840]"
        >
            <CardHeader>
              <CardTitle>Card Highlight</CardTitle>
            </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Atualização do protocolo</li>
              <li>Treinamento obrigatório</li>
              <li>Nova diretriz de segurança</li>
            </ul>
            </CardContent>
          </Card>

        <Card
          variant="interactive"
          onClick={() => alert('Card interativo clicado!')}
          className="bg-card border-border dark:bg-card dark:border-border"
        >
            <CardHeader>
              <CardTitle>Card Interactive</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Clique aqui para disparar um <code>alert</code>.
          </CardContent>
        </Card>

        <Card
          variant="outline"
          className="border-border"
        >
          <CardHeader>
            <CardTitle>Card Outline</CardTitle>
            </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Um card com borda e fundo transparente, ideal para áreas de destaque sem preencher.
            </CardContent>
          </Card>
        </div>

      <CodeBlock
        code={`<Card variant="default">
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    Conteúdo aqui...
  </CardContent>
  <CardFooter>
    <Button>Ação</Button>
  </CardFooter>
</Card>`}
      />
    </ShowcaseSection>
  );
}

function AvatarShowcase() {
  return (
    <ShowcaseSection
      title="👤 Avatar"
      description="Avatares circulares com tamanhos e fallbacks"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <Avatar size="sm" initials="JM" />
          <ComponentLabel>SM (32px)</ComponentLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Avatar size="md" initials="JM" />
          <ComponentLabel>MD (44px)</ComponentLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Avatar size="lg" initials="JM" />
          <ComponentLabel>LG (52px)</ComponentLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Avatar size="xl" initials="JM" />
          <ComponentLabel>XL (80px)</ComponentLabel>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <Avatar initials="AB" />
          <ComponentLabel>Com Iniciais</ComponentLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Avatar />
          <ComponentLabel>Fallback Ícone</ComponentLabel>
        </div>
      </div>

      <CodeBlock
        code={`<Avatar size="lg" initials="JM" />

<Avatar 
  src="/avatar.jpg" 
  alt="Dr. João"
  size="xl"
/>

<Avatar /> // Fallback com ícone`}
      />
    </ShowcaseSection>
  );
}

function InputShowcase() {
  const [inputValue, setInputValue] = useState('');

  return (
    <ShowcaseSection
      title="📝 Input"
      description="Campos de entrada com variantes e estados"
    >
      <ComponentGrid cols={2}>
        <div>
          <Input
            label="Input Default"
            placeholder="Digite algo..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>

        <div>
          <Input
            variant="search"
            placeholder="Buscar..."
          />
        </div>

        <div>
          <Input
            label="Com Erro"
            placeholder="Email inválido"
            error="Este campo é obrigatório"
          />
        </div>

        <div>
          <Input
            label="Desabilitado"
            placeholder="Não editável"
            disabled
          />
        </div>

        <div>
          <Input
            label="Com Ícone"
            placeholder="Seu email"
            leftIcon={<Mail size={18} />}
          />
        </div>

        <div>
          <Input
            label="Com Ícone Direita"
            placeholder="Buscar..."
            rightIcon={<Search size={18} />}
          />
        </div>
      </ComponentGrid>

      <CodeBlock
        code={`<Input
  label="Email"
  placeholder="seu@email.com"
  leftIcon={<Mail />}
/>

<Input
  variant="search"
  placeholder="Buscar..."
/>

<Input
  error="Campo obrigatório"
  placeholder="..."
/>`}
      />
    </ShowcaseSection>
  );
}

function SkeletonShowcase() {
  return (
    <ShowcaseSection
      title="💀 Skeleton"
      description="Placeholders de loading animados"
    >
      <ComponentGrid cols={4}>
        <div>
          <Skeleton variant="text" />
          <ComponentLabel>Text</ComponentLabel>
        </div>

        <div>
          <Skeleton variant="text" count={3} />
          <ComponentLabel>Text (3 linhas)</ComponentLabel>
        </div>

        <div>
          <Skeleton variant="avatar" size="lg" />
          <ComponentLabel>Avatar LG</ComponentLabel>
        </div>

        <div>
          <Skeleton variant="button" />
          <ComponentLabel>Button</ComponentLabel>
        </div>
      </ComponentGrid>

      <div style={{ marginTop: '24px' }}>
        <Skeleton variant="card" height={120} />
        <ComponentLabel>Card</ComponentLabel>
      </div>

      <div style={{ marginTop: '24px' }}>
        <Skeleton variant="listItem" />
        <ComponentLabel>List Item</ComponentLabel>
      </div>

      <CodeBlock
        code={`<Skeleton variant="text" count={3} />

<Skeleton variant="avatar" size="lg" />

<Skeleton variant="card" height={120} />

<Skeleton variant="listItem" />`}
      />
    </ShowcaseSection>
  );
}

function AppIconShowcase() {
  return (
    <ShowcaseSection
      title="📱 AppIcon"
      description="Ícones estilo iPhone para atalhos rápidos"
    >
      {/* Mesmo layout horizontal do “Componentes ANEST showcase” (QuickLinksCard) */}
      <div className="grid grid-cols-4 justify-items-center gap-4">
        <AppIcon
          icon={<Calculator />}
          label="Calculadoras"
          onClick={() => alert('Calculadoras!')}
        />
        <AppIcon
          icon={<AlertTriangle />}
          label="Reportar"
          onClick={() => alert('Reportar!')}
        />
        <AppIcon
          icon={<Wrench />}
          label="Manutenção"
          onClick={() => alert('Manutenção!')}
        />
        <AppIcon
          icon={<Bell />}
          label="Notificações"
          onClick={() => alert('Notificações!')}
        />
      </div>

      <CodeBlock
        code={`<AppIcon
  icon={<Calculator />}
  label="Calculadoras"
  onClick={() => navigate('/calc')}
/>`}
      />
    </ShowcaseSection>
  );
}

function WidgetCardShowcase() {
  return (
    <ShowcaseSection
      title="📊 WidgetCard"
      description="Cards de widget para dashboards"
    >
      {/* Grid iPhone: 2 widgets por linha */}
      <WidgetGrid variant="widgets" columns={2} gap={16}>
        <WidgetCard
          icon={<Calculator />}
          title="Calculadoras"
          subtitle="Ferramentas clínicas"
          size="small"
          className="bg-card border-border dark:bg-card dark:border-border"
        />

        <WidgetCard
          icon={<AlertTriangle />}
          title="Pendências"
          subtitle="Itens a resolver"
          value="12"
          badge="3"
          size="small"
          variant="interactive"
          className="bg-card border-border dark:bg-card dark:border-border"
        />

        <WidgetCard
          icon={<Bell />}
          title="Comunicados"
          subtitle="Novos avisos"
          badge="5"
          size="small"
          variant="highlight"
        />
      </WidgetGrid>

      <CodeBlock
        code={`<WidgetCard
  icon={<Calculator />}
  title="Calculadoras"
  subtitle="Ferramentas"
  value="12"
  badge="3"
  variant="interactive"
  onClick={() => {}}
/>`}
      />
    </ShowcaseSection>
  );
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function ComponentShowcase() {
  const { isDark } = useTheme();

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
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '8px',
        }}
      >
        🧩 Componentes UI
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: isDark ? '#A3B8B0' : '#6B7280',
          marginBottom: '32px',
        }}
      >
        {isDark ? 'Dark Mode' : 'Light Mode'} - Componentes primitivos do Design System
      </p>

      <ButtonShowcase />
      <BadgeShowcase />
      <CardShowcase />
      <AvatarShowcase />
      <InputShowcase />
      <SkeletonShowcase />
      <AppIconShowcase />
      <WidgetCardShowcase />
    </div>
  );
}

export default ComponentShowcase;

