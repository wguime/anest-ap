-- ════════════════════════════════════════════════════════════════════════
-- 20260722200000_cirurgias_particulares_auto_import.sql
-- Auto-import de casos PARTICULARES da escala p/ Cirurgias Particulares.
--
-- Pedido do dono (2026-07-22): publicar a escala deve importar os casos
-- particulares SOZINHO (sem botão), inclusive ao adicionar caso avulso.
--
-- Mecanismo: trigger AFTER INSERT/UPDATE em escala_cirurgica_caso.
-- A publicação (rpc_salvar_escala_cirurgica) faz DELETE+reinsert dos casos,
-- então TODO caminho de entrada de caso passa por INSERT — um único trigger
-- cobre publicar, republicar e adicionar caso. UPDATE cobre des-suspender
-- e convênio editado p/ particular (updateCaso).
--
-- Regras:
--   • Só escala PUBLICADA (rascunho não gera cobrança).
--   • Suspensa não importa; des-suspender importa na hora.
--   • Republicação: ids de caso morrem → re-VINCULA o lançamento órfão
--     (mesma data+local+cirurgião+procedimento) em vez de duplicar; se o
--     lançamento foi editado além disso, pode nascer rascunho duplicado —
--     visível (badge "completar", R$ 0) e cancelável.
--   • Rascunho criado: paciente = INICIAIS (ou '?'), valor = 0 — a UI marca
--     "Completar dados" e bloqueia save até nome completo (pareceIniciais).
--   • NUNCA bloqueia operação clínica: corpo inteiro em EXCEPTION handler
--     (padrão escala_cirurgica_evento) — falha vira WARNING, caso entra.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

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
  -- Só convênio da família PARTICULAR (mesma regra do front: familiaConvenio)
  if new.convenio is null or upper(btrim(new.convenio)) not like 'PARTICULAR%' then
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
      or (upper(coalesce(btrim(old.convenio), '')) not like 'PARTICULAR%')
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

  -- Já tem lançamento ATIVO deste caso? (índice único parcial garante 1)
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

  -- Rascunho novo. Anestesista: nome do profile (uid) > apelido legível > a definir.
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

revoke execute on function public.fn_sync_cirurgia_particular() from public, anon;

comment on function public.fn_sync_cirurgia_particular() is
  'Auto-import: caso PARTICULAR de escala publicada vira rascunho em cirurgias_particulares (valor 0, paciente = iniciais). Re-vincula órfãos na republicação. Nunca bloqueia a escala (exception → warning).';

DROP TRIGGER IF EXISTS tr_caso_sync_cirurgia_particular ON public.escala_cirurgica_caso;
CREATE TRIGGER tr_caso_sync_cirurgia_particular
  AFTER INSERT OR UPDATE OF status_extra, convenio ON public.escala_cirurgica_caso
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_cirurgia_particular();

COMMIT;
