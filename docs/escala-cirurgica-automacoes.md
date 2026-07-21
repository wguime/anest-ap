# Escala Cirúrgica — Automações do piloto (propostas para aprovação)

> 2026-07-21 · branch `feat/escala-cirurgica`. Propostas para operar o piloto sem rotinas
> manuais e chegar preparado à liberação para o grupo (~40 anestesistas).
> **Nada daqui foi criado ainda** — cada item vira trabalho só com aprovação do dono, item a item.
> Fundamentação: leitura de `docs/escala-cirurgica{,-evolucao-tecnica,-analise-adesao}.md` +
> levantamento de fatos no repo (seção 0). Boundaries respeitados: banco só leitura,
> esboços aqui (não em `.claude/`), segredos conforme `.claude/rules/secrets.md`.

## 0. Fatos verificados no repo (base das propostas)

- **`scripts/deploy-sp21-mgmt-api.mjs`** — subcomando `query <sql>` (`:164`) POSTa em
  `/v1/projects/<ref>/database/query`. É **read-write sem guard**: o comentário (`:12`) diz
  "SELECT" mas não há enforcement (é o mesmo endpoint do `apply-migration`). PAT via
  `SUPABASE_ACCESS_TOKEN` do `.env.local`, nunca impresso.
- **`scripts/diag-edge-fn-config.mjs`** — lista todas as edges com
  `verify_jwt / status / updated_at` (`:45-47`); aceita slug como filtro. **Não** computa
  staleness (deploy antigo aparece, mas ninguém compara com o git).
- **Notificações** — o módulo já notifica **client-side** (`notifyUsers` importado em
  `src/contexts/EscalaCirurgicaContext.jsx:18`), que só roda com o app aberto. Para lembrete
  confiável o precedente é o **server-side do cateter**: função `SECURITY DEFINER` insere em
  `notifications` com dedup `ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
  DO NOTHING` (migration `20260628130000:44-72`) + `pg_cron` (`20260628150000:135`).
- **pg_cron** — 2 padrões em produção: **(A)** puro SQL (`cateter-reminders-daily`,
  `'0 10 * * *'`); **(B)** `pg_net` → edge com bearer do Vault (`fetch_noticias_cron`
  `20260426000100:16`; também shift-reminders). 10+ jobs ativos; convenção
  `cron.unschedule` → `cron.schedule` para idempotência.
- **Hooks do Claude Code** — os 4 hooks de `.claude/settings.json` (`:33-70`) fazem
  `cd`/`git -C` no path morto `/Users/guilherme/Documents/IA/ANEST V2`. **Estão inertes**
  (no-op silencioso). Evidência viva: o SessionStart de hoje injetou "Branch: main" com o
  repo em `feat/escala-cirurgica` (ele lê o clone antigo, parado na main).
- **E2E/Playwright** — specs leem `E2E_USER_EMAIL/E2E_USER_PASSWORD` de `process.env`
  (`e2e/auth.spec.ts:25-26`, `test.skip` se ausentes); `playwright.config.ts` **não** carrega
  `~/.anest-e2e.env` (precisa `source` process-side antes). `baseURL` default
  `http://localhost:5173`; `webServer` comentado de propósito. **Não existe regressão visual**
  (`toHaveScreenshot` ausente; os 3 PNGs em `e2e/__screenshots__/` são referência manual).
- **Gate do piloto** (`src/pages/escala-cirurgica/gate.js`) — `import.meta.env.DEV` OU e-mail
  do dono. Consequência: smoke de **produção** com o user E2E só testa o **negativo** (card e
  rota invisíveis — já verificado em prod); smoke do board em si roda **local** (DEV abre o
  gate; o dev server usa o mesmo Supabase, então a seed aparece).
