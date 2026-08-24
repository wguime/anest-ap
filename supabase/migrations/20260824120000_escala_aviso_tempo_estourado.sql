-- ============================================================================
-- Escala Cirúrgica — dedup do aviso de "tempo estourado" (dono 2026-08-24)
--
-- Pedido: "após terminar o tempo estabelecido, quero que o usuário receba uma
-- mensagem para atualizar o tempo (caso o procedimento não tenha terminado)".
-- O aviso tem duas metades: o estado ÂMBAR no card (100% na tela, sem banco) e
-- um PUSH para a pessoa do cronômetro.
--
-- Esta tabela existe só por causa da segunda metade. O push é disparado pelo
-- CLIENTE — pelo aparelho de quem estiver com a aba Liberações aberta —, e num
-- turno normal há várias telas abertas ao mesmo tempo. Sem uma trava atômica,
-- cada uma mandaria a sua push e a pessoa receberia o mesmo aviso 3, 4 vezes.
--
-- A trava é a PK: `upsert ... ignoreDuplicates` (que o PostgREST traduz para
-- `ON CONFLICT DO NOTHING`) e só dispara a push quem conseguiu inserir a linha.
-- É atômico no banco, então não há corrida — ao contrário de "ler um marcador e
-- depois gravar", que tem janela entre as duas operações.
--
-- `alvo` (o "HH:MM" que estourou) entra na chave DE PROPÓSITO: se alguém
-- atualizar o tempo — que é exatamente o que o aviso pede — o novo horário gera
-- uma chave nova, e o aviso volta a valer quando ESSE horário estourar. Com a
-- chave só em (escala, turno, pessoa), o segundo estouro do dia ficaria mudo.
-- ⚠️ o que NÃO rearma é repetir o MESMO horário (typo corrigido de volta, ou
-- republicação do turno, que zera `linha_overrides` e faz redigitar o mesmo
-- valor): a linha já existe. Trade-off consciente — versionar o override na
-- chave resolveria, ao custo de uma coluna que ninguém mais usa.
--
-- ⚠️ RELAÇÃO COM "a escala não notifica desde 30/07": não é regressão daquela
-- decisão. O que foi cortado em 30/07 eram 6 avisos automáticos POR EVENTO que
-- criavam linha na INBOX (99 não lidas em 23 pessoas). Aqui não se cria linha na
-- inbox nenhuma — é só push, para UMA pessoa, sobre um horário que ela mesma
-- informou, e só chega a quem ativou notificação (35 dos 71 perfis em 24/08).
--
-- Não guarda dado de paciente: escala, turno, a chave da linha (uid do vínculo
-- ou nome normalizado, a mesma de `linha_overrides`) e um horário.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.escala_cirurgica_aviso_tempo;
--   DROP FUNCTION IF EXISTS public.fn_escala_aviso_tempo_audit();
-- ============================================================================
BEGIN;

-- A FK abaixo pede SHARE ROW EXCLUSIVE em `escala_cirurgica`, que conflita com o
-- ROW EXCLUSIVE de qualquer publicação em voo. A validação é instantânea (tabela
-- nova, vazia), mas sem timeout a migration ESPERA a publicação e enfileira os
-- escritores seguintes atrás dela — numa manhã de importação isso é a diferença
-- entre milissegundos e um travamento visível. Falhar rápido e repetir é melhor.
SET LOCAL lock_timeout = '3s';

