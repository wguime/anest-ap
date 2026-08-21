-- ═══════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — rótulo CURTO de sala do HRO nas escalas de 20 e 21/08
--
-- PORQUÊ: em 20/08 a normalização passou a gravar o bloco e o papel no rótulo
-- ("Bloco A - Sala 7 - CO"). Em 21/08 o dono reverteu — "ficou muito poluído":
-- a sala se repete na pastilha de cada faixa do quadro, no card de cada pessoa
-- da fila e nos cards da faixa de urgências, e três informações no mesmo rótulo
-- espremeram o resto. O código já voltou a gravar "Sala N"; esta migration
-- conserta as DUAS escalas importadas na janela em que a versão longa esteve no
-- ar, que é o que a equipe tem na tela hoje.
--
-- ESCOPO: `data >= 2026-08-20`, hospital 'hro'. As escalas anteriores NÃO são
-- tocadas — lá o rótulo já é curto (e os "Sala 7 - CO" históricos vieram da
-- leitura do mapa, não desta janela). `chaveSalaHro` no app dá a mesma
-- identidade às três grafias, então nada depende desta reescrita para funcionar;
-- ela existe para a TELA dizer a mesma coisa que a lista de escolha.
--
-- SEGURANÇA: `sala` é rótulo de exibição e chave de AGRUPAMENTO no quadro. Nada
-- mais aponta para ela: `liberacoes` e `linha_overrides` são chaveados pelo
-- anestesista, `ordem_liberacao` não é tocada, não há FK. `urgencias_meta` guarda
-- sala marcada e é normalizado junto, para a marcação continuar casando com o
-- caso. Idempotente: rótulo já curto não casa o regex.
--
-- ANTES (consulta de 21/08 11:53 BRT):
--   20/08 → 'Bloco A - Sala 1' (1), 'Sala 7 - CO' (1)
--   21/08 → 'Bloco A - Sala 1' (1), '… Sala 2' (1), '… Sala 3' (2),
--           '… Sala 4' (3), '… Sala 5 - Emergência' (1), '… Sala 6' (3),
--           '… Sala 7 - CO' (3), '… Sala 8' (3), '… Sala 9' (3)
--   urgencias_meta 20/08 vespertino.plantao = 'Bloco A - Sala 1'
-- ═══════════════════════════════════════════════════════════════════════════

-- Rótulo curto: tira o bloco A implícito e o papel colado no número.
-- 'Bloco A - Sala 5 - Emergência' → 'Sala 5' · 'Sala 7 - CO' → 'Sala 7'
-- 'Bloco M - Sala 1' → intacto (lá o bloco NÃO é implícito: é o que separa a
-- sala 1 do materno da sala 1 do bloco A). 'IOSC', 'Exames' → intactos.
create or replace function pg_temp.fn_sala_hro_curta(p_sala text)
returns text language sql immutable as $$
  select case
    when p_sala ~ '^(Bloco A - )?Sala [0-9]+'
      then regexp_replace(p_sala, '^(Bloco A - )?(Sala [0-9]+).*$', '\2')
    else p_sala
  end
$$;

update escala_cirurgica_caso c
   set sala = pg_temp.fn_sala_hro_curta(c.sala)
  from escala_cirurgica e
 where e.id = c.escala_id
   and e.hospital = 'hro'
   and e.data >= date '2026-08-20'
   and c.sala is distinct from pg_temp.fn_sala_hro_curta(c.sala);

-- urgencias_meta: { matutino: { orto, co, plantao, sobreaviso }, vespertino: {…} }
-- Só os quatro campos de SALA são reescritos; `por`/`em` (auditoria server-side)
-- ficam como estão.
do $$
declare
  r record;
  meta jsonb;
  turno text;
  campo text;
  valor text;
begin
  for r in
    select id, urgencias_meta
      from escala_cirurgica
     where hospital = 'hro'
       and data >= date '2026-08-20'
       and urgencias_meta is not null
       and urgencias_meta <> '{}'::jsonb
  loop
    meta := r.urgencias_meta;
    foreach turno in array array['matutino', 'vespertino'] loop
      if meta ? turno then
        foreach campo in array array['orto', 'co', 'plantao', 'sobreaviso'] loop
          valor := meta -> turno ->> campo;
          if valor is not null and valor <> '' then
            meta := jsonb_set(
              meta,
              array[turno, campo],
              to_jsonb(pg_temp.fn_sala_hro_curta(valor)),
              false
            );
          end if;
        end loop;
      end if;
    end loop;
    if meta is distinct from r.urgencias_meta then
      update escala_cirurgica set urgencias_meta = meta where id = r.id;
    end if;
  end loop;
end $$;
