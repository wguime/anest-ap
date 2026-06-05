# Plano — Avaliação Pré-Anestésica (APA)

> **Status:** planejamento (kickoff 2026-06-02; revisões 2026-06-03). Protótipo **isolado** do app atual para teste de viabilidade antes de incorporar.
> **Origem:** auditoria multi-agente em 4 rodadas — (1) estado da arte global + evidência clínica 2022-2026 + arquitetura ANEST + stack de form; (2) QMENTUM/CFM + fichas acreditadas reais + modelo ambulatorial + red-team; (3) benchmark BR AxReg (Anestech) e HealthChess; (4) **workflow de fact-check (57 afirmações), UI/UX (45 recs), verificação adversarial e auditoria** — conteúdo clínico/regulatório majoritariamente confirmado; 13 correções de fato aplicadas (§ várias), 2 críticos (Gupta, adendos — §18).
> **⚠️ Decisões reabertas:** D4 (isolamento), D3 (escopo v1) e D9 (assinatura paciente) — ver §18.

## 1. Visão

Sistema completo e interativo de **criação e avaliação pré-anestésica**: uma ficha clínica multi-seção onde, conforme o anestesiologista preenche, **calculadoras de risco rodam automaticamente** e produzem uma estratificação de risco visual e um laudo padronizado — baseado nas melhores evidências (ASA, ACC/AHA 2024, ESC 2022, ESAIC 2023) e **conforme/auditável para QMENTUM + CFM 2174/2017**. Dois modos: **ficha completa** e **ficha ambulatorial/fast-track** (§7), sobre um único modelo de dados.

**Princípios de produto** (destilados das líderes globais — MyPreOp/Ultramed, Synopsis iQ, Hoopcare, MyRISK — e das BR AxReg/AnestSafe):
1. **Auto-cálculo em tempo real** com **semáforo verde/laranja/vermelho** (AxReg usa para Aldrete; MyRISK SUS 90/100).
2. **Listas de respostas pré-definidas + seções numeradas** para minimizar digitação no tablet (padrão AxReg v4).
3. **Clinical Summary** que destaca áreas de preocupação + exames recomendados (MyPreOp).
4. **Alertas de medicação a suspender** (anticoagulantes, AAS, GLP-1, SGLT2i) — diferencial AnestSafe.
5. **Salvar rascunho / retomar + autosave offline** (centro cirúrgico tem rede ruim; AxReg perde pontos em sync — nosso PWA pode ganhar aqui).
6. **Mobile/tablet-first** — ≥44px touch; mas **web/PWA responsivo** (AxReg é iOS-only → nossa vantagem de alcance).
7. **Laudo padronizado + assinatura digital** (artefato final, igual às três fases do AxReg).
8. **Conformidade explícita CFM 2174 + QMENTUM** — nenhum concorrente BR faz esse claim (diferencial nosso).

## 2. Decisões

| # | Decisão | Escolha | Status |
|---|---------|---------|--------|
| D1 | Modelo do paciente | **Tabela `pacientes` separada + FK** (histórico, reuso, busca) | ✅ travada |
| D2 | Stack de formulário | **react-hook-form + @hookform/resolvers + zod 4** (`useWatch` escopado) | ✅ travada |
| D3 | Escopo v1 | **Enxuto p/ viabilidade** — valida telas + cálculos + UX | ✅ travada |
| D4 | Isolamento | **Entry Vite client-only** (mini-app separado, SEM backend no v1; só localStorage) | ✅ travada |
| D9 | Assinatura paciente | **Upload de termo físico assinado** (signature pad = roadmap) | ✅ travada |
| D10 | Backend (quando persistir) | **Branch Supabase descartável** (nunca produção) — fase posterior, após validar viabilidade | ✅ travada |
| D5 | Base legal LGPD | **Tutela da saúde (Art. 11, II, "f")**; retenção CFM (§4) | ✅ travada |
| D6 | Acreditação | **Compatível QMENTUM + CFM 2174/2017** (§9) | ✅ travada |
| D7 | Ambulatorial | **Modelo de dados único + preset "ambulatorial"** dirigido por triagem (§7) | ✅ travada |
| D8 | População v1 | **Adulto não-gestante** (escores não validados em ped/obstetrícia) — declarar e avisar fora da faixa | ✅ travada |

## 3. Estratégia de isolamento (premissa corrigida pelo red-team)

