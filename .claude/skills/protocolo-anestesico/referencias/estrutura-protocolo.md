# Estrutura padrão do protocolo (22 seções)

Manter ordem e numeração. Seções que não se aplicam ao procedimento são mantidas
com uma linha explicando por que não se aplicam — nunca removidas, para que todos
os protocolos do serviço sejam navegáveis da mesma forma.

| § | Seção | O que entra |
|---|---|---|
| 1 | Escopo e premissas | População, premissa central do procedimento, hierarquia de evidência usada, requisito de equipe |
| 2 | Fisiopatologia aplicada | Só o que muda conduta. Tabela alteração → mecanismo → consequência anestésica. Fechar com o "ponto-chave" do procedimento |
| 3 | Avaliação e otimização pré-operatória | Estratificação, achados que mudam a conduta, exames, otimização, reserva de hemocomponentes, profilaxias |
| 4 | Checklist de preparo de sala | Caixas de seleção por categoria: via aérea, acessos, bombas, aquecimento, fluidos, outros |
| 5 | Monitorização | Obrigatória (tabela) + considerações técnicas + point-of-care |
| 6 | Técnica anestésica | Indução, manutenção, bloqueio neuromuscular, posicionamento |
| 7 | Analgesia multimodal e neuroeixo | Indicação, protocolo, alternativa quando contraindicado, adjuvantes sistêmicos, NVPO |
| 8 | Cronologia por tempo cirúrgico | O coração do documento. Fases numeradas com marcos temporais e metas por fase |
| 9 | Manejo hemodinâmico e fluidoterapia | Princípio, metas numéricas, fluidos por fase, coloides, hierarquia de vasopressores |
| 10 | Manejo térmico | Regimes térmicos por fase, alvos, observações técnicas |
| 11 | Ventilação mecânica | Tabela de parâmetros por fase + fórmula de peso predito |
| 12 | Manejo hematológico e da coagulação | Gatilhos transfusionais, considerações específicas, viscoelástico |
| 13 | Cronograma de exames | Matriz momento × exame |
| 14 | Distúrbios metabólicos e eletrolíticos | Um bloco por íon: referência, apresentação, correção com diluição |
| 15 | Farmacologia específica do procedimento | Quimioterápicos, imunossupressores, agentes de perfusão, contraste, uterotônicos etc. |
| 16 | Tabela mestra de diluições e infusões | Fórmula universal + convenção de volume final + tabelas ml/h por peso |
| 17 | Algoritmos de intercorrências | Bloco cercado por ``` com o fluxo passo a passo (ver "vocabulário visual") |
| 18 | Emergência e pós-operatório | Critérios de extubação, destino, metas pós-operatórias |
| 19 | Segurança ocupacional | Quando houver exposição (quimioterápico, radiação, agentes infecciosos) |
| 20 | Anexos | Fórmulas de bolso, checklist de bolso, folha de registro |
| 21 | Mudanças em relação à versão anterior | Tabela: item anterior → nova recomendação → justificativa com referência |
| 22 | Referências | Numeradas, agrupadas por tema, formato Vancouver, com marca de quais foram confirmadas em busca |
| 23 | Página de aprovação | Campos de assinatura, vigência e histórico de versões — obrigatória para Qmentum |

## Vocabulário visual — qual elemento usar para quê

O documento inteiro é feito de **tabelas e listas**. Não há um quinto elemento.

| Conteúdo | Elemento no markdown | Como sai no PDF |
|---|---|---|
| **Fluxo de decisão** (algoritmo, árvore de conduta) | Tabela `Passo \| Conduta` | Cabeçalho verde, ramificações recuadas com `↳` |
| **Dado tabular** (parâmetros, doses por peso, cronograma) | Tabela markdown | Cabeçalho verde sólido, linhas alternadas |
| **Lista de conferência** (checklist de sala, de bolso) | `- [ ] item` | Lista proporcional com caixa de marcar |
| **Diferencial / enumeração sem ordem de execução** | `- item` | Lista com marcador |
| **Alerta** (mudança relevante, armadilha, ressalva) | `> citação` | Caixa creme com barra âmbar |

**Nunca usar bloco cercado por ```.** Ele sai monoespaçado, com cara de listagem
de código, e destoa de tudo à volta. Desenhar fluxo com `├─`, `└─` e `↓` é arte
ASCII: não é a linguagem destes documentos, e quebra quando a coluna é estreita.
`checa_qualidade.py` avisa quando encontra um.

**Fluxo vira tabela assim** — o número carrega a sequência, e a ramificação vira
linha recuada:

```text
| Passo | Conduta |
|---|---|
| **Gatilho** | PAM < 65 mmHg |
| **1** | Confirmar: plano profundo? bolus peridural? erro de medida? |
| **2** | Avaliar volume sistólico / VPP |
| ↳ | Responsivo → cristaloide 250 ml, reavaliar |
| ↳ | Não responsivo → passo 3 |
| **3** | **NORADRENALINA** — titular 0,05 → 0,5 µg/kg/min |
```

**Fórmula solta no meio de frase ou de célula** vai em crase simples. Cercar
metade da célula em crase e deixar a outra metade fora produz uma linha meio
monoespaçada e meio proporcional — ou toda a fórmula entra, ou nenhuma.

## Marco temporal — sempre com unidade e referencial

**Número relativo sem referencial declarado é defeito**, e a regra vale também
para o guia rápido. Um `45` solto pode ser minuto, dose ou número de item.

- Escrever a unidade: **"45 min"**, nunca **"45"**.
- Declarar o referencial no cabeçalho da coluna ou do cartão: *"Antes da
  incisão"*, *"Faltando para a perfusão"*, *"Tempo de perfusão"*.
