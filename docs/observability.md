# Observability — ANEST

Sprint 19 introduz **Sentry real** (free tier, 5k events/mês) como backend
preferencial de error reporting. Fallback automático para **Firebase Analytics**
quando `VITE_SENTRY_DSN` não está configurada (compat v4.0.0).

`ErrorBoundary` global em `src/App.jsx` continua sendo o entrypoint.

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

| Ambiente | console.error | Backend |
|----------|---------------|---------|
| DEV (`import.meta.env.PROD === false`) | sim | **nenhum** (zero tráfego) |
| PROD com `VITE_SENTRY_DSN` | sim | Sentry (captureException) |
| PROD sem `VITE_SENTRY_DSN` | sim | Firebase Analytics (fallback) |

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

## Setup Sentry (free tier)

1. Criar projeto em https://sentry.io → New Project → Platform: **React**.
2. Copiar DSN exibido (formato `https://<key>@<org>.ingest.sentry.io/<id>`).
3. **Localmente:** adicionar em `.env.local`:
   ```
   VITE_SENTRY_DSN=https://...
   ```
4. **CI / GitHub Actions:** setar secret `SENTRY_DSN` em repo settings
   → Settings → Secrets and variables → Actions → New secret.
   Workflow `ci.yml` deve referenciar via `${{ secrets.SENTRY_DSN }}` no
   build step quando aplicável.
5. **Produção (Firebase Hosting):** o build estático embebe a DSN no chunk
   `vendor-sentry-*.js` se `VITE_SENTRY_DSN` estiver presente no build
   environment (i.e., setar via GitHub Action env block antes de
   `npm run build`).

Sem essa configuração, app usa fallback Firebase Analytics (já deployado).

## Sentry config

`src/main.jsx` inicializa o cliente lazy quando `VITE_SENTRY_DSN` presente:

```js
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,            // 10% traces de performance
  replaysSessionSampleRate: 0,      // sem session replay default (LGPD)
  replaysOnErrorSampleRate: 1.0,    // replay apenas em erro (debug)
  environment: import.meta.env.MODE,
  sendDefaultPii: false,            // LGPD: zero PII implícita
})
```

`reportError` passa tags whitelisted (`route`, `fatal`) e extras (`componentStack`,
`userId` opt-in) — nada além.

## Referências

- Service: `src/services/errorReporting.js`
- Wire-in: `src/App.jsx` (ErrorBoundary global)
- Testes: `src/__tests__/services/errorReporting.test.js`
- ErrorBoundary DS: `src/design-system/components/anest/ErrorBoundary.jsx`
