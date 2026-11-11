-- ============================================================================
-- ESCALA CIRÚRGICA — o log de liberação deixa de chamar de "liberado" o que não é
-- (investigação das trocas, 10/11/2026)
--
-- `liberacoes` guarda DUAS coisas na mesma chave: a liberação de verdade
-- (`{ liberadoEm }`) e o marcador `{ escalado: true }` — o que o repasse grava em quem
-- é do rodapé e ficou sem cirurgia, e o que o toque grava ao acionar quem nasceu
-- liberado na cauda. O trigger de 18/07 registrava QUALQUER mudança de chave como
-- `status_para = 'liberado'`. Efeito medido em produção (30 dias até 10/11): 144 dos
-- 1.154 eventos de liberação eram marcador (`detalhe.em` nulo), de 35 pessoas — cada
-- um contado como "ação" no relatório de adesão e lido como liberação fora da ordem em
-- qualquer auditoria da fila (27/10 às 08:09, 14/10 às 08:03, 19/10 às 11:45).
--
-- O que muda (só o trigger; nenhuma tabela, nenhum dado antigo é reescrito):
--   liberadoEm novo ou alterado ........ 'liberado'  (como antes)
--   marcador por cima de uma liberação .. 'desfeito'  (era 'liberado'; a pessoa voltou à fila)
--   marcador novo ...................... 'marcador'  com `por` NULO e o autor em
--                                        `detalhe.por` — fica o rastro, sai da conta de ações
--                                        (a adesão conta evento com `por is not null`)
--   chave removida que era liberação ... 'desfeito'  (como antes)
--   chave removida que era marcador .... nada         (era 'desfeito')
--   só `por`/`em` regravados ........... nada         (era 'liberado' repetido)
-- Dentro da publicação (GUC `anest.publicacao`), o 'desfeito' sai com
-- `detalhe.motivo = 'reset_publicacao'`, como o rastro da troca já faz. O autor NÃO foi
-- mexido ali: em 30 dias não houve lote de "desfeito" de republicação para medir.
-- GUC `anest.liberacao_movida` (ligado pela RPC de desfazer troca, migration seguinte):
-- a marca que só muda de chave, com o mesmo `liberadoEm`, não é liberação nova.
--
-- Rollback: scripts/rollback-20261110120000-log-liberacao-sem-marcador.sql
-- Trava: src/__tests__/lib/escalaLogLiberacaoMarcadorSql.test.js (PGlite)
-- ============================================================================

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
  v_a jsonb;
  v_d jsonb;
  v_lib_a text;
  v_lib_d text;
  v_ator text := nullif(public.firebase_uid(), '');
  v_ordem jsonb := coalesce(new.ordem_liberacao, '[]'::jsonb);
  v_publicando boolean := coalesce(current_setting('anest.publicacao', true), '') = '1';
  v_movida boolean := coalesce(current_setting('anest.liberacao_movida', true), '') = '1';
begin
  -- dado corrompido (não-objeto) não pode travar a linha nem o trigger
  if jsonb_typeof(v_old) <> 'object' or jsonb_typeof(v_new) <> 'object' then
    return new;
  end if;
  -- a marca só mudou de chave (desfazer troca): o rastro é o evento da troca
  if v_movida then
    return new;
  end if;

  for k in select jsonb_object_keys(v_new) loop
    v_a := v_old -> k;
    v_d := v_new -> k;
    if v_a is not distinct from v_d then
      continue;
    end if;
    v_lib_a := case when jsonb_typeof(v_a) = 'object' then nullif(v_a ->> 'liberadoEm', '') end;
    v_lib_d := case when jsonb_typeof(v_d) = 'object' then nullif(v_d ->> 'liberadoEm', '') end;

    if v_lib_d is not null then
      -- liberação de verdade: nova ou com outro horário
      if v_lib_a is distinct from v_lib_d then
        insert into public.escala_cirurgica_evento
          (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
        values (
          'liberacao', new.id, new.data, new.hospital, k, 'liberado',
          jsonb_build_object('ordem', v_ordem, 'em', v_d -> 'liberadoEm'),
          -- ator: JWT primeiro (não-forjável); jsonb como fallback
          coalesce(v_ator, nullif(v_d ->> 'por', ''))
        );
      end if;
    elsif v_lib_a is not null then
      -- a liberação saiu e ficou o marcador: a pessoa voltou à fila
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'liberacao', new.id, new.data, new.hospital, k, 'desfeito',
        jsonb_build_object('ordem', v_ordem, 'marcador', true)
          || case when v_publicando then jsonb_build_object('motivo', 'reset_publicacao') else '{}'::jsonb end,
        v_ator
      );
    elsif jsonb_typeof(v_d) = 'object' and (v_d ->> 'escalado') = 'true'
          and not coalesce(jsonb_typeof(v_a) = 'object' and (v_a ->> 'escalado') = 'true', false) then
      -- marcador novo (repasse ou acionamento): rastro sem autor na coluna
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'liberacao', new.id, new.data, new.hospital, k, 'marcador',
        jsonb_build_object('ordem', v_ordem, 'por', coalesce(v_ator, nullif(v_d ->> 'por', ''))),
        null
      );
    end if;
  end loop;

  -- desfeitas (chave sumiu) — só quando o que havia era liberação
  for k in select jsonb_object_keys(v_old) loop
    if not (v_new ? k) then
      v_a := v_old -> k;
      if jsonb_typeof(v_a) = 'object' and nullif(v_a ->> 'liberadoEm', '') is not null then
        insert into public.escala_cirurgica_evento
          (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
        values (
          'liberacao', new.id, new.data, new.hospital, k, 'desfeito',
          jsonb_build_object('ordem', v_ordem)
            || case when v_publicando then jsonb_build_object('motivo', 'reset_publicacao') else '{}'::jsonb end,
          v_ator
        );
      end if;
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'log_escala_liberacao falhou: %', sqlerrm;
  return new;
end;
$function$;

comment on function public.log_escala_liberacao() is
  'Rastro de liberacoes em escala_cirurgica_evento. Só { liberadoEm } vira "liberado"; o marcador { escalado: true } (repasse/acionamento) vira "marcador" sem autor na coluna (não conta como ação na adesão). 10/11/2026.';

commit;

-- conferência: o corpo no ar é o novo
select position('''marcador''' in pg_get_functiondef('public.log_escala_liberacao()'::regprocedure)) > 0 as trigger_separa_marcador,
       position('anest.liberacao_movida' in pg_get_functiondef('public.log_escala_liberacao()'::regprocedure)) > 0 as respeita_marca_movida;
