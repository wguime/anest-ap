-- ============================================================================
-- Residência — espelho dos overrides de plantão para a edge de lembretes.
--
-- A escala dos residentes é uma tabela estática (PLANTOES_2026) e as trocas
-- aceitas viram overrides no Firestore (`residenciaPlantaoDiario/{data}`). Quem
-- manda o lembrete "Plantão amanhã" é a edge `schedule-shift-reminders`
-- (pg_cron: shift-reminders-d1-daily / d0-weekday / d0-weekend), e ela NÃO lê
-- Firestore: consulta `residencia_plantao_diario_overrides` (data_plantao →
-- residente_override) e, sem a linha, cai na tabela estática. A tabela nunca
-- foi criada (a edge diz "se existir" desde 22/04/2026).
--
-- Sintoma medido em `notifications` (related_entity_type = 'plantao-residencia'):
--   * 18/07 09:00 UTC → "Plantão amanhã 19/07" para AUGUSTO; o 19 era do
--     ROOSEWELT desde a troca TR475677 aceita em 26/06.
--   * 13/09 → "Plantão amanhã 14/09" para AUGUSTO (cron, tabela) E para JACINTA
--     (hook do admin, que lê o Firestore): dois residentes avisados do mesmo dia.
--
-- A partir daqui o app espelha TODA escrita do Firestore nesta tabela
-- (src/services/residenciaPlantaoOverridesMirror.js) e a edge, que já lia a
-- tabela por nome, passa a resolver o residente EFETIVO sem redeploy.
--
-- ACESSO: espelha a regra do Firestore (`allow read, create, update, delete:
-- if isAuthenticated()`) — qualquer autenticado lê e grava; a troca é aceita
-- pelo próprio residente no cliente. A edge lê com service_role.
--
-- BACKFILL: os 60 docs de `residenciaPlantaoDiario` lidos em 14/09/2026, cada
-- um conferido contra a troca que o gerou (troca_id ↔ quem aceitou). Idempotente
-- (ON CONFLICT atualiza), então reaplicar não duplica.
--
-- Rollback (manual):
--   drop table if exists public.residencia_plantao_diario_overrides;
-- ============================================================================

begin;

set local lock_timeout = '3s';

