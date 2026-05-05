# Never Events / Sentinel Events — Design ANEST

**Data:** 2026-05-04
**Tarefa:** B9 — Never Events flag
**Frameworks de referência:** NQF SRE 2025 (28 itens), JCAHO Sentinel Events, NHS Never Events 2018, RDC ANVISA 36/2013

## Contexto

ANEST hoje classifica incidentes por `severidade` (near_miss → critico) e `tipo` (medicacao, cirurgia, via_aerea, ...). **Não existe sinalização específica de Never Event**, embora vários subtipos atuais sejam Never Events de fato (ex.: `cirurgia.local_errado`, `cirurgia.corpo_estranho`, `medicacao.alergia_nao_verificada`).

## Por que adicionar

- **Compliance Qmentum / acreditação ONA:** Never Event dispara automaticamente RCA mandatório, prazo curto (45d JCAHO), notificação imediata ao Comitê de Segurança.
- **Métricas:** indicador "Never Events / 1.000 procedimentos" é zero-tolerance — diferente de incidente grave que segue distribuição de risco.
- **LGPD:** Never Event não muda fluxo de anonimização — caminho do relator continua respeitando `tipoIdentificacao`.

## Lista canônica ANEST (12 itens)

Implementada em `src/data/incidentesConfig.js` como `NEVER_EVENTS`. Cada item tem `code`, `label` PT, `description`, `harmCategory`, `framework`, `triggers` (tipo+subtipo ANEST que sugerem o Never Event automaticamente).

| Code | Label | Categoria | Framework |
|---|---|---|---|
| `NE-SUR-01` | Cirurgia em local errado | Surgical | NQF SRE 1 / NHS NE / JCAHO |
| `NE-SUR-02` | Cirurgia em paciente errado | Surgical | NQF SRE 2 / NHS NE / JCAHO |
| `NE-SUR-03` | Procedimento cirúrgico errado | Surgical | NQF SRE 3 / NHS NE / JCAHO |
| `NE-SUR-04` | Corpo estranho retido após cirurgia | Surgical | NQF SRE 4 / NHS NE / JCAHO |
| `NE-ANE-01` | Morte intra/peri-anestésica em ASA I | Care Mgmt | NQF SRE 5 |
| `NE-ANE-02` | Bloqueio anestésico em local errado | Surgical | NHS Never Event |
| `NE-ANE-03` | Falha catastrófica em via aérea c/ dano grave | Care Mgmt | NHS NE / consenso ANEST |
| `NE-MED-01` | Erro de medicação c/ óbito ou dano grave | Care Mgmt | NQF SRE 6 / JCAHO |
| `NE-MED-02` | Anafilaxia a medicamento c/ alergia conhecida | Care Mgmt | NQF SRE 6 (subtipo) |
| `NE-PRO-01` | Embolia gasosa por CVC | Product/Device | NHS Never Event |
| `NE-PRO-02` | Reação hemolítica por incompatibilidade ABO | Product/Device | NQF SRE 18 / NHS NE |
| `NE-ENV-01` | Queimadura/incêndio intra-operatório | Environmental | NQF SRE 11 / JCAHO |

## Modelo de dados

Implementado em `supabase/migrations/20260504_never_events.sql`:

- Coluna `is_never_event boolean NOT NULL DEFAULT false`
- Coluna `never_event_code text` (formato `^NE-[A-Z]{3}-[0-9]{2}$`)
- Check constraint de consistência (ambos null OU ambos preenchidos)
- 2 índices parciais (filtro por `is_never_event = true` + lookup por `never_event_code`)
- Trigger de audit log via `RAISE NOTICE`
- Backfill conservador para casos óbvios já existentes

**Justificativa colunas escalares vs JSONB:** filtro performante, constraint enforçável, RLS direto, observabilidade externa (Grafana, BI).

## UI — NovoIncidentePage (a implementar)

**Lógica de exibição:**
- Toggle binário "Esta ocorrência se enquadra como Never Event?" aparece quando:
  - `severidade in ['grave', 'critico']` OU
  - `tipo in ['cirurgia', 'medicacao', 'via_aerea', 'cardiovascular']`
- Auto-sugestão via `suggestNeverEventCode(tipo, subtipo)` — pré-marca quando combinação óbvia (ex: `cirurgia.local_errado`)

