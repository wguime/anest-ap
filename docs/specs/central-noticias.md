# Central de Notícias + Destaques Científicos — Especificação Técnica

> Documento de referência para reimplementar a feature do zero.
> Última iteração: 2026-04-26. Backup do diff em `.central-noticias.diff.bak`.

---

## 1. Visão Geral

Agregar artigos das principais revistas de anestesiologia em duas superfícies do app ANEST:

1. **HomePage** — carrossel "Destaques Científicos" abaixo da SearchBar com top 10 artigos.
2. **Página Central de Notícias** — listagem completa com tabs por revista, grid de categorias temáticas e busca.
3. **WidgetCard** em "Educação Continuada" abrindo a Central.
4. **Página de Categoria** dedicada (top 10 + lista paginada de 20 por categoria).
5. **Detalhe de notícia** com abstract estruturado e PDF inline quando OA.

### Revistas alvo (final aprovada)

| Revista | ISSN | Estratégia | Editora |
|---|---|---|---|
| Anesthesiology | 0003-3022 | PubMed E-Utils + Crossref ISSN (LWW Cloudflare bloqueia RSS) | ASA / Wolters Kluwer |
| BJA — British Journal of Anaesthesia | 0007-0912 | PubMed E-Utils | Elsevier |
| Anaesthesia (UK) | 0003-2409 | PubMed E-Utils | Association of Anaesthetists / Wiley |
| BJAN — Brazilian Journal of Anesthesiology | 0104-0014 | PubMed E-Utils + Crossref ISSN | SBA / Elsevier |

> Removidas no caminho: NEJM (não-anestesia), A&A, RAPM, SBA blog, Acta AS, BMC Anesthesiology, BJA Open.

### Decisões UX consolidadas

- Cron **semanal** (segunda 06:00 UTC = 03:00 BRT). Não atualizar a cada visita.
- Cache **stale-while-revalidate** localStorage com TTL 7d.
- Idioma original mantido (EN) + **tradução PT-BR via Anthropic Claude Sonnet 4.5**.
- Acesso aberto a todos autenticados (sem PAGE_TO_CARD).
- **Borda lateral verde DS (`border-l-primary`)** em todos os carrosseis (não cor por revista).
- **Badge da revista uniforme** (`Badge variant="default" badgeStyle="subtle"`).
- Data **absoluta** ("31 de mar.") em cards, não relativa.
- Cards `list` com `min-h-[140px]` + grid fixo 3 fileiras.
- Cards `carousel` com `h-[150px]` fixo.
- Header da Central segue padrão do `ComunicadosPage`: `< Voltar` esquerda, título centro, ícone `LayoutGrid` direita (abre modal de categorias).
- Search via DS `SearchBar` (não input customizado).
- 12 categorias temáticas (Via Aérea, Anestesia Regional, Perioperatório, Dor, Farmacologia, Segurança, Cardiovascular, Obstetrícia, Pediatria, Terapia Intensiva, Neuroanestesia, Tecnologia & IA) — **sem números** ao lado do nome.

---

## 2. Banco de Dados (Supabase)

### Tabela `public.noticias`

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.noticias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conteúdo
  titulo          text NOT NULL,
  titulo_pt       text,                              -- tradução PT-BR via Claude
  resumo          text,
  resumo_pt       text,                              -- tradução PT-BR via Claude
  autores         text,                              -- "Smith J, Jones K, et al."
  idioma          text DEFAULT 'en',                 -- 'en' | 'pt-BR'

  -- Origem
  fonte           text NOT NULL,                     -- 'Anesthesiology' | 'BJA' | 'Anaesthesia' | 'BJAN'
  fonte_url       text NOT NULL,                     -- URL canônica normalizada
  raw_url         text,                              -- URL original (debug)
  categoria       text,                              -- 'pesquisa' | 'sociedade'
  journal_issn    text,                              -- ISSN da revista

  -- Metadados PubMed
  pmid            text,                              -- PubMed ID
  doi             text,
  external_id     text,
  article_type    text,                              -- 'Randomized Controlled Trial', 'Review', 'Guideline', 'Meta-Analysis', etc.
  mesh_terms      text[],                            -- termos MeSH para categorização
  keywords        text[],

  -- Categorização
  category        text,                              -- '12 categorias' (Via Aérea, Dor, etc.)
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
  is_featured                 boolean DEFAULT false, -- final_score >= 50

  -- Open Access enrichment
  is_open_access  boolean,
  oa_pdf_url      text,                              -- via Unpaywall
  oa_provider     text,                              -- 'unpaywall'
  pmc_id          text,                              -- PMC ID quando disponível
  full_text_url   text,
  pubmed_url      text,
  license         text,
  abstract_enriched_at timestamptz,

  -- Tradução
  translation_provider text,                         -- 'anthropic' | 'mymemory' | 'lingva'

  -- Deduplicação
  dedup_hash      text NOT NULL,                     -- sha256(normalizeUrl + '|' + normalizeTitle)
  titulo_norm     text NOT NULL,                     -- title normalizado para trigram

  -- Datas
  publicado_em    timestamptz NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  scores_updated_at timestamptz,

  -- Mesma notícia em outras fontes
  fontes_extras   jsonb NOT NULL DEFAULT '[]'::jsonb -- [{"fonte":"...","url":"..."}]
);

