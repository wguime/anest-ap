# SPRINT 4 — Plano de Implementação

> **Features**: F7 Pesquisa Segurança | F8 Dashboard Executivo | F9 PDF Export
> **Projeto**: ANEST v2.0 — Acreditação Qmentum
> **Data**: 12/02/2026
> **Planejado por**: Agent Team (3 agentes Explore em paralelo)

---

## RESUMO EXECUTIVO

O Sprint 4 adiciona 3 funcionalidades estratégicas para a acreditação Qmentum:

| Feature | Valor para Acreditação | Complexidade | Arquivos Novos | Arquivos Modificados |
|---------|----------------------|--------------|----------------|---------------------|
| **F7** Pesquisa Segurança | Rastreabilidade documental | Alta | 3 | 4 |
| **F8** Dashboard Executivo | Visão consolidada gestores | Média | 3 | 3 |
| **F9** PDF Export | Evidências para auditores | Média-Alta | 8 | 7 |

**Dependências entre features:**
- F8 (Dashboard) antes de F9 (Export) — o Dashboard será um relatório exportável
- F7 (Pesquisa) é independente e pode ser paralelizado com F8
- **Nenhuma nova dependência npm** para F7 e F8
- **Nenhuma nova dependência npm** para F9 (jsPDF v4.0.0 já instalado!)

---

## F7: PESQUISA SEGURANÇA (Full-Text Search)

### Estado Atual (descoberto pelos agentes)

**O que JÁ existe — client-side:**
- `src/data/searchUtils.js` — `searchAll(query)` busca seções do app + documentos mock da `biblioteca` (apenas 1 de 6 categorias)
- `src/pages/HomePage.jsx` — dropdown inline com `searchAll()`, top 5 páginas + top 4 docs
- `src/pages/SearchResultsPage.jsx` — página full de resultados (rota `'searchResults'` já existe em App.jsx)
- `src/contexts/DocumentsContext.jsx` — `searchAllDocuments(searchTerm)` busca nas 6 categorias por titulo/codigo/descricao/tags
- `src/components/SearchInput.jsx` — input com debounce 300ms e botão clear (não usado no fluxo principal)

**O que JÁ existe — Supabase:**
- `001_schema.sql` — tabela `documentos` **já tem** coluna `fts tsvector` com GIN index (`idx_doc_fts`)
- Trigger `update_documentos_fts()` **já existe** com pesos: Weight A (titulo, codigo), Weight B (descricao), Weight C (tags)
- `rpc_search_documentos()` **já existe** — FTS com `plainto_tsquery('portuguese')` + ILIKE fallback
- `src/services/supabaseDocumentService.js` — `search(query, options)` **já pronto** chamando `rpc_search_documentos`

**O que FALTA (FTS não configurado):**
- `incidentes` — campos JSONB sem FTS
- `planos_acao` — titulo/descricao/tags sem FTS
- Busca cross-table (documento + incidente + plano de ação em uma query)

### Arquitetura

```
┌──────────────────────────────────────────────────┐
│  SearchResultsPage (enhanced)                    │
│  + HomePage dropdown                             │
│  Filtros: tipo | status | categoria | data       │
│  Contagem facetada por tipo                      │
│  Cards específicos por tipo de resultado         │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  useSearch() hook                                │
│  Debounce 300ms                                  │
│  Dual path: USE_MOCK ? local : Supabase RPC      │
│  Retorna: { results, facets, isLoading, error }  │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  supabaseSearchService.js                        │
│  → rpc_search_global() (cross-table)             │
│  RLS via SECURITY INVOKER                        │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│  PostgreSQL (Supabase)                           │
│  documentos.fts (existente) + incidentes.fts     │
│  + planos_acao.fts (novos)                       │
│  GIN indexes + triggers + UNION ALL              │
└──────────────────────────────────────────────────┘
```

### Migração SQL: `014_global_fts.sql`

