-- ════════════════════════════════════════════════════════════════════════
-- 20261118120000_ferias_marcacao_todos_socios.sql
-- Regras de férias 2026/27 (V-01): a marcação passa a ser só no app, então
-- TODOS os sócios marcam as próprias férias (dono 18/11/2026). Antes eram 5
-- e-mails. Os 46 sócios casaram 1:1 com profiles por nome e e-mail.
--
-- ESPELHA EMAIL_TO_SOCIO de src/pages/ferias/gate.js (e o da edge api-v1).
-- Paridade travada em src/__tests__/pages/extratoFeriasGate.test.js.
-- Idempotente (create or replace).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create or replace function public.ferias_nome_socio()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case lower(trim(coalesce(p.email, '')))
    when 'mtcury19@gmail.com' then 'MARCOS TADEU CURY'
    when 'raperizzolo@gmail.com' then 'RAUL PERIZZOLO'
    when 'dallmagro@hotmail.com' then 'ADRIANO DALL´MAGRO'
    when 'vicentepons4@gmail.com' then 'VICENTE PONS'
    when 'dezembro71@hotmail.com' then 'MAURICIO MAHALEM BASTOS'
    when 'rosecury64@gmail.com' then 'ROSEMARY CURY'
    when 'eclampsium@yahoo.com.br' then 'HUMBERTO HEPP'
    when 'rodneilima@gmail.com' then 'RODNEI CABRAL LIMA'
    when 'marcoscc1211@gmail.com' then 'MARCOS CARDOSO COSTA'
    when 'schneiderraquel17@gmail.com' then 'RAQUEL SCHNEIDER'
    when 'alineanestesio@gmail.com' then 'ALINE BOFF BONFANTE'
    when 'gustavogarim@hotmail.com' then 'GUSTAVO ALMANSA GARIM'
    when 'oscarmorais3@hotmail.com' then 'OSCAR AUGUSTO DE OLIVEIRA MORAIS'
    when 'janafavorito@gmail.com' then 'JANAINA SANCHES FAVORITO MORAIS'
    when 'diegobori@hotmail.com' then 'DIEGO B. RIGOTTI'
    when 'guollofernanda@gmail.com' then 'FERNANDA GUOLLO'
    when 'gabicvedana@gmail.com' then 'GABRIELA CITRON VEDANA'
    when 'robertagrando@yahoo.com.br' then 'ROBERTA MARINA GRANDO'
    when 'gustavoo_b@hotmail.com' then 'GUSTAVO BIESDORF'
    when 'leoferrazzo@gmail.com' then 'LEONARDO FERRAZZO'
    when 'mariliojosef@hotmail.com' then 'MARILIO JOSÉ FLACH'
    when 'fhm555@gmail.com' then 'FERNANDO HENRIQUE MACHADO'
    when 'leandrobernardes03@hotmail.com' then 'LEANDRO BERNARDES'
    when 'cristinabertolb@gmail.com' then 'CRISTINA BERTOL BARBOSA MARCON'
    when 'tiagoiopviana@gmail.com' then 'TIAGO IOP VIANA'
    when 'wguime@yahoo.com.br' then 'G. MELO'
    when 'anestesista.guilherme@gmail.com' then 'G. MELO'
    when 'paulotmed@gmail.com' then 'PAULO TONINI'
    when 'guigostaub@hotmail.com' then 'G. STAUB'
    when 'alexandre_danieli@yahoo.com.br' then 'A. DANIELI'
    when 'joaormoreiraster@gmail.com' then 'JOÃO RICARDO MOREIRA'
    when 'alexandre.schmidt82@gmail.com' then 'A. SCHMIDT'
    when 'klismandrescherhilleshein@gmail.com' then 'KLISMAN DRESCHER HILLESHEIN'
    when 'giovanagomes.noll@gmail.com' then 'GIOVANA GOMES NOLL'
    when 'edusavoldi@gmail.com' then 'EDUARDO SAVOLDI'
    when 'louisemwarnava@yahoo.com.br' then 'LOUISE MACAGNAN WARNAVA'
    when 'dormatheuscunha@gmail.com' then 'MATHEUS VIEIRA DA CUNHA'
    when 'thayna_santos9@hotmail.com' then 'THAYNÁ REGINA SANTOS'
    when 'erlei@clinicacastelo.com.br' then 'ERLEI PERINI'
    when 'gabrieljkc@gmail.com' then 'GABRIEL JUAN KETTENHUBER COSTA'
    when 'karine.bedin9@gmail.com' then 'KARINE BEDIN'
    when 'rafaelpelissaro@gmail.com' then 'RAFAEL PELISSARO'
    when 'romulo_roxos@hotmail.com' then 'ROMULO SANTOS ROXO'
    when 'joaohvanni@hotmail.com' then 'JOAO HENRIQUE SALVAO VANNI'
    when 'guilhermexavier.d@gmail.com' then 'GUILHERME XAVIER DI DOMENICO'
    when 'danikreis@gmail.com' then 'DANIELA KLEIN REIS'
    when 'nathaliafornarifernandes@gmail.com' then 'NATHALIA FORNARI FERNANDES'
    else null
  end
  from public.profiles p
  where p.id = public.firebase_uid()
    and p.active is not false
$$;

revoke execute on function public.ferias_nome_socio() from public, anon;
grant execute on function public.ferias_nome_socio() to authenticated, service_role;

comment on function public.ferias_nome_socio() is
  'Nome do sócio no Pega Plantão do usuário corrente, pelo e-mail — todos os sócios desde 18/11/2026 (regra V-01). Espelha EMAIL_TO_SOCIO de src/pages/ferias/gate.js; usado no WITH CHECK de ferias_movimentacoes para ninguém marcar férias em nome de outro.';

COMMIT;
