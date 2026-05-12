# Observability — ANEST

Wave 4.4 introduz um service de **error reporting** plugável, ligado ao
`ErrorBoundary` global em `src/App.jsx`. O backend default é **Firebase
Analytics** (já disponível no stack via `firebase` SDK), evitando dependência
de terceiros (Sentry, LogRocket, Datadog) com custo recorrente.

## Visão geral

```
React render error
  └── ErrorBoundary.componentDidCatch
        └── onError(error, errorInfo)
              └── reportError(error, { componentStack, route, fatal })
                    ├── console.error (sempre)
                    └── Firebase Analytics event "app_exception" (PROD only)
```

## API

```js
import { reportError } from '@/services/errorReporting';

reportError(error, {
  componentStack: errorInfo?.componentStack, // opcional (errorInfo do React)
  route: currentPage,                         // opcional, default "unknown"
  userId: user?.uid,                          // opcional, opt-in
  fatal: false,                               // opcional, default false
});
```

Assinatura:

| Param            | Tipo      | Default     | Notas                                       |
|------------------|-----------|-------------|---------------------------------------------|
| `error`          | `Error`   | —           | Aceita `null`/sem `.message` (fallback "unknown") |
| `context.componentStack` | `string` | `""` | Trunca em 500 chars                      |
| `context.route`  | `string`  | `"unknown"` | Página atual                                |
| `context.userId` | `string`  | —           | LGPD: enviar apenas se opt-in registrado    |
| `context.fatal`  | `boolean` | `false`     | Crash vs erro tratado                        |

## Onde está integrado

1. **`src/App.jsx`** — `ErrorBoundary` global em volta de `renderAppPage()`.
   Captura qualquer erro de renderização não tratado pelas páginas.
2. **Call sites manuais** (futuros) — services e contexts podem chamar
   `reportError` diretamente em `catch` críticos (failover Firestore,
   sync Supabase, etc).

Pattern para call manual:

```js
try {
  await criticalOperation();
} catch (err) {
  reportError(err, { route: 'context-name', fatal: false });
  // continua o fluxo de UX (toast, retry, etc.)
}
```

## Firebase Analytics — evento

- **Event name:** `app_exception`
- **Params enviados:**
  - `description` (≤200 chars) — `error.message`
  - `component_stack` (≤500 chars) — `errorInfo.componentStack`
  - `route` — página/contexto onde ocorreu
  - `fatal` (boolean) — crash vs erro tratado

> **Por que truncar?** Firebase Analytics limita event params a 100 chars por
> default; aqui usamos limites pragmáticos. Stacks completos para debugging
> profundo ficam apenas no `console.error` (e em ferramentas browser local).

## Comportamento por ambiente

| Ambiente | console.error | Firebase Analytics |
|----------|---------------|--------------------|
| DEV (`import.meta.env.PROD === false`) | sim | **não** |
| PROD (`import.meta.env.PROD === true`) | sim | sim (lazy import) |

O lazy import (`import('firebase/analytics')`) garante que o SDK de Analytics
**não entre no critical chunk** — só é baixado quando um erro é reportado em
produção.

## Como visualizar erros em produção

1. **Firebase Console** → `anest-ap` → **Analytics** → **Events**.
2. Buscar evento custom `app_exception`.
3. Filtrar por parâmetro `route` ou `description`.
4. (Opcional) Marcar como **conversion** para tracking de tendência.

DebugView (testar em DEV antes de subir):

```bash
# Em mobile/desktop, ativar Analytics Debug Mode (Chrome DevTools)
# Console: chrome://flags → enable analytics debug
```

Veja [Firebase Analytics — Custom events](https://firebase.google.com/docs/analytics/events?platform=web).

## LGPD

- `userId` é **opcional** e só deve ser enviado quando há consentimento
  registrado (`PrivacyPolicyModal`).
- `error.message` pode conter dados sensíveis em raros casos; revisar
  mensagens de erro de services que tratam PII antes de propagar.
- Retenção dos eventos segue a configuração do projeto Firebase (default
  14 meses).

## Troca de backend (futuro)

Para migrar para Sentry/LogRocket/etc, basta reimplementar
`src/services/errorReporting.js` preservando a assinatura. Nenhum call site
precisa mudar.

Exemplo (Sentry):

```js
import * as Sentry from '@sentry/browser';

export function reportError(error, context = {}) {
  console.error('[errorReporting]', error?.message, context);
  if (import.meta.env.PROD) {
    Sentry.captureException(error, { extra: context });
  }
}
```

## Referências

- Service: `src/services/errorReporting.js`
- Wire-in: `src/App.jsx` (ErrorBoundary global)
- Testes: `src/__tests__/services/errorReporting.test.js`
- ErrorBoundary DS: `src/design-system/components/anest/ErrorBoundary.jsx`
