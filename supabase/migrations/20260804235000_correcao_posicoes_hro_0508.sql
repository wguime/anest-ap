-- Correção operacional solicitada: HRO, 05/08/2026, turno matutino.
-- Troca somente as identidades das duas posições; casos, horários e demais
-- campos da escala permanecem intactos.
begin;

update public.escala_cirurgica_caso
   set anestesista = 'GIOVANA',
       anestesista_user_id = 'pGSkueeoH6eDpwTzU53JOimafFh2'
 where escala_id = (select id from public.escala_cirurgica where data='2026-08-05' and hospital='hro')
   and turno = 'matutino'
   and anestesista_user_id = 'aEOzX1qmPWc8695fwDJolfPWVtP2';

update public.escala_cirurgica_caso
   set anestesista = 'GABRIEL',
       anestesista_user_id = 'JrmikQ5Ct9OXHmihdNxKTrYXtFJ3'
 where escala_id = (select id from public.escala_cirurgica where data='2026-08-05' and hospital='hro')
   and turno = 'matutino'
   and anestesista_user_id = 'w8Cf3Y3YxPTBToQOjUFsO8RAmvp2';

update public.escala_cirurgica e
   set ordem_liberacao = jsonb_set(
     e.ordem_liberacao,
     '{matutino}',
     (
       select coalesce(jsonb_agg(
         case value #>> '{}'
           when 'ALEXANDRE D' then to_jsonb('GIOVANA'::text)
           when 'VICENTE' then to_jsonb('GABRIEL'::text)
           else value
         end order by ordinality
       ), '[]'::jsonb)
       from jsonb_array_elements(e.ordem_liberacao->'matutino') with ordinality
     ),
     true
   ),
   updated_at = now()
 where e.data='2026-08-05' and e.hospital='hro';

commit;
