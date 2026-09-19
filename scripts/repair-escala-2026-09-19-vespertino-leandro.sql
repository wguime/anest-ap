-- Sábado 19/09/2026, tarde — dois ajustes depois do reparo dos acréscimos (dono 13h01):
--   1. "não quero que adicione esse tipo de recado": o caso do Baroncello saiu com o
--      procedimento "CIRURGIA (RECADO DO DONO)" — inventado por mim; fica vazio (o card
--      mostra "AS —", a cirurgia está no cirurgião).
--   2. "Faltou Leandro": a linha dele na fila única estava LIBERADA por um toque às 12h31
--      (marcação vespertino:<uid>, do próprio dono, na hora dos testes do cartão amarelo) —
--      card vermelho e enxuto, sem as duas cirurgias. Sai a marcação: ele volta a
--      trabalhando, com Aymone e Baroncello no card.
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration <este arquivo>
begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

do $$
declare v_n int;
begin
  update public.escala_cirurgica_caso set procedimento = ''
   where id = 'ecdb7437-bb0f-45fd-85e4-a0fc25124bcd' and procedimento = 'CIRURGIA (RECADO DO DONO)';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'caso do Baroncello não encontrado com o texto esperado (%), nada gravado', v_n; end if;

  update public.escala_cirurgica
     set liberacoes = liberacoes - 'vespertino:n6wY96vUUVejOrcUulYesfhhCkI2'
   where data = date '2026-09-19' and hospital = 'fds'
     and liberacoes ? 'vespertino:n6wY96vUUVejOrcUulYesfhhCkI2';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'liberação do Leandro na tarde não encontrada (%), nada gravado', v_n; end if;
  raise notice 'Leandro de volta à fila; procedimento do Baroncello limpo';
end $$;

select (liberacoes ? 'vespertino:n6wY96vUUVejOrcUulYesfhhCkI2') as leandro_liberado_tarde
  from public.escala_cirurgica where data = date '2026-09-19' and hospital = 'fds';
select procedimento, cirurgiao, anestesista from public.escala_cirurgica_caso where id = 'ecdb7437-bb0f-45fd-85e4-a0fc25124bcd';
commit;