```sql
-- ==========================================================================
-- 014_global_fts.sql — Global Full-Text Search across tables
-- ==========================================================================

-- 1. FTS em incidentes
ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_incidentes_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('portuguese', coalesce(NEW.protocolo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.incidente_data->>'descricao', '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.incidente_data->>'local', '')), 'C') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.denuncia_data->>'descricao', '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_incidentes_fts BEFORE INSERT OR UPDATE ON incidentes
  FOR EACH ROW EXECUTE FUNCTION update_incidentes_fts();

-- Backfill
UPDATE incidentes SET fts =
  setweight(to_tsvector('portuguese', coalesce(protocolo, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(incidente_data->>'descricao', '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(incidente_data->>'local', '')), 'C') ||
  setweight(to_tsvector('portuguese', coalesce(denuncia_data->>'descricao', '')), 'B');

CREATE INDEX IF NOT EXISTS idx_incidentes_fts ON incidentes USING gin(fts);

-- 2. FTS em planos_acao
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE OR REPLACE FUNCTION update_planos_acao_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('portuguese', coalesce(NEW.titulo, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.descricao, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_planos_acao_fts BEFORE INSERT OR UPDATE ON planos_acao
  FOR EACH ROW EXECUTE FUNCTION update_planos_acao_fts();

UPDATE planos_acao SET fts =
  setweight(to_tsvector('portuguese', coalesce(titulo, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(descricao, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(array_to_string(tags, ' '), '')), 'C');

CREATE INDEX IF NOT EXISTS idx_planos_acao_fts ON planos_acao USING gin(fts);

-- 3. RPC de busca global (SECURITY INVOKER = RLS respeitado)
CREATE OR REPLACE FUNCTION rpc_search_global(
  search_query text,
  filter_type text DEFAULT NULL,
  filter_status text DEFAULT NULL,
  result_limit integer DEFAULT 30
)
RETURNS TABLE (
  result_id text, result_type text, titulo text, descricao text,
  status text, categoria text, rank float,
  created_at timestamptz, updated_at timestamptz, extra jsonb
) AS $$
DECLARE
  tsq tsquery := plainto_tsquery('portuguese', search_query);
BEGIN
  RETURN QUERY
  WITH results AS (
    SELECT d.id::text, 'documento'::text, d.titulo, d.descricao, d.status,
      d.categoria, ts_rank(d.fts, tsq)::float, d.created_at, d.updated_at,
      jsonb_build_object('codigo', d.codigo, 'tipo', d.tipo, 'versao', d.versao_atual)
    FROM documentos d
    WHERE (filter_type IS NULL OR filter_type = 'documento')
      AND (filter_status IS NULL OR d.status = filter_status)
      AND (d.fts @@ tsq OR d.titulo ILIKE '%' || search_query || '%'
           OR d.codigo ILIKE '%' || search_query || '%')
    UNION ALL
    SELECT i.id::text, 'incidente'::text, i.protocolo,
      coalesce(i.incidente_data->>'descricao', i.denuncia_data->>'descricao', ''),
      i.status, i.tipo, ts_rank(i.fts, tsq)::float, i.created_at, i.updated_at,
      jsonb_build_object('tipo', i.tipo, 'tracking_code', i.tracking_code)
    FROM incidentes i
    WHERE (filter_type IS NULL OR filter_type = 'incidente')
      AND (filter_status IS NULL OR i.status = filter_status)
      AND (i.fts @@ tsq OR i.protocolo ILIKE '%' || search_query || '%')
    UNION ALL
    SELECT pa.id::text, 'plano_acao'::text, pa.titulo, pa.descricao,
      pa.status, pa.tipo_origem, ts_rank(pa.fts, tsq)::float, pa.created_at, pa.updated_at,
      jsonb_build_object('fase_pdca', pa.fase_pdca, 'prioridade', pa.prioridade,
                         'responsavel', pa.responsavel_nome)
    FROM planos_acao pa
    WHERE (filter_type IS NULL OR filter_type = 'plano_acao')
      AND (filter_status IS NULL OR pa.status = filter_status)
      AND (pa.fts @@ tsq OR pa.titulo ILIKE '%' || search_query || '%')
  )
  SELECT * FROM results r ORDER BY r.rank DESC, r.updated_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
```

