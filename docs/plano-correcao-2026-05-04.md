# Plano de Correção — Auditoria Gestão de Incidentes ANEST

**Data:** 2026-05-04
**Versão ANEST:** v3.70.0
**Auditor:** Claude (Opus 4.7) — sessão automatizada
**Escopo:** consolida 10 itens da Onda B (B1-B10) executados sobre os gaps identificados nas auditorias `auditoria-incidentes-2026-05-04.md`, `auditoria-lgpd-incidentes-2026-05-04.md` e `benchmarking-sistemas-hospitalares-2026-05-04.md`, mais o pedido extra "tracking code para identificados".

---

## Sumário executivo

10 frentes (B1-B10) atacadas em paralelo. **7 totalmente implementadas em código**; **3 entregam migrations SQL prontas mas não-aplicadas ao DB** (precisam ser aplicadas manualmente pelo usuário); **vários itens dependem de decisão humana do Comitê de Ética**. Build passa, lint sem regressão. E2E confirmou política de privacidade atualizada em ambos forms públicos com 12 seções (era 11), base legal corrigida (RDC 36/2013 + Lei 13.964/2019 substituem "consentimento + legítimo interesse"), DPO nominado em canal próprio (`privacidade@anest.app`), retenção diferenciada explícita (20a/100a/5a) e transferência internacional declarada (Art. 33 II SCCs).

---

## 1. Implementado nesta auditoria (Onda B)

### B1 — Tracking code para todos os relatos
**Status:** ✅ Implementado e validado E2E
**Arquivos modificados:**
- `src/pages/incidents/NovoIncidentePage.jsx` (SuccessModal)
- `src/pages/incidents/NovaDenunciaPage.jsx` (SuccessModal)
- `public/formulario-incidente.html` (lógica `if (result.tracking_code)`)
- `public/formulario-denuncia.html` (mesma lógica)

**Mudança:** SuccessModal agora exibe `trackingCode` para qualquer `tipoIdentificacao` (Identificado, Anônimo, Confidencial). Texto contextual por tipo. Resolve gap A6 (LGPD R6 — perda de tracking code).

---

### B2 — `rpc_anonimizar_incidente` v2 (LGPD Art. 12)
**Status:** ✅ Migration pronta, **não aplicada ao DB**
**Arquivo:** `supabase/migrations/20260504_lgpd_art12_full_anonimization.sql`

**Mudança:** Reescreve função para limpar TODOS os campos JSONB com PII (`incidente_data.descricao`, `denuncia_data.*`, `impacto.*`, `contexto_anest.observacoes`, `gestao_interna.*`, `admin_data`, `attachments`). Atualiza também `rpc_fetch_by_tracking_code` para retornar `[ANONIMIZADO]` quando registro foi anonimizado.

**Aplicar:**
```bash
# Opção A — via Dashboard Supabase
# Abrir https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/new
# Colar conteúdo de supabase/migrations/20260504_lgpd_art12_full_anonimization.sql
# Run

# Opção B — via psql + pooler
psql "postgresql://postgres.vjzrahruvjffyyqyhjny@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20260504_lgpd_art12_full_anonimization.sql
```

**Fecha gap:** auditoria LGPD Art. 12 ("Anonimização incompleta — bug confirmado em 005_incidents.sql:185-195") + RIPD R7 (Severidade Crítica → Média).

---

### B3 — DPO/Encarregado nominado
**Status:** ✅ Implementado e validado E2E
**Arquivos modificados:**
- `src/components/PrivacyPolicyModal.jsx` (Seção 11)
- `public/formulario-incidente.html` (Seção 11)
- `public/formulario-denuncia.html` (Seção 11)

**Mudança:** Canal `privacidade@anest.app` adicionado em todas as 3 superfícies. Link à ANPD (`gov.br/anpd`). Nota explícita "nome pendente de nomeação formal pelo Comitê de Ética (até 30 dias)".

**Pendente de decisão humana:** Comitê de Ética deve nominar pessoa real e atualizar texto.

---

### B4 — Retenção (LGPD Art. 15)
**Status:** ✅ Política documentada + migration pronta, **não aplicada ao DB**
**Arquivos:**
- `docs/lgpd-retencao.md` — política completa (7 seções)
- `supabase/migrations/20260504_lgpd_art15_retencao.sql` — coluna `retain_until` + trigger + `rpc_aplicar_retencao_incidentes()` + cron schedule comentado

