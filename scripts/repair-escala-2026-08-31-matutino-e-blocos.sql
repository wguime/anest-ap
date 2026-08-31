-- Reparo de DADO (não é migration de schema) — continuação da auditoria de
-- 31/08. O repair do dono cobriu o VESPERTINO; a medição no banco (60 dias,
-- scripts/diag-escala-leitura-60d.mjs + queries de assinatura) mostrou que a
-- MATUTINA de 31/08 tem os MESMOS dois defeitos, e que o defeito do bloco vinha
-- se repetindo desde 18/08 sem ninguém reportar.
--
-- 1. Consultórios da Unimed, matutino de 31/08: os dois cards saíram com o nome
--    do OUTRO anestesista na coluna do cirurgião (JANAINA com "RODNEI"; GARIM
--    com o próprio "GARIM" copiado da vizinha). Consultório não tem cirurgião —
--    a mesma regra do repair vespertino (#5 e #6 de lá).
--
-- 2. Sala de seção-clínica com bloco 'normal' (defeito nº 2 do vespertino, em
--    série): 13 casos "IOSC" e 1 "Hospital de Olhos" publicados com bloco
--    'normal' entre 18/08 e a matutina de 31/08 — o caso some do agrupamento
--    por seção no quadro. O guardrail R1 (`normalizarCasosHro`, commit ebfacdd)
--    impede novos; isto conserta o dado que ficou para trás — inclusive para as
--    medições futuras de marca por hospital (`escalaHospitalEstrutura` foi
--    calibrada medindo exatamente estas colunas).
--
-- 3. 29/07, HRO: caso com bloco 'ccoluna' e sala "Sala 6" — o inverso do nº 2
--    (bloco certo, sala interna da clínica). A sala do Centro de Coluna é o
--    nome da seção, nunca a numérica do HRO.
--
-- Seguro por construção (mesma verificação do repair vespertino): os triggers
-- de negócio são `UPDATE OF status_extra/convenio/paciente_iniciais` e
-- `UPDATE OF status_cirurgia/status_extra`; `bloco`, `sala` e `cirurgiao` não
-- estão nessas listas. Os consultórios de 31/08 estão 'terminada' (turno
-- encerrado). Idempotente: cada update casa pelo valor ERRADO.

-- 1. Consultórios da matutina de 31/08 — cirurgião não existe em consultório
update public.escala_cirurgica_caso
   set cirurgiao = null
 where id in ('df8fa380-88f9-40f8-a157-6f27740d4918', '1a6ebd9d-fcf1-40ba-8f26-02e92dfe7864')
   and bloco = 'consultorio'
   and cirurgiao is not null;

-- 2a. Sala IOSC com bloco 'normal' → bloco 'iosc' (13 casos, 18/08 a 31/08)
update public.escala_cirurgica_caso
   set bloco = 'iosc'
 where sala = 'IOSC'
   and bloco = 'normal';

-- 2b. Hospital de Olhos com bloco 'normal' → bloco 'ho' (1 caso, 18/08)
update public.escala_cirurgica_caso
   set bloco = 'ho'
 where sala = 'Hospital de Olhos'
   and bloco = 'normal';

-- 3. 29/07: bloco 'ccoluna' com a sala interna da clínica → nome da seção
update public.escala_cirurgica_caso
   set sala = 'Centro de Coluna'
 where id = (
   select c.id from public.escala_cirurgica_caso c
   join public.escala_cirurgica e on e.id = c.escala_id
   where e.data = '2026-07-29' and e.hospital = 'hro'
     and c.bloco = 'ccoluna' and c.sala = 'Sala 6' and c.anestesista = 'GIOVANA'
 )
 and sala = 'Sala 6';
