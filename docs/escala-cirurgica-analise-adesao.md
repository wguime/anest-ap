# Escala Cirúrgica Diária — Análise de potencial de adesão e evolução

> Gerada em 2026-07-18 a partir de deep research (21 fontes, 98 claims extraídos; 4 claims passaram
> por verificação adversarial 3-0, os demais estão citados com fonte mas sem re-verificação — o
> limite de sessão interrompeu a fase de verificação). Anedotas de fórum/reviews marcadas como tal.

## 1. Veredito de adesão

O módulo tem **potencial de adesão acima da média** para a categoria, por três razões estruturais:

1. **Massa crítica garantida por construção** (evidência forte, verificada 3-0): o motivo nº 1 de
   abandono de apps clínicos é "os colegas não estão lá" — círculo vicioso documentado em estudo
   qualitativo com clínicos (PMC10110803). O ANEST já é o app do grupo (~40 anestesistas, escalas,
   educação, comunicados): o board não precisa conquistar massa crítica, ele nasce dentro dela.
2. **Substitui em vez de duplicar** (verificado 3-0): médicos rejeitam ferramentas que *adicionam*
   um canal ("entre EPIC, e-mail e pager já estou conectado"); só adotam o que *substitui* algo.
   O board substitui o print no WhatsApp — mas isso exige disciplina de transição (ver §5).
3. **O baseline brasileiro é exatamente o nosso caso** (fonte primária BR, não re-verificada): no
   Einstein (UTI), 100% dos médicos usavam WhatsApp para plantões; após app dedicado, 96% não
   queriam voltar e a troca de plantão caiu de horas/dias para minutos (p=0,033) (PMC5362101).
   O mesmo estudo aponta o **envolvimento dos médicos no desenvolvimento como fator nº 1 de
   adesão** — o processo atual (dono anestesista definindo regras, teste com o grupo antes de
   produção) é literalmente o playbook recomendado.

Reforços da literatura de anestesiologia: Lightning Bolt em departamento de anestesio elevou
satisfação de 3,3→4,2 (Ochsner J, 2025) apoiado em **centenas de preferências individuais
codificadas**; ferramenta de alocação diária multi-hospital aumentou significativamente o % de
anestesistas no local de 1ª escolha (Springer 2023, 4 hospitais — contexto análogo ao nosso);
escala automatizada reduziu conflitos de horário (0,7→0,3/pessoa) e *aumentou* férias concedidas.
E a fricção que derruba os líderes (QGenda "complexo demais para grupos pequenos", treinamento
pesado — KLAS/TechTarget) é justamente onde nossa simplicidade vira vantagem competitiva.

**Risco principal**: o board depende da escala do dia estar publicada. Dia sem importação = board
vazio = grupo volta ao WhatsApp e o hábito quebra. A adesão se ganha na rotina da secretaria, não
na UI do médico.

## 2. O que os líderes têm e nós não — melhorias priorizadas

| # | Melhoria | Evidência | Esforço | Impacto |
|---|----------|-----------|---------|---------|
| 1 | **Sync com calendário pessoal (.ics/Google)** | Fórum (Amion): citado nominalmente como razão de retenção; sync quebrado = "impossível de usar" (QGenda 1★) | Baixo (feed .ics por usuário) | Alto |
| 2 | **Preferências de notificação por tipo** (escalado/liberado/urgência/troca; FYI vs urgente) | Verificado 3-0: excesso de notificação é barreira de adoção; QGenda 1★ por notificação não-configurável (fórum) | Baixo | Alto |
| 3 | **Previsão de término por histórico** (hoje: tempo estimado manual) | LiveData prediz salas rodando às 15/17/19/21h; LeanTaaS "Case Length Accuracy". Já acumulamos `tempo_estimado` + timestamps de status — dá para calibrar previsão por procedimento/cirurgião | Médio | Alto (coluna de liberação fica confiável sozinha) |
| 4 | **Métricas pessoais de carga/equidade** (plantões, noites, fins de semana, comparação justa) | Fórum (Amion): pedido recorrente de plantonistas; fairness percebida +0,9/5 com escala transparente (Yale) | Médio | Médio-alto (retenção de longo prazo) |
| 5 | **Fase 2 (trocas) 100% mobile** | Fórum (QGenda): swap que só fecha no desktop = blocker documentado; visão da escala do colega é pré-requisito de troca (backlash do redesign do Amion) — nosso board completo já cobre isso | (já planejado) | Alto |
| 6 | **Ponte escala→faturamento** (caso terminado → guia na Codificação Anestésica) | Volan (54 grupos BR, R$30mi/mês faturados) e PegaPlantão acoplam escala a remuneração — no mercado BR esse é O driver de retenção da categoria | Alto | Alto (estratégico, pós-produção) |
| 7 | **Modo TV/kiosk da aba Completa** (sala de descanso/SRPA) | LiveData: display ambiente compartilhado + acesso individual é o padrão dos boards perioperatórios | Baixo-médio | Médio |
| 8 | **Ação rápida de status no card** (long-press → Iniciada/Terminada, sem abrir o sheet) | LiveData "clicker" de milestones: 1 toque intra-op é o padrão de UX | Baixo | Médio |

