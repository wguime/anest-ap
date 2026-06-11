# Relatório — Madrugada autônoma 2026-06-10→11

> Estado vivo do loop. Atualizado a cada bloco. Plano: `~/.claude/plans/madrugada-tech-debt-2026-06-11.md`

## Checklist de Workstreams

| WS | Descrição | Status |
|----|-----------|--------|
| Pre-flight | 3 agentes Explore (e2e / lint warnings / coverage gaps) | concluído |
| W1 | Suite E2E completa verde (2× p/ flakiness) | concluído (6 passed / 4 skipped justificados ×2, commit 052a442 pushado) |
| W2 | Lint warnings 251 → mínimo seguro | concluído (251→240, commit e0debde pushado) |
| W3 | Coverage de testes (test-writer paralelo) | concluído (+7 suítes / +198 testes, commit 939ed25 pushado) |
| W4 | Auditoria de performance (Lighthouse, read-only) | concluído (5 rotas auditadas; relatório abaixo; zero fix aplicado — propostas apenas) |

## Achados do pre-flight

**E2E** (specs em `e2e/`): auth.spec verde é o padrão canônico (sem networkidle; espera `heading "Página inicial"` 20s; labels nav `Início/Gestão/Educação/Menu`). Drifts nos 4 restantes: 13× `waitForLoadState('networkidle')` (calculadora-flow 3, quiz-offline 3, api-public 3, conflict-resolution 4) + seletores frágeis (quiz: heurística "first quiz" sem seed; api-public: checkboxes de scopes condicionais). api-public e conflict-resolution já fazem `test.skip` sem `E2E_ADMIN_*`. webServer do Playwright NÃO sobe sozinho — dev server manual na 5173.

**Lint** (251 warnings): 6 auto-fix (`unused eslint-disable` em errorReporting.js + useEducacaoData.js) · 125 "warn por design" (set-state-in-effect 55, only-export-components 38, preserve-manual-memoization 32) — NÃO tocar · 82 exhaustive-deps, dos quais só ~2 obviamente estáveis (Popover.jsx `contentRef` ×3) + 14 incertos useEffect + 53 arriscados em useCallback/useMemo (hotspot: useCentroGestaoDashboard.js com 35). 14 react-hooks/purity (animated-background.jsx 6 — possível bug real, anotar).

**Coverage**: gaps maiores em contexts (2/14 testados). Top candidatos fáceis: `src/utils/comunicadosHelpers.js` (134L, 14 exports puros), `src/utils/audit.js` (69L, crítico audit-trail), `src/utils/plantaoHospitalarNotifications.js` (111L, puro), `src/utils/checkinCodeGenerator.js` (55L, TOTP+fake timers), `src/utils/featureFlags.js`, `src/contexts/EventAlertsContext.jsx` (249L, sem backend), `src/services/tagsService.js` (139L, chain factory padrão). Padrões de referência: dateUtils.test.js (timers), supabaseConflictQueueService.test.js (vi.hoisted+chain), DocumentsContext.test.jsx (renderHook).

## Métricas (antes → depois)

| Métrica | Antes | Depois |
|---------|-------|--------|
| Lint errors | 0 | 0 |
| Lint warnings | 251 | 240 (125 dos restantes são "warn por design") |
| Suítes Vitest | 129 (1947 testes) | 136 (2145 testes + 3 skipped) |
| E2E specs verdes | 1/5 (auth) | 5/5 — suite completa 6 passed / 4 skipped justificados / 0 failed, 2× sem flakiness |
| Lighthouse (preview :4173, mobile) | n/a | baseline criado: home P61/A88, calculadoras P90/A95, biblioteca P75/A95, educacao P90/A100 (detalhes abaixo) |

Commits da madrugada (todos pushados, CI valida): `e0debde` (W2 lint) → `052a442` (W1 e2e) → `939ed25` (W3 testes) → este relatório.

## W4 — Auditoria de performance (Lighthouse 13.4.0, mobile, build de produção via `vite preview` :4173)

Método: Chromium persistente + CDP, login real com user e2e, LH anexado com `--disable-storage-reset` (preserva sessão Firebase no IndexedDB). LHRs em `/tmp/lh-*.json`.