-- Indexes
CREATE UNIQUE INDEX noticias_dedup_hash_uidx  ON noticias (dedup_hash);
CREATE UNIQUE INDEX noticias_doi_uidx         ON noticias (doi)  WHERE doi  IS NOT NULL;
CREATE UNIQUE INDEX noticias_pmid_uidx        ON noticias (pmid) WHERE pmid IS NOT NULL;
CREATE INDEX noticias_publicado_idx           ON noticias (publicado_em DESC);
CREATE INDEX noticias_fonte_idx               ON noticias (fonte);
CREATE INDEX noticias_categoria_idx           ON noticias (categoria);
CREATE INDEX noticias_category_idx            ON noticias (category);
CREATE INDEX noticias_is_featured_date_idx    ON noticias (is_featured, publicado_em DESC);
CREATE INDEX noticias_final_score_idx         ON noticias (final_score DESC);
CREATE INDEX noticias_journal_issn_idx        ON noticias (journal_issn);
CREATE INDEX noticias_titulo_trgm_idx         ON noticias USING gin (titulo_norm gin_trgm_ops);
CREATE INDEX noticias_is_oa_idx               ON noticias (is_open_access);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_noticias_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_noticias_updated_at BEFORE UPDATE ON noticias
  FOR EACH ROW EXECUTE FUNCTION public.set_noticias_updated_at();

