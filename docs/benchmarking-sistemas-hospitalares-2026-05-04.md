# Benchmarking — Sistemas de Notificação de Incidentes & Denúncias

**Data:** 2026-05-04
**Versão ANEST avaliada:** v3.70.0
**Escopo:** Módulo de Incidentes & Denúncias (`src/pages/incidents/`, `src/data/incidentesConfig.js`, Edge Function `notify-incident`, Centro de Gestão)
**Comparados:** NOTIVISA/VigiMed (ANVISA), NSP (RDC 36/2013), NHS LFPSE (V6), JCAHO Sentinel Event Policy, FDA MedWatch 3500/3500A, VAERS, WHO ICPS, NCC MERP, NAVEX EthicsPoint, Lei 13.964/2019 + Decreto 10.153/2019

---

## Sumário Executivo

ANEST V2 já implementa **base sólida** alinhada à RDC 36/2013 (NSP) e ao Decreto 10.153/2019 (canal seguro com pseudonimização e tracking). As lacunas críticas estão em: **(1)** taxonomia de severidade não-mapeada formalmente para WHO ICPS / NCC MERP, **(2)** ausência de classificação "Never Events / Sentinel Events" alinhada à JCAHO/NQF (em transição para 28 SREs em 2027), **(3)** workflow de RCA estruturado não-existente, e **(4)** retenção explícita (CFM 1.821/2007 = 20 anos físicos / permanente digital; Decreto 10.153 = 100 anos para identidade do denunciante) ainda não declarada em código nem em UI.

A escolha estratégica recomendada para A8 é manter **comunicação unidirecional** (relator → comitê via tracking code) com texto de aviso explícito em vez de implementar mailbox bidirecional anônimo no curto prazo — justificativa detalhada na Seção 5.

---

## Tabela Comparativa

| Sistema | Severidade | Tracking anônimo | Mensagem 2-way anon | Retenção | Campos obrigatórios | Aplicabilidade BR |
|---|---|---|---|---|---|---|
| **NOTIVISA / VigiMed** (ANVISA) | 4 níveis (sem dano, leve, moderado, grave/óbito) | Sim (pseudonimizado) | Não (apenas via Vigilância) | 20 anos (CFM 1.821) | NSP institucional, paciente, evento, data, classificação | Obrigatório p/ EAS no BR; óbito em 72h, demais até 15º dia útil mês subsequente |
| **NSP (RDC 36/2013)** | Conforme NOTIVISA | N/A (interno) | N/A | 20 anos | Plano Segurança do Paciente, evento, ação, monitoramento | Obrigatório todo serviço de saúde BR |
| **NHS LFPSE V6** | 5 categorias (No Harm, Low, Moderate, Severe, Death) | Sim | Não (estruturado em PSIRF) | NHS data retention policy | Incident, Good Care (mandatório); Risk, Outcome (opcional) | Não-obrigatório BR; referência metodológica |
| **JCAHO Sentinel Event** | Death / Severe Harm / Permanent Harm + 28 SREs (a partir 2027) | Não (interno) | Não | RCA + POA arquivados perpetuamente | RCA, Plan of Action, Bibliography (45 dias úteis) | Aplicável a hospitais BR JCI-acreditados |
| **FDA MedWatch 3500/3500A** | Serious / Non-serious (death, life-threatening, hospitalization, disability, congenital anomaly) | Sim (3500B consumidor) | Não | Indefinida (FDA Safety Reporting Portal) | Patient (A), Event (B), Suspect Product (D), Reporter (E), Manufacturer (G) | Análoga ao VigiMed BR |
| **VAERS** | Serious / Non-serious | Sim | Não | Permanente | Vacina, data, evento, demografia, histórico | Não-aplicável BR (BR usa e-SUS Notifica) |
| **WHO ICPS** | 4 levels (Adverse Event, No Harm Incident, Near Miss, Reportable Circumstance) | Não normatiza | Não normatiza | Não normatiza | 10 high-level concepts + ~600 conceitos | Framework conceitual universal |
| **NCC MERP** | 9 categorias A→I (A=potencial; I=óbito) | Não normatiza | Não normatiza | Não normatiza | Específico medication errors | Adotado como padrão por SBA/SOBRAFO |
| **NAVEX EthicsPoint** | N/A (compliance, não clínico) | Sim (chat criptografado) | **Sim — chat 2-way criptografado por código + senha** | Configurável por cliente (3-7 anos típico) | Customizado; multilíngue | Não-obrigatório BR; benchmark de mercado |
| **Lei 13.964/2019 + Dec 10.153/2019** | N/A | **Obrigatório (pseudonimização)** | Não-normatizado, mas exigido na prática | **100 anos para identificação** | Canal gratuito; sigilo; rastreabilidade de acessos | **Obrigatório no BR** (admin pública + exigível p/ saúde por analogia) |

