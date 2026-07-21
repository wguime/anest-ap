# Escala Cirúrgica — Análise técnica e evolução (previsão de tempos, trocas, ponte financeira)

> 2026-07-18. Análise sobre o código como está no branch `feat/escala-cirurgica`.
> Escopo pedido pelo dono: como funciona hoje + prioridades 3 (previsão de términos),
> 5 (verificação das trocas mobile) e 6 (ponte Volan/AxReg/MV/Conta Azul).
> Prioridades 1, 2 e 4 da análise de adesão ficam explicitamente FORA por ora.

## 0. Como está funcionando hoje — avaliação

**Pontos fortes (mantêm):** realtime nas 3 tabelas (`escala_cirurgica`, `_caso`,
`trocas_cirurgicas`); escritas críticas por RPC atômica (publicação, swap, status) com audit
server-side; RLS por papel nos 4 verbos + colunas imutáveis pós-insert nas trocas; identidade
por uid com fallback de apelido + backfill; LGPD por construção (iniciais, CHECK no banco);
golden tests das 18 regras de liberação; modo demo isolado.

**Fragilidades no escopo atual (ordem de dor):**
1. **Republicar a escala apaga e recria os casos** (`rpc_salvar` delete+insert — decisão aceita
   à época). Consequência nova: qualquer histórico do dia (status, horários) morre na
   republicação. Vira bloqueador da previsão de tempos — resolvido pela Fase 0 abaixo.
2. **`status_atualizado_em` é coluna única** — marcar Terminada sobrescreve o horário de
   Iniciada. Hoje não existe duração real de nenhuma cirurgia no banco.
3. **`cirurgiao` é texto livre** ("Rodrigo Souza", "R. Souza", "RODRIGO S" são 3 chaves).
   Sem normalização não há estatística por cirurgião.
4. **`procedimento` é texto livre** — mesmo problema para estatística por tipo de cirurgia.
5. Liberações chaveadas por apelido de exibição (fragilidade já anotada nos testes).
6. Aba "Minhas" não abre o detalhe do caso nem mostra troca pendente (alvo depende da
   notificação para saber que tem proposta).

## 1. Prioridade 3 — Previsão de términos por cirurgião/procedimento

**Objetivo futuro:** sugerir tempo de término por sala a partir do histórico: duração típica de
cada (cirurgião × procedimento), tempo de troca de sala (turnover), e "N procedimentos do
cirurgião X levam ~Yh no total".

### Fase 0 — capturar a verdade temporal (pré-requisito, fazer cedo)
Sem isso, cada dia que passa é dado perdido. Duas peças:

- **Tabela de eventos insert-only** `escala_cirurgica_caso_evento`: trigger `AFTER UPDATE OF
  status_cirurgia` grava `{caso_id, data, hospital, sala, cirurgiao, procedimento, convenio,
  tipo, status_de, status_para, em (now()), por}` com os campos **denormalizados** (cópia, sem
  FK cascade) — sobrevive à republicação da escala e ao delete+insert. É a fonte de:
  - duração real = `terminada.em − iniciada.em` do mesmo caso;
  - turnover real = `iniciada.em(caso k+1) − terminada.em(caso k)` na mesma sala/dia.
- **Custo:** 1 migration + 1 trigger. Zero mudança de UI. O board continua funcionando igual;
  só passamos a guardar o que hoje jogamos fora.

Guardar também o `tempo_estimado` vigente no momento do evento → permite medir o erro da
estimativa manual vs. real (métrica de qualidade da futura sugestão).

### Fase 1 — normalizar as chaves de agregação
- **Cirurgião:** dicionário `apelido → cirurgiao_id` idêntico ao já existente para anestesistas
  (aprende na conferência da importação; campo `cirurgiao_display` já existe na tabela).
- **Procedimento:** na tela de conferência, sugerir vínculo `procedimento → código TUSS` usando
  a RPC `search_unimed_tuss` **que já existe** (Codificação Anestésica) — um toque da secretaria
  e o caso nasce com chave canônica. Fallback: normalização de texto (caixa/acento) para
  procedimentos fora da TUSS. Essa mesma chave é o elo com a prioridade 6.

### Fase 2 — agregados e sugestão (após ~2–3 meses de eventos)
Volume esperado: ~2 hospitais ativos × ~5 salas × ~4-6 casos/dia ≈ **200+ casos/mês** — pares
(cirurgião × procedimento) frequentes atingem n≥5 em 1–2 meses; cirurgião sozinho, em semanas.

- View materializada `mv_duracao`: mediana e p75 da duração real por `(cirurgiao_id, tuss)`,
  com contagem `n` e janela móvel de 12 meses.
- View `mv_turnover`: mediana do turnover por hospital (e por sala, quando n permitir).
- **Cascata de fallback** (mesmo princípio do resolver de apelidos):
  `(cirurgião+procedimento)` → `(procedimento)` → `(cirurgião)` → mediana global do hospital.
- **Resposta à pergunta do dono:** "3 procedimentos do Dr. X" =
  `Σ mediana(X, proc_i) + 2 × turnover(hospital)` — exibida como faixa (mediana…p75).

### Onde a sugestão aparece (sempre sugestão, nunca automático)
Mesmo princípio da cascata de percentuais da Codificação (auto-aplicação foi recusada; sugerir e
o humano confirma):
1. **Conferência da importação**: preenche `tempo_estimado` vazio com badge "sugerido (n=12)".
2. **AddCasoSheet**: sugere ao escolher cirurgião+procedimento.
3. **Cronômetro da Liberações**: quando a sala não tem estimativa, mostrar "~17:40 (histórico)"
   em vez de nada — usar **p75** aqui (promessa de liberação pede conservadorismo).

