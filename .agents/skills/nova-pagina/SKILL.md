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
      {/* Header via createPortal */}
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
Para referência: App.jsx tem 80+ cases — seguir padrão existente.

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
Ou adicionar ao BottomNav se for seção principal.

### 7. Header Fixo
Usar `createPortal` para renderizar Header no container fixo do App.
Copiar padrão de qualquer página existente.

## Checklist
- [ ] Página criada com useTheme + cn()
- [ ] Case adicionado em App.jsx com key prop
- [ ] PAGE_TO_CARD mapeado (se precisa permissão)
- [ ] Header fixo via createPortal
- [ ] Scroll to top no useEffect
- [ ] Dark/Light mode testado
- [ ] Mobile responsividade verificada
- [ ] Touch targets ≥ 44px
