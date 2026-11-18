---
paths:
  - "src/pages/ferias/**"
  - "src/lib/extratoFerias*.js"
  - "src/lib/feriasSemestre.js"
  - "src/lib/feriasMovimentacoes.js"
  - "src/lib/feriasMarcacao.js"
  - "src/lib/feriasAnalise.js"
  - "src/lib/feriasSocios.js"
  - "src/lib/feriasFeriados.js"
  - "src/lib/feriasCalendario.js"
description: Extrato de Férias — allowlist de acesso, metade da cota por semestre, marcação self-service append-only
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

> ⚠️ **REGRAS NOVAS 2026-11-18 (dono: "valem a partir de agora e continuam em 2027"; dados de 2026
> preservados).** Fonte: "Regras de Escalação – versão estruturada" do comitê de escalas (12/11),
> seção 7, V-01…V-33 + respostas de 16/11. SUPERA o texto abaixo onde divergir:
> - **Semestre (V-02/V-03):** os DOIS semestres têm teto = `ceil(cota/2)`; corte 30/06 para TODOS
>   (acabou o 31/07 de quem tem filho e o piso do 1º). `metadesDaCota` → `{maxSemestre, semestreLivre}`.
> - **7ª vaga (V-10/V-33):** não existe — acima de 6 é CANDIDATO, sem custo na hora, aviso ao comitê de
>   escalas (`buildCandidatoNotificationPayload`). Penalidade automática de 3 dias só para o que foi
>   marcado ANTES de `DATA_REGRAS_NOVAS` ('2026-11-18'). Peri-recesso não proíbe mais nada.
> - **Feriado (V-11/V-19):** não se marca o dia do feriado (trava); semana parcial PAGA o feriado mesmo
>   sem marcá-lo (`contarDias`); semana inteira não paga.
> - **Travas (seção 9):** por dia em `avaliarMarcacaoDia` (FDS, prazo, feriado, cota V-05, semestre V-02,
>   julho V-13 quando a lista de filhos existir, sócio fora do ano) + pela seleção em
>   `montarResumoConfirmacao` → `bloqueios` (regras em `REGRAS_TRAVA`, com `REGRA_CODIGO`). V-25 trava
>   desistência de semana nobre < 1 mês. Motor: 9 regras (`extratoFeriasRegras.js`), ids antigos mantidos.
> - **Marcação aberta a TODOS os sócios** (`EMAIL_TO_SOCIO` com os 46 + SQL `ferias_nome_socio()` migration
>   `20261118120000` + espelho na edge api-v1 — paridade testada). Comitê de escalas = `EMAILS_COMITE_ESCALAS`
>   (João Ricardo coordena, Aline, Oscar, Alexandre Schmidt), também em `EMAILS_ALERTAS_FERIAS`.
> - **Dados:** `SOCIOS_FERIAS[2027]` com `cota` INFORMADA (COTAS_FERIAS_2027.pdf; Rômulo saiu; "NOVO 1–4"
>   entram quando o dono mandar os nomes); `calcularCota` soma +1 só DEPOIS do 25º ano (2026 congelado:
>   Vicente 35). Feriados 2027, recessos 23/12/26–02/01/27 e 24/12/27–02/01/28. `feriasCalendario.js`:
>   julho escolar (rede estadual SC até as particulares de Chapecó publicarem) e congressos (CBA/COPA/TSA).
> - **Alertas julgam 2026 INTEIRO** (dono 18/11: "quero que os alertas já sejam contabilizados agora em
>   2026") — `avaliarRegras` sem corte por padrão (`config.desde` opcional). Só o CUSTO (feriado pago,
>   penalidade da 7ª vaga) segue `DATA_REGRAS_NOVAS`, para não mexer em saldo de férias já tiradas.
> - **Fase 2 (não feita):** telas do comitê (decidir candidatos, adiantamento, congresso com asterisco +
>   comprovante, penalidade V-30/V-32, licenças, cadastro de filhos), via protótipo antes de `src/`.

> ⚠️ **Atualização 2026-09-11 (dono): a LEITURA do extrato abriu a todo anestesiologista.**
> `podeVerExtratoFerias` = `normalizeRole(user.role) === 'anestesiologista'` (sem admin, sem
> e-mail) e `can_access_extrato_ferias()` lê o mesmo `profiles.role` (migration
> `20260911180000_extrato_ferias_todos_anestesiologistas.sql`). Explicitamente FORA: residentes,
> enfermeiros, técnicos, farmacêuticos, secretárias, colaboradores e contas de hospital. As
> duas listas de e-mail têm outro papel:
> `EMAILS_ALERTAS_FERIAS` (quem recebe a notificação diária — 5 e-mails) e `EMAIL_TO_SOCIO`
> (quem pode marcar — espelha `ferias_nome_socio()`). Anestesiologista fora do
> mapa vê o extrato e não ganha a aba Agendar. Trava: `src/__tests__/pages/extratoFeriasGate.test.js`.

## Extrato de Férias (linha do Mapa de Módulos do CLAUDE.md)

