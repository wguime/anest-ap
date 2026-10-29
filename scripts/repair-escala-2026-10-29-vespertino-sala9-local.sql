-- Reparo da escala cirúrgica de 29/10/2026 (vespertino, HRO) — Sala 9 (Vinicius Rubin).
-- Dono 29/10 12:42: a cistoscopia das 13:00 é com anestesia LOCAL → sai do mapa; a
-- prostatovesiculectomia fica, às 14:00 (recado da sala: "com anest só a partir das 14 hrs").
--
-- Reparo em vez de republicar: o turno já está no ar e republicar zera as liberações.
-- Casa por (id, iniciais, procedimento) e aborta se o estado mudou.
--
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-10-29-vespertino-sala9-local.sql
begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

do $$
declare
  v_hro constant uuid := '94e72aaf-8711-49a1-849f-692b1fbcfa5e';
  n int;
begin
  delete from public.escala_cirurgica_caso
   where id = '35f20597-d0e9-48d8-8717-cac2e090d2e5' and escala_id = v_hro and turno = 'vespertino'
     and sala = 'Sala 9' and paciente_iniciais = 'C.Z.' and procedimento like 'CISTOSCOPIA%'
     and status_cirurgia = 'agendada' and inicio_real is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'reparo: cistoscopia C.Z. não encontrada como esperado (%)', n; end if;

  update public.escala_cirurgica_caso
     set hora = '14:00'
   where id = 'ff45e982-30f4-43dd-86b1-00d691410306' and escala_id = v_hro and turno = 'vespertino'
     and sala = 'Sala 9' and paciente_iniciais = 'J.A.N.' and procedimento like 'PROSTATOVESICULECTOMIA%';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'reparo: prostatovesiculectomia J.A.N. não encontrada (%)', n; end if;
end $$;

commit;