> **Correção factual (validada no código):** os "entries isolados" existentes do projeto (`public/gestao-incidentes.html`, `public/formulario-incidente.html`) são **HTML vanilla com Supabase via CDN — NÃO usam React, DS nem aliases `@`**. Portanto "um entry Vite que reusa o DS" **não tem precedente** — é padrão de build inédito. Pior: um entry isolado **não tem Firebase Auth/`UserProvider`**, e `src/config/supabase.js` exige `_authReady` + `Bearer <firebaseIdToken>` em toda query → **a persistência Supabase não funciona** sem reconstruir login/providers, e a RLS (via `firebase_uid()`) bloqueia tudo (0 rows + PGRST116).

**✅ ESCOLHIDO: Opção C — entry Vite client-only** (separação física máxima, sem backend no v1). O v1 valida telas + ~16 cálculos de risco + UX guardando em **localStorage**; sem login/Supabase (evita o problema de auth do C2). Persistência = fase posterior contra **branch Supabase descartável** (D10), só após o GO de viabilidade.

| Opção | Isolamento | Auth/persistência | Risco |
|---|---|---|---|
| A — case gated em `App.jsx` | lógico | reusa auth/Supabase reais → end-to-end | baixo |
| B — entry Vite separado completo | físico máximo | recria `UserProvider`+login+`index.css`+VitePWA | alto (build novo) |
| **C — entry Vite client-only ✅** | físico, sem backend | só localStorage no v1 | médio; adia persistência (aceito) |

**Atenção Fase 0 (opção C):** entry novo precisa `import './index.css'` (Tailwind), montar `ThemeProvider`+`Toaster`, e adicionar `/pre-anestesica.html` ao `navigateFallbackDenylist`+`globIgnores` do VitePWA (senão o service worker serve `index.html` no lugar). Padrão de build inédito no projeto — testar `npm run dev` e `npm run build`.

Estrutura de arquivos (comum a qualquer opção; a feature vive em `src/pre-anestesica/`):
```
src/pre-anestesica/
  PreAnestesicaApp.jsx           ← shell: lista ↔ form ↔ laudo
  data/ fichaSchema.js · fichaZodSchema.js · presets.js (completa | ambulatorial)
  components/ secoes/* · RiskScoreLive.jsx · RiskStratificationBadge.jsx · TriagemAmbulatorial.jsx
  context/PreAnestesicaContext.jsx · service/preAnestesicaService.js
src/lib/  ← libs puras dos escores (testáveis, reuso pelo app) — NÃO no diretório isolado
src/services/pdf/templates/fichaPreAnestesicaTemplate.js
supabase/migrations/<ts>_avaliacao_pre_anestesica.sql
```
**Backend de teste:** preferência por **branch Supabase** (`mcp__supabase__create_branch`, schema/RLS de teste, descartável) sobre criar tabela em produção (§18).

## 4. Modelo de dados (Supabase)

**Correção pós-auditoria (A4):** campos que alimentam KPI/RLS/compliance viram **colunas tipadas** (não JSONB enterrado) — JSONB só p/ texto livre e detalhes não consultados.

```
pacientes
  id uuid PK · nome_completo · data_nascimento date · sexo · prontuario · telefone
  created_at/updated_at timestamptz · created_by text (firebase_uid real)

avaliacoes_pre_anestesicas
  id uuid PK · paciente_id uuid FK → pacientes(id)
  numero_ficha text (identity/sequence Postgres, não MAX()+1 — B1)
  modo text CHECK (completa|ambulatorial)               -- preset (D7)
  status text CHECK (rascunho|finalizada|assinada|arquivada)
  caráter text CHECK (eletivo|urgencia|emergencia)
  -- colunas tipadas consultáveis (KPI/RLS/compliance):
  asa_ps text · asa_emergencia bool · via_aerea_dificil bool
  hipertermia_maligna_risco bool                         -- segurança (M1)
  risco_global text CHECK (verde|laranja|vermelho)
  rcri_score int · ariscat_classe text · stopbang_classe text · ...
  validade_ate timestamptz                               -- 48h é regra CMS/EUA, NÃO Brasil (CFM sem prazo fixo)
  reavaliacao_pre_inducao_em timestamptz                 -- Sign-in (§9.6)
  -- blocos clínicos JSONB (texto livre / detalhe):
  anamnese · exame_fisico · via_aerea · exames · reconciliacao_medicamentosa
  alergias · jejum · plano_anestesico · escores (snapshot completo)
  -- consentimento + assinaturas (C3):
  consentimento_obtido_em timestamptz
  consentimento_assinatura_paciente_path text            -- v1: upload de termo físico assinado; roadmap: signature pad (não há no DS) — ver §18
  signature_hash · signature_algo · signed_pdf_storage_path · signed_pdf_url  -- anestesista (SHA-256)
  -- imutabilidade forense + auditoria + LGPD:
  finalizada_em/por · legal_hold bool · deleted_at timestamptz
  created_by · updated_by · created_at/updated_at
  lgpd_base_legal default 'tutela_saude' · retain_until date

avaliacao_adendos                                         -- retificação de prontuário (CFM 1638/2002, 1821/2007, 2314/2022)
  id uuid PK · ficha_id FK · texto · autor text · created_at
  escore_afetado text · valor_anterior text · valor_novo text   -- registro estruturado "recalculado de A→B"
  -- nunca editar ficha assinada; snapshot original PRESERVADO; signature_hash cobre escores+campos de origem juntos
  -- adendo que corrige campo de origem deve propagar recálculo aos KPIs QMENTUM (§9.4)
```

