# Reavaliação Estratégica — ANEST como Produto (2026-06-12)

> **Contexto:** o dono decidiu **não** fazer descoberta com FEBRACAN nem design-partners, e seguir direto melhorando o app para deixá-lo pronto para comercialização. Esta reavaliação desafia e reordena o `roadmap-comercial-2026-06.md` com base em **pesquisa de mercado fresca (2026)** + **análise do código real** (6 frentes paralelas) + **melhores práticas oficiais de produto/IA (Anthropic, OpenAI, NIST, WHO, FDA/ANVISA)**.
>
> **Lente:** fundador de empresa de IA construindo produto de classe mundial — workflow-first, human-in-the-loop, evidência verificável, risco regulatório contido. Sem hype.

---

## 1. Veredito em uma página

**As duas premissas centrais do roadmap se sustentam — e ganharam um gatilho datado.** O Manual **OPSS 2026 da ONA** (lançado 09/12/2025, vigência 4 anos) muda o paradigma de "documental" para **"data-driven": evidenciar, rastrear e demonstrar efetividade em tempo real**, e cita IA e integração com sistemas digitais explicitamente. O auditor passou a perguntar *"onde estão as evidências?"* — e trilha+versão+confirmação de leitura, que o ANEST já tem, viram **prova de acreditação**. A tese "o sistema de gestão do serviço de anestesia, com a evidência saindo pronta" está mais forte hoje do que em 2026-06-10.

**Mas o diagnóstico técnico muda a sequência.** O diferencial vendável — *"ciclo PDCA auditável"* — **ainda não existe como cadeia**: a única ligação real no código é `auditoria → plano de ação`. **Incidente, o módulo mais maduro do app, é um beco sem saída de PDCA**; o score de compliance (`useComplianceMetrics`) só enxerga documentos; os relatórios trimestrais vivem no Firestore (datastore errado para cruzar dados); e o pacote de evidências não existe. **Fortalecer essa cadeia não depende de multi-tenancy** — pode ser feito agora, no tenant ANEST, tornando o produto demonstravelmente melhor e a futura demo de venda muito mais forte.

**O reframe de fundador:** o roadmap diz *"nada é vendável antes da Fundação (F1 multi-tenancy)"*. Isso é verdade para **faturar do cliente nº 2**, mas **não** para **aumentar o valor do produto**. Como o mandato agora é "deixar o app pronto para comercialização" (não "onboard cliente nº 2 amanhã"), faz sentido **duas trilhas**:

- **Trilha A — Produto (valor demonstrável, sem multi-tenancy):** fechar a cadeia PDCA, pacote de evidências, importador de escala intuitivo, quick wins de IA, educação-como-evidência. Cada entrega melhora a ANEST (tenant 0) e vira material de demo.
- **Trilha B — Plataforma (multi-tenancy F1–F5):** o refit pesado que permite vender a um 2º cliente. Necessário, mas é fundação de *escala*, não de *valor*. Pode rodar depois ou em paralelo.

Front-loadar a Trilha A **de-risca**: você afia o produto e valida o ciclo no tenant real antes de pagar o custo (alto e arriscado) da reescrita de ~126 policies RLS.

---

## 2. O que o mercado fresco confirma e desafia

> Método: WebSearch/WebFetch (o **MCP Firecrawl está com token inválido — 401; precisa rotacionar a chave**, ver §11). Todo número sem fonte está marcado "não encontrado" — nada foi estimado.

### Confirma
- **Gap de posicionamento CSA** — nenhum player encontrado é específico de serviço de anestesiologia. SGQ horizontal (Qualiex, SoftExpert, Interact, **SigQuali** — entrante verticalizado em saúde, adicionar ao quadro) não conhece a operação; apps de escala têm zero qualidade. O nicho continua desocupado.
- **Acreditação puxa evidência digital** — OPSS 2026 + crítica pública a "checklist em papel preenchível ficticiamente". Premissa mais forte do roadmap, agora datada.
- **Preço opaco em todo o segmento** (SGQ, escala, residência: todos "sob consulta") — liberdade de ancoragem.
- **IA não-diagnóstica como vento de cauda** — confirmado e com urgência: **SoftExpert já tem "Copilot AI" em produção** (a janela de "IA como diferencial no eixo qualidade" está se fechando). **CFM Res. 2.454/2026** (vigência 26/08/2026) é o 1º marco federal de IA na prática médica — reforça manter-se **não-diagnóstico** (exatamente a decisão do roadmap).

