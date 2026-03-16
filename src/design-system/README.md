# 🎨 ANEST Design System v2.0

Sistema de Design para o aplicativo ANEST - Gestão de Qualidade em Anestesiologia.

- **Estilo:** iOS Fintech-inspired
- **Suporte:** Light e Dark mode
- **Stack:** React + Vite + Tailwind + Framer Motion

---

## Instalação

### 1. ThemeProvider (obrigatório)

Envolva sua aplicação com o ThemeProvider em `main.jsx`:

```jsx
import { ThemeProvider } from '@/design-system';

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

### 2. Usando o Hook useTheme

```jsx
import { useTheme } from '@/design-system';

function MyComponent() {
  const { isDark, toggleTheme, theme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
```

---

## Componentes Disponíveis

### Primitivos (UI)

| Componente | Descrição | Props principais |
|------------|-----------|------------------|
| Button | Botão com variantes | `variant`, `size`, `disabled`, `loading`, `leftIcon`, `rightIcon` |
| Badge | Badge/tag | `variant`, `badgeStyle`, `dot`, `count`, `icon` |
| Card | Container com estilos | `variant`, `className`, `noPadding`, `onClick` |
| Avatar | Avatar circular | `size`, `initials`, `src`, `alt`, `fallback` |
| Input | Campo de entrada | `variant`, `placeholder`, `error`, `label`, `leftIcon`, `rightIcon` |
| Skeleton | Loading placeholder | `variant`, `size`, `width`, `height`, `count` |
| AppIcon | Ícone de app estilo iPhone | `icon`, `label`, `onClick` |
| WidgetCard | Card de widget | `title`, `subtitle`, `icon`, `value`, `badge`, `size`, `variant` |

### Compostos (ANEST)

| Componente | Descrição | Props principais |
|------------|-----------|------------------|
| Header | Header com saudação | `greeting`, `userName`, `notificationCount`, `onNotificationClick`, `onAvatarClick` |
| SearchBar | Barra de busca | `placeholder`, `value`, `onChange`, `onSubmit` |
| QuickLinksGrid | Grid de atalhos | `title`, `items`, `onCustomize` |
| ComunicadosCard | Card de comunicados | `label`, `title`, `badgeText`, `items`, `onViewAll` |
| PlantaoListItem | Item de plantão | `hospital`, `data`, `hora`, `index`, `isLast` |
| FeriasListItem | Item de férias | `nome`, `periodo`, `showDivider` |
| BottomNav | Navegação inferior | `items`, `onItemClick` |
| SectionCard | Card de seção | `title`, `subtitle`, `action`, `badge`, `variant`, `children` |

### Páginas Admin (Educação)

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| TreeNavigator | `pages/educacao/admin/components/TreeNavigator.jsx` | Árvore navegável com visual flat (NavLink pattern), keyboard nav, ARIA treeitem |
| AdminConteudoPage | `pages/educacao/admin/AdminConteudoPage.jsx` | Layout 3 painéis (Navigator/Editor/Sidebar), toolbar grid simétrico |
| CascadeCreator | `pages/educacao/admin/components/CascadeCreator.jsx` | Criação guiada em cascata com stepper simétrico (connectors largura fixa) |
| StepTrilha | `pages/educacao/admin/components/StepTrilha.jsx` | Step 1: Trilha com grid de tipos de usuário (auto-rows-[1fr]) |

### Padrões Visuais de Referência

| Padrão | Classes | Usado em |
|--------|---------|----------|
| **NavLink hover** | `hover:bg-muted/60 transition-colors duration-150` | NavLink, TreeNavigator, StepTrilha checkboxes |
| **DS green selected** | `bg-[#D4EDDA] dark:bg-[rgba(46,204,113,0.15)]` | NavLink active, SidebarItem active, TreeNavigator selected |
| **DS green text** | `text-[#004225] dark:text-[#2ECC71]` | NavLink active text, TreeNavigator selected text |
| **Flat row** (sem border/bg) | Sem `border`, sem `bg-card`, background transparente | TreeNavigator rows, SidebarItem |
| **Grid simétrico** | `grid grid-cols-N gap-1` + `w-full` nos filhos | AdminConteudoPage toolbar, StepTrilha checkboxes |
| **Rows uniformes** | `auto-rows-[1fr]` | StepTrilha checkbox grid |

---

## Paleta de Cores

### Light Mode

| Token | Cor | Uso |
|-------|-----|-----|
| bg-primary | `#F0FFF4` | Fundo da página |
| bg-card | `#FFFFFF` | Cards |
| green-dark | `#004225` | Botões, badges |
| green-medium | `#006837` | Ícones, links |
| text-primary | `#000000` | Títulos |
| text-secondary | `#6B7280` | Subtítulos |

### Dark Mode

| Token | Cor | Uso |
|-------|-----|-----|
| bg-primary | `#111916` | Fundo da página |
| bg-card | `#1A2420` | Cards |
| green-primary | `#2ECC71` | Destaques |
| border | `#2A3F36` | Bordas |
| text-primary | `#FFFFFF` | Títulos |
| text-secondary | `#A3B8B0` | Subtítulos |

---

## Tipografia

**Font Family:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`

| Tipo | Size | Weight | Uso |
|------|------|--------|-----|
| H1/Greeting | 20px | 700 | Saudações, títulos |
| H2/Section | 18px | 700 | Títulos de seção |
| Body | 15px | 600 | Texto principal |
| Caption | 13px | 500 | Labels, datas |
| Small/Badge | 11px | 600 | Badges |
| Micro | 10px | 500 | Labels de atalhos |

---

## Border Radius

| Elemento | Valor |
|----------|-------|
| Card | 20px |
| Search | 16px |
| Icon | 12px |
| Badge | 10px |

---

## Tamanhos de Componentes

| Elemento | Valor |
|----------|-------|
| Avatar (header) | 52×52px |
| Bell | 44×44px |
| Atalho círculo | 54×54px |
| List icon | 48×48px |
| Nav icon | 28×28px |

---

## Exemplo Completo

```jsx
import { 
  ThemeProvider,
  useTheme,
  Header, 
  SearchBar, 
  QuickLinksGrid,
  ComunicadosCard,
  PlantaoListItem,
  SectionCard,
  BottomNav 
} from '@/design-system';

function HomePage() {
  const { isDark } = useTheme();
  
  const plantoes = [
    { hospital: 'Hospital Santa Casa', data: 'Segunda, 16 Dez', hora: '07:00' },
    { hospital: 'Hospital São Lucas', data: 'Terça, 17 Dez', hora: '19:00' },
  ];
  
  const atalhos = [
    { label: 'Calculadoras', icon: 'Calculator', onClick: () => {} },
    { label: 'Reportar', icon: 'AlertTriangle', onClick: () => {} },
    { label: 'Manutenção', icon: 'Wrench', onClick: () => {} },
    { label: 'Desafio ROPs', icon: 'Target', onClick: () => {} },
  ];
  
  const navItems = [
    { icon: 'Home', active: true },
    { icon: 'Shield', active: false },
    { icon: 'FileText', active: false },
    { icon: 'Menu', active: false },
  ];
  
  return (
    <div className={isDark ? 'bg-[#111916]' : 'bg-[#F0FFF4]'}>
      <Header 
        greeting="Olá, Dr. João" 
        userName="João Martins"
        notificationCount={5} 
      />
      
      <SearchBar placeholder="Buscar..." />
      
      <ComunicadosCard 
        items={['Novo protocolo de sedação', 'Atualização da escala']} 
        badgeText="3 novos" 
      />
      
      <QuickLinksGrid items={atalhos} />
      
      <SectionCard title="Plantões">
        {plantoes.map((p, i) => (
          <PlantaoListItem 
            key={i} 
            {...p} 
            index={i}
            isLast={i === plantoes.length - 1}
          />
        ))}
      </SectionCard>
      
      <BottomNav items={navItems} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>
  );
}
```

---

## Showcases Visuais

O Design System inclui páginas de showcase para visualização dos componentes:

```jsx
import { ShowcaseIndex } from '@/design-system';

// Página completa com navegação entre showcases
<ShowcaseIndex />

// Ou importe showcases individuais:
import { ColorPalette, ComponentShowcase, AnestShowcase } from '@/design-system';
```

---

## Arquivos de Referência

| Arquivo | Descrição |
|---------|-----------|
| `LightMode.jsx` | Modelo visual completo do tema claro |
| `DarkMode.jsx` | Modelo visual completo do tema escuro |
| `Tokens.json` | Tokens centralizados (cores, tipografia, espaçamentos) |
| `showcase/` | Componentes de documentação visual |

---

## Usando MCPs no Cursor

### Shadcn MCP (Componentes prontos)

```
Use shadcn mcp to find a Card component that I can customize with ANEST styles.
```

### Context7 MCP (Documentação atualizada)

```
Use context7 mcp to check the latest React docs for useState best practices.
```

---

*ANEST Design System v2.0 - Dezembro 2025*
