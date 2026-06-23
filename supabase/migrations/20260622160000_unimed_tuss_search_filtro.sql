-- ==========================================================================
-- 20260622160000_unimed_tuss_search_filtro.sql
-- Curadoria de auditor médico: a busca da Codificação Anestésica deve mostrar
-- só procedimentos com relação cirúrgica/anestésica. Exclui (por capítulo TUSS,
-- qualificado por lista) análises clínicas/patologia/genética/funcionais e
-- atendimentos clínicos — que NUNCA são feitos sob anestesia.
--
-- Deny-list (editável):
--   SADT: 4030/4031/4032 (análises clínicas/patologia), 4050 (genética),
--         4060 (anatomia patológica), 4070/4071 (lab/medicina nuclear in-vitro),
--         4140 (imuno/alergia lab), 4010 (oftalmo/neurofisio funcional),
--         4040 (acompanhamento clínico/dia), 2020 (fisiatria), 2240 (toxicologia),
--         2250 (assist. farmacêutica), 5000 (reabilitação/psico/fono).
--   HM:   1010 (consultas/transporte), 2010/2020 (acompanhamentos clínicos),
--         2210 (visita domicílio), 2220 (reabilitação).
-- Mantém: HM cirúrgico (3xxx), SADT imagem/endoscopia/radioterapia/procedimento
--   (2010 radioterapia, 4020, 4080/4081/4090/4100/4110/4120/4130/4150) e 31602.
-- O prefixo 2010 colide (SADT radioterapia vs HM acompanhamento) → deny por lista.
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
    -- curadoria: exclui capítulos sem relação cirúrgica/anestésica (por lista)
    and not (
      (t.lista = 'SADT' and substring(t.codigo, 1, 4) = any (array[
        '4030','4031','4032','4050','4060','4070','4071','4140','4010','4040','2020','2240','2250','5000'
      ]))
      or
      (t.lista = 'HM' and substring(t.codigo, 1, 4) = any (array[
        '1010','2010','2020','2210','2220'
      ]))
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
