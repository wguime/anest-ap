# Cateter Peridural — ANEST

## Propósito Clínico
Acompanhamento longitudinal de cateteres peridurais (analgesia pós-operatória) nos dois hospitais atendidos pelo serviço: **Unimed** e **HRO**. O módulo registra a inserção, as avaliações diárias de pós-operatório (evolução PO) e a retirada, com alertas automáticos de duração para reduzir risco de infecção/complicação por cateter esquecido.

Limites de segurança (em `src/data/cateterPeridualConfig.js`):
- `WARNING_DURATION_HOURS = 72` — atenção, planejar retirada
- `MAX_DURATION_HOURS = 96` — crítico, retirar imediatamente

## Fluxo
```
Inserção (NovoCateterPage)
   → Evolução PO diária (FollowupForm: Bromage, nível sensitivo, taxa de infusão, sítio)
      → Retirada (toggle no FollowupForm, com motivo obrigatório)
```

1. **Inserção** — `NovoCateterPage.jsx`: hospital (toggle Unimed/HRO), paciente, leito, cirurgia/cirurgião, anestesiologista (obrigatório), dados técnicos (nível de punção, tamanho/marca CPD, marcas na pele/dentro em cm), doses transoperatórias, repique SRPA e plano pós-operatório. Status inicial sempre `ativo`.
2. **Evolução PO diária** — `FollowupForm.jsx` no detalhe (aba "Evolução PO"): plano do dia, sítio de inserção (Normal/Hiperemia/Edema/Secreção/Dor local), **escala de Bromage** (0–3), **nível sensitivo** (ex: T10), marca de pele atual, **taxa de infusão** (ex: 5 mL/h), complicações e observações. `dia_po` é inteiro sequencial: próximo PO = `max(diaPo) + 1` (`CateterDetalhePage.jsx:77`) — contagem de avaliações, não calendário.
3. **Retirada** — fluxo preferencial é o toggle "Retirar cateter após esta avaliação" no próprio FollowupForm (avaliação + retirada atômicas), com data e **motivo obrigatório** (`MOTIVOS_RETIRADA`: "Término do tratamento", "Complicação", "Retirada acidental", "Alta hospitalar", "Solicitação médica", "Duração máxima atingida", "Outro"). Marca `status = 'retirado'` + `data_retirada` + `motivo_retirada` via `markAsRemoved`. `RemoverCateterModal.jsx` existe, mas o botão de retirada direta não está exposto no detalhe.

## Regra por Hospital
A coluna `hospital` (`unimed` | `hro`, migration 028) muda a exigência de profissionais:

| Hospital | Inserção | Evolução PO |
|----------|----------|-------------|
| Unimed | Anestesiologista obrigatório | Anestesiologista obrigatório |
| HRO | Anestesiologista obrigatório + campo Residente visível (Select só aparece se `hospital === 'hro'`; trocar de hospital limpa o campo) | Anestesiologista **e/ou** Residente obrigatório (validação em `FollowupForm.jsx:44-62`) |

As listas de profissionais vêm de `src/hooks/useProfissionaisCateter.js` (deriva de `UsersManagementContext` com `normalizeRole`, reativo a mudanças em `profiles`).

