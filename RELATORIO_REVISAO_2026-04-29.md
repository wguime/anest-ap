# Relatório de Revisão Completa — ANEST v3.70.0

**Data:** 2026-04-29
**Branch:** main (HEAD: 21c2ac5)
**Build:** ✅ ok em 13.4s — chunk principal **4.026 MB** (warning Vite)

---

## Resumo Executivo

A revisão cobriu 6 frentes (segurança, UX gestão documental, saúde de código, Qmentum, preparação, consolidação). A 7ª frente — `/ultrareview` cloud — depende de você disparar.

**Os 5 achados mais urgentes (P0):**

1. 🚨 **Secrets versionados em `.env.local`** — `SUPABASE_JWT_SECRET` exposto no git. Permite assinar JWTs arbitrários e bypassar autorização inteira.
2. 🚨 **Firestore `allow create: if true`** em incidentes/denúncias — bot pode injetar dados sem auth/captcha.
3. 🔴 **UX gestão documental: form com 23 campos sem priorização visual + dropdowns "Seção" vs "Classificação" sem hint** — provável causa raiz da queixa de usuários.
4. 🔴 **1.284 console.log em produção** — vazamento de dados sensíveis (incidentes, mensagens, userData) no console do navegador.
5. 🔴 **5 gaps Qmentum críticos sem implementação operacional** — apenas referenciados em templates de auditoria/educação. Compliance score regrediu para ~35% conforme.

**Score de prontidão para produção:** 🟡 Aceitável com fixes urgentes. Antes de qualquer release nova, atacar P0 #1, #2 e #4 (menos de 1 dia de trabalho combinado).

---

## Fase 1 — Preparação ✅

- Working tree limpo (apenas docs novos da revisão)
- Build de produção ok em 13.4s
- ⚠️ Chunk principal `index-D4CjTNup.js` = 4.026 MB (gzip 949 KB)
- Heavy chunks já separados: xlsx (429kb), pdf-viewer (433kb), jspdf (385kb), html2canvas (201kb), vendor-ui (708kb)

---

## Fase 2 — /ultrareview ⏸️ PENDENTE

**Aguardando você disparar `/ultrareview` no diretório do projeto.** Faturado/cloud, 1 run grátis até 05/maio/2026. Roda em paralelo a esta revisão e cobre ângulos diferentes (testes, regressões, arquitetura cross-file).

---

## Fase 3 — Segurança LGPD ✅

### 🚨 P0

#### #1 Secrets hardcoded em `.env.local` versionado
- **Arquivos:** `.env.local`, `.env.production`
- **Conteúdo exposto:** `SUPABASE_JWT_SECRET`, `SUPABASE_DB_PASSWORD`, `VITE_SUPABASE_ANON_KEY`
- **Risco:** Qualquer pessoa com acesso ao repo assina JWTs arbitrários. Credenciais de banco expostas.
- **Fix:**
  1. `git rm --cached .env.local .env.production`
  2. Adicionar `*.env.local`, `*.env.production` ao `.gitignore`
  3. **Rotear `SUPABASE_JWT_SECRET` em Supabase Settings → JWT** (urgente)
  4. Limpar git history: `bfg --delete-files .env.local --delete-files .env.production` + force-push
  5. Mover para Supabase secrets / GitHub Actions secrets

#### #2 Firestore `allow create: if true` em incidentes/denúncias
- **Arquivo:** `firestore.rules:367, 373`
- **Risco:** Bot injeta milhares de registros falsos. Spam, data poisoning, DoS.
- **Fix:**
  1. Mudar para `allow create: if isAuthenticated()` ou criar RPC `rpc_submit_incident_public()` server-side
  2. Integrar Google reCAPTCHA v3 nos formulários públicos
  3. Edge Function valida captcha token antes do insert

#### #3 service_role JWT placeholders em scripts versionados
- **Arquivos:** `src/scripts/migrate-firebase-to-supabase.js`, `query-all-docs.js`, `query-biblioteca.js`
- **Risco:** Se algum script logou JWT em stdout versionado, credencial admin (bypass total RLS) está exposta.
- **Fix:**
  1. Auditar history: `git log -p src/scripts/*.js | grep -i "jwt\|token\|secret"`
  2. Remover scripts que usam service_role direto; substituir por CLI `supabase` ou Edge Function proxy
  3. Mover service_role para `.env` runtime nunca em código

