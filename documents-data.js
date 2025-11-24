// ==================== DOCUMENTOS E ARQUIVOS DA ANEST ====================

const documentsData = {
    protocolos: [
        {
            title: "Avaliação Pré-Anestésica",
            file: "Documentos/1 - Protocolos/PRO.ANEST.0001-00 avaliacao pre anestesica.pdf",
            codigo: "PRO.ANEST.0001-00",
            categoria: "Anestesia"
        },
        {
            title: "Manejo da Cefaléia Pós Punção Dural",
            file: "Documentos/1 - Protocolos/PRO.ANEST.0002-00 Manejo da cefaleira pos puncao dural.pdf",
            codigo: "PRO.ANEST.0002-00",
            categoria: "Anestesia"
        },
        {
            title: "Manutenção da Normotermia",
            file: "Documentos/1 - Protocolos/PRO.CCG.0011-01 Manutencao da normotermia.pdf",
            codigo: "PRO.CCG.0011-01",
            categoria: "Cuidados Gerais"
        },
        {
            title: "Profilaxia, Tratamento e Resgate de Dor Aguda Pós-Operatória na SRPA",
            file: "Documentos/1 - Protocolos/PRO.CCG.0018-00 Profilaxia tratamento e resgate de dor aguda pos operatoria na SRPA..pdf",
            codigo: "PRO.CCG.0018-00",
            categoria: "Cuidados Gerais"
        },
        {
            title: "Prevenção e Manejo de Intoxicação por Anestésicos Locais",
            file: "Documentos/1 - Protocolos/PRO.CCG.0020-00 Prevencao e manejo de intoxicacao por anestesicos locais.pdf",
            codigo: "PRO.CCG.0020-00",
            categoria: "Cuidados Gerais"
        },
        {
            title: "Protocolo de Prevenção da Broncoaspiração",
            file: "Documentos/1 - Protocolos/PRO.INSH.0007-16 Protocolo de prevencao da broncoaspiracao..pdf",
            codigo: "PRO.INSH.0007-16",
            categoria: "Segurança Hospitalar"
        },
        {
            title: "Prevenção de Deterioração Clínica no Adulto - MEWS",
            file: "Documentos/1 - Protocolos/PRO.INSH.0008-12 Prevencao de Deterioracao Clinica no Adulto - MEWS.pdf",
            codigo: "PRO.INSH.0008-12",
            categoria: "Segurança Hospitalar"
        },
        {
            title: "Prevenção de Alergia ao Látex",
            file: "Documentos/1 - Protocolos/PRO.INSH.0009-04 Prevencao de Alergia ao latex(AG. Anest 15.02.24).pdf",
            codigo: "PRO.INSH.0009-04",
            categoria: "Segurança Hospitalar"
        },
        {
            title: "Prevenção de TEV (Tromboembolismo Venoso)",
            file: "Documentos/1 - Protocolos/PRO.INSH.0053-05 Prevencao de TEV (AG. ANALICE 22.04) (2).docx.pdf",
            codigo: "PRO.INSH.0053-05",
            categoria: "Segurança Hospitalar"
        },
        {
            title: "Gestão de Medicamentos de Alta Vigilância",
            file: "Documentos/1 - Protocolos/PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia (AG. Iara 30.04.24).docx.pdf",
            codigo: "PRO.INSH.0080-13",
            categoria: "Segurança Hospitalar"
        },
        {
            title: "Manejo da Glicemia",
            file: "Documentos/1 - Protocolos/PRO.INSH.0094_00 Manejo glicemia.pdf",
            codigo: "PRO.INSH.0094-00",
            categoria: "Segurança Hospitalar"
        },
        {
            title: "Abreviação de Jejum Prolongado",
            file: "Documentos/1 - Protocolos/PRO.NUT.0002-19 Abreviacao de jejum prolongado(AG. Anest 15.02.24).pdf",
            codigo: "PRO.NUT.0002-19",
            categoria: "Nutrição"
        },
        {
            title: "Recuperação Pós-Anestésica",
            file: "Documentos/1 - Protocolos/PRO.RPA.0003-00 Recuperacao pos anestesica.pdf",
            codigo: "PRO.RPA.0003-00",
            categoria: "RPA"
        },
        {
            title: "Prevenção de Náusea e Vômito no Pós-Operatório",
            file: "Documentos/1 - Protocolos/PRO.RPA.0004-00 Prevencao de nausea e vomito no pos-operatorio.pdf",
            codigo: "PRO.RPA.0004-00",
            categoria: "RPA"
        },
        {
            title: "Antibioticoprofilaxia Cirúrgica",
            file: "Documentos/1 - Protocolos/PRO.SCI.0007-14 Antibioticoprofilaxia cirurgica.pdf",
            codigo: "PRO.SCI.0007-14",
            categoria: "Cirurgia"
        },
        {
            title: "Identificação do Cliente",
            file: "Documentos/1 - Protocolos/PT 02 Identificacao do cliente.pdf",
            codigo: "PT 02",
            categoria: "Segurança"
        },
        {
            title: "Higiene de Mãos",
            file: "Documentos/1 - Protocolos/PT 03 Higiene de Maos.pdf",
            codigo: "PT 03",
            categoria: "Segurança"
        }
    ],

    politicas: [
        {
            title: "Política de Gestão da Qualidade",
            file: "Documentos/2 - Politicas/PLI.ANEST.0001-00 Politica de gestao da qualidade.pdf",
            codigo: "PLI.ANEST.0001-00",
            categoria: "Gestão"
        },
        {
            title: "Política de Disclosure",
            file: "Documentos/2 - Politicas/PLI.ANEST.0007-00 Politica de disclosure.pdf",
            codigo: "PLI.ANEST.0007-00",
            categoria: "Gestão"
        }
    ],

    formularios: [
        {
            title: "Análise Crítica de Eventos com Danos e Óbitos",
            file: "Documentos/3 - Formularios/FOR.ANEST 0001-00 Analise critica de eventos com danos e obitos..pdf",
            codigo: "FOR.ANEST.0001-00",
            tipo: "ODT"
        },
        {
            title: "Score de Eberhart - Risco de NVPO em Crianças",
            file: "Documentos/3 - Formularios/FOR.RPA.0001 Score de Eberhart   - Risco de nauseas e vomitos pos-operatorios para criancas.pdf",
            codigo: "FOR.RPA.0001",
            tipo: "DOCX"
        },
        {
            title: "Score de Apfel - Risco de NVPO em Adultos",
            file: "Documentos/3 - Formularios/FOR.RPA.00012 Score de Apfel  - Risco de nauseas e vomitos pos-operatorios (NVPO) - ADULTOS.pdf",
            codigo: "FOR.RPA.00012",
            tipo: "DOCX"
        },
        {
            title: "Avaliação Pré-Anestésica - Internado",
            file: "Documentos/3 - Formularios/FOR.RPA.0010-00 Avaliacao pre anestesica - Internado.pdf",
            codigo: "FOR.RPA.0010-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução Anestesista - Intraoperatório",
            file: "Documentos/3 - Formularios/FOR.RPA.0011-00 Evolucao anestesista - Intraoperatorio.pdf",
            codigo: "FOR.RPA.0011-00",
            tipo: "ODT"
        },
        {
            title: "Evolução - Intervenções ou Intercorrências",
            file: "Documentos/3 - Formularios/FOR.RPA.00012  EVOLUCAO ANEST - INTERVENCOES OU INTERCORRENCIAS.pdf",
            codigo: "FOR.RPA.00012",
            tipo: "DOCX"
        },
        {
            title: "Evolução Alta da Recuperação Anestésica",
            file: "Documentos/3 - Formularios/FOR.RPA.0013-00 Evolucao alta da recuperacao anestesica.pdf",
            codigo: "FOR.RPA.0013-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução de Admissão na Recuperação Anestésica",
            file: "Documentos/3 - Formularios/FOR.RPA.0014-00 Evolucao de admissao na recuperacao anestesica.pdf",
            codigo: "FOR.RPA.0014-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução ANEST - Avaliação Pré - Internado",
            file: "Documentos/3 - Formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - AVALIACAO PRE - INTERNADO (AG DR.GUILHERME).pdf",
            codigo: "XXX.NQS.0037-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução ANEST - Intraoperatório",
            file: "Documentos/3 - Formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - INT RAOPERATORIO (AG. DR.GUILHERME).pdf",
            codigo: "XXX.NQS.0037-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução ANEST - Intervenções ou Intercorrências",
            file: "Documentos/3 - Formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - INTERVENCOES OU INTERCORRENCIAS (AG DR.GUILHERME).pdf",
            codigo: "XXX.NQS.0037-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução ANEST - Sala de Recuperação - Admissão",
            file: "Documentos/3 - Formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - SALA DE RECUPERACAO - ADMISSAO (AG.DR.GUILHERME).pdf",
            codigo: "XXX.NQS.0037-00",
            tipo: "DOCX"
        },
        {
            title: "Evolução ANEST - Sala de Recuperação - Alta",
            file: "Documentos/3 - Formularios/XXX.NQS.0037-00 EVOLUCAO ANEST - SALA DE  RECUPERACAO - ALTA (AG DR.GUILHERME).pdf",
            codigo: "XXX.NQS.0037-00",
            tipo: "DOCX"
        }
    ],

    manuais: [
        {
            title: "Manual de Gestão Documental",
            file: "Documentos/4 - Manuais/MAN.NQS.0001.00 Manual de gestao documental^.pdf",
            codigo: "MAN.NQS.0001.00",
            categoria: "Gestão"
        },
        {
            title: "Manual Qmentum - Serviços de Anestesia",
            file: "Documentos/4 - Manuais/2023 - Manual Qmentum - SERVICOS DE ANESTESIA.pdf",
            ano: "2023",
            categoria: "Qmentum"
        }
    ],

    relatorios: [
        {
            title: "Relatório de Segurança - 3º Trimestre 2024",
            file: "Documentos/4 - Relatorios de Seguranca/RELATORIO DE SEGURANCA 3° TRIMESTRE 2024.pdf",
            periodo: "3º Trimestre 2024",
            tipo: "Trimestral"
        },
        {
            title: "Segurança do Paciente - Serviço de Anestesia ANEST Chapecó",
            file: "Documentos/4 - Relatorios de Seguranca/Seguranca-do-Paciente-Servico-de-Anestesia-ANEST-Chapeco.pdf",
            tipo: "Anual"
        },
        {
            title: "Divisão de Indicadores",
            file: "Documentos/4 - Relatorios de Seguranca/DIVISAO INDICADORES.pdf",
            tipo: "Indicadores"
        },
        {
            title: "Relatório de Segurança do Paciente - Incidentes",
            file: "Documentos/4 - Relatorios de Seguranca/Relatório de Segurança do Paciente - Incidentes..pdf",
            tipo: "Incidentes"
        },
        {
            title: "Indicadores - Tabela de Resultados",
            file: "Documentos/7 - Ficha Tecnica Indicadores/Indicadores - Tabela Resultados.pdf",
            tipo: "Indicadores",
            categoria: "Ficha Técnica"
        }
    ],

    processos: [
        {
            title: "Mapa de Processos - Serviço de Anestesia (SIPOC)",
            file: "Documentos/5 - Mapeamento de Processos/MAP.ANEST 0001-00 Mapa de processos servico anestesia (SIPOC).pdf",
            codigo: "MAP.ANEST.0001-00",
            tipo: "SIPOC"
        }
    ],

    termos: [
        {
            title: "Termo de Consentimento Livre e Esclarecido",
            file: "Documentos/6 - Termos/Termo de Consentimento Livre e Esclarecido.pdf",
            categoria: "Consentimento",
            tipo: "TCLE"
        }
    ],

    riscos: [
        {
            title: "Mapeamento de Riscos",
            file: "Documentos/8 - Mapeamento dos Riscos/Mapeamento de Riscos.pdf",
            ano: "2024"
        }
    ],

    planoSeguranca: [
        {
            title: "Plano de Segurança do Paciente",
            file: "Documentos/9 - Plano de Seguranca do Paciente/PLA.ANEST.0001-00 Plano de seguranca do paciente.pdf",
            codigo: "PLA.ANEST.0001-00",
            ano: "2024"
        },
        {
            title: "Segurança do Paciente - Serviço de Anestesia ANEST Chapecó",
            file: "Documentos/9 - Plano de Seguranca do Paciente/Seguranca-do-Paciente-Servico-de-Anestesia-ANEST-Chapeco.pdf",
            tipo: "Relatório de Segurança",
            ano: "2024"
        },
        {
            title: "Relatório de Segurança do Paciente - Incidentes",
            file: "Documentos/9 - Plano de Seguranca do Paciente/Relatório de Segurança do Paciente - Incidentes..pdf",
            tipo: "Relatório de Incidentes",
            ano: "2024"
        }
    ],

    auditorias: [
        {
            title: "Relatório de Auditorias das ROPS 2.2025",
            file: "Documentos/7 - Ficha Tecnica Indicadores/Relatorio de Auditorias das ROPS 2.2025.pdf",
            tipo: "Relatório de Auditoria",
            ano: "2025",
            categoria: "Auditorias e Conformidade"
        }
    ]
};

// ==================== PODCASTS E ÁUDIO AULAS ====================
// NOTA: Os dados de podcasts foram movidos para podcasts-data.js
// Este arquivo não deve mais definir podcastsData para evitar sobrescrever
// os dados corretos do Firebase Storage

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { documentsData };
}

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.documentsData = documentsData;
    // Não sobrescrever podcastsData - ele já está definido em podcasts-data.js
    // window.podcastsData é definido em podcasts-data.js com URLs corretas do Firebase Storage
}

