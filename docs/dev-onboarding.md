# Dev Onboarding — ANEST

This stub captures the minimum setup a new contributor needs. Expand as needed.

## Prerequisites

- Node 22 (project's primary version; matches CI matrix in `.github/workflows/ci.yml`).
- npm.
- Firebase CLI (`npm install -g firebase-tools`) for deploys.
- Supabase CLI (`npm install -g supabase`) for migrations and drift checks.

## Local setup

```bash
git clone https://github.com/wguime/anest-ap.git
cd anest-ap
npm ci
cp .env.example .env.local   # then fill in values from your dev environment
npm run dev
```

Useful scripts:

| Command            | Purpose                       |
|--------------------|-------------------------------|
| `npm run dev`      | Vite dev server               |
| `npm run build`    | Production build              |
| `npm run preview`  | Preview built bundle          |
| `npm run lint`     | ESLint                        |
| `npm run test:run` | Vitest (single run)           |

## GitHub repository secrets required

Some workflows need repository secrets set in **GitHub → Settings → Secrets and variables → Actions → New repository secret** (direct URL: `https://github.com/wguime/anest-ap/settings/secrets/actions`).

| Secret name              | Used by                             | How to obtain                                                                 |
|--------------------------|-------------------------------------|-------------------------------------------------------------------------------|
| `SUPABASE_ACCESS_TOKEN`  | `.github/workflows/drift-check.yml` | Supabase dashboard → Account → Access Tokens → Generate new token            |
| `SUPABASE_PROJECT_REF`   | `.github/workflows/drift-check.yml` | Supabase dashboard → Project Settings → General → Reference ID                |

`GITHUB_TOKEN` is provided automatically by Actions; no manual setup needed.

Do not paste secret values in PRs, issues, chat, or commit messages. See `.claude/rules/secrets.md` for the full policy.

## Workflows

- **CI** (`.github/workflows/ci.yml`) — runs on push/PR to `main`: lint (advisory while baseline burns down), build (uploads `dist/`), test (uploads coverage when present).
- **Drift Check** (`.github/workflows/drift-check.yml`) — runs Mondays 09:00 UTC and on manual dispatch; opens a `drift`-labelled issue if remote Supabase migrations diverge from `supabase/migrations/`.