### Desafia (correções materiais ao roadmap)
1. **Residência NÃO é greenfield.** Já existem 2 nacionais ativos — **ResideGes** e **MEDBOLSO** — ambos centrados em escala/frequência/compliance CNRM. **Mas** o **logbook clínico granular caso-a-caso + matriz de competências navegável item-a-item** segue desocupado no BR (o ACGME oferece isso de graça nos EUA via Case Log System). É a **diferenciação defensável** — não "ser o primeiro".
2. **Escala não é diferencial.** Geração/otimização automática de grade virou *commodity* no BR (DoctorID, Plantão Médico, Plantão Rápido). O campo de batalha migrou para **IA de staffing/preenchimento via WhatsApp** (Revoluna/"Julia", Plantão.AI, Jull.ia — entrantes dez/2025), que é **adjacente** à tese. **Não vender o módulo de escala como diferencial de IA** — vendê-lo como *parte integrada* do sistema de gestão.
3. **Há âncora de preço pública adjacente.** O SaaS clínico (iClinic, Feegow, Clinicorp) **publica R$ 99–299/profissional/mês**. A faixa "Grupo R$ 990–1.990/mês" do roadmap é coerente. **Mas per-seat puro pune a cooperativa** por incluir membros → recomendar **flat por organização escalonado por porte** (faixas de anestesiologistas) + módulos premium add-on + trial para a âncora.
4. **Integração HIS (Tasy/SoulMV) é o fosso dos incumbentes de escala** (Pega Plantão nativo). Não tentar replicar cedo; é o que prende as grandes contas e não é o nosso jogo inicial.

---

## 3. Diagnóstico que muda a sequência — a cadeia PDCA quebrada

```
  [PLAN]                    [DO]                 [CHECK]              [ACT]
  Incidente ── X1 ✗ ──▶ Plano de Ação ── X2 ✗ ──▶ Documento/POP ─ X3 ✗ ─▶ Comunicado
   │  RCA estruturada      │ 4 fases PDCA        │ workflow aprovação  │ + confirmação leitura
   └─ Auditoria ─✅ WIRED ──┘                                            │
                                                                        ▼
                          KPI ◀── X4 ✗ ── (sem vínculo) ──▶ Pacote de Evidências (X5: não existe)
```

| Quebra | O que falta | Custo do fix | Valor |
|---|---|---|---|
| **X1 Incidente → Plano** | O schema já suporta (`tipoOrigem:'incidente'`+`origemId`) e `NovoPlanoPage` aceita os params — só **falta a tela do incidente navegar para lá**. Auditoria já faz (`handleGerarPlano`). | **Baixo** (copiar padrão existente) | **Máximo** — destrava o módulo mais maduro; melhor cena de demo |
| **X4 Compliance metrics cego** | `useComplianceMetrics` importa só `useDocumentsContext` → o "qmentumScore/ropAdherence" **não cruza incidentes, planos, KPIs nem comunicados**. O pacote de evidências herdaria essa cegueira. | Médio | Alto — é o insumo do pacote |
| **X5 Pacote de evidências** | Inexistente. 5 templates PDF + `/verificar/:uuid` prontos; falta o **bundle ZIP + manifest com hash**. | Médio | Máximo — é o momento-verdade da venda |
| **X2/X3 vínculos** | Plano não referencia o POP revisado; comunicado sem `related_entity`. FKs são **lógicas (TEXT sem REFERENCES)** → órfãos possíveis. | Baixo-médio | Médio — auditabilidade |
| **Relatórios no Firestore** | Trimestrais/incidentes no Firestore enquanto planos/KPIs/incidentes no Supabase → nenhum relatório cruza tudo com integridade. | Médio | Alto (pré-requisito do bundle real) |
| **Audit trail parcial** | Só cobre *permissões de usuário*; não há trilha de *quem aprovou o POP / publicou o comunicado / avançou o plano* — que é o que o auditor ONA quer ver. | Médio | Alto |