### RLS — Busca Respeita Permissões Automaticamente

| Tabela | Policy RLS Existente | Efeito na Busca |
|--------|---------------------|-----------------|
| `documentos` | `doc_select`: todo autenticado pode SELECT | Todos veem todos documentos |
| `incidentes` | `inc_select_admin` + `inc_select_own` | Admin vê todos; user vê apenas próprios |
| `planos_acao` | `pa_select_auth`: todo autenticado pode SELECT | Todos veem todos planos |

**`SECURITY INVOKER`** (não DEFINER) herda o contexto RLS do chamador.

### Arquivos

| # | Arquivo | Ação | Descrição |
|---|---------|------|-----------|
| 1 | `supabase/migrations/014_global_fts.sql` | **NOVO** | FTS triggers + GIN index em incidentes e planos_acao + `rpc_search_global()` |
| 2 | `src/services/supabaseSearchService.js` | **NOVO** | Wrapper para `rpc_search_global`, conversão camelCase |
| 3 | `src/hooks/useSearch.js` | **NOVO** | Hook: debounce 300ms, dual mock/Supabase, facets |
| 4 | `src/pages/SearchResultsPage.jsx` | **MODIFICAR** | Usar `useSearch`, filtros, cards por tipo, loading/empty |
| 5 | `src/data/searchUtils.js` | **MODIFICAR** | Manter para busca local de páginas |
| 6 | `src/pages/HomePage.jsx` | **MODIFICAR** | "Ver todos os resultados" no dropdown |
| 7 | `src/types/documents.js` | **MODIFICAR** | Constantes `SEARCH_RESULT_TYPES`, `SEARCH_FILTERS` |

**Rota `searchResults` já existe em App.jsx — sem mudança necessária.**

### Steps (18 passos, 6 fases)

**Fase 1 — Database:** Criar e executar `014_global_fts.sql`
**Fase 2 — Service:** Criar `supabaseSearchService.js`
**Fase 3 — Hook:** Criar `useSearch.js` (dual-path mock/Supabase)
**Fase 4 — UI:** Refatorar SearchResultsPage (filtros, facets, cards por tipo, highlight)
**Fase 5 — HomePage:** Link "Ver todos" + Supabase FTS no dropdown
**Fase 6 — Testes:** Mock, Supabase, RLS, português (stemming, acentos), cross-table

---

## F8: DASHBOARD EXECUTIVO

### Estado Atual (descoberto pelos agentes)

**Dashboards existentes (nenhum é executivo consolidado):**

| Página | Localização | O que mostra |
|--------|------------|-------------|
| ComplianceDashboard | `management/documents/ComplianceDashboard.jsx` | 4 stat cards, barras por categoria, docs vencidos, activity log |
| KpiDashboardOverview | `pages/kpi/KpiDashboardOverview.jsx` | Summary cards, score geral, DonutChart, lista indicadores |
| FaturamentoDashboardPage | `pages/faturamento/FaturamentoDashboardPage.jsx` | Stats faturamento, bar chart, grid eventos |
| PainelGestaoPage | `pages/PainelGestaoPage.jsx` | 21 KPI cards com sparklines |
| PlanosAcaoPage | `pages/planos-acao/PlanosAcaoPage.jsx` | Planos PDCA, DonutChart status |

**Hooks disponíveis com métricas:**

