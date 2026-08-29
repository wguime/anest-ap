# Triagem das 71 calculadoras — proposta com evidência

> Escrito em 28/08/2026. Cada corte tem motivo e fonte. Onde a evidência não decide, está dito que
> não decide — em calculadora clínica, chute é o pior resultado possível.

---

## 1. Estatística de uso — o que existe e o que não existe

**Medido em `user_activity_log` (Supabase), 05/03 a 29/08/2026 — 78.066 eventos, 60.624 aberturas de
página.** Script: `scripts/stats-uso-calculadoras.mjs`.

| página | aberturas |
|---|---|
| Home | 25.180 |
| Escala Cirúrgica | 7.909 |
| Gestão | 4.202 |
| Menu | 3.897 |
| Escalas | 2.688 |
| Educação | 2.608 |
| Cateteres peridurais | 2.219 |
| … | |
| **Calculadoras** | **530** (12º lugar, 0,87% das aberturas) |
| Critérios UTI | 79 |

⚠️ **NÃO existe contagem por calculadora individual.** O hook `useActivityTracking` expõe
`trackFeatureUse`, e **nenhum componente do app o chama** — só `trackPageView`, em `App.jsx`. Então
qualquer afirmação do tipo "a calculadora X é pouco usada" seria invenção. Não há como ordenar as 71
por uso, e este documento não tenta.

**Único sinal por calculadora que existe:** favoritos (`userProfiles.calculatorFavorites`, Firestore).
Script: `scripts/stats-favoritos-calculadoras.mjs`. Resultado: de **71 perfis, 1 pessoa** marcou
favoritos (1,4%), em 3 calculadoras — `periop_inibidores_apetite`, `periop_anticoagulantes` e
`adt_balanco_hidrico_transop`. É sinal fraco demais para cortar coisa alguma, mas as três marcadas
estão entre as mantidas.

**O que os números dizem, e só isso:** o módulo é aberto ~3× por dia no grupo inteiro, contra 44× da
Escala Cirúrgica. Sustenta que 71 cards é muito para o tamanho do uso. **Não** sustenta qual cortar.

**Se quiser medir de verdade:** basta chamar `trackFeatureUse(calculatorId)` ao abrir uma calculadora
— o hook, a tabela e o agregador já existem. Em ~3 meses haveria ranking real.

---

## 2. O critério

Quatro perguntas, aplicadas nesta ordem. Só corta quem responde "não" com fonte.

1. **É consultada pelo anestesiologista no perioperatório**, ou é instrumento de outra especialidade
   que entrou por arrasto?
2. **Está em diretriz vigente**, ou foi superada por instrumento que o app já tem?
3. **Há duplicata funcional** — duas formas da mesma coisa?
4. **Decide conduta**, ou só nomeia o que a pessoa já sabe?

Cada corte abaixo traz o **tipo de evidência**, porque nem toda linha tem a mesma força:

- **[D] Diretriz/estudo** — uma fonte diz explicitamente que foi superada ou que a outra é melhor.
- **[E] Escopo do instrumento** — o que a escala foi criada para fazer não é ato anestésico.
- **[X] Duplicata** — o app tem duas coisas para a mesma pergunta.

---

## 3. Proposta: 71 cards → 49

**20 para `status: 'inactive'`** (nada é apagado; cada uma ganha entrada em `LEGACY_ID_MAP`) e
**3 agrupadas** num card único de classificações.

### 3.1 Superadas por algo que o app JÁ TEM — [D] + [X]

| calculadora | por quê | fonte |
|---|---|---|
| `risco_goldman` | Índice de 1977, primeiro da categoria. O RCRI (Lee, 1999) o substituiu e **é ele que está no app**. As diretrizes ACC/AHA 2024 listam RCRI, NSQIP MICA e ACS-SRC como aceitáveis; Goldman não está entre eles. | 2024 AHA/ACC Perioperative Guideline (Circulation) |
| `uti_apache2` | Calibração de 1985. *"Technological and scientific developments in intensive medicine over the last 30 years have rendered APACHE II obsolete."* O SAPS 3 tem desempenho melhor **e calibração validada para América do Sul** — e o app já tem SAPS III. | Critical Care Science, *Is APACHE II a useful tool for clinical research?* |
| `ped_cheops` | O CHEOPS não mede bem dor que persiste depois da SRPA, e não correlaciona com autorrelato em crianças de 3–7 anos. O **FLACC é o preferido para SRPA pediátrica** — e está no app. | J Pain Res, revisão sistemática das propriedades do FLACC |
| `seg_mews` | O NEWS2 é o sucessor direto do MEWS para a mesma pergunta (deterioração clínica). Manter os dois é oferecer duas respostas para uma pergunta só. | — [X] duplicata |

⚠️ **O APACHE II acaba de ser corrigido** (a produção perdia até 8 pontos por descartar o zero).
Inativá-lo não desperdiça esse trabalho: a lib `apacheII.js` e o teste continuam, e a calculadora volta
com um toque se você mudar de ideia.

