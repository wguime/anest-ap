# 🚀 ANEST - Prompts Prontos para Claude Code

> Cole estes prompts no Claude Code (terminal) para executar cada fase.
> Sempre execute na ordem indicada.

---

## 📋 PROMPT INICIAL (Use sempre ao iniciar sessão)

```
Leia o arquivo CLAUDE_CONTEXT.md na raiz do projeto web/ para entender o contexto completo.

Após ler, me informe:
1. Qual fase está em andamento
2. O que foi completado
3. O que precisa ser feito

Aguarde minha confirmação antes de implementar.
```

---

## FASE 5.8 - COMPONENTES ANEST ESPECÍFICOS

### Prompt Completo

```
FASE 5.8 - COMPONENTES ANEST ESPECÍFICOS

⚠️ INSTRUÇÕES OBRIGATÓRIAS:

1. ANTES DE CADA COMPONENTE, pesquise:
   - Use context7 MCP: "react [nome do componente] best practices"
   - Use shadcn MCP: verificar se há componente similar
   - Pesquise: site:ui.shadcn.com [padrão relacionado]

2. LEIA OS ARQUIVOS DE REFERÊNCIA:
   - /mnt/project/design.json
   - /mnt/project/AnestHomeFinalPreview.jsx
   - /mnt/project/AnestHomeDark.jsx
   - src/design-system/Tokens.json

3. SIGA OS PADRÕES JÁ ESTABELECIDOS:
   - Olhe src/design-system/components/ui/card.jsx como referência
   - Use CVA para variantes
   - Use Framer Motion para animações
   - Suporte Light e Dark mode

========================================
COMPONENTE 5.8.1 - PlantaoCard
========================================

Arquivo: src/design-system/components/anest/PlantaoCard.jsx

Props:
- hospital: string (nome do hospital)
- data: string (ex: "Segunda, 16 Dez")
- hora: string (ex: "07:00")
- status?: 'confirmado' | 'pendente' | 'cancelado' (default: 'confirmado')
- color?: string (cor de fundo, ex: "#B8E0C8")
- onClick?: () => void
- className?: string

Specs visuais (extrair de AnestHomeFinalPreview.jsx):
- Card com borderRadius: 20px
- Ícone de calendário à esquerda (48x48, borderRadius 12px)
- Título: nome do hospital (15px, fontWeight 600)
- Subtítulo: data (13px, cor muted)
- Hora à direita (15px, fontWeight 700, cor greenLight)
- Padding: 14px vertical

Estados:
- Default: como descrito
- Hover: sombra mais intensa
- Pressed: scale(0.98)
- Status pendente: ícone amarelo
- Status cancelado: ícone vermelho, texto riscado

========================================
COMPONENTE 5.8.2 - FeriasCard
========================================

Arquivo: src/design-system/components/anest/FeriasCard.jsx

Props:
- nome: string (nome do médico)
- tipo?: 'férias' | 'licença' (default: 'férias')
- inicio: string (ex: "20/12")
- fim: string (ex: "05/01")
- avatar?: string (iniciais ou URL de imagem)
- className?: string

Specs visuais:
- Layout similar ao ListItem
- Avatar com iniciais (48x48)
- Nome: 15px, fontWeight 600
- Período: 13px, cor muted
- Ícone diferente para férias vs licença

========================================
COMPONENTE 5.8.3 - ComunicadoCard
========================================

Arquivo: src/design-system/components/anest/ComunicadoCard.jsx

Props:
- titulo: string
- resumo?: string
- data: string
- isNew?: boolean (mostra badge "Novo")
- prioridade?: 'normal' | 'alta' | 'urgente' (default: 'normal')
- hasAttachment?: boolean
- onClick?: () => void
- className?: string

Specs visuais (extrair de AnestHomeFinalPreview.jsx):
- Card com background cardLight (#D4EDDA) em light mode
- Badge "X novos" no canto superior direito
- Bullets verdes para itens
- Link "Ver todos" com seta

========================================
COMPONENTE 5.8.4 - BottomNavigation
========================================

Arquivo: src/design-system/components/anest/BottomNavigation.jsx

Props:
- items: Array<{ icon: LucideIcon, label: string, href?: string, onClick?: () => void }>
- activeIndex: number
- onChange?: (index: number) => void
- className?: string

Specs visuais:
- Position: fixed, bottom: 0
- Background: branco (light) / #1A2420 (dark)
- Border-top: 1px solid border color
- Padding: 16px 40px 36px (safe area bottom)
- 4 ícones espaçados igualmente
- Ícone ativo: preenchido, cor verde
- Ícone inativo: outline, cor muted
- Tamanho ícone: 28x28

RESPONSIVIDADE:
- Safe area bottom para iOS
- Esconder em desktop (> 1024px) - usar sidebar instead

========================================
COMPONENTE 5.8.5 - NotificationBell
========================================

Arquivo: src/design-system/components/anest/NotificationBell.jsx

Props:
- count?: number (número de notificações)
- hasUrgent?: boolean (indica se há urgente)
- onClick?: () => void
- size?: 'sm' | 'md' | 'lg' (default: 'md')
- className?: string

Specs visuais:
- Container circular: 44x44 (md)
- Background: branco (light) / bgCard (dark)
- Ícone Bell: 22x22
- Badge: position absolute, top -4px, right -4px
- Badge: minWidth 22px, height 22px, borderRadius full
- Badge: background vermelho, texto branco, fontSize 12px
- Se hasUrgent: badge pulsa

Animação:
- Badge aparece com scale animation
- Se count muda: shake no sino

========================================
COMPONENTE 5.8.6 - ROPProgressCard
========================================

Arquivo: src/design-system/components/anest/ROPProgressCard.jsx

Props:
- area: string (nome da área)
- progresso: number (0-100)
- questoesRespondidas: number
- totalQuestoes: number
- ultimaAtividade?: string
- icon?: LucideIcon
- onClick?: () => void
- className?: string

Specs visuais:
- Card com gradiente baseado na área
- Ícone da área no topo
- Título da área
- Barra de progresso (componente Progress)
- Texto "X de Y questões"
- Última atividade em texto muted

========================================
COMPONENTE 5.8.7 - KPICard
========================================

Arquivo: src/design-system/components/anest/KPICard.jsx

Props:
- titulo: string
- valor: number
- meta: number
- unidade?: string (ex: "%", "dias", "min")
- tendencia?: 'up' | 'down' | 'stable'
- periodo?: string
- onClick?: () => void
- className?: string

Specs visuais:
- Card com valor grande e destacado
- Indicador de tendência (seta up/down)
- Barra de progresso mostrando valor vs meta
- Cor baseada em performance (verde se atingiu, amarelo se perto, vermelho se longe)
- Meta exibida como referência

========================================
COMPONENTE 5.8.8 - CalculadoraCard
========================================

Arquivo: src/design-system/components/anest/CalculadoraCard.jsx

Props:
- nome: string
- descricao?: string
- icon?: LucideIcon
- categoria?: string
- isFavorite?: boolean
- onClick?: () => void
- className?: string

Specs visuais:
- Card quadrado ou retangular
- Ícone grande centralizado (ou no topo)
- Nome abaixo
- Descrição em texto menor
- Categoria como badge pequeno
- Estrela de favorito no canto

========================================
TAREFA 5.8.9 - ATUALIZAR EXPORTS
========================================

Arquivo: src/design-system/components/anest/index.js

Exportar todos os componentes:
- PlantaoCard
- FeriasCard
- ComunicadoCard
- BottomNavigation
- NotificationBell
- ROPProgressCard
- KPICard
- CalculadoraCard

Atualizar src/design-system/index.js para incluir os exports.

========================================
TAREFA 5.8.10 - CRIAR SHOWCASE
========================================

Arquivo: src/design-system/showcase/AnestShowcase.jsx

Seções:
1. PlantaoCard - diferentes status e cores
2. FeriasCard - férias e licença
3. ComunicadoCard - com e sem badge, prioridades
4. BottomNavigation - demo interativo
5. NotificationBell - diferentes counts
6. ROPProgressCard - diferentes progressos
7. KPICard - atingiu meta, não atingiu, tendências
8. CalculadoraCard - grid de calculadoras

Adicionar ao ShowcaseIndex como "🏥 ANEST".

========================================
ORDEM DE EXECUÇÃO
========================================

1. PlantaoCard - Confirme conclusão
2. FeriasCard - Confirme conclusão
3. ComunicadoCard - Confirme conclusão
4. BottomNavigation - Confirme conclusão
5. NotificationBell - Confirme conclusão
6. ROPProgressCard - Confirme conclusão
7. KPICard - Confirme conclusão
8. CalculadoraCard - Confirme conclusão
9. Exports - Confirme conclusão
10. AnestShowcase - Confirme conclusão

========================================
VALIDAÇÃO OBRIGATÓRIA
========================================

Após cada componente:
□ Light Mode funcionando
□ Dark Mode funcionando
□ Mobile (< 768px) - layout correto
□ Desktop (≥ 1024px) - layout correto
□ Touch targets >= 44px
□ Animações suaves
□ Sem erros no console

========================================
REFERÊNCIAS VISUAIS
========================================

Extraia os estilos EXATOS de:
- /mnt/project/AnestHomeFinalPreview.jsx (Light Mode)
- /mnt/project/AnestHomeDark.jsx (Dark Mode)

Os componentes devem ser IDÊNTICOS visualmente aos mockups.
```