## Páginas e Componentes
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/cateter-peridural/CateteresPeridualPage.jsx` | Listagem com tabs por hospital (badge de ativos), KPIs (Ativos/Alertas/Total), busca e filtro de status |
| `src/pages/cateter-peridural/NovoCateterPage.jsx` | Formulário de inserção em cards (Hospital, Paciente, Dados Técnicos, Transoperatório, Plano PO) |
| `src/pages/cateter-peridural/CateterDetalhePage.jsx` | Detalhe com tabs Dados + Evolução PO, banner de alerta, registro de followup e retirada |
| `src/pages/cateter-peridural/components/CateterCard.jsx` | Card da listagem (memoizado); borda warning/destructive conforme nível de alerta |
| `src/pages/cateter-peridural/components/FollowupForm.jsx` | Form de evolução PO + retirada opcional |
| `src/pages/cateter-peridural/components/AlertaDuracao.jsx` | Banner 72h (warning) / 96h (critical) no detalhe |
| `src/pages/cateter-peridural/components/RemoverCateterModal.jsx` | Modal de retirada direta (não exposto na UI atual) |

## Dados (Supabase)
- Service: `src/services/supabaseCateterPeridualService.js` (CRUD + realtime, mapping camelCase↔snake_case via `CAMEL_TO_SNAKE`/`FOLLOWUP_CAMEL_TO_SNAKE` — campo novo no DB exige entrada nos mapas)
- Context: `src/contexts/CateterPeridualContext.jsx` (single source of truth, realtime via `createReliableSubscription`)
- Config: `src/data/cateterPeridualConfig.js` (hospitais, status, escala Bromage, thresholds, `calcHorasCateter`, `getAlertLevel`)

### Tabelas
**`cateteres_peridural`** (migration `supabase/migrations/027_cateteres_peridural.sql`):
paciente, leito, cirurgia, data_cirurgia, cirurgiao, anestesista, residente, nivel_puncao, tamanho_cpd, marca_cpd, marca_cpd_pele, marca_cpd_dentro, doses_transoperatorias, repique_srpa, plano_pos_operatorio, complicacoes, `status` (`ativo` | `retirado`, CHECK), data_retirada, motivo_retirada, data_insercao, hospital (`unimed` | `hro`, CHECK) + audit (created_by/_name, updated_by/_name).

**`cateteres_peridural_followup`**:
cateter_id (FK `ON DELETE CASCADE`), dia_po, plano_dia, sitio_insercao, bromage_score (CHECK 0–3), nivel_sensitivo, marca_pele_atual, taxa_infusao, complicacoes, observacoes, anestesista_nome, residente_nome + audit (avaliado_por/_nome).
**`UNIQUE(cateter_id, dia_po)`** — uma avaliação por dia PO por cateter. INSERT duplicado do mesmo PO falha com conflict; correção de avaliação existente é via `updateFollowup`, nunca novo insert.

### Migrations
| Migration | Conteúdo |
|-----------|----------|
| `supabase/migrations/027_cateteres_peridural.sql` | Cria as 2 tabelas, índices, RLS + policies |
| `supabase/migrations/028_cateteres_peridural_hospital.sql` | Coluna `hospital` (`unimed`/`hro`, default `unimed`) |
| `src/supabase/migrations/029_cateter_residente.sql` | `residente` no cateter (HRO) + `anestesista_nome`/`residente_nome` no followup |

> Nota: as migrations do módulo existem espelhadas em `supabase/migrations/` e `src/supabase/migrations/`; a 029 do cateter está apenas em `src/supabase/migrations/` (em `supabase/migrations/` o número 029 é outro assunto).

### RLS — por papel (migration `20260627200000`, aplicada 2026-06-10)
Leitura: `anestesiologista`/`medico-residente` (helper `can_write_cateter()`) ou admin. Escrita (INSERT/UPDATE): apenas os papéis clínicos. Demais papéis (secretaria, tec-enfermagem, colaborador, enfermeiro): nenhum acesso — módulo aparece vazio (0 rows, sem erro). Não há DELETE (arquivamento via `status='retirado'`). A 027 original era `USING (true)` para qualquer authenticated.

## Alertas e Lembretes
Duas camadas independentes, ambas baseadas em `calcHorasCateter(dataInsercao)`:

**1. Alertas visuais 72h/96h (in-app, qualquer usuário):**
- `AlertaDuracao.jsx` — banner no detalhe (warning ≥72h, critical ≥96h)
- `CateterCard.jsx` — borda colorida na listagem
- KPI "Alertas" na listagem conta ativos com `getAlertLevel !== 'normal'`

**2. Lembretes por notificação 24/48/72/96h (`src/hooks/useCateterReminders.js`):**
- Montado em `src/pages/HomePage.jsx:225` com `enabled: isAdmin` — **admin-only** (só roda na sessão de um admin, mas notifica todos os destinatários)
- Thresholds em `CATETER_REMINDER_THRESHOLDS` (`src/utils/cateterNotifications.js`): 24h "registrar PO1" (normal), 48h "registrar PO2" (normal), 72h "planejar retirada" (alta), 96h "retirar imediatamente" (urgente)
- **Dedup via `related_entity_id`** = `cateter-reminder_<cateterId>_<thresholdKey>` — checado contra a tabela `notifications` antes de criar; cada par cateter×threshold notifica uma única vez, para sempre
- Guard de sessão module-level (`processedSessions`, chave `cateter_reminders_<YYYY-MM-DD>`): roda no máximo 1x/dia por sessão e **trava mesmo em erro** (RLS 403 não re-tenta)
- Só cateteres `status === 'ativo'` com `data_insercao` — retirado nunca alerta

## Notificações (LGPD-safe)
Helpers em `src/utils/cateterNotifications.js`. Eventos: `novo` (inserção), `evolucao` (followup), `retirada` + lembretes de duração. Categoria `cateter`, sender "Gestão de Cateteres", deep-link `actionUrl: 'cateterDetalhe'`.

- **Nunca nome de paciente** no conteúdo: `pacienteIniciais()` reduz a 2 iniciais ("João da Silva" → "JS", partículas de/da/do ignoradas) + hospital + link para o detalhe
- O service também não loga dados clínicos no console (comentários `// LGPD:` em `create`/`markAsRemoved`)
- Destinatários: `getCateterRecipients(users)` — todos anestesiologistas + residentes ativos via `normalizeRole` (captura aliases legados `medico`, `anestesista`, `residente`). Sempre guardar `if (recipientIds.length > 0)` antes de `createSystemNotification`
- Testes: `src/__tests__/utils/cateterNotifications.test.js`

