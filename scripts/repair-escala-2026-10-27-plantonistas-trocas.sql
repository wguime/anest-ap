-- Terça 27/10/2026, manhã — HRO e Unimed. Entre 08:09 e 08:26 a conta UNIMED repassou as
-- cirurgias de quem trocou de hospital (Raul ⇄ Vicente, Garim ⇄ Janaína) sem mover a posição na
-- fila. Às 09:01 a Daniela executou Raul ⇄ Vicente pela troca do app e, às 09:03, Garim assumindo
-- a posição da Janaína só do lado da Unimed. Dono, 09:35: "Raul e Vicente trocaram, Raul fica de
-- plantão no HRO e Vicente na Unimed". Faltava:
--   1. HRO: Janaína assume a posição do Garim (15ª) — ela faz o consultório (ajuda) que era dele;
--      sem isso o Garim seguia em 15º como "Ajuda Sala 10/Unimed" e ela no fim, "próxima".
--   2. Unimed: Vicente vai para a posição do Oscar (1ª, plantonista) e o Oscar, na HIPEC, para a
--      posição do Raul (3ª), que o Vicente ocupava.
-- Pela MESMA função da troca do app (`rpc_escala_executar_troca`), assinada como o dono: ela tira o
-- `trocaCom` do slot, carimba `assumidaPor` com por/em e o trigger registra o evento `troca`.
-- Nenhum caso muda de dono (cada um já está no nome certo) e `ordem_liberacao` não é tocada.
-- Aborta se o estado não for o de 09:35 (escala diferente ou slot já mexido por outra pessoa).
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-10-27-plantonistas-trocas.sql
begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

do $$
declare
  v_hro    constant uuid := 'c9250fa3-8a20-4005-bbbd-3844277d3e09';
  v_unimed constant uuid := 'ec213576-f473-40e4-a88c-46165c4106be';
  v_ov_hro jsonb;
  v_ov_uni jsonb;
  v_ret jsonb;
begin
  select linha_overrides into v_ov_hro from public.escala_cirurgica
   where id = v_hro and data = date '2026-10-27' and hospital = 'hro'
     and ordem_liberacao->'matutino' ? 'GARIM';
  select linha_overrides into v_ov_uni from public.escala_cirurgica
   where id = v_unimed and data = date '2026-10-27' and hospital = 'unimed'
     and ordem_liberacao->'matutino' ? 'OSCAR' and ordem_liberacao->'matutino' ? 'RAUL';
  if v_ov_hro is null or v_ov_uni is null then
    raise exception 'escalas de 27/10 (HRO/Unimed) não encontradas com GARIM/OSCAR/RAUL no rodapé — nada gravado';
  end if;
  if v_ov_hro ? 'matutino:qe1XyrmOzGeGnkhkKn9U0qzLifG3' then
    raise exception 'a posição do Garim no HRO já foi mexida — nada gravado';
  end if;
  if v_ov_uni->'matutino:ARHMFkzl0ebfWWnEzha1QtNdvMo1'->'assumidaPor'->>'uid' is distinct from 'w8Cf3Y3YxPTBToQOjUFsO8RAmvp2'
     or v_ov_uni->'matutino:qasYnJpQ01QrVjRO7Og5rBNRlVu2' ? 'assumidaPor' then
    raise exception 'a Unimed não está como às 09:35 (Vicente na posição do Raul, Oscar na dele) — nada gravado';
  end if;

  v_ret := public.rpc_escala_executar_troca(jsonb_build_array(
    jsonb_build_object(
      'escala_id', v_hro, 'chave', 'matutino:qe1XyrmOzGeGnkhkKn9U0qzLifG3', 'caso_ids', '[]'::jsonb,
      'assumida_por', jsonb_build_object(
        'uid', 'jTvDR05Bw6ZOPjmFHoHUJb2jxtr1', 'nome', 'JANAÍNA FAVORITO', 'tipo', 'entre_hospitais', 'casoIds', '[]'::jsonb,
        'de', jsonb_build_object('uid', 'qe1XyrmOzGeGnkhkKn9U0qzLifG3', 'nome', 'GUSTAVO ALMANSA GARIM'))),
    jsonb_build_object(
      'escala_id', v_unimed, 'chave', 'matutino:qasYnJpQ01QrVjRO7Og5rBNRlVu2', 'caso_ids', '[]'::jsonb,
      'assumida_por', jsonb_build_object(
        'uid', 'w8Cf3Y3YxPTBToQOjUFsO8RAmvp2', 'nome', 'VICENTE ANTONIO ALVES PONS', 'tipo', 'posicoes', 'casoIds', '[]'::jsonb,
        'de', jsonb_build_object('uid', 'qasYnJpQ01QrVjRO7Og5rBNRlVu2', 'nome', 'OSCAR MORAIS'))),
    jsonb_build_object(
      'escala_id', v_unimed, 'chave', 'matutino:ARHMFkzl0ebfWWnEzha1QtNdvMo1', 'caso_ids', '[]'::jsonb,
      'assumida_por', jsonb_build_object(
        'uid', 'qasYnJpQ01QrVjRO7Og5rBNRlVu2', 'nome', 'OSCAR MORAIS', 'tipo', 'posicoes', 'casoIds', '[]'::jsonb,
        'de', jsonb_build_object('uid', 'ARHMFkzl0ebfWWnEzha1QtNdvMo1', 'nome', 'RAUL PERIZZOLO')))
  ));
  if (v_ret->>'lados')::int <> 3 or (v_ret->>'pulados')::int <> 0 then
    raise exception 'troca não gravou os 3 lados (%) — desfeito', v_ret;
  end if;
end $$;

select e.hospital, k as posicao, e.linha_overrides->k->'assumidaPor'->>'nome' as quem_ocupa,
       e.linha_overrides->k->'assumidaPor'->'de'->>'nome' as de_quem, e.linha_overrides->k ? 'trocaCom' as sobrou_troca
  from public.escala_cirurgica e, jsonb_object_keys(e.linha_overrides) k
 where e.data = date '2026-10-27' and e.hospital in ('hro', 'unimed')
   and k in ('matutino:qe1XyrmOzGeGnkhkKn9U0qzLifG3', 'matutino:qasYnJpQ01QrVjRO7Og5rBNRlVu2', 'matutino:ARHMFkzl0ebfWWnEzha1QtNdvMo1')
 order by 1, 2;
commit;
