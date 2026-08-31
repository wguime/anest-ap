# Auditoria das calculadoras — o que a prática usa, o que a concorrência oferece

> 30/08/2026. Levantamento para decisão do dono. **Nada em `src/` foi alterado.**
>
> A triagem de 29/08 (`docs/revisao-calculadoras-triagem.md`) cortou 76 → 56 cards apoiada em
> literatura e escopo, porque não existe medição de uso por calculadora. Este documento pergunta se
> ela acertou, cruzando duas frentes externas com o estado atual do repo.
>
> Onde a evidência não decide, está escrito que **não decide**. Em calculadora clínica, chute é o
> pior resultado possível.

---

## EXECUTADO em 30/08/2026

O dono mandou ajustar conforme esta auditoria. Foi aplicado **só o que ela decide** — os defeitos da
§8 e as duas duplicatas da §6.1. O que ela deixa em aberto (§7 e §9) **não** foi tocado.

| § | o que mudou | trava |
|---|---|---|
| 8.1 | `ped_jejum`: chave do mapa passa a bater com o `value`; `resultMessage` lê `'Tempo mínimo'`; guarda `if (!info) return null` | `calculatorJejumPediatrico.test.js` (20 casos) |
| 8.2 | `hemo_perdas_atls`: `numeroOuPadrao()` em peso/FC/PAS/FR/diurese — o zero digitado deixa de virar padrão | +6 casos em `calculatorPerdasAtls.test.js` |
| 8.3 | `hemo_perdas_atls`: `keyPoints` passa a falar em % da volemia, não em mL de tabela fixa | idem |
| 8.4 | `ped_mabl` e `ped_perdas_sang`: chave `criança` → `crianca` | `calculatorOpcoesSelect.test.js` (329 casos) |
| 6.1 | `hemo_deficit` e `ped_fluidos` → `inactive`, com `LEGACY_ID_MAP` → `adt_balanco_hidrico_transop` | `calculatorTriagem.test.js` |
| 6.2 | `uti_sofa_unificado`: o rótulo "(triagem)" do qSOFA contradizia o próprio aviso do card | — |
| 8.6 | `SKILL.md` e `.claude/rules/calculadoras-clinicas.md` com os números certos, e as duas armadilhas documentadas | — |

**Ativas: 54 → 52. Inativas: 32 → 34. Definições: 86, nenhuma apagada.**

Cada teste novo foi rodado **contra o código antigo antes da correção** e falhou lá: 8 falhas no
`ped_jejum`, 5 no ATLS, e a trava genérica reprovou o `ped_jejum` quando o defeito foi reintroduzido
de propósito para conferir. Teste que passa nos dois lados não protege nada.

Verificação: `npm run lint` com **0 erros** (294 warnings pré-existentes, em arquivos não tocados);
`npm run test:run` com **4.605 testes passando** em 251 arquivos; `npm run build` e `npm run dev`
conferidos.

---

## SEGUNDA RODADA — 30/08/2026, à noite

O dono mandou resolver o que estava em aberto **"como recomendam as melhores e mais validadas
evidências científicas"**. Esse critério é ele próprio o filtro: entra o que uma diretriz recomenda
nominalmente ou o que é equação publicada e validada, com os números conferidos na fonte primária —
e **fica de fora o que existe só por convenção de mercado**, por mais comum que seja nos concorrentes.

### Corrigido pela evidência

**`ped_parkland`: 2 → 3 mL/kg/%SCQ.** A ABA *Clinical Practice Guideline on Burn Shock Resuscitation*
(2024) recomenda iniciar com 2 mL/kg/%SCQ e **declara escopo de adultos com queimadura ≥ 20% SCQ**.
Para criança, o curso ABLS da própria ABA usa **3 mL/kg/%SCQ somado à manutenção** — e a manutenção,
que este card já fazia, é o que impede a criança pequena de ficar sem água livre e glicose.
→ **O que muda na conduta:** num paciente de 20 kg com 30% de SCQ, a reposição de 24 h vai de 1.200
para 1.800 mL. Trava em `calculadorasAuditoria30-08.test.js`.

### Acrescentado — 7 cards, todos com fonte primária conferida

| card | evidência | o que muda na conduta |
|---|---|---|
| **DASI** (`risco_dasi`) | ESAIC preop **1C**; ACC/AHA 2024 registra que a avaliação subjetiva da capacidade funcional não previu complicações e o DASI, sim. Pesos originais de Hlatky 1989 (somam 58,20); enunciados pela versão brasileira validada (Coutinho-Myrrha, Arq Bras Cardiol 2014) | Troca "o senhor sobe escada?" por um número comparável. Corte em 34 (estudo METS) e < 4 METs (corte do ACC/AHA). Complementa o RCRI: um dá comorbidade, o outro dá reserva funcional |
| **Dose máxima de anestésico local** (`dor_anestesico_local`) | Tabela do Iowa Head and Neck Protocols; ASRA (dose pelo peso magro em obesos) | O app já calculava o **antídoto** — emulsão lipídica pelo peso, no ACLS — e não a prevenção. Agora dá o teto em mg **e em mL da concentração da seringa**, com o teto absoluto vencendo o cálculo por peso |
| **Pesos para dose** (`dor_peso_dose`) | Devine 1974, Janmahasatian 2005, Mosteller 1987, Du Bois 1916; BJA 2010: *"Lean body weight is the optimal dosing scalar for most drugs used in anaesthesia"* | Fecha a incoerência do próprio app, que **mandava** usar peso ideal/magro em três telas e não dizia onde calcular |
| **4AT** (`periop_4at`) | ESAIC 2024: rastrear delirium com ferramenta validada ≥1×/dia por 3 dias, **começando na sala de recuperação**. Licença **CC BY 4.0**, creditada no card | O CAM-ICU que o app tinha é para o paciente **intubado na UTI**. O confuso na SRPA é cenário de rotina do anestesista e não tinha ferramenta |
| **CAM corrigida pela idade** (`periop_mac`) | Mapleson, BJA 1996 — `MAC = MAC₄₀ × 10^(−0,00269 × (idade−40))`; MAC₄₀ e a soma vapor + N₂O da sub-rotina do próprio Nickalls (BJA 2003) | Aos 80 anos a CAM do sevoflurano é 1,4% e não 1,8%. Conduzir o idoso pelo valor de bula é aprofundar sem perceber |
| **Jejum do adulto** (`periop_jejum_adulto`) | ASA 2023 (modular update): até **400 mL** de líquido claro com carboidrato até 2 h; goma de mascar **não adia**; proteína sem evidência de preferência | Só existia a versão pediátrica. A parte do carboidrato e da goma não estava em lugar nenhum |
| **Velocidade de correção do sódio** (`renal_correcao_sodio`) | Adrogué-Madias (NEJM 2000); tetos de Verbalis 2013 (8 mmol/L/24 h) e da diretriz europeia (10 nas primeiras 24 h) | Pergunta **diferente** da do card "Sódio Corrigido", que corrige pela glicemia — e o nome parecido fazia parar no card errado. Dá volume, velocidade e avisa quando o alvo passa do teto |

**Ativas: 52 → 59. Definições: 86 → 93.** Quatro libs puras novas
(`pesoCorporal`, `anestesicoLocal`, `correcaoSodio`, `macIdade`), cada uma importada pelo card que a
usa — lib sem importador de produção é pior que não ter teste.

### NÃO acrescentado, e por quê

| item | motivo |
|---|---|
| **Escala de Fragilidade Clínica (CFS)** | ⚠️ **Bloqueio de licença, não de evidência.** É a recomendação mais forte da lista (ESAIC **1C**, duas vezes), mas Dalhousie exige *Permission for Use Agreement* pelo portal. Uso clínico não comercial "usualmente não requer acordo de licença" — ou seja, é provável que saia de graça, mas é **pedido que só o dono pode fazer**. Ver §9.8 |
| **NSQIP MICA (Gupta)** | Nomeado pelo ACC/AHA 2024, mas o guideline dá Classe 2a para "**uma** ferramenta validada", e o app já tem o RCRI. Além disso, não consegui os coeficientes exatos do modelo logístico em fonte primária — e escore de risco com coeficiente chutado é pior que escore ausente |
| **Delta PP · conversão de corticoides · conversor mcg/kg/min↔mL/h · interpretador de gasometria** | São **convenção de mercado**, não recomendação. Estão no app da SBA, no Whitebook e no Follie, e **nenhuma diretriz manda calculá-los**. Pelo critério que o dono deu, não passam. Ficam registrados aqui para quando o critério for outro |
| **PADSS** | Continua dependendo de um fato: o grupo faz cirurgia ambulatorial? Ver §9.5 |