**Guardrails:** n mínimo 5 para exibir; clip de outliers por IQR; janela 12 meses; nunca
sobrescrever valor digitado por humano.

## 2. Prioridade 5 — Verificação das trocas no mobile

**Veredito: o fluxo está correto e completo no mobile.** Verificação feita por leitura de código
(TrocaSalaSheet, TrocaPendenteCard, service, RPC, RLS, context) + suíte (63/63 verde, cobrindo
propor/aceitar/recusar/conflito/demo/notificações):

| Etapa | Status | Evidência |
|---|---|---|
| Propor no celular | ✓ | Bottom-sheet com Select searchable (portal z-1300), erros com precedência clara, validação de conflito pré-submit, backfill de uid antes de propor |
| Alvo fica sabendo | ✓ | Notificação com deep link (`actionUrl: 'escalaCirurgica'`) + card pendente em tempo real (subscription em `trocas_cirurgicas`) |
| Aceitar/recusar/cancelar no celular | ✓ | Botões grandes no card; papéis corretos (alvo/coordenador/solicitante) |
| Atomicidade | ✓ | RPC `aplicar_troca_cirurgica`: lock FOR UPDATE, aceite exclusivo da RPC, swap das duas salas ou nada |
| Escala mudou entre propor e aceitar | ✓ | Guarda `troca_obsoleta` aborta sem swap parcial |
| Segurança | ✓ | RLS: update direto só pendente→recusada/cancelada pelas partes; colunas da proposta imutáveis (trigger anti-retarget) |
| Coordenador aplica direto | ✓ | propõe+aceita em sequência |

O blocker documentado do QGenda (swap que só fecha no desktop) **não existe aqui** — o fluxo é
mobile-nativo de ponta a ponta.

**3 melhorias menores (não são falhas):**
1. "Aceitar" executa o swap num toque, sem confirmação — colocar `ConfirmDialog` (padrão DS já
   usado em ações destrutivas; desfazer exige nova troca).
2. Proposta pendente não aparece na aba "Minhas" (só na Completa) — um aviso/badge na Minhas
   fecharia o ciclo para quem não abre a Completa.
3. Cobertura real de ponta a ponta (2 celulares, escala real) entra no roteiro do piloto — os
   testes cobrem o contexto com service mockado.

## 3. Prioridade 6 — Ponte financeira (Volan / AxReg / MV / Conta Azul)

**O que o módulo já tem de valor financeiro por caso:** data, hospital, sala, convênio
(família normalizada pelo helper!), procedimento, cirurgião, anestesista (uid), tipo
urgência/eletiva — e, com a Fase 0 acima, horários reais de início/fim. Isso é exatamente o
registro de **produção anestésica** que alimenta faturamento.

**Elo interno primeiro (independe de terceiros):**
1. Persistir produção: caso Terminada → registro imutável em `producao_anestesica` (hoje nada é
   persistido; a Codificação Anestésica é uma calculadora stateless).
2. **Caso → rascunho de guia**: o app já tem TODO o motor — `search_unimed_tuss` (procedimento→
   código), UTM/CBHPM v2026.03, +30% urgência (o `tipo` do caso já diz!), acomodação, cascata de
   percentuais. Um botão "gerar guia" no caso terminado pré-preenche a calculadora. Se a Fase 1
   da previsão vincular TUSS na conferência, a guia nasce quase pronta.

**Por alvo externo (ordem recomendada):**

| Alvo | O que é | Caminho realista | Valor |
|---|---|---|---|
| **Export universal (CSV/planilha)** | — | Produção mensal por anestesista/convênio/hospital; formato importável por qualquer contador/sistema | Imediato; destrava tudo antes de qualquer API |
| **Conta Azul** | ERP financeiro SaaS | **Única com API pública** (OAuth2; vendas/recebíveis/clientes). Edge function gera recebível por guia (cliente=convênio), conciliação de recebimento | "Dinheiro entra": fecha produção→cobrança→recebimento |
| **AxReg (AneStech)** | Ficha anestésica eletrônica | Parceria/API deles. Duas direções: pré-preencher a ficha com o caso; e **recuperar os tempos anestésicos reais** da ficha (fonte melhor que o toque manual do board) | Se o grupo usa AxReg, os timestamps deles alimentam a previsão da prioridade 3 |
| **MV/SoulMV (HIS)** | Prontuário do hospital | Depende do hospital liberar barramento (HL7/API; mercado já faz — PegaPlantão integra SoulMV/Tasy). Alvo nº1: **receber o mapa cirúrgico direto** (mata o print+IA e o risco "dia sem escala"); alvo nº2: eventos de sala → status automático | A integração mais transformadora, e a de maior atrito (negociação institucional) |
| **Volan** | Suite BR de gestão p/ anestesia | Sem API pública conhecida; caminho = export compatível ou contato comercial. **Atenção estratégica**: Volan é concorrente de suite (escala+faturamento+BI) — decidir se o vínculo é ponte ou se o ANEST evolui a própria trilha (Codificação+Conta Azul) | Ponte tática, não fundação |

**LGPD:** a produção exportada carrega **apenas iniciais** (como o banco já garante). A guia real
com identificação completa do paciente vive nos sistemas do convênio/hospital — o ANEST exporta
referência (data/sala/código), nunca identidade. Manter esse desenho.

**Sequência sugerida quando for a hora:** Fase 0 da previsão (eventos) → `producao_anestesica` +
botão "gerar guia" → export CSV → Conta Azul → AxReg/MV conforme acesso/uso do grupo.