create table if not exists public.residencia_plantao_diario_overrides (
  data_plantao       text primary key,                   -- 'YYYY-MM-DD' (= id do doc no Firestore)
  residente_override text not null,                      -- id em RESIDENTES_2026, ex. 'r1-augusto'
  origem             text not null default 'manual',     -- 'troca' (aceite) | 'manual' (ajuste do admin)
  troca_id           text,                               -- código TR###### quando veio de troca
  updated_by         text,                               -- Firebase UID de quem gravou (audit trail)
  updated_at         timestamptz not null default now(),

  constraint residencia_plantao_diario_overrides_data_chk
    check (data_plantao ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint residencia_plantao_diario_overrides_origem_chk
    check (origem in ('troca', 'manual'))
);

comment on table public.residencia_plantao_diario_overrides is
  'Espelho de residenciaPlantaoDiario (Firestore): residente EFETIVO por dia após trocas aceitas/ajustes. Lida pela edge schedule-shift-reminders; escrita pelo app a cada troca aceita ou ajuste manual (residenciaPlantaoOverridesMirror.js). Fonte da verdade continua sendo o Firestore.';

alter table public.residencia_plantao_diario_overrides enable row level security;

drop policy if exists residencia_plantao_diario_overrides_select on public.residencia_plantao_diario_overrides;
create policy residencia_plantao_diario_overrides_select on public.residencia_plantao_diario_overrides
  for select to authenticated
  using (true);

drop policy if exists residencia_plantao_diario_overrides_insert on public.residencia_plantao_diario_overrides;
create policy residencia_plantao_diario_overrides_insert on public.residencia_plantao_diario_overrides
  for insert to authenticated
  with check (true);

drop policy if exists residencia_plantao_diario_overrides_update on public.residencia_plantao_diario_overrides;
create policy residencia_plantao_diario_overrides_update on public.residencia_plantao_diario_overrides
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists residencia_plantao_diario_overrides_delete on public.residencia_plantao_diario_overrides;
create policy residencia_plantao_diario_overrides_delete on public.residencia_plantao_diario_overrides
  for delete to authenticated
  using (true);

grant select, insert, update, delete on table public.residencia_plantao_diario_overrides to authenticated;
grant select on table public.residencia_plantao_diario_overrides to service_role; -- a edge lê com service_role
revoke all on table public.residencia_plantao_diario_overrides from anon;

-- ----------------------------------------------------------------------------
-- Backfill — estado de residenciaPlantaoDiario em 14/09/2026 (60 docs)
-- ----------------------------------------------------------------------------
insert into public.residencia_plantao_diario_overrides
  (data_plantao, residente_override, origem, troca_id, updated_by, updated_at)
values
  ('2026-05-02', 'r1-augusto', 'troca', 'TR544940', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-04-29T15:36:32.021Z'),
  ('2026-05-06', 'r1-augusto', 'troca', 'TR153329', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-05-05T22:58:08.667Z'),
  ('2026-05-20', 'r1-augusto', 'troca', 'TR433348', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-05-14T18:01:55.902Z'),
  ('2026-07-20', 'r1-augusto', 'troca', 'TR240201', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-06-26T14:02:01.493Z'),
  ('2026-07-26', 'r1-augusto', 'troca', 'TR475677', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-06-26T14:01:59.690Z'),
  ('2026-09-04', 'r1-augusto', 'troca', 'TR440365', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-09-03T09:15:41.624Z'),
  ('2026-09-07', 'r1-augusto', 'troca', 'TR808793', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-09-03T10:52:32.255Z'),
  ('2026-10-26', 'r1-augusto', 'troca', 'TR644226', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-09-13T01:05:06.972Z'),
  ('2026-06-25', 'r1-guilherme', 'troca', 'TR285650', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-06-10T21:40:35.526Z'),
  ('2026-09-06', 'r1-guilherme', 'troca', 'TR808793', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-09-03T10:52:32.255Z'),
  ('2026-09-13', 'r1-guilherme', 'troca', 'TR988459', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-08-18T15:59:37.820Z'),
  ('2026-09-16', 'r1-guilherme', 'troca', 'TR872344', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-09-07T15:59:04.669Z'),
  ('2026-09-19', 'r1-guilherme', 'troca', 'TR137680', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-18T15:37:42.679Z'),
  ('2026-11-08', 'r1-guilherme', 'troca', 'TR429069', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-09-08T14:19:19.136Z'),
  ('2026-11-11', 'r1-guilherme', 'troca', 'TR316621', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-08-18T15:34:55.038Z'),
  ('2026-11-21', 'r1-guilherme', 'troca', 'TR338863', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-07-24T17:40:38.219Z'),
  ('2026-07-19', 'r1-roosewelt', 'troca', 'TR475677', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-06-26T14:01:59.690Z'),
  ('2026-07-21', 'r1-roosewelt', 'troca', 'TR240201', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-06-26T14:02:01.493Z'),
  ('2026-07-25', 'r1-roosewelt', 'troca', 'TR338863', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-07-24T17:40:38.219Z'),
  ('2026-09-18', 'r1-roosewelt', 'troca', 'TR440365', 'mkly0zioftYd6JcCiNfbrHuOyip2', '2026-09-03T09:15:41.624Z'),
  ('2026-06-08', 'r2-daniel', 'troca', 'TR685599', 'Jbu91kc4iZT59dW79AZzL16pd7X2', '2026-06-10T09:28:54.330Z'),
  ('2026-06-10', 'r2-daniel', 'troca', 'TR430613', 'AvAtc0xUjDRWMJPc3gDFBbJVOfB3', '2026-06-08T17:15:03.188Z'),
  ('2026-06-17', 'r2-daniel', 'troca', 'TR288752', 'SKcKFiGMIAh9v8rqCB9gJM71Az23', '2026-06-08T20:51:10.111Z'),
  ('2026-06-24', 'r2-daniel', 'troca', 'TR285650', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-06-10T21:40:35.526Z'),
  ('2026-06-26', 'r2-daniel', 'troca', 'TR514519', 'Jbu91kc4iZT59dW79AZzL16pd7X2', '2026-06-10T09:28:52.186Z'),
  ('2026-06-28', 'r2-daniel', 'troca', 'TR384624', 'Jbu91kc4iZT59dW79AZzL16pd7X2', '2026-06-10T09:28:49.770Z'),
  ('2026-08-05', 'r2-daniel', 'troca', 'TR180400', 'SKcKFiGMIAh9v8rqCB9gJM71Az23', '2026-07-14T15:28:40.783Z'),
  ('2026-08-19', 'r2-daniel', 'troca', 'TR972635', 'Jbu91kc4iZT59dW79AZzL16pd7X2', '2026-08-18T23:00:30.192Z'),
  ('2026-08-26', 'r2-daniel', 'troca', 'TR693702', 'HIZ9uZ57eCPSLjhKGgipZbYXQ4k1', '2026-08-18T17:30:20.013Z'),
  ('2026-05-25', 'r2-jacinta', 'troca', 'TR433348', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-05-14T18:01:55.902Z'),
  ('2026-06-16', 'r2-jacinta', 'troca', 'TR288752', 'SKcKFiGMIAh9v8rqCB9gJM71Az23', '2026-06-08T20:51:10.111Z'),
  ('2026-07-05', 'r2-jacinta', 'troca', 'TR384624', 'Jbu91kc4iZT59dW79AZzL16pd7X2', '2026-06-10T09:28:49.770Z'),
  ('2026-07-18', 'r2-jacinta', 'troca', 'TR473003', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-07-15T09:37:46.688Z'),
  ('2026-08-31', 'r2-jacinta', 'troca', 'TR180400', 'SKcKFiGMIAh9v8rqCB9gJM71Az23', '2026-07-14T15:28:40.783Z'),
  ('2026-09-14', 'r2-jacinta', 'troca', 'TR644226', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-09-13T01:05:06.972Z'),
  ('2026-10-18', 'r2-jacinta', 'troca', 'TR203037', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-05T00:21:58.779Z'),
  ('2026-12-10', 'r2-jacinta', 'troca', 'TR861883', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-05T00:21:58.250Z'),
  ('2026-05-13', 'r2-rodrigo', 'troca', 'TR153329', 'rGg8rzX6GucVNvgH6GJxBmQO3mF2', '2026-05-05T22:58:08.667Z'),
  ('2026-07-01', 'r2-rodrigo', 'troca', 'TR927191', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-07-01T14:28:48.293Z'),
  ('2026-07-04', 'r2-rodrigo', 'troca', 'TR887726', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-06-30T19:45:26.259Z'),
  ('2026-08-11', 'r2-rodrigo', 'troca', 'TR305401', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-05T15:12:24.791Z'),
  ('2026-08-18', 'r2-rodrigo', 'troca', 'TR984249', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-18T15:42:33.835Z'),
  ('2026-08-23', 'r2-rodrigo', 'troca', 'TR988459', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-08-18T15:59:37.820Z'),
  ('2026-08-25', 'r2-rodrigo', 'troca', 'TR771396', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-08-18T15:55:40.449Z'),
  ('2026-08-29', 'r2-rodrigo', 'troca', 'TR137680', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-18T15:37:42.679Z'),
  ('2026-09-02', 'r2-rodrigo', 'troca', 'TR316621', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-08-18T15:34:55.038Z'),
  ('2026-09-09', 'r2-rodrigo', 'troca', 'TR252826', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-11T13:38:05.986Z'),
  ('2026-09-15', 'r2-rodrigo', 'troca', 'TR872344', 'zHIQohTglkff9SS2cx0WZaAemVJ3', '2026-09-07T15:59:04.669Z'),
  ('2026-09-20', 'r2-rodrigo', 'troca', 'TR429069', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-09-08T14:19:19.136Z'),
  ('2026-10-11', 'r2-rodrigo', 'troca', 'TR230548', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-07-01T13:14:11.732Z'),
  ('2026-10-15', 'r2-rodrigo', 'troca', 'TR861883', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-05T00:21:58.250Z'),
  ('2026-10-29', 'r2-rodrigo', 'troca', 'TR940981', 'AvAtc0xUjDRWMJPc3gDFBbJVOfB3', '2026-06-25T22:54:21.794Z'),
  ('2026-12-11', 'r2-rodrigo', 'troca', 'TR316678', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-08-18T22:57:38.208Z'),
  ('2026-06-30', 'r3-raffaela', 'troca', 'TR351504', 'AvAtc0xUjDRWMJPc3gDFBbJVOfB3', '2026-06-30T15:52:07.623Z'),
  ('2026-07-02', 'r3-raffaela', 'troca', 'TR940981', 'AvAtc0xUjDRWMJPc3gDFBbJVOfB3', '2026-06-25T22:54:21.794Z'),
  ('2026-07-16', 'r3-raffaela', 'troca', 'TR515458', 'HIZ9uZ57eCPSLjhKGgipZbYXQ4k1', '2026-07-14T16:05:06.348Z'),
  ('2026-07-08', 'r3-wagner', 'troca', 'TR495236', 'HIZ9uZ57eCPSLjhKGgipZbYXQ4k1', '2026-06-30T15:16:09.135Z'),
  ('2026-07-12', 'r3-wagner', 'troca', 'TR230548', 'TOK0J2ZZvmVm0b1RmfYfkWTT1ha2', '2026-07-01T13:14:11.732Z'),
  ('2026-07-30', 'r3-wagner', 'troca', 'TR515458', 'HIZ9uZ57eCPSLjhKGgipZbYXQ4k1', '2026-07-14T16:05:06.348Z'),
  ('2026-08-20', 'r3-wagner', 'troca', 'TR693702', 'HIZ9uZ57eCPSLjhKGgipZbYXQ4k1', '2026-08-18T17:30:20.013Z')
on conflict (data_plantao) do update set
  residente_override = excluded.residente_override,
  origem             = excluded.origem,
  troca_id           = excluded.troca_id,
  updated_by         = excluded.updated_by,
  updated_at         = excluded.updated_at;

commit;

notify pgrst, 'reload schema';

-- Conferência (o applier imprime só o último statement)
select
  to_regclass('public.residencia_plantao_diario_overrides') is not null as tabela,
  (select relrowsecurity from pg_class where oid = 'public.residencia_plantao_diario_overrides'::regclass) as rls_on,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'residencia_plantao_diario_overrides') as policies,
  (select count(*) from public.residencia_plantao_diario_overrides) as linhas,
  (select residente_override from public.residencia_plantao_diario_overrides where data_plantao = '2026-09-15') as dia_15,
  not has_table_privilege('anon', 'public.residencia_plantao_diario_overrides', 'select') as anon_bloqueado;
