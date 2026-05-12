# Dev Onboarding — ANEST

## Pré-requisitos
- Node 22+ (`nvm install 22 && nvm use 22`)
- npm 10+
- gcloud CLI (para emulators opcionais)
- Firebase CLI (`npm install -g firebase-tools`)
- Supabase CLI (`brew install supabase/tap/supabase`)

## Setup local

1. **Clonar e instalar:**
   ```bash
   git clone https://github.com/wguime/anest-ap.git
   cd anest-ap
   npm install
   ```

2. **Variáveis de ambiente:** copie `.env.example` para `.env.local` e popule:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.

3. **Auth:** logue em Firebase e Supabase CLIs:
   ```bash
   firebase login
   supabase login
   supabase link --project-ref vjzrahruvjffyyqyhjny
   ```

4. **Dev server:** `npm run dev` (http://localhost:5173)

## Workflow PR

1. Branch a partir de `main`: `git checkout -b feat/minha-feature`
2. Commits seguindo Conventional Commits (`feat`, `fix`, `chore`, `docs`, `perf`, `test`, `ops`, `ci`).
3. Push e abra PR no GitHub. CI roda lint+build+test automaticamente.
4. Aprovação + merge via squash em `main`.

## GitHub secrets (CI)

User com permissão admin do repo deve configurar em Settings → Secrets:
- `SUPABASE_ACCESS_TOKEN` — para drift-check workflow
- `SUPABASE_PROJECT_REF` — `vjzrahruvjffyyqyhjny`

## Deploy

Veja `CLAUDE.md` seção "Deploy para Produção".

## Convenções

- Audit trail: `changedBy = currentUserId` em toda mutation.
- Design tokens semânticos: nunca hex. Veja `.claude/rules/design-tokens.md`.
- LGPD: consentimento + anonimização. Veja `.claude/rules/lgpd.md`.
- Skills: `.claude/skills/*` — invocáveis via `/skill-name` em AI agent.