**Grafo de status** (trigger, padrão `validateStatusTransition`): `rascunho → finalizada → assinada → arquivada`. Pós-`finalizada`: trigger bloqueia UPDATE de campos clínicos → correção só por `avaliacao_adendos`. DELETE físico proibido → soft-delete.

**RLS — modelo de acesso clínico (M4, corrigido):** "só autor" quebraria o handover (ROP). Regra: **leitura por qualquer anestesiologista autenticado** (need-to-know, base tutela da saúde), **edição só autor enquanto rascunho**, **admins tudo**. Cobrir os **4 verbos** (`feedback_rls_policy_completeness`). Documentar base legal por verbo.

**Retenção (M5):** `retain_until = finalizada_em + 20 anos` (menores: até 18 + 20). É retenção **mínima** (prontuário não se autodeleta); nada automático no vencimento. Direito ao esquecimento não se aplica sob tutela da saúde.

## 5. Escores clínicos (evidência 2022-2026)

### v1 — libs puras com auto-cálculo (`src/lib/`, + teste Vitest c/ boundaries E casos clínicos publicados — §15)

| Lib | Escore | Output / corte | Nota |
|-----|--------|----------------|------|
| `bmi.js` | IMC | kg/m²; classes OMS | input de STOP-BANG/risco |
| (campo) | **ASA-PS** I–VI + "E" | seleção c/ exemplos 2020 inline | alimenta MICA/NSQIP |
| `creatinineClearance.js` | **TFG: CKD-EPI 2021 de-indexado (mL/min) = primário; Cockcroft-Gault = legado/bula** | mL/min | **NOVO** — de-indexar pela BSA real (FDA 2024/NKF); input de RCRI/Gupta, ajuste de dose, ponte anticoag |
| `rcri.js` | **RCRI** (Lee) | 0–6; ≥2 → biomarcadores | ACC/AHA, ESC |
| `egri.js` | **El-Ganzouri** (via aérea) | 0–12; ≥4 → VA difícil | inclui Mallampati |
| `stopbang.js` | **STOP-BANG** (AOS) | 0–2/3–4/5–8 | crítico em ambulatorial |
| `ariscat.js` | **ARISCAT** (pulmonar) | <26/26–44/≥45 | coeficientes por item |
| `caprini.js` | **Caprini** (TEV) | ≥5 → profilaxia (cutoff de cirurgia geral; orto ≥10, fratura quadril ≥12) | ROP VTE; **fixar versão 2005 vs 2013** |
| `apfel.js` | **Apfel** (PONV) | 0–4 → 10/21/39/61/79% (Apfel 1999); ≥2 → profilaxia | ambulatorial |
| `clinicalFrailty.js` | **CFS** (Rockwood) | ≥5 → frágil | idoso |
| `dasi.js` | **DASI/METs** | **>34 baixo risco = preferido (evidência METS/Wijeysundera); ≥25 = alternativa emergente (Fleisher, não estabelecida)** | ACC/AHA 2024 preferido |
| `guptaMica.js` ⚠️ | **Gupta MICA** | logit eˣ/(1+eˣ); ≥1% elevado | **CRÍTICO: extrair coeficientes Gupta 2011 (Circulation) + validar; OU oferecer SORT como escore SEPARADO rotulado "mortalidade 30d" — NUNCA fallback silencioso (MICA=evento cardíaco ≠ SORT=mortalidade, desfechos distintos)** |
| `painScale.js` | **EVA/NRS dor** 0–10 | radio 0–10 (não Slider — B2) | **NOVO (M1)** |
| `aldrete.js` | **Aldrete modificado** (alta Fase I) | ≥9 libera; semáforo | ambulatorial (AxReg usa Aldrete-Kroulik) |
| `padss.js` | **PADSS modificado** (alta domiciliar) | ≥9, **nenhum critério=0 E sinais vitais nunca <2 (regras FORMAIS, Palumbo/Tellan 2013); confirmar variante 5 vs 6 critérios** | ambulatorial — diferencial vs AxReg |
| `whiteFastTrack.js` | **White fast-track** (pula PACU) | ≥12, nenhum <1 | ambulatorial |

