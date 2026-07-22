-- ════════════════════════════════════════════════════════════════════════
-- 20260722300000_cirurgias_particulares_backfill.sql
-- Backfill: casos PARTICULARES de escalas publicadas ANTES do trigger
-- (20260722200000) viram rascunho de cobrança retroativamente.
--
-- O dono filtrou 15–21/07 e viu 0 cirurgias: as escalas do piloto foram
-- publicadas antes do auto-import existir. Mesma lógica/valores do trigger
-- fn_sync_cirurgia_particular; idempotente via NOT EXISTS no vínculo ativo
-- (re-rodar não duplica). Sem re-link de órfãos (não há lançamentos legados).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

insert into public.cirurgias_particulares (
  paciente, cirurgiao, anestesista_nome, anestesista_user_id,
  data_cirurgia, procedimento, local, valor, status_pagamento,
  escala_caso_id, created_by_name
)
select
  coalesce(nullif(btrim(c.paciente_iniciais), ''), '?'),
  coalesce(nullif(btrim(c.cirurgiao), ''), 'A completar'),
  coalesce(
    p.nome,
    case when btrim(coalesce(c.anestesista, '')) ~ '[[:alpha:]]'
         then btrim(c.anestesista) end,
    'A definir'
  ),
  c.anestesista_user_id,
  e.data,
  coalesce(nullif(btrim(c.procedimento), ''), 'A completar'),
  case e.hospital
    when 'unimed' then 'Unimed'
    when 'hro' then 'HRO'
    when 'materno' then 'Materno-infantil'
    else e.hospital
  end,
  0,
  'pendente',
  c.id,
  'Backfill auto-import'
from public.escala_cirurgica_caso c
join public.escala_cirurgica e on e.id = c.escala_id
left join public.profiles p on p.id = c.anestesista_user_id
where e.status = 'publicada'
  and upper(btrim(coalesce(c.convenio, ''))) like 'PARTICULAR%'
  and coalesce(c.status_extra, '') <> 'suspensa'
  and not exists (
    select 1 from public.cirurgias_particulares cp
    where cp.escala_caso_id = c.id and cp.cancelada_em is null
  );

COMMIT;
