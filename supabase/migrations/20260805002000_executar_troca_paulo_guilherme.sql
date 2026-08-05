-- Executa a troca declarada no HRO/Unimed para o dia 05/08/2026.
-- Paulo não precisa ter uma posição de origem em outro hospital: Guilherme
-- assume o slot do Paulo e recebe somente os casos abertos desse slot.
begin;

update public.escala_cirurgica_caso
   set anestesista = 'GUILHERME MELO',
       anestesista_user_id = 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
       sem_anestesista = false
 where escala_id = (select id from public.escala_cirurgica where data='2026-08-05' and hospital='unimed')
   and turno = 'matutino'
   and anestesista_user_id = 'rv0u9rlpYIPycfNm1ZNdpuBeSXv2'
   and coalesce(status_cirurgia, 'agendada') <> 'terminada';

update public.escala_cirurgica
   set linha_overrides = jsonb_set(
     jsonb_set(
       linha_overrides,
       '{rv0u9rlpYIPycfNm1ZNdpuBeSXv2}',
       jsonb_build_object(
         'assumidaPor', jsonb_build_object('uid','pPdKZ75E9zNdPnLz50qisPiHfJw1','nome','GUILHERME MELO'),
         'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'em', now()
       ), true
     ),
     '{matutino:rv0u9rlpYIPycfNm1ZNdpuBeSXv2}',
     jsonb_build_object(
       'observacao', 'Consultório',
       'assumidaPor', jsonb_build_object('uid','pPdKZ75E9zNdPnLz50qisPiHfJw1','nome','GUILHERME MELO'),
       'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'em', now()
     ), true
   ),
   updated_at = now()
 where data='2026-08-05' and hospital='unimed';

commit;