**Conclusão:** as 3 alavancas de maior valor/menor esforço, nesta ordem — **X1 (incidente→plano)**, **X4 (compliance cross-module)**, **X5 (pacote de evidências)** — fecham o ciclo, são **demonstráveis sem multi-tenancy**, e cada uma é o gancho natural de uma feature de IA com humano no circuito.

---

## 4. Sequência revisada — duas trilhas

### Trilha A — Produto (valor no tenant 0, demo-able, sem multi-tenancy)
Ordem recomendada por alavancagem:

1. **A1 · Fechar X1 (incidente→plano)** + botão "Gerar plano de ação" no detalhe/gestão do incidente, prefill com o RCA. *(W0 do roadmap + maior valor de demo.)*
2. **A2 · `useComplianceMetrics` cross-module** (incidentes→planos, comunicados confirmados, KPIs, ROP). Insumo correto do pacote.
3. **A3 · Migrar relatórios Firestore→Supabase** (pré-requisito de qualquer bundle que cruze módulos).
4. **A4 · Pacote de evidências ONA/Qmentum** (ZIP + manifest com hash, reusando os 5 templates + `/verificar/:uuid`) — inclui **educação do período** (lacuna do E2 do roadmap, ver §6).
5. **A5 · Importador de escala intuitivo** (ver §7) — onboarding e dogfooding; ataca o gargalo nº 1 de qualquer cliente futuro e já melhora a operação ANEST.
6. **A6 · Quick wins de IA** (ver §8) — começando pelo importador assistido (A5) e rascunho de plano a partir do incidente (A1).
7. **A7 · Trust Center + DPA/RIPD** como artefato (ver §9) — barato, encurta venda futura.

### Trilha B — Plataforma (multi-tenancy; necessária p/ cliente nº 2)
O pré-flight do F1 já está feito (ver §10). Quando o dono quiser escalar para um 2º tenant:

- **B1 · F1 multi-tenancy** — `organizations`/`org_members`/`profiles.org_id` + `current_org()` (molde `user_clearance_level` pronto) + backfill `anest`. Reescrita de ~126 policies módulo a módulo, com suite de isolamento cross-tenant como gate (nunca big-bang). Atenção: **api-v1** (token não vinculado a org = pior vetor de vazamento), **16 edges service-role**, **~80 coleções Firestore sem noção de org**, **4 pontos de path de Storage**.
- **B2 · F2 Etapa C** (rotas declarativas + code splitting) — independente, frontend, baixo risco; pode antecipar a qualquer momento.
- **B3 · F4 convites** (aposentar `authorized_emails`), **F3 escala→banco** (já preparado por A5), **F5 suite de isolamento** (transversal).

**Decisão de fundo (§12):** A inteira primeiro (afia o produto), depois B; ou B1 em paralelo desde já (custo e risco maiores, mas destrava venda mais cedo).

---

## 5. Centro de Gestão + Qualidade — melhorias priorizadas

**P0 (ciclo + produto):** X1 incidente→plano · `org_id`/RLS (Trilha B) · campos NOTIVISA + persistir taxonomia WHO ICPS/NCC MERP no banco (hoje só em `incidentesConfig.js`).
**P1 (fecha o ciclo auditável):** `useComplianceMetrics` cross-module · pacote de evidências · `related_entity` em comunicados + FK plano→documento (REFERENCES reais) · migrar relatórios p/ Supabase · taxonomia/workflow de documento configuráveis por tenant.
**P2 (escala/self-service):** `org_roles`/`org_modules` por tenant · branding PDF por tenant · **trilha de auditoria além de permissões** (aprovação de documento, publicação de comunicado, avanço de plano).

---

## 6. Educação/LMS — melhorias + integração