---

## FASE 6 - DATA DISPLAY

### Prompt Completo

```
FASE 6 - COMPONENTES DE DATA DISPLAY

⚠️ INSTRUÇÕES OBRIGATÓRIAS:

1. PESQUISE ANTES:
   - Use context7: "react table sortable accessible"
   - Use context7: "react calendar component"
   - Use shadcn MCP: Table, Calendar
   - Pesquise: site:tanstack.com table (TanStack Table)

2. RESPONSIVIDADE:
   - Tables: scroll horizontal em mobile, ou card view
   - Calendar: compacto em mobile
   - Charts: redimensionar automaticamente

========================================
COMPONENTE 6.1 - Table
========================================

Arquivo: src/design-system/components/ui/table.jsx

Subcomponentes:
- Table (container)
- TableHeader
- TableBody
- TableFooter
- TableRow
- TableHead (th)
- TableCell (td)
- TableCaption

Props Table:
- data?: any[] (dados para renderizar)
- columns?: Column[] (definição de colunas)
- sortable?: boolean
- filterable?: boolean
- paginated?: boolean
- pageSize?: number
- onRowClick?: (row) => void
- className?: string

MOBILE:
- Scroll horizontal com indicador
- Ou: transformar em cards empilhados

========================================
COMPONENTE 6.2 - DataGrid
========================================

Arquivo: src/design-system/components/ui/data-grid.jsx

Similar ao Table mas para grandes volumes de dados:
- Virtualização (react-virtual ou similar)
- Colunas redimensionáveis
- Ordenação múltipla
- Filtros por coluna
- Seleção de linhas

========================================
COMPONENTE 6.3 - Calendar
========================================

Arquivo: src/design-system/components/ui/calendar.jsx

Props:
- value?: Date | Date[]
- onChange?: (date: Date | Date[]) => void
- mode?: 'single' | 'multiple' | 'range'
- minDate?: Date
- maxDate?: Date
- disabledDates?: Date[]
- locale?: string (default: 'pt-BR')
- className?: string

Specs:
- Navegação mês/ano
- Destaque de hoje
- Destaque de selecionados
- Dias desabilitados com estilo diferente

========================================
COMPONENTE 6.4 - Timeline
========================================

Arquivo: src/design-system/components/ui/timeline.jsx

Props:
- items: Array<{ date: Date, title: string, description?: string, icon?: LucideIcon, status?: string }>
- orientation?: 'vertical' | 'horizontal' (default: 'vertical')
- className?: string

Specs:
- Linha conectando os pontos
- Círculos nos eventos
- Alternância esquerda/direita em desktop

========================================
COMPONENTE 6.5 - Chart Wrappers
========================================

Usar Chart.js com wrappers React:

Arquivos:
- src/design-system/components/ui/charts/LineChart.jsx
- src/design-system/components/ui/charts/BarChart.jsx
- src/design-system/components/ui/charts/PieChart.jsx
- src/design-system/components/ui/charts/DoughnutChart.jsx

Props comuns:
- data: ChartData
- options?: ChartOptions
- height?: number
- responsive?: boolean (default: true)
- className?: string

Tema:
- Cores do design system
- Tooltips estilizados
- Legends customizadas

========================================
COMPONENTE 6.6 - StatCard
========================================

Arquivo: src/design-system/components/ui/stat-card.jsx

Props:
- label: string
- value: string | number
- change?: number (percentual de mudança)
- changeType?: 'increase' | 'decrease'
- icon?: LucideIcon
- trend?: 'up' | 'down' | 'stable'
- className?: string

Specs:
- Valor grande e destacado
- Label menor acima ou abaixo
- Indicador de mudança com cor (verde positivo, vermelho negativo)
- Ícone opcional

========================================
SHOWCASE
========================================

Criar: src/design-system/showcase/DataDisplayShowcase.jsx

Seções:
1. Table - simples e com features
2. DataGrid - demo com muitos dados
3. Calendar - single, range, multiple
4. Timeline - vertical e horizontal
5. Charts - Line, Bar, Pie
6. StatCard - variações

Adicionar ao ShowcaseIndex como "📊 Data Display".
```