| Hook | Métricas Principais |
|------|-------------------|
| `useComplianceMetrics` | `qmentumScore`, `complianceScore`, `ropAdherence` (6 áreas), `reviewComplianceRate`, `approvalCycleTime`, `overdueByCategory`, `documentCoverage`, `recentChanges` |
| `useDocuments` | `reviewAlerts` (critical/warning/upcoming), `counts`, `searchAllDocuments` |
| `useKpiData` | `indicadores` (6 KPIs), `summary` (conformes, parciais, naoConformes, scoreGeral) |
| `useIncidents` | `incidentes`, `denuncias` (arrays com status) |
| `usePlanosAcao` | `planos`, `getOverduePlanos()`, `getPlanosByOrigem()` |

**Zero trabalho backend necessário — todos os dados vêm de hooks existentes.**

### Layout (Wireframe)

```
┌──────────────────────────────────────────┐
│ [<] Dashboard Executivo                  │ ← Header fixo (portal)
├──────────────────────────────────────────┤
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ QMENTUM SCORE           85%         │ │ ← Hero card (gauge/donut)
│ │ Parcialmente Conforme               │ │
│ │ [sparkline trend ──────]            │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌────────────┐ ┌────────────┐           │
│ │ Compliance │ │ Vencidos   │           │ ← 2x2 Summary Grid
│ │    82%     │ │     3      │           │
│ ├────────────┤ ├────────────┤           │
│ │ Pendentes  │ │ Planos     │           │
│ │     5      │ │  12 (4⚠)  │           │
│ └────────────┘ └────────────┘           │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Aderência por Área ROP              │ │
│ │ Cultura Segurança  [══════90%]      │ │
│ │ Comunicação        [═════80%]       │ │
│ │ Gestão de Riscos   [════70%]        │ │
│ │ Indicadores        [══════95%]      │ │
│ │ Vida Profissional  [═════85%]       │ │
│ │ Gestão Financeira  [═════82%]       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ KPIs: Score 78% [DonutChart sm]     │ │
│ │ 4 Conformes │ 1 Parcial │ 1 NC     │ │
│ │ [Ver Dashboard KPIs >]              │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Incidentes: 12 inc │ 3 denúncias    │ │
│ │ 5 pendentes │ 2 em análise          │ │
│ │ [Ver Gestão Incidentes >]           │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Cobertura Documental [DonutChart]   │ │
│ │ Ética 8/10 │ Comitês 6/8 │ ...     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ⚠ Alertas Críticos                  │ │
│ │ • 3 docs vencidos > 30 dias         │ │
│ │ • 2 planos ação atrasados           │ │
│ │ • 1 incidente pendente > 7 dias     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Atividade Recente (últimas 10)      │ │
│ │ Timeline...                         │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [BottomNav]                              │
└──────────────────────────────────────────┘
```

### Drill-Down (clique → navega)

| Seção Dashboard | Destino | Rota |
|----------------|---------|------|
| Qmentum Score | ComplianceDashboard | `centroGestao` (initialSection: 'documentos') |
| Docs Vencidos | Docs vencidos no Centro | `centroGestao` |
| Barras ROP (clique) | Página da categoria | `eticaBioetica`, `comites`, `auditorias`, etc. |
| KPI Summary | Dashboard KPIs | `kpiDashboard` |
| Incidentes | Gestão Incidentes | `centroGestao` (initialSection: 'incidentes') |
| Planos de Ação | Planos PDCA | `planosAcao` |
| Cobertura Documental | Gestão Documental | `gestaoDocumental` |
| Alertas (cada item) | Página relevante | varia |

### Padrões a reutilizar do código existente

- `StatCard` de `ComplianceDashboard.jsx` (linhas 98-154)
- `CategoryComplianceBar` de `ComplianceDashboard.jsx` (linhas 159-184)
- `getScoreColor()` de `ComplianceDashboard.jsx` (linhas 33-37)
- Header portal de `KpiDashboardOverview.jsx`
- BottomNav de `QualidadePage.jsx`

