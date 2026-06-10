---
globs: ["src/App.jsx", "src/pages/**"]
description: Padrões de navegação React. KEY prop, goBack, scroll to top, PAGE_TO_CARD
---

# Navegação ANEST

## Sistema de Navegação (F2 Etapa A — 2026-06-10)
Switch-based em App.jsx (142 cases no renderAppPage()) **com URL como fonte de
verdade** via react-router v7 declarative mode (`BrowserRouter` em main.jsx).
Cada case renderiza um componente com `key={pageName}` e `onNavigate` prop —
a interface `onNavigate(page, params)` das páginas NÃO mudou.

- URL flat kebab-case: `/centro-gestao`, `/documento-detalhe` (home = `/`)
- Mapa página ↔ slug: `src/navigation/pageSlugs.js` (única fonte; teste de
  drift em `src/__tests__/navigation/pageSlugs.test.js` quebra se um case
  novo do switch não estiver na lista PAGES)
- `handleNavigate` só faz bookkeeping + `navigate(pageToPath(page), { state: { pageParams } })`;
  o effect de `location` em App.jsx aplica currentPage/pageParams/activeNav/scroll
  (cobre back/forward do browser). NUNCA setar currentPage direto em handler novo.
- params viajam em `location.state.pageParams` — sobrevivem a refresh, mas
  não a "abrir em nova aba": toda página deve tolerar params null
- Slug desconhecido → redirect `/` (replace)
- Página nova: adicionar case no switch + entrada em PAGES (pageSlugs.js) +
  PAGE_TO_CARD se exigir permissão (ou justificar no allowlist do teste de guard)

## KEY Prop + Lazy State Initialization (CRÍTICO)
useState ignora mudanças de props após mount. Solução: usar `key` prop para forçar remount.
```jsx
// App.jsx
case 'minha-pagina':
  return <MinhaPagina key="minha-pagina" {...props} />;

// Dentro do componente - lazy initializer
const [data, setData] = useState(() => props.initialData || defaultValue);
```

## Sistema goBack()
Delegado ao history real do browser: `goBack()` chama `navigate(-1)` e o
effect de location restaura página/params. O `navigationHistory` (shadow
stack) existe só para habilitar swipe-back e o fallback para home quando
não há histórico in-app (deep-link direto). `fromParamsOverride` (3º arg de
onNavigate) é gravado via `navigate(..., { replace: true })` na entrada
atual do history antes de navegar — back restaura a página de origem com
esse estado.

## Scroll to Top
Toda navegação deve resetar scroll:
```jsx
useEffect(() => {
  window.scrollTo(0, 0);
}, []);
```

## PAGE_TO_CARD Mapping
Mapa de página → card de permissão. Usado para verificar acesso.
```jsx
const PAGE_TO_CARD = {
  'calculadoras': 'calculadoras',
  'escalas': 'escalas',
  'qualidade': 'qualidade',
  // ... 38+ entries
};
```
Se página precisa de permissão, DEVE ter entrada no PAGE_TO_CARD.

## Navegação com Props
```jsx
onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'biblioteca' });
```

## Deep-link Público
`/verificar/:uuid` — Verificação de certificados (sem auth).

## User null check
ProfilePage e páginas que acessam user: SEMPRE verificar `if (!user) return null;`

## Header Fixo
Cada página implementa Header via createPortal para o container fixo do App.
Seguir padrão existente em qualquer página.
