---
name: escala-cirurgica
description: Audita e valida a Escala Cirúrgica diária — status operacional, importação real por hospital/turno, regras de liberação, Edge Vision e regressão do módulo. Usar quando pedirem revisão, status, análise de uma escala, validação pré-release ou relatório da escala cirúrgica.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
disable-model-invocation: true
---

# /escala-cirurgica — auditoria e operações do módulo

Modos por argumento; sem argumento = `status`. Contexto: **LIBERADO AO GRUPO em
2026-07-22** (gate por papel clínico/secretária/admin em `gate.js`); as escalas seed
foram APAGADAS e o cron `escala-seed-rollover-daily` desligado no checklist de
liberação. Cron ativo: `escala-amanha-check` (18h BRT dom–qui; destinatário ainda é o
dono — trocar para secretaria/admin quando houver secretária, marcado na migration
`20260721210000`). Doc-mãe: `docs/escala-cirurgica-automacoes.md`.

**Leitura de produção via** `node .claude/skills/escala-cirurgica/scripts/query-ro.mjs "<select>"`.
O wrapper bloqueia verbos de escrita e CTEs modificadoras; não use o endpoint read-write
diretamente em auditorias.

## Modo `status` (default)

Rodar as 4 checagens e responder com veredito curto por linha (✓/⚠️ + 1 frase):

1. **Escalas reais chegando?** (pós-liberação, a métrica-sentinela é adoção)
   ```sql
   select data, hospital, status, published_by_name from escala_cirurgica
    order by data desc limit 7
   ```
   ⚠️ Se aparecer QUALQUER `created_by like 'seed-teste%'`, algo recriou seed — investigar.
2. **Cron do aviso rodou?**
   ```sql
   select j.jobname, j.schedule, d.status, d.start_time
     from cron.job j
     left join lateral (select status, start_time from cron.job_run_details
                         where jobid = j.jobid order by start_time desc limit 1) d on true
    where j.jobname = 'escala-amanha-check'
   ```
3. **Edge atualizada?** `node scripts/diag-edge-fn-config.mjs parse-escala-cirurgica`
   + `git log -1 --format='%cI %h %s' -- supabase/functions/parse-escala-cirurgica/`.
   Commit mais novo que `updated=` → **DEPLOY PENDENTE** (foi assim que a edge ficou 3
   semanas atrasada sem ninguém notar). Deploy: `bash scripts/deploy-edge-with-pat.sh parse-escala-cirurgica`.
4. **Eventos coletando?**
   ```sql
   select tipo, count(*), min(em)::date as de, max(em)::date as ate
     from escala_cirurgica_evento group by tipo
   ```
   `max(em)` parado há dias com piloto ativo = trigger quebrado (investigar).

## Modo `validar` — pré-release determinístico

Executar, nesta ordem, e reportar o output real de cada etapa:

1. Vitest focado no módulo e nas regras puras.
2. `deno check --node-modules-dir=false supabase/functions/parse-escala-cirurgica/index.ts`.
3. ESLint dos arquivos alterados.
4. `npm run build` e subida curta de `npm run dev`.
5. Playwright dos specs demo aplicáveis; declarar qualquer cobertura não executada.

Não precisa de biblioteca nova: Vitest, Playwright, XLSX e Supabase SDK já cobrem o fluxo.

## Modo `auditar-importacao` — anexos reais, sem publicar

- Receber hospital, data/turno pretendidos e caminhos locais das imagens.
- Chamar a Edge autenticada somente para extração e comparar: cirurgias, posições
  assistenciais, salas, rodapé, nomes sem vínculo, duplicatas e itens de outro turno.
- Comparar o rodapé literalmente: mesma contagem, sequência e notas entre parênteses.
  Falhar a auditoria se uma nota for dividida, removida, ordenada ou deduplicada; variantes
  `CONS*` representam posição ativa no Consultório, mesmo sem cirurgia.