- **Log de eventos** — `escala_cirurgica_evento` (`20260718100000:18-40`): `tipo`
  ('status'|'liberacao'), campos denormalizados (`cirurgiao`, `procedimento`, `sala`,
  `hospital`, `data`, `tempo_estimado`…), `status_de/para`, `detalhe` jsonb, `em`. Duração
  real = `em(terminada) − em(iniciada)` por `caso_id`; turnover derivável por sala/data.
  Escrita só por trigger (revoke explícito).
- **Seed** — `UNIQUE(data, hospital)` em `escala_cirurgica` (`20260628200000:63`): qualquer
  rollover automático precisa de guard para não colidir com escala real do dia.

## 1. Tabela priorizada

| Prio | Proposta | Dor que resolve | Esforço | Impacto | Custo recorrente | Mecanismo |
|---|---|---|---|---|---|---|
| **P0** | Reativar hooks (path morto) | (pré-req do P2a; guardrails de deploy hoje inertes) | ~15 min | Alto | Zero | editar `.claude/settings.json` |
| **P1a** | Skill `/escala-cirurgica` | 1, 3, 4, 5 num comando | ~2 h | Alto | Só quando invocada (~5–15k tokens/run) | SKILL.md + scripts |
| **P1b** | Rollover diário da seed | 1 (elimina a rotina manual) | ~30 min + validator | Alto p/ piloto | Zero (roda no banco) | pg_cron puro SQL |
| **P1c** | Aviso "escala de amanhã não publicada" | 2 (risco nº1 da adesão) | ~1 h + validator | Alto | Zero (roda no banco) | pg_cron → `notifications` |
| **P2a** | Hook pós-deploy + smoke de produção | 5 (e previne tela branca já vivida) | ~1,5 h | Médio-alto | Zero tokens; +10–60 s por deploy | PostToolUse + script node |
| **P2b** | Relatório semanal dos eventos | 4 (prévia da Fase 2) | ~1,5 h | Médio agora, cresce com n | ~10–20k tokens/execução (manual) | modo da skill P1a |
| **P3** | Regressão visual das 3 abas | 5 | ~3–4 h | Médio | Zero tokens; ~2 min/run; manutenção de baseline | Playwright `toHaveScreenshot` |

## 2. P0 — Reativar os hooks do Claude Code

**Dor.** Os 4 hooks existentes (bloqueio de `git push --force` na main, aviso HEAD≠origin
antes de `firebase deploy`, log de tool-failures, contexto de branch no SessionStart) estão
**todos inertes** desde a migração do repo para `~/dev/anest`. O aviso pré-deploy é
exatamente o tipo de guardrail que o P2a estende — não faz sentido construir em cima de
alicerce morto.

**Esboço.** Nos 4 comandos de `.claude/settings.json:33-70`, trocar o path hardcoded por
`$CLAUDE_PROJECT_DIR` (ex.: `git -C "$CLAUDE_PROJECT_DIR" status`). Nenhum hook novo.

**Critério de sucesso.** Próxima sessão: SessionStart injeta `Branch: feat/escala-cirurgica`
(hoje injeta "main"); um `firebase deploy` com HEAD≠origin dispara o aviso.

## 3. P1a — Skill `/escala-cirurgica` (operações do piloto)

**Dor.** Renovar seed, checar eventos, checar edge e rodar smoke são 4 rotinas de memória do
dono. Viram um comando com modos.

**Esboço.** `.claude/skills/escala-cirurgica/` seguindo o padrão da skill `escala`
(user-invocable, `disable-model-invocation: true` — é comando operacional, não conhecimento):

```markdown
---
name: escala-cirurgica
description: Opera o piloto da Escala Cirúrgica — status geral (seed/edge/eventos),
  renovação da seed p/ hoje, relatório dos eventos coletados e smoke Playwright das 3 abas.
  Usar quando o dono pedir "status do piloto", "renove a seed", "relatório da escala" ou
  "smoke da escala cirúrgica".
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
disable-model-invocation: true
---
## Modos (argumento; default = status)
- status   → seed em dia? edge parse-escala-cirurgica atualizada? eventos coletando?
- seed     → renova a seed móvel p/ hoje (ÚNICA escrita; nunca toca seed-teste-claude-20)
- relatorio→ gera docs/escala-cirurgica-metricas/<AAAA>-W<ww>.md (ver P2b)
- smoke    → Playwright nas 3 abas contra dev server local (gate aberto em DEV)
```

