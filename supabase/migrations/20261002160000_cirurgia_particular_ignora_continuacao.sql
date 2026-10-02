-- Cobrança de particular: a CONTINUAÇÃO não abre lançamento (dono 02/10/2026).
--
-- A publicação pela foto passou a herdar, na linha "CONTINUAÇÃO +-14h" da tarde, os dados do
-- caso da manhã (iniciais, procedimento, convênio) — pedido do dono: o card não pode ficar só
-- com "continuação". Com convênio particular + iniciais, este gatilho abriria uma 2ª cobrança
-- da MESMA cirurgia (a da manhã já abriu a sua). A continuação nunca é cirurgia nova: retorna
-- antes de tudo. Única mudança em relação a 20260722600000 é o bloco marcado "02/10".
--
-- Rollback: reaplicar a função de 20260722600000_cirurgias_particulares_regra_paciente_identificado.sql
-- (sem o bloco "02/10"). Idempotente (CREATE OR REPLACE; o trigger não muda).

CREATE OR REPLACE FUNCTION public.fn_sync_cirurgia_particular()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_escala public.escala_cirurgica%rowtype;
  v_local text;
  v_orphan uuid;
  v_anest_nome text;
  v_anest_fallback text;
  v_uid text;
  v_autor_nome text;
begin
  -- 02/10: continuação de cirurgia de outro turno não é cirurgia nova — a cobrança é a do caso
  -- de origem (a linha herda convênio e iniciais só para o card dizer o que está em sala)
  if coalesce(new.is_continuacao, false) then
    return new;
  end if;
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
$function$;
