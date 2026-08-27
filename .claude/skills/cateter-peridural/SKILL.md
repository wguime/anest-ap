---
name: cateter-peridural
description: Controle de cateteres peridurais (Supabase cateteres_peridural + followup PO + lembretes de duração 72/96h e de não-evoluído 36/42h por pg_cron). Use ao criar/editar features de cateter, debugar lembretes ou notificações que não chegam, validar LGPD do conteúdo, ou mexer no service/context/páginas do módulo.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Cateter Peridural ANEST

> **Conhecimento do módulo (eixos de alerta, decisões do dono, histórico das migrations) vive em
> `.claude/rules/cateter-peridural.md`**, que carrega sozinha ao abrir um arquivo do cateter. Esta
> skill é o PROCEDIMENTO: quando mexer, o que conferir, como testar.

## Quando Usar
- Criar/editar features do módulo (formulário, detalhe, evolução PO, retirada)
- Debugar lembretes de duração (24h/48h/72h/96h) que não dispararam ou dispararam em duplicidade
- Validar LGPD em notificações de cateter (nunca nome de paciente — só iniciais)
- Adicionar campos novos (lembrar do mapping camelCase↔snake_case no service)
- Backfill/diagnóstico de notificações órfãs

## NÃO usar para
- Sistema de notificações em geral (ver skill `/notificacoes`)
- Calculadoras clínicas de bloqueio (ver skill `/calculadoras`)
- Migrations genéricas (ver skill `/supabase-migration`)

## Mapa de arquivos

| Camada | Arquivo |
|---|---|
| Service (CRUD + realtime) | `src/services/supabaseCateterPeridualService.js` |
| Context (single source of truth) | `src/contexts/CateterPeridualContext.jsx` |
| Config (hospitais, Bromage, thresholds, `calcHorasCateter`) | `src/data/cateterPeridualConfig.js` |
| Listagem (tabs por hospital) | `src/pages/cateter-peridural/CateteresPeridualPage.jsx` |
| Novo cateter | `src/pages/cateter-peridural/NovoCateterPage.jsx` |
| Detalhe (tabs Dados + Evolução PO) | `src/pages/cateter-peridural/CateterDetalhePage.jsx` |
| Form de evolução PO + retirada | `src/pages/cateter-peridural/components/FollowupForm.jsx` |
| Banner 72h/96h | `src/pages/cateter-peridural/components/AlertaDuracao.jsx` |
| Listas de anestesistas/residentes | `src/hooks/useProfissionaisCateter.js` |
| Libs puras | `src/lib/cateterPo.js` (computeDiaPo) · `src/lib/cateterIndicadores.js` |
| Testes | `src/__tests__/lib/cateterPo.test.js` |
| Migrations | `src/supabase/migrations/027_cateteres_peridural.sql` · `028_..._hospital.sql` · `029_cateter_residente.sql` |
| Scripts de diagnóstico | `src/scripts/backfill-cateter-notifications.js` · `src/scripts/inspect-orphan-cateter.js` |

**Tabelas Supabase:** `cateteres_peridural` (status `ativo|retirado`, hospital `unimed|hro`) + `cateteres_peridural_followup` (**N avaliações por dia** — o UNIQUE(cateter_id, dia_po) foi removido em `20260628110000`; FK `cateter_id` ON DELETE CASCADE).

**Navegação (App.jsx):** cases `cateteresPeridural` / `novoCateter` / `cateterDetalhe` (~`src/App.jsx:1078`). Permissões em `PAGE_TO_CARD`: listagem usa o card `cateter_peridural`; subcards `cp_novo` (novoCateter) e `cp_listagem` (cateterDetalhe). Badge do bottom nav "Menu" acende se houver cateter ativo (`hasActiveCateterPeridural`, `src/App.jsx:791`).

## Convenções críticas

1. **Typo "Peridual" nos filenames — MANTER.** Service, context, config e página de listagem usam `Peridual` (sem o segundo "r"): `supabaseCateterPeridualService.js`, `CateterPeridualContext.jsx`, `cateterPeridualConfig.js`, `CateteresPeridualPage.jsx`. NÃO renomear — imports espalhados pelo app inteiro. A pasta `src/pages/cateter-peridural/` e `cateterNotifications.js` estão corretos.

2. **`dia_po` é DERIVADO da data da avaliação** (`src/lib/cateterPo.js`, `computeDiaPo`): dias de calendário entre `data_avaliacao` e `data_insercao` — mesmo dia = PO0, dia seguinte = 1º PO. O `FollowupForm` exige a data (default hoje) e mostra o PO calculado; o usuário **não** digita o número. O mesmo cateter pode ter **N avaliações no mesmo dia** (mesmo `dia_po`); rótulo via `formatDiaPoLabel`, ordenação por `data_avaliacao`+`created_at`. (Antes era sequencial cego `max+1` — removido.)

3. **HRO e residente.** Coluna `residente` (cateter) e `residente_nome` (followup) existem só por causa do HRO (migration 029):
   - `NovoCateterPage`: Select de residente só aparece quando `hospital === 'hro'`; trocar de hospital limpa o campo.
   - `FollowupForm`: em HRO é obrigatório anestesiologista **e/ou** residente; nos demais hospitais, anestesiologista é obrigatório sozinho.

4. **camelCase ↔ snake_case no service.** Campo novo no DB exige entrada nos mapas `CAMEL_TO_SNAKE` / `FOLLOWUP_CAMEL_TO_SNAKE` do service. Campo fora do mapa passa _as-is_ — funciona se o nome coincidir, quebra silenciosamente se não (lembre `feedback_explicit_select_silent_empty`).

