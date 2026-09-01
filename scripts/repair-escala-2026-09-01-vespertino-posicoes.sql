-- REPAIR 2026-09-01 vespertino — swap de POSIÇÕES Gabriela ⇄ Rafael (pedido do
-- dono, 01/09 de manhã: "retire as ajudas desses dois usuários e mantenha
-- Gabriela na posição de Rafael no HRO, e Rafael na posição de Gabriela na
-- UNIMED").
--
-- O que aconteceu: a escala vespertina saiu com a troca MEIO aplicada — os
-- CASOS já trocados (Gabriela na Sala 6 do HRO; Rafael na SRPA da Unimed), os
-- RODAPÉS ainda com cada um no hospital de origem (RAFAEL 2º no HRO, GABRIELA
-- 4ª na Unimed). A regra dos emprestados (30/07) leu "rodapé aqui + caso lá" e
-- pendurou o badge de Ajuda nos dois — que é o sintoma relatado.
--
-- O conserto é o mecanismo CANÔNICO das trocas: `assumidaPor` no slot — troca a
-- IDENTIDADE exibida sem tocar a ordem_liberacao (imutável), e a fila passa a
-- avaliar a linha por quem ASSUMIU (os badges de Ajuda somem sozinhos: cada um
-- fica no hospital onde estão os próprios casos). Nenhum caso muda de dono —
-- eles já estão certos; `casoIds: []` explícito é LOAD-BEARING: omiti-lo faria
-- um futuro "desfazer" cair no fallback que varre e MOVE os casos do assumente
-- (utils.js:1755-1759).
--
-- Shape validado pelo migration-validator contra o que o app grava
-- (EscalaCirurgicaContext.jsx:878): por/em DENTRO de assumidaPor — é de lá que
-- o trigger tr_escala_evento_troca tira o ATOR do evento `posicao_assumida`
-- (20260730200000:85; firebase_uid() é NULL via Management API). Sem `motivo`:
-- é texto livre exibido no card. Sem INSERTs manuais de evento: o trigger grava
-- o rastro canônico que o histórico lê (status_para='posicao_assumida').
--
-- Idempotente: jsonb_set sobrescreve a mesma chave com o mesmo valor (o trigger
-- não re-dispara: WHEN old IS DISTINCT FROM new). Preserva as chaves matutino:.

-- HRO vespertino: slot do RAFAEL (chave = uid do vínculo) → GABRIELA assume
UPDATE escala_cirurgica
SET linha_overrides = jsonb_set(
  coalesce(linha_overrides, '{}'::jsonb),
  '{vespertino:caZ7Ttttd5YUQ5ou4xs9bAT0K0e2}',
  jsonb_build_object(
    'assumidaPor', jsonb_build_object(
      'uid', 'gPm15b0LbSNSUHS25MENZAIbnL23',
      'nome', 'GABRIELA CITRON VEDANA',
      'de', jsonb_build_object('uid', 'caZ7Ttttd5YUQ5ou4xs9bAT0K0e2', 'nome', 'RAFAEL PELISSARO'),
      'tipo', 'posicoes',
      'casoIds', '[]'::jsonb,
      'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
      'em', '2026-09-01T15:20:00.000Z'
    ),
    'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
    'em', '2026-09-01T15:20:00.000Z'
  )
)
WHERE id = '0a704138-9f55-4760-95db-b85fd7fa59be';

-- Unimed vespertino: slot da GABRIELA → RAFAEL assume
UPDATE escala_cirurgica
SET linha_overrides = jsonb_set(
  coalesce(linha_overrides, '{}'::jsonb),
  '{vespertino:gPm15b0LbSNSUHS25MENZAIbnL23}',
  jsonb_build_object(
    'assumidaPor', jsonb_build_object(
      'uid', 'caZ7Ttttd5YUQ5ou4xs9bAT0K0e2',
      'nome', 'RAFAEL PELISSARO',
      'de', jsonb_build_object('uid', 'gPm15b0LbSNSUHS25MENZAIbnL23', 'nome', 'GABRIELA CITRON VEDANA'),
      'tipo', 'posicoes',
      'casoIds', '[]'::jsonb,
      'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
      'em', '2026-09-01T15:20:00.000Z'
    ),
    'por', 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
    'em', '2026-09-01T15:20:00.000Z'
  )
)
WHERE id = '717d8ea9-c660-44f6-a999-a1592654fb51';