**Notas:**
- *NCC MERP* é o padrão de referência para erros de medicação no Brasil (SBA/SOBRAFO), porém ANEST não usa essa nomenclatura A-I.
- *JCAHO* lança a unificação NQF SRE com 28 categorias em janeiro de 2027 — antecipar agora reduz retrabalho.
- *Decreto 10.153/2019* aplica-se diretamente à administração pública, mas instituições de saúde privadas tendem a adotar padrões equivalentes via Compliance/LGPD.

---

## Análise de Gaps — Top 7

| # | Gap | ANEST tem? | Severidade | Esforço | Detalhe |
|---|---|---|---|---|---|
| 1 | **Mapeamento WHO ICPS / NCC MERP na severidade** | ⚠ Parcial | Média | Pequeno | ANEST tem 5 níveis (`near_miss/leve/moderado/grave/critico`). NCC MERP tem 9 (A-I). WHO ICPS tem 4. Sugestão: anotar mapping em `SEVERITY_LEVELS` (campo `whoIcpsCode`, `nccMerpCategory`) sem mudar UX |
| 2 | **Classificação "Never Event / Sentinel Event"** | ✗ Ausente | **Alta** | Médio | Eventos como "cirurgia em local errado", "corpo estranho retido", "paciente trocado" já existem em `INCIDENT_TYPES` mas não há flag booleano `isNeverEvent` que gere alerta vermelho + workflow obrigatório. JCAHO 2027 exige 28 SREs explícitos |
| 3 | **Workflow de RCA estruturado** | ⚠ Parcial | **Alta** | Grande | `gestaoInterna.rca` existe como campo opaco. JCAHO exige (a) Causal factors, (b) Plan of Action, (c) Bibliography, em 45 dias úteis. Sugestão: criar `rcaTemplate` com 5-Whys + Fishbone + responsáveis + prazos |
| 4 | **Mensageria 2-way para denúncias anônimas** | ✗ Ausente | Média | Médio/Grande | EthicsPoint, FaceUp, AllVoices oferecem chat criptografado. ANEST tem apenas `feedbackAoRelator` (one-way). Decisão recomendada: MANTER one-way (ver Seção 5) |
| 5 | **Política de retenção explícita** | ✗ Ausente | **Alta** | Pequeno | CFM 1.821/2007 exige 20 anos (físico) / permanente (digital). Decreto 10.153/2019 exige 100 anos para identidade do denunciante. ANEST não tem `retention_policy` em código nem aviso UX. Sugestão: documentar em `lgpd.md` + adicionar timestamp `retainUntil` no schema |
| 6 | **Criptografia at-rest para denúncias confidenciais** | ⚠ Parcial | **Alta** | Médio | Supabase faz encryption-at-rest no PostgreSQL por padrão (AES-256), porém **campos sensíveis (descrição, profissionais) não são criptografados em coluna específica** (column-level). Best practice EthicsPoint: criptografar payload da denúncia com chave separada. Avaliar `pgcrypto` para `denuncia.descricao` quando `tipoIdentificacao='confidencial'` |
| 7 | **Integração obrigatória ANVISA (NOTIVISA submission)** | ✗ Ausente | Média | Grande | RDC 36/2013 obriga NSP a notificar ANVISA até 15º dia útil do mês seguinte (óbito em 72h). ANEST não exporta para NOTIVISA. Sugestão: gerar relatório CSV no formato VigiMed exportável, mesmo que submissão final permaneça manual |