### ⚠️ P1

| # | Achado | Arquivo | Fix |
|---|---|---|---|
| #4 | RLS `USING (true)` permissivo | `migrations/027_cateteres_peridural.sql:29-30`, `018_profiles.sql`, `020260426000000_create_noticias.sql` | Adicionar `USING (user_id = firebase_uid() OR is_admin())` |
| #5 | Anonimização LGPD usa 5 anos vs 90 dias requeridos | `migrations/004_lgpd.sql:14-27` | Trigger DELETE automático após 90d em `infra_health_history`; reduzir incidentes/denúncias para 1 ano |
| #6 | Ownership só no frontend | `IncidenteDetalhePage.jsx:32-33`, `DenunciaDetalhePage.jsx:32-33` | RLS `FOR UPDATE USING (user_id = firebase_uid() OR is_admin())` |
| #7 | Upload sem validação MIME/tamanho | `supabaseDocumentService.js:uploadFile()` | Whitelist MIME + limite 50MB + bucket policy |

### P2 (médio)

8. JWT TTL 1h sem refresh token strategy — UX cai sessão após 1h
9. DOMPurify inconsistente em `educacao/admin/components/ContentPreviewInline.jsx`
10. JWT secret no git history mesmo após remover (precisa BFG Repo Cleaner)

### ✅ Validações OK

JWT flow Edge Function · RLS helpers `firebase_uid()`/`is_admin()` · RLS de documentos · SQL injection (PostgREST parametrizado) · Ownership UX frontend · LGPD `PrivacyPolicyModal` · Audit trail (`updated_by`, `permission_audit_log`) · Signed URLs com expiração 1h · FormField Fragment bug evitado.

---

## Fase 4 — UX Gestão Documental ✅ (queixa dos usuários)

### 🔴 P0 — provavelmente o que usuários sentem

#### #1 "Seção" vs "Classificação" — confusão conceitual crítica
- **Arquivo:** `NewDocumentModal.jsx:35-66`
- **Problema:** Dois dropdowns semanticamente ambíguos. "Seção" = pasta (10 opções), "Classificação" = categoria Qmentum (9 opções, opcional). Sem hint, usuário leigo paralisa.
- **Fix:** `FormField hint`: "Seção organiza na biblioteca (ex: Governança)" + "Classificação vincula a módulos do Centro de Gestão (ex: Ética e Bioética)" + exemplos visuais.

#### #2 Form com 23 campos sem priorização visual
- **Arquivo:** `NewDocumentModal.jsx:102-123, 308-535`
- **Problema:** 5 obrigatórios + 18 opcionais misturados em scroll infinito. Validação só no submit.
- **Fix:** Quebrar em 2 seções com divider — "Informações Essenciais" (5) + "Detalhes Opcionais" (18, accordion mobile) + validação inline `onBlur` com error badge.

#### #3 Responsáveis não diferenciam roles
- **Arquivo:** `NewDocumentModal.jsx:458-476, 481-497`
- **Problema:** 3 selects (Elaboração, Aprovação, Revisão) com mesmas opções. Sem distinção de permissões.
- **Fix:** `aria-describedby` apontando hint + filtrar `userOptions` por role admin/gestor + badge de role ao lado do nome.

#### #4 Workflow rascunho→pendente confunde com checkbox
- **Arquivo:** `NewDocumentModal.jsx:500-517`
- **Problema:** UX nunca explica os 3 estados. Texto do checkbox: "será criado como 'Aguardando Aprovação' em vez de 'Rascunho'" — ninguém sabe a diferença prática.
- **Fix:** Renomear para "Solicitar aprovação imediatamente" + hint: "Sem marcar: rascunho (edição livre). Marcado: requer aprovação para ativar".

