-- ════════════════════════════════════════════════════════════════════════
-- 20260722500000_cirurgias_particulares_convenio_part.sql
-- BUG REAL (piloto 2026-07-22 tarde): a escala do HRO abrevia o convênio
-- particular como "Part" (e compostos como "PART/SC") — o classificador
-- `LIKE 'PARTICULAR%'` não reconhecia e 4 casos do dia ficaram SEM
-- lançamento de cobrança (3× "Part" + 1× "PART/SC").
--
-- Correção em 3 partes:
--   1. Helper único `fn_convenio_particular(text)`: PART como PALAVRA no
--      início ("PART", "Part/SC", "PART.", "PARTICULAR...") — "PARTE..."
--      não casa (letra depois do PART).
--   2. Trigger fn_sync_cirurgia_particular passa a usar o helper (INSERT e
--      transição de UPDATE).
--   3. Re-backfill idempotente com o padrão novo (pega os 4 de hoje e
--      qualquer outro legado).
-- Front (familiaConvenio) e edge (pacienteNome) corrigidos no mesmo commit.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Helper único de classificação ───────────────────────────────────
create or replace function public.fn_convenio_particular(p_convenio text)
returns boolean
language sql
immutable
as $$
  select upper(btrim(coalesce(p_convenio, ''))) ~ '^PART(ICULAR)?([^A-Z]|$)';
$$;

revoke execute on function public.fn_convenio_particular(text) from public, anon;
grant execute on function public.fn_convenio_particular(text) to authenticated, service_role;

comment on function public.fn_convenio_particular(text) is
  'true se o convênio é da família PARTICULAR — aceita a forma abreviada da escala do HRO ("Part", "PART/SC") além de "PARTICULAR...". Espelho do familiaConvenio do front.';

-- ── 2. Trigger com o helper (corpo idêntico ao 20260722200000, só a
--       classificação muda) ─────────────────────────────────────────────
create or replace function public.fn_sync_cirurgia_particular()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_escala public.escala_cirurgica%rowtype;
  v_local text;
  v_orphan uuid;
  v_anest_nome text;
  v_anest_fallback text;
  v_uid text;
  v_autor_nome text;
begin
  -- Só convênio da família PARTICULAR (helper cobre "Part"/"PART/SC")
  if not public.fn_convenio_particular(new.convenio) then
    return new;
  end if;
  -- Suspensa não gera cobrança (des-suspender re-dispara via UPDATE)
  if new.status_extra = 'suspensa' then
    return new;
  end if;
  -- UPDATE: só age nas transições relevantes (des-suspendeu OU virou particular)
  if tg_op = 'UPDATE' then
    if not (
      (coalesce(old.status_extra, '') = 'suspensa' and coalesce(new.status_extra, '') <> 'suspensa')
      or (not public.fn_convenio_particular(old.convenio))
    ) then
      return new;
    end if;
  end if;

  select * into v_escala from public.escala_cirurgica where id = new.escala_id;
  if v_escala.id is null or v_escala.status <> 'publicada' then
    return new;
  end if;

  v_local := case v_escala.hospital
    when 'unimed' then 'Unimed'
    when 'hro' then 'HRO'
    when 'materno' then 'Materno-infantil'
    else v_escala.hospital
  end;

  if exists (
    select 1 from public.cirurgias_particulares cp
    where cp.escala_caso_id = new.id and cp.cancelada_em is null
  ) then
    return new;
  end if;

  v_uid := nullif(public.firebase_uid(), '');

  -- Republicação: re-vincula lançamento órfão equivalente em vez de duplicar
  select cp.id into v_orphan
  from public.cirurgias_particulares cp
  where cp.cancelada_em is null
    and cp.escala_caso_id is not null
    and cp.data_cirurgia = v_escala.data
    and cp.local = v_local
    and not exists (select 1 from public.escala_cirurgica_caso c2 where c2.id = cp.escala_caso_id)
    and cp.cirurgiao = coalesce(nullif(btrim(new.cirurgiao), ''), 'A completar')
    and cp.procedimento = coalesce(nullif(btrim(new.procedimento), ''), 'A completar')
  order by cp.created_at
  limit 1;

  if v_orphan is not null then
    update public.cirurgias_particulares
      set escala_caso_id = new.id, updated_at = now(), updated_by = v_uid
      where id = v_orphan;
    return new;
  end if;

  select p.nome into v_anest_nome from public.profiles p where p.id = new.anestesista_user_id;
  v_anest_fallback := nullif(btrim(new.anestesista), '');
  if v_anest_fallback !~ '[[:alpha:]]' then
    v_anest_fallback := null; -- '//', '?', '??' não são nomes
  end if;

  select p.nome into v_autor_nome from public.profiles p where p.id = v_uid;

  insert into public.cirurgias_particulares (
    paciente, cirurgiao, anestesista_nome, anestesista_user_id,
    data_cirurgia, procedimento, local, valor, status_pagamento,
    escala_caso_id, created_by, created_by_name
  ) values (
    coalesce(nullif(btrim(new.paciente_iniciais), ''), '?'),
    coalesce(nullif(btrim(new.cirurgiao), ''), 'A completar'),
    coalesce(v_anest_nome, v_anest_fallback, 'A definir'),
    new.anestesista_user_id,
    v_escala.data,
    coalesce(nullif(btrim(new.procedimento), ''), 'A completar'),
    v_local,
    0,
    'pendente',
    new.id,
    v_uid,
    coalesce(v_autor_nome, 'Importação automática')
  );

  return new;
exception when others then
  -- Cobrança NUNCA bloqueia a operação clínica (publicar/editar escala).
  raise warning 'fn_sync_cirurgia_particular (caso %): %', new.id, sqlerrm;
  return new;
end;
$$;

-- ── 3. Re-backfill com o padrão novo (idempotente via NOT EXISTS) ──────
insert into public.cirurgias_particulares (
  paciente, cirurgiao, anestesista_nome, anestesista_user_id,
  data_cirurgia, procedimento, local, valor, status_pagamento,
  escala_caso_id, created_by_name
)
select
  coalesce(nullif(btrim(c.paciente_iniciais), ''), '?'),
  coalesce(nullif(btrim(c.cirurgiao), ''), 'A completar'),
  coalesce(
    p.nome,
    case when btrim(coalesce(c.anestesista, '')) ~ '[[:alpha:]]'
         then btrim(c.anestesista) end,
    'A definir'
  ),
  c.anestesista_user_id,
  e.data,
  coalesce(nullif(btrim(c.procedimento), ''), 'A completar'),
  case e.hospital
    when 'unimed' then 'Unimed'
    when 'hro' then 'HRO'
    when 'materno' then 'Materno-infantil'
    else e.hospital
  end,
  0,
  'pendente',
  c.id,
  'Backfill auto-import'
from public.escala_cirurgica_caso c
join public.escala_cirurgica e on e.id = c.escala_id
left join public.profiles p on p.id = c.anestesista_user_id
where e.status = 'publicada'
  and public.fn_convenio_particular(c.convenio)
  and coalesce(c.status_extra, '') <> 'suspensa'
  and not exists (
    select 1 from public.cirurgias_particulares cp
    where cp.escala_caso_id = c.id and cp.cancelada_em is null
  );

COMMIT;
