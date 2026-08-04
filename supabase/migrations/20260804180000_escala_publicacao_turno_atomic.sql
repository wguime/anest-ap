-- Escala cirúrgica: publicação isolada por turno (transacional).
--
-- A publicação antiga substituía o dia inteiro. Esta RPC serializa por
-- (data,hospital), remove somente casos com o turno publicado e zera somente
-- o estado operacional desse turno. `publicacao_turnos` torna explícito o
-- estado de cada turno; as colunas legadas continuam sendo preenchidas em
-- formato por-turno para leitores antigos durante a transição.
--
-- RLS: a função é SECURITY DEFINER, portanto replica o gate de escrita antes
-- de qualquer DML. Auditoria (created_by/published_by) é sempre firebase_uid().
-- Rollback (manual, após confirmar que nenhum leitor depende do campo novo):
--   drop function if exists public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb);
--   alter table public.escala_cirurgica drop column if exists publicacao_turnos;

begin;

create index if not exists idx_escala_cirurgica_caso_escala_turno
  on public.escala_cirurgica_caso (escala_id, turno);

-- Dados legados sem turno eram importações antigas do período matutino. Fixar
-- explicitamente evita que leitores tratem o mesmo caso como pertencente ao
-- turno atualmente selecionado.
update public.escala_cirurgica_caso set turno = 'matutino' where turno is null;

alter table public.escala_cirurgica
  add column if not exists publicacao_turnos jsonb not null default '{}'::jsonb;

comment on column public.escala_cirurgica.publicacao_turnos is
  'Estado explícito por turno: {matutino|vespertino:{status,publishedAt,publishedBy,publishedByName,casos}}. Mantém compatibilidade com leitores das colunas legadas.';

do $$
begin
  if to_regclass('public.escala_cirurgica_evento') is not null then
    alter table public.escala_cirurgica_evento drop constraint if exists escala_cirurgica_evento_tipo_check;
    alter table public.escala_cirurgica_evento add constraint escala_cirurgica_evento_tipo_check
      check (tipo in ('status','liberacao','troca','publicacao'));
  end if;
end $$;

