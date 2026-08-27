---
name: cirurgias-particulares
description: Opera o sistema de verificação/aprendizado da cobrança de cirurgias particulares — status do módulo, rodar a verificação manualmente, ver histórico de achados e EXECUTAR O PROTOCOLO DE APRENDIZADO quando surge convênio suspeito (nova abreviação tipo "Part") ou erro de importação. Usar quando o dono relatar cirurgia particular faltando/errada na cobrança, quando uma notificação "Cirurgias Particulares — verificação diária" apontar suspeitos, ou ao mexer no classificador de convênio.
---

# /cirurgias-particulares — verificação, correção e aprendizado

Módulo: cobrança de honorários particulares (`cirurgias_particulares`), alimentado
por AUTO-IMPORT da escala (trigger `fn_sync_cirurgia_particular`). Doc completa:
`docs/cirurgias-particulares.md`. Regra de ouro (dono, 2026-07-22): **só importa
convênio PURAMENTE particular COM paciente identificado** — composto ("PART/SC")
e lote sem paciente NUNCA; na dúvida, perguntar, nunca adivinhar (é dinheiro).

O sistema roda sozinho todo dia às 20:30 BRT (pg_cron `cirurgias-particulares-check`):
auto-corrige elegíveis sem lançamento, sinaliza suspeitos p/ decisão humana,
aponta suspensos e incompletos, grava em `cirurgias_particulares_check_log` e
notifica os admins. Esta skill é o lado HUMANO/AGENTE do loop.

**Alertas pós-turno de GUIA NÃO PREENCHIDA** (nome/CPF/valor —
`fn_alertar_guias_nao_preenchidas`, migration `20260723200000`): pg_cron
`guias-pendentes-matutino` 13:30 BRT (casos c/ hora < 13h) e
`guias-pendentes-vespertino` 20:00 BRT (dia inteiro, inclui manuais/sem hora).
Anestesista da guia recebe as SUAS; admins o total. Dedup 1/dia×turno×pessoa.
Teste manual sem notificar:
`node scripts/deploy-sp21-mgmt-api.mjs query "select public.fn_alertar_guias_nao_preenchidas('vespertino', current_date, false)"`

## Comandos

### status
Leitura (sempre via `node .Codex/skills/escala-cirurgica/scripts/query-ro.mjs "<SQL>"` — SELECT-only):
```sql
-- ativos por status + incompletos
select status_pagamento, count(*), sum(valor)::numeric(12,2) as total,
       count(*) filter (where paciente_cpf is null or paciente !~ '[[:alpha:]]{3,}') as a_completar
from cirurgias_particulares where cancelada_em is null group by 1;
-- últimas verificações
select run_at, origem, corrigidos, suspeitos, suspensos, incompletos
from cirurgias_particulares_check_log order by run_at desc limit 7;
```

### verificar
Roda a verificação AGORA (escreve: auto-corrige + loga; use p_notificar=false
para não consumir o dedup diário da notificação):
```bash
node scripts/deploy-sp21-mgmt-api.mjs query "select public.fn_verificar_cirurgias_particulares('manual', false)"
```
Depois mostre o jsonb retornado e, se houver achados, o detalhe:
```sql
select achados from cirurgias_particulares_check_log order by run_at desc limit 1;
```

### historico
Tendência de erros (aprendizado está funcionando se corrigidos/suspeitos → 0):
```sql
select date_trunc('week', run_at)::date as semana,
       sum(corrigidos) as corrigidos, sum(suspeitos) as suspeitos, sum(suspensos) as suspensos
from cirurgias_particulares_check_log group by 1 order by 1 desc limit 8;
```

## PROTOCOLO DE APRENDIZADO (achado suspeito → regra nova)

Quando a verificação apontar `convenio_composto`/`lote_sem_paciente` ou o dono
relatar particular faltando:

1. **Diagnosticar** — ver o caso real (query-ro em `escala_cirurgica_caso` +
   `escala_cirurgica`); classificar: nova ABREVIAÇÃO pura (ex.: "Part" foi uma),
   COMPOSTO ambíguo (PART/SC), ou LOTE sem paciente.
2. **Perguntar ao dono** antes de qualquer mudança de classificação — a regra é
   dele; composto/lote só importam se ELE desmembrar (editar o caso na escala
   identificando o paciente — o trigger dispara sozinho no UPDATE).
3. **Codificar a decisão nos 5 ESPELHOS do classificador** (mudar um = mudar todos):
   - `fn_convenio_particular` + trigger (migration nova; validar com
     migration-validator; aplicar via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration`)
   - `familiaConvenio` em `src/pages/escala-cirurgica/utils.js`
   - edge `supabase/functions/parse-escala-cirurgica/index.ts` (sanitize + prompt
     do pacienteNome; redeploy: `bash scripts/deploy-edge-with-pat.sh
     parse-escala-cirurgica --no-verify-jwt` e CONFERIR verify_jwt=false depois)
   - `src/lib/excelEscala.js` (pacienteNome do caminho Excel)
   - `casoImportavel` em `src/lib/cirurgiasParticulares.js`
4. **Testes** — casos novos em `src/__tests__/lib/cirurgiasParticulares.test.js`
   (positivo E negativo da variante) + `npm run lint` + build.
5. **Retroagir** — rodar `verificar` (o self-heal importa o que a regra nova
   liberou; janela 7 dias — mais velho que isso, INSERT manual pelo padrão do
   backfill `20260722500000`).
6. **Registrar** — docs/cirurgias-particulares.md + AGENTS.md (linha do módulo)
   + memória do agente (arquivo feedback_*) com a decisão e o porquê.

## Limites
- NUNCA cancelar/alterar lançamento com valor/CPF/pagamento preenchidos sem
  ordem do dono (trilha financeira).
- NUNCA classificar convênio ambíguo sem decisão explícita do dono.
- Leitura = query-ro.mjs; escrita = só a função de verificação ou migration
  validada.
