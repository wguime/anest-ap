---
globs: ["**/*.jsx", "**/*.css"]
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

## Orientação — o app é RETRATO e NÃO GIRA (dono 25/08)
Nada gira, exceto o conteúdo que nasce deitado: **documento (PDF/anexo Office),
vídeo e imagem em tela cheia**. E **sem aviso**: o dono recusou a mensagem "Gire
seu dispositivo" — a tela simplesmente não gira.

⚠️ **Não existe API que trave a rotação no iPhone** (`screen.orientation.lock` só
vale no Android com o app instalado; o `orientation: portrait` do manifest o iOS
ignora). Por isso a trava tem duas camadas, em `src/lib/orientacaoTela.js`:
1. **lock nativo** — resolve sozinho no Android/PWA. ⚠️ liberar é `lock('any')`,
   **nunca `unlock()`**, que devolve à orientação padrão do manifest (portrait).
2. **compensação por CSS** — o que segura o iPhone: com o celular deitado o
   `<body>` é girado de volta por `-angle` (`screen.orientation.angle`), e o app
   continua **em pé em relação ao aparelho**, como um app que não suporta
   paisagem. Classes `rotacao-compensada` + `rot-cw`/`rot-ccw` no `<html>`.

Exceção: `useLandscapePermitido()` (`src/hooks/useLandscapePermitido.js`), pedida
e devolvida ao desmontar — **contador**, não booleano, porque PDF dentro de modal
sobre página com vídeo devolveria a trava cedo demais. Já pedem: `PDFViewer` e
`VideoPlayer` do DS, `PDFEmbed`, `AulaPlayerPage`, `ExpandedImageModal` e o anexo
Office do comunicado. Prévia embutida em formulário de ADMIN fica de fora de
propósito — a tela ali é de edição, e o fullscreen do iframe já resolve.

**Três consequências do transform, todas de propósito:**
- É o **`<body>`**, não o `#root`: TODO portal do DS (modal, sheet, select,
  dropdown, toast, PDF em tela cheia) monta em `document.body` — girar o `#root`
  deixaria essas camadas deitadas por cima do app em pé.
- O `<body>` vira o containing block dos `position: fixed` (é o que mantém header
  e BottomNav certos na tela virtual) **e o elemento que ROLA**: `window.scrollTo`
  não alcança mais o conteúdo, daí `rolarAoTopo()` em `src/utils/rolarAoTopo.js`
  em toda navegação. Listener de scroll no `window` fica inerte nesse modo —
  degradação aceita, o modo é transitório.
- ⚠️ **as unidades de viewport não sabem da rotação**: `vh` segue medindo a tela
  física deitada. Sem traduzir, a página se espreme numa faixa (foi o que houve
  com o `w-screen h-[100dvh]` do login). Na tela virtual a ALTURA é `100vw` e a
  LARGURA é `100vh`; as ~22 traduções em `index.css` são **geradas do código** e
  travadas por `src/__tests__/estilo/unidadesViewportRotacao.test.js` — classe de
  viewport nova sem tradução FALHA o teste, senão a lista envelhece calada.

O recorte `max-height: 500px` separa CELULAR deitado de tablet/desktop: em iPad e
notebook paisagem é o uso normal e não se compensa nada. Rotas públicas
`/verificar/*` ficam fora (`TravaOrientacao` fica no ramo do app em `main.jsx`,
acima do portão de auth — login e boot também são o app).

Travas: `src/__tests__/lib/orientacaoTela.test.js` (invariante: ângulo→sentido,
contador aninhado, tablet fora) · a trava de drift acima · o describe de rotação
em `src/__tests__/design-system/video-player.test.jsx` (a LIGAÇÃO — o que se
perde num refactor é o componente esquecer de pedir).