create or replace function public.rpc_publicar_escala_turno(
  p_data date,
  p_hospital text,
  p_turno text,
  p_header jsonb,
  p_casos jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_caller text := public.firebase_uid();
  v_status text := coalesce(nullif(p_header->>'status',''), 'publicada');
  v_old jsonb;
  v_ordem jsonb;
  v_ajuda jsonb;
  v_lib jsonb;
  v_over jsonb;
  v_turnos jsonb;
  v_pub jsonb;
  v_result jsonb;
  v_chave text;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_turno not in ('matutino','vespertino') then
    raise exception 'turno_invalido' using errcode = '22023';
  end if;
  if p_hospital not in ('unimed','hro','materno') then
    raise exception 'hospital_invalido' using errcode = '22023';
  end if;
  if v_status not in ('rascunho','publicada') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_header->'ordem_liberacao','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_header->'ajuda_externa','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_casos,'[]'::jsonb)) <> 'array' then
    raise exception 'payload_formato_invalido' using errcode = '22023';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;

  -- Upsert e lock explícito: concorrência no mesmo dia/hospital fica serializada.
  insert into public.escala_cirurgica (data,hospital,status,created_by,created_at,updated_at)
  values (p_data,p_hospital,case when v_status='publicada' then 'publicada' else 'rascunho' end,v_caller,now(),now())
  on conflict (data,hospital) do nothing;
  select e.id, e.ordem_liberacao, e.ajuda_externa, e.liberacoes,
         e.linha_overrides, e.publicacao_turnos
    into v_id, v_ordem, v_ajuda, v_lib, v_over, v_turnos
    from public.escala_cirurgica e
   where e.data=p_data and e.hospital=p_hospital
   for update;

  -- Legado array/objeto é normalizado sem mover o estado do outro turno.
  v_ordem := case when jsonb_typeof(coalesce(v_ordem,'{}'))='array'
                  then jsonb_build_object('matutino',coalesce(v_ordem,'[]'))
                  else coalesce(v_ordem,'{}') end;
  v_ajuda := case when jsonb_typeof(coalesce(v_ajuda,'{}'))='array'
                  then jsonb_build_object('matutino',coalesce(v_ajuda,'[]'))
                  when jsonb_typeof(coalesce(v_ajuda,'{}'))='object' then coalesce(v_ajuda,'{}')
                  else '{}'::jsonb end;
  v_ordem := case when jsonb_typeof(v_ordem)='object' then v_ordem else '{}'::jsonb end;
  v_lib := case when jsonb_typeof(coalesce(v_lib,'{}'))='object' then coalesce(v_lib,'{}') else '{}'::jsonb end;
  v_over := case when jsonb_typeof(coalesce(v_over,'{}'))='object' then coalesce(v_over,'{}') else '{}'::jsonb end;
  v_turnos := case when jsonb_typeof(coalesce(v_turnos,'{}'))='object' then coalesce(v_turnos,'{}') else '{}'::jsonb end;
  -- `liberacoes` e `linha_overrides` permanecem mapas planos: os leitores e
  -- triggers existentes usam a chave estável da linha, não o turno.

  -- O estado novo usa chaves namespaced (turno:chave). Assim, o reset do
  -- matutino nunca remove a mesma pessoa no vespertino. Chaves sem namespace
  -- são legado e permanecem até migração explícita, evitando perda silenciosa.
  for v_chave in select jsonb_object_keys(coalesce(v_lib, '{}'::jsonb)) loop
    if left(v_chave, length(p_turno) + 1) = p_turno || ':' then
      v_lib := v_lib - v_chave;
    end if;
  end loop;
  for v_chave in select jsonb_object_keys(coalesce(v_over, '{}'::jsonb)) loop
    if left(v_chave, length(p_turno) + 1) = p_turno || ':' then
      v_over := v_over - v_chave;
    end if;
  end loop;

  -- Somente casos explicitamente publicados neste turno são substituídos.
  delete from public.escala_cirurgica_caso where escala_id=v_id and turno=p_turno;
  if jsonb_typeof(coalesce(p_casos,'[]'))='array' and jsonb_array_length(coalesce(p_casos,'[]'))>0 then
    insert into public.escala_cirurgica_caso
      (escala_id,sala,ordem,hora,tempo_estimado,termino_previsto,paciente_iniciais,idade,
       procedimento,convenio,cirurgiao,cirurgiao_display,anestesista,anestesista_user_id,
       residente,residente_user_id,bloco,is_continuacao,sem_anestesista,tipo,turno)
    select v_id, coalesce(c->>'sala',''), coalesce((nullif(c->>'ordem',''))::int,0),
      nullif(c->>'hora',''), nullif(c->>'tempo_estimado',''), nullif(c->>'termino_previsto',''),
      nullif(c->>'paciente_iniciais',''), nullif(c->>'idade',''), nullif(c->>'procedimento',''),
      nullif(c->>'convenio',''), nullif(c->>'cirurgiao',''), nullif(c->>'cirurgiao_display',''),
      nullif(c->>'anestesista',''), nullif(c->>'anestesista_user_id',''), nullif(c->>'residente',''),
      nullif(c->>'residente_user_id',''), coalesce(nullif(c->>'bloco',''),'normal'),
      coalesce((nullif(c->>'is_continuacao',''))::boolean,false), coalesce((nullif(c->>'sem_anestesista',''))::boolean,false),
      coalesce(nullif(c->>'tipo',''),'eletiva'), p_turno
    from jsonb_array_elements(coalesce(p_casos,'[]')) c;
  end if;

  v_pub := jsonb_build_object('status',v_status,'publishedAt',case when v_status='publicada' then now() else null end,
    'publishedBy',case when v_status='publicada' then v_caller else null end,
    'publishedByName',nullif(p_header->>'published_by_name',''),
    'casos', (select count(*) from public.escala_cirurgica_caso where escala_id=v_id and turno=p_turno));
  v_turnos := jsonb_set(coalesce(v_turnos,'{}'), array[p_turno], v_pub, true);

  update public.escala_cirurgica set
    status=case when v_status='publicada' then 'publicada' else status end,
    ordem_liberacao=jsonb_set(v_ordem,array[p_turno],coalesce(nullif(p_header->'ordem_liberacao','null'::jsonb),'[]'::jsonb),true),
    ajuda_externa=jsonb_set(v_ajuda,array[p_turno],coalesce(nullif(p_header->'ajuda_externa','null'::jsonb),'[]'::jsonb),true),
    liberacoes=coalesce(v_lib,'{}'::jsonb),
    linha_overrides=coalesce(v_over,'{}'::jsonb),
    publicacao_turnos=v_turnos,
    source_image_path=coalesce(nullif(p_header->>'source_image_path',''),source_image_path),
    published_at=case when v_status='publicada' then now() else published_at end,
    published_by=case when v_status='publicada' then v_caller else published_by end,
    published_by_name=case when v_status='publicada' then coalesce((select p.nome from public.profiles p where p.id=v_caller),nullif(p_header->>'published_by_name','')) else published_by_name end,
    updated_at=now()
  where id=v_id;

  -- Auditoria da publicação: não replica dados do paciente; registra apenas
  -- quem publicou, qual turno e quantos casos foram substituídos.
  if to_regclass('public.escala_cirurgica_evento') is not null then
    begin
      insert into public.escala_cirurgica_evento (tipo, escala_id, data, hospital, detalhe, por)
      values ('publicacao', v_id, p_data, p_hospital,
        jsonb_build_object('turno', p_turno, 'casos', jsonb_array_length(coalesce(p_casos,'[]'::jsonb)), 'status', v_status), v_caller);
    exception when others then
      raise warning 'auditoria_publicacao indisponivel: %', sqlerrm;
    end;
  end if;

  select jsonb_build_object('header',(select to_jsonb(e.*) from public.escala_cirurgica e where e.id=v_id),
    'casos',coalesce((select jsonb_agg(c.* order by c.sala,c.ordem) from public.escala_cirurgica_caso c where c.escala_id=v_id),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb) to authenticated, service_role;

commit;