**Campos/flags:** Mallampati, BNP/NT-proBNP+troponina (cortes 2024: NT-proBNP <300, BNP <92), jejum (**matriz ASA 2017**: claros 2h/leite materno 4h/fórmula 6h/leve 6h/gordurosa 8h; update 2023 só reafirmou claros 2h; ESAIC 2018 = claros 1h pediátrico), **hipertermia maligna** (história pessoal/familiar — segurança).

**Contrato das libs (A2, anti-erro clínico):** retornar `{ score, classe, incompleto: boolean, camposFaltantes: [] }`. `RiskScoreLive` mostra "preencha X" enquanto `incompleto` — **nunca um score parcial**. Debounce 150–300ms nos watchers numéricos.

**fase 2:** alertas de medicação a suspender (GLP-1/anticoag/AAS/SGLT2i); recomendação automática de exames; ACS-NSQIP SRC (link externo); Mini-Cog (delirium, amarrar ao CFS); mFI-5 (fragilidade objetiva complementar ao CFS).

> **Disclaimer clínico** (`ClinicalDisclaimer` do DS): nenhum escore substitui julgamento clínico.

## 6. Ficha completa — seções e campos canônicos (fichas acreditadas reais)

União de: **CFM 2174/2017 Anexo II** (verbatim) + protocolo **HC-UFMG/EBSERH** + form **Emory (JCI)** + **ASA Basic Standards** + estrutura **AxReg**. Marcação **[OBR]** = obrigatório acreditação/CFM · **[BP]** = boa prática.