---

## FASE 7 - UTILITÁRIOS

### Prompt Completo

```
FASE 7 - COMPONENTES UTILITÁRIOS

⚠️ PESQUISE ANTES:
- Use shadcn MCP para: Tooltip, Popover, Accordion, Collapsible, ScrollArea
- Use context7: "react tooltip accessible"
- Use context7: "react accordion aria"

========================================
COMPONENTES A CRIAR
========================================

7.1 Tooltip
- Trigger: hover ou focus
- Posições: top, right, bottom, left
- Delay configurável
- Seta apontando para trigger

7.2 Popover
- Similar ao Tooltip mas com conteúdo rico
- Pode ter formulários, botões, etc.
- Click to open/close
- Focus trap quando aberto

7.3 Accordion
- Single ou multiple open
- Animated expand/collapse
- Ícone de chevron rotaciona
- Keyboard navigation

7.4 Collapsible
- Versão simples do Accordion
- Único item
- Controlled ou uncontrolled

7.5 ScrollArea
- Scrollbar customizada
- Funciona igual em todos browsers
- Suporte a touch

7.6 Separator
- Horizontal ou vertical
- Com ou sem texto no meio
- Decorativo (aria-hidden)

7.7 AspectRatio
- Mantém proporção (16:9, 4:3, 1:1, etc.)
- Para imagens e vídeos

========================================
SHOWCASE
========================================

Criar: src/design-system/showcase/UtilityShowcase.jsx

Adicionar ao ShowcaseIndex como "🔧 Utilitários".
```

