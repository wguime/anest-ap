-- ==========================================================================
-- 20260624120000_fix_indicador_a_e_diu.sql
-- Auditoria v2026.03 (docs/codificacao-anestesica-v2026.03-analise.md):
--   1) Corrige o resíduo do indicador A: a planilha HM 2025.05 fixou A = R$150
--      (arredondamento legado); a tabela oficial 4.1 da v2026.03 define A = 128 UTM
--      ⇒ 128 × 1,17 = 149,76 (intercâmbio). Afeta 2 linhas (20104170 ECT, 31602312).
--   2) Insere 2 códigos HM (ginecologia) da lista oficial 4.3.2 ausentes do seed
--      (planilhas anteriores à v2026.03): remoção de DIU hormonal/não-hormonal. Sem eles a busca
--      não os encontra e a recomendação 31602312 (item 4.3.2) nunca dispara.
-- Idempotente: UPDATE com predicado de valor; INSERT com ON CONFLICT DO NOTHING.
-- ==========================================================================

update public.unimed_tuss_codigos
   set valor_anestesista = 149.76,
       updated_at = now()
 where indicador_anestesico = 'A'
   and valor_anestesista = 150;

insert into public.unimed_tuss_codigos
  (codigo, descricao, lista, cobertura, indicador_anestesico, valor_anestesista,
   valor_cirurgiao, porte_cirurgico, porte_anestesico, numero_auxiliares, classificacao, documentacao)
values
  ('31303374', 'Implante de dispositivo intra-uterino (DIU) hormonal - remoção', 'HM', 'coberto',
   null, null, null, null, null, null, null, null),
  ('31303382', 'Implante de dispositivo intra-uterino (DIU) não hormonal - remoção', 'HM', 'coberto',
   null, null, null, null, null, null, null, null)
on conflict (codigo) do nothing;
