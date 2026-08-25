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

## Orientação — o app é RETRATO (dono 25/08)
Nada gira, exceto o conteúdo que nasce deitado: **documento (PDF/anexo Office),
vídeo e imagem em tela cheia**. Girar o resto não melhora nada — o app é
desenhado a 375px — e vira layout esticado no meio do turno.

Fonte única: `src/lib/orientacaoTela.js`. Quem precisa da exceção chama
`useLandscapePermitido()` (`src/hooks/useLandscapePermitido.js`) e a devolve ao
desmontar; é **contador**, não booleano, porque PDF dentro de modal sobre página
com vídeo devolveria a trava cedo demais. Já pedem: `PDFViewer` (DS),
`VideoPlayer` (DS), `PDFEmbed`, `AulaPlayerPage`, `ExpandedImageModal` e o anexo
Office do comunicado. Prévia de conteúdo em formulário de ADMIN fica de fora de
propósito — a tela ali é de edição, não de leitura (e o fullscreen do iframe
continua funcionando).

Duas camadas, porque nenhuma cobre todos os aparelhos:
- `screen.orientation.lock()` — trava de verdade só no Android/PWA instalado.
  ⚠️ liberar é `lock('any')`, **nunca `unlock()`**: `unlock()` devolve à
  orientação padrão, que o `manifest.json` fixa em `portrait`.
- classe `landscape-liberado` no `<html>` + overlay "Gire seu dispositivo"
  (`.landscape-block-overlay`, `index.css` + `src/components/LandscapeBlockOverlay.jsx`,
  montado em `main.jsx` ACIMA do portão de auth — login também é o app). É o que
  segura o iPhone, onde o lock não existe na prática.

O recorte `max-height: 500px` separa CELULAR deitado de tablet/desktop: em iPad
e notebook paisagem é o uso normal e não se bloqueia. Rotas públicas
`/verificar/*` ficam fora.

⚠️ Dois defeitos de CSS que nasceram aqui e valem para o app inteiro: os tokens
guardam só o triplo HSL (`background: var(--background)` é valor inválido e a
declaração CAI — o overlay ficava transparente), e numa LISTA de seletores um
seletor que o browser não conhece invalida a lista inteira (agrupar
`:fullscreen` com `:-webkit-full-screen` derruba as duas onde só uma existe).

Travas: `src/__tests__/lib/orientacaoTela.test.js` (invariante do contador) +
o describe de rotação em `src/__tests__/design-system/video-player.test.jsx`
(a LIGAÇÃO — o componente esquecer de pedir é o que se perde num refactor).