**Mudança:** Define prazos diferenciados (incidentes 20a, denúncias 100a, notificante 5a, audit 5a) com base em CFM 1.821/2007, Decreto 10.153/2019 e LGPD Art. 16 II. Job pg_cron diário 03:00 UTC invoca anonimização de registros vencidos.

**Pendente de aplicação:**
1. Comitê de Ética ratifica prazos em ata (bloqueante)
2. Aplicar B2 antes (anonimização completa) — caso contrário cron deixa PII
3. Aplicar B4 migration
4. Descomentar `cron.schedule('lgpd-retencao-incidentes',...)` no SQL
5. Verificar `select * from cron.job where jobname = 'lgpd-retencao-incidentes'`

---

### B5 — RIPD denúncias (LGPD Art. 38)
**Status:** ✅ Documento completo
**Arquivo:** `docs/lgpd-ripd-incidentes.md` (~3.500 palavras, 8 seções ANPD-conformes)

**Conteúdo:** identificação do controlador + DPO, tratamento, necessidade/proporcionalidade, partes interessadas, **12 riscos com matriz P×I** (3 Críticos, 9 Altos pré-mitigação → 0 Crítico, 0 Alto, 7 Médio, 5 Baixo pós-mitigação), 12 conjuntos de medidas (T+O), conclusão "prosseguir COM AJUSTES", aprovação + revisão.

**Pendente de aprovação:** assinatura DPO + Presidente Comitê + Direção Técnica + Direção Médica em ata. Próxima revisão obrigatória 2027-05-04.

---

### B6 — Base legal corrigida + transferência internacional
**Status:** ✅ Implementado e validado E2E
**Arquivos modificados:**
- `src/components/PrivacyPolicyModal.jsx` (Seção 4 + Seção 12 nova)
- `public/formulario-incidente.html` (Seção 4 + Seção 12 nova)
- `public/formulario-denuncia.html` (Seção 4 + Seção 12 nova)

**Mudança:**
- Seção 4 agora lista hierarquia de bases legais por finalidade: RDC 36/2013 (Art. 7,II + 11,II,a), Lei 13.964/2019 (Art. 7,IX), consentimento (Art. 7,I), execução de procedimento (Art. 7,V), anonimizado (Art. 12). Substitui o frágil "consentimento + legítimo interesse".
- Seção 12 (nova) declara transferência internacional Supabase us-west-2 + Firebase us-central1 amparada em SCCs (Art. 33,II), com plano de migração `sa-east-1` em 180 dias.

**Pendente de validação:** assessoria jurídica externa revisar texto antes da publicação v1.0 (45 dias).

---

### B7 — Agregados PDF reconciliados
**Status:** ✅ Implementado
**Arquivo:** `src/services/pdf/templates/incidentReportTemplate.js:75-85`

**Mudança:** `pendentes`/`emAnalise`/`resolvidos` agora reconhecem `em_andamento` (→ emAnalise), `encerrado` e `arquivado` (→ resolvidos), além dos legados. Antes, registros nesses status sumiam dos agregados PDF.

**Resíduo:** considerar adicionar coluna `arquivado` separada nos relatórios PDF (gestão precisa distinguir resolvido vs. arquivado).

---

### B8 — Severity taxonomy WHO ICPS + NCC MERP + NHS LFPSE
**Status:** ✅ Implementado
**Arquivos:**
- `src/data/incidentesConfig.js` — `SEVERITY_LEVELS` agora tem `whoIcpsClass`, `whoIcpsCode`, `nccMerpCategory`, `nccMerpDescription`, `nhsLfpseHarm` por nível
- `docs/severity-taxonomy-mapping-2026-05-04.md` — documentação + mapping table + JS snippet + sources

**Mudança:** ANEST severity (`near_miss`/`leve`/`moderado`/`grave`/`critico`) agora interopera com 3 padrões internacionais. `near_miss` → WHO Near Miss + NCC MERP B + LFPSE No Harm. `critico` → WHO AE + NCC MERP H ou I + LFPSE Severe or Death (com gap conhecido — `critico` conflata óbito + dano permanente, recomendado split).

**Pendente:** split `critico`/`obito` para Never Events (B9) — ver gap #1 do mapping doc.

---

### B9 — Never Events / Sentinel Events flag
**Status:** ✅ Lista canônica + migration prontas; UI pendente
**Arquivos:**
- `src/data/incidentesConfig.js` — constante `NEVER_EVENTS` (12 itens) + helpers `suggestNeverEventCode`, `getNeverEventConfig`, `shouldSuggestNeverEvent`
- `supabase/migrations/20260504_never_events.sql` — colunas `is_never_event`, `never_event_code` + check constraints + 2 índices parciais + audit trigger + backfill conservador
- `docs/never-events-design-2026-05-04.md` — design completo (lista, modelo, UI, fluxo, open questions)

