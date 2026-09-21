-- Segunda 21/09/2026, tarde, Unimed — recado do plantonista (11h32): "@Guilherme e @Cury Anest
-- na equipe da Unimed no período vespertino". Os dois já estão no rodapé da Unimed como da casa
-- (regra de 17/09); a escala foi publicada às 11h37, ANTES de existir o selo "Equipe até 19h"
-- (v5.12.21). Este repair grava a marca que a publicação passaria a gravar pelo lote
-- (`decisoes['X'] = {tipo:'equipe'}` → `linha_overrides[vespertino:<uid>].naEquipe`).
-- Só acrescenta o campo: nada mais do override (termino, observação…) é tocado.
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration <este arquivo>
begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

do $$
declare
  v_n int;
  v_marca jsonb := jsonb_build_object(
    'naEquipe', jsonb_build_object('ate', '19:00'),
    'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
    'em', now()
  );
begin
  update public.escala_cirurgica
     set linha_overrides = coalesce(linha_overrides, '{}'::jsonb)
       || jsonb_build_object(
            'vespertino:pPdKZ75E9zNdPnLz50qisPiHfJw1',
              coalesce(linha_overrides->'vespertino:pPdKZ75E9zNdPnLz50qisPiHfJw1', '{}'::jsonb) || v_marca,
            'vespertino:GWjT4uJHq5hnN3eVs9NRLYrotzz1',
              coalesce(linha_overrides->'vespertino:GWjT4uJHq5hnN3eVs9NRLYrotzz1', '{}'::jsonb) || v_marca
          )
   where id = 'ce5efea6-03ed-4ac3-9974-262f6ebfcfb7'
     and data = date '2026-09-21' and hospital = 'unimed'
     and ordem_liberacao->'vespertino' ? 'GUILHERME MELO'
     and ordem_liberacao->'vespertino' ? 'CURY';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'escala da Unimed de 21/09 não encontrada com Melo e Cury no rodapé da tarde (%), nada gravado', v_n; end if;
  raise notice 'naEquipe 19:00 gravado para Guilherme Melo e Cury (Unimed, tarde de 21/09)';
end $$;

select k as chave, linha_overrides->k->'naEquipe' as na_equipe
  from public.escala_cirurgica, jsonb_object_keys(linha_overrides) k
 where id = 'ce5efea6-03ed-4ac3-9974-262f6ebfcfb7'
   and k in ('vespertino:pPdKZ75E9zNdPnLz50qisPiHfJw1', 'vespertino:GWjT4uJHq5hnN3eVs9NRLYrotzz1');
commit;