Deep-link: a página aceita `params.id` (listagem) e `params.cateterId` (inbox/backfill) desde o fix de 2026-06-10.

## Scripts de Backfill/Diagnóstico
| Script | Uso |
|--------|-----|
| `src/scripts/backfill-cateter-notifications.js` | Recria notificações perdidas pelo bug do batch insert (UNIQUE conflict, fix `257b302`), preservando timestamps originais. Dry-run por padrão; `EXECUTE=1 node src/scripts/backfill-cateter-notifications.js` efetiva. Idempotente (dedup manual antes do insert — upsert do Supabase não reconhece o índice parcial de `notifications`). Requer `.env.local` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` |
| `src/scripts/inspect-orphan-cateter.js` | Diagnóstico de cateteres sem notificação correspondente |

## Navegação e Permissões
- Cases em `src/App.jsx` (~linha 1078): `cateteresPeridural` (listagem, lazy `key` por hospital), `novoCateter`, `cateterDetalhe`
- `PAGE_TO_CARD`: card `cateter_peridural` + subcards `cp_novo` (novo) e `cp_listagem` (detalhe)
- Badge no bottom nav "Menu" acende se houver cateter ativo (`hasActiveCateterPeridural`, `src/App.jsx:791`)
- goBack do detalhe restaura a aba de hospital via `params.hospital` (lazy init na listagem)

## Convenção: typo "Peridual"
Vários filenames usam **"Peridual"** (sem o segundo "r") por razão histórica — **manter, NÃO renomear** (imports espalhados pelo app):
- `src/services/supabaseCateterPeridualService.js`
- `src/contexts/CateterPeridualContext.jsx`
- `src/data/cateterPeridualConfig.js`
- `src/pages/cateter-peridural/CateteresPeridualPage.jsx`

Grafia correta apenas na pasta `src/pages/cateter-peridural/` e em `src/utils/cateterNotifications.js`.

## Gotchas
- `setor` é campo fantasma: páginas passam `form.setor`/`cateter.setor` ao payload de notificação, mas não existe coluna nem input — chega sempre `undefined` (inofensivo)
- `status` tem só 2 valores (`ativo`/`retirado`, CHECK constraint) — não inventar `arquivado` sem migration
- Cateter sem `data_insercao` fica invisível para lembretes
- Skill relacionada: `.claude/skills/cateter-peridural/SKILL.md` (`/cateter-peridural`)