**Gaps adicionais (menor prioridade):**
- **Badge "Mandatory ANVISA"** no UI quando severidade=`critico` ou `grave` (informa NSP)
- **Trending de incidentes** por causa-raiz (atual só conta tipo/severidade)
- **VTE prophylaxis check** ausente (Qmentum gap conhecido)
- **Aldrete/PACU score** ausente (Qmentum gap conhecido)

---

## Recomendação — Mensageria Anônima (CRÍTICO p/ A8)

**Decisão recomendada: (b) MANTER unidirecional + aviso explícito.**

**Justificativa:**

1. **Realidade do canal**: ANEST é app médico de uma clínica/cooperativa de anestesiologia (não é uma plataforma multinacional como EthicsPoint). Volume estimado de denúncias é baixo (<10/mês), o que não justifica custo de:
   - Infra de chat criptografado E2E
   - Treinamento do Comitê de Ética para responder
   - SLA de resposta em chat

2. **Risco LGPD do bidirecional**: Mensagens em mailbox anônimo viram dados pessoais sensíveis (Art. 11) — qualquer texto que o relator escreva pode reidentificá-lo. EthicsPoint mitiga com criptografia E2E; replicar isso em Supabase exige `pgcrypto` + key management próprio, fora do escopo atual.

3. **Compliance brasileiro já satisfeito**: Decreto 10.153/2019 exige *preservação de identidade*, não *diálogo bidirecional*. Tracking code unidirecional + `feedbackAoRelator` atende ao requisito.

4. **Roadmap futuro**: Se demanda surgir, EthicsPoint cobra ~USD 5k-15k/ano; alternativa open-source (FaceUp, GlobaLeaks) pode ser plugada como redirect externo do botão "Denúncia".

### Texto de Aviso (UX) — wording exato sugerido

Local: caixa amarela na seção "Identificação" quando `tipoIdentificacao === 'anonimo'` (já existe parcialmente em `NovoIncidentePage.jsx:225-241` e `NovaDenunciaPage.jsx:481-495`). Substituir o texto atual por:

> **Relato anônimo — leia antes de prosseguir**
>
> - Você receberá um **código de rastreio** (formato `ANEST-AAAA-XXXXXXXX`) que será exibido na tela seguinte.
> - **Guarde o código em local seguro:** ele é a **única forma** de consultar o andamento. Se perder, não conseguiremos recuperá-lo nem identificar seu relato (LGPD Art. 12 — anonimização irreversível).
> - O Comitê de Ética **não conseguirá entrar em contato** com você diretamente, nem por e-mail, nem telefone, nem mensagem.
> - Quando houver devolutiva, ela aparecerá em "Rastrear Relato" ao consultar seu código. Recomendamos consultar a cada **15 dias**.
> - Se quiser dialogar com o Comitê durante a investigação, escolha "Identificado" ou "Confidencial" em vez de "Anônimo".
> - Esta escolha é **irreversível**: a identidade não pode ser anexada depois (LGPD Art. 12, Lei 13.709/2018).

### Schema sugerido para o campo `feedbackAoRelator`

```js
// gestaoInterna.feedbackAoRelator (estender estrutura existente)
{
  versoes: [
    {
      id: 'fb-1',
      texto: '...',
      autor: 'comite_etica',
      data: '2026-05-04T...',
      visivelAoRelator: true
    }
  ],
  ultimaAtualizacao: '2026-05-04T...',
  // NÃO há campo "respostaDoRelator" — confirma natureza unidirecional
}
```

