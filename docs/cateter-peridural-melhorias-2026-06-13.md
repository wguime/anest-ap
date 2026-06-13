# Cateter Peridural — Análise de melhorias e acreditação (2026-06-13)

Levantamento completo do módulo para sustentar evolução e **acreditação (Qmentum/ONA)**.
Itens marcados ✅ já foram implementados nesta data; os demais são roadmap priorizado para
decisão do dono (vários são **decisões clínicas** dele).

Legenda: impacto **[A]**lto / **[M]**édio / **[B]**aixo · esforço **P**equeno / **M**édio / **G**rande.

---

## Já entregue nesta data (2026-06-13) ✅
- **Evolução PO por data** com nº de PO derivado (PO0 = inserção; N avaliações/dia). Migration
  `20260628110000` aplicada em prod.
- **Audit-trail** reforçado: `requireUserId` em criar/editar evolução (sem fallback `'Usuario'`),
  `updated_by` do editor; toasts não-bloqueantes quando a notificação falha.
- **Resiliência** dos lembretes (re-tenta erro transitório com teto 3, sem loop de 403).
- **Listagem sem redundância**: cards Ativos/Total removidos (duplicavam abas); "Alertas" virou
  chip contextual; ordenação por urgência; busca de paciente na lupa do header (cobre paciente/
  leito/anestesista/residente).
- **Quick wins**: Bromage legível, grids responsivos, scroll-to-form, a11y nos cards (teclado/
  aria), touch ≥44px, limpeza do campo fantasma `setor`.

---

## Acreditação (Qmentum / ROP 5.4) — reusar o padrão de indicadores do app
O app já tem infra de indicadores: `src/data/indicadores-2025.js` (metadados + dimensões de
qualidade), `src/hooks/useKpiData.js`, `src/services/supabaseKpiService.js` (tabela
`kpi_dados_mensais`, com `validado_por`/`fonte`) e `KPICard`. Os indicadores abaixo encaixam
nesse padrão (numerador/denominador mensal) e se vinculam à **ROP 5.4** (bundle de dispositivo
invasivo + revisão diária da necessidade — `src/data/ropCriteriaConfig.js`).

| Indicador | O que mede | Dados | Esforço |
|---|---|---|---|
| **% retirada ≤96h** [A] | conformidade com o limite de permanência | já existem (`data_insercao`, `data_retirada`) | M |
| **Taxa de complicação/infecção** [A] | segurança do dispositivo | `complicacoes` (cateter + followup) — ganharia muito com enum (ver clínico) | M |
| **Completude da evolução PO** [M] | documentação diária completa (sítio, Bromage, etc.) | followup já tem os campos | M |
| **Conformidade de bundle (ROP 5.4)** [A] | checklist de prevenção + revisão diária | **tabela nova** `cateteres_peridural_bundle_checklist` | G |
| **Rastreabilidade consultável** [M] | quem inseriu/avaliou/editou/retirou | já gravado (`*_por`, `updated_by`); falta UI tipo `AuditTrailModal` | M |

> Caminho sugerido: começar por **% retirada ≤96h** (dado já existe, só agregação mensal) reusando
> `indicadores-2025.js` + `useKpiData`, exibido num card no Dashboard Executivo
> (`DashboardExecutivoPage`). Depois bundle ROP 5.4 (maior, exige tabela + form).

---

## Melhorias clínicas — DEPENDEM DE DECISÃO DO DONO (anestesista)
Estruturar dado hoje em texto livre. Cada um exige validação clínica do protocolo do serviço.

- **[A/M] EVA 0–10 estruturada** por PO (hoje dor cai em `complicacoes` texto livre) — habilita
  tendência de efetividade analgésica.
- **[A/G] Infusão estruturada** (fármaco + concentração + dose + tipo contínua/bolus) no lugar do
  `taxa_infusao` texto livre — habilita checagem de dose e auditoria de protocolo por hospital.
- **[A/M] Vigilância de infecção** sistematizada (expandir sítio + sinais objetivos) em vez de só
  5 opções de `sitio_insercao`.
- **[M] Anticoagulação/contraindicações** na inserção (hematoma peridural é evento grave) —
  campo hoje inexistente.
- **[M] Complicações como MultiSelect** (hoje 1 só por avaliação; paciente pode ter várias).
- **[P/M] Papel do avaliador** (executante vs supervisor) na evolução.

---

## UX/produto maiores (não-clínico)
- **[M] Aba/filtro "Alertas"** dedicada além do chip atual (lista só os em risco).
- **[M] Timeline** da evolução PO (DS `timeline.jsx`) no lugar de cards soltos.
- **[M/G] Analytics** do cateter (Recharts): tendência de EVA/Bromage, distribuição de sítio,
  top complicações — depende dos campos clínicos acima.
- **[B] Botão "Retirar cateter" direto** no detalhe (hoje `RemoverCateterModal` existe mas só via
  toggle na evolução).
- **[B] Cateteres na busca global** (`supabaseSearchService` não indexa o módulo hoje).

---

## Observações de conformidade
- **LGPD**: o módulo guarda PHI (nome, leito, cirurgia) sem política de retenção/anonimização —
  decisão pendente do dono (comparar com `infra_health_history`, retenção 90d). Não bloqueia, mas
  é item de acreditação a endereçar conscientemente.
- **Drift de migrations** consolidado em `supabase/migrations/` (canônico) em 2026-06-12/13.
