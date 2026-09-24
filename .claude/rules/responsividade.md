---
paths:
  - "**/*.jsx"
  - "**/*.css"
description: Breakpoints, Tailwind classes responsivas, mobile layouts, touch targets
---

# Responsividade ANEST

## Breakpoints Tailwind
| Prefix | Min | Dispositivo |
|--------|-----|-------------|
| (none) | 0 | Mobile pequeno (iPhone SE) |
| sm: | 480px | Mobile (iPhone standard) |
| md: | 640px | Mobile grande (Pro Max) |
| lg: | 768px | Tablet (iPad Mini/Air) |
| xl: | 1024px | Desktop/Tablet (iPad Pro) |
| 2xl: | 1440px | Desktop grande |

Orientação (não é largura; o porquê de cada uma está em `tailwind.config.js`):
| Prefix | Media query | Uso |
|--------|-------------|-----|
| deitado: | `(orientation: landscape)` | tela na horizontal — celular, tablet e desktop; fonte única do modo horizontal |
| faixa: | landscape + `pointer: coarse` | toque deitado: a navegação vira faixa lateral |
| desktop: | landscape + `pointer: fine` | horizontal com mouse: a barra continua embaixo |

Arranjo por orientação é CSS, nunca JS: o `orientationchange` do iOS chega antes de a viewport virar e a
tela pula.

## Touch Targets
Mínimo 44x44px para: botões, links, ícones clicáveis, checkboxes, inputs, list items.

## Hooks Disponíveis
```jsx
const { breakpoint, isMobile, isTablet, isDesktop, isTouchDevice } = useBreakpoint();
const columns = useResponsiveValue({ xs: 1, sm: 2, md: 3, lg: 4 });
```

## Padrões de Layout Responsivo
| Componente | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| Tabs | Scroll horizontal | Visível | Visível |
| Breadcrumb | First + ... + last | Até 4 | Completo |
| Dropdown | Bottom Sheet | Dropdown | Dropdown |
| Sidebar | Drawer overlay | Collapsed | Fixed |
| Cards | 1 col | 2 cols | 3-4 cols |
| Modal | Fullscreen | Centered | Centered |
| Table | Cards/Accordion | Scroll H | Completa |

## Classes Padrão
```jsx
// Container
className="p-4 lg:p-6 xl:p-8"
// Grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
// Text
className="text-sm lg:text-base"
```

## Modal Overflow
Modal.Body: `overflow-y-auto overflow-x-hidden`. Footer prop mantém botões fora do scroll.