---

## Próximos Passos Priorizados (ordem sugerida)

### 1. **[Pequeno]** Adicionar mapping ICPS / NCC MERP em `SEVERITY_LEVELS`
   Acrescentar campos `whoIcpsCode` e `nccMerpCategory` em cada nível (`incidentesConfig.js:129-175`). Não muda UX, mas habilita exports auditáveis para ANVISA/JCAHO.
   **Arquivo:** `src/data/incidentesConfig.js`

### 2. **[Pequeno]** Documentar política de retenção em `docs/lgpd.md` + UI
   - Texto: "Dados retidos por 20 anos conforme CFM 1.821/2007. Identidade de denunciante preservada por 100 anos conforme Decreto 10.153/2019."
   - Adicionar coluna `retain_until DATE` na tabela `incidentes` (calculada por trigger).
   **Arquivos:** `docs/lgpd.md` (criar), `supabase/migrations/00X_retention.sql`

### 3. **[Médio]** Implementar flag `isNeverEvent` + alerta vermelho
   Marcar como Never Event automaticamente: `cirurgia.local_errado`, `cirurgia.procedimento_errado`, `cirurgia.paciente_errado_cir`, `cirurgia.corpo_estranho`, `identificacao.paciente_trocado`, `severidade=critico` com `danoAoPaciente=obito`. Quando detectado, forçar prioridade urgente + RCA obrigatório em 45 dias.
   **Arquivos:** `src/data/incidentesConfig.js`, `src/pages/incidents/NovoIncidentePage.jsx`, Edge Function `notify-incident`

### 4. **[Médio]** Atualizar texto de aviso anônimo (Seção 5 acima)
   Wording novo no `NovoIncidentePage.jsx:225-241` e `NovaDenunciaPage.jsx:481-495`. Replicar em `public/formulario-incidente.html` e `public/formulario-denuncia.html` (atenção: HTML estático, não usa React).

### 5. **[Grande]** Workflow de RCA estruturado
   Criar página `IncidenteRCAPage.jsx` com:
   - Aba "5 Whys"
   - Aba "Fishbone (Ishikawa)"
   - Aba "Plano de Ação" (responsável + prazo + status)
   - Aba "Bibliografia" (referências do RCA)
   - Status: "RCA pendente" / "RCA em andamento" / "RCA concluído"
   - Trigger automático quando `isNeverEvent=true` ou `severidade=critico`.
   **Arquivos:** novo `src/pages/incidents/IncidenteRCAPage.jsx`, schema Supabase

### 6. **[Grande]** Export VigiMed/NOTIVISA
   Botão "Exportar para ANVISA" em `IncidenteGestaoPage` que gera CSV no formato esperado pelo NOTIVISA (ainda submissão manual ao portal).

---

## Referências (fontes)

