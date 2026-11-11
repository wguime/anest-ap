-- Rollback de 20261110120000_escala_log_liberacao_sem_marcador_repasse.sql
-- Devolve o corpo que estava em produção em 10/11/2026 (pg_get_functiondef), o de
-- 20260718100000_escala_eventos.sql. Não apaga os eventos 'marcador' já gravados: eles
-- têm `por` nulo e não entram em conta nenhuma.

begin;

create or replace function public.log_escala_liberacao()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  k text;
  v_old jsonb := coalesce(old.liberacoes, '{}'::jsonb);
  v_new jsonb := coalesce(new.liberacoes, '{}'::jsonb);
begin
  -- dado corrompido (não-objeto) não pode travar a linha nem o trigger
  if jsonb_typeof(v_old) <> 'object' or jsonb_typeof(v_new) <> 'object' then
    return new;
  end if;

  -- marcadas (chave nova ou liberadoEm alterado)
  for k in select jsonb_object_keys(v_new) loop
    if (v_old -> k) is distinct from (v_new -> k) then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'liberacao', new.id, new.data, new.hospital, k, 'liberado',
        jsonb_build_object('ordem', coalesce(new.ordem_liberacao, '[]'::jsonb), 'em', v_new -> k -> 'liberadoEm'),
        -- ator: JWT primeiro (não-forjável); jsonb como fallback
        coalesce(nullif(public.firebase_uid(), ''), nullif(v_new -> k ->> 'por', ''))
      );
    end if;
  end loop;
  -- desfeitas (chave sumiu)
  for k in select jsonb_object_keys(v_old) loop
    if not (v_new ? k) then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'liberacao', new.id, new.data, new.hospital, k, 'desfeito',
        jsonb_build_object('ordem', coalesce(new.ordem_liberacao, '[]'::jsonb)),
        nullif(public.firebase_uid(), '')
      );
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'log_escala_liberacao falhou: %', sqlerrm;
  return new;
end;
$function$;

commit;

select position('''marcador''' in pg_get_functiondef('public.log_escala_liberacao()'::regprocedure)) = 0 as voltou_ao_corpo_de_18_07;
