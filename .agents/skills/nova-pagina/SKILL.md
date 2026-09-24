---
name: nova-pagina
description: Como adicionar nova página ao app ANEST. Route em App.jsx, PAGE_TO_CARD, lazy import, BottomNav, permissões.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Adicionar Nova Página — ANEST

## Passo a Passo

### 1. Criar Arquivo
Criar em `src/pages/` ou subdiretório adequado.
Usar template com `useTheme` + `cn()`:
```jsx
import { useTheme } from '@/design-system/hooks';
import { cn } from '@/lib/utils';

export function MinhaPagina({ onNavigate, user }) {
  const { isDark } = useTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={cn("min-h-screen", isDark && "dark")}>
      {/* <PageHeader title="…" onBack={…} /> */}
      {/* Conteúdo */}
    </div>
  );
}
```

### 2. Adicionar Case em App.jsx
No `renderAppPage()`, adicionar:
```jsx
case 'minha-pagina':
  return <MinhaPagina key="minha-pagina" onNavigate={handleNavigate} user={user} />;
```
Junto do case, a entrada em `PAGES` de `src/navigation/pageSlugs.js` (a URL é a fonte de verdade; página com parâmetro no path entra também em `PAGE_PARAM`). O teste `src/__tests__/navigation/pageSlugs.test.js` quebra se um case ficar sem slug.

### 3. PAGE_TO_CARD (se precisa permissão)
```jsx
const PAGE_TO_CARD = {
  // ...
  'minha-pagina': 'minha-pagina',
};
```

### 4. Lazy Import (se componente pesado)
```jsx
const MinhaPagina = lazy(() => import('./pages/MinhaPagina'));
```

### 5. Guard Admin (se necessário)
```jsx
if (!isAdmin && !isCoordenador) return <AccessDenied />;
```

### 6. Navegação
Adicionar link de outra página:
```jsx
onNavigate('minha-pagina', { prop1: 'valor' });
```
A BottomNav tem 4 abas fixas e visual travado (AGENTS.md): página nova entra por card ou link, nunca como aba, e não renderiza BottomNav própria.

### 7. Header Fixo
`<PageHeader title="…" onBack={…} />` de `@/components` — ele já faz o portal para o topo fixo.

## Checklist
- [ ] Página criada com useTheme + cn()
- [ ] Case adicionado em App.jsx com key prop
- [ ] PAGE_TO_CARD mapeado (se precisa permissão)
- [ ] Header via `<PageHeader>`
- [ ] Scroll to top no useEffect
- [ ] Dark/Light mode testado
- [ ] Mobile responsividade verificada
- [ ] Touch targets ≥ 44px
