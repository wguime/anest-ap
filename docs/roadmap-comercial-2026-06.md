# Roadmap Comercial ANEST — Produtização (2026-06)

> **Data:** 2026-06-10 · **Escopo:** transformar o app interno ANEST (v5.x) em SaaS B2B multi-tenant para grupos/cooperativas de anestesiologia
> **Base:** 5 análises sobre o código real do repo (mercado, fundação técnica, v1, v2, v3) + pesquisa web 2026-06
> **Convenção de esforço:** todas as estimativas em **dias úteis de 1 dev sênior + Claude Code**, calibradas no histórico real do projeto (Sprint 1 do plano v5.x: 22 dias úteis para 7 waves)
> **Documento irmão (padrão de formato):** `docs/planejamento-melhorias-2026-05-16.md`

## Sumário executivo

- **Tese do produto:** *"o sistema de gestão do serviço de anestesia"* — única plataforma que junta evidência de acreditação (documentos com workflow, incidentes, comunicados com confirmação de leitura, educação certificada) **e** operação (escalas, residência, sobreaviso), vendida **ao grupo/CSA**, não ao hospital. Argumento: *"quando o hospital acreditado auditar o serviço de anestesia, a evidência sai pronta daqui"*.
- **Mercado:** nicho de baixas centenas de organizações (22 cooperativas FEBRACAN, 667 hospitais acreditados crescendo ~7%/ano), fatiado em 3 silos que não conversam (SGQ horizontais caros, apps de escala sem qualidade, notificação de incidentes embutida); nenhum player publica preço.
- **Sequência:** **Fundação** (multi-tenancy + router + dados em banco + convites + testes de isolamento, 41–52 d úteis) → **v1** Qualidade + Documentos + Incidentes + Comunicados (38 d) → **v2** Educação/LMS (48 d) → **v3** Residência + APS (63 d). Total ~190–200 dias úteis ≈ **9–10 meses de dev único**.
- A **Fundação não é vendável** — é pré-requisito: hoje o app assume um único tenant implícito (RLS por usuário, escalas no bundle, navegação sem URL, allowlist manual). É refit, não rewrite.
- O **v1 é o produto vendável mínimo**: ciclo PDCA auditável + pacote de evidências ONA/Qmentum exportável + console self-service com billing Stripe; a ANEST é o tenant 0 e toda wave fecha com "produção ANEST sem regressão".
- O **v2 (LMS)** é upsell aos tenants do v1: migração Educação Firestore→Supabase, vídeo first-party (Mux) com playback assinado por tenant, captions com revisão humana, cobrança de prazo server-side e relatório de turma verificável para o auditor.
- O **v3** corta em dois releases: **v3.0 Residência** (rotações + logbook CNRM + avaliações + carga horária 60h) vendável à COREME isoladamente, e **v3.1 APS** condicionado a parecer regulatório RDC 657/2022.
- **Gates de decisão (seção final):** Fundação só com demanda validada em campo (3–5 descobertas FEBRACAN); construção do v1 só com **2 clientes design-partner assinados**; v2 só com v1 estável e demanda puxada; **APS só com parecer regulatório**.
- **Fora de escopo decidido:** calculadoras clínicas (risco SaMD máximo sem diferencial — ficam exclusivas da ANEST), gravação de vídeo in-app (decisão prévia do dono), NF-e/boleto no v1, qualquer recomendação clínica automatizada.
- **Riscos transversais dominantes:** enquadramento SaMD, LGPD como operador de dado de saúde de terceiros (DPA + RIPD + expectativa ISO 27001 em procurement), bus factor = 1 e custo de suporte — consolidados em "Go/No-Go e Riscos".

---

## Mercado e Concorrência

> Pesquisa web realizada em 2026-06 (7 buscas). Dados sem fonte verificável estão marcados como **não encontrado** — nenhum número ou preço foi estimado sem base.

### 1. Tamanho de mercado (Brasil)