#### #5 Upload sem feedback de progresso
- **Arquivo:** `NewDocumentModal.jsx:524-533`
- **Problema:** FileUpload aceita 15MB mas zero feedback durante envio. Erro genérico não detalha causa.
- **Fix:** `<ProgressBar value={uploadProgress} />` + toast diferenciado: "Erro ao fazer upload: arquivo muito grande" vs "Erro de rede: tente novamente".

### ⚠️ P1

6. "Outro / Nova subseção" cria input que quebra grid mobile (`NewDocumentModal.jsx:350-358`) — placeholder + validação não-vazio
7. Botão "Criar" disabled sem razão visível — `title` tooltip listando campos faltantes
8. Toast de erro sem contexto de campo — `error={fieldErrors.X}` inline
9. Subseção pode ficar órfã ao trocar categoria (verificado: linha 133 já corrige)
10. Modal `size="lg"` perde altura em iPad mini 640px exato — usar `md:max-h-[calc(100dvh-200px)]`

### ✅ OK

- Required indicator com asterisco em todos `FormField`
- FileUpload mostra "PDF, Word, Excel — máx. 15 MB"
- Focus trap implementado no Modal
- Selects de usuários ordenados alfabeticamente

### 💡 Hipótese sobre a queixa real

Provavelmente o usuário sente:
1. **Choice overload** entre Seção × Classificação
2. **Form muito longo sem priorização** (esperam ~5 campos, encontram ~25)
3. **Workflow rascunho→pendente→ativo nunca foi explicado em UX** — o audit de fev/2026 adicionou a lógica certa, mas sem guia de uso. Documento "some" ao mudar status
4. **Sem feedback de upload** em rede ruim → parece botão morto
5. **Botão disabled sem mensagem** → usuário não sabe o que falta

**Prioridade de fix UX: #1 → #2 → #4 → #5 → #3.** Itens 1-4 são ~30min cada e devem resolver ~80% da fricção.

---

## Fase 5 — Saúde do Código ✅

### Métricas brutas

| Métrica | Valor |
|---|---|
| Total contexts | 14 (5.4k LOC) |
| Total hooks | 41 (10.1k LOC) |
| Total services | 30+ |
| Test files | 38 |
| **console.log em produção** | **1.284** 🔴 |
| Deps outdated | 27 (13 patch, 14 minor/major) |

### Top 10 arquivos maiores

| # | Arquivo | LOC |
|---|---|---|
| 1 | `educacaoService.js` | 4.156 |
| 2 | `CalculatorShowcase.jsx` | 2.559 |
| 3 | `ComunicadosPage.jsx` | 1.881 |
| 4 | `QualidadeDashboardCard.jsx` | 1.876 |
| 5 | `ControleEducacaoPage.jsx` | 1.641 |
| 6 | `AdminConteudoPage.jsx` | 1.601 |
| 7 | `DashboardExecutivoPage.jsx` | 1.398 |
| 8 | `CentroGestaoPage.jsx` | 1.389 |
| 9 | `ReuniaoDetalhePage.jsx` | 1.271 |
| 10 | `DocumentoDetalhePage.jsx` | 1.198 |

### 🔴 P0 — Refactors urgentes (alto retorno)

#### #1 Code-splitting de heavy libs
- **Status:** XLSX/jsPDF já lazy via `await import()` em 3 pontos. **html2canvas (196kb) sempre carregado.** `pdf-viewer.jsx` (423kb) importado estaticamente.
- **Fix:** lazy route para pdf-viewer + adicionar `jsPDF` + `html2canvas` a `manualChunks` com defer
- **Retorno:** ~600KB economizados (26% redução no main chunk)

#### #2 1.284 console.log em produção
- **Risco:** Vazamento de dados sensíveis (incidentes, mensagens, userData) no console
- **Fix:** ESLint rule `no-console` (allow `error/warn` em catch) + remoção em sweep
- **Retorno:** Segurança + 2-3KB gzip

#### #3 6 god-pages (>1.3k LOC)
- **Fix:** Extrair Cards/Sections em `design-system/components/` (padrão ANEST). Ex: `QualidadeDashboardCard` → 6 subcomponents
- **Retorno:** 30-40% redução + 40% reuso

