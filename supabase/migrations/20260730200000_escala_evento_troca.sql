-- ============================================================================
-- Escala Cirúrgica — rastro da TROCA DECLARADA em escala_cirurgica_evento
--
-- Feature 30/07 (desenho declarar → executar): o par declarado vive em
-- linha_overrides[chave].trocaCom e a substituição executada em
-- linha_overrides[chave].assumidaPor — a RPC de patch é jsonb opaco por chave,
-- então os campos novos passam SEM mudança de schema. O que falta é o RASTRO:
-- a marcação é colaborativa (qualquer can_write_escala_cirurgica marca e
-- desmarca) e precisa de histórico de quem/quando — o log de eventos já cobre
-- status e liberações; este trigger cobre o diff de trocaCom/assumidaPor.
--
-- LGPD: trocaCom/assumidaPor só carregam uid/nome de ANESTESISTA (nunca dado de
-- paciente). O detalhe copia o próprio jsonb do campo + o motivo do diff.
-- Padrão da casa (20260718100000): SECURITY DEFINER, escrita exclusiva por
-- trigger, e o log NUNCA bloqueia a operação clínica (exception → warning).
--
-- ROLLBACK: derrubar SÓ o gatilho — NÃO re-estreitar o CHECK: com eventos
-- 'troca' já gravados o ADD CONSTRAINT falharia, e apagar linhas de um log
-- insert-only é perda de rastro (o CHECK ampliado é retrocompatível).
--   drop trigger if exists tr_escala_evento_troca on public.escala_cirurgica;
--   drop function if exists public.log_escala_troca();
-- ============================================================================

-- CHECK de tipo ganha 'troca' (era status | liberacao)
alter table public.escala_cirurgica_evento
  drop constraint if exists escala_cirurgica_evento_tipo_check;
alter table public.escala_cirurgica_evento
  add constraint escala_cirurgica_evento_tipo_check
  check (tipo in ('status', 'liberacao', 'troca'));

create or replace function public.log_escala_troca()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  k text;
  v_old jsonb := coalesce(old.linha_overrides, '{}'::jsonb);
  v_new jsonb := coalesce(new.linha_overrides, '{}'::jsonb);
  t_old jsonb; t_new jsonb;
  a_old jsonb; a_new jsonb;
begin
  -- dado corrompido (não-objeto) não pode travar a linha nem o trigger
  if jsonb_typeof(v_old) <> 'object' or jsonb_typeof(v_new) <> 'object' then
    return new;
  end if;

  for k in
    select jsonb_object_keys(v_old)
    union
    select jsonb_object_keys(v_new)
  loop
    -- nullif('null'::jsonb): `trocaCom: null` gravado EXPLICITAMENTE não é SQL
    -- NULL — sem isto, desfazer por null viraria evento rotulado 'declarada'.
    -- Hoje o front remove a chave (spread condicional), é blindagem p/ o futuro.
    t_old := nullif(v_old -> k -> 'trocaCom', 'null'::jsonb);
    t_new := nullif(v_new -> k -> 'trocaCom', 'null'::jsonb);
    a_old := nullif(v_old -> k -> 'assumidaPor', 'null'::jsonb);
    a_new := nullif(v_new -> k -> 'assumidaPor', 'null'::jsonb);

    if t_old is distinct from t_new then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'troca', new.id, new.data, new.hospital, k,
        case when t_new is null then 'troca_desfeita' else 'troca_declarada' end,
        -- motivo distingue "alguém desfez" da RAJADA de desfeitas que a
        -- republicação gera (resetLiberacoesDia zera linha_overrides inteiro)
        coalesce(t_new, t_old, '{}'::jsonb) || jsonb_build_object(
          'motivo', case when v_new = '{}'::jsonb then 'reset_publicacao' else 'manual' end),
        -- ator: JWT primeiro (não-forjável); o `por` gravado no jsonb como fallback
        coalesce(nullif(public.firebase_uid(), ''), nullif(coalesce(t_new, t_old) ->> 'por', ''))
      );
    end if;

    if a_old is distinct from a_new then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'troca', new.id, new.data, new.hospital, k,
        case when a_new is null then 'assuncao_desfeita' else 'posicao_assumida' end,
        coalesce(a_new, a_old, '{}'::jsonb) || jsonb_build_object(
          'motivo', case when v_new = '{}'::jsonb then 'reset_publicacao' else 'manual' end),
        coalesce(nullif(public.firebase_uid(), ''), nullif(coalesce(a_new, a_old) ->> 'por', ''))
      );
    end if;
  end loop;
  return new;
exception when others then
  -- log de rastro NUNCA bloqueia a operação clínica: perde os eventos DESTE
  -- update (a subtransação do bloco desfaz todos), avisa e segue
  raise warning 'log_escala_troca falhou: %', sqlerrm;
  return new;
end;
$$;

comment on function public.log_escala_troca() is
  'Rastro da troca declarada (linha_overrides.trocaCom/assumidaPor) em escala_cirurgica_evento. Diff por chave; motivo=manual|reset_publicacao. Nunca bloqueia a operação clínica.';

drop trigger if exists tr_escala_evento_troca on public.escala_cirurgica;
create trigger tr_escala_evento_troca
  after update on public.escala_cirurgica
  for each row
  when (old.linha_overrides is distinct from new.linha_overrides)
  execute function public.log_escala_troca();
