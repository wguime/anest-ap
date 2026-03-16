---
globs: ["**/*.jsx", "**/*.js"]
description: Padrões de código ANEST — estrutura de componente, Header com createPortal, animações, A11y
---

# Padrões de Código ANEST

## Estrutura de Componente
```jsx
import { useTheme } from '@/design-system/hooks';
import { cn } from '@/lib/utils';

export function MeuComponente({ prop1, prop2, className }) {
  const { isDark } = useTheme();

  return (
    <div className={cn("base-classes", isDark && "dark-classes", className)}>
      {/* conteúdo */}
    </div>
  );
}
```

## Header Fixo via createPortal
Cada página renderiza seu Header no container fixo do App via `createPortal`.
Seguir padrão de qualquer página existente.

## Animações Framer Motion
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
>
```
SEMPRE respeitar `prefers-reduced-motion`.

## Acessibilidade (WCAG 2.1 AA)
- aria-labels em ícones e botões sem texto
- Focus management em modais (trap focus)
- Screen reader support (sr-only labels)
- Contraste mínimo 4.5:1

## Select em Modais
Portal com z-index 1300 (acima do modal 1100). Click outside deve checar tanto containerRef quanto dropdownRef (portal).

## Fragment Bug
FormField passa props aos children → usar `<div>` wrapper, NUNCA `<>` (Fragment).

## FileUpload
Usar prop `onChange` (NÃO `onFileSelect`). `value` ativa FilePreview built-in.

## Variantes
Usar CVA (class-variance-authority) para definir variantes de componentes.

## Padrão Canônico
Para estrutura completa: `src/design-system/showcase/ComponentShowcase.jsx`