---

## FASE 8 - INTEGRAÇÃO FIREBASE

### Prompt Completo

```
FASE 8 - INTEGRAÇÃO FIREBASE

⚠️ PESQUISE ANTES:
- Use context7: "firebase react hooks"
- Use context7: "firebase v9 modular"
- Pesquise: react-firebase-hooks

========================================
HOOKS A CRIAR
========================================

8.1 useAuth
- Login/logout/register
- Estado de autenticação
- Dados do usuário

8.2 useFirestore
- CRUD operations
- Real-time listeners
- Queries

8.3 useStorage
- Upload de arquivos
- Download URLs
- Progress tracking

8.4 AuthProvider
- Context para auth state
- Protected routes

========================================
ESTRUTURA
========================================

src/
├── services/
│   ├── firebase/
│   │   ├── config.js
│   │   ├── auth.js
│   │   ├── firestore.js
│   │   └── storage.js
│   └── index.js
├── hooks/
│   ├── useAuth.jsx
│   ├── useFirestore.jsx
│   └── useStorage.jsx
└── contexts/
    └── AuthContext.jsx
```

---

## FASE 9 - PÁGINAS DO APP

### Prompt Completo

```
FASE 9 - PÁGINAS DO APP ANEST

⚠️ IMPORTANTE:
- Usar APENAS componentes do Design System
- Seguir layout de /mnt/project/AnestHomeFinalPreview.jsx
- Responsivo obrigatório

========================================
PÁGINAS A CRIAR
========================================

9.1 LoginPage
- Split screen (form + arte)
- Tabs login/cadastro
- Login com Google
- Validação de formulário

9.2 HomePage
- Header com saudação
- SearchBar
- Card de Comunicados
- Atalhos Rápidos
- Plantões
- Férias

9.3 QualidadePage
- Grid de widgets
- Incidentes
- Auditorias
- ROPs
- KPIs

9.4 CalculadorasPage
- Grid de CalculadoraCard
- Busca
- Categorias

9.5 DocumentosPage
- Biblioteca
- Filtros
- PDF viewer

9.6 PerfilPage
- Avatar editável
- Dados do usuário
- Configurações
- Logout

========================================
ESTRUTURA
========================================

src/
├── pages/
│   ├── LoginPage.jsx
│   ├── HomePage.jsx
│   ├── QualidadePage.jsx
│   ├── CalculadorasPage.jsx
│   ├── DocumentosPage.jsx
│   ├── PerfilPage.jsx
│   └── index.js
└── App.jsx (router)
```