-- RLS
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "noticias_read_authenticated" ON noticias FOR SELECT TO authenticated USING (true);
-- Sem policy de INSERT/UPDATE/DELETE: só service_role (Edge Function) escreve.
```

### Cron (pg_cron + pg_net + Vault secret `edge_fn_service_role`)

```sql
SELECT cron.schedule(
  'fetch-noticias-weekly',
  '0 6 * * 1',  -- Segunda 06:00 UTC = 03:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/fetch-noticias',
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

### A. `fetch-noticias` — ingestão semanal

**Path:** `supabase/functions/fetch-noticias/index.ts`

Pipeline:
1. Para cada ISSN whitelisted, chamar PubMed E-Utilities (`esearch.fcgi` + `efetch.fcgi`) com `reldate=90` dias.
2. Parser XML manual para extrair `pmid`, `doi`, `title`, `abstract`, `authors`, `pubDate`, `meshTerms`, `publicationTypes`, `keywords`.
3. (Opcional) Crossref `api.crossref.org/works/{doi}` para `is-referenced-by-count` (citations).
4. Categorização via MeSH match (ver mapping completo em `_categorization.ts`).
5. Cálculo do score composto (formula abaixo).
6. UPSERT por `dedup_hash` (UNIQUE) com `ON CONFLICT (dedup_hash) DO UPDATE`.

Helper `_categorization.ts`:
- `CATEGORIES` — 12 categorias com keywords (lowercase substring match contra MeSH + título + abstract).
- `pickArticleType(types)` — retorna `{ type, score }` baseado em tabela TYPE_SCORE.
- `recencyScoreFromDate(dt)` — 100 (≤7d), 85 (≤14d), 70 (≤30d), 40 (≤60d), 20 (≤90d), 10.
- `citationVelocityScore(citations, daysOld)` — citações/mês × 30: >10→100, >5→80, >2→60, >0.5→40.
- `altmetricToScore(score, percentile)` — 0-100 normalizado.
- `computeFinalScore(s)` — pesos: Altmetric 25%, Type 25%, Editorial 20%, Recency 15%, Citation 15%. Quando `hasAltmetricData=false`, redistribui proporcionalmente.

**Tabela TYPE_SCORE:**
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

**Threshold `is_featured`:** com Altmetric ausente, o máximo realista do score é ~70. Threshold = **50** (não 70 da spec original).

**Junk title filter:** regex de título admin do journal (Editorial Board, Contents, Issue Information, Errata, etc.) — descartar antes de processar.

### B. `translate-noticias` — tradução PT-BR via Anthropic

**Path:** `supabase/functions/translate-noticias/index.ts`

- Requer secret `ANTHROPIC_API_KEY` no Supabase Vault (`supabase secrets set`).
- Modelo: `claude-sonnet-4-5`.
- POST batch de até 80 artigos pendentes (`titulo_pt IS NULL` AND `idioma <> 'pt-BR'`).
- System prompt: "tradutor médico de anestesiologia, preserva termos técnicos, retorna JSON `{titulo_pt, resumo_pt}`".
- Fallback secundário: MyMemory + Lingva (free, rate-limited) — não recomendado para qualidade médica.
- Body opcional: `{ max: 80, dryRun: false }`.

Custo Anthropic: ~$0.003/artigo × 200 artigos/mês ≈ $0.60/mês.

### C. Secrets necessários

| Secret | Onde | Obtenção |
|---|---|---|
| `ANTHROPIC_API_KEY` | Supabase Functions | console.anthropic.com → API Keys |
| `edge_fn_service_role` | Supabase Vault | service_role JWT do projeto (uso interno do cron) |
| `NCBI_API_KEY` (opcional) | Supabase Functions | ncbi.nlm.nih.gov/account → API Key Management. Aumenta rate limit 3→10 req/s. |

---

## 4. Enrichment OA + PMC (script Node)

**Path:** `scripts/enrich-noticias.cjs` (rodar quando precisar; não automatizado).

Para cada notícia com DOI e `abstract_enriched_at IS NULL`:
1. **Unpaywall** `api.unpaywall.org/v2/{doi}?email=...` → `is_oa`, `best_oa_location.url_for_pdf`.
2. **NCBI E-Utils ESearch** db=pmc por DOI → `pmc_id`.
3. **Crossref `/works/{doi}`** → `abstract` JATS (fallback se feed não trouxe).
4. UPDATE noticias com `is_open_access`, `oa_pdf_url`, `oa_provider='unpaywall'`, `pmc_id`, `abstract_enriched_at=now()`.

---

## 5. Frontend — Estrutura

### Service: `src/services/supabaseNoticiasService.js`

- `LIST_COLUMNS` slim com 19 campos para list/highlights/categoria (não `*`).
- `fetchById(id)` mantém `*`.
- Mapping camelCase ↔ snake_case completo (`tituloPt`, `oaPdfUrl`, `articleType`, `meshTerms`, `finalScore`, `isFeatured`, etc.).

### Context: `src/contexts/NoticiasContext.jsx`

Padrão **stale-while-revalidate**:
- `CACHE_KEY = 'anest:noticias:cache:v1'`, `CACHE_TTL_MS = 7d`.
- Mount → `loadFromCache()` → dispatch `SET_NOTICIAS` imediato.
- `loadNoticias({ force })` → se cache > 1h ou force, fetch fresh; compara fingerprint (`length:max(publicado_em)`); só dispatch se diferente; sempre `saveToCache(data)`.
- Callbacks **estáveis** via refs (`stateRef`, `noticiasLoadedRef`) — NÃO incluir `state.noticias` nos deps de `useCallback` (causa re-render cascata).
- Provider em **AuthGatedProviders** (Tier 1) ao invés de DeferredProviders.

### Componentes

**`src/components/noticias/NoticiaCard.jsx`** — 3 variantes:
- `carousel` — `h-[150px]`, 2 linhas título + 1 resumo, `border-l-primary`.
- `list` — `min-h-[140px]`, grid `[auto_auto_1fr]` com 3 fileiras (meta / título 2-line / resumo 2-line). Resumo placeholder `—` se vazio.
- `featured` — usado dentro de `Carousel`, similar a `list` mas com border-l-primary.
- Memoizado com comparator customizado (`id`, `variant`, `tituloPt`, `resumoPt`).

**`src/components/noticias/NoticiasCarousel.jsx`** — home top 10:
- Lê do `noticias` cached (não dispara fetch).
- `top10 = sort by finalScore desc, publicadoEm desc`.
- Header: "Destaques Científicos" + botão "Ver todos →" para `noticias`.
- Renderiza via `<HScroll>` (não `<Carousel>` do DS — ver abaixo).
- Esconde-se inteiro se `top10.length === 0`.

**`src/components/noticias/HScroll.jsx`** — substituto leve do `Carousel` DS:
- `overflow-x-auto` simples, **sem** `snap-mandatory`.
- `style={{ touchAction: 'pan-x' }}` libera pan-y para o body.
- Items `shrink-0 w-[88%] sm:w-[420px]`.
- Sem `onScroll` listener, sem state interno.

**`src/components/noticias/CategoriasGrid.jsx`** — grid 4-col com 12 categorias:
- Cards com ícone (lucide) + nome curto.
- Categorias ordenadas por contagem de artigos (mais comum primeiro).
- Vazias ficam com `opacity-40` e `cursor-not-allowed`.
- **Sem mostrar contagem numérica** ao lado do nome.

**`src/components/noticias/categoriesConfig.js`** — 12 categorias com mapeamento de ícones lucide.

### Páginas

**`src/pages/NoticiasPage.jsx`** (Central):
- Header padrão (`< Voltar` + "Central de Notícias" + ícone `LayoutGrid`).
- Body: `SearchBar` → `Tabs` (Todas + 4 revistas, scroll horizontal) → top 10 carrossel + lista paginada (20 por vez).
- Modal de Categorias aberto via `LayoutGrid` no header (DS `Modal`).
- `useDeferredValue(searchQuery)` para diferir filtro pesado.
- Sem `AnimatePresence` na lista (causa jank).

**`src/pages/CategoriaNoticiasPage.jsx`**:
- Header `< Voltar` + nome da categoria.
- Cabeçalho com ícone + descrição.
- Top 10 daquela categoria (carrossel) + 20 mais relevantes (lista paginada).

**`src/pages/NoticiaDetalhePage.jsx`**:
- Header `< Voltar` + "Notícia".
- Badges: revista (subtle), tipo de artigo (secondary), Open Access (success se `oaPdfUrl`), data formatada à direita.
- Título com borda lateral primary (estilo Gineco), título PT em destaque + original em itálico.
- Autores em linha simples.
- **Abstract estruturado** quando detecta rótulos PubMed (`BACKGROUND/METHODS/RESULTS/CONCLUSIONS` em EN ou PT) — função `parseStructuredAbstract`. Renderiza por seções (Introdução/Métodos/Resultados/Conclusões) com cabeçalho 11px uppercase + corpo 16px leading-1.75. Fallback para texto corrido.
- **Estado A** (OA): `<PDFViewer>` inline auto-mostra quando `oaPdfUrl` existe.
- **Estado B** (paywall): só abstract.
- Botões grid 2-col: Ver em PMC, Ver no PubMed, Abrir na fonte original, Copiar DOI.
- Seção Metadados: categoria, tipo, citações, score, DOI, PMID, MeSH terms (top 10 + contador).

### Roteamento `src/App.jsx`

Adicionar 3 cases novos:
```jsx
case 'noticias':
  return <NoticiasPage key="noticias" onNavigate={handleNavigate} goBack={goBack} />
case 'noticia-detalhe':
  return <NoticiaDetalhePage key={`noticia-${pageParams?.noticiaId}`} noticiaId={pageParams?.noticiaId} onNavigate={handleNavigate} goBack={goBack} />
case 'categoria-noticias':
  return <CategoriaNoticiasPage key={`cat-${pageParams?.category}-${pageParams?.journal || 'todas'}`} category={pageParams?.category} journal={pageParams?.journal} onNavigate={handleNavigate} goBack={goBack} />
```

Imports correspondentes vêm de `pages/index.js` (3 linhas a adicionar).

### Inserções na HomePage

```jsx
import { NoticiasCarousel } from '../components/noticias/NoticiasCarousel';
// ...
{/* Notícias — carrossel abaixo da SearchBar */}
<NoticiasCarousel onNavigate={onNavigate} />
```

### Inserções na EducacaoPage

```jsx
import { Newspaper } from 'lucide-react';
// ...
<WidgetCard
  icon={<Newspaper className="w-6 h-6" />}
  title="Central de Notícias"
  subtitle="Anestesiologia no mundo"
  variant="interactive"
  onClick={() => onNavigate('noticias')}
/>
```

### Provider em `src/main.jsx`

Em `AuthGatedProviders` (Tier 1, antes do `DeferredProviders`):
```jsx
<MessagesProvider>
  <NoticiasProvider>
    <DeferredProviders>
      {children}
    </DeferredProviders>
  </NoticiasProvider>
</MessagesProvider>
```

---

## 6. Operação inicial

Sequência mínima para colocar de pé do zero:

1. Criar tabela: aplicar todas as migrations 20260426*.
2. Configurar secrets: `supabase secrets set ANTHROPIC_API_KEY=...`.
3. Deploy Edge Functions: `npx supabase functions deploy fetch-noticias && npx supabase functions deploy translate-noticias`.
4. Trigger inicial via curl (uma vez): `curl -X POST https://...supabase.co/functions/v1/fetch-noticias -H "Authorization: Bearer <SERVICE_ROLE>"`.
5. Rodar `node scripts/enrich-noticias.cjs` para OA/PMC dos artigos com DOI.
6. Rodar `node scripts/run-translate-batches.cjs` em ondas até zerar pendentes.
7. Frontend: `npm run dev` → testar fluxo Home → Central → Categoria → Detalhe.
8. Deploy: `npm run build && firebase deploy --only hosting:anest-ap`.

---

## 7. Problemas conhecidos resolvidos durante a iteração

| Problema | Solução |
|---|---|
| Título sendo cortado no carrossel | `h-[150px]` + 2 linhas título + 1 resumo |
| Cards de "Mais notícias" com alturas diferentes | `min-h-[140px]` + `grid grid-rows-[auto_auto_1fr]` |
| Cores diferentes por revista poluindo a UI | Borda `border-l-primary` única + Badge `default subtle` único |
| Data relativa "há X dias" não claro | Trocada por absoluta "31 de mar." |
| Scroll vertical "travado" no app | `Carousel` DS usa `snap-mandatory` sem `touch-action` — substituído por `<HScroll>` próprio |
| Loop infinito de RLS 403 em cateter reminders | `useCateterReminders.js` `.catch` mantém `hasRun.current=true` ao invés de resetar |
| Re-renders em cascata em todos consumidores | Refs estáveis (`stateRef`) + callbacks com deps minimais |
| AnimatePresence churn na lista | Removido — só skeleton/empty/lista sem animação por card |

---

## 8. Pendências para versão futura

- **Altmetric API** key (Counts-Only para pesquisadores): aprovação manual; quando aprovado, Edge Function pode incluir `altmetric_score` real (peso 25% do score).
- **NCBI API key**: opcional, aumenta de 3 → 10 req/s.
- **Acesso ao texto não-OA**: legal apenas via Unpaywall (já implementado), PMC, ou link para fonte original. **Sci-Hub e similares são copyright infringement — recusados.**
- **Detecção editorial highlight**: hoje `editorialHighlightScore=0`. Spec sugere identificar "Editor's Choice", podcast da revista, etc. via heurística no título ou metadados Crossref.
- **RLS de notifications**: o cron de notificações tem policy estrita (`active profile self`). Para que cateter reminders/sobreaviso funcionem em batch para outros usuários, precisa relaxar a policy. Decisão de produto pendente.

---

## 9. Anexos

- Diff completo da implementação: `.central-noticias.diff.bak` (mesmo diretório).
- Plan files anteriores: `~/.claude/plans/leia-o-arquivo-claude-md-streamed-quilt.md` (histórico).
