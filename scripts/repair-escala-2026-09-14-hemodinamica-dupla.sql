-- Escala de 14/09/2026 (vespertino, Unimed): Hemodinâmica volta a ser a dupla
-- "ADRIANO + GABRIELA".
--
-- O que aconteceu: a escala saiu com "GUILHERME MELO + ADRIANO" na continuação das
-- 13:00 e "//" nas duas linhas seguintes. O dono foi corrigir para Adriano + Gabriela
-- pelo cabeçalho da sala na Completa (modo SALA do DefinirAnestesistaSheet), onde a
-- linha "Dois anestesistas" não era oferecida — só existia no modo CASO. Confirmou só
-- ADRIANO e as três linhas ficaram com uma pessoa (12h34 de 14/09).
--
-- O que este reparo grava: o MESMO patch do service numa dupla (`updateAnestesistaCasos`,
-- ramo dupla) — texto "A + B", uid nulo (dupla é uid nulo por construção) e
-- sem_anestesista=false (uid nulo sozinho seria "?"). Assinado como o dono via
-- request.jwt.claims, como a publicação por script. Sem republicar: o turno está em uso.
--
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-09-14-hemodinamica-dupla.sql
--      (ensaio: trocar o `commit;` final por `rollback;`)

begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

do $$
declare
  v_n int;
begin
  -- pré-condição: as 3 linhas da Hemodinâmica da tarde estão com ADRIANO sozinho
  select count(*) into v_n
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
   where e.data = date '2026-09-14' and e.hospital = 'unimed'
     and c.turno = 'vespertino' and c.sala = 'Hemodinâmica'
     and c.anestesista = 'ADRIANO';
  if v_n <> 3 then
    raise exception 'esperava 3 linhas com ADRIANO na Hemodinâmica da tarde, achei % — nada gravado', v_n;
  end if;

  update public.escala_cirurgica_caso c
     set anestesista = 'ADRIANO + GABRIELA',
         anestesista_user_id = null,
         sem_anestesista = false
    from public.escala_cirurgica e
   where e.id = c.escala_id
     and e.data = date '2026-09-14' and e.hospital = 'unimed'
     and c.turno = 'vespertino' and c.sala = 'Hemodinâmica'
     and c.anestesista = 'ADRIANO';
  get diagnostics v_n = row_count;
  raise notice 'Hemodinâmica 14/09 tarde: % linha(s) agora ADRIANO + GABRIELA', v_n;
end $$;

-- verificação (vai junto na resposta)
select c.hora, c.anestesista, c.anestesista_user_id, c.sem_anestesista
  from public.escala_cirurgica_caso c
  join public.escala_cirurgica e on e.id = c.escala_id
 where e.data = date '2026-09-14' and e.hospital = 'unimed'
   and c.turno = 'vespertino' and c.sala = 'Hemodinâmica'
 order by c.ordem;

commit;
