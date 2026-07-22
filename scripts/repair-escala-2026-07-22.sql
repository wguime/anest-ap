-- Reparo escala cirúrgica 2026-07-22 (ordem do dono: "corrija").
-- Evidência: escala_cirurgica_evento — rodapé original em CAPS às 18:27Z;
-- às 20:00Z um cliente com bundle antigo (PWA em cache) persistiu nomes de
-- exibição e a lista explodiu p/ 22 itens com duplicatas; a ordem atual está
-- embaralhada. Marcações de liberação foram gravadas por chave de nome exibido
-- (esquema antigo) — re-chaveadas p/ a chave estável (uid do dicionário).
-- Troca de teste MELO⇄COSTA (CC - Sala 6 ⇄ Imagem, swap 20:01:08Z): o registro
-- foi excluído mas o swap ficou nos casos — revertido.

-- 1) Unimed: rodapé restaurado (snapshot 18:27Z + única reordenação legítima
--    DIEGO antes de FERNANDA, do snapshot 20:00:42Z) + liberações re-chaveadas.
update escala_cirurgica set
  ordem_liberacao = '["STAUB","COSTA","GABRIEL","GIOVANA","MELO","JOAO RICARDO","OSCAR","GABRIELA","DIEGO","FERNANDA","RAQUEL","CURY","ROMULO","KARINE","EDUARDO"]'::jsonb,
  liberacoes = (liberacoes - 'Cury' - 'Gabriel Costa' - 'Fernanda Guollo' - 'Oscar Morais' - 'Diego Rigotti' - 'Gabriela Vedana')
    || jsonb_strip_nulls(jsonb_build_object(
      'GWjT4uJHq5hnN3eVs9NRLYrotzz1', liberacoes->'Cury',
      'JrmikQ5Ct9OXHmihdNxKTrYXtFJ3', liberacoes->'Gabriel Costa',
      'XdcnZANVhQZCo0KRTcG9CbJ1MOs2', liberacoes->'Fernanda Guollo',
      '0PIwC4DeeMggzMK2JTqW0nmEYHj1', liberacoes->'Oscar Morais',
      'DXNcLwh7YAXZYsJSTIW078LZo1C2', liberacoes->'Diego Rigotti',
      'gPm15b0LbSNSUHS25MENZAIbnL23', liberacoes->'Gabriela Vedana'))
where id = 'f9636342-595c-4e56-aba0-da3a0a005191';

-- 2) HRO: rodapé está intacto; só re-chavear as liberações p/ uid.
update escala_cirurgica set
  liberacoes = (liberacoes - 'Tiago Viana' - 'Erlei Perini' - 'Janaina Morais' - 'Fernando Machado' - 'Leandro Bernardes' - 'Nathalia Fernandes')
    || jsonb_strip_nulls(jsonb_build_object(
      'BMPF3saZ7QZYqgHptZjFJYn7GxT2', liberacoes->'Tiago Viana',
      'zgiKSWgcRcYnfanHzC5QVcvkmDJ3', liberacoes->'Erlei Perini',
      'jTvDR05Bw6ZOPjmFHoHUJb2jxtr1', liberacoes->'Janaina Morais',
      '8SHFqmqx6edcDgbTCLBgPFPESft2', liberacoes->'Fernando Machado',
      'n6wY96vUUVejOrcUulYesfhhCkI2', liberacoes->'Leandro Bernardes',
      'aBU1Aju6cIME4qdLSbDsGC3w6cy1', liberacoes->'Nathalia Fernandes'))
where id = '7c3bdf2f-3d4f-49e4-ab62-e0ec3beb839b';

-- 3) Reverter o swap da troca de teste: Imagem volta p/ COSTA; CC - Sala 6 volta p/ MELO.
update escala_cirurgica_caso
  set anestesista = 'COSTA', anestesista_user_id = 'B7ccb01iPSeHuIdSe5z0XRbCF4z2'
where id = '6b43dd69-c446-4e0d-9172-7a8561636169';

update escala_cirurgica_caso
  set anestesista = 'MELO', anestesista_user_id = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'
where id in ('6439e9e8-5bbc-4920-b1d1-574c8a2a9b62', '913a4bab-a122-45e4-8f15-ef13ccc6ebda');