⚠️ **Nenhuma das 7 perguntas da §9 foi respondida por conta própria** — nenhuma delas é questão de
evidência: dependem de fatos sobre a prática do grupo, e evidência não responde "esse grupo assume
plantão de UTI?".

⚠️ **Um defeito de exibição ficou mais visível e NÃO foi mexido:** o número grande do resultado sai
com PONTO decimal (`0.71`, `2.00`) enquanto tudo abaixo dele usa vírgula. É o
`ResultDisplay.toFixed(2)` genérico, vale para as 59 calculadoras, e está registrado como Frente 4
(~133 usos) em `docs/revisao-calculadoras.md`. Corrigir alcança o app inteiro — é mudança visual, e
cai na Regra #2. Deixar só os 7 cards novos com vírgula criaria uma inconsistência nova, pior.

---

## Verificação da segunda rodada

`npm run lint` **0 erros** · `npm run test:run` **4.873 testes** em 258 arquivos (+248) ·
`npm run build` ok · dev server sobe limpo.

No app logado, a **430px, nos dois temas**, os 7 cards foram abertos, preenchidos e conferidos:
número esperado presente, zero `undefined`, zero `NaN`, zero estouro horizontal e zero erro de
página — 14 conferências, 14 verdes. Exemplos medidos na tela real: peso magro 67,5 kg para homem de
100 kg e 175 cm; 315 mg e 15,8 mL de lidocaína 2% em 70 kg; CAM total 0,71 com sevoflurano 1% aos 80
anos; 875 mL de NaCl 3% a 36,5 mL/h para levar o sódio de 120 a 128.

---

## 0. O que é medição e o que é impressão

**Rodado hoje, nesta sessão:**

| script | resultado |
|---|---|
| `node scripts/stats-uso-calculadoras.mjs` | `feature_use: 0` — **nenhum** evento por calculadora individual |
| `node scripts/stats-favoritos-calculadoras.mjs` | 71 perfis, **1 pessoa (1,4%)** com favoritos, em 3 calculadoras |

As 3 favoritadas: `periop_inibidores_apetite`, `periop_anticoagulantes`, `adt_balanco_hidrico_transop`
— uma marcação cada.

O que existe é contagem **por página** (`trackPageView` em `App.jsx`): Calculadoras 530 aberturas
entre 05/03 e 29/08, contra 7.909 da Escala Cirúrgica e 79 dos Critérios UTI. `useActivityTracking`
expõe `trackFeatureUse` e **nenhum componente o chama**.

> ⚠️ **Consequência para tudo que vem abaixo.** Nenhuma linha deste documento diz "a calculadora X é
> pouco usada por aqui". Não dá para saber. Toda afirmação sobre uso é **impressão da literatura e do
> mercado**, nunca medição deste grupo. Quando eu digo "a prática usa", quero dizer "diretriz ou
> revisão diz que se usa" — não "os anestesistas de Chapecó usam".
>
> O passo 4 da triagem (`trackFeatureUse(calculatorId)` na abertura) continua sendo a coisa mais
> barata que muda essa conversa. Em ~3 meses a próxima auditoria seria medida.

---

## 1. Inventário real, contado pelo repo hoje

`src/design-system/data/calculator-definitions.js` — **86 definições · 54 `active` · 32 `inactive` ·
14 seções.**

| seção (`calculatorSections`) | ativas | inativas |
|---|---:|---:|
| `periop` — Perioperatório e Via Aérea | 8 | 6 |
| `risco` — Risco e Estratificação | 3 | 6 |
| `acls` — Emergência e Ressuscitação | 2 | 0 |
| `hemo` — Fluidoterapia e Sangue | 7 | 1 |
| `uti` — Terapia Intensiva | 3 | 10 |
| `criterio_uti` — Indicação de UTI | 5 | 0 |
| `seg` — Segurança do Paciente | 1 | 3 |
| `renal` — Renal e Eletrólitos | 7 | 0 |
| `neuro` — Neurologia | 2 | 1 |
| `dor` — Medicações e Doses | 2 | 0 |
| `ped_doses` — Pediatria: Doses | 1 | 0 |
| `ped_via_aerea` — Pediatria: Via Aérea e Reanimação | 3 | 0 |
| `ped_periop` — Pediatria: Perioperatório e SRPA | 4 | 0 |
| `ped_uti` — Pediatria: UTI e Prognóstico | 6 | 5 |
| **total** | **54** | **32** |

*(Contagem no momento do levantamento. Depois da execução de 30/08 — `hemo_deficit` e `ped_fluidos`
para `inactive` — são **52 ativas e 34 inativas**: `hemo` cai para 6 e `ped_uti` para 5.)*

Os números da triagem (56 ativas) e da `SKILL.md` (85 definições, 56/29) são anteriores ao card de
Classificações de 30/08, que moveu `periop_asa`, `periop_mallampati` e `periop_cormack` para
`inactive` e acrescentou `periop_classificacoes`: 56 − 3 + 1 = **54**, e 29 + 3 = **32**.
→ `.claude/skills/calculadoras/SKILL.md` precisa do número novo (item 6 da seção 8).

---

## 2. Tipos de evidência

Nem toda linha tem a mesma força. Cada verdict abaixo declara o tipo:

- **[D]** — Diretriz vigente que recomenda o instrumento **nominalmente**. Vale mais que tudo.
- **[d]** — Diretriz/consenso que o cita de passagem, ou documento de sociedade sem recomendação
  nominal.
- **[R]** — Revisão sistemática, estudo de validação ou livro-texto de referência.
- **[E]** — Escopo do instrumento: para que a escala foi criada, e por quem é aplicada.
- **[X]** — Duplicata funcional **dentro do próprio app**.
- **[M]** — Mercado: o que apps e sites do nicho oferecem. **Nunca decide sozinho** — mercado explica
  expectativa do usuário, não valida instrumento.
- **[C]** — Fato verificado no repo nesta auditoria (leitura de código ou simulação da conta).

---

## 3. FRENTE A — o que a prática perioperatória usa, com fonte

### 3.1 O achado que enquadra todo o resto

Escores perioperatórios são **muito mais recomendados do que usados**. Numa pesquisa nacional
britânica com anestesistas, 66,6% diziam avaliar risco perioperatório, e a ferramenta mais usada era
a **ASA-PS (45,2%)** — a mais simples de todas. A auditoria nacional citada no mesmo trabalho registra
que a avaliação formal e documentada de risco pré-operatório "is performed infrequently and
inadequately". Uma revisão de 2025 resume: apesar de guidelines e policy statements, a estimativa
sistemática de risco "has not become embedded into routine clinical practice". **[R]**

Isso muda a leitura do resto do documento em duas direções:

1. Um card que **nomeia o que a pessoa já sabe** (ASA, Mallampati) é o mais consultado da categoria,
   ainda que pareça o mais bobo. O card de Classificações está certo em existir.
2. Recomendar acrescentar um escore porque uma diretriz o nomeia **não garante** que ele será aberto.
   Onde a recomendação abaixo depende disso, está dito.

