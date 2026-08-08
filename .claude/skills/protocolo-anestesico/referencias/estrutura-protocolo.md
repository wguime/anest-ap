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
| 17 | Algoritmos de intercorrências | Blocos de código com fluxo passo a passo |
| 18 | Emergência e pós-operatório | Critérios de extubação, destino, metas pós-operatórias |
| 19 | Segurança ocupacional | Quando houver exposição (quimioterápico, radiação, agentes infecciosos) |
| 20 | Anexos | Fórmulas de bolso, checklist de bolso, folha de registro |
| 21 | Mudanças em relação à versão anterior | Tabela: item anterior → nova recomendação → justificativa com referência |
| 22 | Referências | Numeradas, agrupadas por tema, formato Vancouver, com marca de quais foram confirmadas em busca |
| 23 | Página de aprovação | Campos de assinatura, vigência e histórico de versões — obrigatória para Qmentum |

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
