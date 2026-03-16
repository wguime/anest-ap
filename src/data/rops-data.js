// ROPs - Práticas Organizacionais Obrigatórias
// Banco de dados completo de perguntas
// Total: 640 questões (32 ROPs × 20 questões)

const ropsData = {
    // ==================== MACRO ÁREA 1 - CULTURA DE SEGURANÇA ====================
    "cultura-seguranca": {
        title: "Cultura de Segurança",
        icon: "fas fa-shield-alt",
        color: "linear-gradient(135deg, #9C27B0 0%, #673AB7 100%)",
        subdivisoes: {
            "rop-1-1": {
                title: "ROP 1.1 – Responsabilização pela Qualidade",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Cultura de Segurança?",
                        options: [
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "De acordo com a ROP \"Responsabilização pela Qualidade\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual prática é coerente com \"Responsabilização pela Qualidade\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Responsabilização pela Qualidade\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "No contexto de Cultura de Segurança, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Para a ROP \"Responsabilização pela Qualidade\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                            "Promover feedback estruturado",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Responsabilização pela Qualidade\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 0,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Informal e dependente da memória",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 1,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Na implementação de \"Responsabilização pela Qualidade\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 2,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                        ],
                        correctAnswer: 0,
                        explanation: "Responsabilização pela Qualidade: A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos."
                    }
                ]
            },
            "rop-1-2": {
                title: "ROP 1.2 – Gestão de Incidentes sobre a Segurança dos Pacientes",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Cultura de Segurança?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "De acordo com a ROP \"Gestão de Incidentes sobre a Segurança dos Pacientes\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual prática é coerente com \"Gestão de Incidentes sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Decisões ad hoc sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Gestão de Incidentes sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "No contexto de Cultura de Segurança, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Para a ROP \"Gestão de Incidentes sobre a Segurança dos Pacientes\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Gestão de Incidentes sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Exemplos pontuais sem dados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Relatos não verificados",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Na implementação de \"Gestão de Incidentes sobre a Segurança dos Pacientes\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão de Incidentes sobre a Segurança dos Pacientes: Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria."
                    }
                ]
            },
            "rop-1-3": {
                title: "ROP 1.3 – Relatórios Trimestrais sobre a Segurança dos Pacientes",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Cultura de Segurança?",
                        options: [
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 2,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "De acordo com a ROP \"Relatórios Trimestrais sobre a Segurança dos Pacientes\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 2,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual prática é coerente com \"Relatórios Trimestrais sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                        ],
                        correctAnswer: 1,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                        ],
                        correctAnswer: 1,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Relatórios Trimestrais sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Tratar a ROP como opcional",
                            "Apenas aprovar documentos sem monitorar",
                        ],
                        correctAnswer: 1,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "No contexto de Cultura de Segurança, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 2,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 1,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Para a ROP \"Relatórios Trimestrais sobre a Segurança dos Pacientes\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Relatórios Trimestrais sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                            "Advertência informal sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 0,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 1,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 0,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 0,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Na implementação de \"Relatórios Trimestrais sobre a Segurança dos Pacientes\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 1,
                        explanation: "Relatórios Trimestrais sobre a Segurança dos Pacientes: A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias."
                    }
                ]
            },
            "rop-1-4": {
                title: "ROP 1.4 – Divulgação de Incidentes sobre a Segurança dos Pacientes",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Cultura de Segurança?",
                        options: [
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "De acordo com a ROP \"Divulgação de Incidentes sobre a Segurança dos Pacientes\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 2,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 2,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual prática é coerente com \"Divulgação de Incidentes sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 0,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Desalinhamento estratégico",
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                        ],
                        correctAnswer: 1,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Divulgação de Incidentes sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 2,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "No contexto de Cultura de Segurança, qual estratégia é consistente com a ROP?",
                        options: [
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 2,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 0,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Para a ROP \"Divulgação de Incidentes sobre a Segurança dos Pacientes\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 1,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                            "Promover feedback estruturado",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Divulgação de Incidentes sobre a Segurança dos Pacientes\"?",
                        options: [
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 2,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 1,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 1,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Na implementação de \"Divulgação de Incidentes sobre a Segurança dos Pacientes\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Mudanças sem gestão de mudança",
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                        ],
                        correctAnswer: 0,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 1,
                        explanation: "Divulgação de Incidentes sobre a Segurança dos Pacientes: Processo documentado de disclosure com comunicação transparente e apoio às pessoas envolvidas."
                    }
                ]
            }
        }
    },

    // ==================== MACRO ÁREA 2 - COMUNICAÇÃO ====================
    "comunicacao": {
        title: "Comunicação",
        icon: "fas fa-comments",
        color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        subdivisoes: {
            "rop-2-1": {
                title: "ROP 2.1 – Identificação do Cliente",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Priorizar metas financeiras",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 1,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "De acordo com a ROP \"Identificação do Cliente\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 0,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 0,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual prática é coerente com \"Identificação do Cliente\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Decisões ad hoc sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                        ],
                        correctAnswer: 2,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Identificação do Cliente\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 2,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 1,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                        ],
                        correctAnswer: 2,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Para a ROP \"Identificação do Cliente\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 1,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                        ],
                        correctAnswer: 1,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Identificação do Cliente\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 0,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 0,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Somente entre líderes",
                        ],
                        correctAnswer: 1,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Na implementação de \"Identificação do Cliente\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 2,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Identificação do Cliente: Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado."
                    }
                ]
            },
            "rop-2-2": {
                title: "ROP 2.2 – Lista de Abreviações Perigosas",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "De acordo com a ROP \"Lista de Abreviações Perigosas\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual prática é coerente com \"Lista de Abreviações Perigosas\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Lista de Abreviações Perigosas\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Para a ROP \"Lista de Abreviações Perigosas\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Lista de Abreviações Perigosas\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 0,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Na implementação de \"Lista de Abreviações Perigosas\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Abreviações Perigosas: Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão."
                    }
                ]
            },
            "rop-2-3": {
                title: "ROP 2.3 – Conciliação Medicamentosa como Prioridade Estratégica",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Priorizar metas financeiras",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "De acordo com a ROP \"Conciliação Medicamentosa como Prioridade Estratégica\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual prática é coerente com \"Conciliação Medicamentosa como Prioridade Estratégica\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Conciliação Medicamentosa como Prioridade Estratégica\"?",
                        options: [
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Para a ROP \"Conciliação Medicamentosa como Prioridade Estratégica\", qual indicador é mais adequado?",
                        options: [
                            "Indicadores sem método de coleta",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Conciliação Medicamentosa como Prioridade Estratégica\"?",
                        options: [
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                            "Advertência informal sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Na implementação de \"Conciliação Medicamentosa como Prioridade Estratégica\", qual risco precisa ser mitigado?",
                        options: [
                            "Mensuração de desempenho",
                            "Engajamento de múltiplos setores",
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa como Prioridade Estratégica: Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais."
                    }
                ]
            },
            "rop-2-4": {
                title: "ROP 2.4 – Conciliação Medicamentosa nas Transições (Serviços de Internação)",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "De acordo com a ROP \"Conciliação Medicamentosa nas Transições (Serviços de Internação)\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Delegar integralmente ao paciente",
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual prática é coerente com \"Conciliação Medicamentosa nas Transições (Serviços de Internação)\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Conciliação Medicamentosa nas Transições (Serviços de Internação)\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Para a ROP \"Conciliação Medicamentosa nas Transições (Serviços de Internação)\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Promover feedback estruturado",
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Conciliação Medicamentosa nas Transições (Serviços de Internação)\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Na implementação de \"Conciliação Medicamentosa nas Transições (Serviços de Internação)\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Mudanças sem gestão de mudança",
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Serviços de Internação): Conciliação sistemática na admissão, transferência e alta em pacientes internados."
                    }
                ]
            },
            "rop-2-5": {
                title: "ROP 2.5 – Conciliação Medicamentosa nas Transições (Ambulatório)",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "De acordo com a ROP \"Conciliação Medicamentosa nas Transições (Ambulatório)\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual prática é coerente com \"Conciliação Medicamentosa nas Transições (Ambulatório)\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Conciliação Medicamentosa nas Transições (Ambulatório)\"?",
                        options: [
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Para a ROP \"Conciliação Medicamentosa nas Transições (Ambulatório)\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Conciliação Medicamentosa nas Transições (Ambulatório)\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Reduz variabilidade e previne eventos adversos",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Na implementação de \"Conciliação Medicamentosa nas Transições (Ambulatório)\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Ambulatório): Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais."
                    }
                ]
            },
            "rop-2-6": {
                title: "ROP 2.6 – Conciliação Medicamentosa nas Transições (Emergência)",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "De acordo com a ROP \"Conciliação Medicamentosa nas Transições (Emergência)\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual prática é coerente com \"Conciliação Medicamentosa nas Transições (Emergência)\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Conciliação Medicamentosa nas Transições (Emergência)\"?",
                        options: [
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Tratar a ROP como opcional",
                            "Apenas aprovar documentos sem monitorar",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                        ],
                        correctAnswer: 1,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Para a ROP \"Conciliação Medicamentosa nas Transições (Emergência)\", qual indicador é mais adequado?",
                        options: [
                            "Indicadores sem método de coleta",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Conciliação Medicamentosa nas Transições (Emergência)\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 0,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Na implementação de \"Conciliação Medicamentosa nas Transições (Emergência)\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 2,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Conciliação Medicamentosa nas Transições (Emergência): Processos ágeis para conciliação na emergência, considerando risco e tempo disponível."
                    }
                ]
            },
            "rop-2-7": {
                title: "ROP 2.7 – Lista de Verificação para Cirurgia Segura",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                        ],
                        correctAnswer: 0,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "De acordo com a ROP \"Lista de Verificação para Cirurgia Segura\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual prática é coerente com \"Lista de Verificação para Cirurgia Segura\"?",
                        options: [
                            "Ausência de responsáveis definidos",
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Lista de Verificação para Cirurgia Segura\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 0,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Para a ROP \"Lista de Verificação para Cirurgia Segura\", qual indicador é mais adequado?",
                        options: [
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Lista de Verificação para Cirurgia Segura\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                            "Relatos não verificados",
                        ],
                        correctAnswer: 0,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 1,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Na implementação de \"Lista de Verificação para Cirurgia Segura\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                            "Engajamento de múltiplos setores",
                        ],
                        correctAnswer: 0,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 2,
                        explanation: "Lista de Verificação para Cirurgia Segura: Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala)."
                    }
                ]
            },
            "rop-2-8": {
                title: "ROP 2.8 – Transferência de Informações nas Transições do Cuidado",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "De acordo com a ROP \"Transferência de Informações nas Transições do Cuidado\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual prática é coerente com \"Transferência de Informações nas Transições do Cuidado\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 1,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Transferência de Informações nas Transições do Cuidado\"?",
                        options: [
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 2,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 2,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Para a ROP \"Transferência de Informações nas Transições do Cuidado\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Transferência de Informações nas Transições do Cuidado\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Reduz variabilidade e previne eventos adversos",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 2,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 2,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Na implementação de \"Transferência de Informações nas Transições do Cuidado\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 1,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 2,
                        explanation: "Transferência de Informações nas Transições do Cuidado: Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR)."
                    }
                ]
            },
            "rop-2-9": {
                title: "ROP 2.9 – Resultados Críticos de Exames: Comunicação Oportuna",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Comunicação?",
                        options: [
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 2,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "De acordo com a ROP \"Resultados Críticos de Exames: Comunicação Oportuna\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                        ],
                        correctAnswer: 1,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 2,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual prática é coerente com \"Resultados Críticos de Exames: Comunicação Oportuna\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 0,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 1,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Resultados Críticos de Exames: Comunicação Oportuna\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "No contexto de Comunicação, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 2,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                        ],
                        correctAnswer: 2,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Para a ROP \"Resultados Críticos de Exames: Comunicação Oportuna\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 1,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Resultados Críticos de Exames: Comunicação Oportuna\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                        ],
                        correctAnswer: 0,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 0,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 1,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 1,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                        ],
                        correctAnswer: 2,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Na implementação de \"Resultados Críticos de Exames: Comunicação Oportuna\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Mudanças sem gestão de mudança",
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                        ],
                        correctAnswer: 0,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 2,
                        explanation: "Resultados Críticos de Exames: Comunicação Oportuna: Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade."
                    }
                ]
            }
        }
    },

    // ==================== MACRO ÁREA 3 - USO DE MEDICAMENTOS ====================
    "uso-medicamentos": {
        title: "Uso de Medicamentos",
        icon: "fas fa-pills",
        color: "linear-gradient(135deg, #2196F3 0%, #03A9F4 100%)",
        subdivisoes: {
            "rop-3-1": {
                title: "ROP 3.1 – Medicações de Alto Risco: Identificação e Controle",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Uso de Medicamentos?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "De acordo com a ROP \"Medicações de Alto Risco: Identificação e Controle\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual prática é coerente com \"Medicações de Alto Risco: Identificação e Controle\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                            "Aumento de variabilidade assistencial",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Medicações de Alto Risco: Identificação e Controle\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "No contexto de Uso de Medicamentos, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Para a ROP \"Medicações de Alto Risco: Identificação e Controle\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                            "Somente satisfação geral",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Medicações de Alto Risco: Identificação e Controle\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Circular apenas um e-mail",
                            "Esperar reclamações para agir",
                            "Desconsiderar recursos necessários",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Na implementação de \"Medicações de Alto Risco: Identificação e Controle\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicações de Alto Risco: Identificação e Controle: Identificação, dupla checagem e barreiras para reduzir erros com alto risco."
                    }
                ]
            },
            "rop-3-2": {
                title: "ROP 3.2 – Eletrólitos Concentrados: Restrição e Rotulagem",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Uso de Medicamentos?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "De acordo com a ROP \"Eletrólitos Concentrados: Restrição e Rotulagem\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual prática é coerente com \"Eletrólitos Concentrados: Restrição e Rotulagem\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Eletrólitos Concentrados: Restrição e Rotulagem\"?",
                        options: [
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 1,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "No contexto de Uso de Medicamentos, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Para a ROP \"Eletrólitos Concentrados: Restrição e Rotulagem\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 2,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Eletrólitos Concentrados: Restrição e Rotulagem\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 1,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 1,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Foca apenas na imagem institucional",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                        ],
                        correctAnswer: 2,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Na implementação de \"Eletrólitos Concentrados: Restrição e Rotulagem\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 2,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 1,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 2,
                        explanation: "Eletrólitos Concentrados: Restrição e Rotulagem: Restrição de estoque, rotulagem clara e políticas de diluição/dispensação."
                    }
                ]
            },
            "rop-3-3": {
                title: "ROP 3.3 – Medicamentos LASA (Parecidos no Nome/Aparência)",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Uso de Medicamentos?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "De acordo com a ROP \"Medicamentos LASA (Parecidos no Nome/Aparência)\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                            "Implementar processo formal com monitoramento",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual prática é coerente com \"Medicamentos LASA (Parecidos no Nome/Aparência)\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Medicamentos LASA (Parecidos no Nome/Aparência)\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "No contexto de Uso de Medicamentos, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Para a ROP \"Medicamentos LASA (Parecidos no Nome/Aparência)\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 2,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Medicamentos LASA (Parecidos no Nome/Aparência)\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                            "Esperar reclamações para agir",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                            "Plano de ação com prazos, responsáveis e verificação",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                        ],
                        correctAnswer: 1,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Na implementação de \"Medicamentos LASA (Parecidos no Nome/Aparência)\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Guiar decisões e priorização de melhorias",
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 0,
                        explanation: "Medicamentos LASA (Parecidos no Nome/Aparência): Estratégias para diferenciar, armazenar e prescrever a fim de evitar confusão."
                    }
                ]
            },
            "rop-3-4": {
                title: "ROP 3.4 – Segurança no Uso de Opioides e Controlados",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Uso de Medicamentos?",
                        options: [
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 1,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "De acordo com a ROP \"Segurança no Uso de Opioides e Controlados\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 2,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 2,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual prática é coerente com \"Segurança no Uso de Opioides e Controlados\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Segurança no Uso de Opioides e Controlados\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 1,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "No contexto de Uso de Medicamentos, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                        ],
                        correctAnswer: 0,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                        ],
                        correctAnswer: 2,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Para a ROP \"Segurança no Uso de Opioides e Controlados\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 1,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                        ],
                        correctAnswer: 0,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Segurança no Uso de Opioides e Controlados\"?",
                        options: [
                            "Esperar reclamações para agir",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                        ],
                        correctAnswer: 1,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 1,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 0,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 0,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                        ],
                        correctAnswer: 0,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Na implementação de \"Segurança no Uso de Opioides e Controlados\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 0,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 2,
                        explanation: "Segurança no Uso de Opioides e Controlados: Controle de acesso, contagem, monitorização e educação para uso seguro."
                    }
                ]
            },
            "rop-3-5": {
                title: "ROP 3.5 – Bombas de Infusão: Padronização e Segurança",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Uso de Medicamentos?",
                        options: [
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "De acordo com a ROP \"Bombas de Infusão: Padronização e Segurança\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 1,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual prática é coerente com \"Bombas de Infusão: Padronização e Segurança\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 1,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Bombas de Infusão: Padronização e Segurança\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 1,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "No contexto de Uso de Medicamentos, qual estratégia é consistente com a ROP?",
                        options: [
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Para a ROP \"Bombas de Infusão: Padronização e Segurança\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Indicadores sem método de coleta",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 0,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Bombas de Infusão: Padronização e Segurança\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                        ],
                        correctAnswer: 0,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                        ],
                        correctAnswer: 3,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 0,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Na implementação de \"Bombas de Infusão: Padronização e Segurança\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 0,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                            "Substituir o julgamento clínico sempre",
                        ],
                        correctAnswer: 2,
                        explanation: "Bombas de Infusão: Padronização e Segurança: Biblioteca de doses, padronização de equipamentos e treinamento."
                    }
                ]
            }
        }
    },

    // ==================== MACRO ÁREA 4 - VIDA PROFISSIONAL E FORÇA DE TRABALHO ====================
    "vida-profissional": {
        title: "Vida Profissional e Força de Trabalho",
        icon: "fas fa-user-friends",
        color: "linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)",
        subdivisoes: {
            "rop-4-1": {
                title: "ROP 4.1 – Orientação, Treinamento e Competência da Equipe",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Vida Profissional e Força de Trabalho?",
                        options: [
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 1,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "De acordo com a ROP \"Orientação, Treinamento e Competência da Equipe\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 0,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 2,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual prática é coerente com \"Orientação, Treinamento e Competência da Equipe\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 2,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Orientação, Treinamento e Competência da Equipe\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                        ],
                        correctAnswer: 1,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "No contexto de Vida Profissional e Força de Trabalho, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 0,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 1,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Para a ROP \"Orientação, Treinamento e Competência da Equipe\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 0,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 2,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Orientação, Treinamento e Competência da Equipe\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 0,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                        ],
                        correctAnswer: 1,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Reduz variabilidade e previne eventos adversos",
                            "Aumenta burocracia sem ganhos",
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 0,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Na implementação de \"Orientação, Treinamento e Competência da Equipe\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 2,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Orientação, Treinamento e Competência da Equipe: Treinamentos, validação de competências e registros atualizados."
                    }
                ]
            },
            "rop-4-2": {
                title: "ROP 4.2 – Gestão da Fadiga e Jornada de Trabalho Segura",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Vida Profissional e Força de Trabalho?",
                        options: [
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "De acordo com a ROP \"Gestão da Fadiga e Jornada de Trabalho Segura\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Delegar integralmente ao paciente",
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual prática é coerente com \"Gestão da Fadiga e Jornada de Trabalho Segura\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Gestão da Fadiga e Jornada de Trabalho Segura\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "No contexto de Vida Profissional e Força de Trabalho, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Para a ROP \"Gestão da Fadiga e Jornada de Trabalho Segura\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Gestão da Fadiga e Jornada de Trabalho Segura\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                            "Esperar reclamações para agir",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                        ],
                        correctAnswer: 1,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Monitoramento por indicadores",
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Na implementação de \"Gestão da Fadiga e Jornada de Trabalho Segura\", qual risco precisa ser mitigado?",
                        options: [
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                        ],
                        correctAnswer: 2,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                            "Processos sem donos",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                        ],
                        correctAnswer: 0,
                        explanation: "Gestão da Fadiga e Jornada de Trabalho Segura: Políticas de escalas, pausas, limites de horas e mitigação da fadiga."
                    }
                ]
            },
            "rop-4-3": {
                title: "ROP 4.3 – Prevenção e Resposta à Violência no Local de Trabalho",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Vida Profissional e Força de Trabalho?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "De acordo com a ROP \"Prevenção e Resposta à Violência no Local de Trabalho\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual prática é coerente com \"Prevenção e Resposta à Violência no Local de Trabalho\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Prevenção e Resposta à Violência no Local de Trabalho\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "No contexto de Vida Profissional e Força de Trabalho, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Para a ROP \"Prevenção e Resposta à Violência no Local de Trabalho\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Revisar políticas periodicamente",
                            "Promover feedback estruturado",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Prevenção e Resposta à Violência no Local de Trabalho\"?",
                        options: [
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Na implementação de \"Prevenção e Resposta à Violência no Local de Trabalho\", qual risco precisa ser mitigado?",
                        options: [
                            "Mensuração de desempenho",
                            "Engajamento de múltiplos setores",
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção e Resposta à Violência no Local de Trabalho: Protocolos de prevenção, relatório e resposta a violência e assédio."
                    }
                ]
            },
            "rop-4-4": {
                title: "ROP 4.4 – Comunicação de Situações de Risco e Cultura Justa",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Vida Profissional e Força de Trabalho?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 0,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "De acordo com a ROP \"Comunicação de Situações de Risco e Cultura Justa\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Delegar integralmente ao paciente",
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                        ],
                        correctAnswer: 1,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 2,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual prática é coerente com \"Comunicação de Situações de Risco e Cultura Justa\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Comunicação de Situações de Risco e Cultura Justa\"?",
                        options: [
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 0,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "No contexto de Vida Profissional e Força de Trabalho, qual estratégia é consistente com a ROP?",
                        options: [
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 2,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 0,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Para a ROP \"Comunicação de Situações de Risco e Cultura Justa\", qual indicador é mais adequado?",
                        options: [
                            "Indicadores sem método de coleta",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 1,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Comunicação de Situações de Risco e Cultura Justa\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                        ],
                        correctAnswer: 0,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 1,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                            "Tendência de melhoria sustentada nos indicadores",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Apenas verbal e sem registro",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 2,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 1,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Na implementação de \"Comunicação de Situações de Risco e Cultura Justa\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 2,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 1,
                        explanation: "Comunicação de Situações de Risco e Cultura Justa: Ambiente que favorece relato sem punição e aprendizagem organizacional."
                    }
                ]
            },
            "rop-4-5": {
                title: "ROP 4.5 – Bem‑estar da Equipe e Apoio ao Segundo Vítima",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Vida Profissional e Força de Trabalho?",
                        options: [
                            "Desestimular a notificação de problemas",
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "De acordo com a ROP \"Bem‑estar da Equipe e Apoio ao Segundo Vítima\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Tratar incidentes apenas verbalmente",
                            "Delegar integralmente ao paciente",
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 2,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 0,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual prática é coerente com \"Bem‑estar da Equipe e Apoio ao Segundo Vítima\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 2,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Bem‑estar da Equipe e Apoio ao Segundo Vítima\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "No contexto de Vida Profissional e Força de Trabalho, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 0,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 2,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                            "Analisar causas, implementar ações e verificar eficácia",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Para a ROP \"Bem‑estar da Equipe e Apoio ao Segundo Vítima\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 0,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Bem‑estar da Equipe e Apoio ao Segundo Vítima\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 0,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 2,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 2,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                        ],
                        correctAnswer: 2,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Na implementação de \"Bem‑estar da Equipe e Apoio ao Segundo Vítima\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                            "Engajamento de múltiplos setores",
                        ],
                        correctAnswer: 1,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Mudanças sem gestão de mudança",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 1,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Bem‑estar da Equipe e Apoio ao Segundo Vítima: Suporte após eventos adversos, saúde mental e recursos de bem‑estar."
                    }
                ]
            }
        }
    },

    // ==================== MACRO ÁREA 5 - PREVENÇÃO DE INFECÇÕES ====================
    "prevencao-infeccoes": {
        title: "Prevenção de Infecções",
        icon: "fas fa-hand-sparkles",
        color: "linear-gradient(135deg, #FF9800 0%, #FF5722 100%)",
        subdivisoes: {
            "rop-5-1": {
                title: "ROP 5.1 – Higiene das Mãos: Adesão e Monitoramento",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Prevenção de Infecções?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "De acordo com a ROP \"Higiene das Mãos: Adesão e Monitoramento\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 1,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual prática é coerente com \"Higiene das Mãos: Adesão e Monitoramento\"?",
                        options: [
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                        ],
                        correctAnswer: 1,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Higiene das Mãos: Adesão e Monitoramento\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 1,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "No contexto de Prevenção de Infecções, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 2,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Para a ROP \"Higiene das Mãos: Adesão e Monitoramento\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 1,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 1,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Higiene das Mãos: Adesão e Monitoramento\"?",
                        options: [
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Aguardar auditoria externa",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Advertência informal sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 2,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Somente entre líderes",
                        ],
                        correctAnswer: 1,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Na implementação de \"Higiene das Mãos: Adesão e Monitoramento\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 0,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Higiene das Mãos: Adesão e Monitoramento: Cumprimento dos 5 momentos, auditorias de adesão e feedback."
                    }
                ]
            },
            "rop-5-2": {
                title: "ROP 5.2 – Reprocessamento de Produtos para Saúde (Esterilização)",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Prevenção de Infecções?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                        ],
                        correctAnswer: 0,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "De acordo com a ROP \"Reprocessamento de Produtos para Saúde (Esterilização)\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 1,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 0,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual prática é coerente com \"Reprocessamento de Produtos para Saúde (Esterilização)\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                        ],
                        correctAnswer: 0,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Reprocessamento de Produtos para Saúde (Esterilização)\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "No contexto de Prevenção de Infecções, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 0,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                            "Registros rastreáveis demonstrando aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Para a ROP \"Reprocessamento de Produtos para Saúde (Esterilização)\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Reprocessamento de Produtos para Saúde (Esterilização)\"?",
                        options: [
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 1,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Foca apenas na imagem institucional",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 1,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Na implementação de \"Reprocessamento de Produtos para Saúde (Esterilização)\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                        ],
                        correctAnswer: 0,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Apoio exclusivamente voluntário",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                            "Processos sem donos",
                        ],
                        correctAnswer: 2,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 1,
                        explanation: "Reprocessamento de Produtos para Saúde (Esterilização): Fluxos, rastreabilidade, validação e monitorização do reprocessamento."
                    }
                ]
            },
            "rop-5-3": {
                title: "ROP 5.3 – Limpeza e Desinfecção de Superfícies e Equipamentos",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Prevenção de Infecções?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 0,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "De acordo com a ROP \"Limpeza e Desinfecção de Superfícies e Equipamentos\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 0,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Memorizar siglas sem documentação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                        ],
                        correctAnswer: 2,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual prática é coerente com \"Limpeza e Desinfecção de Superfícies e Equipamentos\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                        ],
                        correctAnswer: 1,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 1,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Limpeza e Desinfecção de Superfícies e Equipamentos\"?",
                        options: [
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "No contexto de Prevenção de Infecções, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                        ],
                        correctAnswer: 0,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                        ],
                        correctAnswer: 1,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                            "Ignorar indicadores",
                            "Focar apenas em culpados",
                        ],
                        correctAnswer: 0,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Para a ROP \"Limpeza e Desinfecção de Superfícies e Equipamentos\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 0,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Limpeza e Desinfecção de Superfícies e Equipamentos\"?",
                        options: [
                            "Esperar reclamações para agir",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                        ],
                        correctAnswer: 1,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 2,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 2,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 1,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 1,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Na implementação de \"Limpeza e Desinfecção de Superfícies e Equipamentos\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 2,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Limpeza e Desinfecção de Superfícies e Equipamentos: Rotinas, produtos adequados e verificação da eficácia da limpeza."
                    }
                ]
            },
            "rop-5-4": {
                title: "ROP 5.4 – Prevenção de Infecções Associadas a Dispositivos Invasivos",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Prevenção de Infecções?",
                        options: [
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "De acordo com a ROP \"Prevenção de Infecções Associadas a Dispositivos Invasivos\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Tratar incidentes apenas verbalmente",
                            "Delegar integralmente ao paciente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual prática é coerente com \"Prevenção de Infecções Associadas a Dispositivos Invasivos\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                            "Aumento de variabilidade assistencial",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Prevenção de Infecções Associadas a Dispositivos Invasivos\"?",
                        options: [
                            "Tratar a ROP como opcional",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "No contexto de Prevenção de Infecções, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                            "Confiar apenas na experiência individual",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Resultados não acompanhados",
                            "Registros rastreáveis demonstrando aplicação",
                            "Cartazes sem ligação com prática real",
                            "Relatos verbais sem documentação",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Para a ROP \"Prevenção de Infecções Associadas a Dispositivos Invasivos\", qual indicador é mais adequado?",
                        options: [
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Monitorar adesão a práticas",
                            "Revisar políticas periodicamente",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Prevenção de Infecções Associadas a Dispositivos Invasivos\"?",
                        options: [
                            "Esperar reclamações para agir",
                            "Desconsiderar recursos necessários",
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Na implementação de \"Prevenção de Infecções Associadas a Dispositivos Invasivos\", qual risco precisa ser mitigado?",
                        options: [
                            "Disponibilidade de recursos",
                            "Mensuração de desempenho",
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Infecções Associadas a Dispositivos Invasivos: Bundles para cateteres, ventilação, urinário, com adesão monitorada."
                    }
                ]
            },
            "rop-5-5": {
                title: "ROP 5.5 – Precauções e Isolamento para Patógenos de Importância",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Prevenção de Infecções?",
                        options: [
                            "Reduzir riscos e padronizar práticas críticas",
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "De acordo com a ROP \"Precauções e Isolamento para Patógenos de Importância\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 1,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual prática é coerente com \"Precauções e Isolamento para Patógenos de Importância\"?",
                        options: [
                            "Ausência de responsáveis definidos",
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Desalinhamento estratégico",
                            "Aumento de variabilidade assistencial",
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                        ],
                        correctAnswer: 2,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Precauções e Isolamento para Patógenos de Importância\"?",
                        options: [
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Delegar tudo ao nível operacional",
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "No contexto de Prevenção de Infecções, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 1,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Para a ROP \"Precauções e Isolamento para Patógenos de Importância\", qual indicador é mais adequado?",
                        options: [
                            "Indicadores sem método de coleta",
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                            "Manter processos críticos sem atualização e sem treinamento",
                        ],
                        correctAnswer: 3,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Precauções e Isolamento para Patógenos de Importância\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Circular apenas um e-mail",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 1,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                        ],
                        correctAnswer: 3,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                            "Aumenta burocracia sem ganhos",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                            "Informal e dependente da memória",
                        ],
                        correctAnswer: 1,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Ausência de definição de papéis e responsabilidades",
                            "Treinamento da equipe",
                            "Revisões periódicas do processo",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Na implementação de \"Precauções e Isolamento para Patógenos de Importância\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 1,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Apoio exclusivamente voluntário",
                            "Mudanças sem gestão de mudança",
                            "Auditorias internas regulares e feedback",
                        ],
                        correctAnswer: 3,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Guiar decisões e priorização de melhorias",
                            "Substituir o julgamento clínico sempre",
                            "Ser ignorados quando desconfortáveis",
                        ],
                        correctAnswer: 1,
                        explanation: "Precauções e Isolamento para Patógenos de Importância: Critérios de isolamento, EPIs e sinalização para reduzir transmissão."
                    }
                ]
            }
        }
    },

    // ==================== MACRO ÁREA 6 - AVALIAÇÃO DE RISCO ====================
    "avaliacao-riscos": {
        title: "Avaliação de Risco",
        icon: "fas fa-exclamation-circle",
        color: "linear-gradient(135deg, #00BCD4 0%, #009688 100%)",
        subdivisoes: {
            "rop-6-1": {
                title: "ROP 6.1 – Prevenção de Quedas",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Avaliação de Risco?",
                        options: [
                            "Priorizar metas financeiras",
                            "Aumentar custos operacionais",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "De acordo com a ROP \"Prevenção de Quedas\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                            "Delegar integralmente ao paciente",
                            "Implementar processo formal com monitoramento",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual prática é coerente com \"Prevenção de Quedas\"?",
                        options: [
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Desalinhamento estratégico",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Prevenção de Quedas\"?",
                        options: [
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Tratar a ROP como opcional",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "No contexto de Avaliação de Risco, qual estratégia é consistente com a ROP?",
                        options: [
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Registros rastreáveis demonstrando aplicação",
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Para a ROP \"Prevenção de Quedas\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                            "Promover feedback estruturado",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Prevenção de Quedas\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Ignorar devido à baixa gravidade",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Foca apenas na imagem institucional",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Exemplos pontuais sem dados",
                            "Relatos não verificados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Clara, tempestiva, padronizada e rastreável",
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Na implementação de \"Prevenção de Quedas\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                            "Mudanças sem gestão de mudança",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser ignorados quando desconfortáveis",
                            "Guiar decisões e priorização de melhorias",
                            "Substituir o julgamento clínico sempre",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Quedas: Estratificação de risco, medidas ambientais e educação ao paciente."
                    }
                ]
            },
            "rop-6-2": {
                title: "ROP 6.2 – Prevenção de Lesão por Pressão",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Avaliação de Risco?",
                        options: [
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Desestimular a notificação de problemas",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "De acordo com a ROP \"Prevenção de Lesão por Pressão\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Tratar incidentes apenas verbalmente",
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Memorizar siglas sem documentação",
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual prática é coerente com \"Prevenção de Lesão por Pressão\"?",
                        options: [
                            "Decisões ad hoc sem registro",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Apenas comunicação informal",
                            "Ausência de responsáveis definidos",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                            "Melhoria mensurável em segurança/qualidade",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Prevenção de Lesão por Pressão\"?",
                        options: [
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Apenas aprovar documentos sem monitorar",
                            "Delegar tudo ao nível operacional",
                            "Tratar a ROP como opcional",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "No contexto de Avaliação de Risco, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Confiar apenas na experiência individual",
                            "Tratar desvios como punição automática",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Resultados não acompanhados",
                            "Relatos verbais sem documentação",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Esconder incidentes para proteger a imagem",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Para a ROP \"Prevenção de Lesão por Pressão\", qual indicador é mais adequado?",
                        options: [
                            "Indicadores sem método de coleta",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Somente satisfação geral",
                            "Qualquer indicador financeiro",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Monitorar adesão a práticas",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Promover feedback estruturado",
                            "Revisar políticas periodicamente",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Prevenção de Lesão por Pressão\"?",
                        options: [
                            "Circular apenas um e-mail",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Aguardar auditoria externa",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                        ],
                        correctAnswer: 1,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 0,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Revisões periódicas do processo",
                            "Treinamento da equipe",
                            "Ausência de definição de papéis e responsabilidades",
                            "Monitoramento por indicadores",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Na implementação de \"Prevenção de Lesão por Pressão\", qual risco precisa ser mitigado?",
                        options: [
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                            "Dependência de práticas não padronizadas",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 2,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Ser coletados sem uso",
                            "Ser ignorados quando desconfortáveis",
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                        ],
                        correctAnswer: 3,
                        explanation: "Prevenção de Lesão por Pressão: Avaliação de risco, mudança de decúbito e proteção de proeminências."
                    }
                ]
            },
            "rop-6-3": {
                title: "ROP 6.3 – Avaliação do Risco de Tromboembolismo Venoso (TEV)",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Avaliação de Risco?",
                        options: [
                            "Desestimular a notificação de problemas",
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Reduzir riscos e padronizar práticas críticas",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "De acordo com a ROP \"Avaliação do Risco de Tromboembolismo Venoso (TEV)\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Delegar integralmente ao paciente",
                            "Tratar incidentes apenas verbalmente",
                            "Aguardar auditorias externas para agir",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Aguardar avaliação anual para atualizar processos",
                            "Manter rotina não escrita baseada na cultura local",
                            "Memorizar siglas sem documentação",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual prática é coerente com \"Avaliação do Risco de Tromboembolismo Venoso (TEV)\"?",
                        options: [
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                            "Decisões ad hoc sem registro",
                            "Apenas comunicação informal",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Redução de transparência",
                            "Aumento de variabilidade assistencial",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Avaliação do Risco de Tromboembolismo Venoso (TEV)\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                            "Dar recursos, remover barreiras e cobrar resultados",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "No contexto de Avaliação de Risco, qual estratégia é consistente com a ROP?",
                        options: [
                            "Padronizar fluxos e criar barreiras contra falhas",
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Cartazes sem ligação com prática real",
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Focar apenas em culpados",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Ignorar indicadores",
                            "Esconder incidentes para proteger a imagem",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Para a ROP \"Avaliação do Risco de Tromboembolismo Venoso (TEV)\", qual indicador é mais adequado?",
                        options: [
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Qualquer indicador financeiro",
                            "Indicadores sem método de coleta",
                            "Somente satisfação geral",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Promover feedback estruturado",
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Avaliação do Risco de Tromboembolismo Venoso (TEV)\"?",
                        options: [
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Aguardar auditoria externa",
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Prioriza produção sobre segurança",
                            "Foca apenas na imagem institucional",
                            "Aumenta burocracia sem ganhos",
                            "Reduz variabilidade e previne eventos adversos",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Relatos não verificados",
                            "Exemplos pontuais sem dados",
                            "Tendência de melhoria sustentada nos indicadores",
                            "Percepções isoladas",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Somente entre líderes",
                            "Informal e dependente da memória",
                            "Apenas verbal e sem registro",
                            "Clara, tempestiva, padronizada e rastreável",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                            "Ausência de definição de papéis e responsabilidades",
                            "Revisões periódicas do processo",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Na implementação de \"Avaliação do Risco de Tromboembolismo Venoso (TEV)\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Engajamento de múltiplos setores",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                            "Substituir o julgamento clínico sempre",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação do Risco de Tromboembolismo Venoso (TEV): Estratificação, profilaxia adequada e reavaliação contínua."
                    }
                ]
            },
            "rop-6-4": {
                title: "ROP 6.4 – Avaliação e Manejo do Risco de Suicídio/Autoagressão",
                audioFile: null,
                questions: [
                    {
                        question: "Qual é o objetivo principal desta ROP em Avaliação de Risco?",
                        options: [
                            "Aumentar custos operacionais",
                            "Priorizar metas financeiras",
                            "Reduzir riscos e padronizar práticas críticas",
                            "Desestimular a notificação de problemas",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "De acordo com a ROP \"Avaliação e Manejo do Risco de Suicídio/Autoagressão\", qual ação é obrigatória para conformidade?",
                        options: [
                            "Implementar processo formal com monitoramento",
                            "Aguardar auditorias externas para agir",
                            "Tratar incidentes apenas verbalmente",
                            "Delegar integralmente ao paciente",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual dos itens melhor representa um teste de conformidade desta ROP?",
                        options: [
                            "Manter rotina não escrita baseada na cultura local",
                            "Aguardar avaliação anual para atualizar processos",
                            "Existência de política/protocolo vigente e evidências de aplicação",
                            "Memorizar siglas sem documentação",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual prática é coerente com \"Avaliação e Manejo do Risco de Suicídio/Autoagressão\"?",
                        options: [
                            "Apenas comunicação informal",
                            "Decisões ad hoc sem registro",
                            "Ausência de responsáveis definidos",
                            "Medidas padronizadas, treinadas e monitoradas",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual é a consequência esperada da boa aplicação desta ROP?",
                        options: [
                            "Melhoria mensurável em segurança/qualidade",
                            "Aumento de variabilidade assistencial",
                            "Redução de transparência",
                            "Desalinhamento estratégico",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual opção descreve melhor o papel da liderança na ROP \"Avaliação e Manejo do Risco de Suicídio/Autoagressão\"?",
                        options: [
                            "Apenas aprovar documentos sem monitorar",
                            "Dar recursos, remover barreiras e cobrar resultados",
                            "Tratar a ROP como opcional",
                            "Delegar tudo ao nível operacional",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "No contexto de Avaliação de Risco, qual estratégia é consistente com a ROP?",
                        options: [
                            "Evitar mensuração de indicadores",
                            "Tratar desvios como punição automática",
                            "Confiar apenas na experiência individual",
                            "Padronizar fluxos e criar barreiras contra falhas",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Em auditoria tipo tracer, que evidência sustenta a conformidade da ROP?",
                        options: [
                            "Registros rastreáveis demonstrando aplicação",
                            "Relatos verbais sem documentação",
                            "Resultados não acompanhados",
                            "Cartazes sem ligação com prática real",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual abordagem MAIS alinha-se ao aprendizado organizacional previsto pela ROP?",
                        options: [
                            "Esconder incidentes para proteger a imagem",
                            "Analisar causas, implementar ações e verificar eficácia",
                            "Focar apenas em culpados",
                            "Ignorar indicadores",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Para a ROP \"Avaliação e Manejo do Risco de Suicídio/Autoagressão\", qual indicador é mais adequado?",
                        options: [
                            "Qualquer indicador financeiro",
                            "Somente satisfação geral",
                            "Processo e/ou resultado diretamente ligado ao objetivo da ROP",
                            "Indicadores sem método de coleta",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual conduta está EM DESACORDO com a ROP?",
                        options: [
                            "Manter processos críticos sem atualização e sem treinamento",
                            "Revisar políticas periodicamente",
                            "Promover feedback estruturado",
                            "Monitorar adesão a práticas",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual a melhor prática para institucionalizar \"Avaliação e Manejo do Risco de Suicídio/Autoagressão\"?",
                        options: [
                            "Desconsiderar recursos necessários",
                            "Esperar reclamações para agir",
                            "Circular apenas um e-mail",
                            "Política, treinamento, auditoria e melhoria contínua",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Em caso de não conformidade, qual ação se espera?",
                        options: [
                            "Advertência informal sem registro",
                            "Plano de ação com prazos, responsáveis e verificação",
                            "Aguardar auditoria externa",
                            "Ignorar devido à baixa gravidade",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Como esta ROP apoia a segurança do paciente?",
                        options: [
                            "Foca apenas na imagem institucional",
                            "Prioriza produção sobre segurança",
                            "Reduz variabilidade e previne eventos adversos",
                            "Aumenta burocracia sem ganhos",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual evidência de efetividade é mais forte?",
                        options: [
                            "Tendência de melhoria sustentada nos indicadores",
                            "Relatos não verificados",
                            "Percepções isoladas",
                            "Exemplos pontuais sem dados",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual comunicação é esperada pelos padrões?",
                        options: [
                            "Informal e dependente da memória",
                            "Somente entre líderes",
                            "Clara, tempestiva, padronizada e rastreável",
                            "Apenas verbal e sem registro",
                        ],
                        correctAnswer: 2,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "O que NÃO é requisito típico desta ROP?",
                        options: [
                            "Treinamento da equipe",
                            "Monitoramento por indicadores",
                            "Revisões periódicas do processo",
                            "Ausência de definição de papéis e responsabilidades",
                        ],
                        correctAnswer: 3,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Na implementação de \"Avaliação e Manejo do Risco de Suicídio/Autoagressão\", qual risco precisa ser mitigado?",
                        options: [
                            "Dependência de práticas não padronizadas",
                            "Mensuração de desempenho",
                            "Disponibilidade de recursos",
                            "Engajamento de múltiplos setores",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual elemento facilita a sustentabilidade desta ROP?",
                        options: [
                            "Auditorias internas regulares e feedback",
                            "Apoio exclusivamente voluntário",
                            "Mudanças sem gestão de mudança",
                            "Processos sem donos",
                        ],
                        correctAnswer: 0,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    },
                    {
                        question: "Qual papel dos dados nesta ROP?",
                        options: [
                            "Substituir o julgamento clínico sempre",
                            "Guiar decisões e priorização de melhorias",
                            "Ser ignorados quando desconfortáveis",
                            "Ser coletados sem uso",
                        ],
                        correctAnswer: 1,
                        explanation: "Avaliação e Manejo do Risco de Suicídio/Autoagressão: Rastreamento, ambiente seguro, plano e encaminhamentos."
                    }
                ]
            }
        }
    }

};

// ES Module export
export default ropsData;
export { ropsData };