# Estrutura para protocolos TRANSVERSAIS (temáticos)

Usar quando o protocolo não é de um procedimento cirúrgico, mas de um **tema que
atravessa procedimentos**. A estrutura de 23 seções por tempo cirúrgico NÃO se
aplica aqui — forçá-la produz documento artificial.

## Quando é transversal

| Categoria | Exemplos |
|---|---|
| **Preparo do paciente** | Jejum pré-operatório; carga de carboidratos; manejo perioperatório de medicações (anticoagulantes, antidiabéticos, agonistas GLP-1/semaglutida, IECA); avaliação pré-anestésica; otimização de anemia |
| **Sedação e anestesia fora do centro cirúrgico** | Sedação para endoscopia, radiologia, cardiologia intervencionista; sedação em UTI; anestesia em ressonância |
| **Técnicas** | Bloqueios regionais (indicação/execução/anticoagulação); via aérea difícil; intubação acordado; TIVA/TCI |
| **Complicações e emergências** | Hipertermia maligna; anafilaxia perioperatória; intoxicação por anestésico local (LAST); transfusão maciça; parada cardíaca no perioperatório |
| **Sintomas e cuidados** | NVPO; controle térmico; analgesia pós-operatória por categoria; delirium; critérios de alta da SRPA |
| **Populações** | Obeso; idoso frágil; gestante para cirurgia não obstétrica; apneia do sono |

**Teste rápido:** se a pergunta natural do leitor é "o que faço NESTA cirurgia?"
→ estrutura por procedimento. Se é "como conduzimos ESTE tema em qualquer
cirurgia?" → esta estrutura.

## As 14 seções do protocolo transversal

| § | Seção | O que entra |
|---|---|---|
| 1 | Escopo e população | A quem se aplica e a quem NÃO se aplica; definições operacionais |
| 2 | Fundamento | Só a fisiologia/farmacologia que muda conduta |
| 3 | Indicações, contraindicações e elegibilidade | Critérios objetivos, verificáveis à beira-leito |
| 4 | Estratificação de risco | Escores validados quando existirem (STOP-BANG, Apfel, El-Ganzouri, Caprini...) — citar a validação |
| 5 | Recomendações centrais | O núcleo. Tabelas por situação/população, com metas numéricas e grau de evidência [A]–[D] |
| 6 | Doses e diluições | Quando aplicável — mesmas regras de dupla fonte e aritmética recalculada da skill |
| 7 | Monitorização e critérios objetivos | O que monitorar, com que frequência, e critérios de progressão/alta (ex.: Aldrete/PADSS para sedação) |
| 8 | Algoritmos de intercorrência | Fluxos passo a passo em bloco de código |
| 9 | Situações especiais | As exceções que geram dúvida na prática (ex.: jejum + diabetes + semaglutida; sedação + via aérea prevista difícil) |
| 10 | Critérios de escalonamento | Quando chamar ajuda, quando converter (sedação→anestesia geral), quando adiar/cancelar |
| 11 | Registro e documentação | O que documentar — amarrado ao que a auditoria (Qmentum) verifica |
| 12 | Indicadores de qualidade | 2–4 indicadores mensuráveis com meta (ex.: taxa de NVPO na SRPA; adesão ao jejum abreviado; eventos de sedação profunda não intencional) |
| 13 | Mudanças em relação à versão anterior | Mesmo formato do modelo por procedimento |
| 14 | Referências | Mesmas regras de verificação (✅/⚠, PMID/DOI só de busca da sessão) |

Metadados, capa, página de controle, código `PROT-ANEST-<SIGLA>-v<versão>` e
identidade visual: **idênticos** ao modelo por procedimento.

## Fontes específicas para temas transversais

Além da hierarquia geral de `fontes-e-evidencia.md`:

- **Jejum:** diretrizes vigentes da ASA e da ESAIC sobre jejum pré-operatório
  (buscar a versão atual — houve atualizações recentes, incluindo líquidos
  claros e a questão dos agonistas GLP-1); posicionamentos da SBA/SBED sobre
  semaglutida e esvaziamento gástrico; USG gástrico como ferramenta.
- **Sedação:** diretrizes da ASA para sedação moderada; **resoluções do CFM
  aplicáveis a sedação e ao ato anestésico no Brasil — confirmar número e
  vigência por busca antes de citar** (normativa muda e citar resolução
  revogada é erro grave em documento institucional); Aldrete/PADSS para alta.
- **Via aérea:** DAS, ASA Difficult Airway, projeto de via aérea da SBA.
- **NVPO:** consenso vigente (Gan et al. e atualizações).
- **Hipertermia maligna:** MHAUS + hotline brasileira (CEDHIMA/UNIFESP) —
  incluir telefone institucional vigente, conferido.
- **LAST:** checklist da ASRA vigente.
- **Anticoagulantes/neuroeixo:** ASRA vigente + diretriz europeia.

## Guia rápido do protocolo transversal

Diferente do modelo por procedimento (4 páginas fixas): aqui o guia tem
**1 a 2 páginas**, no formato que o tema pedir:

- Tema de decisão (jejum, anticoagulante) → **tabela única de consulta** (situação → conduta)
- Tema de emergência (HM, LAST, anafilaxia) → **cartaz de crise**: algoritmo
  grande, doses em destaque, telefone de ajuda — pensado para ser lido em pânico
- Tema de rotina (sedação, NVPO) → checklist + tabela de doses + critérios de alta

Regra que não muda: metas numéricas em destaque, vermelho reservado a
emergência, rodapé remetendo ao documento completo.
