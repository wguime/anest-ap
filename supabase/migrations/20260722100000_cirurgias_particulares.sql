-- ════════════════════════════════════════════════════════════════════════
-- 20260722100000_cirurgias_particulares.sql
-- Módulo Cirurgias Particulares — cobrança de honorários fora de convênio.
--
-- Registro por cirurgia: paciente, cirurgião, anestesista, data,
-- procedimento, local, valor cobrado (R$) e status de pagamento
-- (pendente/pago/glosado). Relatório por período p/ conferência/auditoria.
--
-- LGPD — nome do paciente + procedimento = dado referente à saúde de pessoa
-- identificada (dado SENSÍVEL, art. 5º II). Base legal primária:
-- art. 11, II, "d" — exercício regular de direitos, inclusive em contrato
-- (cobrança do honorário contra guia/recibo exige o nome completo);
-- suporte: art. 7º V/VI para os dados não-sensíveis do registro. Precedente
-- de nome completo sob RLS restrita: cateteres_peridural.paciente (027).
-- Proteções: RLS por papel (anestesiologista/secretaria/admin), sem policy
-- DELETE (trilha financeira preservada via soft-cancel), nome nunca logado
-- em console/notificação (contrato do service/context no front).
--
-- Vínculo opcional com a Escala Cirúrgica: escala_caso_id referencia
-- escala_cirurgica_caso.id SEM FK — a republicação da escala faz
-- DELETE+reinsert dos casos (ids instáveis; mesmo padrão de referência
-- fraca de escala_cirurgica_evento). O lançamento carrega snapshot
-- completo dos dados e nunca depende da escala existir.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.cirurgias_particulares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dados da cirurgia (snapshot próprio; não depende da escala)
  paciente TEXT NOT NULL,
  cirurgiao TEXT NOT NULL,
  anestesista_nome TEXT NOT NULL,
  anestesista_user_id TEXT,          -- profiles.id quando escolhido do roster (sem FK: registro financeiro não acopla ao perfil)
  data_cirurgia DATE NOT NULL,
  procedimento TEXT NOT NULL,
  local TEXT NOT NULL,
  -- Cobrança
  valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  status_pagamento TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente', 'pago', 'glosado')),
  data_pagamento DATE,
  observacoes TEXT,
  -- Vínculo fraco com a escala do dia (ver header)
  escala_caso_id UUID,
  -- Soft-cancel (lançamento errado nunca é apagado — auditoria financeira)
  cancelada_em TIMESTAMPTZ,
  cancelada_por TEXT,
  cancelada_por_nome TEXT,
  motivo_cancelamento TEXT,
  -- Audit
  created_by TEXT,
  created_by_name TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cirurgias_particulares_data
  ON public.cirurgias_particulares (data_cirurgia DESC);
CREATE INDEX IF NOT EXISTS idx_cirurgias_particulares_status
  ON public.cirurgias_particulares (status_pagamento);
CREATE INDEX IF NOT EXISTS idx_cirurgias_particulares_created_at
  ON public.cirurgias_particulares (created_at DESC);
-- Anti-duplo-lançamento do mesmo caso da escala; cancelado libera re-lançar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cirurgias_particulares_escala_caso
  ON public.cirurgias_particulares (escala_caso_id)
  WHERE escala_caso_id IS NOT NULL AND cancelada_em IS NULL;

-- updated_at automático (função global de 001_schema.sql)
DROP TRIGGER IF EXISTS tr_cirurgias_particulares_updated_at ON public.cirurgias_particulares;
CREATE TRIGGER tr_cirurgias_particulares_updated_at
  BEFORE UPDATE ON public.cirurgias_particulares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.cirurgias_particulares ENABLE ROW LEVEL SECURITY;
-- Defesa em profundidade (padrão escala_cirurgica_evento): RLS vale até p/
-- table owner, e DELETE fica revogado no nível de grant (sem policy já
-- negaria; o revoke torna a intenção explícita e à prova de policy futura).
ALTER TABLE public.cirurgias_particulares FORCE ROW LEVEL SECURITY;
REVOKE DELETE ON public.cirurgias_particulares FROM anon, authenticated;

-- Helper: quem opera cobranças particulares. Grupo todo vê tudo (decisão
-- do dono 2026-07-22): anestesiologista (fatura o próprio honorário) +
-- secretaria (confere cobrança) OU admin. Residente fora (não fatura
-- particular). Mesmo padrão SECURITY DEFINER de can_write_escala_cirurgica().
create or replace function public.can_write_cirurgias_particulares()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and lower(coalesce(p.role, '')) in ('anestesiologista', 'secretaria')
  ) or public.is_admin();
$$;

revoke execute on function public.can_write_cirurgias_particulares() from public, anon;
grant execute on function public.can_write_cirurgias_particulares() to authenticated, service_role;

comment on function public.can_write_cirurgias_particulares() is
  'true se o usuário corrente opera o módulo Cirurgias Particulares (anestesiologista/secretaria OU admin). Leitura e escrita usam o mesmo predicado — o grupo todo vê tudo (decisão do dono 2026-07-22).';

DROP POLICY IF EXISTS "cirurgias_particulares_select" ON public.cirurgias_particulares;
CREATE POLICY "cirurgias_particulares_select" ON public.cirurgias_particulares
  FOR SELECT TO authenticated
  USING ((select public.can_write_cirurgias_particulares()));

DROP POLICY IF EXISTS "cirurgias_particulares_insert" ON public.cirurgias_particulares;
CREATE POLICY "cirurgias_particulares_insert" ON public.cirurgias_particulares
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_cirurgias_particulares()));

DROP POLICY IF EXISTS "cirurgias_particulares_update" ON public.cirurgias_particulares;
CREATE POLICY "cirurgias_particulares_update" ON public.cirurgias_particulares
  FOR UPDATE TO authenticated
  USING ((select public.can_write_cirurgias_particulares()))
  WITH CHECK ((select public.can_write_cirurgias_particulares()));

-- Sem policy DELETE: lançamento errado é soft-cancel (cancelada_em).

-- Realtime (sem isto a subscription silencia; onRefetch mascara)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'cirurgias_particulares'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cirurgias_particulares;
  END IF;
END $$;

COMMIT;