| Métrica | Valor | Fonte |
|---|---|---|
| Anestesiologistas no Brasil | **22.367** (4,7% dos especialistas; Demografia Médica 2025, FMUSP/AMB/MS) | [gov.br/saude](https://www.gov.br/saude/pt-br/assuntos/noticias/2025/abril/usuarios-de-plano-de-saude-tem-mais-acesso-a-cirurgias-do-que-pacientes-do-sus-aponta-demografia-medica-2025) |
| Cooperativas de anestesiologia filiadas à FEBRACAN | **22 filiadas**, presentes em todas as regiões | [febracan.com.br](https://febracan.com.br/) |
| Exemplos de porte de cooperativa | COOPANEST-GO: 500+ cooperados; COOPANEST-PA: ~200; COCAN (Campina Grande): 48 | [coopanestgo.com.br](http://www.coopanestgo.com.br/), [coopanest-pa.com.br](https://coopanest-pa.com.br/), [cocan.com.br](http://www.cocan.com.br/) |
| Nº total de CSAs/grupos de anestesia (incl. não-cooperativados) | **não encontrado** (não há censo público; FEBRACAN cobre só o recorte cooperativista) | — |
| Hospitais acreditados (ONA+QGA/Qmentum+JCI+ACSA, nov/2025) | **667 acreditações** (~8,8% de ~7,6 mil hospitais); ONA emite ~63% delas | [futurodasaude.com.br](https://futurodasaude.com.br/acreditacao-hospitais-brasil/) |
| Tendência | Crescente: 542 (2022) → 580 (2023) → 632 (2024) → 667 (2025) | idem |

**Leitura comercial:** o mercado-alvo primário (grupos de anestesia em hospitais acreditados ou em processo de acreditação) é um nicho de baixas centenas de organizações — mas com dor aguda e crescente: a acreditação cresce ~7%/ano e o hospital acreditado *transfere* exigências de evidência aos serviços terceirizados (CSAs), que hoje respondem com planilhas e Google Drive.

### 2. Players — concorrentes diretos e adjacentes

| Player | Categoria | O que faz | Preço público | Fonte |
|---|---|---|---|---|
| **Qualiex (ForLogic)** | SGQ hospitalar (concorrente mais próximo no eixo qualidade) | Documentos com controle de versão, não-conformidades, riscos HFMEA, indicadores; compliance ANVISA/ONA/JCI; 45.000+ usuários; ISO 9001/27001/27701 | **Não publicado** (SaaS sob proposta; avaliações públicas apontam custo elevado) | [qualiex.com/software-para-saude](https://qualiex.com/software-para-saude/), [analister.com](https://analister.com/ferramentas/qualiex) |
| **SoftExpert Suite** | SGQ/GRC enterprise | Suite ampla (BPM, documentos, riscos, auditoria); foco grandes organizações | **Não publicado** (tiers Start/Standard/Premium/Enterprise sob proposta) | [softexpert.com/pt-BR/precos](https://www.softexpert.com/pt-BR/precos/) |
| **Interact Solutions (SA-SGQ)** | SGQ hospitalar | Gestão estratégica, documental, ocorrências, auditorias e riscos; publica conteúdo sobre Manual ONA 2026 (posicionamento ativo em acreditação) | **Não publicado** | [interactsolutions.com](https://www.interactsolutions.com/novidades-do-novo-manual-ona-2026/) |
| **GesQ** | SGQ saúde | **não encontrado** nas buscas realizadas (não foi possível confirmar posicionamento/preço) | não encontrado | — |
| **VigiHosp (EBSERH)** | Notificação de incidentes | Sistema governamental dos hospitais universitários EBSERH; centraliza incidentes, queixas técnicas e agravos. Não é vendido ao mercado privado — é referência de fluxo, não concorrente comercial | N/A (público) | [gov.br/ebserh](https://www.gov.br/ebserh/pt-br/hospitais-universitarios/regiao-nordeste/huac-ufcg/comunicacao/noticias/sistema-vigihosp-tem-como-objetivo-centralizar-notificacoes-de-incidentes) |
| **Pega Plantão** | Escalas médicas | Escalas, trocas, check-in facial, cálculo de repasse, 20+ relatórios; integra Tasy/SoulMV; trial 30 dias | **Não publicado** | [pegaplantao.com.br](https://www.pegaplantao.com.br/) |
| **Escala.app** | Escalas (geral, força de trabalho) | Escalas com regras da instituição + notificação mobile | **Não publicado** | [escala.app](https://escala.app/) |
| **Escalize, Meus Plantões, Plantão Médico, DoctorID, JSoftware** | Escalas médicas | Variações do mesmo eixo: montagem de escala, trocas, aprovações, integração com pagamento médico | Não publicado | [escalize.com.br](https://escalize.com.br/), [meusplantoes.com.br](https://meusplantoes.com.br/escala-medica/), [plantaomedico.med.br](https://www.plantaomedico.med.br/), [doctorid.com.br](https://www.doctorid.com.br/website), [jsoftware.com.br](https://jsoftware.com.br/escala-medica/) |
| **LMS médicos** | Educação continuada | Nenhum LMS médico B2B brasileiro com oferta comparável (trilhas + quiz + certificados *integrados a SGQ*) apareceu nas buscas como concorrente direto | não encontrado | — |

**Constatação estrutural de pricing:** nenhum player do segmento publica preço — todo o mercado vende por proposta comercial. Isso dá liberdade de ancoragem, mas também significa que não há benchmark público de preço para citar (qualquer faixa abaixo é hipótese de posicionamento, não dado de mercado).

### 3. Posicionamento — o gap que o produto ocupa

O mercado está fatiado em **três silos que não conversam**:

1. **SGQ horizontais** (Qualiex, SoftExpert, Interact) — fortes em documentos/NC/auditoria, vendidos *ao hospital*, caros, genéricos; não conhecem a operação de um grupo de anestesia (escala, residência, repasse, sobreaviso).
2. **Apps de escala** (Pega Plantão, Escalize etc.) — fortes em operação/pagamento, **zero** módulo de qualidade/acreditação/incidentes.
3. **Notificação de incidentes** — resolvida no setor público (VigiHosp/EBSERH, NOTIVISA) e embutida nos SGQs no privado; nenhuma oferta com *canal público de denúncia anônima + LGPD* desenhada para serviço terceirizado.

**Posicionamento proposto:** *"o sistema de gestão do serviço de anestesia"* — única plataforma que junta evidência de acreditação (documentos com workflow, incidentes, comunicados com confirmação de leitura, educação com certificado) **e** operação (escalas, residência, sobreaviso) no recorte CSA/grupo. O comprador é o grupo (não o hospital), e o argumento de venda é: *"quando o hospital acreditado auditar o serviço de anestesia, a evidência sai pronta daqui"*.

Vento de cauda regulatório: o **Manual OPSS 2026 da ONA** reestruturou requisitos com eixo em segurança/experiência do paciente, gestão de riscos, análise de causas e ciclos de melhoria, e prevê explicitamente integração com sistemas digitais e suporte a IA ([blog.ona.org.br](https://blog.ona.org.br/manual-opss-2026-acreditacao/), [saudebusiness.com](https://www.saudebusiness.com/hospitais/ona-divulga-hoje-o-manual-opss-2026/)). O que o software evidencia diretamente: controle de versão/vigência documental, trilha de aprovação, registro e tratamento de incidentes, comunicação com confirmação (ciência de protocolos), educação permanente com certificados, e indicadores de compliance — exatamente os módulos já existentes na plataforma.

### 4. Faixa de preço sugerida (hipótese de posicionamento — sem benchmark público)

Como nenhum concorrente publica preço, a sugestão se ancora em **valor e capacidade de pagamento do nicho**, não em comparáveis:

| Plano | Alvo | Faixa sugerida | Justificativa |
|---|---|---|---|
| **Grupo** | CSA pequena (até ~30 médicos) | R$ 990–1.990/mês | Abaixo do custo percebido de um SGQ enterprise (Qualiex/SoftExpert vendem ao hospital com tíquete corporativo); equivale a fração de 1 plantão/mês do grupo — ancoragem que o comprador médico entende |
| **Cooperativa** | COOPANESTs (100–500+ cooperados) | R$ 3.000–8.000/mês (por porte/módulos) | 22 cooperativas FEBRACAN com estrutura administrativa própria; substitui combinação SGQ + app de escala + LMS (3 contratos) |
| **Acreditação add-on** | Grupos em hospital ONA/Qmentum | + R$ 500–1.500/mês | Vincula preço ao evento de auditoria (dor máxima, willingness-to-pay máxima); mercado endereçável de 667 hospitais acreditados e crescendo |

Racional de teto: o tíquete deve permanecer **abaixo de ~1% da receita do grupo** e dispensar processo de compras hospitalar (venda direta ao sócio-gestor do grupo, ciclo curto). Validar a faixa em 3–5 conversas de descoberta com cooperativas FEBRACAN antes de tabelar.

**Lacunas de dado a fechar em campo:** (a) nº real de CSAs não-cooperativadas; (b) tíquete praticado por Qualiex/Pega Plantão (perguntar em demo como comprador); (c) quantos dos 667 hospitais acreditados terceirizam anestesia.

---

## Fundação — pré-requisito técnico da produtização

> **Premissa:** nada do produto v1 (Qualidade + Biblioteca + Incidentes + Comunicados) é vendável antes desta fundação. Hoje o app assume **um único tenant implícito** (a ANEST): RLS por usuário sem dimensão de organização, escalas hardcoded no bundle, navegação sem URL e onboarding por allowlist manual. Esta seção transforma o app single-tenant em plataforma multi-tenant **sem reescrever produto** — é refit, não rewrite.
>
> **O que já está resolvido:** a migração para **Supabase Third-Party Auth (Firebase)** foi executada em 2026-06. Isso é estruturante para tudo abaixo: claims customizados do Firebase (criados na Fase 1.1 da migração: script de claims + Cloud Function `onCreate`) chegam direto ao `request.jwt.claims` do Postgres. O `org_id` vira **mais um claim**, não uma nova infraestrutura.

### Visão executiva da Fundação

| Bloco | Esforço | Dependências | Risco dominante |
|---|---|---|---|
| F1 — Multi-tenancy (org_id + RLS) | 15–20 dias úteis | nenhuma (já dá pra começar) | regressão de RLS silenciosa (lista vazia ≠ erro) |
| F2 — Router com URLs | 8–10 dias úteis | nenhuma (paralelo a F1) | quebra do goBack()/key-remount em 142 páginas |
| F3 — Dados estáticos → banco | 7–9 dias úteis | F1 (tabelas já nascem com org_id) | overrides Firestore dessincronizados da escala base |
| F4 — Provisionamento por convite | 6–8 dias úteis | F1 (convite carrega org_id) | lockout de admin durante cutover da allowlist |
| F5 — Saneamento de testes | 5 dias úteis + contínuo | F1 (testes de isolamento são o entregável) | falsa confiança: coverage sem testar cross-tenant |
| **Total** | **~41–52 dias úteis (~9–11 semanas)** | ordem recomendada: F1 ∥ F2 → F4 → F3 → F5 transversal | |

> Estimativas calibradas no ritmo real do projeto (Sprint 1 do plano v5.x: 22 dias úteis para 7 waves). Os blocos F1 e F2 podem rodar em paralelo (camadas diferentes: SQL vs. shell React); F5 não é fase final — cada bloco entrega seus testes.

---

### F1 — Multi-tenancy: `org_id` + RLS por tenant

#### Estado atual (dimensionado no código)

- **136 migrations** em `supabase/migrations/`, criando **49 tabelas** (de `documentos`/`incidentes`/`comunicados` até `token_blocklist`/`api_tokens` da Wave 2.1).
- **126 `CREATE POLICY`** no histórico de migrations. O padrão canônico é por **usuário**, não por organização:
  - `public.firebase_uid()` — SECURITY DEFINER, `search_path` fixado, lê `request.jwt.claims->>'sub'` (hardening Wave 1.9, `20260520210000_firebase_uid_security_definer.sql`; o comentário da própria migration conta **94 usos em 28 migrations**).
  - `public.is_admin()` — `EXISTS (SELECT 1 FROM admin_users WHERE firebase_uid = firebase_uid())` (`002_rls.sql:23-27`).
  - Padrão típico: `for select to authenticated using (true)` + escrita gated por `is_admin()` — ou seja, **leitura é global para qualquer autenticado**. Num mundo multi-tenant isso é vazamento de dados entre clientes por design.
- Há precedente recente de lookup por perfil via SECURITY DEFINER: `20260626500000_user_clearance_level_profiles_lookup.sql` — exatamente o molde a copiar para `current_org()`.

#### O que muda

1. **Novas tabelas de plataforma** (1 migration):
   - `organizations` (id uuid, slug, nome, tipo: `grupo_anestesia` | `hospital`, plano, status, branding básico);
   - `org_members` (org_id, firebase_uid, role, status) — substitui o papel implícito de `profiles` + `admin_users` como fronteira de acesso. `profiles` ganha `org_id` (v1: 1 usuário = 1 org; o schema `org_members` já deixa multi-org possível sem refactor).
2. **Função `current_org()`** — mesmo molde de `firebase_uid()`:
   ```sql
   create or replace function public.current_org()
   returns uuid language sql stable security definer
   set search_path = pg_catalog, public as $$
     select coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id',
       (select org_id::text from profiles where id = public.firebase_uid())
     )::uuid;
   $$;
   ```
   Caminho rápido: claim `org_id` no token Firebase (estender o script de claims + Cloud Function `onCreate` da migração de auth, já existentes). Fallback: lookup em `profiles` (cobre janela de propagação de claim, ~1h ou force-refresh). `is_admin()` vira `is_org_admin()` (admin **da org**, via `org_members.role`) — admin global da plataforma é conceito novo e separado (`platform_admins`).
3. **`org_id` em todas as tabelas de negócio** (~44 das 49; ficam fora as de plataforma/infra: `token_blocklist`, `api_tokens`, `retention_policies` se global, etc.):
   - `ALTER TABLE ... ADD COLUMN org_id uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id)` — o `DEFAULT current_org()` faz os **53 services existentes funcionarem sem alteração de código** nos INSERTs (escrita já sai carimbada com a org do JWT).
   - Backfill trivial: 100% das rows atuais → org seed `anest` (`UPDATE ... SET org_id = '<anest>'` antes do `NOT NULL`).
   - Índices compostos com `org_id` na frente nos hot paths (`documentos`, `incidentes`, `comunicados`, `notifications`, `messages`, `rop_user_attempts`): `(org_id, updated_at desc)` etc.
4. **Reescrita das policies em formato composto** — toda policy ganha o predicado de tenant como **primeira** condição:
   ```sql
   using (org_id = public.current_org() AND <regra atual>)
   with check (org_id = public.current_org() AND <regra atual>)
   ```
   - As ~30 policies que hoje usam `firebase_uid()` no USING mantêm a regra por usuário **e** ganham a de org; as `using (true)` de leitura viram `using (org_id = current_org())`.
   - `FORCE ROW LEVEL SECURITY` em todas (lição da Wave 2.1) e **policy para os 4 verbos usados** em cada tabela (lição do incidente Erlei/`authorized_emails` 2026-05-21: UPDATE faltando = `PGRST116` silencioso que parece bug de app).
   - Edge Functions com service-role (20 functions em `supabase/functions/`, ex.: `notify-incident`, `schedule-shift-reminders`, `api-v1`) **bypassam RLS** — cada uma precisa de revisão para filtrar/carimbar `org_id` explicitamente. Mesmo cuidado nos crons (`fetch-noticias`, `fetch-classics`: conteúdo é global ou por org? Decisão: global com flag `org_id NULL = plataforma`).
   - **Storage:** buckets privados (certificados, documentos) passam a prefixar path com `org_id/` + storage policies compostas.
5. **Impacto no Firestore (escalas e reuniões)** — o app é híbrido; as coleções ativas (`residenciaPlantaoDiario`, `sobreavisoMaternoDiario`, `hospitaisDiario` + overrides de troca, `reunioes`/`reuniao_*`, `userProfiles`, `educacao_certificados`, `educacao_cursos`) não têm RLS:
   - **Curto prazo (fundação):** campo `orgId` em todo documento + Firestore Rules `request.auth.token.org_id == resource.data.orgId` — viável porque o claim `org_id` já estará no token Firebase (mesmo claim que alimenta o Postgres; uma fonte, dois enforcement points).
   - **Médio prazo (v3 Residência):** escalas/trocas migram para Supabase quando o módulo for generalizado — não pagar o custo duas vezes; na fundação só se blinda o que existe.
   - `userProfiles` (Firestore) segue source of truth de perfil (regra `reconcileFromSupabase` atual), mas o sync passa a propagar `org_id`.

#### Esforço estimado

**15–20 dias úteis.** Decomposição: tabelas de plataforma + `current_org()` + claim (2d) · `org_id` + backfill + índices nas 44 tabelas via migration gerada e validada com `migration-validator` (3d) · reescrita das ~126 policies em lotes por módulo com teste de isolamento por lote (6–8d — é o grosso) · revisão das 20 Edge Functions + crons (2–3d) · Firestore `orgId` + Rules + sync (2–3d) · estabilização (1d).

#### Riscos

- **Regressão silenciosa de RLS** — o padrão de falha do projeto é conhecido: policy errada não dá erro, dá **lista vazia** (memória: `42703 swallowed`, `PGRST116`). Mitigação: rollout por módulo + teste automatizado cross-tenant (F5) **antes** de ativar cada lote, nunca "big bang" das 126 policies.
- **Performance** — predicado `current_org()` em toda query exige os índices compostos do item 3; sem eles, seq scan em `documentos`/`notifications`. Validar com `EXPLAIN` nos 5 hot paths.
- **Claim ausente em token velho** — usuário logado durante o deploy fica 50min com JWT sem `org_id`. O fallback por `profiles` no `current_org()` cobre; sem ele, app inteiro "vazio" pós-deploy.
- **Edge Functions service-role** são o buraco clássico de multi-tenancy (RLS não protege); exige revisão manual função a função.

#### Critério de pronto

- [ ] Teste automatizado: usuário da org B **não lê nem escreve** nenhuma row da org A em todas as tabelas com `org_id` (suite de isolamento, ver F5).
- [ ] `SELECT` sem filtro explícito em qualquer service retorna apenas dados da org do JWT (validado nos 5 módulos do produto v1).
- [ ] Org `anest` seed com 100% dos dados históricos; app em produção comporta-se **idêntico ao atual** para os ~65 usuários (zero mudança percebida).
- [ ] Segunda org de teste criada de ponta a ponta (org → convite → login → criar documento/incidente/comunicado) sem tocar em SQL manual.
- [ ] `get_advisors` (Supabase) sem findings de RLS; nenhuma tabela de negócio sem `FORCE RLS`.
- [ ] Firestore Rules rejeitam leitura cross-org (testado com emulador ou conta de teste).

---

### F2 — Router com URLs (matar o switch de 142 cases)

#### Estado atual

- `src/App.jsx` (1.455 linhas): `renderAppPage()` na linha 1032 com **142 `case`** no `switch (currentPage)`; navegação por `setCurrentPage` + `pageProps` + stack manual `navigationHistory` (goBack); guard de permissão `PAGE_TO_CARD` (linha 595, ~38 entradas) rodando **antes** do switch; remount forçado via `key={pageName}`; único deep-link real é `/verificar/:uuid` (fora do switch).
- Consequências comerciais do estado atual: sem URL compartilhável ("olha este documento"), sem refresh-safe (F5 volta pra Home), sem deep-link de notificação push/e-mail — inaceitável num SaaS B2B onde e-mail de convite/alerta precisa abrir a tela certa.

#### O que muda — estratégia incremental em 3 etapas (sem big bang)

1. **Etapa A — URL como espelho do estado (2–3 dias):** introduzir `react-router` v7 com **uma rota catch-all** `/:org/:page?` que apenas sincroniza bidirecional com o estado atual: `onNavigate(page, props)` → `navigate('/'+slug+'/'+page, { state: props })`, e `popstate` → `setCurrentPage`. O switch de 142 cases **não muda uma linha**. Ganhos imediatos: back do browser funciona (substitui `navigationHistory`), refresh preserva página, URL compartilhável. O slug da org no path prepara white-label.
2. **Etapa B — props na URL, módulo a módulo (4–5 dias):** os `pageProps` críticos viram params (`/:org/documentos/:documentoId`, `/:org/incidentes/:protocolo`) começando pelos módulos do produto v1. O padrão `key`+lazy-initializer do projeto continua válido (key passa a ser a URL). `returnTo` morre em favor de history real.
3. **Etapa C — rotas declarativas + code splitting (2 dias):** cases migrados viram `<Route lazy>` com `React.lazy` por módulo; `PAGE_TO_CARD` vira guard de rota (`loader`/wrapper único em vez de checagem ad-hoc); o switch encolhe até sobrar só legado de baixa prioridade (pode viver meses — é incremental de verdade).

#### Esforço estimado

**8–10 dias úteis** (A: 2–3 · B: 4–5 · C: 2). Paralelizável com F1 (não toca SQL).

#### Riscos

- **goBack()/remount:** páginas que dependem do remount via `key` podem quebrar quando o back vira `popstate`; mitigar mantendo `key={location.pathname}` e migrando módulo a módulo com smoke test Playwright.
- **Scroll restoration** e header via `createPortal` (padrão do projeto) precisam de validação por rota — hoje cada página assume mount fresh.
- **Guards de permissão:** se a Etapa C mover o `PAGE_TO_CARD` para o router e esquecer uma entrada, página fica acessível por URL direta — o teste de F5 cobre as 38 entradas.

#### Critério de pronto

- [ ] Refresh (F5) em qualquer página do produto v1 mantém o usuário na mesma tela com os mesmos dados.
- [ ] Deep-link `/:org/documentos/:id` abre direto o detalhe (logado) ou redireciona para login → retorna à URL original.
- [ ] Back/forward do browser substituem `navigationHistory` sem regressão (testado via Playwright nos 10 fluxos principais).
- [ ] URL direta para página sem permissão → redirect, nunca render (todas as entradas do `PAGE_TO_CARD`).
- [ ] Bundle inicial menor (code splitting por módulo, medir com `npm run build`).

---

### F3 — Dados estáticos `src/data/*2026.js` → banco

#### Estado atual (arquivos reais)

| Arquivo | Linhas | Conteúdo |
|---|---|---|
| `src/data/plantao2026.js` | 446 | escala diária de plantão 01/mar/2026→28/fev/2027, 365 entradas `'data': 'residente-id'` hardcoded |
| `src/data/residencia2026.js` | 178 | residentes 2026, estágios, `toDateKey` |
| `src/data/sobreavisoMaterno2026.js` | 156 | escala de sobreaviso materno |
| `src/data/hospitaisTecnicas2026.js` | 151 | hospitais/turnos/técnicas das escalas hospitalares |
| (correlato) `src/data/indicadores-2025.js` | 448 | indicadores históricos — avaliar junto |

**31 arquivos consumidores** (hooks `useResidencia`/`useSobreavisoMaterno`/`useTrocaPlantao*`, services de troca, `HomePage`, páginas de consulta, 5 suítes de teste, e `src/scripts/generate-edge-function-data.js` que **re-embute** esses dados na Edge Function de lembretes). A arquitetura atual é "escala estática no bundle + overrides diários no Firestore" (`residenciaPlantaoDiario`, `sobreavisoMaternoDiario`, overrides de troca em `trocaPlantaoHospitalarService`).

O problema comercial é óbvio: **tenant novo não tem escala** — ela está compilada no JavaScript da ANEST, e cada virada de ano exige novo arquivo `*2027.js` + deploy.

#### O que muda

1. **Schema Supabase** (com `org_id` desde o nascimento — por isso F3 depende de F1): `escala_recursos` (residentes/funcionárias/hospitais — o "quem"), `escala_slots` (data, turno, recurso, tipo: plantão/sobreaviso/estágio — o "quando", substitui os 3 arquivos de escala), `escala_config` (regras: 12h útil/24h fds, rollover 07h, feriados). Overrides de troca **continuam no Firestore por ora** (módulo funciona; migração total é escopo do v3 Residência) — mas o merge "base + override" passa a ler a base do banco.
2. **Camada de acesso:** um `escalasService` Supabase substitui os imports diretos; os hooks mantêm a mesma interface (mudança invisível para as páginas). Cache local agressivo (escala muda raramente; TanStack Query já tem PoC no projeto atrás de flag).
3. **Importador:** script one-shot que lê os 4 arquivos atuais e popula a org `anest` (os dados viram o seed de produção). Um admin de outra org cadastra via CRUD mínimo ou import CSV — o CRUD completo de programas/rotações é v3; aqui entra só o suficiente para o dado não morar no bundle.
4. **Edge Function `schedule-shift-reminders`:** passa a consultar o banco em vez do dado gerado por `generate-edge-function-data.js` (script morre).

#### Esforço estimado

**7–9 dias úteis:** schema + migration (1d) · importador + seed ANEST (1d) · `escalasService` + refit dos 6 hooks (3–4d) · Edge Function de lembretes (1d) · ajuste das 5 suítes de teste + validação Playwright dos cards da Home (1–2d).

#### Riscos

- **Lembretes de plantão errados** durante o cutover (notificação 24/48/72/96h é feature sensível — médico não aparecer no plantão é incidente real). Mitigar: rodar banco e bundle em paralelo 1 semana comparando saída do cron (shadow mode).
- **Merge base+override:** a lógica de overrides do Firestore assume as chaves de data/turno do formato estático; mapeamento `escala_slots` → `dateKey` precisa ser bit-a-bit idêntico (testes de F5 com os 365 dias reais como fixture).
- **Virada 2027:** critério de sucesso indireto — a escala 2027 deve nascer via UI/import, não via novo arquivo `.js`.

#### Critério de pronto

- [ ] `git grep "plantao2026\|sobreavisoMaterno2026\|hospitaisTecnicas2026"` em `src/` (fora de `__tests__` e do importador) → zero resultados.
- [ ] Card de plantão da Home, consulta de escalas e fluxos de troca idênticos ao comportamento atual (Playwright antes/depois).
- [ ] Cron de lembretes em shadow mode produziu saída idêntica por 7 dias.
- [ ] Org de teste cria escala própria via import CSV sem deploy.

---

### F4 — Provisionamento por convite (aposentar `authorized_emails`)

#### Estado atual

- Tabela `authorized_emails` + **10 migrations** acopladas a ela (sync de role → `profiles`, health views, trigger `BEFORE INSERT require allowlist` em profiles, policy de UPDATE do hotfix v5.6.1) e **8 arquivos de frontend/services** (`UsersManagementContext`, `EmailsTab`, `UsersTab`, `UserSyncHealthAlert`, `CentroGestaoPage`, `supabaseUsersService`, `authService`, script de migração).
- Modelo atual: admin digita e-mail na aba Emails → usuário faz login Google/Firebase → trigger valida contra allowlist → profile criado com role da allowlist. Funciona para 1 grupo de 65 pessoas; **não escala** para self-service de N orgs (admin da org B não pode mexer numa allowlist global, e e-mail digitado errado = suporte manual).

#### O que muda

1. **Tabela `org_invitations`** (org_id, email, role proposto, token hash, expires_at 7d, invited_by, accepted_at, status) com RLS composta de F1 (admin da org gerencia só os convites da própria org).
2. **Fluxo:** admin da org convida (UI no Centro de Gestão, substitui a aba Emails) → Edge Function envia e-mail com link `/:org/convite/:token` (rota nova de F2, pública) → destinatário autentica via Firebase → Cloud Function `onCreate` (a mesma da migração de auth, estendida) valida token → cria `profiles` + `org_members` com org_id e role do convite → seta claim `org_id` → marca convite aceito. Audit trail completo (`invited_by` real, nunca 'system' — regra do projeto).
3. **Cutover sem big bang:** `authorized_emails` é convertida em convites pré-aceitos da org `anest` (preserva os 65 usuários e o histórico); trigger de allowlist passa a aceitar `convite válido OU allowlist legada`, e a allowlist é removida 30 dias depois (mesmo padrão "aceitação dupla" usado na migração de auth Fase 1.3). Health views (`user_sync_health`) são adaptadas, não deletadas — viraram ferramenta de observabilidade boa.
4. **Bootstrap de org:** criar org nova = fluxo de plataforma (admin global cria org + primeiro convite de admin). Self-service de signup de org é decisão comercial posterior — a fundação entrega o mecanismo, não a landing page.

#### Esforço estimado

**6–8 dias úteis:** schema + RLS + migração da allowlist (1–2d) · Edge Function de e-mail + template (1d — decidir provedor: Resend/SES; primeiro e-mail transacional do produto, secret via dashboard conforme regra do projeto) · extensão da Cloud Function `onCreate` + claim (1d) · UI de convites no Centro de Gestão + rota pública de aceite (2–3d) · cutover + observação (1d).

#### Riscos

- **Lockout:** se o trigger novo rejeitar logins existentes, os 65 usuários ficam fora — por isso o período de aceitação dupla é obrigatório, com rollback = reativar trigger antigo.
- **Token de convite é credencial:** hash em banco (nunca token em claro), expiração curta, single-use, e e-mail do aceite **deve** bater com o do convite (senão convite encaminhado vira acesso indevido).
- **Entregabilidade de e-mail** (SPF/DKIM do domínio) — primeiro contato do produto com infraestrutura de e-mail; reservar meio dia de DNS.

#### Critério de pronto

- [ ] Fluxo completo: convite → e-mail recebido → aceite → login → usuário dentro da org certa com role certo, **sem nenhuma ação manual em SQL/console**.
- [ ] Convite expirado/reusado/com e-mail divergente → rejeitado com mensagem clara.
- [ ] Admin da org B não vê nem cria convites da org A (teste de isolamento F5).
- [ ] Allowlist legada removida (tabela arquivada, trigger dropado) após 30 dias sem incidente; os 65 usuários da ANEST nunca perceberam a troca.
- [ ] Audit trail: cada convite/aceite com `invited_by`/`accepted_by` reais.

---

### F5 — Saneamento de testes (transversal)

#### Estado atual

- **129 arquivos de teste para 948 arquivos em `src/`** (~14%). A cobertura existente é boa onde o projeto sempre exigiu (libs de calculadora — que ficam **fora** do produto comercial — e helpers de dados), e quase nula onde a produtização mais precisa: **zero testes de RLS/isolamento**, zero testes de navegação/guards, services Supabase testados de forma esparsa.
- Meta declarada de "coverage 80%" (roadmap aspiracional) é a métrica errada para esta fase: o que protege a venda é **isolamento entre tenants comprovado**, não percentual.

#### O que muda

1. **Suite de isolamento multi-tenant (o entregável central):** harness de integração que roda contra branch/banco local Supabase com **2 orgs + 3 usuários seed** (admin A, membro A, membro B) e, para **cada tabela com org_id**, executa a matriz `SELECT/INSERT/UPDATE/DELETE` cross-tenant esperando negação (e intra-tenant esperando sucesso). Gerável por script a partir do catálogo (`pg_policies`), então o custo marginal de tabela nova ≈ zero. Roda em CI como gate de merge para qualquer migration.
2. **Testes de guard de rota (F2):** para cada entrada do `PAGE_TO_CARD`, URL direta sem permissão → redirect (um teste paramétrico, não 38 arquivos).
3. **Testes de fluxo de convite (F4):** aceite feliz + expirado + reuso + e-mail divergente.
4. **Fixtures de escala (F3):** os 365 dias de `plantao2026.js` viram fixture de regressão do merge base+override antes do arquivo morrer.
5. **CI:** `vitest run` + suite de isolamento em GitHub Actions por PR (hoje a verificação é local: `npm run build` + dev). Sem gate de coverage global; gate **binário** na suite de isolamento.

#### Esforço estimado

**5 dias úteis de setup** (harness + gerador da matriz + CI) — e depois é regra de execução: F1/F3/F4 só fecham com seus testes verdes (já contabilizado nas estimativas deles).

#### Riscos

- **Falsa confiança:** testar com service-role key bypassa RLS e o teste "passa" mentindo — o harness **tem** que assinar JWTs de usuário (anon key + token com claims org_id/sub), nunca service-role.
- **Drift do seed:** 2 orgs de teste precisam de seed versionado em migration de teste, não criado à mão.

#### Critério de pronto

- [ ] Matriz de isolamento cobre 100% das tabelas com `org_id` e roda verde em CI a cada PR.
- [ ] Derrubar qualquer policy de org de propósito (mutation test manual) → CI fica vermelho.
- [ ] Guards das 38 entradas do `PAGE_TO_CARD` testados.
- [ ] CI total < 10 min para não degradar o ritmo de trabalho atual.

---

### Sequenciamento e definição de pronto da Fundação

```
Semanas 1–4   F1 multi-tenancy (SQL)  ∥  F2 router (shell React)
Semanas 4–5   F5 harness de isolamento (gate para fechar F1)
Semanas 5–7   F4 convites (depende de F1 + rota pública de F2)
Semanas 7–9   F3 dados estáticos → banco (+ shadow mode de lembretes)
Semanas 9–11  estabilização, cutover da allowlist, folga de risco
```

**A Fundação está pronta quando:** uma segunda organização fictícia ("Hospital Demo") é criada, recebe um admin por convite, esse admin convida 2 usuários, sobe um documento, registra um incidente e publica um comunicado — **tudo por URL compartilhável, sem deploy, sem SQL manual, e sem que nenhum usuário da ANEST consiga ver um byte disso** (provado pela suite de isolamento em CI). Esse roteiro é, na prática, o ensaio da primeira demo de venda do produto v1.

---

## Produto v1 — Qualidade + Documentos + Incidentes + Comunicados

> **Premissa travada:** este capítulo assume a Fundação concluída. Nenhuma task abaixo re-especifica fundação — apenas declara dependência quando houver.
>
> **Tese de venda do v1:** "ciclo completo de gestão de qualidade para acreditação" — o gestor relata um incidente, abre plano de ação, atualiza o documento institucional, comunica a equipe com confirmação de leitura e **exporta o pacote de evidências** que o avaliador ONA/Qmentum pede. Nenhum dos quatro módulos é vendável isolado; o ciclo fechado (PDCA auditável) é o diferencial contra planilha + e-mail.

### 1. O que já existe (inventário do código real)

A base do v1 está **funcionalmente pronta para single-tenant**. O esforço do v1 não é construir features — é parametrizar o que é hardcoded e empacotar evidências.

#### 1.1 Qualidade (hub `QualidadePage.jsx` + 5 submódulos)

| Submódulo | Código | Estado |
|---|---|---|
| **Planos de Ação** | `src/pages/planos-acao/` (3 páginas, ~810 LOC) + `supabasePlanosAcaoService.js` | CRUD completo: lista → detalhe → novo. Vinculável a incidentes (fecha ciclo PDCA) |
| **Auditorias** | `src/pages/auditorias/` (8 páginas: conformidade, operacionais, higiene de mãos, uso de medicamentos, políticas) + `supabaseAuditoriasService.js` | Auditorias internas estruturadas, archive em vez de delete (commit 4957f50) |
| **Autoavaliação ROPs** | `src/pages/autoavaliacao/` (4 páginas, ~810 LOC) + `supabaseAutoavaliacaoService.js` | Autoavaliação por área ROP com relatório — núcleo do preparo Qmentum |
| **KPIs / Indicadores** | `src/pages/kpi/` (10 páginas: adesão, eventos, infecção, medicamentos, satisfação, tempo, histórico, data entry) + `supabaseKpiService.js` | Dashboard + entrada de dados + detalhe por indicador |
| **Relatórios** | `src/pages/relatorios/` (4 páginas, ~1.870 LOC) + `supabaseRelatoriosService.js` | Relatório trimestral, de incidentes e de indicadores com detalhe |

Transversal: `src/hooks/useComplianceMetrics.js` (246 LOC) já computa `qmentumScore` ponderado, `ropAdherence` (6 áreas), `reviewComplianceRate`, `approvalCycleTime`, `overdueByCategory`, `documentCoverage` — é a matéria-prima do pacote de evidências (épico E2).

#### 1.2 Biblioteca / Documentos

- `src/pages/BibliotecaPage.jsx` (653 LOC) + `DocumentoDetalhePage/` + `GestaoDocumentalPage.jsx` + `supabaseDocumentService.js`.
- Taxonomia unificada em 11 subcategorias (Bloco 2, commit e63a340), versionamento, **ciclo de aprovação/revisão completo**, política "nunca deletar, só arquivar".
- `src/types/documents.js` (648 LOC): `DOCUMENT_CATEGORIES`, `APPROVAL_WORKFLOW_TEMPLATE` (aprovadores padrão por tipo), pesos Qmentum por categoria, compliance flags (`REVISION_OVERDUE`, `APPROVAL_PENDING`, `MISSING_SIGNATURE`, `INCOMPLETE_WORKFLOW`).
- **Gap estrutural:** toda essa taxonomia é **constante de código** — um hospital cliente não consegue renomear categorias nem trocar a cadeia de aprovação sem deploy (épico E3).

#### 1.3 Incidentes / Denúncias

O módulo mais maduro do app (12 páginas, ~6.200 LOC, `src/pages/incidents/` com `CLAUDE.md` próprio):

- **Relato:** `NovoIncidentePage.jsx` (1.148 LOC) com taxonomia anestesia-específica em `src/data/incidentesConfig.js` — `INCIDENT_TYPES` (medicação, cirurgia, identificação, via aérea, cardiovascular, equipamento…), `NEVER_EVENTS` com sugestão automática de código, protocolo gerado por relato.
- **Severidade já mapeada a padrões internacionais:** cada nível de `SEVERITY_LEVELS` carrega `whoIcpsClass`/`whoIcpsCode` (OMS ICPS), `nccMerpCategory` e `nhsLfpseHarm`. **Isso é mais da metade do épico E1 já feito** — falta o eixo NOTIVISA e o pacote de exportação.
- **Investigação:** RCA estruturada em `components/` (FiveWhysForm, FatoresContribuintes, RiskMatrix), vinculação a ROPs (RopVinculacao).
- **LGPD by design:** anonimização imutável, tracking público via `ANEST-YYYY-XXXXXX`, formulários públicos sem auth (`public/formulario-incidente.html`/`-denuncia.html`), gerador de QR Code para divulgação no centro cirúrgico.
- **Denúncias** com fluxo paralelo completo (gestão, detalhe, acompanhamento anônimo).

#### 1.4 Comunicados

- 4 camadas prontas: widget Home → `ComunicadosPage.jsx` → `ComunicadosContext` → `supabaseComunicadosService.js` → 3 tabelas (`comunicados`, `comunicado_confirmacoes`, `comunicado_acoes_completadas`).
- **Confirmação de leitura + ações completadas** já existem — exatamente o que avaliador de acreditação pede como evidência de comunicação institucional. Monitor admin em `ComunicadosMonitorTab.jsx`.
- Pendências conhecidas da auditoria 2026-05-27 (RLS UPDATE, z-index, `window.confirm`) entram como hardening (W0).

#### 1.5 Infra transversal aproveitável

- **PDF:** `src/services/pdf/` com `pdfService.js`, `pdfBranding.js` e 4 templates prontos (`kpiReportTemplate`, `incidentReportTemplate`, `complianceReportTemplate`, `qualidadeReportTemplate`) — base direta do épico E2. Branding hoje é fixo ANEST → precisa virar por tenant.
- **Permissões:** `useCardPermissions.js` (cascade sub-card→pai, bypass admin/coordenador, retrocompat) + `PAGE_TO_CARD` (38+ entries) + `rolePermissionTemplates.js` — base do gating por módulo contratado (E4/E5).
- **Audit trail** (`supabaseUsersService.js:fetchAuditLog` + `AuditTrailModal`), notificações in-app, push (Sprint 21), busca global.

### 2. O que falta para vender — épicos E1–E5

Esforço total estimado: **~38 dias úteis** (≈ 4 sprints de 2 semanas, 1 dev sênior + Claude Code no padrão wave do projeto). Estimativas calibradas pelo histórico real do repo (ex.: Bloco 2 taxonomia ≈ 1 semana; Wave 1.8 storage cutover ≈ 4 dias).

---

#### E1 — Taxonomia OMS/NOTIVISA nos incidentes + exportação ANVISA (5 dias)

**Por quê:** a RDC 36/2013 obriga Núcleos de Segurança do Paciente a notificar eventos adversos no NOTIVISA (óbito/never event em até 72h). Hoje o NSP do hospital re-digita tudo no portal da ANVISA. Se o app **pré-formata a notificação**, vira argumento de venda direto para a persona "qualidade hospitalar".

**Restrição conhecida:** NOTIVISA não tem API pública de submissão documentada — a entrega é **exportação assistida** (arquivo + checklist de campos obrigatórios), não integração automática. T1.1 valida essa premissa antes de codar.

| # | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T1.1 | **Spike regulatório (½ dia):** confirmar formato vigente de notificação NOTIVISA/VigiMed para EAs em serviços de saúde (campos obrigatórios, prazos por grau de dano) e ausência/existência de API | 0,5d | Documento `docs/notivisa-mapping.md` com mapa campo-a-campo e decisão API vs export assistido registrada |
| T1.2 | Estender `incidentesConfig.js` → tabela `incident_taxonomy` (por tenant, seed = taxonomia atual): adicionar eixos OMS ICPS faltantes (tipo de incidente ICPS, fatores contribuintes ICPS, características do paciente — faixa etária/sexo sem identificadores) + código NOTIVISA por tipo | 1,5d | Cada `INCIDENT_TYPES.value` tem `whoIcpsType` + `notivisaCategory`; severidade reaproveita `whoIcpsCode`/`nccMerpCategory` existentes; migration validada com `migration-validator`; formulário continua ≤ mesmo nº de passos (campos novos têm default inferido, não obrigatórios no relato) |
| T1.3 | Tela "Notificação ANVISA" no `IncidenteGestaoPage`: para incidentes com dano ≥ moderado ou never event, botão "Gerar notificação" → PDF/CSV pré-preenchido no layout do T1.1 + checklist de campos pendentes + registro de status (`nao_aplicavel`/`pendente`/`notificado` + nº protocolo ANVISA manual) | 2d | Incidente grave exibe banner de prazo (72h) contando do relato; export abre com 100% dos campos mapeáveis preenchidos; status `notificado` exige protocolo; tudo com audit trail (`changedBy` real) |
| T1.4 | Indicador "notificações ANVISA" no Relatório de Incidentes + flag de compliance `ANVISA_OVERDUE` no `useComplianceMetrics` | 1d | `RelatorioIncidentesPage` mostra % notificado no prazo; incidente grave sem notificação após 72h gera flag visível no dashboard de Qualidade |

**Aceite do épico:** dado um never event de teste, em ≤ 3 cliques a partir do detalhe do incidente o gestor obtém o arquivo de notificação pré-preenchido, e o atraso aparece nos indicadores.

---

#### E2 — Pacote de evidências ONA/Qmentum exportável (8 dias)

**Por quê:** é o momento-verdade da acreditação: o avaliador pede evidências por padrão/ROP e o hospital monta pastas à mão. O app já tem todos os dados (documentos vigentes, autoavaliação ROP, KPIs, incidentes→planos de ação, comunicados com confirmação) e 4 templates PDF prontos — falta o **bundle**.

| # | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.1 | Modelo `evidence_packages` (tenant, período, escopo de módulos, status, gerado_por, url) + Edge Function `generate-evidence-package` que monta ZIP no bucket privado (TTL de download como no padrão cert PDF Wave 1.8) | 2d | Geração assíncrona com notificação in-app ao concluir; link expira (TTL 300s, re-gerável); RLS por tenant |
| T2.2 | Conteúdo do bundle reaproveitando `src/services/pdf/templates/`: (a) sumário executivo com `qmentumScore`/`ropAdherence` do `useComplianceMetrics`; (b) matriz documental — vigentes/vencidos/em revisão por categoria com histórico de aprovação; (c) relatório de indicadores do período; (d) incidentes + RCA + planos de ação vinculados (ciclo fechado); (e) comunicados com taxa de confirmação de leitura | 3d | Cada PDF do bundle tem capa com branding do tenant (`pdfBranding.js` parametrizado), período e hash de integridade; dados anonimizados conforme LGPD (sem identidade de relator anônimo) |
| T2.3 | Seletor de escopo "por padrão de acreditação": mapear conteúdo a seções ONA (NA1–NA3) e áreas ROP Qmentum (mapa `ropArea` já existe em `documents.js:261-269`); gestor escolhe metodologia + seções e o bundle filtra | 2d | Escolher "ONA Nível 2 — Segurança do Paciente" gera bundle só com evidências mapeadas àquela seção; mapa editável por tenant (tabela, não constante) |
| T2.4 | Página "Evidências" no hub Qualidade: histórico de pacotes gerados, comparação de score entre períodos, re-download | 1d | Lista com filtros, estado vazio orientativo, mobile-first 375px, dual theme |

**Aceite do épico:** gestor seleciona "Qmentum + Q1 2026" e recebe um ZIP com 5 PDFs consistentes entre si (mesmos números do dashboard), pronto para entregar ao avaliador. Demo de venda usa exatamente esse fluxo.

---

#### E3 — Categorias de documento e fluxos de aprovação configuráveis por tenant (8 dias)

**Por quê:** `DOCUMENT_CATEGORIES`, `APPROVAL_WORKFLOW_TEMPLATE`, pesos Qmentum e contagens recomendadas são constantes em `src/types/documents.js`. Cada hospital tem nomenclatura própria (POP vs IT vs protocolo) e cadeia de aprovação própria (qualidade → diretor técnico → núcleo). Sem isso, todo onboarding vira customização de código.

| # | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T3.1 | Migrations: `document_categories` (tenant, nome, cor/ícone do DS, peso qmentum, rop_area, docs_recomendados, ativo) e `approval_workflows` + `approval_workflow_steps` (ordem, papel aprovador, obrigatório, prazo em dias) — seed = 11 subcategorias e template atuais | 2d | RLS 4 verbos por tenant (lição Erlei); seed idempotente; `migration-validator` verde |
| T3.2 | Refatorar consumidores: `documents.js` vira camada de fallback; `useDocuments`, `useComplianceMetrics`, `BibliotecaPage` (árvore), `GestaoDocumentalPage`, `approvalWorkflow.js` leem do banco com cache em contexto | 3d | Zero referência runtime às constantes para tenant provisionado; tenant ANEST atual migra sem diff visual (screenshot Playwright antes/depois); `*_LIST_COLS` validados contra schema (lição select explícito) |
| T3.3 | UI admin "Taxonomia & Fluxos" (dentro do console E5): CRUD de categorias (archive-only se houver docs vinculados) + editor de workflow por categoria (passos ordenados, papel responsável, prazo) | 2,5d | Criar categoria nova → aparece na árvore da Biblioteca sem deploy; alterar workflow só afeta aprovações **futuras** (em andamento mantêm snapshot do fluxo); toda alteração logada no audit trail |
| T3.4 | Compliance flags parametrizadas: prazos de revisão e regras de `REVISION_OVERDUE` por categoria/tenant | 0,5d | Tenant define "protocolos revisam a cada 12 meses, políticas a cada 24" e os alertas respeitam |

**Aceite do épico:** provisionar um tenant demo "Hospital X", renomear 3 categorias, montar um workflow de 3 passos e aprovar um documento de ponta a ponta — sem tocar em código.

---

#### E4 — Home como grade de widgets por módulo contratado (5 dias)

**Por quê:** `HomePage.jsx` (921 LOC) é hardcoded para o conjunto de módulos da ANEST. No produto, cada tenant contrata um subconjunto (v1 = 4 módulos; v2/v3 adicionam) e a Home precisa refletir **só o contratado e permitido**, com a marca do cliente.

| # | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T4.1 | Registry de widgets: extrair os cards da HomePage para `src/widgets/registry.js` — cada widget declara `moduleId`, `cardId` (permissão), componente lazy e tamanho na grade | 2d | HomePage vira composição declarativa ≤ 200 LOC; widgets atuais (Comunicados, Qualidade, Pendências…) renderizam idênticos (screenshot diff); widget de módulo não contratado nem monta (não busca dados) |
| T4.2 | Gating em 2 camadas: `org_modules` (entitlement do tenant, fonte: console E5) **e** `useCardPermissions` (permissão do usuário) — entitlement OFF vence permissão ON; mesma regra esconde itens do `MenuPage`/BottomNav e bloqueia rota no router | 1,5d | Usuário de tenant sem "Educação" não vê widget, item de menu, nem acessa URL direta (redirect + toast); admin do tenant vê estado "módulo não contratado" com CTA de upgrade |
| T4.3 | Tokens DS por tenant: camada de theming sobre `Tokens.json` — tabela `org_theme` (cores institucionais, logo, nome) aplicada via CSS vars no boot (atenção à lição: classe Tailwind dinâmica é purgada → usar `style={{ '--token': … }}` inline/`:root`) | 1,5d | Trocar verde ANEST por azul "Hospital X" recolore app + PDFs (`pdfBranding.js` lê de `org_theme`) sem rebuild; contraste mínimo 4.5:1 validado na gravação do tema; dark mode derivado automaticamente |

**Aceite do épico:** dois tenants demo lado a lado no mesmo deploy mostram Homes com módulos, cores e logos diferentes; Lighthouse da Home não regride (>desempenho atual).

---

#### E5 — Admin console por tenant: convites, papéis, módulos, billing (12 dias)

**Por quê:** hoje a administração vive no Centro de Gestão (9 abas) misturando operação clínica com administração de instância. O produto precisa de um **console self-service** para o admin do cliente — é também o que permite vender sem operar onboarding manualmente.

| # | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T5.1 | Shell do console (`/console`): nova área gated por papel `org_admin`, reaproveitando `ManagementLayout`; abas Membros, Papéis, Módulos, Aparência (T4.3), Taxonomia (T3.3), Faturamento, Auditoria | 1,5d | Acessível só a `org_admin` do próprio tenant; super-admin (nós) acessa qualquer tenant via área interna separada com log de acesso |
| T5.2 | **Convites (extensão de F4):** evoluir o mecanismo de convite entregue pela Fundação — UI completa no console, papel + módulos no convite, reenvio/revogação, domínio permitido opcional (`@hospitalx.com.br` auto-join), rate-limit de convites (lição Wave 1.7 Postgres rate-limit) | 3d | Convite aceito → usuário entra direto no tenant certo com papel certo; token usado/expirado rejeitado; tudo no audit trail |
| T5.3 | **Papéis:** evoluir `rolePermissionTemplates.js` para `org_roles` por tenant (seed = templates atuais: admin, gestor qualidade, membro, visitante) + matriz papel × card na UI; corrigir na raiz o bug troca-de-cargo conhecido (memória: cuidado `cp=false` over-permissiona) | 2,5d | Trocar papel de usuário recalcula permissões na sessão seguinte sem resíduo do papel anterior; papel custom criável por tenant; query de auditoria de acessos disponível no console |
| T5.4 | **Módulos on/off:** tabela `org_modules` (módulo, status, trial_until) + UI toggle; integra com gating T4.2; módulos v2/v3 aparecem como "em breve/upgrade" | 1d | Desligar "Incidentes" esconde o módulo em <1 min para todos os usuários do tenant (sem logout); dados preservados (archive, nunca delete) |
| T5.5 | **Billing (Stripe):** assinatura por plano (v1 bundle) + add-ons por módulo + per-seat; checkout e portal do cliente hospedados pela Stripe (não construir UI de cartão); webhook → atualiza `org_modules`/seat count; bloqueio gracioso em inadimplência (read-only após X dias, nunca apagar dados) | 3d | Assinar plano ativa módulos automaticamente via webhook; cancelar → modo read-only com banner; secrets só via dashboard/`functions:secrets:set` (regra secrets); nenhum dado de cartão toca nosso backend |
| T5.6 | **Auditoria do console:** todas as ações administrativas (convite, papel, módulo, tema, billing) no audit trail com diff valor anterior→novo, reaproveitando `AuditTrailModal` | 1d | Filtro por ação/período funciona; `changedBy` sempre usuário real (regra audit-trail); export CSV do log |

**Aceite do épico:** roteiro de onboarding completo sem nossa intervenção: criar tenant → admin convida 5 usuários → define papéis → ativa módulos → assina no Stripe → app funcional com a marca dele. Tempo alvo: < 30 min.

---

### 3. Sequenciamento e dependências

| Wave | Conteúdo | Dias | Depende de |
|---|---|---|---|
| **W0** | Hardening pré-venda: bugs conhecidos de Comunicados (RLS UPDATE, z-index 1100×1100, `ConfirmDialog` em vez de `window.confirm`, dead code pin), BUG-06 BottomNav, pendências LGPD HIGH em memória | 2d (embutido) | — |
| **W1** | E1 (NOTIVISA) + E2 (evidências) | 13d | Fundação multi-tenant (RLS `org_id`) |
| **W2** | E3 (taxonomia/workflows por tenant) | 8d | Fundação; W1 não bloqueia |
| **W3** | E4 (Home widgets + theming) | 5d | E5-T5.4 (`org_modules`) pode ser stub no início |
| **W4** | E5 (console + billing) | 12d | Convites da Fundação (F4); Stripe account/CNPJ é tarefa do dono (como Cloud Function deploy no playbook) |

**Total: ~38 dias úteis (~8 semanas de dev único).**

**Riscos específicos do v1:**

1. **Formato NOTIVISA** pode exigir layout que não mapeia 1:1 com a taxonomia atual → por isso T1.1 é spike bloqueante de ½ dia antes de qualquer código do E1.
2. **Refactor de `documents.js` (T3.2)** toca `useComplianceMetrics`, Biblioteca e Qmentum score ao mesmo tempo — exigir snapshot de métricas antes/depois para o tenant ANEST (números idênticos = critério de aceite).
3. **Billing** é o único subsistema 100% novo (sem análogo no código) — manter escopo mínimo Stripe-hosted; qualquer pedido de NF-e/boleto fica explicitamente fora do v1 (parceiro tipo gateway local é decisão de v2).
4. **A própria ANEST é o tenant 0** — toda wave fecha com o critério "produção ANEST sem regressão" (build verde + screenshots Playwright + métricas Qmentum idênticas), no padrão do `wave-execution-playbook.md`.

### 4. Definition of Done do v1 vendável

- [ ] Demo end-to-end em tenant fictício: relato de incidente grave → notificação ANVISA exportada → plano de ação → documento revisado e aprovado em workflow custom → comunicado com confirmação → pacote de evidências ONA/Qmentum baixado.
- [ ] Onboarding self-service < 30 min sem intervenção nossa (roteiro E5).
- [ ] ANEST rodando como tenant 0 em produção sem regressão funcional ou de tema.
- [ ] Calculadoras, Escalas, Residência e demais módulos internos **invisíveis** para tenants comerciais (entitlement OFF por padrão — só a ANEST os tem).
- [ ] LGPD: DPA padrão por tenant, anonimização de incidentes preservada no export de evidências, dados de tenant cancelado exportáveis (portabilidade) e nunca deletados sem solicitação formal.

---

## Produto v2 — Educação/LMS

> **Escopo:** transformar o módulo de Educação Continuada em um LMS comercializável, vendido como **upsell aos tenants do v1**. Pré-requisito: Fundação + v1 em produção.
> **Âncora de venda:** acreditação ONA/Qmentum exige educação continuada **documentada e auditável** (capacitação é ROP). O LMS fecha o ciclo: trilha obrigatória → cobrança automática → certificado verificável → relatório para o auditor. Persona: gestor de qualidade hospitalar / coordenador de grupo de anestesia.

### O que já existe (inventário do código)

O módulo de educação é o segundo maior subsistema do app e está maduro em authoring, consumo e certificação. O que falta é infraestrutura de **vídeo first-party**, **cobrança server-side** e **relatório para terceiros (auditor)**.

| Capacidade | Onde está | Maturidade |
|---|---|---|
| Hierarquia Trilha→Curso→Módulo→Aula, junctions N:N, visibilidade INHERIT/PUBLIC/RESTRICTED | `src/services/educacaoService.js` (**5.191 LOC, Firestore**) + `src/pages/educacao/utils/visibilityUtils.js` | Alta — mas single-tenant e em Firestore |
| Authoring admin (3 painéis, wizard CascadeCreator 4 steps, rich text BlockNote, importer CSV de questões) | `src/pages/educacao/admin/` (AdminConteudoPage, CascadeCreator, QuestionBankImporter) | Alta |
| Quiz ROPs: **600+ questões**, 6 macro-áreas, 26 subdivisões, ranking, desafio do dia + streak | `src/services/supabaseRopsQuizService.js` (5 tabelas Supabase, migrado na Wave 1.6) | Alta — já em Supabase |
| Player de vídeo próprio: YouTube/Vimeo/MP4/áudio, `preventFastForward` para cursos obrigatórios, resume (`initialTime`), suporte a tracks WebVTT | `src/design-system/components/ui/video-player.jsx` (**1.159 LOC**) | Alta para embed; **sem streaming first-party** |
| Captions parcial: extração automática YouTube + upload manual VTT no admin | `CaptionsField` em `src/pages/educacao/admin/AulaFormModal.jsx` (Wave 1.7) | Parcial — sem pipeline para vídeo próprio |
| **Certificados com verificação pública — diferencial real**: UUID + QR Code, rota pública `/verificar/:uuid` sem auth, PDF em bucket Supabase privado (signed URL TTL 300s), audit trail de download server-side | `src/pages/educacao/utils/certificateGenerator.js`, `VerificarCertificadoPage.jsx` (Waves 1.8/1.9) | **Alta — pronto para virar argumento de venda** |
| Trilhas obrigatórias com prazo (`obrigatoria` + `prazoConclusao`) e alertas de vencimento | `src/services/notificacaoEducacaoService.js` (211 LOC) | **Parcial — lógica 100% client-side**, só dispara se o usuário abrir o app |
| Relatórios admin: métricas, funil de conclusão, heatmap, export CSV granular | `src/pages/educacao/admin/RelatoriosEducacaoPage.jsx` (877 LOC) | Parcial — sem conceito de turma, sem artefato para auditor |
| Upload de mídia: Firebase Storage, limite 2 GB, hint "prefira YouTube" | `src/services/uploadService.js` | Baixa para produto — Firebase Storage sem RLS por tenant |

### Gaps para comercialização

1. **Dados de educação em Firestore** — incompatível com o modelo de tenancy do v1 (org_id + RLS no Postgres). Migração é o primeiro passo, não negociável.
2. **Vídeo**: hoje o app depende de embed YouTube/Vimeo do próprio grupo. Produto pago precisa de hospedagem first-party com controle de acesso por tenant.
3. **Captions**: obrigatório para venda institucional (WCAG 2.1 AA 1.2.2 — pendência HIGH da auditoria de Educação de 2026-05-13 ainda aberta) e diferencial em licitação hospitalar.
4. **Cobrança de prazo é client-side**: quem não abre o app não é cobrado — inaceitável para trilha obrigatória de acreditação.
5. **Relatório não serve ao auditor**: CSV interno existe, mas não há turma/cohort, nem artefato assinado/verificável para anexar ao dossiê ONA/Qmentum.
6. **Sem separação conteúdo global vs conteúdo do tenant**: o catálogo ANEST (600+ questões ROPs, trilhas prontas) é ativo licenciável — precisa de modelo de licenciamento.

### Decisão de arquitetura: hospedagem de vídeo

Comparativo (valores de lista 2025/2026 — **ordem de grandeza, revalidar na contratação**):

| Critério | **Mux** (recomendado) | Vimeo Pro/Standard | YouTube unlisted (atual) |
|---|---|---|---|
| Modelo de custo | Pay-as-you-go: storage ~US$ 0,003/min/mês + delivery ~US$ 0,001/min assistido; encoding baseline grátis | Flat ~US$ 25–65/mês por seat; quota de upload por plano | Grátis |
| Custo estimado/tenant (catálogo 50 h + 65 alunos × 2 h/mês) | ~US$ 9/mês storage + ~US$ 8/mês delivery ≈ **US$ 15–20/mês** — embute na mensalidade | Fixo e barato no início; quota vira gargalo com N tenants subindo conteúdo | Zero |
| Proteção de conteúdo | **Signed playback (JWT) nativo** — token por sessão com claim `org_id`; DRM Widevine/FairPlay como add-on pago se algum cliente exigir | Domain-lock + link privado; **sem DRM** fora do Enterprise; proteção é global da conta, não por tenant | **Nenhuma** — link vazou = público; vídeo unlisted pode ser indexado por re-share |
| Multi-tenant | **API-first**: 1 environment, `passthrough` metadata com `org_id` por asset, signed URL emitida pela nossa Edge Function por tenant | Pastas/projetos manuais numa conta única; sem isolamento criptográfico por tenant | Inviável — canal único da plataforma |
| Captions | Auto-captions nativas por minuto + upload VTT via API | Upload VTT manual; auto-captions limitadas por plano | Auto-captions PT grátis (já integrado via `youtube-caption-extractor`) |
| Risco contratual | Lock-in moderado (HLS é padrão, migração possível) | Mudanças frequentes de planos/quotas da Vimeo | **ToS do YouTube proíbe vender acesso a conteúdo hospedado lá** — bloqueia o modelo comercial; ads/recomendações fora de controle; sem SLA |

**Decisão proposta:**
- **Mux como hospedagem first-party** do conteúdo da plataforma e dos uploads dos tenants. Custo variável é repassável na precificação (tier com franquia de horas).
- **YouTube permanece suportado como BYO content do tenant** (tenant cola URL de canal próprio): custo zero para a plataforma, responsabilidade de ToS do tenant, com aviso de compliance na UI. O player (`video-player.jsx`) já suporta os dois modos — adicionar `type='mux'` (HLS) é incremental.
- Vimeo descartado como infra (fica só como embed BYO, já suportado): flat fee não escala o isolamento por tenant e DRM real é só Enterprise.

### Waves de execução

> Total: **~48 dias úteis (~10 semanas de dev único)**. Pré-condição: v1 multi-tenant em produção.

#### Wave V2.0 — Fundação: migração Educação Firestore → Supabase multi-tenant (15 dias)

A maior tarefa do v2 e a mais arriscada: `educacaoService.js` tem 5.191 LOC sobre Firestore com junction tables N:N e queries student-safe client-side. Estratégia: **dual-write + backfill + cutover por entidade** (padrão validado nas Waves 1.8/1.9 dos certificados).

| ID | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.0.1 | Modelagem Postgres: `trilhas`, `cursos`, `modulos`, `aulas`, junctions, `progresso_usuario`, `matriculas` — todas com `org_id` + RLS por tenant; validar com `migration-validator` antes de aplicar | 3d | RLS testada com 2 tenants de teste: SELECT cruzado retorna 0 rows; 4 verbos com policy (lição Erlei: UPDATE faltando = bug silencioso) |
| T2.0.2 | Reescrita do service (Firestore → Supabase) preservando a API pública de `useEducacaoData` — hooks e páginas não mudam | 5d | Suite Vitest do módulo verde; zero mudança de assinatura nos hooks; `changedBy` = user real em toda mutation |
| T2.0.3 | Dual-write + backfill + cutover (script de migração com relatório de divergência) | 3d | 100% das entidades migradas com checksum; janela de dual-write ≥ 1 semana sem divergência antes do cutover |
| T2.0.4 | Visibilidade RESTRICTED → roles por tenant (mapear `allowedUserTypes` para o modelo de papéis do v1) | 2d | `computeEffectiveVisibility` funciona com herança INHERIT em cadeia dentro do tenant; teste de acesso negado entre tenants |
| T2.0.5 | Mídia: thumbnails/áudio/documentos Firebase Storage → Supabase Storage com policies por `org_id` (vídeo vai para Mux na V2.1) | 2d | Upload e leitura só dentro do tenant; assets antigos migrados; `uploadService` sem referência a Firebase Storage para educação |

#### Wave V2.1 — Vídeo first-party (Mux) (8 dias)

| ID | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.1.1 | Integração Mux: Edge Function para direct upload URL (admin do tenant) + webhook `video.asset.ready` → atualiza aula; `passthrough` = `org_id` + `aula_id` | 3d | Upload 2 GB completa com progress; webhook idempotente; asset sempre rastreável ao tenant |
| T2.1.2 | Playback assinado: Edge Function emite JWT de playback com TTL curto, validando matrícula + tenant do usuário | 2d | URL HLS sem token válido retorna 403; token de um tenant não reproduz asset de outro |
| T2.1.3 | Player: novo `type='mux'` no `video-player.jsx` (HLS via hls.js), mantendo `preventFastForward`, resume e tracks | 2d | Funciona em Safari iOS (HLS nativo) e Chrome; fast-forward bloqueado em curso obrigatório; dual theme |
| T2.1.4 | BYO YouTube/Vimeo mantido com banner de compliance ("conteúdo hospedado em conta do cliente, sujeito aos ToS do provedor") | 1d | Banner visível no admin ao escolher embed externo; documentado no contrato/onboarding |

#### Wave V2.2 — Captions (A11y / venda institucional) (5 dias)

> Decisão herdada (memória 2026-05-17, estudo Cornell/UW): **transcrição automática de conteúdo médico exige revisão humana** — Whisper alucina em ~1% dos transcripts, 38% deles "harmful". Pipeline = rascunho automático + fila de revisão + publicação explícita.

| ID | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.2.1 | Auto-captions: Mux auto-generated subtitles (assets Mux) + Groq Whisper Turbo (~US$ 0,04/h) como fallback; resultado entra como **rascunho**, nunca publicado direto | 2d | Toda aula de vídeo Mux gera VTT rascunho em PT; status `draft` visível no admin |
| T2.2.2 | Fila de revisão humana: editor de VTT inline no admin (corrigir termo médico), publicar/rejeitar; audit trail de quem revisou | 2d | Caption só aparece no player após `published`; log com revisor + timestamp |
| T2.2.3 | Relatório de cobertura de captions por tenant (% de aulas de vídeo com CC publicado) + badge CC nos cards de aula | 1d | Métrica no painel admin; argumento WCAG 1.2.2 documentado para proposta comercial; fecha pendência A11y HIGH da auditoria 2026-05-13 |

#### Wave V2.3 — Trilhas obrigatórias com prazo + cobrança automática (6 dias)

A lógica de prazo existe (`obrigatoria` + `prazoConclusao` + `notificacaoEducacaoService.js`), mas é computada no client a cada abertura do app. Mover para o servidor e plugar na infra de notificações existente (tabela `notifications` + `createSystemNotification` + push do Sprint 21).

| ID | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.3.1 | Tabela `matriculas` como fonte de verdade do prazo: `(org_id, trilha_id, user_id, due_date, status)`; atribuição por papel/grupo ou individual; suporte a prazo relativo à admissão (já existe `dataAdmissao` na lógica client) | 2d | Admin atribui trilha a um papel e novos usuários do papel herdam matrícula automaticamente |
| T2.3.2 | Cron diário (pg_cron ou Scheduled Edge Function): gera notificações in-app + push em D-14, D-7, D-1 e atraso, **idempotente** (uma cobrança por marco) | 2d | Usuário que não abre o app recebe push; reexecução do cron não duplica notificação; conteúdo da notificação sem dado sensível (regra LGPD do projeto) |
| T2.3.3 | Escalonamento: atraso > 7 dias notifica o gestor do tenant com lista consolidada (não 1 push por aluno) | 1d | Gestor recebe digest semanal de inadimplência de trilha; opt-out configurável |
| T2.3.4 | Política anti-spam + auditoria: log de cobranças enviadas consultável no admin | 1d | Máximo 1 notificação de educação/dia/usuário; trilha de auditoria por matrícula |

#### Wave V2.4 — Relatórios de conclusão por turma (auditor ONA/Qmentum) (6 dias)

| ID | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.4.1 | Conceito de **turma (cohort)**: agrupamento de matrículas por período/setor (`turmas` + `turma_membros`, org_id + RLS) | 2d | Admin cria turma, vincula trilha + membros; matrícula individual continua funcionando sem turma |
| T2.4.2 | Relatório de conclusão por turma: % conclusão por aluno, nota de quiz, carga horária, data de certificado; filtros por período; refatorar agregações da `RelatoriosEducacaoPage` (877 LOC) para queries server-side | 2d | Números batem com a contagem manual em seed de teste; performance < 2s para turma de 100 alunos |
| T2.4.3 | **Artefato para o auditor**: export PDF com hash + QR de verificação pública, **reutilizando a infra de certificados** (`/verificar/:uuid`) — o relatório vira documento verificável, mesmo diferencial do certificado | 2d | PDF gerado lista trilha, turma, resultados e carimbo; QR resolve na rota pública e confirma autenticidade sem login; CSV equivalente disponível |

#### Wave V2.5 — Multi-tenant de conteúdo: catálogo global vs conteúdo do tenant (8 dias)

O catálogo ANEST (trilhas prontas + 600+ questões ROPs) é o ativo que justifica preço — precisa de modelo de licenciamento, não de cópia.

| ID | Task | Est. | Critérios de aceite |
|---|---|---|---|
| T2.5.1 | Modelo: `org_id = NULL` ⇒ conteúdo global da plataforma (read-only para tenants); tabela `content_licenses (org_id, trilha_id, valido_ate)`; RLS: tenant lê próprio conteúdo + global licenciado | 3d | Tenant sem licença não vê trilha global; expiração de licença oculta a trilha mas **preserva progresso e certificados já emitidos** |
| T2.5.2 | Painel admin-plataforma (nosso back-office): publicar/versionar conteúdo global, conceder/revogar licenças por tenant | 3d | Publicação de nova versão de trilha global não quebra progresso em andamento (versionamento lock-on-attempt, padrão Moodle já mapeado no plano v5.1.0) |
| T2.5.3 | Certificado emitido sempre no contexto do tenant (logo/nome do tenant no PDF), mesmo para conteúdo global; quiz ROPs global com ranking **por tenant** (nunca cross-tenant — LGPD) | 2d | Certificado de trilha global exibe identidade do tenant; ranking não vaza nomes entre organizações |

### Riscos e dependências do v2

| Risco | Mitigação |
|---|---|
| Migração Firestore→Supabase (T2.0.x) é o maior bloco de risco do v2 — 5.191 LOC de service com lógica de herança de visibilidade | Dual-write + cutover por entidade + suite Vitest existente como rede; padrão já executado 2× no projeto (certificados, ROPs) |
| Custo variável Mux cresce com consumo dos tenants | Tier de preço com franquia de horas assistidas/armazenadas; alertas de consumo por tenant; delivery é ~US$ 0,001/min — margem confortável |
| Captions automáticas em conteúdo médico (alucinação) | Pipeline rascunho→revisão humana→publicação obrigatório (T2.2.2); nunca auto-publicar |
| Pendências da auditoria de Educação 2026-05-13 ainda abertas (deleção Firestore, ARIA quiz) | Deleção morre com a própria migração V2.0; ARIA do quiz entra como subtarefa da V2.0.2 (Radix RadioGroup já decidido no plano v5.1.0) |
| Recertificação CFM (`validoAte` no certificado) não implementada | Incluir `valido_ate` no schema de certificados na V2.0.1 (custo marginal agora vs migração depois) |

### Critérios de saída do v2 (gate para o v3)

- [ ] Zero leitura/escrita de educação em Firestore (Firestore some do módulo)
- [ ] Tenant piloto consumindo trilha global licenciada + trilha própria com vídeo Mux assinado
- [ ] Aluno inativo recebe push de prazo sem abrir o app (teste com device real)
- [ ] Relatório de turma em PDF verificado com sucesso via QR por terceiro sem login
- [ ] 100% das aulas de vídeo do catálogo global com captions PT revisadas e publicadas
- [ ] Nenhum dado (progresso, ranking, relatório) visível entre tenants em teste adversarial de RLS

---

## Produto v3 — Residência generalizada + APS (Acute Pain Service)

> **Persona-alvo:** COREME / supervisor de programa de residência (Residência) · coordenador de serviço de dor aguda e gestor de qualidade (APS).
> **Pré-requisitos:** Fundação concluída e v1/v2 em produção. O v3 reusa o módulo Qualidade do v1 (indicadores APS) e o LMS do v2 (trilhas obrigatórias do residente).
> **Tese de venda:** nenhum concorrente nacional acessível cobre o trio "escala de rotações + logbook CNRM + dor aguda integrada à qualidade". Os apps de escala mapeados na seção de mercado não falam com a COREME; planilhas Excel são o status quo real.

---

### 3.1 — O que já existe no código (inventário e o que aproveitar)

| Ativo atual | Arquivo | Estado | Destino no v3 |
|---|---|---|---|
| Rotação 2026 hardcoded | `src/data/residencia2026.js` (178 LOC) | 8 residentes fixos, 24 quinzenas em array estático, helpers de slot/rollover 18h e dia útil | **Migra para banco** (base já em banco via F3; v3 generaliza). Os helpers puros (`getSlotEfetivo`, `getProximoDiaUtil`, `isDiaNaoUtil`) são genéricos e sobrevivem como lib |
| Escala de plantão 2026 hardcoded | `src/data/plantao2026.js` (446 LOC) | 365 dias mapeados dia→residente + `FERIADOS_2026` + regra 12h útil / 24h fds-feriado | **Migra para banco** (idem F3). Regra de duração e rollover 07h viram configuração por programa |
| Sistema de trocas | `trocaPlantaoService.js` (307 LOC, código `TR######`), `trocaSobreavisoService.js` (290 LOC, `SB######`), `trocaPlantaoHospitalarService.js` (344 LOC, `PH######`) | **Maduro e validado em produção.** Padrão consistente: solicitação com código → aceite/rejeição → override em coleção diária (`residenciaPlantaoDiario/{YYYY-MM-DD}`) | **Preservar a UX e o modelo override-por-dia.** Portar de Firestore para Supabase (exigência multi-tenant) mantendo os 3 prefixos de código |
| Overrides diários | `residenciaPlantaoDiarioService.js` (109 LOC) + `residenciaEstagiosDiariosService.js` (86 LOC) | Doc por data sobrepõe a tabela estática | Vira tabela `escala_overrides` com `org_id` — mesmo conceito, fonte única |
| Cateter peridural | `src/pages/cateter-peridural/` + `supabaseCateterPeridualService.js` + migrations 027/028/029 (ver `docs/cateter-peridural.md`) | Módulo completo: inserção → evolução PO diária (Bromage, nível sensitivo, sítio, taxa de infusão) → retirada com motivo; alertas 72/96h; lembretes 24/48/72/96h; RLS por papel; LGPD-safe (iniciais do paciente) | **Embrião do APS.** Generalizar para 4 modalidades; o followup diário vira "ronda de dor" com EVA + efeitos adversos padronizados |
| Gestão admin residência | `GerenciarResidenciaPage.jsx`, `useResidencia`, `residenciaService.js` (Firestore `residencia/estagios`, `residencia/plantao`) | CRUD básico de residentes + plantão atual | Substituído pelo console COREME (3.2) |

**Conclusão do inventário:** ~60% do esforço do v3-Residência é *generalização* de código provado, não construção do zero. Os itens genuinamente novos são logbook, avaliações e carga horária. No APS, a estrutura inserção→followup→retirada já existe; o novo é a taxonomia multi-modalidade, EVA/efeitos adversos padronizados e a ponte com Qualidade.

---

### 3.2 — Wave V3.A: Residência — do hardcoded ao CRUD multi-tenant

**Objetivo:** qualquer programa de residência (de qualquer especialidade, mas anestesiologia primeiro) configura seus próprios residentes, estágios, períodos de rotação e escala de plantão — sem tocar em código.

> **Harmonização com a Fundação (F3):** a essa altura a escala já vive em banco (`escala_recursos`/`escala_slots`/`escala_config`, com importador one-shot e CRUD mínimo). A Wave V3.A **evolui** esse schema mínimo para o modelo completo de programas/rotações abaixo — não é uma segunda migração do bundle, é generalização do dado já em banco. O mesmo vale para o importador (T-V3.A2 generaliza o de F3).

#### Modelo de dados (Supabase, todas com `org_id` + RLS por tenant)

```
residencia_programas      — nome, especialidade, duração (anos), config plantão
                            (duração útil/fds, hora de rollover, regra de feriados)
residencia_residentes     — FK programa, user_id, ano (R1..R5+), status
                            (ativo/licença/concluído), datas de início/término
residencia_estagios       — catálogo por programa (nome, cor, hospital/setor,
                            preceptor responsável, carga horária semanal prevista)
residencia_periodos       — janelas de rotação (início/fim) — quinzenal, mensal
                            ou livre (generaliza as 24 quinzenas hardcoded)
residencia_alocacoes      — período × residente × estágio (substitui ROTACOES_2026)
residencia_plantoes       — data × residente (substitui PLANTOES_2026)
residencia_feriados       — calendário por org (substitui FERIADOS_2026)
escala_overrides          — data × tipo × payload (generaliza residenciaPlantaoDiario
                            e sobreavisoMaternoDiario)
trocas                    — unifica as 3 coleções Firestore; coluna `tipo`
                            (plantao_residencia/sobreaviso/plantao_hospitalar)
                            preserva os prefixos TR/SB/PH no código gerado
```

#### Tasks

| ID | Task | Detalhe | Estimativa |
|---|---|---|---|
| **T-V3.A1** | Migrations do modelo de dados | 9 tabelas acima + RLS por tenant + índices (data, período). Validar com `migration-validator` antes de aplicar | 2 d |
| **T-V3.A2** | Importador de escala | Wizard CSV/XLSX (papaparse, já avaliado no plano v5.1): cola a planilha da COREME → preview matriz residente×período → confirma. É o caminho de onboarding real — ninguém digita 365 dias na mão. Seed script converte os dados do tenant ANEST (dogfooding) | 3 d |
| **T-V3.A3** | Console COREME — programas e residentes | CRUD programa + residentes (convite vincula `user_id` do tenant), promoção de ano em lote (R1→R2 na virada de março), desligamento/licença com data | 3 d |
| **T-V3.A4** | Console COREME — grade de rotações | Editor matriz período×residente com Select de estágio por célula, validação de conflito (residente em 2 estágios no mesmo período), duplicar período anterior | 4 d |
| **T-V3.A5** | Console COREME — escala de plantão | Calendário mensal com atribuição por dia, contador de plantões/residente no mês (equidade visível), respeitando config 12h/24h do programa | 3 d |
| **T-V3.A6** | Refactor dos consumidores | HomePage cards (Estágios/Plantão Residência), `ResidenciaHubPage`, widgets de escala: trocar import estático por hook `useEscalaResidencia(orgId)` com cache TanStack. Helpers puros de `residencia2026.js` viram `src/lib/escala-helpers.js` com testes | 3 d |
| **T-V3.A7** | Port das trocas Firestore→Supabase | Tabela `trocas` unificada + `escala_overrides`; manter máquina de estados (pendente→aceita/rejeitada/cancelada), códigos TR/SB/PH, notificações e guard "só residente cria". Migrar histórico do tenant ANEST | 4 d |

**Critérios de aceite (Wave V3.A):**
- [ ] Tenant novo configura programa completo (residentes + rotações + plantões) em <1h via importador, sem suporte
- [ ] Zero referência a `residencia2026.js`/`plantao2026.js` em runtime (`grep` limpo); arquivos deletados
- [ ] Troca TR aceita gera override que aparece em todos os widgets em tempo real (paridade com produção atual)
- [ ] RLS: residente do tenant A não enxerga escala do tenant B (teste automatizado com 2 JWTs)

---

### 3.3 — Wave V3.B: Logbook de procedimentos (NOVO — feature de venda nº 1 da persona COREME)

**Objetivo:** registro longitudinal de procedimentos do residente, com metas por matriz de competências e relatórios prontos para visita da CNRM/auditoria do programa. Hoje isso é caderninho ou planilha — o app captura no ponto de cuidado (mobile-first, ≤30s por registro).

#### Modelo

```
logbook_procedimentos_catalogo — por programa: nome, categoria (via aérea, bloqueio
                                 de neuroeixo, bloqueio periférico, acesso vascular,
                                 anestesia por subespecialidade...), meta numérica
                                 opcional por ano de residência
logbook_registros              — residente, procedimento (FK catálogo), data,
                                 papel (executou/auxiliou/observou), supervisão
                                 (direta/indireta), contexto (eletivo/urgência),
                                 estágio vigente (auto-preenchido da alocação),
                                 intercorrência (bool + texto livre opcional)
```

**Regra LGPD/regulatória central:** o logbook **não identifica paciente** (sem nome, sem iniciais, sem registro hospitalar). É registro de *atividade do residente*, não de cuidado ao paciente — isso o mantém fora da zona prontuário/SaMD (ver 3.6). Validação no schema: nenhum campo de identificação existe.

#### Tasks

| ID | Task | Detalhe | Estimativa |
|---|---|---|---|
| **T-V3.B1** | Migrations + catálogo seed | 2 tabelas + seed do catálogo de anestesiologia baseado na Matriz de Competências CNRM da especialidade (~40 procedimentos em 8 categorias) | 1,5 d |
| **T-V3.B2** | Registro rápido mobile | FAB na home do residente → bottom sheet: procedimento (busca + recentes), papel, supervisão — 3 taps no caminho feliz. Data default hoje, estágio auto-preenchido | 3 d |
| **T-V3.B3** | Dashboard do residente | Progresso vs. metas por categoria (barras), timeline, streak de registro; comparação anônima com mediana da turma (opt-in) | 2,5 d |
| **T-V3.B4** | Relatórios COREME | Visão por residente e por turma: total/categoria/papel, gaps vs. meta, export PDF assinável (reusa pipeline de certificados do v2) e CSV. É o artefato que a COREME apresenta na avaliação do programa | 3 d |
| **T-V3.B5** | Ponte APS→logbook | Ao registrar cateter/bloqueio no APS com residente envolvido (campo já existe no fluxo HRO atual), sugerir entrada no logbook pré-preenchida — 1 tap para confirmar. Dedup por referência cruzada | 1,5 d |

**Critérios de aceite:** registro completo em ≤30s no celular (validar com Playwright mobile 375px); relatório COREME exporta PDF com os números corretos contra fixture conhecida; nenhuma coluna de identificação de paciente no schema (teste de migration).

---

### 3.4 — Wave V3.C: Avaliações de estágio + carga horária CNRM

#### Avaliações de estágio

Fecha o ciclo rotação→desempenho: ao término de cada período, o preceptor responsável pelo estágio avalia o residente.

| ID | Task | Detalhe | Estimativa |
|---|---|---|---|
| **T-V3.C1** | Schema + templates de avaliação | `avaliacoes_templates` (escala Likert por competência + conceito global + feedback texto) e `avaliacoes_estagio` (período × residente × preceptor, status rascunho/enviada/ciente). Template default baseado em competências CanMEDS adaptadas, editável por programa | 2 d |
| **T-V3.C2** | Fluxo do preceptor | Fila "avaliações pendentes" gerada automaticamente do fechamento de cada período (`residencia_periodos.fim`); notificação + lembrete em 7 dias (reusa engine de notificações) | 2,5 d |
| **T-V3.C3** | Ciência do residente + visão COREME | Residente dá ciência (timestamp, sem editar); COREME vê matriz residente×estágio com conceitos, série temporal por competência, sinalização de avaliação atrasada >15 dias | 2,5 d |

#### Carga horária (Lei 6.932/81 + Resoluções CNRM: máx. 60h/semana)

A carga semanal é **derivável dos dados que o sistema já tem**: alocação de estágio (carga prevista no catálogo) + plantões da semana (12h/24h) + trocas efetivadas. Nenhuma digitação extra.

| ID | Task | Detalhe | Estimativa |
|---|---|---|---|
| **T-V3.C4** | Motor de cálculo semanal | View materializada/função: Σ horas por residente-semana considerando overrides e trocas; testes com semanas-limite (feriado + plantão 24h + troca) | 2 d |
| **T-V3.C5** | Alertas e relatório de conformidade | Badge no console COREME quando projeção da semana >60h **antes de ela ocorrer** (permite remanejar); relatório mensal por residente (média, picos, semanas não-conformes) exportável — evidência de conformidade para CNRM e proteção trabalhista do programa | 2,5 d |
| **T-V3.C6** | Simulação na criação de escala | No editor de plantão (T-V3.A5), célula fica `warning` se a atribuição estourar 60h na semana do residente — prevenção no ponto de decisão | 1,5 d |

**Critérios de aceite:** avaliação pendente aparece para o preceptor ≤24h após fim do período; cálculo de horas bate com conferência manual em 4 semanas-fixture (incluindo semana com troca + feriado); escala que estoura 60h é impossível de salvar sem confirmação explícita com justificativa (audit trail).

---

### 3.5 — Wave V3.D: APS — generalizar cateter peridural para Acute Pain Service

**Objetivo:** o módulo de cateter peridural (1 técnica, 2 hospitais hardcoded) vira um serviço de dor aguda completo: **peridural · perineural (bloqueios contínuos) · PCA (venosa/peridural) · dose única com acompanhamento**. A ronda diária de dor padroniza EVA e efeitos adversos, e os agregados alimentam o módulo Qualidade do v1 — este é o gancho de venda para hospitais em acreditação (ONA/Qmentum cobram programa de manejo de dor com indicadores).

#### Modelo (evolução das tabelas 027/028/029)

```
aps_dispositivos   — generaliza cateteres_peridural: + modalidade (peridural/
                     perineural/pca_iv/pca_peridural/dose_unica), sítio anatômico
                     (catálogo por modalidade), droga/concentração/programação
                     de bomba; hospital deixa de ser CHECK unimed|hro e vira FK
                     para hospitais do tenant
aps_avaliacoes     — generaliza followup: + EVA repouso (0–10), EVA movimento
                     (0–10), efeitos adversos padronizados (multi-select:
                     náusea/vômito, prurido, retenção urinária, bloqueio motor
                     [Bromage mantido], hipotensão, sedação excessiva [escala
                     RASS simplificada], parestesia, falha analgésica, depressão
                     respiratória), conduta (mantém/ajusta/resgata/retira)
aps_indicadores    — agregados diários por org (job): EVA médio/p90 por modalidade,
                     % avaliações com EVA>4 (dor não controlada), taxa de efeito
                     adverso por tipo, taxa de falha/retirada precoce, tempo médio
                     de permanência, % rondas em dia
```

O que **não muda** (já provado em produção): fluxo inserção→avaliação diária→retirada com motivo obrigatório; alertas de duração 72/96h; lembretes 24/48/72/96h com dedup; `UNIQUE(dispositivo, dia)`; LGPD via iniciais do paciente em notificações; exigência de anestesiologista/residente por contexto.

#### Tasks

| ID | Task | Detalhe | Estimativa |
|---|---|---|---|
| **T-V3.D1** | Migrations de generalização | Renomear/estender tabelas com compat (views com nome antigo durante transição), catálogo de sítios por modalidade, multi-select de efeitos adversos como tabela relacional (não JSONB — precisa agregar) | 2,5 d |
| **T-V3.D2** | UI multi-modalidade | Formulário de inserção dirigido pela modalidade (campos condicionais: bomba/PCA pede programação; perineural pede nervo-alvo); listagem com filtro por modalidade; thresholds de duração configuráveis por modalidade e por tenant (96h peridural ≠ perineural) | 3,5 d |
| **T-V3.D3** | Ronda de dor padronizada | FollowupForm vira "avaliação APS": EVA duplo com slider numérico grande (uso à beira-leito, touch ≥44px), efeitos adversos em chips multi-select, conduta obrigatória. Tempo-alvo ≤60s por paciente | 3 d |
| **T-V3.D4** | Painel de ronda diária | Visão "pacientes APS de hoje": lista ordenada por pendência de avaliação + EVA da última ronda + alertas; otimizada para o anestesiologista que faz a ronda com o celular na mão | 2,5 d |
| **T-V3.D5** | Indicadores → módulo Qualidade | Job de agregação diária + cards no dashboard de Qualidade do v1 (EVA p90, dor não controlada, efeitos adversos, permanência) com série temporal e comparativo entre unidades; efeito adverso grave (depressão respiratória) oferece criação de incidente pré-preenchido no módulo Incidentes (v1) — **sem automatismo**, sempre ação humana | 3 d |
| **T-V3.D6** | Hardening regulatório do módulo | Implementar as salvaguardas da nota 3.6: disclaimers, segregação de flag, textos de alerta revisados, retenção/export | 2 d |

**Critérios de aceite:** ronda completa de 1 paciente em ≤60s (Playwright mobile); indicador "EVA médio" do painel bate com cálculo manual sobre fixture; tenant ANEST migra os cateteres históricos sem perda (contagem antes/depois); efeito adverso grave registrado gera sugestão de incidente com dados corretos pré-preenchidos.

---

### 3.6 — NOTA REGULATÓRIA (obrigatória): prontuário, SaMD e RDC 657/2022

O APS registra **dado clínico identificável de paciente em acompanhamento ativo** (EVA, Bromage, efeitos adversos, condutas). Isso encosta em duas fronteiras que o restante do produto não encosta:

**1. Fronteira prontuário (CFM).** Registro assistencial de paciente é matéria de prontuário (Res. CFM 1.638/2002 e 1.821/2007 — guarda mínima de 20 anos para registros em papel; sistemas eletrônicos exigem requisitos de NGS2/certificação SBIS-CFM para *substituir* o papel). **Posicionamento do produto:** o APS é **registro paralelo de gestão de qualidade do serviço de anestesia — não substitui nem compõe o prontuário oficial**; a evolução no prontuário do hospital continua obrigatória. Esse posicionamento deve estar (a) no contrato/termo de uso, (b) em disclaimer permanente na UI do módulo, (c) na documentação de implantação entregue ao hospital.

**2. Fronteira SaMD (ANVISA RDC 657/2022).** Software com finalidade médica (diagnóstico, monitoramento, tratamento) é dispositivo médico e exige regularização na ANVISA (notificação classe I/II ou registro III/IV). A RDC exclui explicitamente software de **gestão administrativa** e software que apenas **armazena/arquiva/comunica** dados (função de prontuário/registro). O risco do APS está nos pontos onde ele deixa de "registrar" e passa a "orientar conduta":

| Funcionalidade | Risco SaMD | Mitigação de design (T-V3.D6) |
|---|---|---|
| Alertas 72/96h de duração | Baixo, mas existente | Manter como **lembrete de prazo administrativo** ("revisar permanência conforme protocolo do serviço"), nunca como recomendação clínica ("retirar agora") — revisar textos atuais que dizem "retirar imediatamente" |
| EVA>4 / efeito adverso grave | Médio se houver automação | **Nunca** sugerir dose, droga ou conduta; o campo "conduta" é registro do que o médico decidiu, não output do sistema. Sugestão de incidente é fluxo de qualidade, não clínico |
| Indicadores agregados | Nulo | Dado agregado/anonimizado para gestão = fora do escopo SaMD |
| Qualquer cálculo de dose, score preditivo ou recomendação | Alto — **proibido no v3** | Backlog só com estratégia regulatória própria (mesma razão pela qual as calculadoras ficam fora do produto comercial) |

**Exigências práticas para o roadmap:**
- **T-V3.D6a — Parecer regulatório formal** antes do GA do APS: consultoria especializada em RDC 657/2022 para validar o enquadramento "registro de qualidade/prontuário-adjacente, não SaMD" e revisar cada texto de alerta. Orçar ~R$ 15–40k. **Gate de release: sem parecer, APS não vai a GA comercial** (beta fechado com termo específico é aceitável).
- **Segregação do módulo:** APS atrás de feature-flag por tenant, contratável como add-on com termo aditivo próprio. Se o enquadramento mudar (ANVISA é evolutiva no tema), desliga-se o módulo sem afetar o produto core — e o blast radius regulatório fica contido.
- **LGPD reforçada (art. 11 — dado sensível de saúde):** base legal = tutela da saúde por profissional de saúde; RIPD específico do módulo (há template no projeto: `docs/lgpd-ripd-incidentes.md`); retenção configurável por tenant alinhada à política de prontuário do hospital; export completo por paciente (direito do titular + portabilidade na saída do cliente); manter o padrão já implantado de iniciais-apenas em notificações.
- **Logbook (3.3) fica deliberadamente fora dessa zona** por não identificar paciente — manter essa invariante no schema é decisão regulatória, não só de privacidade.

---

### 3.7 — Resumo de esforço e sequenciamento do v3

| Wave | Conteúdo | Estimativa | Dependências |
|---|---|---|---|
| V3.A | Residência multi-tenant (CRUD + importador + trocas) | 22 d úteis | Fundação multi-tenant (F3) |
| V3.B | Logbook de procedimentos | 11,5 d úteis | V3.A (estágio vigente); T-V3.B5 depende de V3.D |
| V3.C | Avaliações + carga horária 60h | 13 d úteis | V3.A |
| V3.D | APS multi-modalidade + indicadores | 16,5 d úteis | Módulo Qualidade (v1); paralelo a V3.B/C |
| — | Parecer regulatório (externo) | 4–8 semanas calendário, em paralelo desde o início do v3 | Contratar no kickoff |

**Total: ~63 dias úteis (~13 semanas de dev único).** V3.A é o caminho crítico da Residência; V3.D depende do v1 (não do V3.A) e pode rodar em paralelo se houver segunda frente. Recomenda-se cortar o release em dois: **v3.0 (Residência: A+B+C)** vendável à COREME isoladamente, e **v3.1 (APS)** condicionado ao parecer regulatório — desacoplando a receita da Residência do risco regulatório do APS.

**Riscos específicos do v3:**
- **Regulatório APS** — mitigado pelo gate de parecer + segregação por flag + corte v3.0/v3.1 (acima).
- **Adoção do logbook depende de hábito do residente** — mitigar com registro ≤30s, ponte automática APS→logbook e relatório COREME como pressão institucional positiva.
- **Migração Firestore→Supabase das trocas** é a única mudança em sistema "que já funciona bem" — fazer com dual-read e período de observação, padrão já executado com sucesso na migração de certificados (Waves 1.8/1.9).

---

## Go/No-Go e Riscos

### Linha do tempo consolidada (dev único + Claude Code)

| Fase | Escopo | Esforço | Calendário acumulado |
|---|---|---|---|
| **Fundação** | multi-tenancy + RLS, router, dados→banco, convites, suite de isolamento | 41–52 d úteis (~9–11 sem) | ~11 sem |
| **v1** | Qualidade + Documentos + Incidentes + Comunicados + console/billing | 38 d úteis (~8 sem) | ~19 sem |
| **v2** | LMS: migração Firestore→Supabase, Mux, captions, prazos server-side, turmas, licenciamento | 48 d úteis (~10 sem) | ~29 sem |
| **v3** | v3.0 Residência (A+B+C: 46,5d) + v3.1 APS (16,5d) | 63 d úteis (~13 sem) | ~42 sem |
| **Total** | | **~190–201 d úteis** | **~9–10 meses** (sem folga para suporte/imprevistos — ver risco 4) |

A ordem v2 ↔ v3.0 é **trocável**: se a demanda dos design partners for COREME antes de educação, o v3.0 (Residência) pode antecipar o v2 — as dependências reais do v3.0 são a Fundação (F3) e o v1 (não o LMS; só a T-V3.B4 reusa o pipeline de PDF verificável, que pode ser extraído isoladamente).

### Gates de decisão (Go/No-Go)

| Gate | Antes de | Critério **Go** | **No-Go** / fallback |
|---|---|---|---|
| **G0** | iniciar a Fundação | 3–5 conversas de descoberta com cooperativas FEBRACAN validando dor + faixa de preço (fechar as lacunas de campo da seção de mercado: nº de CSAs, tíquete Qualiex/Pega Plantão, % de acreditados que terceirizam anestesia) | App segue como ferramenta interna; F2 (router) e F5 (testes) ainda valem como pagamento de tech debt |
| **G1** | iniciar o v1 | Fundação com DoD batido (roteiro "Hospital Demo" end-to-end + suite de isolamento verde em CI) **e 2 clientes design-partner assinados** (LOI/contrato com condição de fundador) | Sem 2 design partners, **não construir E5/billing** — pausar e voltar a campo com a demo da Fundação |
| **G2** | GA comercial do v1 | Definition of Done do v1 completo: demo end-to-end, onboarding < 30 min, ANEST tenant 0 sem regressão, **DPA padrão assinável** e módulos internos invisíveis para tenants | Permanecer em beta fechado com os design partners até fechar os critérios |
| **G3** | iniciar o v2 | v1 em produção estável com tenants pagantes + critérios de saída do v1 batidos + **demanda explícita por educação** (upsell puxado pelos clientes, não empurrado) | Antecipar v3.0 (Residência) se a demanda de campo for COREME |
| **G4** | iniciar o v3.0 (Residência) | ≥ 2 programas de residência dispostos a pilotar (persona COREME validada); F3 em produção | Manter Residência como módulo exclusivo ANEST |
| **G5** | GA do v3.1 (APS) | **Parecer regulatório formal (RDC 657/2022) favorável ao enquadramento "registro de qualidade, não SaMD"** + RIPD do módulo + termo aditivo pronto | Sem parecer: no máximo beta fechado com termo específico; APS permanece atrás de feature-flag e a receita da Residência não depende dele |

### Riscos transversais

1. **Regulatório — SaMD (ANVISA RDC 657/2022).** O produto se posiciona inteiro no lado "gestão administrativa / armazenamento e comunicação de dados", explicitamente excluído da RDC. A fronteira é cruzada quando o software passa a orientar conduta clínica. Salvaguardas estruturais do roadmap: calculadoras fora do produto comercial, APS segregado por feature-flag + gate G5, textos de alerta sempre como lembrete administrativo, proibição de cálculo de dose/score preditivo em todo o backlog. Se o entendimento da ANVISA evoluir, o blast radius fica contido a um módulo desligável por flag.
2. **LGPD — operador de dados de saúde de terceiros.** Hoje a ANEST é controladora dos próprios dados; com tenants comerciais a plataforma vira **operadora** de dado sensível (art. 11) de N controladores. Obrigações que entram no caminho crítico comercial (não técnico): **DPA padrão por tenant** como anexo do contrato (pré-requisito do G2); RIPD por módulo sensível (template já existe: `docs/lgpd-ripd-incidentes.md`); retenção e portabilidade por tenant (dados de cliente cancelado exportáveis e nunca deletados sem solicitação formal — já é política do produto); plano de resposta a incidente de segurança com notificação ao controlador. **Expectativa de procurement:** o concorrente mais próximo (Qualiex) anuncia ISO 9001/27001/27701 — cooperativas grandes e hospitais vão enviar questionário de fornecedor pedindo evidência equivalente. Sem certificação no curto prazo, a resposta é um **security whitepaper** (arquitetura RLS + suite de isolamento em CI como evidência verificável + audit trail + secrets hygiene) e um roadmap de ISO 27001 a orçar quando houver tração — não tentar certificar antes de receita.
3. **Bus factor = 1.** Dev único é o maior risco operacional do negócio: venda B2B pressupõe continuidade e SLA. Mitigações mínimas **antes do G2**: CI com a suite de isolamento como guardião de regressão (F5), runbooks de operação (deploy, restore, resposta a incidente), documentação viva já no padrão do projeto (`docs/` + `CLAUDE.md` + `.claude/rules`), backups com restore testado (drill trimestral) e, se exigido em contrato, cláusula de continuidade/escrow de código. Contratar segunda pessoa é decisão pós-receita — mas o plano de 9–10 meses **não tem folga para indisponibilidade prolongada do único dev**, e isso deve estar explícito no planejamento comercial (não prometer datas firmes a clientes antes do G1).
4. **Custo de suporte e onboarding.** Cada tenant gera carga recorrente (import de escala, dúvidas de acreditação, entregabilidade de e-mail, billing). O roadmap ataca por design — onboarding self-service < 30 min (E5), importadores CSV (F3/V3.A), console do tenant, notificações idempotentes, health views — mas o resíduo é real: reservar **~20% da capacidade pós-GA** para suporte e correção, o que na prática estica os meses de v2/v3 se a base crescer. Definir SLA realista em contrato (horário comercial, sem 24/7) e medir custo de suporte por tenant desde o primeiro cliente: é o dado que decide entre crescer a base ou subir preço.
5. **Riscos de execução por fase (já mitigados nas próprias seções — não repetir):** regressão silenciosa de RLS e Edge Functions service-role (Fundação/F1); formato NOTIVISA e refactor de `documents.js` (v1/E1/E3); migração das 5.191 LOC do `educacaoService` e custo variável Mux (v2); migração das trocas e adoção do logbook (v3). Padrão comum de mitigação: dual-write/shadow mode + cutover por entidade + teste de isolamento como gate — já executado 2× com sucesso no projeto (certificados Waves 1.8/1.9, ROPs Wave 1.6).

### Fora de escopo (decidido)

- **Calculadoras clínicas (73 + 7 critérios UTI):** ficam **exclusivas do tenant ANEST** (entitlement OFF por padrão para tenants comerciais). Software que calcula dose/score com finalidade clínica é o caso central de SaMD na RDC 657/2022 — risco regulatório máximo — e calculadoras grátis abundam no mercado: **sem diferencial comercial que justifique o risco**. Só voltam ao backlog com estratégia regulatória própria.
- **Gravação de vídeo in-app:** decisão prévia do dono — sem MediaRecorder/getUserMedia; admin grava externamente e faz upload (Mux) ou cola URL embed.
- **Recomendação clínica automatizada de qualquer tipo** (sugestão de dose/droga/conduta, score preditivo): proibida em todo o roadmap (v1–v3) pela mesma razão SaMD.
- **NF-e/boleto/gateway local no v1:** billing é Stripe-hosted; faturamento local é decisão de v2+ com parceiro.
- **Self-service de signup de org:** a Fundação entrega o mecanismo (bootstrap por admin de plataforma + convite); landing page e signup aberto são decisão comercial posterior ao G2.
- **Integração automática com NOTIVISA:** sem API pública documentada — o escopo é exportação assistida (E1), revalidada no spike T1.1.
- **Certificação SBIS-CFM / substituição de prontuário:** o APS é registro paralelo de gestão de qualidade; substituir prontuário eletrônico está fora de qualquer versão deste roadmap.