O roadmap v2 cobre bem migração/Mux/captions/prazo-server-side/turmas/licenciamento. **Duas lacunas reais:**

- **Educação está ausente do pacote de evidências (E2).** Capacitação permanente é ROP de acreditação. Adicionar seção "educação do período" (turmas concluídas + % aderência + certificados) ao bundle — **maior valor de integração e está faltando explicitamente**.
- **O roadmap não tem dimensão de IA na Educação.** Quick wins que reusam pipeline existente: **geração de rascunho de questões** a partir do material (mesmo fluxo do `QuestionBankImporter` com Zod+dry-run+rollback já pronto) e **captions Whisper rascunho→revisão** (fecha WCAG 1.2.2, pendência HIGH aberta).

**Outros achados:** "matriculado" hoje é heurística (`trilhasAplicaveis>0`) — não há matrícula/turma real (bloqueador de relatório de auditor); cobrança de prazo é **client-side** (só dispara se o aluno abrir o app — auditor não pode confiar); quiz de curso (Firestore) e quiz ROP (Supabase) são **duas arquiteturas** que a migração v2 deveria *convergir*, não só portar.
**Diferencial maduro a proteger:** `sign-cert` (HMAC server-side, JWT-gated) + `/verificar/:uuid` público — nenhum LMS médico B2B BR oferece. O relatório de turma verificável deve reusar exatamente essa infra.

---

## 7. Residência multi-especialidade

**Achado central:** o código **já separou acidentalmente** o *motor genérico* (helpers de data `getSlotEfetivo`/`getProximoDiaUtil`/`isDiaNaoUtil`, services de override por slot/dia, engine de troca TR/SB/PH) dos *dados de anestesia* (catálogo de estágios, pessoas, feriados, escala de Bromage). **Generalizar é majoritariamente extrair os dados estáticos para configuração por-programa e injetá-los — não reescrever lógica.**

- **Núcleo comum** (qualquer residência): `programa`, `residente`, `rotacao`, `plantao` + overrides, `troca`, `logbook_entry` (⚠️ **sem identificação de paciente**), `avaliacao`, `carga_horaria`.
- **Plugin por especialidade** (trocável): catálogo de estágios, catálogo de procedimentos + metas, matriz de competências CNRM, escalas clínicas (Bromage → uma escala-plugin), limiares de alerta.
- **Cateter peridural é a prova de conceito do logbook** — generalizar `cateteres_peridural`+`followup` em `logbook_entry` + `catalogo_procedimentos` + `escalas_clinicas`.

**Regulatório (fontes verificadas):** Lei 6.932/81 — **60h/sem, ≤24h de plantão, 1 folga semanal, 30 dias/ano**. CNRM Res. 2/2023 e 5/2023 — avaliação por competências (mín. quadrimestral; progressão exige nota ≥7 cognitiva + "Satisfatório" prático). **Logbook eletrônico nacional NÃO é obrigatório** (SisCNRM cobre credenciamento/certificados, não case log individual) → **oportunidade de produto sem padrão imposto**. Benchmark internacional (MedHub, New Innovations, one45, MyEvaluations, ACGME ADS) converge em **4 colunas: scheduling, duty hours, avaliações/milestones, case log** = exatamente o núcleo comum. **ANEST já tem scheduling+trocas maduros** (vantagem rara); falta formalizar duty-hours (parametrizável: BR 60h fixo ≠ ACGME 80h/4sem), avaliação estruturada e logbook genérico.

**Faseamento:** Fase 0 extrair o motor (refactor, anestesia idêntica) → Fase 1 modelo multi-programa em banco → Fase 2 logbook genérico (cateter vira instância) → Fase 3 avaliação + carga horária → Fase 4 matriz de competências como dado → Fase 5 IA.

---

## 8. Inserção de escala pelo comprador (mobile + desktop)

**O gargalo nº 1 de onboarding de qualquer cliente** — e hoje a escala está hardcoded no bundle. Padrão validado: **File → Map → Validate → Submit**, com template baixável, auto-mapping de colunas por heurística, validação inline (erro aponta linha/coluna) e preview do diff antes de confirmar.