### 3.2 De outra especialidade — [E]

| calculadora | para que a escala foi criada |
|---|---|
| `risco_timi` | Estratificar dor torácica no pronto-socorro — cardiologia/emergência |
| `risco_heart` | Idem TIMI |
| `risco_padua` | Risco de TEV no paciente **clínico** internado. O equivalente cirúrgico é o Caprini, que **fica** |
| `uti_curb65` | Decidir internação em pneumonia comunitária — emergência/clínica médica |
| `uti_cpis` | Diagnóstico de pneumonia associada à ventilação — intensivismo |
| `uti_nutric` | Risco nutricional em UTI — nutrologia/intensivismo |
| `uti_rox` | Predizer falha de cateter nasal de alto fluxo — pneumologia/UTI |
| `uti_four_score` | Avaliação de coma em intubado — neurointensivismo. O app já tem Glasgow e GCS-P |
| `seg_morse` | Risco de queda — avaliação de enfermagem |
| `seg_braden` | Risco de lesão por pressão — avaliação de enfermagem |
| `neuro_nihss` | Gravidade de AVC — neurologia |
| `periop_murray` | Escore de lesão pulmonar aguda; a definição de Berlim é o padrão atual para SDRA |
| `ped_pews` | Deterioração em enfermaria pediátrica — pediatria/enfermagem |
| `ped_psofa` | Disfunção orgânica em UTI pediátrica |
| `ped_pim3` | Mortalidade em UTI pediátrica |
| `ped_prism3` | Mortalidade em UTI pediátrica |

### 3.3 Agrupar num card de classificações

`periop_asa` · `periop_mallampati` · `periop_cormack` — devolvem a classe que a pessoa acabou de
escolher. Viram um card único de consulta, no padrão que Anticoagulantes e Inibidores de apetite já
usam. Decisão sua de 26/08, mantida.

⚠️ O ASA é entrada de outras calculadoras (`sort`, `ppossum`). Agrupar preserva as definições; excluir,
não.

---

## 4. As 49 que ficam

**Núcleo perioperatório (11):** Apfel [D — recomendado nominalmente pelo consenso de NVPO 2020] ·
STOP-Bang · ARISCAT · PaO₂/FiO₂ · Aldrete · Anticoagulantes · Inibidores de apetite ·
RCRI [D — ACC/AHA 2024 e ESC 2022] · Caprini · FA-anticoagulação · card de classificações.

**Emergência e reanimação (5):** ACLS unificado · Reversores · Desfibrilação pediátrica · Via aérea
pediátrica · Broselow. *(Todas auditadas em 28/08 e sem defeito.)*

**Fluidos e sangue (7):** Balanço hídrico transoperatório · Déficit hídrico · Perdas ATLS · Índice de
choque · Cristaloide · Parkland · MABL adulto.

**Doses (2):** PediCalc · Doses em adultos. **Dor (1):** Conversão de opioides.

**Renal e eletrólitos (7):** Cockcroft-Gault · CKD-EPI · Sódio corrigido · Cálcio corrigido · Anion
gap · Osmolaridade · Gap osmolar.

**UTI (4):** SAPS III · SOFA/qSOFA · RASS + CAM-ICU · NEWS2.

**Neuro (2):** Glasgow · GCS-P.

**Pediatria perioperatória (10):** Holliday-Segar · Jejum pré-op · Glasgow pediátrico · Steward ·
FLACC [D — preferido para SRPA] · Parkland ped · Fluidos ped · MABL ped · Transfusão ped · Perdas
sanguíneas ped.

---

## 5. O único ponto onde a evidência não decide sozinha

**O bloco de UTI depende de um fato sobre a prática do grupo, não da literatura:** se vocês assumem
plantão de terapia intensiva, `uti_rox`, `uti_cpis`, `uti_nutric`, `uti_four_score` e `uti_curb65` são
ferramentas de trabalho e não deveriam sair. Se a UTI aparece só como destino de pós-operatório, elas
são de outra especialidade.

O que os dados dizem: a página **Critérios UTI foi aberta 79 vezes** em seis meses — existe contato com
o tema, mas em volume baixo. Isso inclina para o corte, e é por isso que a proposta acima corta.
Está separado aqui porque é o único grupo em que um fato que você tem e eu não muda a resposta.

Mesmo cortando, **nada se perde**: `status: 'inactive'` mantém tudo no código e o retorno é de um
toque.

---

## 6. Sequência sugerida

1. `LEGACY_ID_MAP` para as 20, para favorito salvo não quebrar.
2. `status: 'inactive'` nas 20, num commit por bloco (superadas · outra especialidade).
3. Card de classificações com as 3 agrupadas.
4. `trackFeatureUse` na abertura de cada calculadora — em 3 meses a próxima triagem é medida, não
   argumentada.

Passo 4 é o mais barato e o que mais muda a conversa: hoje esta triagem se apoia em literatura e escopo
porque **não há como saber o que a equipe abre**.