- Não publicar nem armazenar a imagem. Em artefatos commitados, usar só contagens e dados
  desidentificados.
- SRPA é posição assistencial: aparece na equipe/fila, nunca conta como cirurgia e, no
  Board, mantém o cabeçalho compacto sem a frase explicativa de que não é cirurgia.

## Modo `relatorio` — eventos → `docs/escala-cirurgica-metricas/<AAAA>-W<ww>.md`

Semana ISO via `date +%G-W%V`. Seções (regras de honestidade do doc técnico: n<5 =
"insuficiente p/ mediana"; cirurgião/procedimento são texto livre até a Fase 1 —
agrupar pelo texto e listar variantes suspeitas do mesmo nome; nunca extrapolar):

1. **Integridade da coleta** — query 4 do `status` + últimas 24h.
2. **Durações** por cirurgião×procedimento:
   ```sql
   select cirurgiao, procedimento, count(*) n,
          percentile_cont(0.5) within group (order by dur) as mediana,
          percentile_cont(0.75) within group (order by dur) as p75
     from (select caso_id, max(cirurgiao) cirurgiao, max(procedimento) procedimento,
                  max(em) filter (where status_para='terminada')
                - max(em) filter (where status_para='iniciada') as dur
             from escala_cirurgica_evento where tipo='status' group by caso_id) t
    where dur is not null group by 1,2 order by n desc
   ```
3. **Turnover por sala** (lead de iniciada seguinte − terminada, mesma sala/data/hospital):
   ```sql
   with s as (select caso_id, hospital, data, sala,
                     max(em) filter (where status_para='iniciada') ini,
                     max(em) filter (where status_para='terminada') fim
                from escala_cirurgica_evento where tipo='status'
               group by caso_id, hospital, data, sala),
        o as (select hospital, data, sala, fim,
                     lead(ini) over (partition by hospital, data, sala order by ini) prox
                from s where ini is not null)
   select hospital, sala, count(*) n,
          percentile_cont(0.5) within group (order by prox - fim) turnover_mediano
     from o where fim is not null and prox > fim group by 1,2 order by 1,2
   ```
4. **Adoção (§5 do playbook de adesão)** — dias com escala real publicada (excluir
   `created_by like 'seed-teste-claude%'`), casos com status marcado vs total, liberações
   (`tipo='liberacao'`) e trocas declaradas (`escala_cirurgica_evento.tipo='troca'`).

Salvar o arquivo no branch atual. Commit só quando o pedido incluir commit/deploy.

## Modo `smoke` — regressão visual das 3 abas (PAUSADO 2026-07-22)

⚠️ O spec está com `test.skip`: a fixture era a seed-20, apagada na liberação ao
grupo. Reativar = nova estratégia determinística (fixture criada/destruída pelo
próprio spec, ou escala demo client-side). O texto abaixo vale quando reativar.

Pré-requisitos: `npm run dev` de pé (o playwright.config NÃO sobe webServer) e creds E2E
carregadas process-side — **nunca imprimir**:

```bash
set -a; source ~/.anest-e2e.env; set +a; npx playwright test e2e/escala-cirurgica-visual.spec.ts
```

O spec congela o relógio e usa a seed fixa de 20/07 (dados determinísticos). Diff
inesperado = regressão visual; mudança intencional = re-rodar com `--update-snapshots`
e commitar os baselines junto do PR. Baseline quebrado sem mudança de código → alguém
mexeu nos status da seed-20 no banco (conferir antes de regenerar).

## Gotchas

- Queries via Management API rodam como `postgres` → RLS não filtra nada; conteúdo de
  paciente são só iniciais (LGPD by design), mesmo assim não colar dumps grandes no chat.
- `~/.anest-e2e.env` segue a política de segredos do repositório: só `source`, jamais `cat`.
- Antes da liberação ao grupo: `cron.unschedule('escala-seed-rollover-daily')` + apagar
  as seeds (checklist no header da migration `20260721200000`).