- **A. Identificação/contexto:** paciente (+2 identificadores) [OBR] · anestesista avaliador (+validador se residente) [OBR] · data/hora (**validade ≤48h é regra CMS/EUA — NÃO vigora no Brasil; CFM 2174 só diz "devida antecedência"**) · procedimento + diagnóstico [OBR] · caráter eletivo/urgência/emergência [OBR].
- **B. História:** antecedentes pessoais/familiares [OBR] · comorbidades por sistema (checklist) [OBR] · história anestésico-cirúrgica + complicações [OBR] · **história familiar de evento/morte intra-anestésica + hipertermia maligna** [OBR] · alergias (medicamento/**látex**/contraste + reação) [OBR] · medicações (prescritas/OTC/**fitoterápicos/suplementos**, dose) [OBR] · hábitos (tabaco/álcool/**drogas**) [OBR] · **DUM/gravidez** [BP].
- **C. Exame físico:** peso/altura/IMC [OBR] · sinais vitais + **SpO₂** [OBR] · ausculta cardio/pulmonar [OBR] · **via aérea completa** (Mallampati, tireomentoniana, abertura oral, mobilidade cervical, dentição/prótese, circunferência cervical, ULBT) [OBR] · **escala de dor** [OBR].
- **D. Escores/estratificação (calculados):** ASA+E [OBR] · porte cirúrgico [OBR] · escore de risco CFM (maiores/menores) [OBR] · RCRI [BP] · DASI/MET [BP] · STOP-BANG [BP].
- **E. Exames:** solicitação **dirigida por indicação/idade** (não rotina) [OBR-registro/BP-critérios] · pareceres/interconsultas [OBR quando aplicável].
- **F. Plano/preparo:** **plano anestésico** (técnica) [OBR-intl] · **plano de dor pós-op + candidatura PCA/peridural/bloqueio** [OBR-ASA] · jejum [OBR] · manejo de medicações (**anticoagulante × bloqueio neuraxial** — tabela SBA) [BP-crítico] · pré-medicação [OBR quando indicada] · **demandas especiais** (reserva CTI/sangue, latex-free, preparo hipertermia maligna, VA difícil) [BP] · orientações ao paciente (próteses, adornos, unha em gel × oxímetro) [BP].
- **G. Consentimento/assinaturas:** **TCLE anestésico** (CFM 2174/2017 **Anexo II item 2**; ficha = item 3 — mesmo anexo; modelo no Anexo I) [OBR] · assinatura paciente/responsável + parentesco + data [OBR] · assinatura + nome legível + CRM do anestesista [OBR] · **reavaliação pré-cirurgia** [BP].
- **H. Governança (sistema):** audit trail [OBR-acreditação] · versionamento/status · interoperabilidade **LOINC 34751-8** (nota pré-anestésica) **/ SNOMED / FHIR Questionnaire** [BP] · vínculo ao checklist OMS — **LOINC 81679-3 "Preoperative measures for patient safety panel"** (é panel, não checklist); time-out isolado = **LOINC 81686-8** [OBR-fase cirúrgica].

**Gaps comuns que sistemas simples esquecem (e nós NÃO podemos):** hipertermia maligna; látex dedicado; fitoterápicos; diretivas antecipadas; plano de dor/PCA; MET; tabela anticoag×neuraxial; critérios de exame por idade; via aérea completa (não só Mallampati); demandas logísticas; validade 48h + reavaliação; população pediátrica/obstétrica; interoperabilidade; vínculo ao checklist OMS; indicadores de qualidade.

## 7. Ficha ambulatorial / fast-track (D7)

**Princípio (CFM não cria categoria "simplificada"):** os campos obrigatórios são os MESMOS; a eficiência vem de **triagem escalonada + preset enxuto**, não de remover campos legais.

**Triagem escalonada (tiered):** Tier 0 autoquestionário do paciente → Tier 1 enfermagem revisa → Tier 2 anestesiologista **só se flags**. (NHS/ePAQ-PO/MyPreOp/PACMAN: seguro, não-inferior em cancelamento.)

**Seleção ambulatorial:** ASA I–II (III só se estável/otimizado); comorbidades controladas; **acompanhante adulto + suporte 24h obrigatório**; STOP-BANG baixo/intermediário sem opioides previstos. Contraindicações: ASA IV–V instável, sem cuidador, AOS grave não tratada + opioides, necessidade de UTI.

**Estrutura enxuta (preset):** mantém os campos **[OBR]** do §6 (identidade, IMC, via aérea, ASA, alergias, jejum, TCLE) **visíveis e obrigatórios**; colapsa o expansível; **embute STOP-BANG + Apfel** na triagem; acrescenta **acompanhante 24h** e **critérios de alta** (Aldrete ≥9 → PADSS ≥9 → White ≥12). Modalidade (presencial/telemedicina/questionário) é atributo da avaliação, não da ficha.

**Como o software oferece:** **um único modelo de dados**; "ambulatorial" é preset. Seleção **dirigida por triagem** (sugere enxuta quando baixo risco). **Promoção enxuta→completa** com justificativa no audit trail; campos migram sem reentrada. **Bloqueio de alta** sem Aldrete≥9 + PADSS≥9 (ou White≥12) e sangramento/dor/NVPO controlados.

## 8. Stack de form (D2) — padrão anti-regressão

```
react-hook-form (1 único useForm)
  ├─ UI: componentes DS via <Controller> (form-field, input, select, radio, checkbox, multi-select)
  ├─ Wizard: DS stepper.jsx / step-indicator.jsx; form.trigger(campos) por etapa
  ├─ Auto-cálculo: <RiskScoreLive> com useWatch({control, name:[campos do escore]}) + useMemo → lib pura
  │     1 subscription por escore (~16 escores); PROIBIDO form.watch() global; debounce numérico (A2)
  ├─ Validação: zodResolver(fichaZodSchema)  [@hookform/resolvers ≥5 p/ zod 4; testar na Fase 0 — B3]
  ├─ Offline (A5): autosave de rascunho em IndexedDB/localStorage + sync ao reconectar (PWA); banner "offline"
  ├─ A11y (M6): foco gerenciado entre etapas; aria-live no RiskScoreLive; erros via aria-describedby
  └─ Laudo: src/services/pdf/templates/fichaPreAnestesicaTemplate.js (jspdf + pdfBranding)
```
⚠️ **Fragment bug:** `FormField` clona children → usar `<div>` wrapper, nunca `<>`.

### 8.1 UI/UX — melhores práticas validadas (workflow rodada 4)
- **Formulário clínico:** listas de respostas pré-definidas > texto livre (minimiza digitação/erro); seções numeradas e agrupadas; smart defaults; progressive disclosure; layout que espelha o papel (adoção). (NN/g + AxReg v4.)
- **Tablet/centro cirúrgico:** touch ≥44px, células grandes, entrada por gesto; **autosave + offline-first** (AxReg perde pontos em sync — nossa janela de ganho); contraste alto p/ sala.
- **Visualização de risco:** badge **agregado** verde/laranja/vermelho **+ domínios expandíveis** ao lado (transparência CDSS); cor **+ ícone** (daltonismo); **nunca exibir score parcial** (contrato `{incompleto}`, §5). MyRISK valida o agregado (AUROC 0,71).
- **ASA automático** como output derivado, **sempre editável** pelo anestesista (MyPreOp/ePAQ-PO validados vs clínico).
- **Wizard/tempo-real:** `stepper`/`step-indicator` do DS; validação por etapa (`form.trigger`); autosave; retomar rascunho; evitar perda de trabalho.
- **Acessibilidade (WCAG 2.1/2.2 AA):** foco gerenciado entre etapas; `aria-live` no `RiskScoreLive`; erro→campo via `aria-describedby`; tokens semânticos (sem hex cru); dual-theme; testar por teclado no Playwright.

## 9. Compatibilidade QMENTUM (acreditação em anestesiologia)

> QMENTUM (Accreditation Canada/HSO via IQG no Brasil) + **CFM 2174/2017**. Critérios criteriais são proprietários; a tabela deriva de ROPs públicos + ASA + CFM 2174. **Confirmar contra o manual do standards set de Anestesia do IQG** (tests for compliance major/minor = bloqueantes).

**9.1 A ficha é o núcleo de evidências** que alimenta 3 ROPs: **SSCL Sign-in** (identidade/sítio/consentimento/alergias/VA difícil/jejum) · **Reconciliação medicamentosa** (BPMH + decisão manter/suspender/ponte) · **Handover** (resumo p/ SRPA/UTI).

**9.2 Campos obrigatórios:** ver §6 (marcação [OBR]) — todos cobertos.

**9.3 Rastreabilidade/imutabilidade (reusa infra):** audit trail `requireUserId` + RPC de log · assinatura SHA-256 (padrão `submitApproval`, `supabaseDocumentService.js:1400`, bucket próprio `fichas-assinadas`) · soft-delete + trigger anti-DELETE + `legal_hold` · `validateStatusTransition`.

**9.4 Indicadores (alimentar KPIs existentes, NÃO mexer no `qmentumScore` documental):** `consulta_pre_anestesica` (≥95%), `estrat_risco_asa`, `jejum_abreviado`, `via_aerea_dificil_nao_ident` já existem em `src/data/indicadores-2025.js` → RPC `SECURITY DEFINER` faz `upsert` em `kpi_dados_mensais`. AxReg tem "Dash Acreditação" Qmentum — paridade.

**9.5 Flag `MISSING_SIGNATURE`** existe mas nunca é emitida — a ficha é o caso de uso (finalizada sem `signature_hash`).

**9.6 Fora do v1 (schema acomoda):** SSCL 3 fases; reavaliação pré-indução (campo `reavaliacao_pre_inducao_em` já no schema); documentação intra-op/SRPA/normotermia.

## 10. Algoritmo de `risco_global` (coração clínico — GATE bloqueante Fase 0/1)

**Achado do red-team + verificação:** consolidar ~16 escores num único verde/laranja/vermelho **não pode ser caixa-preta inventada na implementação**. Documento à parte, **revisado e assinado por revisor clínico (owner a definir)** antes da Fase 1 — é **gate bloqueante** (materializa §15). Define qual escore domina, como combinar (ex.: RCRI alto + ARISCAT baixo), papel do ASA e da capacidade funcional.

**Nuance da verificação (UI):** mostrar um **badge agregado verde/laranja/vermelho É aceitável** — MyRISK é validado (n=401+1823, AUROC 0,71) e exibe só um dot agregado. A regra "nunca agregar" foi **refutada**. Condição: a regra de combinação deve ser **baseada em evidência/revisada (não inventada)** e os **domínios devem ser expandíveis** ao lado do agregado (transparência CDSS).

## 11. Benchmark de plataformas (BR + global)

**AxReg (Anestech)** — AIMS #1 LatAm, freemium. Ficha clínica é **exclusiva iPad (sem Android)**, mas há **camada web de gestão/BI** (anestesia.cloud + Analytics). Jornada **3 fases (pré→trans→pós)**; pré com **seções numeradas + listas pré-definidas**; ASA/Mallampati; RPA com **Aldrete-Kroulik + auto-cálculo** (liberação por pontuação; destino incl. ambulatório); Multiambientes (consultório/clínica/hospital); IA **Axel**; hardware **Goldwing** (captura de monitor a cada 5 min); Analytics com dashboards de centro cirúrgico. **Fraquezas (nossas oportunidades):** 2,8★ (perda de dados/crash/**sync**), ficha só iPad, **sem claim público CFM 2174/FHIR**, sem ficha ambulatorial enxuta dedicada, **sem PADSS**.

**HealthChess** — NÃO é AIMS; é **gestão + faturamento TISS** (parceiro de faturamento do AxReg). Ficha pré/anestésica são módulos secundários, estrutura fechada. Bom benchmark de **agendamento WhatsApp + Mapa Cirúrgico** (ponte agenda→ficha). SiGM/SiGCM (cooperativas).

**Padrões a copiar:** listas pré-definidas; seções numeradas; auto-cálculo + semáforo disparando regra (alta); espelhar layout de papel; PDF padronizado + assinatura; jornada em fases como navegação; dashboard pessoal (horas/faturamento) como retenção.

**Nossos diferenciais:** web/PWA responsivo + **offline-first** (vs iOS-only frágil); **conformidade explícita CFM 2174 + QMENTUM**; **ficha ambulatorial enxuta + PADSS/White**; auto-cálculo de ~16 escores sobre o DS existente (73 calculadoras); FHIR/LOINC quando exigido.

**Globais (benchmark de produto):** MyPreOp/Ultramed (DTAC/DCB0129/WCAG AA, multi-form por procedimento), Synopsis iQ (250+ algoritmos), Hoopcare (AI + pre-populate EHR), MyRISK (semáforo, SUS 90/100), ePAQ-PO (auto-ASA validado), AnestSafe/AvaliacaoPreAnestesica.com (BR).

> **Investigação pendente:** Firecrawl com API key expirada (401) bloqueou captura de telas internas. Renovar `FIRECRAWL_API_KEY` (dashboard firecrawl.dev) permite `map`/`extract`/screenshots do AxReg/HealthChess. Telas reais do AxReg na App Store (id1279049888).

## 12. Fases de execução (re-escopadas por D3 — §18)

Seguir `docs/wave-execution-playbook.md`. **v1 = client-only (Fases 0–3.5):** telas + ~16 cálculos + estratificação + triagem + rascunho em localStorage → GO/NO-GO. Fases 4–6 (backend em branch Supabase, imutabilidade/assinatura/KPI, incorporação) = **pós-go**.

- **Fase 0 — Scaffold (client-only):** `pre-anestesica.html` + `src/pre-anestesica-main.jsx` (`import './index.css'`, `ThemeProvider`+`Toaster`) + `vite.config.js` (2º input + `navigateFallbackDenylist`/`globIgnores`). Instalar RHF + `@hookform/resolvers`; testar `zodResolver`. Build + `npm run dev` verdes em `/pre-anestesica.html`.
- **Fase 1 — Libs puras + testes** (paralelizável): ~16 libs `src/lib/` + Vitest (boundaries **+ casos clínicos publicados**, §15). Obter coeficientes Gupta ou trocar por SORT.
- **Fase 2 — Schema da ficha + form multi-seção:** `fichaSchema.js` + `fichaZodSchema.js` + `presets.js`; seções §6; preset ambulatorial §7; campos [OBR] obrigatórios no zod.
- **Fase 3 — Auto-cálculo + estratificação + triagem:** `RiskScoreLive` (contrato `incompleto`), `RiskStratificationBadge` (algoritmo §10), `TriagemAmbulatorial`, Clinical Summary, `ClinicalDisclaimer`.
- **Fase 3.5 — Viabilidade (GO/NO-GO):** rascunho em **localStorage** (autosave) + listar/editar; **teste Playwright tablet/desktop/dual-theme**; validação clínica dos escores (§15); **confirmar campos vs manual IQG**. → decidir se segue.
- **Fase 4 (pós-go) — Backend:** branch Supabase descartável (D10); migration (validar `migration-validator`); service + persistência real; auth mínima ou RLS de teste no branch.
- **Fase 4b (pós-go) — Imutabilidade + assinatura:** triggers, grafo de status, laudo PDF + SHA-256, adendos estruturados.
- **Fase 5 (pós-go) — Indicadores QMENTUM:** RPC `SECURITY DEFINER` → `kpi_dados_mensais`; flag `MISSING_SIGNATURE`.
- **Fase 6 (pós-go) — Incorporação ao app:** migrar do entry isolado para `App.jsx` case + `PAGE_TO_CARD` + card de permissão + NAV_STRUCTURE (reusa auth/providers reais).

## 13. Riscos e gotchas

- **Premissa de isolamento (C1/C2):** entry isolado não tem auth → persistência quebra; entries existentes são vanilla, não React. Ver §3.
- **Consentimento do paciente (C3):** ele não loga → capturar via signature pad PNG ou upload de termo físico; modelado em §4.
- **RLS incompleta** → 0 rows/PGRST116 silencioso. Cobrir 4 verbos; modelo de acesso clínico (não "só autor").
- **Score parcial (A2):** nunca exibir score incompleto; contrato `{incompleto}`.
- **Offline (A5):** centro cirúrgico = rede ruim; autosave local obrigatório.
- **Gupta sem coeficientes (M3):** não inventar; usar SORT se não obtiver os pesos.
- **DASI corte ambíguo:** fixar >34 vs ≥25 com revisor clínico.
- **`form.watch()` global** = perf nº1 RHF; usar `useWatch` escopado.
- **ASA/CFS variabilidade interobservador** — exemplos inline.
- **Migration** via `scripts/deploy-sp21-mgmt-api.mjs` (não `supabase db push`); validar com `migration-validator`.
- **Critérios QMENTUM proprietários** — confirmar contra manual IQG.
- **Assinatura hash atrás de flag** `VITE_FEATURE_HASH_SIGNATURE`.
- **Firecrawl key expirada** bloqueia investigação profunda de telas concorrentes.

## 14. População e escopo clínico (D8)
v1 = **adulto não-gestante**. Apfel/STOP-BANG/Caprini/ARISCAT/RCRI não são validados igualmente em pediatria/obstetrícia. UI deve **avisar/bloquear** fora da faixa. Pediátrico/obstétrico = roadmap (história neonatal, faces de dor, escores próprios).

## 15. Validação clínica (software médico — não basta boundary test)
- Cada lib: além de boundaries, **2–3 casos clínicos publicados** (do paper original) como fixtures, com score esperado.
- **Fonte de cada corte documentada no JSDoc**; decidir DASI com revisor.
- **Registro de validação assinado por revisor clínico** antes do go.
- Validar contra fonte primária (não só MDCalc, que pode estar desatualizado).

## 16. Dependências a instalar
- `react-hook-form` (~44k★) · `@hookform/resolvers` (≥5, zod 4)
- (zod 4, jspdf, react-pdf, framer-motion, lucide — já instalados)

## 17. Referências
- **Evidência:** ASA Physical Status (2020); ASA Basic Standards for Preanesthesia Care; ASA Practice Advisory; **ASA Fasting (matriz 2017; update modular 2023 = claros 2h)**; ESAIC Fasting 2018 (claros 1h pediátrico); 2024 ACC/AHA Perioperative (Circulation); 2022 ESC Non-cardiac Surgery (EHJ); RCRI (Lee 1999); Gupta MICA (2011, Circulation); ARISCAT (Canet 2010); STOP-BANG (Chung); Apfel (1999, valores 10/21/39/61/79%); Caprini (2005/2013); CFS (Rockwood); **DASI/METS (Wijeysundera, Lancet 2018;391:2631-2640)**; Aldrete; **PADSS modificado (Palumbo/Tellan 2013, PMID 23165318)**; White fast-track (StatPearls NBK594237); SAMBA/SASM (ambulatorial/AOS).
- **Acreditação/regulação:** **CFM 2174/2017** (Anexo II itens 2 TCLE + 3 ficha); CFM 1638/2002, 1821/2007, 2314/2022 (prontuário/retificação); QMENTUM ROP Handbook (HSO/Accreditation Canada via IQG); manual standards set Anestesia/Perioperatório (licenciado — confirmar). **Validade 48h = CMS/EUA (42 CFR 482.52), não Brasil.**
- **Interoperabilidade:** LOINC 34751-8 (nota pré-anestésica), **81679-3 (panel de medidas de segurança pré-op), 81686-8 (time-out)**; SNOMED CT; FHIR Questionnaire R4.
- **Plataformas:** AxReg/Anestech, HealthChess, MyPreOp/Ultramed, Synopsis, Hoopcare, MyRISK, ePAQ-PO, AnestSafe.

## 18. Decisões — TRAVADAS (2026-06-03)
1. **D4 — Isolamento:** ✅ **entry Vite client-only** (mini-app separado, sem backend no v1).
2. **D3 — Escopo v1:** ✅ **enxuto p/ viabilidade** (valida telas + cálculos + UX em localStorage).
3. **D10 — Backend (quando persistir):** ✅ **branch Supabase descartável**, nunca produção; fase posterior ao GO.
4. **D9 — Assinatura do paciente:** ✅ **upload de termo físico assinado** no v1; signature pad = roadmap.
5. **Firecrawl:** key expirada — renovar é **opcional** (benchmark já suficiente). Pendente do usuário.

**Diretivas já resolvidas pela auditoria:**
- **Gupta MICA:** extrair coeficientes Gupta 2011 e validar, **OU** oferecer SORT como escore separado rotulado "mortalidade 30d". **Proibido** fallback silencioso Gupta→SORT (desfechos distintos). Validar contra paper original Circulation 2011 (fontes secundárias AHA deram 403).
- **`avaliacao_adendos` estruturado** + propagação de recálculo aos KPIs: decidir o schema **antes da Fase 2**.
- **Spec de `risco_global`** = gate bloqueante com owner clínico assinado (§10).
