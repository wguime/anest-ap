---
paths:
  - "**/*.jsx"
  - "**/*.css"
description: Paleta de cores, tipografia, espaçamentos e sombras do Design System ANEST
---

# Design Tokens ANEST

## Regra Principal
NUNCA usar hex hardcoded. SEMPRE usar tokens semânticos Tailwind (`bg-card`, `text-foreground`, `border-border`).
Para paleta completa: `src/design-system/Tokens.json`

## Cores Institucionais
- greenDarkest: #002215 (texto principal verde)
- greenDark: #004225 (botões, badges, avatars)
- greenMedium: #006837 (ícones, links)
- greenBright: #2E8B57 (destaques)
- greenLight: #9BC53D (acentos)

## Hierarquia de Superfícies (4 níveis)
| Nível | Light | Dark | Uso |
|-------|-------|------|-----|
| 0 - Page | #F0FFF4 | #111916 | Background principal |
| 1 - Container | #E8F5E9 | #1A2420 | Seções |
| 2 - Card | #FFFFFF | #1A2420 | Cards |
| 3 - Content | texto/ícones | texto/ícones | Conteúdo |

## Borders
| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| border-border | #C8E6C9 | #2A3F36 | Separadores, navbars, forms |
| border-border-strong | #A5D6A7 | #2A3F36 | Bordas de cards (DS default) |

## Status Colors
| Status | Light | Dark |
|--------|-------|------|
| success | #34C759 | #2ECC71 |
| warning | #F59E0B | #F39C12 |
| error | #DC2626 | #E74C3C |
| info | #007AFF | #3498DB |

## Ícones decorativos — mapa de token

Auditoria da Educação (13/05) achou `text-yellow-500` no troféu e `text-orange-500` no fogo:
cor crua quebra no dark e desalinha do verde institucional. O mapa que evita a recaída:

| Ícone | Token |
|---|---|
| Achievement / troféu | `text-warning` (amber-gold) |
| Streak / fogo | `text-category-orange` |
| Coração / curtir | `text-success` ou `text-category-pink` |

## Paleta de Categorias (cores não-semânticas)
Para agrupadores visuais (tipos de reunião, perfis, cards de KPI, gráficos) use tokens `category-*`.
Cada categoria expõe 3 slots: `DEFAULT` (cor forte), `-bg` (superfície soft), `-fg` (texto/ícone forte).

| Categoria | Uso típico |
|-----------|-----------|
| `category-purple` | Denúncias, role admin, eventos especiais |
| `category-blue` | Planos, role gerente, info |
| `category-cyan` | Tags cyan, role residência |
| `category-pink` | Tags pink |
| `category-indigo` | Tags indigo |
| `category-orange` | Warnings não-críticos, role visitante |
| `category-teal` | Quiz/educação, progresso |
| `category-red-bg`/`-fg` | Cards de alerta vermelhos sem ser destructive |
| `category-green-bg`/`-fg` | Cards verdes sem ser success |

### Classes Tailwind
- `bg-category-purple`, `text-category-purple`, `border-category-purple`, `bg-category-purple/20`
- `bg-category-purple-bg` (soft background pastel), `text-category-purple-fg` (texto forte)
- Mesmas variantes para blue, cyan, pink, indigo, orange, teal

### Quando NÃO usar categoria
Para status semânticos (sucesso, erro, aviso, info) use SEMPRE `success`, `warning`, `destructive`, `info`.
Categorias são apenas para diferenciação visual não-semântica.

## Charts / SVG (Recharts)
Recharts aplica `fill`/`stroke` como atributo SVG, que **não resolve** `hsl(var(--*))`.
Use hex que espelhe o token DS e documente no código:
```jsx
// Hex espelha --success / --warning / --destructive
const STATUS_HEX = { success: '#34C759', warning: '#F59E0B', error: '#DC2626' }
```
Para Tooltip/ReferenceLine do Recharts que aceitam CSS vars via `contentStyle`, prefira:
```jsx
<Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
```