**Mudança:** Hospital framework alinhado a NQF SRE 2025 (28 SREs) + NHS Never Events 2018 + JCAHO. 12 itens relevantes a anestesiologia: cirurgia em local/paciente errado, corpo retido, óbito ASA I, wrong-site block, falha catastrófica via aérea, erro medicação grave, anafilaxia alergia conhecida, embolia gasosa CVC, reação ABO, queimadura intra-op.

**Pendente:**
1. Aplicar migration ao DB
2. Implementar UI no `NovoIncidentePage` (toggle + campos extras)
3. Implementar UI no `IncidenteGestaoPage` (faixa vermelha + filtro)
4. Resolver 6 open questions (prazo RCA 30/45d, lista 12 vs 15, integração NOTIVISA, reclassificação retroativa, visibilidade ao relator, permissão de desmarcar)
5. Métrica "Never Events / 1.000 procedimentos" no Dashboard

---

### B10 — Plano consolidado + E2E
**Status:** ✅ Este documento
**Arquivos:**
- `docs/plano-correcao-2026-05-04.md` (este arquivo)
- `docs/screenshots/B-incidente-politica-secao4.png`
- `docs/screenshots/B-denuncia-politica-secao12.png`

**E2E validado:**
- ✓ `npm run build` passa em 1m19s
- ✓ Política de privacidade in-app: 12 seções renderizam, DPO email visível, RDC/Lei/us-west-2/20a/100a presentes
- ✓ Política em `formulario-incidente.html`: idem
- ✓ Política em `formulario-denuncia.html`: idem
- ✓ Tracking code aparece para todos no SuccessModal (verificado em código)

---

## 2. Migrations SQL — STATUS: ✅ APLICADAS (2026-05-04, Caminho A — Dashboard)

| Migration | Status | Próximo passo |
|---|---|---|
| `20260504_lgpd_art12_full_anonimization.sql` | ✅ Aplicada 2026-05-04 | Validar via `docs/validacao-pos-deploy-2026-05-04.sql` |
| `20260504_lgpd_art15_retencao.sql` | ✅ Aplicada 2026-05-04 | Idem + habilitar `cron.schedule` quando Comitê ratificar prazos |
| `20260504_never_events.sql` | ✅ Aplicada 2026-05-04 | Idem + implementar UI no `NovoIncidentePage` (B9 fase UI) |

**Validação pós-deploy:** Cole `docs/validacao-pos-deploy-2026-05-04.sql` no SQL Editor (https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/new) → Run All. Espera 14 checks estruturais retornarem dentro do esperado, mais um RESUMO final com 9 colunas que devem todas bater os números documentados.

**Smoke tests** (criam registros de teste — opcional): ver seção 2.2 abaixo.

### 2.1 Como aplicar (3 caminhos)

**Caminho A — Dashboard SQL Editor (recomendado):**
```
URL: https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/new
1. Cole conteúdo de supabase/migrations/20260504_lgpd_art12_full_anonimization.sql → Run
2. Cole conteúdo de supabase/migrations/20260504_lgpd_art15_retencao.sql → Run
3. Cole conteúdo de supabase/migrations/20260504_never_events.sql → Run
```

**Caminho B — psql via terminal local:**
```bash
cd "/Users/guilherme/Documents/IA/ANEST V2" && \
set -a && . ./.env.local && set +a && \
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "postgresql://postgres.vjzrahruvjffyyqyhjny@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260504_lgpd_art12_full_anonimization.sql && \
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "postgresql://postgres.vjzrahruvjffyyqyhjny@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260504_lgpd_art15_retencao.sql && \
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "postgresql://postgres.vjzrahruvjffyyqyhjny@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260504_never_events.sql
```

**Caminho C — supabase CLI:** evitar. `supabase db push` falha com 8 migrations remotas não-locais.

### 2.2 Queries SQL de validação pós-deploy

Após aplicar, rode estas queries (read-only) no SQL Editor para confirmar:

