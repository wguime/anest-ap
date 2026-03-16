---
globs: ["src/App.jsx", "src/pages/**"]
description: Padrões de navegação React. KEY prop, goBack, scroll to top, PAGE_TO_CARD
---

# Navegação ANEST

## Sistema de Navegação
Switch-based em App.jsx (NÃO react-router). 80+ cases no renderAppPage().
Cada case renderiza um componente com `key={pageName}` e `onNavigate` prop.

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
```jsx
// App.jsx mantém stack
const [navigationHistory, setNavigationHistory] = useState([]);

const goBack = () => {
  if (navigationHistory.length > 0) {
    const prev = navigationHistory[navigationHistory.length - 1];
    setNavigationHistory(prev => prev.slice(0, -1));
    setCurrentPage(prev.page);
    setPageProps(prev.props);
  }
};
```

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