### Arquivos

| # | Arquivo | Ação | Descrição |
|---|---------|------|-----------|
| 1 | `src/pages/dashboard/DashboardExecutivoPage.jsx` | **NOVO** | Página principal (~350-450 linhas) |
| 2 | `src/pages/dashboard/index.js` | **NOVO** | Barrel export |
| 3 | `src/hooks/useDashboardExecutivo.js` | **NOVO** | Hook composto (~80-100 linhas) |
| 4 | `src/App.jsx` | **MODIFICAR** | Rota `case 'dashboardExecutivo':` |
| 5 | `src/pages/index.js` | **MODIFICAR** | Export da página |
| 6 | `src/pages/GestaoPage.jsx` | **MODIFICAR** | WidgetCard para acessar dashboard |

**Total estimado: ~500-650 linhas de código novo. Zero dependências novas. Zero backend.**

### Steps (6 passos)

1. **Hook** `useDashboardExecutivo.js` — compõe useComplianceMetrics + useKpiData + useIncidents + usePlanosAcao
2. **Página** `DashboardExecutivoPage.jsx` — 8 seções (Hero, Grid, ROP, KPI, Incidentes, Coverage, Alertas, Timeline)
3. **Rota** em App.jsx — `case 'dashboardExecutivo':`
4. **Navegação** — WidgetCard na GestaoPage
5. **Barrel export** — `pages/dashboard/index.js`
6. **Polish** — dark mode, responsividade, loading/empty states, drill-downs

---

## F9: PDF EXPORT

### Estado Atual (descoberto pelos agentes)

**Descoberta crucial: jsPDF v4.0.0 JÁ ESTÁ INSTALADO!**

| Dependência | Status | Uso Atual |
|-------------|--------|-----------|
| **jsPDF v4.0.0** | **Já instalado** | `certificateGenerator.js` — certificados educação |
| **xlsx v0.18.5** | **Já instalado** | `ControleEducacaoPage.jsx` — export Excel |
| react-pdf + pdfjs-dist | Já instalado | **Apenas visualização** (PDFViewer) |

**Padrão existente:** `src/pages/educacao/utils/certificateGenerator.js`
- Gera certificados A4 landscape com jsPDF
- Tem ANEST branding (logo, green theme, bordas)
- Função `loadImageAsBase64()` para logo
- Padrão de download/abertura

**Logo:** `/public/logo-anest.png`

### Decisão: jsPDF (já instalado, zero novas deps)

| Biblioteca | Veredicto |
|-----------|-----------|
| **jsPDF v4.0.0** | **ESCOLHIDO** — já instalado, padrão provado em certificateGenerator.js, leve (~300KB) |
| @react-pdf/renderer | Rejeitado — ~800KB bundle, árvore de componentes separada, overkill |
| html2canvas + jsPDF | Rejeitado — qualidade ruim para docs de acreditação, texto como imagem |

### Relatórios para Qmentum (8 templates)

**Prioridade 1 — Core:**

| # | Relatório | Dados | Hook/Service |
|---|-----------|-------|-------------|
| 1 | **Indicadores de Qualidade (KPI)** | 21 indicadores, meses, trends, status | `useKpiData` |
| 2 | **Conformidade Documental** | Score, categorias, vencidos, pendentes | `useComplianceMetrics` |
| 3 | **Incidentes** | Resumo tipo/gravidade/status, RCA | `supabaseIncidentsService` |

**Prioridade 2 — Gestão:**

| # | Relatório | Dados | Hook/Service |
|---|-----------|-------|-------------|
| 4 | **Planos de Ação (PDCA)** | Status, prioridade, responsável, prazos | `PlanosAcaoContext` |
| 5 | **Trimestral Consolidado** | KPI + Compliance + Incidentes agregados | Composição |
| 6 | **Auditorias ROPs** | 6 ROPs com % conformidade | Hardcoded + config |