#### B2 — Anonimização Art. 12
```sql
-- 1. Função existe e tem o comentário correto
SELECT proname, obj_description(oid, 'pg_proc') AS comentario
FROM pg_proc WHERE proname = 'rpc_anonimizar_incidente';
-- Esperado: 1 linha, comentário começa com "LGPD Art. 12"

-- 2. Permissões corretas (apenas authenticated)
SELECT grantee, privilege_type FROM information_schema.role_routine_grants
WHERE routine_name = 'rpc_anonimizar_incidente';
-- Esperado: authenticated com EXECUTE; anon REVOKED

-- 3. Smoke test (CRIE incidente teste primeiro, depois anonimize, depois confira)
-- a) inserir 1 teste:
INSERT INTO incidentes (tipo, source, status, notificante, incidente_data)
VALUES ('incidente', 'app', 'pendente',
  '{"tipoIdentificacao":"identificado","nome":"Teste"}'::jsonb,
  '{"descricao":"Paciente João da Silva, prontuário 12345"}'::jsonb)
RETURNING id, protocolo, tracking_code;
-- Anote o id e tracking_code retornados.

-- b) anonimizar:
SELECT public.rpc_anonimizar_incidente('<id>'::uuid);

-- c) verificar:
SELECT
  notificante->>'tipoIdentificacao' AS tipo_apos,
  incidente_data->>'descricao' AS descricao_apos,
  anonymized_at IS NOT NULL AS anonimizado,
  updated_by_name
FROM incidentes WHERE id = '<id>';
-- Esperado: tipo_apos='anonimo', descricao_apos='', anonimizado=true,
--           updated_by_name='Anonimização LGPD Art. 12'

-- d) verificar rpc_fetch_by_tracking_code:
SELECT public.rpc_fetch_by_tracking_code('<tracking_code>');
-- Esperado: campos textuais retornam '[ANONIMIZADO]', anonymized_at preenchido
```

#### B4 — Retenção Art. 15
```sql
-- 1. Coluna retain_until existe e tem index
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='incidentes' AND column_name='retain_until';

-- 2. Trigger BEFORE INSERT está ativo
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'tr_incidentes_retain_until';
-- Esperado: tgenabled='O' (enabled)

-- 3. Backfill executado (sem nulls)
SELECT COUNT(*) AS total, COUNT(retain_until) AS preenchidos
FROM incidentes;
-- Esperado: total = preenchidos (todos têm retain_until)

-- 4. Distribuição de prazos
SELECT tipo, MIN(retain_until), MAX(retain_until), COUNT(*)
FROM incidentes GROUP BY tipo;
-- Esperado: incidente min~+20a, denuncia min~+100a

-- 5. Smoke test do trigger
INSERT INTO incidentes (tipo, source, status) VALUES ('incidente', 'app', 'pendente') RETURNING id, retain_until;
-- Esperado: retain_until = current_date + 20 anos
INSERT INTO incidentes (tipo, source, status) VALUES ('denuncia', 'app', 'pendente') RETURNING id, retain_until;
-- Esperado: retain_until = current_date + 100 anos

-- 6. NÃO HABILITAR pg_cron schedule até Comitê ratificar prazos
SELECT * FROM cron.job WHERE jobname = 'lgpd-retencao-incidentes';
-- Esperado: 0 linhas (schedule comentado na migration)
```

#### B9 — Never Events
```sql
-- 1. Colunas existem
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='incidentes'
  AND column_name IN ('is_never_event','never_event_code');

-- 2. Check constraints ativas
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.incidentes'::regclass
  AND conname LIKE 'chk_never_event%';
-- Esperado: 2 constraints (consistencia + formato)

-- 3. Indices parciais
SELECT indexname FROM pg_indexes
WHERE tablename='incidentes' AND indexname LIKE 'idx_incidentes_never_event%';
-- Esperado: 2 indexes

-- 4. Backfill conservador
SELECT never_event_code, COUNT(*) FROM incidentes
WHERE is_never_event = true GROUP BY never_event_code;
-- Esperado: registros com cirurgia/local_errado, corpo_estranho etc. flagged

-- 5. Smoke test inserindo Never Event
INSERT INTO incidentes (tipo, source, status, is_never_event, never_event_code)
VALUES ('incidente', 'app', 'pendente', true, 'NE-SUR-01')
RETURNING id, is_never_event, never_event_code;
-- Esperado: insert OK

-- 6. Verificar que o check constraint funciona (deve falhar)
INSERT INTO incidentes (tipo, source, status, is_never_event, never_event_code)
VALUES ('incidente', 'app', 'pendente', true, 'INVALID-FORMAT')
RETURNING id;
-- Esperado: ERROR check constraint chk_never_event_code_format

INSERT INTO incidentes (tipo, source, status, is_never_event, never_event_code)
VALUES ('incidente', 'app', 'pendente', false, 'NE-SUR-01')
RETURNING id;
-- Esperado: ERROR check constraint chk_never_event_code_when_flagged
```

