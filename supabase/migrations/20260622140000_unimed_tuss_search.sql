-- ==========================================================================
-- 20260622140000_unimed_tuss_search.sql
-- Busca acento-insensível + multi-palavra para a calculadora de codificação.
--
-- Problema: `descricao ilike '%glandula%'` NÃO casa "glândula" (ilike é
-- case-insensitive, mas NÃO accent-insensitive) → busca por nome falhava.
--
-- Solução: extensão unaccent + função search_unimed_tuss(q, limit):
--   - query numérica → prefixo de código;
--   - query texto → TODAS as palavras presentes na descrição (unaccent/lower),
--     ou prefixo de código se houver dígitos.
-- SECURITY INVOKER (default) → respeita a RLS da tabela (select to authenticated).
-- Tabela pequena (~5.4k linhas) → seq scan com unaccent é aceitável.
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
    (char_length(q.digits) >= 2 and t.codigo like q.digits || '%') desc, -- prefixo de código primeiro
    char_length(t.descricao),
    t.codigo
  limit greatest(1, least(coalesce(p_limit, 25), 50));
$$;

grant execute on function public.search_unimed_tuss(text, int) to authenticated;

comment on function public.search_unimed_tuss is
  'Busca de códigos TUSS por prefixo numérico OU nome (acento-insensível, multi-palavra) para a calculadora de codificação anestésica.';