-- ⚠️ `IF NOT EXISTS` sozinho silenciaria uma tabela pré-existente com outro
-- formato: os CHECKs e a PK não seriam aplicados, a migration diria sucesso e a
-- dedup deixaria de ser atômica sem nenhum sinal. Aqui a PK É a trava, então o
-- formato é conferido logo abaixo.
CREATE TABLE IF NOT EXISTS public.escala_cirurgica_aviso_tempo (
  escala_id   uuid        NOT NULL REFERENCES public.escala_cirurgica(id) ON DELETE CASCADE,
  -- 'noturno' entra pelo mesmo motivo da tabela irmã do recado: no fim de semana
  -- a noite é turno de TELA, e o chamador passa o turno exibido.
  turno       text        NOT NULL CHECK (turno IN ('matutino', 'vespertino', 'noturno')),
  -- chave da linha da fila (uid do vínculo ou nome normalizado). O teto protege
  -- a entrada do índice da PK; o piso impede duas pessoas colidirem em ''.
  chave       text        NOT NULL CHECK (char_length(btrim(chave)) BETWEEN 1 AND 200),
  -- MESMO regex de `escala_cirurgica_caso.termino_previsto` (migration
  -- 20260729210000) e do `horaCompleta` do PainelTempo: '24:00' não é hora.
  alvo        text        NOT NULL CHECK (alvo ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  enviado_por text,
  PRIMARY KEY (escala_id, turno, chave, alvo)
);

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY k.ord)
    INTO cols
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
   WHERE c.conrelid = 'public.escala_cirurgica_aviso_tempo'::regclass
     AND c.contype = 'p';
  IF cols IS DISTINCT FROM 'escala_id,turno,chave,alvo' THEN
    RAISE EXCEPTION 'escala_cirurgica_aviso_tempo com PK inesperada (%): a PK É a trava de dedup', cols;
  END IF;
END $$;

COMMENT ON TABLE public.escala_cirurgica_aviso_tempo IS
  'Trava de envio único do aviso "tempo estourado" (dono 24/08). Uma linha por '
  '(escala, turno, linha da fila, horário-alvo): quem insere é quem manda a push. '
  'Atualizar o tempo cria chave nova e rearma o aviso.';

-- Autoria server-side, como no recado do plantonista: o cliente não escolhe quem
-- consta como remetente — por isso é atribuição DURA, não coalesce com o que
-- veio no payload.
-- ⚠️ SECURITY DEFINER + search_path fixo é a convenção do repo (anti-takeover,
-- ver 20260520210000). NUNCA colocar efeito colateral aqui: o BEFORE INSERT roda
-- TAMBÉM para as linhas que o DO NOTHING vai descartar, então mandar a push de
-- dentro do banco reintroduziria exatamente a duplicação que a tabela impede.
CREATE OR REPLACE FUNCTION public.fn_escala_aviso_tempo_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.enviado_por := nullif(public.firebase_uid(), '');
  NEW.enviado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_escala_aviso_tempo_audit ON public.escala_cirurgica_aviso_tempo;
CREATE TRIGGER tr_escala_aviso_tempo_audit
  BEFORE INSERT ON public.escala_cirurgica_aviso_tempo
  FOR EACH ROW EXECUTE FUNCTION public.fn_escala_aviso_tempo_audit();

-- ── RLS ────────────────────────────────────────────────────────────────
-- Mesmo predicado do resto do módulo (papel, não pessoa).
ALTER TABLE public.escala_cirurgica_aviso_tempo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_cirurgica_aviso_tempo FORCE ROW LEVEL SECURITY;

-- ⚠️ NÃO é policy órfã: ninguém consulta esta tabela, mas o cliente usa
-- `.select('chave')` para saber se a inserção aconteceu de fato — é assim que
-- ele descobre que ganhou a corrida. Sem SELECT o vencedor receberia
-- representação vazia e a push NUNCA sairia.
DROP POLICY IF EXISTS "escala_aviso_tempo_select" ON public.escala_cirurgica_aviso_tempo;
CREATE POLICY "escala_aviso_tempo_select" ON public.escala_cirurgica_aviso_tempo
  FOR SELECT TO authenticated
  USING ((select public.can_write_escala_cirurgica()));

DROP POLICY IF EXISTS "escala_aviso_tempo_insert" ON public.escala_cirurgica_aviso_tempo;
CREATE POLICY "escala_aviso_tempo_insert" ON public.escala_cirurgica_aviso_tempo
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_escala_cirurgica()));

-- Sem UPDATE e sem DELETE: é um registro de "já avisei", e reescrevê-lo só
-- serviria para avisar de novo. Rearmar o aviso é o que a atualização do tempo
-- já faz sozinha, pela chave. ⚠️ se algum dia o DO NOTHING virar DO UPDATE,
-- passa a exigir policy de UPDATE — e o INSERT começaria a falhar com 42501.

-- Retenção: ~1 linha por cronômetro estourado por dia. O CASCADE da escala já
-- limpa junto quando um cabeçalho é removido (`removeEscala` existe e é usado).

COMMIT;
