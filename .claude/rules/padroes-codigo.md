---
paths:
  - "**/*.jsx"
  - "**/*.js"
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

## Limites do DS descobertos em uso (valem para o app inteiro)

⚠️ **`TabsContent` DESMONTA o painel inativo — estado local dentro de uma aba MORRE na troca.**
Já apagou, em silêncio, dados de paciente digitados (ClCr, RNI, fatores de risco marcados). Correção:
subir o estado para o componente RAIZ, que não desmonta. Estado de "folha aberta" fica de fora de
propósito — painel aberto não deve sobreviver a troca de aba.

⚠️ **`POSITION_CLASSES.bottom` fixa `h-[85vh]`, não `max-h`**: todo bottom-sheet nasce com 85% da
tela mesmo quase vazio ("a tela fica quase vazia"). Passar `!h-auto max-h-[88vh]` no sheet. O default
do DS NÃO foi mexido — alterá-lo alcança todos os sheets do app (Regra #2).

⚠️ **O dropdown do `Select` herda a largura do gatilho** (`select.jsx`,
`width = Math.min(triggerWidth, …)`). Gatilho estreito + lista longa = popover espremido. Onde a
lista é longa, usar folha própria em vez de insistir no Select.

⚠️ **`DatePicker` abre o popup como `absolute z-50` sem portal** (`date-picker.jsx:434`) e
`AccordionContent`/`CollapsibleContent` animam altura com `overflow-hidden` → **calendário dentro de
sanfona sai cortado no meio do mês**. Onde precisar dos dois, usar `Sheet`.

⚠️ **`TabsList` traz `w-full`**: largura fixa em 100% do pai ignora margem negativa (a barra fica mais
estreita que os cards e deslocada). Com margem negativa, passar `w-auto` junto. E `flex` respeita o
`min-width:auto` de cada rótulo (larguras desiguais): `grid grid-cols-N` iguala, mas aí o `px-3` do
gatilho não cabe — usar `px-1`.

⚠️ **`Alert` põe o ícone numa coluna à esquerda, centrado na vertical**: em alerta longo ele flutua no
meio e rouba ~24px de largura de TODAS as linhas. Ícone dentro do `title` + colapsar a coluna resolve.
E o `Alert` tem **`border-l-4`** (`alert.jsx:9`) — anular LOCALMENTE com `border-l` na className
(tailwind-merge resolve a favor da última); mexer no `alert.jsx` alcança todos os alertas do app.

⚠️ **`AccordionTrigger` pinta `dark:group-data-[state=open]:bg-card`**: neutralizar SÓ a variante clara
parte o cabeçalho em duas cores no escuro. Neutralizar as duas.

⚠️ **Badge é `whitespace-nowrap` e não encolhe** — texto longo dentro dele empurra o resto da linha
para fora. Quando o rótulo pode crescer, encurtar a string em vez de confiar no wrap.

⚠️ **`input type="date"` escreve no formato do SISTEMA e NÃO encolhe.** No iPhone em pt-BR isso é
"2 de set. de 2026" (~135px), contra "02/09/2026" do Chrome — e a largura intrínseca do widget
empurra o item de grid/flex, que nasce com `min-width:auto`: a caixa vaza por baixo da vizinha.
Onde houver campo de data: colunas fluidas (`grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`, que
empilha no celular e volta a dividir a linha onde sobra largura) **e `min-w-0` nos dois níveis** —
no item e no `[data-slot=input-control]` do DS (`[&_[data-slot=input-control]]:min-w-0`). Medir com
`locale: 'pt-BR'` no projeto `mobile` (WebKit); para o pior caso, inflar a fonte do input no teste,
porque o browser headless escreve o formato curto.

⚠️ **`Modal` DS usa props `title`/`description`/`footer`** — não existem `ModalHeader`/`Content`/`Footer`.