## Z-Index
| Componente | Z-Index |
|-----------|---------|
| Modal Overlay | 1100 |
| Sub-modal/Dropdown | 1200 |
| Select Portal | 1300 |
| Toast | 1400 |
| Popover | 1400 |

## Border Radius
sm: 10px (badges) | md: 12px (botões) | lg: 16px (inputs) | xl: 20px (cards) | full: 50% (avatars)

## Sombras
- Light: `rgba(0,66,37, 0.08/0.1/0.15)` — sm/md/lg
- Dark: `rgba(0,0,0, 0.3/0.4/0.5)` — sm/md/lg
- Dark glow: `rgba(46, 204, 113, 0.3)`

## Tipografia
Font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif
h1/h2: 20px/700 | h3: 18px/700 | h4: 16px/700 | body: 15px/600 | small: 14px/500 | caption: 13px/500 | tiny: 11px/600

## Badges — variantes que enganam (medido 25–26/08, vale para o app inteiro)

⚠️ **`Badge variant="secondary"` é CINZA (#6B7280). O verde institucional do DS é o `default`**
(#004225 claro / #2ECC71 escuro, `src/styles/anest-theme.css`). Badge neutro-mas-visível é
`default badgeStyle="subtle"`, nunca `secondary` — foi o que deixou listas inteiras "quase
invisíveis" e o que faz `info` (#007AFF) parecer fora do padrão.

⚠️ **`Alert` NÃO tem variante `destructive` — é `error`** (`alert.jsx`: default/success/warning/
error/info). `destructive` cai calado no `default` (fundo de card) e o alerta nunca fica vermelho.
Regra geral: **`Badge` usa `destructive`, `Alert` usa `error`.**

**Contraste medido contra WCAG AA (4,5:1):**

| variante | `subtle` | `solid` |
|---|---|---|
| **default** (verde institucional) | **9,71 ✓** | **11,63 ✓** |
| warning | 1,99 ✗ | 9,78 ✓ |
| destructive | 4,13 ✗ | 4,83 ✓ |
| secondary | 4,27 ✗ | 4,83 ✓ |
| info | 3,54 ✗ | 4,02 ✗ |
| **success** | 2,04 ✗ | **2,22 ✗** |

Só o `default` passa em `subtle`, e o `success` reprova **até sólido** (#34C759 é claro demais para
texto branco). Daí: `subtle` só com `default`; status colorido sempre `solid`; e **nada usa `success`
com texto** — vira `default`, que mantém o sentido "ok" e passa com folga. Sobre cabeçalho tonal
(#D4EDDA) o `secondary` cai para 3,90 → usar `default` outline (9,37). ⚠️ Os tokens NÃO foram
mexidos (alcançariam o app inteiro): a correção é **por uso**. `BalancoHidricoTransopDisplay` e
`SofaDisplay` ainda usam `success` com texto — pendente de decisão do dono (Regra #2).

⚠️ Ao medir contraste de badge renderizado, compor o alfa sobre o primeiro ancestral OPACO —
senão o rgba é comparado com ele mesmo e a razão dá 1.

**Cabeçalho em tom de destaque:** `bg-accent dark:bg-card dark:border dark:border-border` — a receita
do `EscalaCirurgicaHomeCard`, padrão do app para cartão que se destaca sem virar alerta. No escuro o
`accent` (#212D28) fica quase igual ao `card`, por isso lá o destaque vem da BORDA.

⚠️ **`toFixed()` devolve PONTO decimal e não separa milhar** — dois separadores na mesma tela fazem
duvidar da conta. Use **`numeroBr` de `src/lib/numeroBr.js`**, helper único desde 31/08/2026:
`numeroBr(12.75, 2)` → "12,75", `numeroBr(4900)` → "4.900", `numeroBr(null)` → "—". `toFixed` em
texto de tela é regressão.
