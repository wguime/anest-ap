# Central de Notícias — Receita Autocontida

> Documento executável: outra IA (ou humano) pode seguir do topo para reimplementar do zero.
> Última atualização: 2026-04-27. Versão final usada em produção.
> Backup do diff anterior: `.central-noticias.diff.bak` no mesmo diretório.

---

## TL;DR — bugs anteriores e como evitar

| Bug | Origem | Prevenção |
|---|---|---|
| `body.style.overflow=hidden` persistente / scroll vertical travado | `<Carousel>` do DS aplica `snap-mandatory` sem `touch-action`, capturando pan-y do toque mobile | **NÃO usar `<Carousel>` do DS para essa feature.** Usar `<HScroll>` próprio (`overflow-x-auto` + `style={{touchAction:'pan-x'}}` + items `shrink-0 w-[88%] sm:w-[420px]`, sem snap, sem listener) |
| Re-renders em cascata travando frame | Context tinha `state.noticias` em deps de `useCallback` | Refs estáveis (`stateRef`, `loadingRef`, `lastFetchRef`); `useCallback` com deps mínimas. Callbacks lêem state via ref |
| `AnimatePresence` jank | `<motion>` em cada card da lista | Sem `AnimatePresence` na lista. Apenas skeleton/empty/lista estática |
| Provider tier errado | `NoticiasProvider` em `DeferredProviders` (espera 2s) | Provider em **`AuthGatedProviders` Tier 1** (entre `MessagesProvider` e `DeferredProviders`) |
| Cards de altura desigual | Sem grid fixo | Variant `list` com `min-h-[140px]` + `grid grid-rows-[auto_auto_1fr]`; variant `carousel` com `h-[150px]` fixo |
| Cores diferentes por revista poluindo | Esquema de cor por revista | Borda lateral `border-l-primary` única + `<Badge default subtle>` único |

Adicione `// CRITICAL:` em pontos onde é fácil regredir.

---

## 1. Pré-requisitos

### Variáveis de ambiente (`.env.local`)

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_JWT_SECRET=<jwt-secret>
SUPABASE_DB_HOST=aws-0-<region>.pooler.supabase.com
SUPABASE_DB_PORT=6543
SUPABASE_DB_USER=postgres.<project-ref>
SUPABASE_DB_PASSWORD=<db-password>
SUPABASE_DB_NAME=postgres
```

### Secrets (Supabase Functions)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# edge_fn_service_role já no Vault (uso interno do cron)
# NCBI_API_KEY (opcional — aumenta rate limit PubMed 3→10 req/s)
```

### CLIs

- Supabase CLI 2.95+ (`npx supabase --version`)
- Node 22+
- `pg_cron`, `pg_net`, `pgcrypto`, `pg_trgm` extensões (já presentes em Supabase Cloud).

---

## 2. Banco de dados

### Schema da tabela `noticias`

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.noticias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conteúdo
  titulo          text NOT NULL,
  titulo_pt       text,
  resumo          text,
  resumo_pt       text,
  autores         text,
  idioma          text DEFAULT 'en',

  -- Origem
  fonte           text NOT NULL,            -- 'Anesthesiology' | 'BJA' | 'Anaesthesia' | 'BJAN'
  fonte_url       text NOT NULL,
  raw_url         text,
  categoria       text,                     -- 'pesquisa' | 'sociedade' (legacy free-text)
  journal_issn    text,

  -- PubMed
  pmid            text,
  doi             text,
  external_id     text,
  article_type    text,                     -- 'Randomized Controlled Trial', 'Review', etc.
  mesh_terms      text[],
  keywords        text[],

  -- Categorização (12 temas)
  category        text,
  subcategory     text,

  -- Score composto
  altmetric_score             numeric DEFAULT 0,
  altmetric_percentile        numeric,
  citation_count              integer DEFAULT 0,
  citation_velocity           numeric DEFAULT 0,
  article_type_score          integer DEFAULT 0,
  editorial_highlight_score   integer DEFAULT 0,
  recency_score               integer DEFAULT 0,
  final_score                 numeric DEFAULT 0,
  is_featured                 boolean DEFAULT false,

  -- Open Access enrichment
  is_open_access  boolean,
  oa_pdf_url      text,
  oa_provider     text,
  pmc_id          text,
  full_text_url   text,
  pubmed_url      text,
  license         text,
  abstract_enriched_at timestamptz,

  -- Tradução
  translation_provider text,                -- 'anthropic' | 'mymemory' | 'lingva'

  -- Deduplicação
  dedup_hash      text NOT NULL,
  titulo_norm     text NOT NULL,

  -- Datas
  publicado_em    timestamptz NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  scores_updated_at timestamptz,

  -- Mesma notícia em outras fontes
  fontes_extras   jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS noticias_dedup_hash_uidx  ON noticias (dedup_hash);
