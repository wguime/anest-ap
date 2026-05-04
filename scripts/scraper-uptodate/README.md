# UpToDate Scraper — Setup & Runbook

Coleta semanal de "What's New in Anesthesiology" do UpToDate, sanitiza e
envia para a Edge Function `ingest-uptodate` que faz upsert na tabela
`public.uptodate_topics`.

## O que JÁ ESTÁ feito (escrito e validado em build)

- Migration SQL: `supabase/migrations/20260429000000_create_uptodate_topics.sql`
- Edge Function: `supabase/functions/ingest-uptodate/index.ts`
- Workflow: `.github/workflows/uptodate-weekly.yml`
- Scraper: `scripts/scraper-uptodate/scrape.mjs` (+ `sanitize.mjs`, `ingest.mjs`)
- Frontend: card + página + detalhe + context + service
- `npm run build` passa ✓
- `npm install` no scraper rodou ✓ (Playwright + DOMPurify)

## O que VOCÊ precisa fazer (passos manuais — produção)

### 1. Aplicar migration no Supabase remoto

Tem um script pronto que aplica APENAS a migration nova (sem mexer nas
14 outras migrations locais que estão com drift):

```bash
cd "/Users/guilherme/Documents/IA/ANEST V2"
node scripts/apply-uptodate-migration.mjs
```

Saída esperada: lista de colunas, índices, RLS=true, função OK.

> Alternativa: copiar o SQL de `supabase/migrations/20260429000000_create_uptodate_topics.sql` e colar no SQL Editor do Supabase Studio.

### 2. Deploy da Edge Function

```bash
cd "/Users/guilherme/Documents/IA/ANEST V2"
npx supabase functions deploy ingest-uptodate --no-verify-jwt
```

### 3. Gerar shared secret e setar dos dois lados

```bash
SECRET=$(openssl rand -hex 32)
echo "Guarde este valor — vai usar nos dois lados:"
echo "$SECRET"

# Lado Supabase
cd "/Users/guilherme/Documents/IA/ANEST V2"
npx supabase secrets set INGEST_UPTODATE_SECRET=$SECRET
```

### 4. Adicionar 4 secrets no GitHub

Acesse `https://github.com/<seu-user>/<seu-repo>/settings/secrets/actions` e crie:

| Nome | Valor |
|------|-------|
| `UPTODATE_EMAIL` | seu login do UpToDate |
| `UPTODATE_PASSWORD` | sua senha do UpToDate |
| `INGEST_UPTODATE_URL` | `https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/ingest-uptodate` |
| `INGEST_UPTODATE_SECRET` | mesmo `$SECRET` do passo 3 |

### 5. Smoke test do Edge Function (sem precisar do scraper)

Envia 2 payloads mock e valida insert+update:

```bash
cd "/Users/guilherme/Documents/IA/ANEST V2/scripts/scraper-uptodate"
INGEST_UPTODATE_URL=https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/ingest-uptodate \
INGEST_SHARED_SECRET=$SECRET \
node smoke-ingest.mjs
```

Esperado:
- 1ª chamada: `{ inserted: 2, updated: 0, skipped: 0 }`
- 2ª chamada: `{ inserted: 0, updated: 2, skipped: 0 }`

### 6. Trigger manual do workflow

GitHub → Actions → "UpToDate Weekly Scrape" → Run workflow.
Acompanhe o log (3-5 min). Esperar saída `[uptodate] ingest result: { inserted: 30+, ... }`.

### 7. Validar dados no Supabase

SQL Editor:
```sql
SELECT count(*), max(fetched_at) FROM public.uptodate_topics;
SELECT count(*) FROM public.uptodate_topics WHERE is_featured = true;  -- esperar 10
SELECT titulo, publicado_em FROM public.uptodate_topics
ORDER BY publicado_em DESC LIMIT 5;
```

### 8. Testar no app local

```bash
npm run dev
```

- Login → Notícias (Publicações) → ver `UptodateCard` entre o hero e "Mais publicações".
- Click → página dedicada com hero (10 featured) + lista (até 50).
- Click em item → detalhe com HTML sanitizado, sem links externos clicáveis.
- DevTools → Elements: nenhum `<a href>` ou `<script>` no conteúdo renderizado.

### 9. Deploy do app (último passo, só após validar 1-8)

```bash
npm run build
git add -A
git commit -m "deploy: integração UpToDate (card, página, edge function, scraper)"
git push origin main
firebase deploy --only hosting:anest-ap
```

## Cronograma automático

A partir do primeiro `workflow_dispatch` bem-sucedido, o cron `'10 7 * * 1'`
dispara toda segunda 07:10 UTC (≈ 04:10 BRT). Se falhar, o GitHub envia
email automático.

## Manutenção

Se o UpToDate mudar o layout do login ou da página "What's New":
- O workflow falha com mensagem clara (`scrape.mjs` lança `throw` em selectors).
- Atualizar selectors em `scrape.mjs` (`input[name="userName"]`, `h2/h3`, etc) e
  testar local com `node scrape.mjs` apontando `INGEST_UPTODATE_URL` para
  `http://localhost:54321/functions/v1/ingest-uptodate` em dev.

## Limites e custos

- GitHub Actions free: 2.000 min/mês (privado) ou ilimitado (público).
- Cada execução: ~3-5 min → ~20 min/mês de uso. Margem absurda.
- Volume de requests UpToDate: ~5 GETs por execução. Trivial.
