-- ════════════════════════════════════════════════════════════════════════
-- 20260722600000_cirurgias_particulares_regra_paciente_identificado.sql
-- REGRA DO DONO (2026-07-22 noite, para APRENDER E REGISTRAR):
--   "Quando houver informação com características PART/SC — em que não tem
--    como definir qual paciente é particular e/ou convênio — NÃO extraia.
--    Extraia apenas se houver NOME DE PACIENTE vinculado a procedimento
--    particular."
--
-- Tradução operacional (2 condições p/ auto-import de cobrança):
--   1. Convênio PURAMENTE particular: "PART", "Part.", "PARTICULAR..." —
--      compostos como "PART/SC" ou "PARTICULAR/UNIMED" são ambíguos
--      (pagador misto/indefinido) e NÃO importam.
--   2. Paciente IDENTIFICADO no caso (iniciais preenchidas) — linhas de
--      LOTE ("04 FACECTOMIA (04 PCTES)", sem paciente) NÃO importam.
--
-- Também soft-cancela rascunhos PRISTINE (intocados: valor 0, sem CPF)
-- cujo caso vinculado não passa mais na regra — caso real: o lote de
-- facectomias PART/SC importado pelo backfill de hoje. Rascunho já editado
-- pelo usuário NUNCA é cancelado automaticamente.
-- Espelhos no front/edge/excel corrigidos no mesmo commit.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Convênio PURAMENTE particular (composto não conta) ──────────────
create or replace function public.fn_convenio_particular(p_convenio text)
returns boolean
language sql
immutable
as $$
  -- PART/PARTICULAR como token ÚNICO: depois dele só não-letras
  -- ("Part.", "PARTICULAR ", "PART 100%"). Qualquer outra letra depois
  -- ("PART/SC", "PARTE", "PARTICULAR/UNIMED") = não é puramente particular.
  select upper(btrim(coalesce(p_convenio, ''))) ~ '^PART(ICULAR)?[^A-Z]*$';
$$;

comment on function public.fn_convenio_particular(text) is
  'true se o convênio é PURAMENTE particular ("Part", "PART.", "PARTICULAR..."). Compostos ("PART/SC") são ambíguos e NÃO contam — regra do dono 2026-07-22: só importa cobrança com pagador definido. Espelho do familiaConvenio do front.';

-- ── 2. Trigger: exige paciente IDENTIFICADO além do convênio puro ──────
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
  -- Só convênio PURAMENTE particular (composto tipo PART/SC não importa)
  if not public.fn_convenio_particular(new.convenio) then
    return new;
  end if;
  -- Regra do dono 2026-07-22: sem paciente IDENTIFICADO (lotes/linhas
  -- agregadas) não há cobrança a criar.
  if nullif(btrim(coalesce(new.paciente_iniciais, '')), '') is null then
    return new;
  end if;
  -- Suspensa não gera cobrança (des-suspender re-dispara via UPDATE)
  if new.status_extra = 'suspensa' then
    return new;
  end if;
  -- UPDATE: só age nas transições relevantes (des-suspendeu OU virou
  -- particular OU paciente foi identificado depois — ex.: lote desmembrado)
  if tg_op = 'UPDATE' then
    if not (
      (coalesce(old.status_extra, '') = 'suspensa' and coalesce(new.status_extra, '') <> 'suspensa')
      or (not public.fn_convenio_particular(old.convenio))
      or (nullif(btrim(coalesce(old.paciente_iniciais, '')), '') is null)
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
    btrim(new.paciente_iniciais),
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

comment on function public.fn_sync_cirurgia_particular() is
  'Auto-import: caso de convênio PURAMENTE particular COM paciente identificado, em escala publicada, vira rascunho em cirurgias_particulares (valor 0). Composto (PART/SC) e lotes sem paciente NUNCA importam (regra do dono 2026-07-22). Re-vincula órfãos na republicação. Nunca bloqueia a escala (exception → warning).';

-- Trigger re-criado: paciente_iniciais entra no UPDATE OF — identificar o
-- paciente DEPOIS (edição do caso) também dispara a importação.
DROP TRIGGER IF EXISTS tr_caso_sync_cirurgia_particular ON public.escala_cirurgica_caso;
CREATE TRIGGER tr_caso_sync_cirurgia_particular
  AFTER INSERT OR UPDATE OF status_extra, convenio, paciente_iniciais ON public.escala_cirurgica_caso
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cirurgia_particular();

-- ── 3. Soft-cancel de rascunhos PRISTINE que não passam mais na regra ──
-- Pristine = intocado desde o auto-import (valor 0, sem CPF, sem pagamento).
-- Caso vinculado existente que falha em convênio-puro OU paciente-identificado.
update public.cirurgias_particulares cp
set cancelada_em = now(),
    cancelada_por_nome = 'Regra 2026-07-22 (auto)',
    motivo_cancelamento = 'Convênio composto/sem paciente identificado (ex.: PART/SC em lote) — sem como definir o pagador particular',
    updated_at = now()
from public.escala_cirurgica_caso c
where cp.escala_caso_id = c.id
  and cp.cancelada_em is null
  and cp.valor = 0
  and cp.paciente_cpf is null
  and cp.status_pagamento = 'pendente'
  and (
    not public.fn_convenio_particular(c.convenio)
    or nullif(btrim(coalesce(c.paciente_iniciais, '')), '') is null
  );

COMMIT;
