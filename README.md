# ANEST — Gestão de Qualidade Anestesiológica

> Plataforma médica para serviços de anestesiologia: 76+ calculadoras clínicas, gestão documental Qmentum, educação continuada, LGPD compliance.

[![Status](https://anest-ap.web.app)](https://anest-ap.web.app)

## Stack

- **Frontend:** React 19, Vite, Tailwind 3, Framer Motion
- **Auth:** Firebase Auth
- **Database:** Supabase (Postgres + RLS via JWT custom HS256)
- **Storage:** Supabase Storage + Firebase Storage (cert PDFs)
- **PWA:** vite-plugin-pwa + Workbox

## Quick start

```bash
git clone <repo>
cd anest-v2
npm install
cp .env.example .env.local  # popular com URLs/keys conforme docs/dev-onboarding.md
npm run dev                  # http://localhost:5173
```

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Dev server |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run lint` | ESLint |
| `npm run test` / `test:run` | Vitest |
| `npm run e2e` | Playwright (manual, browsers via `npx playwright install`) |
| `firebase deploy --only hosting:anest-ap` | Deploy hosting |

## Arquitetura

Veja `docs/architecture.md`.

## Onboarding

Veja `docs/dev-onboarding.md`.

## Compliance

- **LGPD:** consentimento condicional, anonimização, retenção. Detalhes em `.claude/rules/lgpd.md`.
- **Qmentum:** workflow de aprovação, compliance flags, weights por categoria. Detalhes em `.claude/rules/qmentum-compliance.md`.

## Estrutura de pastas

```
src/
├── design-system/         # 92 componentes DS + tokens
├── pages/                 # Páginas (switch-based em App.jsx)
├── services/              # Supabase services
├── hooks/                 # Custom hooks
├── contexts/              # React Contexts
└── __tests__/             # Vitest
supabase/
├── migrations/            # SQL migrations
└── functions/             # Edge functions (Deno)
docs/                       # Docs por subsistema
.claude/                    # Skills + rules para AI agents
```

## Versão atual

v3.82.0 — veja `CHANGELOG.md`.

## Contribuindo

PRs via GitHub. Veja `.github/workflows/ci.yml` para checks obrigatórios.