**Prioridade 3 — Suplementar:**

| # | Relatório | Dados |
|---|-----------|-------|
| 7 | **Ficha Individual KPI** | 1 indicador, 12 meses, trend chart |
| 8 | **Comunicados** | Enviados, taxas de leitura |

### Arquitetura

```
src/services/pdf/
├── pdfService.js              # Factory: generate(template, data) → blob
├── pdfBranding.js             # Header/footer ANEST, cores, logo
├── pdfChartRenderer.js        # SVG → Canvas → PNG (sem deps novas)
└── templates/
    ├── kpiReportTemplate.js          # P1: KPIs
    ├── complianceReportTemplate.js   # P1: Conformidade
    ├── incidentReportTemplate.js     # P1: Incidentes
    ├── actionPlanReportTemplate.js   # P2: Planos de Ação
    ├── quarterlyReportTemplate.js    # P2: Trimestral
    └── auditReportTemplate.js        # P2: Auditorias

src/hooks/usePdfExport.js     # Hook: { exportPdf, exporting, error }
src/components/ExportButton.jsx  # Botão reutilizável com spinner
```

### Estratégia para Charts em PDF

**SVG → Canvas → PNG (zero dependências novas):**

```js
// pdfChartRenderer.js
export async function svgToPng(svgElement, width = 600, height = 300) {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;  // 2x retina
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}
```

### Branding PDF (A4 Portrait 210x297mm)

```
┌──────────────────────────────────────────┐
│ [Barra verde 6mm]                        │
│ [Logo 30x30] ANEST - Serviço de         │
│              Anestesiologia              │
│              Relatório: {titulo}         │
│              Data: {data}               │
│ [Linha verde separadora]                 │
│                                          │
│ {CONTEÚDO}                               │
│ Margens: 15mm lateral, 45mm topo         │
│                                          │
│ [Footer]                                 │
│ Página {n}/{total} | Gerado: {data}     │
│ ANEST - Qualidade e Segurança            │
│ [Barra verde 4mm]                        │
└──────────────────────────────────────────┘

Cores RGB:
  primaryDark: [0, 104, 55]   // #006837
  primary:     [0, 66, 37]    // #004225
  accent:      [46, 204, 113] // #2ECC71
  teal:        [22, 160, 133] // #16a085
  warning:     [245, 158, 11] // #F59E0B
  danger:      [220, 38, 38]  // #DC2626
```

### Arquivos

**Novos (8):**

| # | Arquivo | Descrição | Linhas Est. |
|---|---------|-----------|------------|
| 1 | `src/services/pdf/pdfService.js` | Factory central | ~150 |
| 2 | `src/services/pdf/pdfBranding.js` | Header/footer/cores (extraído de certificateGenerator.js) | ~200 |
| 3 | `src/services/pdf/pdfChartRenderer.js` | SVG→PNG | ~80 |
| 4 | `src/services/pdf/templates/kpiReportTemplate.js` | Template KPI | ~250 |
| 5 | `src/services/pdf/templates/complianceReportTemplate.js` | Template conformidade | ~200 |
| 6 | `src/services/pdf/templates/incidentReportTemplate.js` | Template incidentes | ~200 |
| 7 | `src/hooks/usePdfExport.js` | Hook de export | ~50 |
| 8 | `src/components/ExportButton.jsx` | Botão reutilizável | ~80 |