5. **Lembretes são pg_cron, NÃO cliente.** `notify_cateter_reminders()` (migrations
   `20260628150000` → `20260808120000` → `20260822120000`), diário 17h BRT. O hook cliente
   `useCateterReminders` e a constante `CATETER_REMINDER_THRESHOLDS` **não existem mais** —
   tomavam RLS 42501 em silêncio. Eixos e dedup atuais estão em `.claude/rules/cateter-peridural.md`;
   não reintroduzir agendamento no cliente.

6. **LGPD: `pacienteIniciais()`.** Notificação NUNCA leva nome do paciente — só 2 iniciais (`"João da Silva"` → `"JS"`, partículas de/da/do ignoradas) + hospital + link para o detalhe. O service também não loga dados clínicos no console (comentários `// LGPD:` em `create`/`markAsRemoved`). Qualquer texto novo de notificação deve passar pelo mesmo crivo.

7. **Destinatários:** `getCateterRecipients(users)` — todos anestesiologistas + residentes ativos via `normalizeRole` (captura aliases legados `medico`, `anestesista`, `residente`...). Sempre guard `if (recipientIds.length > 0)` antes de `createSystemNotification` (senão cai no broadcast-local silencioso).

## Gotchas

- **Sem UNIQUE(cateter_id, dia_po)** desde `20260628110000`: a constraint foi removida para permitir N avaliações no mesmo dia. `dia_po` deixou de ser identificador único — é derivado da data. (O bug histórico do backfill de notificações, fix `257b302`, era sobre o índice parcial de `notifications`, não desta tabela — o dedup manual do backfill continua válido.) Para corrigir uma avaliação existente use `updateFollowup(id, updates, userInfo)` (passa `updated_by` real).
- **Cateter retirado nunca alerta.** O cron filtra `status = 'ativo' AND data_insercao IS NOT NULL` (migration `20260822120000`); `CateteresPeridualPage` e `AlertaDuracao` só alertam para ativo. Cateter sem `data_insercao` fica invisível para lembretes.
- **RLS por papel (`20260627200000` + `20260628100000`):** SELECT e INSERT/UPDATE = `can_write_cateter() OR is_admin()` — roles `anestesiologista`/`medico-residente` **ou** admin (admin ganhou escrita em 2026-06-12). Sem DELETE. Demais papéis veem módulo vazio (0 rows, sem erro). Helper SECURITY DEFINER no padrão `firebase_uid()`.
- **Deep-link aceita `id` E `cateterId` (fix 2026-06-10):** a página resolve `params?.id ?? params?.cateterId` — a inbox envia `{ cateterId }`, a listagem `{ id }`. Ao criar navegação nova, qualquer um dos dois funciona; manter os dois aceitos.
- **Retirada é fluxo da evolução PO.** A UI orienta retirar via toggle no `FollowupForm` (avaliação + retirada atômica no handler); `RemoverCateterModal` existe mas o botão de retirada direta não está exposto no detalhe.
- **`setor` não existe** (sem coluna nem campo). Os callers não passam mais `setor` ao payload (limpeza 2026-06-13); o helper aceita `setor` opcional (testado) mas está sem uso.
- **`status` só tem 2 valores** (`ativo|retirado`, CHECK constraint). Não inventar `arquivado` sem migration.
- ⚠️ **NÃO EXISTE notificação de EVENTO** (novo / evolução / retirada). Os três triggers e as
  funções foram DROPADOS na migration `20260730160000` a pedido do dono (30/07): havia 10.881
  notificações acumuladas, ~98% não lidas. `cateterNotifications.js` foi deletado. **Não recriar** —
  se o trigger voltar sem o dedup, um insert client-side duplica. Ficam só os lembretes clínicos.
- **Lembretes clínicos = duração 72/96h + não-evoluído 36/42h**, via pg_cron. ⚠️ o warning de
  não-evoluído é **36h**, não 30h (`EVOLUCAO_WARNING_HOURS` em `cateterPeridualConfig.js`,
  recalibrado em `20260822120000` sobre a distribuição real dos intervalos). O porquê da
  recalibração e a divergência intencional entre CARD e CRON estão em
  `.claude/rules/cateter-peridural.md`.
- **`ultima_avaliacao_at`** (migration `20260628140000`): coluna em `cateteres_peridural` mantida por trigger no followup (`GREATEST(data_avaliacao)`); base do alerta "não evoluído" no card (`getEvolucaoAlertLevel` em `cateterPeridualConfig.js`).

## Como testar

```bash
cd /Users/guilherme/dev/anest

# Testes unitários: cálculo do PO por data + helpers de notificação
npx vitest run src/__tests__/lib/cateterPo.test.js src/__tests__/utils/cateterNotifications.test.js

# Backfill de notificações — dry-run por padrão (sem EXECUTE=1 nada grava)
node src/scripts/backfill-cateter-notifications.js
# EXECUTE=1 node src/scripts/backfill-cateter-notifications.js   # efetiva (idempotente)

# Diagnóstico de cateteres sem notificação
node src/scripts/inspect-orphan-cateter.js

npm run build
```

Para validar lembretes manualmente: logar como admin, abrir a Home (hook roda 1x/dia/sessão) e conferir `console` (`[CateterReminders] Criados N (...)`) + inbox dos destinatários. Para re-testar na mesma sessão é preciso recarregar a página (o guard `processedSessions` é module-level).

## Se esquecer
- Padrão de notificação em 3 camadas: skill `/notificacoes`.
- Service canônico Supabase: `src/services/supabaseIncidentsService.js` (mesmo padrão de mapping).
- Mutation nova: `changedBy`/`created_by` sempre com o user real (regra `audit-trail`).