| Módulo | Entrada | Backend | Notas |
|---|---|---|---|
| Extrato de Férias | pill **"Extrato"** no card Férias da Home (card inteiro clicável; `FeriasCard` ganhou prop `actionPill`) → `src/pages/ferias/ExtratoFeriasPage.jsx` | Pega Plantão `getFeriasDoAno(ano)` (12 meses em lotes de 3 pelo proxy, cache 30min por chave, SEM fallback mock) + Supabase `ferias_violacoes_vistas` (migrations `20260803220000`+`233000`, aplicadas; append-only, FORCE RLS, `detected_by` amarrado ao uid) | **Acesso: ver a nota de 11/09 no topo desta rule** — leitura = todo anestesiologista (`podeVerExtratoFerias` ESPELHA a RLS `can_access_extrato_ferias()`; mudar um = mudar o outro); marcar = `EMAIL_TO_SOCIO`; notificação = `EMAILS_ALERTAS_FERIAS` (via `getDestinatariosFerias`). + `PAGE_TO_CARD: extratoFerias→'ferias'`. Layout (redesign 03/08, referência leave-trackers): **Coletivo** = 3 tiles (Dias marcados · **Alertas → bottom-sheet no toque**, nada de banner inline · Dias lotados) + lista com **nome COMPLETO** (`nomeCompleto` em `feriasSocios.js`; ids de violação seguem no nome da escala — mudar re-notificaria tudo) + `Progress` de uso + badges **Excedida/Completa/N livres**; **Individual** = saldo-herói com barra + card **Extrato POR SEMESTRE** (dono 19/08), cada metade com Agendados/Usufruídos dentro. **METADE DA COTA POR SEMESTRE:** o PDF diz "metade dos dias até fim de junho (ou julho com filhos em idade escolar)" + "dias não usufruídos em cada semestre serão perdidos"; dono 19/08 fechou que a metade é da **COTA**, não dos dias marcados — pode-se usar MAIS que a metade no 1º semestre, **nunca** mais que a metade no 2º. Daí `src/lib/feriasSemestre.js` (puro): `minS1 = ceil(cota/2)` (piso, só mostrado — dia que passou não volta) e `maxS2 = floor(cota/2)` (**TETO, que a aba Agendar BLOQUEIA** — `avaliarMarcacaoDia({semestre})`, tipo `METADE_SEGUNDO_SEMESTRE`; é o único bloqueio de REGRA, os demais só declaram custo). Cota ímpar sobra p/ o 1º semestre. A fronteira é o **CORTE** (30/06; 31/07 se `filhosIdadeEscolar` — hoje null p/ todos), não a metade do calendário, e período que o atravessa é PARTIDO nos dois lados. **1º ano (cota 5) é exceção nos dois eixos:** semestre livre (PDF) + os 5 dias têm de ser **uma semana corrida seg–sex, sem fracionar** (dono 19/08) — `semanaCorridaPrimeiroAno`, aviso no card. ⚠️ decisão do dono: essas duas regras novas ficam **só no extrato individual + no bloqueio da marcação** — NÃO viraram violação no motor (`extratoFeriasRegras.js` segue com 6), para não despejar alerta no Coletivo/PDF/notificação. Os totais por semestre incluem a penalidade da 7ª vaga do lado onde ela caiu; os "Total agendado/usufruído" globais saíram (o hero já traz os dois números). Libs puras: `src/lib/extratoFerias.js` (contagem: **FDS nunca conta**; **feriado só não conta em semana inteira**) + `extratoFeriasRegras.js` (**6 regras com id determinístico**; `REGRA_LABEL` simplificado 03/08; regras de PRAZO ficam fora — API não expõe quando se marcou). Dados: `feriasSocios.js` (46 sócios+ano entrada → cotas 5/20/30–35) + `feriasFeriados.js` (10 feriados do `férias/FERIADOS <ano>.pdf` — **Carnaval entra; 01/01 e 25/12 são recesso**) — manutenção ANUAL travada por tripwire. **Notificação agregada 1/dia** só com CONTAGENS (diff por id; recipients resolvidos ANTES de registrar). Export PDF (`extratoFeriasReport`) + Excel. Ano corrente automático. **Aba Mapa (03/08):** heatmap de ocupação diária (semanas × seg–sex, escala 0→7+ em tokens; toque mostra quem marcou) + plurianual por semana ISO (API serve 2023+ e o ano seguinte — `getFeriasDoAnoMin` cacheia anos passados em localStorage, loader com retry/pausa contra rate do proxy) + rankings de semanas + métricas de gestão e sugestões geradas do histórico (`src/lib/feriasAnalise.js`). Badges Completa/livres nos slots `-bg/-fg` de categoria (verde/laranja). **Aba Marcar — MARCAÇÃO SELF-SERVICE (dono 04/08):** cada sócio marca/desmarca as PRÓPRIAS férias tocando o calendário de ocupação (`calendarioOcupacao.jsx`, modo `selecao`, compartilhado com o Mapa) → barra fixa → `ConfirmarMarcacaoSheet` que DECLARA o custo (7ª vaga = 3 dias, alertas que a seleção cria, saldo antes→depois). Arquitetura: `ferias_movimentacoes` append-only (migration `20260804120000`) + replay puro `aplicarMovimentacoes` (`src/lib/feriasMovimentacoes.js`) sobre os registros do PP — **0 movimentações ⇒ extrato idêntico ao do PP** (travado em teste). RLS faz o self-service (`ferias_nome_socio()` ESPELHA `EMAIL_TO_SOCIO` do gate) e os PRAZOS no relógio do SERVIDOR (marcar: só dia futuro; desmarcar: nunca depois que a escala sai, i.e. ≤ véspera). `req_id`+índice único = confirmação retry-safe; `filtrarNoOps` = preflight anti-corrida. Regras que só avisam (cota/7ª vaga) vs. que bloqueiam (prazo/FDS) em `src/lib/feriasMarcacao.js`. Log de movimentações no fim do Mapa. ⚠️ proxy `pegaplantao-proxy` ganhou guardrails de escrita (WRITE_ALLOWLIST VAZIA, retry-401 só em GET, corpo do erro repassado) — a escrita no PP é fase-sonda futura, endpoint/códigos desconhecidos. ⚠️ lição 03/08: batch de notification p/ OUTROS destinatários NUNCA com `.select()` (RETURNING × RLS recipient-only aborta com 42501 silencioso — fix d127706 na ponte inteira). |
