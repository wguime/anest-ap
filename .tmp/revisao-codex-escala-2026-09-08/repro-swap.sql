-- Reproduzir SOMENTE em PostgreSQL local descartável. Não acessa tabelas ANEST.
-- Transcrição reduzida da semântica do loop de 20260905150000:345–373.
begin;
create temporary table revisao_casos (id text, anestesista_user_id text);
insert into revisao_casos values ('sala-1', 'a'), ('sala-2', 'b');
do $$
declare k text; v jsonb;
begin
  for k, v in select key, value from jsonb_each(
    '{"matutino:a":{"assumidaPor":{"uid":"b","de":{"uid":"a"}}},
      "matutino:b":{"assumidaPor":{"uid":"a","de":{"uid":"b"}}}}'::jsonb)
  loop
    update revisao_casos
      set anestesista_user_id = v->'assumidaPor'->>'uid'
      where anestesista_user_id = v->'assumidaPor'->'de'->>'uid';
  end loop;
  if (select anestesista_user_id from revisao_casos where id='sala-1') <> 'b'
     or (select anestesista_user_id from revisao_casos where id='sala-2') <> 'a' then
    raise exception 'Swap colapsou: %', (select jsonb_agg(to_jsonb(c)) from revisao_casos c);
  end if;
end $$;
rollback;