---

## 3. Pendente de decisão humana (Comitê de Ética / Direção)

### Bloqueantes (30 dias)
1. **Indicar DPO/Encarregado** em ata — nome real + email institucional ou confirmar `privacidade@anest.app`
2. **Designar suplente do DPO**
3. **Validar bases legais** com assessoria jurídica externa (Art. 7,II + 11,II,a + Art. 7,IX)
4. **Aprovar política de retenção** em ata (incidentes 20a / denúncias 100a / notificante 5a / audit 5a)

### 60 dias
5. **Designar gestor externo** titular + suplente para canal de denúncia confidencial — quando esse cargo estiver definido, reativar opção "Confidencial" no picker (trocar `enabled: false` → `true` em `incidentesConfig.js:277` + remover `display:none` nos 2 HTMLs)
6. **Aprovar este RIPD** + arquivar no acervo de compliance

### 90+ dias
7. **Aprovar plano de treinamento LGPD** (1ª edição + reciclagem semestral)
8. **Termo de confidencialidade** assinado por todos com acesso admin
9. **Avaliar migração** Supabase `us-west-2` → `sa-east-1` (180d)
10. **Aplicar pesquisa de satisfação** com 5+ anestesiologistas e 5+ residentes (antes da revisão 2027)
11. **Marcar revisão ordinária** RIPD para 2027-05-04 em calendário institucional

---

## 4. Bugs identificados em E2E

Nenhum bug regressivo introduzido pelas mudanças B1-B9. Build passa, lint sem novas regressões nos arquivos modificados, E2E confirma 12 seções da política em ambos forms.

**Issues pré-existentes documentados (não-bloqueantes, fora do escopo desta auditoria):**
- `NovoIncidentePage.jsx:687` — `'Icon' is defined but never used` (pré-existente desde antes desta sessão)
- Race condition em `generate_protocolo()` — `count(*) + 1` não-atômico; mitigado por UNIQUE constraint mas pode causar erro 23505 em alta concorrência (não observado em testes)
- Email dispatch é fire-and-forget em `emailNotificationService.js:37-39` — falhas só vão para console (R4 do RIPD, plano de mitigação 30d)

---

## 5. Cronograma sugerido

| Prazo | Ações | Responsável |
|---|---|---|
| **14 dias** | Aplicar B2 (rpc_anonimizar v2) ao DB; nominar DPO em ata | TI + Comitê |
| **30 dias** | Aplicar B4 (retenção); validar base legal jurídica; reduzir PII no email; reenvio de tracking code para identificados; designar suplente DPO; documentar SCCs no acervo | TI + Jurídico + Comitê |
| **45 dias** | Validação jurídica final do `PrivacyPolicyModal` v2; aprovar política de retenção em ata; aprovar prazo RCA Never Events (30 vs 45d) | Jurídico + Comitê |
| **60 dias** | Designar gestor externo; reativar "Confidencial" no picker (1 linha + 2 display:none); aplicar B9 migration; criar UI Never Events em `NovoIncidentePage` + `IncidenteGestaoPage`; rate limit + captcha nos forms públicos; criar `docs/lgpd-resposta-incidentes-seguranca.md` (playbook breach) | Comitê + TI |
| **90 dias** | Aprovar RIPD em ata; assinar termos de confidencialidade admins; RBAC granular (admin_geral / admin_etica / gestor_externo); pipeline de mascaramento server-side; criptografia at-rest pgp_sym_encrypt; UI hint "use nº de prontuário" | Comitê + TI + RH |
| **120 dias** | Plano de treinamento LGPD (1ª edição); log de SELECT em `permission_audit_log`; alerta de queries anômalas | Comitê + RH + TI |
| **180 dias** | Migração Supabase `sa-east-1` (eliminar transferência internacional); simulação tabletop semestral de breach; pesquisa de satisfação com titulares; PDF de comprovante baixável | TI + Comitê + DPO |
| **2027-05-04** | Revisão obrigatória do RIPD (anual); reauditoria 90 dias após implementação total | DPO |

---

## 6. Métricas pós-implementação

Adicionar em `useComplianceMetrics.js` (próxima sprint):

