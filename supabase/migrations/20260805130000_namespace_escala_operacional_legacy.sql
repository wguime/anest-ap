-- Isola dados operacionais legados por turno.
-- Antes da publicação transacional (2026-08-04), liberacoes/overrides eram mapas
-- planos. Casos sem turno eram matutinos; portanto, chaves sem namespace são
-- migradas para matutino, evitando que a publicação vespertina reutilize uma
-- troca/liberação feita pela manhã.
do $$
declare
  r record;
  k text;
  v jsonb;
  novo jsonb;
begin
  for r in select id, liberacoes, linha_overrides from public.escala_cirurgica loop
    novo := '{}'::jsonb;
    for k, v in select * from jsonb_each(case when jsonb_typeof(coalesce(r.liberacoes,'{}'))='object' then r.liberacoes else '{}'::jsonb end) loop
      novo := jsonb_set(novo, array[case when k like 'matutino:%' or k like 'vespertino:%' or k like 'noite:%' then k else 'matutino:' || k end], v, true);
    end loop;
    update public.escala_cirurgica set liberacoes = novo where id = r.id;

    novo := '{}'::jsonb;
    for k, v in select * from jsonb_each(case when jsonb_typeof(coalesce(r.linha_overrides,'{}'))='object' then r.linha_overrides else '{}'::jsonb end) loop
      novo := jsonb_set(novo, array[case when k like 'matutino:%' or k like 'vespertino:%' or k like 'noite:%' then k else 'matutino:' || k end], v, true);
    end loop;
    update public.escala_cirurgica set linha_overrides = novo where id = r.id;
  end loop;
end $$;

comment on column public.escala_cirurgica.liberacoes is
  'Mapa namespaced por turno: matutino:chave, vespertino:chave, noite:chave.';
comment on column public.escala_cirurgica.linha_overrides is
  'Mapa namespaced por turno: matutino:chave, vespertino:chave, noite:chave.';
