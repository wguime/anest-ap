-- Escala de 10/09/2026 (matutino): marcar que a ordem das ajudas foi INFORMADA.
--
-- O recado do dono numerou "1º Aline – Iosc · 2º Guilherme – Iosc · 3º Rafael – Unimed ·
-- 4º Alexandre – Unimed" e o lote gravou `ajuda_externa` na ordem certa (o ÚLTIMO do array
-- sai primeiro). A fila da Unimed publicou o inverso: Alexandre está em 11º no rodapé do
-- HRO e o Rafael veio do consultório sem origem, então a regra de 27/08 (ajuda de outro
-- hospital sai antes de ajuda sem origem) passava por cima da numeração — e ainda zerava
-- o `ajudaIdx` do Alexandre, sumindo com as setas que consertariam à mão.
--
-- Aqui só a MARCA entra (`ajuda_externa.ordemInformada.matutino`). Os arrays não mudam:
-- já estão como o recado pediu. Sem republicar — o turno é de amanhã, mas republicar é
-- DELETE+reinsert e não há motivo para arriscar status/liberações por um campo.
--
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-09-10-ordem-informada.sql
--      (ensaio: trocar o `commit;` final por `rollback;`)

begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1')::text, true);

do $$
declare
  v_n int;
  v_uni jsonb;
  v_hro jsonb;
begin
  -- pré-condição: os arrays são os que o recado numerou (último do array sai primeiro)
  select ajuda_externa->'matutino' into v_uni
    from public.escala_cirurgica where data = date '2026-09-10' and hospital = 'unimed';
  select ajuda_externa->'matutino' into v_hro
    from public.escala_cirurgica where data = date '2026-09-10' and hospital = 'hro';
  if v_uni is distinct from '["ALEXANDRE D","RAFAEL"]'::jsonb then
    raise exception 'ajuda da Unimed não é a numerada: %', v_uni;
  end if;
  if v_hro is distinct from '["GUILHERME MELO","ALINE"]'::jsonb then
    raise exception 'ajuda do HRO não é a numerada: %', v_hro;
  end if;

  update public.escala_cirurgica
     -- ⚠️ jsonb_set só cria a ÚLTIMA chave do caminho: com `ordemInformada` ausente,
     -- '{ordemInformada,matutino}' devolveria o campo INTACTO, em silêncio (o ensaio
     -- com rollback foi quem pegou). Por isso o objeto inteiro é reconstruído.
     set ajuda_externa = jsonb_set(
           coalesce(ajuda_externa, '{}'::jsonb), '{ordemInformada}',
           coalesce(ajuda_externa->'ordemInformada', '{}'::jsonb)
             || jsonb_build_object('matutino', true), true)
   where data = date '2026-09-10' and hospital in ('unimed', 'hro');
  get diagnostics v_n = row_count;
  if v_n <> 2 then
    raise exception 'esperava marcar 2 escalas, marcou %', v_n;
  end if;

  -- a marca entrou e os arrays seguem intactos
  if (select count(*) from public.escala_cirurgica
        where data = date '2026-09-10' and hospital in ('unimed', 'hro')
          and ajuda_externa->'ordemInformada'->>'matutino' = 'true') <> 2 then
    raise exception 'marca não aplicada';
  end if;
  if (select ajuda_externa->'matutino' from public.escala_cirurgica
        where data = date '2026-09-10' and hospital = 'unimed') is distinct from v_uni then
    raise exception 'array da Unimed mudou';
  end if;
  if (select ajuda_externa->'matutino' from public.escala_cirurgica
        where data = date '2026-09-10' and hospital = 'hro') is distinct from v_hro then
    raise exception 'array do HRO mudou';
  end if;
end $$;

commit;