CREATE UNIQUE INDEX IF NOT EXISTS noticias_doi_uidx         ON noticias (doi)  WHERE doi  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS noticias_pmid_uidx        ON noticias (pmid) WHERE pmid IS NOT NULL;
CREATE INDEX IF NOT EXISTS noticias_publicado_idx           ON noticias (publicado_em DESC);
CREATE INDEX IF NOT EXISTS noticias_fonte_idx               ON noticias (fonte);
CREATE INDEX IF NOT EXISTS noticias_category_idx            ON noticias (category);
CREATE INDEX IF NOT EXISTS noticias_is_featured_date_idx    ON noticias (is_featured, publicado_em DESC);
CREATE INDEX IF NOT EXISTS noticias_final_score_idx         ON noticias (final_score DESC);
CREATE INDEX IF NOT EXISTS noticias_journal_issn_idx        ON noticias (journal_issn);
CREATE INDEX IF NOT EXISTS noticias_titulo_trgm_idx         ON noticias USING gin (titulo_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS noticias_is_oa_idx               ON noticias (is_open_access);

CREATE OR REPLACE FUNCTION public.set_noticias_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_noticias_updated_at ON noticias;
CREATE TRIGGER trg_noticias_updated_at BEFORE UPDATE ON noticias
  FOR EACH ROW EXECUTE FUNCTION public.set_noticias_updated_at();

ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "noticias_read_authenticated" ON noticias;
CREATE POLICY "noticias_read_authenticated" ON noticias FOR SELECT TO authenticated USING (true);
-- Sem policy de INSERT/UPDATE/DELETE: apenas service_role escreve.
```

### Cron job — fetch semanal

```sql
SELECT cron.unschedule('fetch-noticias-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fetch-noticias-weekly'
);

SELECT cron.schedule(
  'fetch-noticias-weekly',
  '0 6 * * 1',  -- Segunda 06:00 UTC = 03:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/fetch-noticias',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_fn_service_role' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 3. Edge Functions

### A. `fetch-noticias` — ingestão semanal via PubMed E-Utilities

Pipeline:
1. Para cada ISSN whitelisted (Anesthesiology 0003-3022, BJA 0007-0912, Anaesthesia 0003-2409, BJAN 0104-0014), chamar `esearch.fcgi` + `efetch.fcgi` com `reldate=90` dias.
2. Parser XML extrai `pmid`, `doi`, `title`, `abstract`, `authors`, `pubDate`, `meshTerms`, `publicationTypes`, `keywords`.
3. Crossref `api.crossref.org/works/{doi}` para `is-referenced-by-count` (citations) — opcional.
4. Categorização via MeSH match (12 categorias).
5. Cálculo do score composto (Altmetric 25% + Type 25% + Editorial 20% + Recency 15% + Citation 15%; redistribui se Altmetric ausente).
6. UPSERT por `dedup_hash` com `ON CONFLICT (dedup_hash) DO UPDATE`.

Junk title filter regex (descartar antes de processar): `Editorial Board`, `Contents`, `Issue Information`, `Errata`, `Corrigendum`, `Information for authors`, etc.

Tabela TYPE_SCORE:
```ts
{
  'Practice Guideline': 100, 'Guideline': 100,
  'Clinical Trial, Phase III': 90, 'Clinical Trial, Phase IV': 90,
  'Systematic Review': 90, 'Meta-Analysis': 90,
  'Randomized Controlled Trial': 85,
  'Multicenter Study': 80,
  'Review': 70,
  'Clinical Trial, Phase II': 65, 'Clinical Trial, Phase I': 65,
  'Clinical Trial': 75,
  'Editorial': 50, 'Comment': 50,
  'Case Reports': 30, 'Letter': 20,
  'Technical Report': 40,
  'Observational Study': 60, 'Comparative Study': 55,
}
```

Threshold `is_featured = true` quando `final_score >= 50` (Altmetric ausente cap = ~70).

Helper `_categorization.ts` mapeia 12 categorias por keywords MeSH — deve bater com `categoriesConfig.js` do frontend (mesmas labels exatas).

Deploy: `npx supabase functions deploy fetch-noticias`.

### B. `translate-noticias` — tradução PT-BR via Anthropic

- Modelo: `claude-sonnet-4-5`.
- POST batch de até 80 artigos pendentes (`titulo_pt IS NULL` AND `idioma <> 'pt-BR'`).
- System prompt: "tradutor médico de anestesiologia, preserva termos técnicos, retorna JSON `{titulo_pt, resumo_pt}`".
- Custo Anthropic: ~$0.003/artigo × 200 artigos/mês ≈ $0.60/mês.
- Body opcional: `{ max: 80, dryRun: false }`.

Deploy: `npx supabase functions deploy translate-noticias`.

---

## 4. Scripts Node — opcionais (rodar quando necessário)

### `scripts/enrich-noticias.cjs`

Para cada notícia com DOI e `abstract_enriched_at IS NULL`:
1. Unpaywall `api.unpaywall.org/v2/{doi}?email=...` → `is_oa`, `best_oa_location.url_for_pdf`.
2. NCBI ESearch `db=pmc` por DOI → `pmc_id`.
3. Crossref `/works/{doi}` → abstract JATS (fallback).
4. UPDATE noticias com OA fields, pmc_id, abstract_enriched_at.

### `scripts/run-translate-batches.cjs`

Loop POST `/translate-noticias` em ondas até queue vazia.

---

## 5. Frontend — service + context

### `src/services/supabaseNoticiasService.js`

Apenas leitura. Mapping camelCase ↔ snake_case completo. `LIST_COLUMNS` slim para listagens; `*` apenas em `fetchById`.

```js
const LIST_COLUMNS = [
  'id', 'fonte', 'titulo', 'titulo_pt', 'resumo', 'resumo_pt', 'autores',
  'publicado_em', 'idioma', 'article_type', 'final_score', 'is_featured',
  'oa_pdf_url', 'pmc_id', 'category', 'journal_issn', 'fontes_extras',
  'raw_url', 'fonte_url', 'doi', 'pmid',
].join(', ')
```

Funções: `fetchLatest(opts)`, `fetchHighlights(opts)`, `fetchByCategory(category, opts)`, `fetchById(id)`.

### `src/contexts/NoticiasContext.jsx`

Padrão **stale-while-revalidate**:
- `CACHE_KEY = 'anest:noticias:cache:v1'`, `CACHE_TTL_MS = 7d`, `REVALIDATE_AFTER_MS = 1h`.
- Mount → `loadFromCache()` → dispatch imediato (UI rendera).
- `loadNoticias({ force })` → revalida em background; compara fingerprint (`length:max(publicado_em)`) e só dispatch se diferente; sempre `saveToCache(data)`.
- **Refs estáveis** (`stateRef`, `loadingRef`, `lastFetchRef`); `useCallback` com **deps mínimas** (sem `state.noticias` nas deps).
- Provider em **AuthGatedProviders Tier 1**.

---

## 6. Frontend — componentes

### `src/components/noticias/HScroll.jsx`

**CRITICAL: substituto do `<Carousel>` DS para evitar scroll bug.**

```jsx
<div
  role="region"
  aria-label={ariaLabel}
  className="flex w-full gap-3 overflow-x-auto pb-2"
  style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
>
  {items.map(child => <div className="shrink-0 w-[88%] sm:w-[420px]">{child}</div>)}
</div>
```

Sem `snap-mandatory`, sem `onScroll` listener, sem state interno.

### `src/components/noticias/categoriesConfig.js`

12 categorias temáticas — labels EXATAS batem com a coluna `category` populada pelo `_categorization.ts` da Edge Function:

`Via Aérea` (Wind), `Anestesia Regional` (Activity), `Perioperatório` (Stethoscope), `Dor` (HeartPulse), `Farmacologia` (Pill), `Segurança do Paciente` (ShieldCheck), `Cardiovascular` (Heart), `Obstetrícia` (Baby), `Pediatria` (Users), `Terapia Intensiva` (Hospital), `Neuroanestesia` (Brain), `Tecnologia e IA` (Cpu).

Cada item exporta `{ value, label, icon, description }`.

### `src/components/noticias/CategoriasGrid.jsx`

Grid 2/3/4-col responsivo com 12 cards (ícone Lucide + nome). Ordena por count desc; categorias vazias com `opacity-40 cursor-not-allowed`. Sem mostrar contagem numérica — minimalista. Usado dentro de `<Modal>`.

### `src/components/noticias/NoticiaCard.jsx`

3 variants:
- **`carousel`** — `h-[150px]` fixo, `border-l-4 border-l-primary`, badge revista subtle, 2 linhas título + 1 linha resumo.
- **`list`** — `min-h-[140px]` + `grid grid-rows-[auto_auto_1fr]` (meta / título 2-line / resumo 2-line com placeholder `—`).
- **`featured`** — igual `list` + `border-l-4 border-l-primary`.

Lê título de `tituloPt || titulo` e resumo de `resumoPt || resumo`. Memoizado com comparator (`id`, `tituloPt`, `resumoPt`, `oaPdfUrl`, `pmcId`).

### `src/components/noticias/NoticiasCarousel.jsx`

Para a HomePage: lê `highlights` do contexto (cache stale-while-revalidate), pega top 10 ordenado por `finalScore desc, publicadoEm desc`, renderiza via `<HScroll>`. Header "Destaques Científicos" + Sparkles + link "Ver todos →". Esconde-se inteiro se `top10.length === 0`.

---

## 7. Frontend — páginas

### `src/pages/NoticiasPage.jsx`

- Header (createPortal): `< Voltar` | "Central de Notícias" | botão refresh + ícone `LayoutGrid` (abre modal de categorias).
- Body (`pb-24`):
  - `<SearchBar>` (DS anest) com `useDeferredValue(search)` para diferir filtro.
  - `<Tabs>` (DS): "Todas" + 4 revistas, `TabsList` com `overflow-x-auto`.
  - Hero featured: `<HScroll>` com top 10 da tab por finalScore (label "Em destaque" + Sparkles).
  - "Mais notícias" — lista 20 por vez, botão "Carregar mais".
  - Sem `AnimatePresence`.
- `<Modal>` de categorias com `<CategoriasGrid>` dentro.

### `src/pages/NoticiaDetalhePage.jsx`

- Header (createPortal): `< Voltar` | "Notícia".
- Body:
  - Linha de meta: `<Badge default subtle>` revista + `<Badge secondary>` tipo + `<Badge success>` Open Access (ou ícone Lock + "Acesso restrito") + data formatada à direita.
  - Título PT (h2) com `border-l-4 border-l-primary pl-3 py-1`. Título original em itálico abaixo se diferente.
  - Autores em linha simples.
  - **Abstract estruturado** quando detecta `BACKGROUND/METHODS/RESULTS/CONCLUSIONS` (EN ou PT) — função `parseStructuredAbstract`. Renderiza por seção: cabeçalho 11px uppercase tracking-wide + corpo 15px leading-1.75. Fallback: texto corrido.
  - **Estado A (OA)**: `<PDFViewer>` inline auto-mostra quando `oaPdfUrl` existe.
  - **Estado B (paywall)**: só abstract.
  - Botões grid 2-col: "Ver em PMC" / "Ver no PubMed" / "Abrir na fonte" / "Copiar DOI" (com feedback).
  - **Metadados** (collapsible): categoria, tipo, citações, score, DOI, PMID, MeSH (top 10 + "+N mais").

### `src/pages/CategoriaNoticiasPage.jsx`

- Header `< Voltar` + nome da categoria.
- Sub-header: ícone Lucide grande + descrição da categoria.
- Hero: top 10 da categoria via HScroll.
- Lista paginada de 20 por vez.

---

## 8. Patches em arquivos existentes

### `src/pages/index.js`

```diff
 export { default as NoticiasPage } from './NoticiasPage';
 export { default as NoticiaDetalhePage } from './NoticiaDetalhePage';
+export { default as CategoriaNoticiasPage } from './CategoriaNoticiasPage';
```

### `src/App.jsx`

```diff
   NoticiasPage,
   NoticiaDetalhePage,
+  CategoriaNoticiasPage,
```

```diff
       case 'noticia-detalhe':
         return <NoticiaDetalhePage key={`noticia-${pageParams?.noticiaId}`} ... />
+      case 'categoria-noticias':
+        return <CategoriaNoticiasPage key={`cat-${pageParams?.category}`} category={pageParams?.category} onNavigate={handleNavigate} goBack={goBack} />
```

### `src/main.jsx` — `NoticiasProvider` em **Tier 1**

```jsx
<ComunicadosProvider>
  <EventAlertsProvider>
    <MessagesProvider>
      <NoticiasProvider>
        <DeferredProviders>
          {children}
        </DeferredProviders>
      </NoticiasProvider>
    </MessagesProvider>
  </EventAlertsProvider>
</ComunicadosProvider>
```

### `src/pages/HomePage.jsx`

```jsx
import { NoticiasCarousel } from '../components/noticias/NoticiasCarousel';
// ... abaixo da SearchBar:
<NoticiasCarousel onNavigate={onNavigate} />
```

### `src/pages/EducacaoPage.jsx`

```jsx
import { Newspaper } from 'lucide-react';
// ... no grid de WidgetCards:
<WidgetCard
  icon={<Newspaper className="w-6 h-6" />}
  title="Central de Notícias"
  subtitle="Anestesiologia no mundo"
  variant="interactive"
  onClick={() => onNavigate('noticias')}
/>
```

---

## 9. Sequência de operação (do zero)

1. Aplicar migration `20260427000000_create_noticias.sql` (idempotente — `CREATE TABLE IF NOT EXISTS` etc.).
2. `supabase secrets set ANTHROPIC_API_KEY=...`
3. `npx supabase functions deploy fetch-noticias`
4. `npx supabase functions deploy translate-noticias`
5. Aplicar migration cron (idempotente — `cron.unschedule` se existir, depois `cron.schedule`).
6. Trigger inicial (uma vez):
   ```bash
   curl -X POST https://<project>.supabase.co/functions/v1/fetch-noticias \
     -H "Authorization: Bearer <SERVICE_ROLE>"
   ```
7. (Opcional) `node scripts/enrich-noticias.cjs` — Unpaywall + PMC + Crossref.
8. (Opcional) `node scripts/run-translate-batches.cjs` em ondas até queue vazia.
9. `npm run build` — validar passa.
10. `npm run dev` — smoke test:
    - DevTools Console aberto → zero erros vermelhos.
    - **Scroll vertical TESTADO** em Home, Central, Categoria, Detalhe.
    - Tabs revistas funcionam.
    - Modal categorias abre/fecha.
    - Detalhe renderiza abstract + (se OA) PDF inline.
11. Deploy:
    ```bash
    git add -A
    git commit -m "feat(noticias): central de notícias"
    git push origin main
    firebase deploy --only hosting:anest-ap
    ```

---

## 10. Riscos e gaps conhecidos

- **Altmetric API** key (Counts-Only para pesquisadores): aprovação manual; quando disponível, `altmetric_score` real (peso 25% do score).
- **NCBI API key**: opcional; aumenta de 3→10 req/s.
- **Acesso ao texto não-OA**: legal apenas via Unpaywall + PMC + link para fonte. Sci-Hub e similares são copyright infringement — recusados.
- **Detecção de Editor's Choice**: hoje `editorialHighlightScore=0`. Heurística futura via título ou metadados Crossref.

---

## 11. Sources de pesquisa para o layout

- [Read by QxMD](https://apps.apple.com/us/app/read-by-qxmd/id574041839) — referência canônica em apps de papers médicos com PubMed integration. Layout "magazine mosaic" + 6-button toolbar.
- [Cactus Life Sciences — UX em scientific writing](https://cactuslifesciences.com/the-future-of-scientific-writing-and-journal-articles-with-ux-design/) — tipografia clean, abstract estruturado, badges de evidência.
- [News Feed UI patterns](https://cms.nucleusnetwork.com/urban-beat/news-feed-app-ui-design-tips-and-best-practices-1764797643) — card-based, hero featured, mobile-first.
- [Mobbin Mobile News Feed](https://mobbin.com/explore/mobile/screens/news-feed) — 890+ exemplos de feed mobile.

---

## 12. Anexos

- Backup do diff anterior (parcial): `.central-noticias.diff.bak` (mesmo diretório).
- Padrões DS do projeto: `src/design-system/Tokens.json`, `.claude/rules/design-tokens.md`, `.claude/rules/responsividade.md`.