Não-prioridades conscientes: check-in facial de presença (PegaPlantão — faz sentido para plantão
terceirizado, não para grupo próprio); marketplace de blocos estilo OpenTable (LeanTaaS — escala
de hospital, não de grupo); drag-and-drop de remanejamento (LiveData PeriOp Planner — a troca com
validação cobre o caso real do grupo).

## 3. Práticas de UX intra-op/plantão (checklist)

- **Sessão persistente**: re-login ao alternar apps é queixa recorrente (QGenda, fórum 2022-2026).
  Nosso Firebase Auth persiste ✓ — manter como invariante de release.
- **≤2 toques para a ação central** (abrir → marcar status) ✓; melhoria #8 leva a 1 toque.
- **Leitura à distância/pouca luz**: cores de status no card inteiro + dark mode reforçado ✓
  (feito nas rodadas de 16-17/07).
- **"Minha escala" é sagrada**: esconder a visão pessoal causou revolta e migração no Amion
  (fórum). A aba Minhas é a landing ✓ — nunca despriorizá-la.

## 4. Armadilhas documentadas (e nosso status)

- **Dupla digitação**: mata confiança (PerfectServe posiciona integração exatamente contra isso).
  Nosso fluxo print→IA→conferência elimina a redigitação do médico, mas a secretaria ainda monta
  o mapa fora. Meta de médio prazo: o editor de conferência virar a fonte primária do mapa.
- **Dados desatualizados**: sync lag entre sistemas é driver de abandono documentado (QGenda↔
  downstream; Amion desktop↔mobile). Nosso realtime nas 2 tabelas cobre ✓; o risco residual é
  operacional (escala não importada — ver §5).
- **Notificação em excesso**: verificado 3-0. Hoje somos conservadores (escalado/liberado/
  urgência/troca); qualquer fluxo novo de notificação passa por revisão de carga. Convenção
  FYI vs urgente quando a Fase 3 chegar.
- **Mandato sem valor não adere**: rollout institucional top-down de app de comunicação teve ~80%
  de não-uso após 3 anos (claim 0-3 na verificação do número exato, mas o playbook qualitativo da
  mesma fonte — caso de uso concreto + champions + equipe toda — foi confirmado). Nosso caso de
  uso âncora é a coluna de liberação: é a dor diária que o WhatsApp resolve pior.

## 5. Plano de adoção (playbook das fontes aplicado ao grupo)

1. **Champions**: dono + 2-3 plantonistas frequentes usam por 1-2 semanas com escala real.
2. **Rotina da secretaria primeiro**: importar a escala é o SLA crítico (a apresentação já pede
   isso ao grupo). Lembrete automático se a escala do dia seguinte não foi publicada até X horas.
3. **Corte do canal antigo**: na data combinada, o print deixa de ir ao grupo (link do app no
   lugar). Coexistência prolongada = duplicação = abandono (evidência verificada).
4. **Medir**: % de dias com escala publicada, % de casos com status marcado, nº de liberações
   marcadas no app, tempo até a 1ª troca in-app. Rever com o grupo após 30 dias.

## Fontes principais

- PMC10110803 — Barriers to Adoption of a Secure Text Messaging System (qualitativo; 3 claims verificados 3-0)
- PMC12296428 — reestruturação de canal único → segmentado (−97% notificações irrelevantes; verificado 3-0)
- PMC5362101 — app de escala em UTI brasileira (Einstein): WhatsApp baseline, 96% não voltariam
- Ochsner Journal 25(1):44 — Lightning Bolt em anestesiologia: satisfação 3,3→4,2, 400+ regras
- PMC7418963 — Yale AIMS: 1ª escolha 69→96%, fairness +0,9
- Springer s10916-023-01946-z — alocação diária de anestesistas multi-hospital (1ª escolha, P<0,0001)
- LiveData (OR-Schedule Board, PeriOp Manager, OR-Dashboard) e LeanTaaS iQueue — benchmarks perioperatórios
- Volan e PegaPlantão — mercado brasileiro (escala→faturamento/remuneração como driver)
- TechTarget/KLAS 2023 + reviews App Store (QGenda/Amion) — fricções e anedotas de médicos