Peças de suporte (em `.claude/skills/escala-cirurgica/scripts/`):

- **`query-ro.mjs`** — wrapper do endpoint `/database/query` que **recusa não-SELECT**
  (regex `^\s*(select|with)\b`, sem `;` intermediário). Todos os modos de leitura usam ele —
  fecha o gap do `query` sem guard e alinha com "banco só leitura".
- Queries do modo `status`:
  ```sql
  select created_by, data, hospital from escala_cirurgica
   where created_by like 'seed-teste-claude%' order by created_by;
  select tipo, count(*), min(em)::date de, max(em)::date ate
    from escala_cirurgica_evento group by tipo;
  ```
  Edge: `node scripts/diag-edge-fn-config.mjs parse-escala-cirurgica` + comparação do
  `updated_at` com `git log -1 --format=%cI -- supabase/functions/parse-escala-cirurgica/`
  → imprime "deploy N dias atrás do último commit" (teria pego as 3 semanas sem deploy).
- Modo `seed`: o único UPDATE (o mesmo da rotina manual, com `where created_by =
  'seed-teste-claude'` exato), seguido de SELECT de confirmação mostrando que a
  `seed-teste-claude-20` continua em 2026-07-20. Fica redundante se P1b for aprovado —
  mantém-se como fallback manual.
- Modo `smoke`: `set -a; source ~/.anest-e2e.env; set +a; npx playwright test
  e2e/escala-cirurgica.spec.ts` (spec novo, ver P3; creds nunca impressas — padrão
  `test.skip` se ausentes). Requer `npm run dev` de pé (webServer é desligado por design).

**Custo recorrente.** Zero de pé; ~5–15k tokens por invocação (dominado por resultados de
query). **Critério de sucesso.** `/escala-cirurgica` responde os 4 modos; `status` mostra
seed=hoje, idade do deploy da edge em dias e contagem de eventos por tipo; `seed` termina
com SELECT provando `data = hoje` e seed-20 intacta.

**Nota.** O modo `smoke` depende de o user E2E ter papel clínico no Supabase (RLS
`can_write_escala_cirurgica()`); em DEV o gate de UI abre, mas a RLS não. Verificar o papel
do user E2E na implementação — se não tiver, o board vem vazio.

## 4. P1b — pg_cron: rollover diário da seed (mata a dor 1)

**Dor.** A seed móvel (`created_by='seed-teste-claude'`) não acompanha a virada do dia; o
dono renova na mão. Um job no banco elimina a rotina — zero tokens, roda com laptop
desligado, sem Claude no loop.

**Esboço** (migration nova, **validar com `migration-validator` antes de aplicar**):

```sql
create or replace function public.escala_seed_rollover()
returns void language plpgsql security definer set search_path = public as $$
begin
  update escala_cirurgica e
     set data = current_date
   where e.created_by = 'seed-teste-claude'
     and e.data <> current_date
     -- guard: UNIQUE(data,hospital) — não colidir com escala real (ou a seed-20) do dia
     and not exists (select 1 from escala_cirurgica r
                      where r.data = current_date and r.hospital = e.hospital
                        and r.id <> e.id);
exception when others then raise warning 'escala_seed_rollover: %', sqlerrm;
end $$;

select cron.unschedule('escala-seed-rollover-daily')
 where exists (select 1 from cron.job where jobname = 'escala-seed-rollover-daily');
select cron.schedule('escala-seed-rollover-daily', '5 3 * * *',  -- 03:05 UTC = 00:05 BRT
                     $$select public.escala_seed_rollover()$$);
```