**Modificados (7 — adicionar botão "Exportar PDF"):**

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/pages/kpi/KpiDashboardOverview.jsx` | Botão export no header |
| 2 | `src/pages/kpi/KpiIndicadorDetalhePage.jsx` | Export ficha individual |
| 3 | `src/pages/GestaoDocumentalPage.jsx` | Export conformidade |
| 4 | `src/pages/incidents/IncidenteGestaoPage.jsx` | Export incidentes |
| 5 | `src/pages/planos-acao/PlanosAcaoPage.jsx` | Export planos ação |
| 6 | `src/pages/RelatoriosPage.jsx` | "Gerar Relatório" por categoria |
| 7 | `src/pages/QualidadePage.jsx` | Export geral qualidade |

### Steps (11 passos, 5 fases)

**Fase 1 — Infraestrutura Core:**
1. `pdfBranding.js` — extrair padrões do `certificateGenerator.js`
2. `pdfChartRenderer.js` — SVG→PNG
3. `pdfService.js` — factory `generate(template, data)`

**Fase 2 — Primeiro Template + Hook:**
4. `kpiReportTemplate.js` — valida toda a arquitetura
5. `usePdfExport.js` + `ExportButton.jsx`

**Fase 3 — Integração:**
6. Export em `KpiDashboardOverview.jsx`
7. Export em `KpiIndicadorDetalhePage.jsx`

**Fase 4 — Templates Adicionais:**
8. `complianceReportTemplate.js` + export em GestaoDocumentalPage
9. `incidentReportTemplate.js` + export em IncidenteGestaoPage
10. `actionPlanReportTemplate.js` + export em PlanosAcaoPage

**Fase 5 — Relatório Consolidado:**
11. Relatório trimestral + export em RelatoriosPage e QualidadePage

---

## CRONOGRAMA SUGERIDO

### Semana 1: Fundação
- [ ] F7.1: Executar migração SQL `014_global_fts.sql` no Supabase
- [ ] F7.2: `supabaseSearchService.js`
- [ ] F7.3: `useSearch.js` hook
- [ ] F8.1: `useDashboardExecutivo.js` hook

### Semana 2: UI Principal
- [ ] F7.4: Refatorar `SearchResultsPage` (filtros, facets, cards por tipo)
- [ ] F7.5: Integrar FTS na HomePage
- [ ] F8.2: `DashboardExecutivoPage.jsx` (8 seções)
- [ ] F8.3: Rota + navegação + drill-downs

### Semana 3: PDF Core
- [ ] F9.1: `pdfBranding.js` + `pdfChartRenderer.js` + `pdfService.js`
- [ ] F9.2: `kpiReportTemplate.js` (primeiro template)
- [ ] F9.3: `usePdfExport.js` + `ExportButton.jsx`
- [ ] F9.4: Integrar export em KPI pages

### Semana 4: PDF Templates + Polish
- [ ] F9.5: `complianceReportTemplate.js` + `incidentReportTemplate.js`
- [ ] F9.6: `actionPlanReportTemplate.js` + relatório trimestral
- [ ] F9.7: Adicionar botões export em todas as páginas
- [ ] ALL: Testes integrados, dark mode, responsividade

---

## NOTAS IMPORTANTES

1. **`USE_MOCK` flag** (`src/types/documents.js`, atualmente `true`) controla dual-path mock/Supabase em F7
2. **`comunicados`** ainda está no Firebase (sem migração Supabase) — incluir na busca apenas quando migrado
3. **`saesp_pdf`** (RAG/vector search) é pipeline separado — não incluir na busca global
4. **`CentroGestaoPage`** aceita `initialSection` e `initialSubSection` — drill-down pode pousar na aba correta
5. **PlanosAcaoContext e IncidentsContext** devem estar no provider tree acima do DashboardExecutivoPage
6. **Padrão existente a seguir**: `certificateGenerator.js` para PDF, `supabaseDocumentService.js` para services

## MÉTRICAS DE SUCESSO

- [ ] Busca FTS retorna resultados em < 500ms
- [ ] Dashboard carrega em < 2s com todos os dados
- [ ] PDF gerado em < 5s para relatórios de até 20 páginas
- [ ] RLS respeitado (user não vê incidentes de outros)
- [ ] FTS em português funciona (stemming, acentos)
- [ ] Dashboard responsivo em mobile
- [ ] PDFs com branding ANEST profissional