- Em contagem regressiva, ordenar do maior para o menor e **uma marca por
  linha** — sequência de marcos separados por `·` no meio de um parágrafo é
  ilegível sob pressão, que é exatamente quando o documento é usado.

## Cor — o vermelho é da emergência

Vermelho significa **limite ou emergência**. Não usar em rótulo de tempo, número
de passo ou destaque decorativo: cada uso decorativo enfraquece o alerta de
verdade. Marco temporal e numeração de passo vão em **verde**.

## Graduação da evidência no corpo do texto

Cada recomendação central leva, junto do marcador de citação, a marca de força
definida em `fontes-e-evidencia.md`:

- **[A]** diretriz vigente com recomendação forte, ou metanálise consistente
- **[B]** ECR único de bom porte, ou recomendação condicional
- **[C]** consenso de especialistas, série de casos, extrapolação fisiológica
- **[D]** prática institucional sem lastro externo

Exemplo: `Manter driving pressure < 15 cmH₂O **[20] [B]**`

Ser honesto no [C] e no [D] fortalece o documento. Um protocolo que grada tudo
como [A] não sobrevive a uma discussão técnica.

## Página de aprovação (§23)

| Campo | Conteúdo |
|---|---|
| Elaboração | Nome, CRM, data |
| Revisão técnica | Nome, CRM, data |
| Aprovação | Responsável técnico, data |
| Vigência | Início e data da próxima revisão |
| Histórico de versões | Versão, data, natureza da alteração, responsável |

É essa página que transforma o PDF em documento auditável para acreditação.

## Metadados obrigatórios

Capa e cabeçalho devem conter: versão, data de revisão, **data da próxima
revisão** (2 anos), base normativa (diretrizes que sustentam o documento) e
número de referências.

## Princípio de faseamento (§8)

Todo procedimento longo tem transições fisiológicas. Identifique-as e nomeie-as.

**Regra de notação temporal — obrigatória.** NÃO usar códigos ou siglas de
tempo (I0, H0, T−30 e afins). Todos os tempos são escritos **por extenso**,
ancorados em **eventos nomeados em caixa alta**:

1. Escolher no máximo **dois eventos-âncora** por protocolo, com nome próprio:
   **INCISÃO** + o evento crítico do procedimento (**PERFUSÃO**, **REPERFUSÃO**,
   **SAÍDA DE CEC**, **LIGADURA DA VEIA ADRENAL**, **EXTRAÇÃO FETAL**...).
2. Abrir a §8 com um quadro "Como ler os tempos deste protocolo" definindo os
   dois eventos em uma linha cada.
3. Escrever cada tempo assim:
   - Antes do evento → **"X min antes da incisão"** ou, em checklist de
     preparação, **contagem regressiva**: "Faltando X min para a perfusão"
   - Depois do evento → tempo decorrido: **"aos X min de perfusão"**
4. Tabelas usam cabeçalho de coluna explícito: "Quando (antes da incisão)",
   "Faltando", "Momento (tempo de perfusão)".

Motivo: código de tempo exige legenda, e legenda se perde — a página impressa
circula sozinha. Um residente às 3 h da manhã não pode precisar decodificar
"H−30"; "faltando 30 min para a perfusão" não tem segunda leitura.

**Quadro obrigatório na §8: "Linha do tempo de medicações".** Tabela
consolidada Medicação → Quando administrar → Observação, cobrindo no mínimo:

- **Antibiótico**: janela antes da incisão (infusão concluída 60–15 min antes)
  **e as redoses** (intervalo por fármaco + gatilho de perda sanguínea > 1.500 ml).
  Em cirurgia longa, explicitar quantas redoses são esperadas — esquecer a
  segunda redose é o erro mais comum.
- **Antieméticos**: dexametasona logo após a indução (efeito exige precocidade);
  ondansetrona cerca de 30 min antes do término; terceiro agente se alto risco.
- **Analgésicos e anti-inflamatórios**: dipirona/paracetamol com horário de
  início; janela de PROIBIÇÃO do AINE quando houver; morfina de neuroeixo no
  momento da dose inicial.
- **Adjuvantes com regra de suspensão**: cetamina (30–60 min antes do fim),
  lidocaína (ao fechamento, salvo monitorização pós), transição analgésica do
  remifentanil (≥ 30 min antes do término).
- **Profilaxia de TEV**: HBPM X horas após o término, amarrada aos critérios de
  retirada do cateter de neuroeixo.
- **Fármacos específicos do procedimento** (insulina na oxaliplatina,
  tiossulfato na cisplatina, uterotônicos na extração fetal...), cada um com o
  momento e a regra de suspensão.

Cada linha remete à seção de dose correspondente — o quadro diz *quando*, não
substitui o *quanto*.

Cada fase precisa de: duração típica, metas numéricas, ações de transição e
gatilhos de ação. A fase de **transição** (os 60 minutos antes do evento crítico)
merece checklist cronometrado próprio — é onde o anestesiologista deixa de reagir
e passa a antecipar.

## Exemplos de faseamento por procedimento

| Procedimento | Evento-âncora crítico | Fases |
|---|---|---|
| CRS-HIPEC | Início da perfusão | preparo → citorredução → transição → HIPEC → reconstrução → emergência |
| Transplante hepático | Reperfusão | pré-anepática → anepática → transição → reperfusão → neo-hepática |
| Cirurgia cardíaca com CEC | Saída de CEC | pré-CEC → CEC → aquecimento/desmame → pós-CEC → transporte |
| Feocromocitoma | Ligadura da veia adrenal | pré-manipulação → manipulação tumoral → transição → pós-ligadura |
| Craniotomia acordado | Despertar intraoperatório | asleep → transição de despertar → mapeamento → re-sedação |
| Cesárea de alto risco | Extração fetal | pré-indução → indução → extração → uterotônicos → hemostasia |