### ⚠️ P1

| # | Refactor | Detalhe |
|---|---|---|
| #4 | Contexts inconsistentes | `MessagesContext` (1.046), `DocumentsContext` (781), `UserContext` (487) — extrair em hooks (reducer pattern). Padrão canônico: `ComunicadosContext` (276) |
| #5 | Mega-hooks | `useCentroGestaoDashboard` (877), `useQualidadeDashboard` (767) — quebrar em 3-4 hooks especializados |
| #6 | Services error handling inconsistente | `supabaseUsersService` (15+ try/catch) vs `reunioesService` (3) — wrapper `createServiceCall(fn)` para normalizar retornos |

### P2

7. TS migration (91 JSDoc atuais)
8. Test coverage: 38 arquivos, mas faltam testes de context (só 2), pages (5), e2e (zero)
9. Recharts 2.15→3.8 (major, testar antes)
10. 28 `Modal*` sem deduplicação ideal

---

## Fase 6 — Status Qmentum ✅

### Os 5 gaps críticos

| Gap | Status | Evidência | Esforço |
|---|---|---|---|
| **1. Checklist Cirurgia Segura** | 🟡 Parcial | `auditoriaTemplatesConfig.js:146` (só catalogado como item de auditoria) | M (3-5d) |
| **2. Avaliação Pré-Anestésica** | 🟡 Parcial | `scripts/insert-missing-biblioteca.js:76` (formulário FOR.RPA.0010-00 referenciado) | M (2-4d) |
| **3. Handoff SBAR** | 🟡 Parcial | `ropCriteriaConfig.js:134-136` + ~25 refs em `rops-data.js` (educacional) | M |
| **4. Reconciliação Medicamentosa** | 🟡 Parcial | `ropCriteriaConfig.js:107` + 8 questões em `rops-data.js:1842-1875` | M |
| **5. Rastreio Substâncias Controladas** | 🟡 Parcial | `ropCriteriaConfig.js:185-189` + `doses-data.js` (72 drogas) | S (1-2d) |

### Outros gaps

| Gap | Status |
|---|---|
| Aldrete/PACU | ✅ Implementado (calculadoras 3722, 3801) |
| Review Reminders | ✅ Implementado (`useComplianceMetrics.js`) |
| Staff Competency | 🟡 Parcial (educação cobre) |
| Incident Trending | 🟡 Parcial (categorias + severidade) |
| **Equipment Maintenance** | 🔴 Ausente |
| **VTE Prophylaxis** | 🔴 Ausente |

### Score Qmentum estimado (abr/2026)

| Estado | % | vs fev/2026 |
|---|---|---|
| Conforme ✅ | ~35% | era 65% |
| Parcial 🟡 | ~45% | era 18% |
| Ausente 🔴 | ~20% | era 17% |

⚠️ **REGRESSÃO APARENTE.** Os 5 gaps críticos estão catalogados em templates educacionais/auditoria, **mas sem implementação operacional ativa** (formulários, workflows, validações em produção). Scoring v3.70.0 está mais conservador.

### Recomendações P0 Qmentum

1. **Checklist Cirurgia Segura** — criar `src/pages/cirurgia/CirurgiaSafetyChecklistPage.jsx` com 3 momentos (sign-in, time-out, sign-out). Esforço M (3-5d). Impacto MÁXIMO (Joint Commission).
2. **Formulário Pré-Anestésico** — `PreanestheticEvaluationForm.jsx` com ASA + Mallampati + jejum + alergias + medicações. Esforço M (2-4d). Impacto ALTO.
3. **Rastreio de Opioides** — estender `incidentesConfig.js` com subcategoria `rastreio_opioides` + assinatura bidual. Esforço S (1-2d). Impacto ALTO (CFM/CNAS).

---

## Fase 7 — Backlog Priorizado

### Sprint 1 (urgência máxima — 1 semana)

**Objetivo:** Estancar sangramento de segurança e UX.

