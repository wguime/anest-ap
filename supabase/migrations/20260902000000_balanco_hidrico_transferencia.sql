-- ════════════════════════════════════════════════════════════════════════
-- 20260902000000_balanco_hidrico_transferencia.sql
-- Transferência do Balanço Hídrico Transoperatório entre colegas.
--
-- É ENTREGA, não sincronia: quem passa envia o registro, quem recebe assume e
-- continua. Não há edição simultânea — por isso não há conflito a resolver, e
-- por isso o desenho é uma tabela só (dono 01/09: "não quero nada complexo").
--
-- ⚠️ LGPD — o que NÃO tem aqui é tão importante quanto o que tem:
--   • `payload` guarda SÓ NÚMEROS (peso, altura, sexo, idade, creatinina, Ht e
--     os volumes por hora). É o mesmo conteúdo que hoje vive no localStorage.
--   • Não existe coluna de texto livre. "12 horas · mulher · 47a · 60 kg" é
--     DERIVADO do payload no cliente, e não guardado: coluna de texto livre é
--     onde um nome de paciente vaza, e aqui simplesmente não há onde escrever.
--   • Não há vínculo com caso/escala: a transferência funciona também em
--     urgência fora da escala publicada, e não associa o registro a iniciais,
--     cirurgião, sala ou data.
--   • Retenção curta por cron (48 h), abaixo.
--
-- RLS: só as DUAS pessoas envolvidas enxergam a linha. Ninguém mais, nem admin
-- por esta policy — não é dado de gestão.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create table if not exists public.balanco_hidrico_transferencia (
  id           uuid primary key default gen_random_uuid(),
  de_user_id   text not null,               -- profiles.id de quem transfere
  para_user_id text not null,               -- profiles.id de quem recebe
  -- Só números. O CHECK barra a linha se alguém tentar guardar identificação
  -- do paciente aqui: falhar alto no insert é preferível a persistir nome.
  payload      jsonb not null check (
    payload ?& array['horas']
    and not (payload ?| array['nome', 'paciente', 'prontuario', 'cpf', 'registro'])
  ),
  criado_em    timestamptz not null default now(),
  assumido_em  timestamptz,
  recusado_em  timestamptz,
  -- uma linha só pode terminar de UM jeito
  constraint balanco_transf_desfecho_unico check (assumido_em is null or recusado_em is null)
);

comment on table public.balanco_hidrico_transferencia is
  'Entrega do balanço hídrico transoperatório de um anestesista para outro. Payload só com números — sem identificação de paciente e sem vínculo com caso da escala. Retenção 48 h.';
comment on column public.balanco_hidrico_transferencia.payload is
  'Rascunho da calculadora: peso, altura, sexo, idade, creatinina, Ht e volumes por hora. NUNCA identificação do paciente — há CHECK barrando as chaves óbvias.';

-- Pendentes de quem recebe: é a consulta que a tela faz ao abrir.
create index if not exists idx_bh_transf_pendente
  on public.balanco_hidrico_transferencia (para_user_id, criado_em desc)
  where assumido_em is null and recusado_em is null;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.balanco_hidrico_transferencia enable row level security;

-- SELECT: só as duas pontas.
drop policy if exists "bh_transf_select" on public.balanco_hidrico_transferencia;
create policy "bh_transf_select" on public.balanco_hidrico_transferencia
  for select to authenticated
  using (de_user_id = public.firebase_uid() or para_user_id = public.firebase_uid());

-- INSERT: só em nome PRÓPRIO — sem isso dá para forjar remetente, e o colega
-- receberia um balanço "de" alguém que nunca o mandou.
drop policy if exists "bh_transf_insert" on public.balanco_hidrico_transferencia;
create policy "bh_transf_insert" on public.balanco_hidrico_transferencia
  for insert to authenticated
  with check (de_user_id = public.firebase_uid() and para_user_id <> public.firebase_uid());

-- UPDATE: só quem RECEBE decide o desfecho (assumir/recusar).
drop policy if exists "bh_transf_update" on public.balanco_hidrico_transferencia;
create policy "bh_transf_update" on public.balanco_hidrico_transferencia
  for update to authenticated
  using (para_user_id = public.firebase_uid())
  with check (para_user_id = public.firebase_uid());

-- DELETE: só quem ENVIOU pode cancelar o que ainda não foi assumido.
drop policy if exists "bh_transf_delete" on public.balanco_hidrico_transferencia;
create policy "bh_transf_delete" on public.balanco_hidrico_transferencia
  for delete to authenticated
  using (de_user_id = public.firebase_uid() and assumido_em is null);

-- ── Retenção: 48 h ────────────────────────────────────────────────────────
-- Dado clínico não fica no banco além do que a entrega exige. 48 h cobre a
-- transferência que ninguém abriu até o plantão seguinte.
create or replace function public.limpar_balanco_transferencias()
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  delete from public.balanco_hidrico_transferencia
   where criado_em < now() - interval '48 hours';
$$;

revoke execute on function public.limpar_balanco_transferencias() from public, anon, authenticated;
grant execute on function public.limpar_balanco_transferencias() to service_role;

comment on function public.limpar_balanco_transferencias() is
  'Retenção LGPD: apaga transferências com mais de 48 h, assumidas ou não.';

-- Idempotente: unschedule antes, senão reaplicar a migration duplica o job.
-- Mesmo bloco DO das migrations de cron já existentes no repo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bh-transferencia-cleanup') THEN
    PERFORM cron.unschedule('bh-transferencia-cleanup');
  END IF;
END $$;

select cron.schedule(
  'bh-transferencia-cleanup',
  '20 5 * * *',  -- 05:20 UTC (= 02:20 BRT), fora de qualquer horário cirúrgico
  $$ select public.limpar_balanco_transferencias(); $$
);

COMMIT;