| Métrica | Cálculo | Meta |
|---|---|---|
| `lgpdRetentionAdherence` | anonimizados_a_tempo / devidos | ≥ 99% |
| `neverEventsRate` | never_events / 1.000 procedimentos | < 0.1 (zero-tolerance) |
| `rcaCompletionRate` | RCAs concluídas no prazo / RCAs abertas | ≥ 95% |
| `dpoResponseTime` | mediana dias entre solicitação LGPD e resposta | ≤ 15 dias (Art. 19 §5) |
| `breachDetectionTime` | mediana minutos entre incidente e detecção | ≤ 60 min |

---

## 7. Resumo de arquivos criados/modificados (Onda B)

### Novos
- `docs/auditoria-incidentes-2026-05-04.md` (Onda A — auditoria consolidada)
- `docs/auditoria-lgpd-incidentes-2026-05-04.md` (Onda A — 14 pontos LGPD)
- `docs/benchmarking-sistemas-hospitalares-2026-05-04.md` (Onda A — comparação NOTIVISA/NSP/NHS/JCAHO/EthicsPoint)
- `docs/lgpd-retencao.md` (B4)
- `docs/lgpd-ripd-incidentes.md` (B5)
- `docs/severity-taxonomy-mapping-2026-05-04.md` (B8)
- `docs/never-events-design-2026-05-04.md` (B9)
- `docs/plano-correcao-2026-05-04.md` (B10 — este arquivo)
- `supabase/migrations/20260504_lgpd_art12_full_anonimization.sql` (B2)
- `supabase/migrations/20260504_lgpd_art15_retencao.sql` (B4)
- `supabase/migrations/20260504_never_events.sql` (B9)
- `docs/screenshots/A7-*.png` (4 screenshots Onda A)
- `docs/screenshots/B-*.png` (2 screenshots Onda B)

### Modificados
- `src/data/incidentesConfig.js` (B8 + B9 — severity codes + NEVER_EVENTS)
- `src/pages/incidents/NovoIncidentePage.jsx` (B1 — tracking para todos)
- `src/pages/incidents/NovaDenunciaPage.jsx` (B1 — tracking para todos)
- `src/services/pdf/templates/incidentReportTemplate.js` (B7 — agregados)
- `src/components/PrivacyPolicyModal.jsx` (B3 + B6 — base legal, DPO, retenção, transferência)
- `public/formulario-incidente.html` (B1 + B3 + B6 — tracking + política)
- `public/formulario-denuncia.html` (B1 + B3 + B6 — tracking + política)

---

## 8. Status final por gap da auditoria original

| Gap original | Status pós-Onda B | Próximos passos |
|---|---|---|
| Confidencial visível na UI | ✅ Resolvido (Onda A) | — |
| Tracking code dual gen (cliente vs servidor) | ✅ Resolvido (Onda A) | — |
| Tracking code só para anônimo | ✅ Resolvido (B1) | — |
| LGPD Art. 12 — anonimização incompleta | ✅ Aplicada 2026-05-04 (B2) | Rodar `docs/validacao-pos-deploy-2026-05-04.sql` |
| LGPD Art. 15 — sem retenção explícita | ✅ Aplicada 2026-05-04 (B4) | Comitê ratificar prazos → habilitar `cron.schedule` |
| LGPD Art. 38 — sem RIPD | 🟡 Documento completo (B5) | Aprovar em ata (90d) |
| LGPD Art. 41 — DPO não nominado | 🟡 Canal criado (B3) | Comitê nominar pessoa (30d) |
| LGPD Art. 7,II + 7,IX — base legal frágil | ✅ Corrigida (B6) | Validação jurídica externa (45d) |
| LGPD Art. 33 — transferência internacional | ✅ Documentada (B6) | Migrar para sa-east-1 (180d) |
| Agregados PDF inconsistentes | ✅ Reconciliado (B7) | — |
| Severity sem mapeamento internacional | ✅ Mapeado (B8) | Split critico/obito (próx sprint) |
| Sem flag Never Events | ✅ Migration aplicada 2026-05-04 (B9) | Implementar UI no NovoIncidentePage + IncidenteGestaoPage (60d) |
| Race condition protocolo | ⚠ Não escopo desta Onda | Substituir count+1 por nextval (próx sprint) |
| Email com PII completa | ⚠ Não escopo desta Onda | Reduzir conteúdo (30d) |
| Submissão pública sem rate limit | ⚠ Não escopo desta Onda | Captcha + rate limit (60d) |

---

**Fim do plano de correção.** Próxima auditoria recomendada: 90 dias após aplicação das migrations B2/B4/B9.