Fluxo proposto em camadas:
- **P0 (importador assistido):** colar/upload de planilha (Excel/Sheets) → mapeamento de colunas (auto + override) → preview matriz recurso×período/dia com conflitos destacados → confirma. Cobre os 3 tipos (anestesiologistas/funcionários, residentes, sobreaviso) com regras próprias (12h útil/24h fds, rollover, feriados).
- **P1 (edição contínua):** grid/calendário editável (atribuição por célula), **templates recorrentes**, **"copiar período anterior"**, validação de conflito (recurso em 2 lugares no mesmo slot). Mobile: bottom sheets + atribuição rápida na thumb zone.
- **P2 (IA):** normalizar planilha heterogênea/bagunçada → JSON estruturado sugerido (extração com structured output), sugerir grade equânime, detectar violação de jornada — **sempre com revisão humana do diff**.

---

## 9. IA no produto — princípios, quick wins, guardrails

**Princípios (Anthropic/OpenAI/NIST/WHO):** **workflow-first, não agente** (para sumarizar/extrair/buscar, 1 chamada bem-promptada + retrieval + **structured output** bate um agente em custo/latência/erro); **draft-not-autopublish** (IA gera rascunho, humano aprova no fluxo existente); **grounding + citação verificável** (cada afirmação linka à fonte; permitir "não sei"); **eval set ligado ao CI** (sem check executável, "parece pronto" é o único sinal — inaceitável em produto médico). ⚠️ **Prefill foi deprecado no Claude 4.6+** → usar Structured Outputs nativos. ⚠️ OpenAI descontinua Evals hosted em 30/11/2026 → manter eval em código próprio. Já existe a edge `ai-rag` no projeto como base.

**Quick wins (alto valor / baixo risco regulatório), por ROI:**
1. **Importador de escala assistido** (planilha bagunçada → JSON sugerido) — ataca o gargalo de onboarding.
2. **Sumário de RCA de incidente / atas** (rascunho com citação ao texto-fonte).
3. **Rascunho de comunicado / plano PDCA** (entra como rascunho no fluxo de aprovação existente).
4. **Busca semântica** sobre Biblioteca/POPs/notícias (sempre devolve o documento-fonte; upgrade de full-text → vetorial via `ai-rag`).
5. **Captions/transcrição** de vídeo educacional (rascunho revisável; fecha A11y HIGH).
6. **Geração de questões de quiz** (reusa pipeline `QuestionBankImporter`).
7. **Triagem/classificação de incidente** (tipo+gravidade pré-preenchidos, editáveis; combater automation bias).

**Fronteira proibida (vira SaMD — fora de todo o roadmap):** recomendação de conduta/dose, score preditivo individual, diagnóstico, triagem clínica autônoma. Calculadoras permanecem ferramentas determinísticas com humano interpretando — nunca "a IA recomenda a conduta".

---

## 10. Trust & Security como venda

Para hospital BR, **nem SOC 2 nem ISO 27001 são obrigatórios por lei** — o blocker prático é **LGPD + DPA + isolamento multi-tenant comprovável**. Moeda de confiança early-stage:
- **P0:** DPA (operador) assinado por tenant **antes** de processar dado de paciente; base legal de saúde é **"tutela da saúde por profissional"** (art. 11 II "f"), **não consentimento universal**; proibir contratualmente uso de dado do tenant para finalidade própria (treinar modelo/analytics); isolamento multi-tenant + cripto + RBAC; **Trust Center público** (subprocessadores Supabase/Firebase, cripto, RBAC, audit log, RIPD, DPO) — substituto legítimo de certificado na fase inicial.
- **P1:** RIPD (DPIA) por tratar dado sensível em escala (vira ativo de venda); cláusulas-padrão ANPD (Res. 19/2024) se a infra processa fora do BR.
- **P2:** pentest de terceiro + security whitepaper; SOC 2/ISO 27001 só quando um comprador exigir selo.