### NOTIVISA / ANVISA / RDC 36/2013
- [Resolução RDC nº 36/2013 — ANVISA (BVS Saúde)](https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2013/rdc0036_25_07_2013.html)
- [NOTIVISA 2.21 — Portal Anvisa Cidadão](https://www16.anvisa.gov.br/notivisaServicos/cidadao/notificacao/evento-adverso)
- [Notificação de incidentes — gov.br/anvisa (FAQ)](https://www.gov.br/anvisa/pt-br/acessoainformacao/perguntasfrequentes/servicos-de-saude/notificacao-de-incidentes-e-eventos-adversos-relacionados-a-assistencia-a-saude)
- [Nota Técnica nº 09/2025 — ANVISA (orientações 2025)](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-09-2025-notificacoes-ea-2025-25-07-2025-002.pdf)

### NHS LFPSE
- [LFPSE service — NHS England](https://www.england.nhs.uk/patient-safety/patient-safety-insight/learning-from-patient-safety-events/learn-from-patient-safety-events-service/)
- [LFPSE V6 Taxonomy — Radar Healthcare](https://radarhealthcare.com/news-blogs/what-is-the-lfpse-v6-taxonomy-everything-you-need-to-know/)
- [Data principles — NHS LFPSE](https://record.learn-from-patient-safety-events.nhs.uk/data-principles)

### JCAHO / Sentinel Events
- [Sentinel Event Policy & Procedures — Joint Commission](https://www.jointcommission.org/en-us/knowledge-library/support-center/standards-interpretation/sentinel-event-policy-and-procedures)
- [Aligning Patient Safety Event Reporting (Jan 2026) — Joint Commission PDF](https://digitalassets.jointcommission.org/api/public/content/b4e8988066e74717ae9801edb2bfb9de?v=071ea64a)
- [Joint Commission and NQF Aligning SRE/Sentinel Lists 2027](https://www.jointcommission.org/en-us/knowledge-library/news/2026-01-joint-commission-and-nqf-aligning)

### WHO ICPS
- [WHO Conceptual Framework for International Classification for Patient Safety (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2638753/)
- [WHO ICPS Key Concepts and Terms — IJQHC](https://academic.oup.com/intqhc/article/21/1/18/1888152)
- [WHO IER PSP 2010.2 — Conceptual Framework PDF](https://apps.who.int/iris/bitstream/handle/10665/70882/WHO_IER_PSP_2010.2_eng.pdf)

### FDA MedWatch / VAERS
- [MedWatch Forms — FDA](https://www.fda.gov/safety/medical-product-safety-information/medwatch-forms-fda-safety-reporting)
- [Form FDA 3500 PDF](https://www.fda.gov/media/76299/download)
- [VAERS — vaers.hhs.gov](https://vaers.hhs.gov/)

### NCC MERP
- [Categorizing Medication Errors — NCC MERP](https://www.nccmerp.org/types-medication-errors)
- [NCC MERP 2022 Revision PDF](https://www.nccmerp.org/sites/default/files/2022ncc-merp-categorizing-medication-errors-index.pdf)
- [Decoding Medication Errors: NCC MERP Severity Index — Pharmacy Times](https://www.pharmacytimes.com/view/decoding-medication-errors-the-ncc-merp-severity-index)

### NAVEX EthicsPoint
- [EthicsPoint Professional — NAVEX](https://www.navex.com/en-us/platform/whistleblowing-software-solutions/ethicspoint-professional/)
- [NAVEX Incident Reporting Follow-up](https://secure.ethicspoint.com/domain/en/default_reporter.asp?pagetype=followup)
- [The Whistleblowing Process — NAVEX](https://www.navex.com/en-us/platform/employee-compliance/whistleblowing-process/)

### Brasil — Whistleblower
- [Lei 13.964/2019 — Lei Anticrime (Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/L13964.htm)
- [Decreto 10.153/2019 — Planalto](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d10153.htm)
- [Proteção ao denunciante — CGU](https://www.gov.br/cgu/pt-br/assuntos/noticias/2019/12/governo-federal-publica-decreto-para-proteger-a-identidade-do-denunciante)

### Retenção de Prontuários BR
- [Resolução CFM nº 1.821/2007 — Conarq](https://www.gov.br/conarq/pt-br/legislacao-arquivistica/resolucoes/resolucao-cfm-no-1-821-de-11-de-julho-de-2007)
- [Resolução CFM 1.821/2007 PDF — CFM](https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2007/1821_2007.pdf)
- [Lei 13.787/2018 — Prontuário Eletrônico (CONJUR)](https://www.conjur.com.br/2021-mar-21/opiniao-lgpd-saude-importancia-lei-1378718/)

---

**Auditor:** Claude Opus 4.7 (Codex-style benchmark)
**Próxima revisão:** após implementação dos passos 1-4 (estimativa: 2026-06-01)
