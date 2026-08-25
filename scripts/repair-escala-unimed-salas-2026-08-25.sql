-- Reparo de DADO (não é migration de schema): rótulos de sala da Unimed no
-- feriado de 25/08/2026.
--
-- Relato do dono: "na escala Unimed não está saindo com a Sala, está aparecendo
-- apenas um número abaixo do nome do hospital". O mapa do feriado rotulou a
-- coluna só com o número ("6") e o normalizador da importação não conhecia essa
-- forma, então o texto cru foi publicado. A regra foi corrigida em
-- `normalizarSalaUnimed`, mas a escala JÁ publicada precisa do reparo — e
-- reimportar zeraria as liberações do turno em pleno feriado.
--
-- Só a coluna `sala`, só esta data, só a Unimed. É seguro por construção:
--   · os dois triggers de negócio da tabela são `UPDATE OF` colunas específicas
--     (status_extra/convenio/paciente_iniciais e status_cirurgia/status_extra),
--     então um update de sala não cria evento nem mexe em cobrança;
--   · o `local` de `cirurgias_particulares` é o HOSPITAL ("Unimed"), nunca a sala;
--   · `liberacoes` e `linha_overrides` são chaveados por PESSOA, não por sala;
--   · `update_updated_at` dispara, que é o que faz o realtime levar a correção
--     para quem está com a tela aberta.
-- Idempotente: rodar de novo não casa nada.
update public.escala_cirurgica_caso c
   set sala = m.novo
  from public.escala_cirurgica e,
       (values ('1','CC - Sala 1'), ('2','CC - Sala 2'), ('3','CC - Sala 3'),
               ('4','CC - Sala 4'), ('5','CC - Sala 5'), ('6','CC - Sala 6'),
               ('7','CC - Sala 7'), ('10 ROBOTICA','CC - Sala 10')) as m(velho, novo)
 where e.id = c.escala_id
   and e.hospital = 'unimed'
   and e.data = date '2026-08-25'
   and c.sala = m.velho;