> Ressalva: incisos da LGPD vieram de espelho da lei + artigo jurídico. **Validar com advogado** antes de redigir DPA/RIPD — não é parecer jurídico.

---

## 11. Pré-flight da Plataforma (F1) — já levantado

Caso a Trilha B comece, o terreno já está mapeado (3 agentes, código real):
- **49 tabelas RLS; ~42–44 de negócio** (recebem `org_id`); **5 firmes de plataforma** ficam fora; **3 candidatas a global** (`noticias`, `rop_*`, `retention_policies`/`qmentum_weights`).
- **`DEFAULT current_org()` carimba os INSERTs sozinho** (premissa confirmada — 13 services de escrita não mudam; 3 fazem spread → `WITH CHECK` neutraliza). **O risco está na LEITURA**: ~13 SELECTs amplos dependem 100% da nova policy de org.
- **`current_org()` pode ser lookup puro em `profiles`** (igual ao `clearance_level` já em produção) → **desacopla F1 da auth/claim/Fase 1.6**; o claim no JWT vira otimização posterior.
- Pontos sem RLS a tratar manualmente: **api-v1** (token sem org), **16 edges service-role**, **~80 coleções Firestore** (mas as rules já leem custom claim → viável), **4 pontos de path de Storage**.
- **Decisões arquiteturais pendentes do dono** (quando B começar): admin de plataforma vs admin da org; fail-mode do `current_org()` (recomendado fail-closed); conteúdo de crons global vs por-org; schema mínimo de `organizations`.

---

## 12. Correções ao roadmap + itens operacionais

**Correções a aplicar no `roadmap-comercial-2026-06.md`:**
- Adicionar **SigQuali** ao quadro de concorrentes (verticalizado em saúde, ONA+ANS).
- Marcar **Residência como NÃO greenfield** (ResideGes, MEDBOLSO) — diferencial = logbook granular + matriz navegável.
- **Escala = paridade, não diferencial de IA** (batalha migrou p/ staffing-via-WhatsApp).
- **IA-no-eixo-qualidade tem janela fechando** (SoftExpert Copilot AI já em produção) — priorizar quick wins.
- Modelo de preço: **flat por organização escalonado por porte** + add-ons (não per-seat puro); âncora adjacente R$ 99–299/profissional.
- **Educação no pacote de evidências** (lacuna do E2).
- **Dimensão de IA** ausente no v2 (Educação) e nos épicos de Qualidade.
- Remover **"GesQ"** do quadro (não existe como produto; confusão com GestQual).

**Operacionais:**
- 🔑 **Firecrawl MCP com token 401 (inválido)** — rotacionar a chave (gerar no terminal do dono, setar via dashboard; nunca em chat — regra `secrets.md`). Sem isso, pesquisas web caem no fallback nativo (US-only, sem extração de conteúdo).
- ⚙️ **Prefill deprecado no Claude 4.6+** → migrar qualquer prefill-para-JSON para Structured Outputs nas features de IA.
- ⚙️ **OpenAI Evals hosted descontinua 30/11/2026** → manter lógica de eval em código próprio.
- 📎 Números de benchmark B2B (activation ~37%, TTV <5min) são ordens de grandeza de blogs secundários — confirmar na fonte primária antes de virar OKR.

---

## 13. Recomendação e próximo passo

**Recomendação de fundador:** começar pela **Trilha A**, na ordem A1→A2→A4 (a cadeia PDCA + pacote de evidências), porque é onde está o diferencial de venda, é demonstrável **hoje** no tenant ANEST, e não paga o custo/risco da reescrita RLS antes de o produto estar afiado. **A1 (incidente→plano)** é a primeira pedra: baixo esforço (padrão já existe na auditoria), valor máximo de demo, e gancho natural do primeiro quick win de IA (rascunho de plano a partir do RCA). A Trilha B (multi-tenancy) entra quando houver intenção concreta de onboard de um 2º tenant — com o pré-flight já pronto (§11).

> Próxima decisão (§ a confirmar com o dono): começar a **construir A1 agora**, ou priorizar outra frente (importador de escala A5, ou abrir a Trilha B em paralelo)?