| Rota | Perf | A11y | BP | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` home (auth, cache warm) | 61 | 88 | 96 | 3.5s | 4.2s | 30ms | **0.359** |
| `/` shell cold (tela de login, mede bootstrap real) | 42 | — | — | 9.1s | 9.8s | 10ms | 0.279 |
| `/calculadoras` | 90 | 95 | 100 | 2.5s | 3.1s | 10ms | 0 |
| `/biblioteca` | 75 | 95 | 100 | 2.6s | 3.1s | 10ms | **0.257** |
| `/educacao` | 90 | 100 | 100 | 2.5s | 3.1s | 10ms | 0 |
| `/centro-gestao` | artefato (user e2e sem permissão → shell vazio, NO_LCP) | 100 | 100 | — | — | — | — |

Critical path eager: ~976KB gz / 3.4MB raw (index 404KB + vendor-ui 196KB + vendor-firebase 138KB + vendor-pdf 122KB + supabase 44KB + markdown 44KB + CSS 28KB).

### Top-10 oportunidades (custo/benefício; NADA executado — só propostas)

1. **CLS home/biblioteca** — reservar altura dos widgets async (skeleton/min-height). Trivial-isolado; CLS 0.359→<0.1 ≈ home P61→~75 sozinho.
2. **vendor-pdf (122KB gz) fora do caminho crítico** — 86% unused no load; import estático em algum ponto do grafo eager → converter p/ `import()` no ponto de uso. Estrutural-leve.
3. **A11y home 88→~100** — 4 fixes pontuais: botões de ícone sem accessible name (×4); dots de carousel 8px (target 44px); token `badge secondary subtle` contraste 4.27 (corrige 46 ocorrências de uma vez); `label-content-name-mismatch` ×11. Trivial-isolado.
4. **CORS `pegaplantao-proxy`** — origin `localhost:4173` fora da allowlist → widget de plantões quebrado no preview (6 erros console). Trivial (padrão allowlist+echo já documentado). ⚠️ é edge function — precisa de deploy, fora do escopo da madrugada.
5. **Defer vendor-markdown (44KB gz, 73% unused)** — dynamic import no componente de render. Estrutural-leve.
6. **Quebrar chunk index (404KB gz, 57% unused)** — 11 providers eager em main.jsx + barrel do DS; mover Tier-2 p/ lazy. Estrutural (proposta principal p/ FCP cold 9.1s).
7. **firebase messaging/analytics fora do eager** (74KB unused de 138KB). Estrutural-médio.
8. **`manualChunks` não captura `react-dom`** (`vite.config.js:144`: key 'react-dom' não casa com 'react-dom/client' → react-dom caiu no index, invalida cache do vendor a cada deploy). Config trivial mas muda chunking — validar build/preview ao aplicar.
9. **Fetch `user_activity_log` de 47KB no bootstrap** — revisar select/limit/janela. Trivial-isolado.
10. **Fonte Inter do Google Fonts** (CSS bloqueante + 48KB) — token de tipografia usa system-ui primeiro; verificar se Inter é usada → self-host com swap ou remover tag + preconnects.

Caveats: preview local ≠ produção (sem CDN/TLS); rotas autenticadas mediram cache warm (clear via CDP não surtiu efeito) — cold real é o run shell (FCP 9.1s); realtime impede network idle → LH marca "page loaded too slowly" em todos os runs autenticados; 1 run/rota (variância FCP/LCP ±10% típica); `/centro-gestao` requer conta admin p/ auditoria válida.

## Log de execução

- 2026-06-10 (tick 1): plano lido, relatório criado, pre-flight concluído (3 Explore paralelos).
- 2026-06-10 (tick 1): dev server up na 5173; agentes W1 (e2e) e W2 (lint) disparados em paralelo em background. W3 aguarda W2 (ambos validam com test:run — evitar interferência). Commits serão feitos pelo orquestrador por bloco (e2e/ e src/ disjuntos).
- 2026-06-11 (tick 4, final): W4 CONCLUÍDO (Lighthouse autenticado em 4 rotas + bootstrap cold; top-10 propostas rankeadas; zero fix aplicado — itens "triviais" encontrados são visuais/CSS e mereciam validação em browser fora do horário). 4/4 workstreams concluídos → relatório finalizado, memória atualizada, loop encerrado.
- 2026-06-10 (tick 3): W1 CONCLUÍDO (suite e2e verde 2×, commit 052a442). W3 CONCLUÍDO (4 test-writers; 7 suítes/198 testes novos; integração 136 suítes/2145 testes + build verdes; commit 939ed25). W4 disparado em background — usando `npm run preview` (4173, build de produção) em vez do dev server para scores realistas.
- 2026-06-10 (tick 2): W2 CONCLUÍDO — 251→240 warnings, 0 erros; eslint --fix (6 diretivas) + popover.jsx contentRef + ComunicadosContext loadData. Suite 1947 verde, build verde. Commit e0debde pushado. W3 disparado: 4 test-writers paralelos (utils pequenos / utils domínio / EventAlertsContext / tagsService). W1 segue rodando.

## W2 — detalhes para decisão do dono

- exhaustive-deps restantes (78): hotspot useCentroGestaoDashboard.js (35, arriscados — fix mecânico via useMemo wrapper mas muda identidades em cascata); fixes baratos que exigem reordenação/refactor leve: EventAlertsContext.jsx:53 e NovoConteudoModal.jsx:157 (TDZ — mover declaração), CheckinCodeInput.jsx:43,66 + ReunioesPage.jsx + CursoFormModal.jsx:108 (funções plain → useCallback).
- react-hooks/purity em animated-background.jsx:106-111: NÃO é bug real (Math.random em useMemo decorativo, congela no mount). Mesmo padrão em quiz.jsx:321 (shuffle de alternativas) — re-shuffle em remount muda ordem das opções; comportamento pré-existente, merece olhar futuro.

## W1 — detalhes

- **calculadora-flow**: reescrito com waits canônicos; matemática Holliday-Segar validada contra a regra real do app (4-2-1×24: 20kg → 60.0 mL/h, 1440 mL/dia — pre-flight presumia 100-50-20=1500); página de detalhe é sem tabs por design.
- **quiz-offline**: reescrito sobre o Desafio do dia ROPs (pool de 640 questões seedado, estável) em vez da heurística "primeiro quiz"; 3 skips graciosos documentados (desafio já feito hoje / RPC indisponível / sem permissão) — nenhum disparou nas rodadas.
- **api-public + conflict-resolution**: skip estrito sem `E2E_ADMIN_*` (removido fallback que rodava com user comum e falhava no gate admin); networkidle removidos para quando creds admin existirem.
- 2 rodadas completas: **6 passed / 4 skipped / 0 failed**, ~20s, zero flakiness.

## Decisões anotadas para o dono

> **RESOLVIDO 2026-06-11 (manhã)** — dono autorizou ("corrija as decisões pendentes"); todos os 8 itens abaixo corrigidos nos commits `da1ae3d`…`d2149e8` (pushados): tagsService created_by → UID; audit.js case-insensitive; JSDoc checkinCodeGenerator; formatRelativeDate futuro → dayMonth + código morto removido; widget-card sem button aninhado (div role=button, padrão do calculadora-card); Holliday-Segar Volume 24h pela 100-50-20 (calc-validator APROVOU; e2e atualizado 1440→1500); fila de reenvio offline do Desafio ROPs (infra IDB existente); EventAlertsContext com re-hidratação + poda + cleanup de timers. Integração: 138 suítes / 2200 testes, lint 0 erros / 240 warnings, build verde, e2e 6 passed / 4 skipped 2×.
> Pendência clínica nova sugerida pelo calc-validator (NÃO aplicada, conteúdo clínico): keyPoint "Não aplicável a neonatos na 1ª semana de vida" na Holliday-Segar (regime neonatal é por dia de vida; pré-existente).

### Itens originais (histórico)

- **Quiz offline sem sync real** (`src/pages/rops/` desafio do dia): respostas dadas offline nunca são reenviadas ao voltar online — `submitDailyChallengeAnswer` falha com warn silencioso, sem fila de retry; resultado server-side fica incompleto. O e2e valida o comportamento atual (tolerância sem erro). Decidir se quer fila de retry (feature — fora do escopo da madrugada).
- **Validação clínica Holliday-Segar**: o app usa 4-2-1×24 para "Volume 24h" (1440 mL p/ 20kg) em vez da regra diária clássica 100-50-20 (1500 mL). Ambas aceitas clinicamente, mas confirmar se o rótulo com base horária é o pretendido.
- **HTML inválido em `widget-card.jsx`**: star de favorito é `<button>` aninhado dentro de `<button>` — problema potencial de a11y/hidratação.
- **`formatRelativeDate` em `src/utils/comunicadosHelpers.js:51-65`**: data futura produz "há -10 min" (o equivalente em formatters.js trata diff negativo); + branch `diffDays === 0 → 'hoje'` é código morto inalcançável.
- **`src/utils/audit.js:47`**: rejeição de literais proibidos é case-sensitive — `'Sistema'` (capitalizado, citado no próprio JSDoc como legado) passa. Sugestão: comparar com `.toLowerCase()`.
- **JSDoc errado em `checkinCodeGenerator.js:43-45`**: `getSecondsUntilNextWindow` retorna 1..60, não 0..59 (cosmético).
- **`EventAlertsContext.jsx` — persistência de agendamento incompleta**: `anest_scheduled_events` é write-only (nada relê a chave; alertas agendados morrem em reload e a chave cresce para sempre) + `setTimeout` sem cleanup no unmount (leak latente, benigno hoje porque o provider vive a sessão toda).
- **Suspeita de BUG real em `src/services/tagsService.js:67,73` (`createTag`)**: `requireUserId()` retorna o objeto `{userId, userName, userEmail}` (src/utils/audit.js:50-54), e o service grava esse objeto inteiro na coluna `created_by` — coluna text rejeitaria o insert ou gravaria `[object Object]`. Fix provável: `created_by: user.userId`. NÃO corrigido (mudança de comportamento em produção exige OK do dono). A suíte nova `src/__tests__/services/tagsService.test.js` trava o contrato vigente com comentário apontando o assert a atualizar quando corrigirem.

## Lembretes para o dono (do plano)

- **2026-06-12**: cleanup Firebase Storage (Issue #93).
- **2026-06-13**: Fase 1.6 HS256 destrava (conferir logs da edge antes).
- Deletar user órfão `wguime+e2e@yahoo.com.br` no Firebase Console.