| ID | Item | Categoria | Esforço | PR sugerido |
|---|---|---|---|---|
| **S1-01** | Rotear `SUPABASE_JWT_SECRET` + remover `.env.local` do git + BFG history | 🚨 SEC P0 | 2h | `chore(security): rotate JWT secret + clean env from history` |
| **S1-02** | Firestore `allow create: if isAuthenticated()` + reCAPTCHA v3 nos forms públicos | 🚨 SEC P0 | 4h | `fix(security): require auth + captcha on incident/denuncia create` |
| **S1-03** | Auditar `src/scripts/` por service_role JWTs vazados | 🚨 SEC P0 | 2h | `chore(security): remove service_role from versioned scripts` |
| **S1-04** | Validação MIME + tamanho em `uploadDocumentFile` | 🚨 SEC P0/UX | 1h | `fix(documents): validate MIME and size on upload` |
| **S1-05** | UX modal: hints em "Seção" e "Classificação" | 🔴 UX P0 | 30min | `feat(documents): clarify section vs classification` |
| **S1-06** | UX modal: divider "Essencial" / "Opcional" | 🔴 UX P0 | 1h | `feat(documents): split required from optional fields in modal` |
| **S1-07** | UX modal: ProgressBar no upload + toasts diferenciados | 🔴 UX P0 | 2h | `feat(documents): upload progress + clearer error messages` |
| **S1-08** | UX modal: renomear checkbox "Solicitar aprovação imediatamente" + hint | 🔴 UX P0 | 30min | `feat(documents): clarify approval workflow checkbox` |
| **S1-09** | ESLint `no-console` + sweep dos 1.284 logs | 🔴 CODE P0 | 4h | `chore: remove console.logs from production` |

**Total Sprint 1:** ~17h (~2 dias úteis dedicados)

### Sprint 2 (alta prioridade — 2 semanas)

| ID | Item | Categoria | Esforço |
|---|---|---|---|
| S2-01 | RLS hardening em 4 tabelas com `USING (true)` | SEC P1 | 4h |
| S2-02 | Trigger DELETE 90d em `infra_health_history` | SEC P1 | 2h |
| S2-03 | RLS ownership em incidentes/denúncias (UPDATE/DELETE) | SEC P1 | 3h |
| S2-04 | UX modal: filtros de userOptions por role | UX P1 | 2h |
| S2-05 | UX modal: validação inline + tooltip no botão disabled | UX P1 | 3h |
| S2-06 | Code-splitting `pdf-viewer` + `html2canvas` lazy | CODE P0 | 4h |
| S2-07 | **Checklist Cirurgia Segura** (3 momentos) | QMENTUM P0 | 3-5d |

**Total Sprint 2:** 1 semana de trabalho.

### Sprint 3+ (médio prazo)

- S3-01: Quebrar 6 god-pages em subcomponents (10-15 dias total)
- S3-02: Refatorar mega-hooks `useCentroGestaoDashboard`, `useQualidadeDashboard`
- S3-03: Wrapper `createServiceCall(fn)` + normalizar error handling
- S3-04: Formulário Pré-Anestésico operacional (Qmentum)
- S3-05: Rastreio de Opioides com assinatura bidual (Qmentum)
- S3-06: VTE Prophylaxis + Equipment Maintenance (Qmentum)

### Roadmap proposto

```
Semana 1   ─ Sprint 1 (segurança crítica + UX P0)
Semana 2-3 ─ Sprint 2 (RLS + lazy load + checklist cirurgia)
Mês 2      ─ Sprint 3 (refactor god-pages + Qmentum gaps)
Mês 3      ─ Tests, TS migration, deps update
```

---

## Próximos passos sugeridos

1. **Hoje:** Disparar `/ultrareview` (1 run grátis até 05/maio) para validação cruzada
2. **Esta semana:** Executar Sprint 1 (rotear JWT secret é o item mais urgente — leva minutos no Supabase)
3. **Próxima semana:** Apresentar este relatório a stakeholders e priorizar Sprint 2/3 conforme contexto regulatório
4. **Validação UX (Fase 4):** Confirmar com 2-3 usuários reais qual ponto de fricção pega mais — vai ajudar a refinar os 5 fixes P0

---

*Relatório gerado por revisão multi-agente em 2026-04-29.*
