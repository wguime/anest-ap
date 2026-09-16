# Realtime por Broadcast (sinal + busca por chave)

> Desde 16/09/2026. Substitui `postgres_changes` em todo o app. Código: `src/services/supabaseSubscriptionHelper.js`;
> banco: `supabase/migrations/20260916203000_realtime_broadcast_sinal.sql`. Rule curta em
> `.claude/rules/supabase-firebase.md` (seção Real-time).

## Por quê

`postgres_changes` faz o servidor Realtime **consultar o WAL a cada ~100 ms** enquanto houver um assinante em
qualquer tabela (`realtime.list_changes`, com a RLS avaliada por assinante a cada mudança). Medido em
`pg_stat_statements` de 08/02 a 16/09/2026: **59 % de todo o tempo de CPU do banco**. Em 16/09, quando o compute
Nano (plano free) saturou na troca de turno, cada rodada levava 10–39 s. Broadcast "do banco" é push: um trigger
insere em `realtime.messages` e o servidor entrega; nada é consultado.

## Como funciona

1. **Trigger** `public.rt_sinal()` (AFTER de linha, SECURITY DEFINER como `postgres`) em 13 tabelas chama
   `realtime.send(payload, 'sinal', topico, true)`. Corpo inteiro em `begin … exception`: o sinal **nunca derruba a
   escrita clínica** (`realtime.send` também engole o próprio erro como WARNING). Definer porque `realtime.send`
   não é definer: rodando como `authenticated` a RLS de `realtime.messages` recusaria o insert em silêncio.
2. **Payload = sinal, nunca a linha**: `{ table, op, pk, chaves, antes }`. `pk` são as colunas da chave primária
   (argumentos do trigger — `escala_plantao_p4_diario` usa `data`, `authorized_emails` usa `email`,
   `incident_notification_settings` usa `user_id`, `escala_cirurgica_aviso_confirmacao` usa `aviso_id,user_id`);
   `chaves` = `escala_id`, `data`, `hospital`, `turno`, `status` quando existirem; `antes` = `status` anterior em
   UPDATE (a fila de aprovação de documentos compara antes/depois).
3. **Tópicos**: `t:<tabela>` para todo autenticado; `u:<tabela>:<uid>` nas tabelas de escopo pessoal —
   `notifications` (recipient), `messages` (sender E recipient, dois sinais), `incident_notification_settings`
   (user) e `incidentes` (autor). `t:incidentes` só para quem `is_incident_responsible('incidente'|'denuncia')`.
4. **Policy** única em `realtime.messages` (`rt_sinal_select`, SELECT para `authenticated`): o servidor autoriza o
   JOIN de canal privado rodando-a com as claims do JWT e `realtime.topic()` = tópico pedido. Não há policy de
   INSERT: o cliente só recebe; quem insere é o trigger.
5. **Cliente** (`createReliableSubscription`, mesma API de antes): entra no canal privado cujo nome **é** o tópico,
   recebe o sinal e **busca a linha pela PK via PostgREST** (`select('*').eq(pk…).maybeSingle()`), onde a RLS do
   usuário vale — linha invisível ou já apagada = evento descartado. `conteudo: false` pula a busca e entrega só
   `pk + chaves` (escala e avisos, que recarregam por conta própria). Filtro `col=eq.val` vale sobre a linha
   entregue; nas tabelas pessoais vira o tópico `u:`. **Um canal por tópico por cliente**, com ouvintes
   compartilhados: o realtime-js devolve o mesmo canal para o mesmo tópico e `subscribe()` é único por canal.
6. **Escala cirúrgica**: `EscalaCirurgicaContext` ignora sinal de outra data/escala e coalesce a rajada de um toque
   (`REALTIME_COALESCE_MS`, trailing) em UMA recarga — antes cada evento era ~10 requisições por cliente.

## Por que o sinal não leva a linha (LGPD)

Broadcast entrega a mesma mensagem a todo assinante do tópico; a RLS da tabela não vale dentro do canal.
Notificação só do destinatário, incidente só do responsável, documento por sigilo, mensagem só das partes — tudo
isso seria contornado com a linha no payload. Com o sinal, cada cliente busca a linha com o próprio JWT.

**Registro para o RIPD** (o que trafega em `t:*`, retido ~72 h em `realtime.messages` pelo janitor, no mesmo
banco):
- `incidentes`: só para responsáveis; sinal = id + status (sem autor, tipo ou conteúdo). Autor identificado recebe o
  próprio pelo tópico pessoal; relato anônimo (`user_id` nulo) não tem tópico pessoal.
- `escala_cirurgica_aviso_confirmacao`: `{aviso_id, user_id}` = "uid X confirmou o recado Y" chega a todo
  autenticado (uid é pseudônimo; `profiles` já é `select using (true)`).
- `authorized_emails`: `{email}` chega a todo autenticado — a tabela já é `select using (true)` para todos; o sinal
  não amplia o acesso.
- `escala_cirurgica_caso`: `{id, escala_id, turno}` — iniciais, idade e procedimento **não** saem.
- `cateteres_peridural`: `{id, hospital, status}` — nome do paciente **não** sai.

## O que ainda não foi feito

- As 13 tabelas **continuam na publication `supabase_realtime`** até o bundle novo estar em todos os clientes: o
  bundle antigo ainda assina `postgres_changes`, e o polling só para com **zero** assinantes. Conferir com
  `select count(*) from realtime.subscription`; quando zerar por alguns dias, migration tirando as tabelas.
- 9 tabelas que o app assina mas **nunca estiveram na publication** (`documentos`, `comunicados`, `planos_acao`,
  `autoavaliacao_rop`, `auditoria_execucoes`, `kpi_dados_mensais`, `documento_conflict_queue`,
  `lgpd_solicitacoes`, `documento_changelog`) ficaram **sem trigger** de propósito: ligá-las ativaria caminhos de
  código que nunca rodaram em produção. Decisão à parte, tabela a tabela.

## Diagnóstico

- Sinais gravados: `select topic, event, payload, inserted_at from realtime.messages order by inserted_at desc limit 20`.
- Trigger falhando em silêncio: logs do Postgres com `rt_sinal` (WARNING do bloco exception) ou
  `WarnSendingBroadcastMessage` (do `realtime.send`).
- Cliente sem permissão no tópico: `CHANNEL_ERROR` no console (`[ReliableSubscription] <tópico>`) e 20 tentativas
  com backoff; o app segue pelas recargas de `visibilitychange`/`pageshow`, sem ao vivo.
- Teste de RLS com usuário real (console, logado): `supabase.channel('u:notifications:<OUTRO_UID>', { config: { private: true } }).subscribe(s => console.log(s))` → esperado `CHANNEL_ERROR`; o próprio uid → `SUBSCRIBED`.
