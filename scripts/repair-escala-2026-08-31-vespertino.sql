-- Reparo de DADO (não é migration de schema): 4 defeitos da leitura na escala
-- VESPERTINA de 31/08/2026, conferidos linha a linha contra os três documentos
-- que o dono anexou ("ao publicar a escala de hoje a tarde ela ficou com vários
-- erros... corrija as escalas publicadas sem perder as informações").
--
-- Reimportar não serve: zeraria liberações, tempos e overrides de um turno em
-- andamento — inclusive a troca Rodnei⇄Janaína e os términos já informados.
--
-- HRO — a SEÇÃO IOSC perdida na 2ª e na 3ª linha:
--   · a 2ª linha do IOSC (Persio Beatto, 15:15, Luiz Silva, Túnel do Carpo) veio
--     com a sala INTERNA da clínica ("Sala 2") em vez do rótulo da seção, e por
--     isso o "//" da coluna ANEST herdou o anestesista da Sala 2 do HRO (Daniela)
--     em vez do da própria seção (Fernando). É o erro de 24/07 de novo: linha de
--     outra clínica caindo dentro de uma sala do HRO, com o anestesista errado.
--   · a 3ª linha (Francyeli Gusberti, Maurício) acertou a sala e errou o bloco.
--
-- Unimed — Diego e Fernanda TROCADOS entre Exames e Imagem: o documento põe
-- Fernanda na 1ª linha de Exames (cirurgião Giovani) e Diego na Imagem
-- (continuação +-18h). Os dois estão no rodapé, então nenhum guardrail pegou.
--
-- Unimed — os dois CONSULTÓRIOS saíram com o nome do OUTRO na coluna do
-- cirurgião (o card do Paulo dizia "Klisman" e vice-versa). Consultório não tem
-- cirurgião: o campo volta a ficar vazio.
--
-- Seguro por construção (triggers conferidos no banco hoje): os dois de negócio
-- são `UPDATE OF status_extra/convenio/paciente_iniciais` e `UPDATE OF
-- status_cirurgia/status_extra`; nenhuma coluna tocada aqui está nessas listas.
-- Só `update_updated_at` dispara — que é justamente o que leva a correção pelo
-- realtime a quem está com a tela aberta. Os 6 casos estão em 'agendada'
-- (nada em andamento). `liberacoes` e `linha_overrides` são chaveados por
-- PESSOA e não são tocados.
--
-- Idempotente: cada update casa pelo valor ERRADO, então rodar de novo não faz nada.

-- 1. IOSC, 2ª linha: sala, bloco e o anestesista que o "//" herdou errado
update public.escala_cirurgica_caso
   set sala = 'IOSC',
       bloco = 'iosc',
       anestesista = 'FERNANDO',
       anestesista_user_id = '8SHFqmqx6edcDgbTCLBgPFPESft2'
 where id = '9c4224ce-e87e-426b-a5f3-6889adde8c37'
   and sala = 'Sala 2'
   and anestesista = 'DANIELA';

-- 2. IOSC, 3ª linha: sala já estava certa, o bloco não
update public.escala_cirurgica_caso
   set bloco = 'iosc'
 where id = 'ccaaf111-35a2-4239-a965-a7f0a6cc9d4e'
   and sala = 'IOSC'
   and bloco = 'normal';

-- 3. Unimed, Exames (cirurgião Giovani): é da Fernanda
update public.escala_cirurgica_caso
   set anestesista = 'FERNANDA',
       anestesista_user_id = 'XdcnZANVhQZCo0KRTcG9CbJ1MOs2'
 where id = 'c9027e57-3d69-45c7-9def-180297996283'
   and anestesista = 'DIEGO';

-- 4. Unimed, Imagem (continuação +-18h): é do Diego
update public.escala_cirurgica_caso
   set anestesista = 'DIEGO',
       anestesista_user_id = 'DXNcLwh7YAXZYsJSTIW078LZo1C2'
 where id = 'c01d48c9-c3bc-4d8a-8589-6c5267f93eda'
   and anestesista = 'FERNANDA';

-- 5 e 6. Consultório não tem cirurgião — cada card trazia o nome do outro
update public.escala_cirurgica_caso
   set cirurgiao = null
 where id in ('231a7a82-f3ca-459e-9559-6cf581988f62', 'e2090b40-8722-4037-be8f-2bb6d6ea479e')
   and bloco = 'consultorio'
   and cirurgiao is not null;
