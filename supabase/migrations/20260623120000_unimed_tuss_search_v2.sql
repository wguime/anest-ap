-- ==========================================================================
-- 20260623120000_unimed_tuss_search_v2.sql
-- Correção da deny-list de busca (auditoria 2026-06-22, docs/revisao-codificacao-anestesica-relatorio.md).
--
-- Substitui a curadoria de 20260622160000. Dois princípios:
--
-- 1) NUNCA excluir um código que tem `indicador_anestesico` — ele é um ato
--    anestésico faturável (paga embutida) e PRECISA ser localizável. A versão
--    anterior ocultava 20104170 (eletroconvulsoterapia, sob anestesia, ind=A) e
--    20104340 (cateterismo de canais ejaculadores, ind=B) por estarem no capítulo
--    HM 2010. O guard `t.indicador_anestesico is null` resolve isso e é à prova de
--    futuro (qualquer código anestesiável sempre aparece).
--
-- 2) Liberados da deny-list (eram exclusões duvidosas — exames sedáveis em
--    pediatria / não-colaborativos, coerentes com as recomendações 31602320/304):
--      SADT 4070/4071 — medicina nuclear IN-VIVO (cintilografia, angiografia
--        radioisotópica, fluxo sanguíneo). A v1 rotulou como "in-vitro" por engano;
--        82+11 códigos, ~quase todos imagem/funcional in-vivo. → 31602320.
--      SADT 4010 — neurofisiologia/oftalmo funcional (potencial evocado,
--        eletroneuromiografia, eletro-retinografia). Sedáveis em criança. → 31602304.
--
-- Mantidos na deny-list (nunca sob anestesia): análises clínicas/patologia/
-- genética/toxicologia/lab e atendimentos clínicos.
--   SADT: 4030/4031/4032 (análises clínicas), 4050 (genética), 4060 (anatomia
--         patológica), 4140 (imuno/alergia lab), 4040 (acompanhamento clínico/dia),
--         2020 (fisiatria), 2240 (toxicologia), 2250 (assist. farmacêutica),
--         5000 (reabilitação/psico/fono).
--   HM:   1010 (consultas/transporte), 2010 (acompanhamentos clínicos — agora só
--         os SEM indicador), 2020, 2210 (visita domicílio), 2220 (reabilitação).
-- ==========================================================================

create extension if not exists unaccent;

create or replace function public.search_unimed_tuss(p_q text, p_limit int default 25)
returns setof public.unimed_tuss_codigos
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select
      nullif(btrim(unaccent(lower(coalesce(p_q, '')))), '') as norm,
      regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as digits,
      (coalesce(p_q, '') ~ '^[0-9 .\-]+$') as numeric_only
  )
  select t.*
  from public.unimed_tuss_codigos t, q
  where q.norm is not null
    and char_length(q.norm) >= 2
    -- curadoria: exclui capítulos sem relação cirúrgica/anestésica (por lista),
    -- MAS nunca um código que tem indicador anestésico (é faturável → tem de aparecer)
    and not (
      t.indicador_anestesico is null
      and (
        (t.lista = 'SADT' and substring(t.codigo, 1, 4) = any (array[
          '4030','4031','4032','4050','4060','4140','4040','2020','2240','2250','5000'
        ]))
        or
        (t.lista = 'HM' and substring(t.codigo, 1, 4) = any (array[
          '1010','2010','2020','2210','2220'
        ]))
      )
    )
    and (
      (q.numeric_only and char_length(q.digits) >= 2 and t.codigo like q.digits || '%')
      or
      (not q.numeric_only and unaccent(lower(t.descricao)) like all (
        select '%' || w || '%' from unnest(string_to_array(q.norm, ' ')) w where w <> ''
      ))
      or
      (not q.numeric_only and char_length(q.digits) >= 2 and t.codigo like q.digits || '%')
    )
  order by
    (char_length(q.digits) >= 2 and t.codigo like q.digits || '%') desc,
    char_length(t.descricao),
    t.codigo
  limit greatest(1, least(coalesce(p_limit, 25), 50));
$$;

grant execute on function public.search_unimed_tuss(text, int) to authenticated;
