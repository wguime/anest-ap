# 🎨 PROMPT PARA AJUSTES NO DESIGN SYSTEM ANEST

> Use este prompt ao solicitar alterações em componentes do Design System.
> Copie as seções relevantes para garantir consistência visual e técnica.

---

## 📋 CONTEXTO DO PROJETO

Estou trabalhando no **ANEST Design System** - um sistema de gestão de qualidade para anestesiologia.

**Stack:**
- React 19.x + Vite 5.x
- Tailwind CSS 3.x + class-variance-authority (CVA)
- Framer Motion 11.x (animações)
- Lucide React (ícones)
- Recharts (gráficos)

**Arquivos de referência:**
- `web/CLAUDE_CONTEXT.md` - Documentação completa
- `web/src/design-system/Tokens.json` - Design tokens
- `web/src/design-system/showcase/*` - Exemplos visuais

---

## 🎯 PADRÕES OBRIGATÓRIOS

### 1. Estrutura de Componente

```jsx
// 1. Imports organizados
import * as React from "react"
import { cva } from "class-variance-authority"
import { motion } from "framer-motion"
import { IconName } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"
import { useTheme } from "../hooks/useTheme"

// 2. Variantes com CVA
const componentVariants = cva(
  "base-classes", // classes base
  {
    variants: {
      variant: { default: "...", secondary: "..." },
      size: { sm: "...", default: "...", lg: "..." },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

// 3. Componente com forwardRef (quando aplicável)
const Component = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="component-name"
    data-variant={variant}
    className={cn(componentVariants({ variant, size }), className)}
    {...props}
  />
))
Component.displayName = "Component"

// 4. Exports nomeados
export { Component, componentVariants }
```

### 2. Paleta de Cores ANEST

```javascript
// Light Mode
const light = {
  bg: "#F0FFF4",           // Fundo principal
  card: "#FFFFFF",          // Cards
  cardHighlight: "#D4EDDA", // Cards destaque
  border: "#C8E6C9",        // Bordas
  textPrimary: "#000000",   // Títulos
  textSecondary: "#6B7280", // Subtítulos
  textMuted: "#9CA3AF",     // Placeholders
  greenDark: "#004225",     // Botões, badges
  greenMedium: "#006837",   // Ícones
}

// Dark Mode
const dark = {
  bg: "#111916",            // Fundo principal
  card: "#1A2420",          // Cards
  cardHighlight: "#243530", // Cards destaque
  border: "#2A3F36",        // Bordas
  textPrimary: "#FFFFFF",   // Títulos
  textSecondary: "#A3B8B0", // Subtítulos
  textMuted: "#6B8178",     // Placeholders
  greenPrimary: "#2ECC71",  // Verde vibrante
}

// Status
const status = {
  success: { light: "#34C759", dark: "#2ECC71" },
  warning: { light: "#F59E0B", dark: "#F39C12" },
  error: { light: "#DC2626", dark: "#E74C3C" },
  info: { light: "#007AFF", dark: "#3498DB" },
}
```

### 3. Superfície de Card ANEST

```css
/* Padrão para todos os cards */
.anest-card {
  /* Light */
  rounded-[20px]
  bg-white
  border border-[#C8E6C9]
  shadow-[0_2px_12px_rgba(0,66,37,0.06)]
  
  /* Dark */
  dark:bg-[#1A2420]
  dark:border-[#2A3F36]
  dark:shadow-none
}

/* Card highlight */
.anest-card-highlight {
  bg-[#D4EDDA] border-[#C8E6C9]
  dark:bg-[#243530] dark:border-[#2A3F36]
}
```

### 4. Tipografia

```javascript
const typography = {
  h1: "text-[20px] font-bold",      // Títulos principais
  h2: "text-[18px] font-bold",      // Seções
  h3: "text-[16px] font-semibold",  // Cards
  body: "text-[15px] font-medium",  // Texto normal
  small: "text-[13px] font-medium", // Captions
  tiny: "text-[11px] font-semibold", // Badges
}
```

### 5. Espaçamentos

```javascript
const spacing = {
  card: "p-4 md:p-5",        // Padding de cards
  section: "mb-8 md:mb-12",  // Gap entre seções
  items: "gap-4",            // Gap entre items
  inner: "space-y-3",        // Stack vertical interno
}
```

### 6. Touch Targets (OBRIGATÓRIO)

```javascript
// MÍNIMO 44x44px para elementos clicáveis
const touchTargets = {
  button: "min-h-[44px]",
  icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
  input: "min-h-[44px]",
  listItem: "min-h-[44px]",
}
```

### 7. Animações Framer Motion

```javascript
const animations = {
  fadeIn: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
  },
  scalePress: {
    whileTap: { scale: 0.97 },
    transition: { type: "spring", stiffness: 400, damping: 17 },
  },
  slideIn: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
    transition: { type: "spring", damping: 25, stiffness: 200 },
  },
}
```