A cópia fixa `seed-teste-claude-20` **não é tocada** (o `where` é exato). Colisão com
escala real do dia → skip silencioso (a seed fica no dia anterior, comportamento seguro).

**Custo recorrente.** Zero. **Critério de sucesso.** Por 3 dias seguidos, `select data from
escala_cirurgica where created_by='seed-teste-claude'` = data corrente sem intervenção;
seed-20 imóvel.

**⚠️ Desativação obrigatória antes da liberação ao grupo:** o grupo tem papel clínico → a
RLS deixa todo mundo ver a seed. Entra no checklist de release: `cron.unschedule` + remover
as escalas seed (ou movê-las para data passada fixa).

## 5. P1c — pg_cron: aviso "escala de amanhã não foi publicada" (mata a dor 2)

**Dor.** Risco operacional nº1 da adesão (§1 e §5 da análise: *"dia sem importação = board
vazio = grupo volta ao WhatsApp"*; o playbook pede literalmente "lembrete automático se a
escala do dia seguinte não foi publicada até X horas"). Hoje ninguém é avisado.

**Canal (decisão em aberto — recomendação abaixo).**
1. **In-app via `notifications`** (recomendado agora): padrão A do pg_cron, puro SQL,
   espelhando o helper do cateter (`20260628130000`) — inclusive o dedup `ON CONFLICT`,
   que garante no máx. 1 aviso por (hospital × data × destinatário) mesmo se o job rodar 2×.
2. **Push FCM**: padrão B (`pg_net` → edge `send-fcm-push`, precedente shift-reminders) —
   fase 2, quando a secretária entrar (ela precisa do push; o dono já abre o app).
   Verificar na implementação se o INSERT em `notifications` já dispara push por outro
   caminho antes de duplicar canal.
3. **Só relatório semanal**: descartado como canal — não avisa no dia.

**Esboço** (migration nova + validator):

```sql
create or replace function public.notify_escala_amanha_faltante()
returns void language plpgsql security definer set search_path = public as $$
declare h text; alvo date := current_date + 1;
begin
  if extract(isodow from alvo) in (6,7) then return; end if;  -- FDS: confirmar com o dono
  foreach h in array array['unimed','hro'] loop               -- materno: confirmar
    if not exists (select 1 from escala_cirurgica
                    where data = alvo and hospital = h and status = 'publicada'
                      and created_by not like 'seed-teste-claude%') then  -- seed não conta
      -- espelhar colunas/estilo de insert_cateter_notification (20260628130000:44-72)
      insert into notifications (recipient_id, category, subject, content, priority,
                                 related_entity_type, related_entity_id)
      select p.id, 'escala',
             'Escala cirúrgica de amanhã não publicada — ' || upper(h),
             'A escala de ' || to_char(alvo, 'DD/MM') || ' (' || h || ') ainda não foi ' ||
             'publicada. Importe pela aba Completa → Importar.',
             'high', 'escala_faltante', h || ':' || alvo
        from profiles p
       where lower(p.email) = 'wguime@yahoo.com.br'   -- piloto; grupo: secretaria/admin
      on conflict (related_entity_type, related_entity_id, recipient_id) do nothing;
    end if;
  end loop;
exception when others then raise warning 'notify_escala_amanha_faltante: %', sqlerrm;
end $$;

select cron.schedule('escala-amanha-check', '0 20 * * 0-4',   -- 17:00 BRT dom–qui → alvo seg–sex
                     $$select public.notify_escala_amanha_faltante()$$);
```

**Parâmetros em aberto para o dono** (a função fica certa quando respondidos):
quais hospitais têm escala esperada todo dia útil (Materno entra?); horário do check
(17h BRT? a publicação real é ~12h do dia, mas a de amanhã sai quando?); a escala de
segunda é publicada na sexta ou no domingo? (define se o check de domingo faz sentido).

**Custo recorrente.** Zero. **Critério de sucesso.** Dia sem escala de amanhã → sino do
app acusa 1 notificação às 17h, com no máximo 1 por hospital×dia (dedup); dia com escala
publicada → silêncio.

## 6. P2a — Monitor pós-deploy (hook + smoke de produção)

**Dor.** A edge já ficou 3 semanas sem deploy sem ninguém notar; e há precedente de deploy
de hosting com tela branca ("supabaseUrl is required", build de worktree sem `.env`). Hoje
nada valida o app publicado após `firebase deploy`.

**Esboço.** Hook **PostToolUse** (matcher `Bash`, async — não bloqueia) que detecta
`firebase deploy` no comando e roda `scripts/smoke-prod.mjs` (node puro, zero tokens):

- **Tier 1 (sempre, ~10 s):** `fetch` da home em produção → HTTP 200; extrai a URL do
  bundle JS do `index.html`, baixa e faz grep do host do Supabase — pega exatamente a
  regressão da tela branca já vivida. Imprime PASS/FAIL no transcript.
- **Tier 2 (opcional, ~60 s, decisão em aberto):** Playwright headless com creds E2E
  (`source ~/.anest-e2e.env` process-side): login → home renderiza → card Escala Cirúrgica
  **ausente** (teste negativo do gate — o positivo é impossível em prod sem creds do dono,
  que nunca entram em script).

Complemento de baixo custo contra a dor 3 (drift da edge): o modo `status` da skill (P1a)
já compara `updated_at` da edge com o último commit — rodar `/escala-cirurgica` 1×/semana
cobre; se quiser lembrete sem disciplina, o Tier 1 pode incluir o
`diag-edge-fn-config.mjs parse-escala-cirurgica` no mesmo run (é 1 GET).

**Custo recorrente.** Zero tokens; +10–60 s por deploy. **Critério de sucesso.** Deploy
proposital de um build sem `.env` (em preview/teste) → hook acusa FAIL; deploy normal →
PASS silencioso em ~10 s.

**Dependência:** P0 (hooks funcionando com path certo).

## 7. P2b — Relatório semanal dos eventos (prévia da Fase 2)

**Dor.** `escala_cirurgica_evento` coleta desde 18/07 e ninguém olha. É a matéria-prima da
previsão de tempos (Fase 2 do doc técnico) e das métricas de adoção do §5 do playbook.

**Esboço.** Modo `relatorio` da skill P1a → `docs/escala-cirurgica-metricas/<AAAA>-W<ww>.md`:

- **Durações** por cirurgião×procedimento (texto livre por ora — a Fase 1 de normalização
  ainda não existe; o relatório agrupa pelo texto e lista variantes suspeitas):
  ```sql
  select cirurgiao, procedimento, count(*) n,
         percentile_cont(0.5) within group (order by dur) as mediana,
         percentile_cont(0.75) within group (order by dur) as p75
    from (select caso_id, max(cirurgiao) cirurgiao, max(procedimento) procedimento,
                 max(em) filter (where status_para='terminada')
               - max(em) filter (where status_para='iniciada') as dur
            from escala_cirurgica_evento where tipo='status' group by caso_id) t
   where dur is not null group by 1, 2 order by n desc;
  ```
- **Turnover por sala** (lag de `terminada`→`iniciada` seguinte na mesma sala/data/hospital,
  window function).
- **Métricas de adoção (§5 do playbook):** % dias úteis com escala publicada (excluindo
  seed), nº de casos com status marcado / total, liberações marcadas, trocas propostas.
- **Regras de honestidade** (guardrails do próprio doc técnico): n<5 marcado
  "insuficiente p/ mediana"; nunca extrapolar; primeira edição vai declarar que 3 dias de
  coleta ≈ estatística nenhuma (o valor inicial é conferir que a coleta está íntegra).

**Recorrência.** Manual (`/escala-cirurgica relatorio`, ~10–20k tokens/run) enquanto o
volume é baixo. Automatizar depois é trivial: cron local (CronCreate, depende do laptop) ou
routine cloud (custo de tokens + precisaria do PAT como secret novo na nuvem — por isso não
recomendo agora). **Critério de sucesso.** Arquivo commitado com as 4 seções, contagens
batendo com `select count(*)` direto, e n<5 sinalizado.

## 8. P3 — Regressão visual das 3 abas

**Dor.** As abas mudam de UI com frequência e a validação é manual. Hoje não há baseline.

**Esboço.** Spec novo `e2e/escala-cirurgica-visual.spec.ts` com `toHaveScreenshot`
(baselines commitadas no diretório de snapshots do Playwright):

- **Dados determinísticos:** navegar o DatePicker para **20/07** → renderiza a seed fixa
  `seed-teste-claude-20` (imóvel por contrato).
- **Relógio congelado:** `page.clock.setFixedTime('2026-07-20T14:00:00-03:00')` — sem isso
  o cronômetro da Liberações muda a cada run e o diff nunca fecha.
- **Matriz:** 3 abas × light/dark × viewport 375×667 (mobile-first; o project `mobile`
  atual é iPhone 14/390px — usar viewport explícito). 12 screenshots.
- **Execução:** contra dev server local (gate aberto em DEV, mesmo banco → seed visível);
  roda pelo modo `smoke` da skill (P1a) antes de deploys que tocam o módulo.
- **Manutenção:** mudança visual intencional → `--update-snapshots` no mesmo PR.

**Riscos honestos.** (1) Os *status* da seed-20 vivem no banco — se o dono tocar neles, o
baseline quebra sem mudança de código (mitigação: o spec pode resetar os status da seed-20
via UI antes do screenshot, ou aceitar regenerar baseline). (2) O mecanismo de dark mode no
teste (localStorage vs toggle na UI) precisa ser verificado na implementação. (3) Depende
do papel clínico do user E2E (mesma nota do P1a). Por isso é P3: valor real, mas o maior
custo de manutenção da lista.

**Custo recorrente.** Zero tokens; ~2 min/run. **Critério de sucesso.** Run limpo 2× seguidas
sem diff (determinismo provado); uma mudança proposital de cor num card → diff acusado.

## 9. Descartados / adiados (com motivo)

| Candidato | Veredito | Motivo |
|---|---|---|
| `/loop` para rotinas de pé | Descartado | Exige sessão aberta + tokens por iteração; pg_cron faz de graça. **Uso legítimo pontual:** babysit no dia do go-live do grupo (ex.: acompanhar board + eventos por algumas horas). |
| Routine cloud (schedule) p/ dor 2 | Descartado | pg_cron resolve com zero custo; agente cloud precisaria do `SUPABASE_ACCESS_TOKEN` como secret novo fora do laptop — superfície de segredo sem necessidade. |
| CronCreate local p/ dor 2 | Descartado | Depende do laptop aberto na hora certa; o aviso é justamente para quando ninguém está olhando. |
| `notifyUsers` (client) p/ lembretes | Descartado | Só roda com o app aberto; INSERT client-side em `notifications` de outro usuário toma RLS 42501 (lição documentada do cateter). |
| Subagente novo dedicado | Descartado | `migration-validator` (obrigatório antes de P1b/P1c) e `Explore` cobrem; a skill P1a não precisa de agente próprio. |
| Auto-% / auto-status de qualquer tipo | Fora de escopo | Princípio já decidido no módulo: sugerir, nunca aplicar sozinho. |

## 10. Decisões que só o dono pode tomar

1. **P1c:** hospitais esperados por dia útil (Materno entra?), horário do check e quando a
   escala de segunda costuma ser publicada (sexta × domingo).
2. **P1c:** canal — in-app agora e push FCM só quando a secretária entrar? (recomendo sim)
3. **P2a:** Tier 2 (login E2E em prod) roda em todo deploy ou só sob demanda?
4. **P1b:** confirmar que a desativação da seed entra no checklist de liberação ao grupo.
5. **Ordem de execução sugerida:** P0 → P1b → P1c → P1a → P2a → P2b → P3.