**Quando ativado:**
- Banner vermelho permanente: "⚠ Never Event identificado — RCA obrigatória em 45 dias"
- 3 campos extras obrigatórios:
  - Ação imediata tomada (textarea)
  - Responsável pela RCA (Select de admins)
  - Prazo da RCA (DatePicker, default = data registro + 45 dias)
- Override de notificação: `priority='urgente'`, `dismissable=false`, subject prefixado `[NEVER EVENT]`

## UI — IncidenteGestaoPage (a implementar)

- Faixa vermelha permanente acima do header card: `NEVER EVENT — <code> — <label>`
- Banner adicional na área restrita com prazos NOTIVISA + reunião extraordinária do Comitê de Segurança
- Card de Prazo Limite força `riskLevel='critico'` independente do RCA preenchido
- Filtro chip "Apenas Never Events" na listagem (`IncidentesPage`)
- Notificação push reforçada quando flag é ligada após o fato (requalificação)
- RCA `defaultOpen=true` quando Never Event sem RCA preenchido

## Fluxo end-to-end

1. Relator submete incidente com `cirurgia.local_errado`
2. UI revela toggle Never Event (auto-sugerido como `NE-SUR-01`)
3. Banner vermelho aparece, RCA obrigatória, prazo 45d
4. Notificação urgente ao Comitê de Segurança via `createSystemNotification`
5. IncidenteGestaoPage marca com faixa vermelha permanente
6. RCA preenchida no prazo OU escalonamento à Direção
7. Métrica "Never Events / 1.000 procedimentos" atualizada no Dashboard
8. Filtro "Apenas Never Events" disponível na listagem para auditoria mensal

## Open questions (decisão humana antes de implementar UI)

1. **Prazo de RCA:** 45d (JCAHO) ou 30d (mais conservador)? ANVISA omissa.
2. **12 vs 15 itens na lista canônica?** Adicionar suicídio + eletrocussão + erro diagnóstico?
3. **Integração NOTIVISA:** adicionar `snvs_notificado boolean` agora ou depois?
4. **Reclassificação retroativa:** Comitê pode marcar incidente antigo como Never Event ao analisar?
5. **Visibilidade ao relator:** se anônimo, status "Never Event" aparece no rastreamento?
6. **Permissão de desmarcar:** restringir a admin/coordenador?

## Status de implementação

| Componente | Status | Arquivo |
|---|---|---|
| Lista canônica `NEVER_EVENTS` | ✅ Implementado | `src/data/incidentesConfig.js` |
| Helpers `suggestNeverEventCode`, `getNeverEventConfig`, `shouldSuggestNeverEvent` | ✅ Implementado | `src/data/incidentesConfig.js` |
| Migration de schema (colunas + índices + audit trigger + backfill) | ✅ Pronto, **não aplicado** | `supabase/migrations/20260504_never_events.sql` |
| UI NovoIncidentePage (toggle + campos extras) | ⚠ Pendente — depende das open questions | — |
| UI IncidenteGestaoPage (faixa vermelha + filtro) | ⚠ Pendente | — |
| Notificação override (priority urgente) | ⚠ Pendente | — |
| Métrica dashboard "Never Events / 1.000" | ⚠ Pendente | — |

## Sources

- [Updating the SRE List | NQF](https://www.qualityforum.org/en-us/key-initiatives/updating-the-serious-reportable-events-sre-list)
- [Joint Commission and NQF Aligning SRE 2027](https://www.jointcommission.org/en-us/knowledge-library/news/2026-01-joint-commission-and-nqf-aligning)
- [PSNet Never Events primer (AHRQ)](https://psnet.ahrq.gov/primer/never-events)
- [NHS England Never Events policy and framework](https://www.england.nhs.uk/patient-safety/patient-safety-insight/revised-never-events-policy-and-framework/)
- [NQF List of 28 Serious Adverse Events — California Senate Appendix C](https://shea.senate.ca.gov/sites/shea.senate.ca.gov/files/FINALAppendixCNQFList28SeriousAdverseEvents.pdf)
- [ANVISA NSP — Núcleos de Segurança do Paciente](https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/seguranca-do-paciente/nucleos-seguranca-do-paciente)
- [ANVISA RDC 36/2013](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html)