### 8. Acessibilidade (A11Y)

```jsx
// Sempre incluir:
<button
  role="button"
  aria-label="Descrição da ação"
  aria-expanded={isOpen}
  aria-disabled={disabled}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(e)
    }
  }}
>

// Focus visible
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] focus-visible:ring-offset-2"

// Screen reader only
<span className="sr-only">Texto para leitores de tela</span>
```

---

## 🔧 TEMPLATE PARA SOLICITAÇÃO DE AJUSTE

```markdown
## Componente: [NomeDoComponente]

### Arquivo(s):
- `web/src/design-system/components/ui/[nome].jsx`

### O que alterar:
1. [Descrição clara da alteração 1]
2. [Descrição clara da alteração 2]

### Manter inalterado:
- [ ] Dimensões (padding, minH, tamanhos)
- [ ] Cores do Design System ANEST
- [ ] API pública (props existentes)
- [ ] Comportamento responsivo
- [ ] Acessibilidade (ARIA)

### Referência visual:
- [Link ou descrição de como deve ficar]
- Inspiração: [Stripe/Linear/Vercel/shadcn/Material/etc]

### Verificações após alteração:
- [ ] Funciona em Light Mode
- [ ] Funciona em Dark Mode
- [ ] Touch targets >= 44px
- [ ] Sem erros no console
- [ ] Showcase atualizado (se necessário)
```

---

## 📦 COMPONENTES DO DESIGN SYSTEM

### UI Primitivos (`/ui`)
| Componente | Descrição | Showcase |
|------------|-----------|----------|
| Button | Botões com variantes | ComponentShowcase |
| Card | Container base | ComponentShowcase |
| Badge | Labels coloridos | ComponentShowcase |
| Input | Campos de texto | FormShowcase |
| Select | Dropdowns | FormShowcase |
| Checkbox/Radio | Seleções | FormShowcase |
| Switch | Toggle on/off | FormShowcase |
| Modal | Dialogs | FeedbackShowcase |
| Toast | Notificações | FeedbackShowcase |
| Progress | Barras de progresso | FeedbackShowcase |
| Tabs | Navegação por abas | NavigationShowcase |
| Breadcrumb | Migalhas de pão | NavigationShowcase |
| Pagination | Paginação | NavigationShowcase |
| Sidebar | Menu lateral | NavigationShowcase |
| Table/DataGrid | Tabelas | DataDisplayShowcase |
| DonutChart | Gráfico rosca | DataDisplayShowcase |
| SparklineChart | Mini gráficos | DataDisplayShowcase |
| Tooltip | Dicas | UtilitiesShowcase |
| Accordion | Expansível | UtilitiesShowcase |

### ANEST Específicos (`/anest`)
| Componente | Descrição |
|------------|-----------|
| Header | Cabeçalho do app |
| BottomNavigation | Nav inferior mobile |
| KPICard | Cards de indicadores |
| PlantaoCard | Lista de plantões |
| ComunicadoCard | Comunicados |
| CalculadoraCard | Calculadoras |
| NotificationBell | Sino de notificações |

---

## ✅ CHECKLIST DE VALIDAÇÃO

Antes de finalizar qualquer alteração:

```
□ npm run dev funciona sem erros
□ Testado em Light Mode
□ Testado em Dark Mode
□ Testado em mobile (320px)
□ Testado em tablet (768px)
□ Testado em desktop (1440px)
□ Touch targets >= 44px
□ Keyboard navigation funciona
□ Sem warnings no console
□ Props não vazam pro DOM
□ Exportado no index.js (se novo)
□ Showcase atualizado (se visual mudou)
□ CLAUDE_CONTEXT.md atualizado (se API mudou)
```

---

## 🚫 O QUE NÃO FAZER

1. **Não alterar dimensões sem solicitação explícita**
   - `min-h-*`, `p-*`, `gap-*` são definidos no DS

2. **Não mudar paleta de cores**
   - Usar sempre cores ANEST documentadas

3. **Não remover acessibilidade**
   - ARIA, keyboard nav, focus states

4. **Não quebrar API existente**
   - Props devem manter retrocompatibilidade

5. **Não adicionar dependências sem necessidade**
   - Verificar se já existe solução no projeto

6. **Não esquecer dark mode**
   - Toda alteração visual precisa de versão dark

---

## 📝 EXEMPLO DE USO

```markdown
## Ajuste no KPICard

### Arquivo:
- `web/src/design-system/components/anest/KPICard.jsx`

### O que alterar:
1. Aumentar fonte do valor de 28px para 32px
2. Adicionar animação de entrada no progresso

### Manter inalterado:
- [x] Dimensões do card
- [x] Cores ANEST
- [x] API (props existentes)
- [x] Responsividade

### Verificações:
- [x] Light/Dark mode
- [x] Mobile/Desktop
- [x] Console limpo
```

---

*Atualize este documento sempre que novos padrões forem estabelecidos.*