- Fontes: [Perioperative risk scores: prediction, pitfalls, and progress (Curr Opin Anesthesiol
  2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676592/) ·
  [The emerging specialty of perioperative medicine: a UK survey](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6971857/)

### 3.2 Pré-anestésico — instrumentos nomeados por diretriz

| instrumento | quem nomeia | tipo | está no app? |
|---|---|---|---|
| **ASA-PS** | Ferramenta efetivamente mais usada na prática (45,2%); entrada do SORT e do P-POSSUM | [R] | ✅ `periop_classificacoes` |
| **RCRI** | ACC/AHA 2024 ("validated risk-prediction tools such as the RCRI or the NSQIP calculators", Classe 2a); ESAIC preop: *"We suggest using the Revised Cardiac Risk Index (RCRI) score in preoperative patient risk stratification"* (2C) | [D] | ✅ `risco_rcri` |
| **NSQIP MICA (Gupta) · ACS-SRC · AUB-HAS2** | ACC/AHA 2024 lista junto ao RCRI como aceitáveis | [D] | ❌ **falta** |
| **DASI** | ESAIC preop: *"We recommend combining natriuretic peptides and Duke Activity Status Index questionnaires to evaluate cardiac reserve in high-risk patients undergoing high-risk surgery"* (**1C**); ACC/AHA 2024: *"a structured questionnaire—the Duke Activity Status Index (DASI)—did predict complications"* | [D] | ❌ **falta** |
| **Clinical Frailty Scale** | ESAIC preop, duas vezes: *"We recommend using the Clinical Frailty Scale if the preoperative anaesthesia physical examination reveals the presence of a frailty phenotype"* (**1C**) e *"We recommend using the Clinical Frailty Scale because of its high feasibility and predictive values"* (**1C**) | [D] | ❌ **falta** |
| **WHODAS 2.0** | ESAIC preop (1C), para informar o paciente sobre risco de incapacidade pós-operatória | [D] | ❌ falta (baixa prioridade — é questionário longo, de consulta, não de beira de mesa) |
| **STOP-Bang** | SASM: recomendação forte de usar ferramenta de rastreio pré-op de AOS; SAMBA recomenda o STOP-Bang como o preferido, "most validated screening tool used for surgical patients" | [D] | ✅ `periop_stopbang` |
| **Mallampati / modificado** | ASA 2022 Difficult Airway Guidelines, entre as "anatomical measures" da avaliação de via aérea | [D] | ✅ `periop_classificacoes` |
| **Caprini** | Modelo de referência para TEV **cirúrgico**; ASH/ACCP apoiam ferramentas validadas de estratificação; limiares por especialidade em revisão sistemática | [d]+[R] | ✅ `risco_caprini` |
| **ARISCAT** | Validado externamente para complicações pulmonares pós-op. ⚠️ **Não achei diretriz que o nomeie** — a ESAIC preop não o cita. A força aqui é [R], não [D] | [R] | ✅ `periop_ariscat` |
| **Jejum pré-op do adulto** | ASA 2023 (modular update): até 400 mL de líquido claro com carboidrato até 2 h antes; não adiar cirurgia após remoção de goma de mascar | [D] | ⚠️ só pediátrico (`ped_jejum`) |
| **GLP-1 no perioperatório** | ASA 2023 (consensus-based guidance) · multissociedade 2024 · SPAQI/BJA 2025 | [D] | ✅ `periop_inibidores_apetite` |
| **Anticoagulante × bloqueio de neuroeixo** | ASRA | [D] | ✅ `periop_anticoagulantes` |

### 3.3 Intraoperatório

| instrumento | quem nomeia | tipo | está no app? |
|---|---|---|---|
| **Dose por peso magro (LBW)** | BJA, *Dose adjustment of anaesthetics in the morbidly obese*: *"Lean body weight is the optimal dosing scalar for most drugs used in anaesthesia including opioids and anaesthetic induction agents"* | [D]/[R] | ❌ **falta a conta** (o app **aconselha** usar peso ideal/magro em 3 lugares e não oferece onde calcular) |
| **Dose máxima de anestésico local** | ASRA: dosar pelo peso magro em obesos; checklist LAST 2020 | [D] | ❌ **falta** (o app trata o desfecho — emulsão lipídica pelo peso — e não a prevenção) |
| **Emulsão lipídica / LAST** | ASRA 2020: bolus 1,5 mL/kg (100 mL se >70 kg), infusão 0,25 mL/kg/min | [D] | ✅ dentro de `acls_unificado` |
| **Dantrolene / HM** | MHAUS: 2,5 mg/kg inicial, repetir, manutenção 1 mg/kg 4–6 h; cálcio para hipercalemia, **nunca** bloqueador de canal de cálcio | [D] | ✅ dentro de `acls_unificado` |
| **Manutenção / déficit / 3º espaço** | Holliday-Segar 1957 · Furman 1975 · Gross 1983 · POQI-11 (BJA 2024) | [R] | ✅ `adt_balanco_hidrico_transop` (+ 3 cards que repetem a mesma conta — §5) |
| **MABL / volemia** | Fórmula clássica; "sangramento admissível" é item padrão do nicho no Brasil (AxCalc, aprovada pela SBA) | [R]+[M] | ✅ `hemo_mabl`, `ped_mabl` |
| **Classes de choque hemorrágico** | ATLS 10ª ed. — classe pelo **pior** parâmetro | [R] | ✅ `hemo_perdas_atls` (⚠️ defeito em §8) |
| **CAM / MAC ajustada pela idade** | ⚠️ Nenhuma diretriz manda calcular. É **convenção do nicho**: aparece em praticamente todo app de anestesia | [M] | ❌ **falta** (`grep MAC` = 0) |
| **Delta PP / VPP** | Está no **app oficial da SBA** (SBAapp). O próprio `adt_balanco_hidrico_transop` cita "SVV/PPV se disponíveis" na interpretação | [M] | ❌ **falta** |

### 3.4 SRPA e dor aguda

| instrumento | quem nomeia | tipo | está no app? |
|---|---|---|---|
| **Aldrete (fase I)** | Padrão para alta da SRPA: 5 domínios, ≥9 libera | [R] | ✅ `periop_aldrete` |
| **PADSS (fase II, alta para casa)** | Pergunta **diferente** do Aldrete: sinais vitais, deambulação, náusea, dor, sangramento, micção | [R] | ❌ falta — **depende de o grupo fazer ambulatorial** |
| **Apfel** | 4º Consenso NVPO (Gan, Anesth Analg 2020): *"has been used to stratify risk and recommend prophylaxis in each version of the Consensus Guidelines"* | [D] | ✅ `periop_apfel` |
| **Rastreio de delirium começando na SRPA** | ESAIC 2024 (POD): ferramenta validada ≥1×/dia por 3 dias, **começando na sala de recuperação**; nomeia CAM-ICU e Nu-DESC; 4AT validado para SRPA (S 93%) | [D] | ⚠️ tem CAM-ICU (intubado/UTI), **falta a ferramenta do paciente acordado na SRPA** |
| **FLACC** | Preferido para dor pós-operatória pediátrica em SRPA | [D] | ✅ `ped_flacc` |
| **Steward** | Alta da SRPA pediátrica | [R] | ✅ `ped_steward` |
| **Conversão de opioides** | Equianalgesia; item universal | [R]+[M] | ✅ `dor_conversão` |

### 3.5 Pediatria e emergência

PALS (desfibrilação J/kg), fita de Broselow, tamanho/profundidade de TOT, jejum pediátrico
(ASA 2023 + ESAIC/APA, líquidos claros 1 h) e dose por peso são o núcleo que qualquer app do nicho
carrega, e o ANEST tem os cinco. **[D]+[M]**

---

## 4. FRENTE B — o que a concorrência oferece

### 4.1 Mercado internacional

| produto | o que traz de relevante |
|---|---|
| **MDCalc** | STOP-Bang · Apfel · ARISCAT · RCRI · Caprini · **Gupta MICA** · **DASI** · **Ideal Body Weight and Adjusted Body Weight** · **Local Anesthetic Dosing Calculator** · **Sodium Correction Rate in Hyponatremia and Hypernatremia** |
| **QxMD Calculate** | Mesma família (ARISCAT, Sodium Correction Rate); hoje atrás de login Medscape |
| **Pedi Crisis 2.0 (SPA)** | 26 eventos críticos pediátricos com Dx/DDx/Tx/Drugs/Misc; **dose por peso** e design pensado para uso durante a crise |
| **Follie – Anesthesia Assistant** | 39 calculadoras: **BMI, IBW, EBV, ABL, MAC, ETT, fluidos, interpretador de gasometria, conversão de opioides**; gerador de plano anestésico para 559 procedimentos |
| **Anesthesiologist (app)** | Dose por peso/idade para ~32 fármacos + infusões + obstétricos; via aérea (máscara, lâmina, TOT, ML) |
| **NYSORA Anesthesia Assistant** | Doses, taxas de infusão, contraindicações; forte em regional |
| **Pediatric Anesthesia Tools** | Via aérea pediátrica + mg/kg, µg/kg/min, mL/h e **conversão de taxas de infusão** |
| **WikiAnesthesia** | Organiza as calculadoras em 7 famílias: composição corporal, cardiovascular, doses, tamanho de equipamento, fluidos, neuro, respiratório |

### 4.2 Mercado brasileiro

| produto | o que traz |
|---|---|
| **SBAapp** (oficial da SBA) | **Delta PP** · CBHPM 5ª ed. · **Infusão** (velocidade de uma diluição) |
| **AxCalc** (aprovada pela SBA) | Taxa de gotejamento · conversor de unidades · **sangramento admissível** · **correção aguda de sódio** · reposição de jejum |
| **CliniCalc** | Escores · déficit hídrico · manejo de infusão · taxa de produção urinária · **variação no sódio sérico** · Glasgow clássica e pediátrica · **área corporal** |
| **Whitebook / Afya** | >170 calculadoras e escores; do lado da anestesia: doses de sequência rápida de IOT, **tamanho de TOT pediátrico**, RASS, SOFA, Glasgow pupilar, NIHSS, **conversão de corticoides**, **conversão mL/h ↔ mcg/kg/min**, clearance de creatinina, **IMC e superfície corporal**, Parkland infantil |

### 4.3 O que eles têm e nós não

Ordenado por quantos produtos independentes o oferecem:

1. **Peso ideal / peso magro / IMC / superfície corporal** — MDCalc, Follie, CliniCalc, Whitebook.
2. **Conversor mcg/kg/min ↔ mL/h genérico** — SBAapp, AxCalc, Whitebook, Pediatric Anesthesia Tools.
3. **Dose máxima de anestésico local** — MDCalc, LoAD Calc, MDTools, Baby Blocks.
4. **Velocidade de correção do sódio** — MDCalc, QxMD, Medscape, AxCalc, CliniCalc.
5. **MAC** — Follie e a maioria dos apps de anestesia.
6. **DASI** e **Gupta MICA** — MDCalc.
7. **Conversão de corticoides** — Whitebook.
8. **Delta PP / VPP** — SBAapp (o app da própria sociedade).
9. **Interpretador de gasometria** — Follie.

### 4.4 O que nós temos e eles não

Isto é ativo, e vale registrar antes de qualquer conversa sobre cortar:

- **`periop_anticoagulantes`** — janelas de suspensão/retomada por fármaco amarradas ao bloqueio de
  neuroeixo **e ao cateter peridural**, dentro de um app que também gerencia os cateteres. Nenhum
  concorrente faz a ligação; MDCalc não tem card equivalente. Uma das 3 favoritadas.
- **`periop_inibidores_apetite`** — GLP-1, coagonistas e antiobesidade no perioperatório. Há
  orientação de sociedade (ASA 2023, multissociedade 2024, SPAQI/BJA 2025) e **não encontrei
  calculadora equivalente em nenhum concorrente**. Uma das 3 favoritadas.
- **`adt_balanco_hidrico_transop`** — livro-razão hora a hora. O padrão do nicho é cálculo de um tiro;
  este acompanha o caso. A terceira favoritada.
- **`acls_unificado`** — HM/dantrolene com número de frascos, LAST/emulsão lipídica, HIET, sugammadex
  16 mg/kg, arritmias, tudo escalado pelo peso numa tela só **em português**. O equivalente
  internacional (Pedi Crisis) é pediátrico e não existe em português.
- **Indicação de UTI com a `CFM 2156`** — nenhum app internacional traz resolução do CFM. É o card que
  responde auditoria e Qmentum, e é exclusivo por construção.

---

## 5. Pergunta 1 — alguma das 32 inativas deveria voltar?

**Resposta curta: nenhuma, com base em evidência.** Duas ficam registradas como *não decide*, porque
dependem de um fato sobre o grupo que eu não tenho.

### 5.1 As 12 que estão vivas dentro de uma sucessora — não voltam como card [X]

Trazer qualquer uma de volta **desfaz uma fusão já feita** e devolve duas respostas para uma pergunta.

| id | vive dentro de | tipo |
|---|---|---|
| `periop_asa` | `periop_classificacoes` | [X][C] |
| `periop_mallampati` | `periop_classificacoes` | [X][C] |
| `periop_cormack` | `periop_classificacoes` | [X][C] |
| `periop_aldrete_mod` | `periop_aldrete` | [X][C] |
| `periop_aldrete_orig` | `periop_aldrete` | [X][C] |
| `uti_sofa` | `uti_sofa_unificado` | [X][C] |
| `uti_qsofa` | `uti_sofa_unificado` | [X][C] |
| `uti_rass` | `uti_sedacao_delirium` | [X][C] |
| `uti_cam_icu` | `uti_sedacao_delirium` | [X][C] |
| `risco_chadsvasc` | `risco_fa_anticoag` | [X][C] |
| `risco_hasbled` | `risco_fa_anticoag` | [X][C] |
| `hemo_holliday` | `ped_holliday_segar` / `adt_balanco_hidrico_transop` | [X][C] |

### 5.2 As 20 da triagem — uma linha cada

| id | volta? | tipo | base |
|---|---|---|---|
| `risco_goldman` | não | [D] | ACC/AHA 2024 lista RCRI, NSQIP MICA e ACS-SRC; o índice de 1977 não está entre eles, e o RCRI que o substituiu está no app |
| `uti_apache2` | não | [R] | Calibração de 1985; SAPS 3 com desempenho melhor e validação sul-americana. ⚠️ Se o SAPS 3 sair (§6.3), a resposta certa **não** é ressuscitar o APACHE II — é a seção `uti` encolher |
| `ped_cheops` | não | [D] | FLACC é o preferido para SRPA pediátrica e está no app |
| `seg_mews` | não | [X] | ⚠️ **Correção de fundamento:** a SSC 2021 nomeia MEWS como aceitável (ao lado de SIRS e NEWS) e recomenda **contra** o qSOFA isolado. O MEWS não é um instrumento errado. O corte se sustenta **só** por duplicata com o NEWS2 — que é [X], não [D] |
| `risco_timi` | não | [E] | Dor torácica no PS — cardiologia/emergência |
| `risco_heart` | não | [E] | Idem |
| `risco_padua` | não | [E] | TEV em paciente **clínico**; o equivalente cirúrgico (Caprini) fica |
| `uti_curb65` | não | [E] | Disposição em PAC — emergência/clínica |
| `uti_cpis` | não | [E]+[R] | Diagnóstico de PAV; instrumento de intensivismo e de acurácia contestada |
| `uti_nutric` | não | [E] | Risco nutricional em UTI |
| `uti_rox` | não | [E] | Falha de CNAF — pneumologia/UTI |
| `uti_four_score` | não | [E] | Coma em intubado; o app já tem Glasgow e GCS-P |
| `seg_morse` | não | [E] | Risco de queda — avaliação de enfermagem |
| `seg_braden` | **não decide** | [E] | Lesão por pressão é avaliação de enfermagem — **e** é indicador de acreditação. Se o interesse for Qmentum, o lugar é o módulo **Qualidade**, não Calculadoras. Enquanto for card clínico de beira de mesa, fica fora |
| `neuro_nihss` | **não decide** | [E] | Neurologia — **exceto** se o grupo faz anestesia para trombectomia mecânica em AVC agudo, cenário em que o NIHSS é do anestesista. Fato que só o dono tem |
| `periop_murray` | não | [D] | Definição de Berlim é o padrão para SDRA; o app tem PaO₂/FiO₂ |
| `ped_pews` | não | [E] | Deterioração em enfermaria pediátrica |
| `ped_psofa` | não | [E] | Disfunção orgânica em UTI pediátrica |
| `ped_pim3` | não | [E] | Mortalidade em UTI pediátrica |
| `ped_prism3` | não | [E] | Mortalidade em UTI pediátrica |

**O que muda na conduta de quem usa:** nada. Manter as 32 inativas preserva a tela como está. As duas
perguntas em aberto (`neuro_nihss`, `seg_braden`) custam uma palavra cada se a resposta vier.

---

## 6. Pergunta 2 — alguma das 54 ativas não deveria estar lá?

**Resposta: 2 saem por duplicata, 1 precisa de correção de texto, 2 não decidem.** As outras 49 se
sustentam.

### 6.1 As duas que saem — duplicata de fluidos [X][C]

A triagem já cortou `hemo_holliday` por esse motivo e **parou no meio do eixo**. Hoje há quatro cards
para a mesma conta, verificado no código:

```
hemo_deficit          4-2-1 + jejum
  ⊂ ped_fluidos       4-2-1 + jejum + terceiro espaço por porte
      ⊂ adt_balanco_hidrico_transop   tudo isso, hora a hora, adulto E pediátrico
ped_holliday_segar    acrescenta a regra diária 100-50-20 (que os outros não dão)
```

O próprio `adt_balanco_hidrico_transop` declara em `keyPoints`: *"Terceiro espaço: pequeno 2 / médio 4
/ grande 6 ml/kg/h (**alinhado com `ped_fluidos`**)"* — o card diz, no texto, que refaz o outro.

| id | veredito | tipo | base |
|---|---|---|---|
| `hemo_deficit` | **inativar** → `adt_balanco_hidrico_transop` | [X][C] | Subconjunto estrito: `compute` idêntico à parte 4-2-1 + jejum do sucessor (`:2556`–`:2578`) |
| `ped_fluidos` | **inativar** → `adt_balanco_hidrico_transop` | [X][C] | Subconjunto: 4-2-1 + jejum + porte; o sucessor cobre os três e mantém o histórico horário |

**O que muda na conduta:** hoje, quem abre "Déficit Hídrico" digita peso e jejum e recebe um número
solto — e vinte minutos depois precisa da manutenção horária, que está em outro card. Passa a abrir o
Balanço, digitar os mesmos dois campos e receber déficit, manutenção e terceiro espaço na mesma tela,
com o acompanhamento hora a hora já armado. Dois cards a menos para percorrer com o polegar.
`ped_holliday_segar` **fica**: é o único que entrega a regra diária 100-50-20.

⚠️ Ambos precisam de entrada em `LEGACY_ID_MAP` — `adt_balanco_hidrico_transop` é uma das 3
favoritadas, e favorito quebrado é tela morta.

### 6.2 O card que fica, com o texto corrigido

| id | veredito | tipo | base |
|---|---|---|---|
| `uti_sofa_unificado` | **fica o card, corrige um rótulo** | [D] | Surviving Sepsis Campaign 2021: recomendação **forte**, evidência moderada, **contra** usar o qSOFA sozinho como ferramenta de rastreio de sepse, preferindo SIRS, NEWS ou MEWS. O app **tem** o NEWS2 |

⚠️ **Correção da própria auditoria, feita na execução de 30/08.** A recomendação original desta seção
dizia "corrige o texto" como se o aviso não existisse. Ele existe: o card já traz, em `warnings`,
*"SSC 2021 recomenda CONTRA usar qSOFA como triagem de sepse — preferir NEWS2"*. Eu tinha lido o
`compute` e não o `infoBox`.

O defeito real era menor e interno: o `keyPoints` abria com **"qSOFA (triagem)"**, rotulando como
triagem exatamente o que o aviso duas linhas abaixo desaconselha para triagem. Passou a
**"qSOFA (prognóstico à beira do leito)"**.

**O que muda na conduta:** quem lê a lista de tópicos deixa de receber, do próprio card, a permissão
que o aviso do mesmo card retira. O ponteiro para o NEWS2 já estava lá e continua.

### 6.3 Os dois que não decidem

| id | por que não decide |
|---|---|
| `uti_saps3` | **Depende de um fato que só o dono tem: o grupo assume plantão ou visita de UTI?** O SAPS 3 é calculado na primeira hora de internação na UTI e foi desenhado para *"conceptually dissociate evaluation of the individual patient from evaluation of the ICU"* — isto é, **benchmarking de serviço**, com equações regionais. Não responde "este paciente precisa de UTI depois desta cirurgia?" (isso é SORT/ESS/SAS, que a seção Indicação de UTI cobre) e não muda conduta anestésica. Pelo **critério nº 1 da própria triagem** ("é consultada pelo anestesiologista no perioperatório, ou é instrumento de outra especialidade?"), ele sairia junto com CURB-65 e ROX. A triagem cortou o APACHE II por ser *superado pelo SAPS 3* e **nunca aplicou o critério nº 1 ao SAPS 3**. Se a resposta for "sim, o grupo faz UTI", ele fica e o assunto morre. **[E]+[R]** |
| `renal_osmolaridade` | Parece subconjunto de `renal_gap_osmolar` — o Gap recalcula a mesma osmolaridade (`2·Na + Glic/18 + Ureia/6`) para chegar à diferença. **Mas não é subconjunto operacional:** o Gap exige a osmolalidade **medida** e retorna `null` sem ela (`:6405`, `if (osmMedida === 0 || ...) return null`). Quem quer só a osmolaridade calculada não tem como obtê-la pelo Gap. Só vira duplicata **se** o Gap passar a exibir a calculada isolada — e isso é mudança de código, não de status. **[X]+[C], indeciso** |

### 6.4 As 49 restantes — uma linha cada

| id | veredito | tipo | base |
|---|---|---|---|
| `periop_classificacoes` | fica | [D]+[R] | ASA 2022 DAG nomeia Mallampati entre as medidas anatômicas; ASA-PS é a ferramenta efetivamente mais usada (45,2%) e é entrada do SORT e do P-POSSUM |
| `periop_apfel` | fica | [D] | 4º Consenso NVPO 2020 (Gan), estratificação nominal |
| `periop_ariscat` | fica | [R] | Validação externa para CPP. ⚠️ Sem diretriz que o nomeie — força [R], não [D] |
| `periop_stopbang` | fica | [D] | SASM (rastreio forte) + SAMBA (STOP-Bang preferido) |
| `periop_pf` | fica | [D] | PaO₂/FiO₂ é o eixo da definição de Berlim |
| `periop_aldrete` | fica | [R] | Padrão de alta de fase I da SRPA |
| `periop_anticoagulantes` | fica | [D]+[M] | ASRA; sem equivalente no mercado; favoritado (1/71) |
| `periop_inibidores_apetite` | fica | [D]+[M] | ASA 2023 + multissociedade 2024 + SPAQI 2025; sem equivalente; favoritado (1/71) |
| `risco_rcri` | fica | [D] | ACC/AHA 2024 (2a) e ESAIC (2C) |
| `risco_caprini` | fica | [d]+[R] | Modelo de referência para TEV cirúrgico |
| `risco_fa_anticoag` | fica | [d] | Instrumento de cardiologia, mas a pergunta perioperatória (suspender, retomar, ponte) é do anestesista e o card conversa com `periop_anticoagulantes`. Fica por integração, não por diretriz de anestesia |
| `acls_unificado` | fica | [D]+[M] | MHAUS (dantrolene) + ASRA LAST 2020 + AHA; diferencial de mercado |
| `acls_reversores` | fica | [D] | Sugammadex 16 mg/kg para reversão imediata |
| `adt_balanco_hidrico_transop` | fica | [R]+[M] | Holliday-Segar/Furman/Gross + POQI-11 2024; favoritado; formato sem equivalente |
| `hemo_perdas_atls` | fica | [R] | ATLS 10ª ed., classe pelo pior parâmetro. ⚠️ defeito em §8.2 |
| `hemo_shock_index` | fica | [R] | Allgöwer; usado em trauma e hemorragia |
| `hemo_cristaloide` | fica | [R] | Regra 3:1 (ATLS) |
| `hemo_parkland` | fica | [R] | ISBI 2016 — 2 mL/kg/%SCQ para adulto, com Baxter 1968 exibido como histórico |
| `hemo_mabl` | fica | [R]+[M] | MABL clássica; "sangramento admissível" é item padrão no Brasil (AxCalc/SBA) |
| `uti_sedacao_delirium` | fica | [D] | ESAIC 2024 nomeia CAM-ICU entre as ferramentas validadas de POD. ⚠️ lacuna do paciente acordado na SRPA em §7 |
| `criterio_sort` | fica | [R] | AUROC 0,899; limiar ≥5% operacional para sinalizar UTI — revisado em `docs/criterios-uti-revisao.md` |
| `criterio_ess` | fica | [R] | Peponis et al., Am J Surg 2019, c-statistic 0,80–0,90 para admissão em UTI |
| `criterio_sas` | fica | [R] | Validado para necessidade de cuidado de UTI em 72 h pós-op |
| `criterio_siaarti` | fica | [D] | SIAARTI-SIC-ANIARTI 2025: documento sobre planejar admissão em UTI após cirurgia abdominal maior |
| `criterio_cfm2156` | fica | [D] | Resolução CFM 2156/2016 vigente — critério legal no Brasil |
| `seg_news2` | fica | [D] | SSC 2021 nomeia NEWS entre os preferíveis ao qSOFA isolado |
| `renal_cockroft` | fica | [R] | Cockcroft-Gault segue sendo o padrão de bula para ajuste de dose |
| `renal_ckdepi` | fica | [R] | CKD-EPI 2021 *race-free* para estadiamento — pergunta diferente da anterior |
| `renal_sódio` | fica | [R] | Hillier 1999 (2,4), padrão desde Iolascon, Kidney Int 2022. ⚠️ nome colide com "velocidade de correção" — §7 |
| `renal_cálcio` | fica | [R] | Payne |
| `renal_aniongap` | fica | [R] | Uso corrente |
| `renal_gap_osmolar` | fica | [R] | Uso corrente |
| `neuro_glasgow` | fica | [R] | Universal |
| `neuro_gcsp` | fica | [R] | GCS-P (Brennan/Teasdale) — acrescenta reatividade pupilar |
| `dor_conversão` | fica | [R]+[M] | Equianalgesia; item universal do nicho |
| `doses_adultos` | fica | [M] | Dose por peso é o núcleo de todo app de anestesia |
| `ped_doses` (PediCalc) | fica | [M]+[R] | Idem; Pedi Crisis faz o mesmo |
| `ped_via_aerea` | fica | [R]+[M] | TOT/profundidade/ML por idade — item padrão do nicho |
| `ped_desfib` | fica | [D] | PALS/AHA — 2 J/kg, 4 J/kg |
| `ped_broselow` | fica | [R]+[M] | Estimativa de peso por comprimento |
| `ped_holliday_segar` | fica | [R] | Único que entrega a regra diária 100-50-20 |
| `ped_jejum` | fica | [D] | ASA 2023 + ESAIC/APA (líquido claro 1 h). ⚠️ **defeito grave em §8.1** |
| `ped_glasgow` | fica | [R] | Escala adaptada por faixa etária |
| `ped_steward` | fica | [R] | Alta da SRPA pediátrica |
| `ped_flacc` | fica | [D] | Preferido para dor pós-op pediátrica em SRPA |
| `ped_parkland` | fica | [R] | ⚠️ constante 2 vs 3 mL/kg/%SCQ em §8.5 |
| `ped_mabl` | fica | [R] | ⚠️ chave inalcançável em §8.4 (hoje sem consequência numérica) |
| `ped_transfusao` | fica | [R] | Fórmula de Davies |
| `ped_perdas_sang` | fica | [R] | ⚠️ mesma chave inalcançável de §8.4 |

### 6.5 Um achado de rotulagem, não de conteúdo [C]

Consequência direta da triagem, verificada no repo:

- **`ped_uti` — "Pediatria — UTI e Prognóstico"** tem 6 cards ativos e **nenhum** é UTI nem
  prognóstico: FLACC, Parkland ped, fluidos ped, MABL ped, transfusão ped, perdas sanguíneas ped. As 5
  de UTI/prognóstico (PEWS, pSOFA, PIM3, PRISM III, CHEOPS) estão todas inativas. **No celular, quem
  procura "Transfusão Pediátrica" não abre um acordeão chamado "UTI e Prognóstico".**
- **`seg` — "Segurança do Paciente"** tem 1 card ativo (NEWS2) sob um cabeçalho inteiro.
- **`uti` — "Terapia Intensiva"** tem 3 ativos contra 10 inativos.

**Não recomendo executar.** Renomear ou fundir seção é mudança visual e cai na **Regra #2** — precisa
de pedido expresso. Fica registrado como consequência da triagem que o dono pode querer endereçar.

---

## 7. Pergunta 3 — o que falta que a prática usa

Ordenado por força de evidência, depois por custo. Cada item diz **o que muda na conduta de quem usa**.

### Prioridade 1 — recomendação nominal de diretriz

**1. Escala de Fragilidade Clínica (CFS)** — **[D]**
ESAIC preop, duas recomendações **1C**: *"We recommend using the Clinical Frailty Scale because of its
high feasibility and predictive values"* e *"...if the preoperative anaesthesia physical examination
reveals the presence of a frailty phenotype"*. ACC/AHA 2024 trata fragilidade como modificador de
risco. É uma escala de 9 níveis, aplicada em segundos, sem exame nenhum.
→ **Conduta:** hoje o pré-anestésico do idoso para no ASA + RCRI. A CFS ≥5 muda três coisas
concretas: o teor do consentimento, o destino pós-operatório (a conversa com a Indicação de UTI que o
app já tem) e a indicação de otimização pré-operatória. É a recomendação nominal mais forte que falta.

**2. Duke Activity Status Index (DASI)** — **[D]**
ESAIC preop **1C** e ACC/AHA 2024. MDCalc tem. Corte em 34: abaixo, risco perioperatório maior.
→ **Conduta:** substitui o "o senhor sobe dois lances de escada?" por 12 perguntas com resultado
numérico. É a peça que falta ao lado do RCRI que já existe — o RCRI dá comorbidade, o DASI dá reserva
funcional, e o ACC/AHA usa os dois juntos.

**3. Dose máxima de anestésico local** — **[D]+[M]**
ASRA orienta dosar pelo peso magro em obesos; o checklist LAST 2020 é a outra ponta. MDCalc, LoAD
Calc, MDTools e Baby Blocks têm.
→ **Conduta:** **o app já calcula o antídoto e não calcula a prevenção.** A emulsão lipídica está
pronta, escalada pelo peso, dentro do `acls_unificado` — e o teto em mL da concentração que está na
seringa, antes do bloqueio, é conta de cabeça. Para um app de anestesia, é a lacuna mais gritante da
lista.

**4. Peso ideal / peso magro / IMC / superfície corporal** — **[D]/[R]+[M]**
BJA: *"Lean body weight is the optimal dosing scalar for most drugs used in anaesthesia including
opioids and anaesthetic induction agents"*. MDCalc, Follie, CliniCalc, Whitebook têm.
→ **Conduta:** o ANEST **dá o conselho em três lugares e não oferece onde executá-lo** —
`adt_balanco_hidrico_transop` ("Em obesidade, prefira peso ideal (IBW) ou magro (LBW) ao peso real"),
`doses_adultos` ("BNM: considerar peso ideal em obesos") e `ped_via_aerea` (">30kg, considerar peso
ideal"). Fecha o ciclo do próprio app. É a conta mais barata da lista.

**5. Rastreio de delirium do paciente acordado na SRPA (Nu-DESC ou 4AT)** — **[D]**
ESAIC 2024: ferramenta validada ≥1×/dia por 3 dias, **começando na sala de recuperação**; nomeia
CAM-ICU e Nu-DESC. O 4AT tem sensibilidade de 93% validada especificamente em SRPA.
→ **Conduta:** o paciente confuso na SRPA é cenário de rotina do anestesiologista, e a ferramenta que
o app oferece hoje (CAM-ICU) foi feita para o paciente **intubado na UTI** — não serve para ele.

**6. Jejum pré-operatório do adulto** — **[D]**
ASA 2023 (modular update): até 400 mL de líquido claro com carboidrato até 2 h antes; proteína não
ajuda nem atrapalha; goma de mascar não adia cirurgia.
→ **Conduta:** é a pergunta que a equipe faz todo dia ("comeu que horas?"), e hoje só existe a versão
pediátrica. A parte do carboidrato e da goma de mascar não está em lugar nenhum do app. É tabela, não
conta — o item mais barato desta seção.

**7. NSQIP MICA (Gupta)** — **[D], com ressalva**
ACC/AHA 2024 lista junto ao RCRI. MDCalc tem. O ACS-SRC (21 variáveis, modelo web proprietário) **não
é replicável offline**; o Gupta MICA (5 variáveis) é.
→ **Conduta:** quando o RCRI dá 0–1 e a impressão clínica não bate, o MICA entra com creatinina, ASA,
dependência funcional e tipo de cirurgia, e frequentemente reclassifica.
⚠️ **Ressalva honesta:** o ACC/AHA 2024 dá Classe 2a para "**uma** ferramenta validada", não para as
três. O app já tem uma. Isto é acréscimo de conforto, não correção de lacuna.

### Prioridade 2 — convenção do nicho, sem diretriz que mande

Aqui a evidência é **[M]**: mercado. Explica o que o usuário espera encontrar; **não** valida o
instrumento. Nenhuma diretriz manda calcular MAC ou taxa de infusão.

**8. Conversor mcg/kg/min ↔ mL/h genérico** — **[M]**
SBAapp ("Infusão"), AxCalc ("taxa de gotejamento"), Whitebook, Pediatric Anesthesia Tools.
→ **Conduta:** o ANEST **já calcula mL/h**, mas só dentro do `acls_unificado` e só para as diluições
que o card assume. Fora da parada — remifentanil, dexmedetomidina, noradrenalina numa diluição
diferente — não serve. Um conversor genérico (droga, diluição, peso, dose alvo) cobre o dia inteiro.

**9. CAM / MAC ajustada pela idade** — **[M]**
Item de praticamente todo app de anestesia (Follie, Anesthesiologist, Pediatric Anesthesia Tools). O
ANEST não tem nenhuma menção — `grep` por MAC, sevoflurano, isoflurano e desflurano volta zero.
→ **Conduta:** no paciente de 80 anos a MAC do sevoflurano é bem menor que a de tabela; hoje o ajuste
é de cabeça. É a ausência mais visível para quem compara o app com um concorrente.

**10. Velocidade de correção do sódio (Adrogué-Madias)** — **[M]**
MDCalc, QxMD, Medscape, AxCalc (aprovada pela SBA), CliniCalc.
→ **Conduta:** hiponatremia grave exige a **taxa** (não mais que 6–8 mmol/L/24 h, pelo risco de
desmielinização osmótica) e quanto de salina 3%. Hoje não existe.
⚠️ **Risco de confusão de nome, e é o motivo de este item subir na lista:** o card `renal_sódio`
chama-se **"Sódio Corrigido"** e corrige o sódio **pela glicemia** — pergunta completamente diferente.
Quem procurar "corrigir o sódio" vai parar no card errado.

**11. Delta PP / variação de pressão de pulso** — **[M]**
Está no **app oficial da SBA**.
→ **Conduta:** fluidorresponsividade no intraoperatório. O `adt_balanco_hidrico_transop` já cita
"SVV/PPV se disponíveis" na interpretação e não calcula — mesma incoerência do peso magro.

**12. Conversão de corticoides** — **[M]**
Whitebook tem. O app já converte opioides.
→ **Conduta:** equivalência e dose de estresse perioperatória. Baixa prioridade: sem diretriz que o
nomeie e sem sinal de demanda.

### Não decide

**13. PADSS — alta domiciliar após cirurgia ambulatorial** — **[R], indeciso**
O Aldrete que o app tem é **fase I** (sair da SRPA). O PADSS é **fase II** (ir para casa) e pergunta
outras coisas: deambulação, náusea, dor, sangramento, micção.
→ **Depende de um fato que só o dono tem: o grupo faz cirurgia ambulatorial / day-clinic?** Se faz, a
alta para casa é decisão do anestesiologista e não tem instrumento no app. Se não faz, é card morto.

**14. Interpretador de gasometria** — **[M], indeciso**
Follie tem; o ANEST tem anion gap e gap osmolar, que são pedaços. Um interpretador completo é
componente novo com regra de decisão própria, não uma conta. Não recomendo sem pedido.

---

## 8. Achados fora do escopo — **não consertar aqui**

Encontrados durante a leitura do código. Conserto de conta entra com teste e é outro trabalho.
Ordenados por gravidade.

### 8.1 🔴 `ped_jejum` — a opção mais escolhida não devolve nada

`src/design-system/data/calculator-definitions.js:532` × `:546`

O `value` da opção é `'liquido_claro'` (sem acento); a chave do mapa é `'líquido_claro'` (com acento):

```js
{ value: 'liquido_claro', label: 'Líquidos claros (água, chá, suco sem polpa)' },   // :532
...
líquido_claro: { horas: 2, label: 'Líquidos claros', nota: 'ESAIC/SPA: 1h e seguro' },  // :546
...
const info = TEMPOS_JEJUM[tipo];   // :554  → undefined
return { score: info.horas, ... }  // :557  → TypeError
```

`TEMPOS_JEJUM['liquido_claro']` é `undefined`, `info.horas` lança `TypeError`, e o
`catch { setResult(null); }` de `src/design-system/showcase/CalculatorShowcase.jsx:1974` **engole a
exceção em silêncio**.

**Na tela:** escolher "Líquidos claros" não mostra resultado nenhum — o card parece não funcionar. As
outras 5 opções funcionam normalmente. Verificado por simulação nesta sessão. **Nenhum teste cobre
`ped_jejum`.**

É bug de string, não de conta — mas está no caminho mais percorrido do card, e "líquidos claros" é a
pergunta de jejum que mais se faz.

⚠️ **Segundo defeito, do mesmo tipo, na mesma tela — encontrado ao escrever o teste, depois desta
auditoria ficar pronta.** O `resultMessage` lia `details['Tempo minimo']` (sem acento) e a chave
gravada era `'Tempo mínimo'`. A frase do resultado saía **"Jejum mínimo: undefined para Leite
materno"**, e este **atingia as 6 opções**, não só a de líquidos claros. Quer dizer: o card ficava
mudo numa opção e escrevia `undefined` nas outras cinco. A auditoria original registrou só a primeira
metade, porque eu li o `compute` e não o `resultMessage`.

### 8.2 🟠 `hemo_perdas_atls` — anúria vira diurese normal

`src/design-system/data/calculator-definitions.js:2660`

```js
const diurese = parseFloat(values.diurese) || 30;   // input tem min: 0
```

É exatamente a armadilha que a `SKILL.md` documenta na regra 2, a partir do APACHE II. **Anúria é o
critério urinário de Classe IV do ATLS**, e `0 || 30` a troca por 30 mL/h, que é Classe 1. Como a
classe sai de `Math.max` dos quatro parâmetros, o paciente é subclassificado sempre que os outros três
não estiverem tão alterados. Simulado nesta sessão:

| entrada | classe que sai | classe correta |
|---|---|---|
| diurese 0, resto normal | **1** | 4 |
| diurese 0 + FC 110 | **2** | 4 |
| diurese 2, resto normal | 4 | 4 |

**A conduta da Classe IV é "Cristaloide + Sangue + Protocolo de Transfusão Maciça".**

⚠️ **O teste existente não protege.** `src/__tests__/data/calculatorPerdasAtls.test.js:42` usa
`diurese: 2` — que passa pelo `||` e acerta. O zero nunca é testado. Teste verde com o defeito vivo.
Mesmo padrão em `pas || 120` (`:2658`) e `fr || 16` (`:2659`).

### 8.3 🟡 `hemo_perdas_atls` — a InfoBox contradiz a própria conta

O comentário no `compute` (`:2688`) registra que a tabela fixa de tetos (750/1500/2000/2500 mL) foi
trocada por tetos escalados pela volemia, justamente porque *"num paciente de 100 kg em classe III a
estimativa (2450 mL) passava do 'máximo' (2000 mL), duas linhas do mesmo cartão se contradizendo"*.

Os `keyPoints` da InfoBox **ainda trazem a tabela fixa**: *"Classe II: 15-30% (750-1500mL)"*. Num
paciente de 100 kg o card mostra "até 2100 mL" no resultado e "750-1500mL" logo abaixo. A correção
arrumou o `compute` e não arrumou o texto.

### 8.4 🟡 `ped_mabl` e `ped_perdas_sang` — chave inalcançável, hoje sem consequência

`:1878` × `:1887` e `:1993` × `:2001`

O `value` da opção é `'crianca'`; a chave do `volemiaMap` é `'criança'`. Cai no `|| 75` — que **por
coincidência** é o mesmo 75 mL/kg da criança. **O número sai certo hoje.** É defeito latente: mudar o
default (ou a ordem do mapa) quebra em silêncio, e é o mesmo padrão que derruba o `ped_jejum`.

### 8.5 🟡 `ped_parkland` — constante de adulto em calculadora pediátrica

`:1707` — `const parkland24h = 2 * peso * scq;`

2 mL/kg/%SCQ é o valor **adulto** (ISBI/Brooke modificada). A literatura de queimados pediátricos usa
**3 mL/kg/%SCQ + manutenção**. O app já acerta a segunda metade (soma Holliday-Segar para <30 kg) e
usa a constante adulta na primeira.

Não é erro de aritmética — é **escolha de constante**, e por isso entra aqui e não como conserto
automático: mexer nela é decisão clínica do dono, com fonte, não refactor.

### 8.6 🟢 `SKILL.md` desatualizada

`.claude/skills/calculadoras/SKILL.md` diz *"85 definições — 56 `active`, 29 `inactive`"*. O repo tem
**86 / 54 / 32** desde o card de Classificações de 30/08. A própria skill manda contar pelo repo; o
número dela é que ficou para trás. O `description` do frontmatter também diz "56 ativas".

---

## 9. O que este documento NÃO decide

Explicitamente, para não virar decisão por omissão:

1. **Se o SAPS 3 fica.** Depende de o grupo assumir UTI. §6.3.
2. **Se o `renal_osmolaridade` é duplicata.** Depende de o Gap Osmolar passar a exibir a osmolaridade
   calculada isolada — que é código, não status. §6.3.
3. **Se o NIHSS volta.** Depende de o grupo fazer anestesia para trombectomia mecânica. §5.2.
4. **Se o Braden volta, e para onde.** Se o interesse for indicador de acreditação, o lugar é
   Qualidade, não Calculadoras. §5.2.
5. **Se o PADSS entra.** Depende de o grupo fazer cirurgia ambulatorial. §7.13.
6. **Qual calculadora é pouco usada neste grupo.** Não existe o dado. §0.
7. **Se as seções devem ser renomeadas.** É mudança visual — Regra #2. §6.5.

---

## 10. Sequência sugerida

Nada aqui é executável sem aval do dono. Ordenado por custo crescente:

1. **`trackFeatureUse(calculatorId)` na abertura de cada calculadora.** Continua sendo o passo que mais
   muda a conversa, e continua não tendo sido feito. O hook, a tabela e o agregador já existem. Em ~3
   meses a próxima auditoria é medida, não argumentada.
2. **Corrigir `ped_jejum`** (§8.1) — uma letra, mas com teste, porque hoje não há nenhum cobrindo o
   card.
3. **Corrigir a diurese do `hemo_perdas_atls`** (§8.2) — junto com o caso `diurese: 0` no teste que já
   existe, e alinhar os `keyPoints` (§8.3).
4. **Responder as 7 perguntas da §9.** Cinco delas destravam uma linha de código cada.
5. **Inativar `hemo_deficit` e `ped_fluidos`** com `LEGACY_ID_MAP` → `adt_balanco_hidrico_transop`
   (§6.1).
6. **Corrigir o texto do `uti_sofa_unificado`** sobre o qSOFA (§6.2).
7. **Avaliar os acréscimos da Prioridade 1** (§7, itens 1–7). Os itens 4 e 6 (peso ideal/magro e jejum
   do adulto) são os mais baratos e os que fecham incoerências que o próprio app já tem.

---

## Fontes

**Diretrizes e consensos**
- [2024 AHA/ACC Perioperative Cardiovascular Management for Noncardiac Surgery (Circulation)](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001285) · [Key Points (ACC)](https://www.acc.org/Latest-in-Cardiology/ten-points-to-remember/2024/09/23/04/15/2024-aha-acc-perioperative-guideline-gl) · [What's new (CCJM)](https://www.ccjm.org/content/92/4/213)
- [ESAIC — Preoperative Assessment of Adults Undergoing Elective Noncardiac Surgery (resumo)](https://www.guidelinecentral.com/guideline/4543166/)
- [ESAIC 2024 — Postoperative delirium in adult patients (EJA)](https://journals.lww.com/ejanaesthesiology/fulltext/2024/02000/update_of_the_european_society_of_anaesthesiology.2.aspx) · [resumo NYSORA](https://www.nysora.com/education-news/esaic-guidelines-preventing-postoperative-delirium-in-adults/)
- [Gan et al. — Fourth Consensus Guidelines for the Management of PONV (Anesth Analg 2020)](https://journals.lww.com/anesthesia-analgesia/fulltext/10.1213/ane.0000000000004833~fourth-consensus-guidelines-for-the-management-of)
- [2022 ASA Practice Guidelines for Management of the Difficult Airway](https://journals.lww.com/anesthesiology/fulltext/10.1097/aln.0000000000004002~2022-american-society-of-anesthesiologists-practice)
- [2023 ASA Practice Guidelines for Preoperative Fasting (modular update)](https://journals.lww.com/anesthesiology/fulltext/10.1097/aln.0000000000004381~2023-american-society-of-anesthesiologists-practice)
- [ASA — Consensus-Based Guidance on Preoperative Management of Patients on GLP-1 Receptor Agonists](https://www.asahq.org/about-asa/newsroom/news-releases/2023/06/american-society-of-anesthesiologists-consensus-based-guidance-on-preoperative) · [Multisociety guidance 2024](https://www.sciencedirect.com/science/article/pii/S1550728924007949) · [SPAQI (BJA 2025)](https://www.bjanaesthesia.org/article/S0007-0912(25)00214-4/abstract)
- [Society of Anesthesia and Sleep Medicine — Preoperative screening for OSA](http://www.stopbang.ca/pdf/sasmguide.pdf) · [narrativa perioperatória OSA](https://pmc.ncbi.nlm.nih.gov/articles/PMC12320865/)
- [Surviving Sepsis Campaign 2021 (Intensive Care Med)](https://link.springer.com/article/10.1007/s00134-021-06506-y)
- [ASRA — Checklist for Treatment of Local Anesthetic Systemic Toxicity (2020)](https://asra.com/news-publications/asra-updates/blog-landing/guidelines/2020/11/01/checklist-for-treatment-of-local-anesthetic-systemic-toxicity)
- [MHAUS — Dantrolene administration after an MH event](https://www.mhaus.org/healthcare-professionals/mhaus-recommendations/dantrolene-administration-after-an-mh-event/)

**Revisões, validações e livros**
- [Perioperative risk scores: prediction, pitfalls, and progress (Curr Opin Anesthesiol 2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11676592/)
- [The emerging specialty of perioperative medicine: a UK survey of attitudes and behaviours of anaesthetists](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6971857/)
- [Dose adjustment of anaesthetics in the morbidly obese (BJA)](https://academic.oup.com/bja/article/105/suppl_1/i16/236249)
- [SAPS 3 admission score: an external validation](https://pubmed.ncbi.nlm.nih.gov/18592214/) · [How to use ICU scoring systems: a practical guide for the intensivist](https://pmc.ncbi.nlm.nih.gov/articles/PMC11991817/)
- [Aldrete Scoring System (StatPearls)](https://www.ncbi.nlm.nih.gov/books/NBK594237/) · [From Aldrete to PADSS: reviewing discharge criteria after ambulatory surgery](https://www.researchgate.net/publication/6852315_From_Aldrete_to_PADSS_Reviewing_Discharge_Criteria_After_Ambulatory_Surgery)
- [Validation of the STOP-Bang questionnaire (meta-análise)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9710034/)
- [Burn Fluid Resuscitation (StatPearls)](https://www.ncbi.nlm.nih.gov/books/NBK534227/) · [Protocolo pediátrico VUMC](https://www.vumc.org/burn/sites/vumc.org.burn/files/public_files/Protocols/Pediatic%20Fluid%20Resuscitation_4_2019.pdf)
- [Caprini score in national guidelines](https://capriniriskscore.org/news/caprini-score-in-national-guidelines/)
- [Validação do 4AT em SRPA](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9738308/)

**Mercado**
- [MDCalc — DASI](https://www.mdcalc.com/calc/3910/duke-activity-status-index-dasi) · [Gupta MICA](https://www.mdcalc.com/calc/4038/gupta-perioperative-risk-myocardial-infarction-cardiac-arrest-mica) · [Ideal/Adjusted Body Weight](https://www.mdcalc.com/calc/68/ideal-body-weight-adjusted-body-weight) · [Local Anesthetic Dosing](https://www.mdcalc.com/calc/10205/local-anesthetic-dosing-calculator) · [Sodium Correction Rate](https://www.mdcalc.com/calc/480/sodium-correction-rate-hyponatremia-hypernatremia) · [STOP-Bang](https://www.mdcalc.com/calc/3992/stop-bang-score-obstructive-sleep-apnea) · [Apfel](https://www.mdcalc.com/calc/10104/apfel-score-postoperative-nausea-vomiting) · [ARISCAT](https://www.mdcalc.com/calc/10022/ariscat-score-postoperative-pulmonary-complications) · [Caprini](https://www.mdcalc.com/calc/3970/caprini-score-venous-thromboembolism-2005)
- [Pedi Crisis App (Society for Pediatric Anesthesia)](https://pedsanesthesia.org/pedi-crisis-app/) · [APSF sobre a v2](https://www.apsf.org/news-updates/announcing-the-society-for-pediatric-anesthesias-pedi-crisis-v2-app-update/)
- [Follie – Anesthesia Assistant](https://heyfollie.com/) · [Anesthesiologist (Google Play)](https://play.google.com/store/apps/details?id=com.shahlab.anesthesiologist) · [NYSORA Anesthesia Assistant](https://nysora.com/apps/anesthesia-assistant-app/) · [Pediatric Anesthesia Tools](https://apps.apple.com/au/app/pediatric-anesthesia-tools/id6759005883)
- [WikiAnesthesia — Calculators guide](https://wikianesthesia.org/wiki/WikiAnesthesia:Calculators_guide)
- [Whitebook — Calculadoras Médicas (PEBMED/Afya)](https://lp.pebmed.com.br/calculadoras-medicas/)
- [SBAapp (App Store)](https://apps.apple.com/br/app/sbaapp/id1441362543) · [AxCalc — aprovada pela SBA (Academia Médica)](https://academiamedica.com.br/blog/axcalc-calculos-de-drogas-anestesicas-seu-celular)

**Repo (verificado nesta sessão)**
- `src/design-system/data/calculator-definitions.js` · `src/design-system/showcase/CalculatorShowcase.jsx:1974` · `src/__tests__/data/calculatorPerdasAtls.test.js` · `src/__tests__/data/calculatorTriagem.test.js` · `scripts/stats-uso-calculadoras.mjs` · `scripts/stats-favoritos-calculadoras.mjs` · `docs/revisao-calculadoras-triagem.md` · `docs/criterios-uti-revisao.md` · `.claude/skills/calculadoras/SKILL.md`
