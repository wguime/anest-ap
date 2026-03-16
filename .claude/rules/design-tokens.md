---
globs: ["**/*.jsx", "**/*.css"]
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