---

## FASE 10 - TESTES E DEPLOY

### Prompt Completo

```
FASE 10 - TESTES E DEPLOY

========================================
TESTES
========================================

10.1 Configurar Vitest
- Testes unitários para hooks
- Testes de componentes com Testing Library

10.2 Configurar Playwright
- Testes E2E
- Testes visuais (screenshots)

========================================
PWA
========================================

10.3 Configurar PWA
- manifest.json
- Service Worker
- Icons para iOS e Android
- Splash screens

========================================
DEPLOY
========================================

10.4 Configurar Deploy
- Firebase Hosting ou Vercel
- CI/CD com GitHub Actions
- Environment variables

========================================
OTIMIZAÇÃO
========================================

10.5 Performance
- Lazy loading de páginas
- Code splitting
- Image optimization
- Bundle analysis
```

---

## 🆘 COMANDOS ÚTEIS

```bash
# Verificar status
git status

# Iniciar dev
npm run dev

# Build
npm run build

# Lint
npm run lint

# Testar
npm test

# Atualizar CLAUDE_CONTEXT.md após completar fase
# (manualmente ou pedir para Claude fazer)
```

---

## ⚠️ LEMBRETES IMPORTANTES

1. **Sempre pesquise antes** - MCPs e web search
2. **Sempre teste Light e Dark mode**
3. **Sempre teste Mobile e Desktop**
4. **Touch targets mínimo 44px**
5. **Atualize CLAUDE_CONTEXT.md após cada fase**
6. **Commite frequentemente**

---

*Use estes prompts para manter consistência entre sessões do Claude Code.*
