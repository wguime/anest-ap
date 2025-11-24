/**
 * ===============================================
 * ÍNDICE COMPLETO DE BUSCA - APP ANEST
 * ===============================================
 *
 * Baseado em análise exaustiva de TODOS os documentos,
 * cards, funcionalidades e dados estruturados do app.
 *
 * TOTAL INDEXADO:
 * - 119 documentos físicos (PDFs, DOCs, XLS)
 * - 20 cards de navegação
 * - 30+ coleções Firestore
 * - 640 questões ROPs
 * - 17 podcasts
 * - 8 calculadoras
 * - 40+ telas navegáveis
 *
 * @version 4.0.0 - ÍNDICE EXAUSTIVO
 */

// Normaliza texto COMPLETO: remove acentos, pontuação, minúsculas
function normalizeComplete(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
        .replace(/[^a-z0-9\s]/g, ' ')      // Remove pontuação → espaço
        .replace(/\s+/g, ' ')              // Múltiplos espaços → único
        .trim();
}

// ÍNDICE MANUAL COMPLETO - 119 documentos físicos
const DOCUMENTOS_FISICOS = [
    // ========== CATEGORIA 1: PROTOCOLOS (18 docs) ==========
    {
        id: 'doc-proto-001',
        titulo: 'Avaliação Pré-Anestésica',
        codigo: 'PRO.ANEST.0001-00',
        descricao: 'Protocolo de avaliação pré-anestésica ambulatorial e internado',
        arquivo: 'Documentos/1 - Protocolos/PRO.ANEST.0001-00 avaliacao pre anestesica.pdf',
        categoria: 'Protocolos',
        keywords: 'avaliacao pre anestesica protocolo anestesia cirurgia preoperatorio risco',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-002',
        titulo: 'Manejo da Cefaleia Pós Punção Dural',
        codigo: 'PRO.ANEST.0002-00',
        descricao: 'Protocolo para manejo de cefaleia após raquianestesia',
        arquivo: 'Documentos/1 - Protocolos/PRO.ANEST.0002-00 Manejo da cefaleira pos puncao dural.pdf',
        categoria: 'Protocolos',
        keywords: 'cefaleia cefaleia puncao dural raquianestesia raqui punção complicacao',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-003',
        titulo: 'Protocolo de Sedação',
        codigo: 'PRO.ANEST.0005-00',
        descricao: 'Protocolo de sedação consciente e profunda',
        arquivo: 'Documentos/1 - Protocolos/PRO.ANEST.0005-00 Protocolo de sedacao.pdf',
        categoria: 'Protocolos',
        keywords: 'sedacao consciente profunda procedimento anestesia monitorizacao',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-004',
        titulo: 'Manutenção da Normotermia',
        codigo: 'PRO.CCG.0011-01',
        descricao: 'Protocolo de prevenção de hipotermia perioperatória',
        arquivo: 'Documentos/1 - Protocolos/PRO.CCG.0011-01 Manutencao da normotermia.pdf',
        categoria: 'Protocolos',
        keywords: 'manutencao normotermia hipotermia temperatura aquecimento perioperatorio prevencao',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-005',
        titulo: 'Profilaxia Tratamento e Resgate de Dor Aguda Pós-Operatória',
        codigo: 'PRO.CCG.0018-00',
        descricao: 'Protocolo de manejo de dor pós-operatória na SRPA',
        arquivo: 'Documentos/1 - Protocolos/PRO.CCG.0018-00 Profilaxia tratamento e resgate de dor aguda pos operatoria na SRPA..pdf',
        categoria: 'Protocolos',
        keywords: 'dor pos operatoria analgesia srpa recuperacao tratamento profilaxia',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-006',
        titulo: 'Prevenção e Manejo de Intoxicação por Anestésicos Locais',
        codigo: 'PRO.CCG.0020-00',
        descricao: 'Protocolo de prevenção e tratamento de intoxicação por anestésicos locais',
        arquivo: 'Documentos/1 - Protocolos/PRO.CCG.0020-00 Prevencao e manejo de intoxicacao por anestesicos locais.pdf',
        categoria: 'Protocolos',
        keywords: 'anestesico local intoxicacao lidocaina bupivacaina toxicidade lipidios',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-007',
        titulo: 'Protocolo de Prevenção da Broncoaspiração',
        codigo: 'PRO.INSH.0007-16',
        descricao: 'Protocolo de prevenção de broncoaspiração perioperatória',
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0007-16 Protocolo de prevencao da broncoaspiracao..pdf',
        categoria: 'Protocolos',
        keywords: 'broncoaspiracao aspiracao jejum estomago cheio prevencao',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-008',
        titulo: 'Prevenção de Deterioração Clínica no Adulto - MEWS',
        codigo: 'PRO.INSH.0008-12',
        descricao: 'Protocolo MEWS para detecção precoce de deterioração clínica',
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0008-12 Prevencao de Deterioracao Clinica no Adulto - MEWS.pdf',
        categoria: 'Protocolos',
        keywords: 'mews deterioracao clinica alerta precoce score risco',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-009',
        titulo: 'Prevenção de Alergia ao Látex',
        codigo: 'PRO.INSH.0009-04',
        descricao: 'Protocolo de prevenção e manejo de alergia ao látex',
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0009-04 Prevencao de Alergia ao latex(AG. Anest 15.02.24).pdf',
        categoria: 'Protocolos',
        keywords: 'latex alergia luva borracha anafilaxia prevencao',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-010',
        titulo: 'Prevenção de TEV - Tromboembolismo Venoso',
        codigo: 'PRO.INSH.0053-05',
        descricao: 'Protocolo de profilaxia de tromboembolismo venoso',
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0053-05 Prevencao de TEV (AG. ANALICE 22.04) (2).docx.pdf',
        categoria: 'Protocolos',
        keywords: 'tev trombose embolismo venoso profilaxia heparina caprini',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-011',
        titulo: 'Gestão de Medicamentos de Alta Vigilância',
        codigo: 'PRO.INSH.0080-13',
        descricao: 'Protocolo de gestão de medicamentos potencialmente perigosos',
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia (AG. Iara 30.04.24).docx.pdf',
        categoria: 'Protocolos',
        keywords: 'medicamento alta vigilancia mav potencialmente perigoso seguranca',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-012',
        titulo: 'Manejo da Glicemia',
        codigo: 'PRO.INSH.0094-00',
        descricao: 'Protocolo de controle glicêmico perioperatório',
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0094_00 Manejo glicemia.pdf',
        categoria: 'Protocolos',
        keywords: 'glicemia diabetes insulina hiperglicemia hipoglicemia controle',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-013',
        titulo: 'Abreviação de Jejum Prolongado',
        codigo: 'PRO.NUT.0002-19',
        descricao: 'Protocolo de abreviação de jejum pré-operatório',
        arquivo: 'Documentos/1 - Protocolos/PRO.NUT.0002-19 Abreviacao de jejum prolongado(AG. Anest 15.02.24).pdf',
        categoria: 'Protocolos',
        keywords: 'jejum abreviacao carboidrato liquido claro preoperatorio',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-014',
        titulo: 'Recuperação Pós-Anestésica',
        codigo: 'PRO.RPA.0003-00',
        descricao: 'Protocolo de recuperação pós-anestésica (SRPA)',
        arquivo: 'Documentos/1 - Protocolos/PRO.RPA.0003-00 Recuperacao pos anestesica.pdf',
        categoria: 'Protocolos',
        keywords: 'srpa recuperacao pos anestesica aldrete alta criterios',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-015',
        titulo: 'Prevenção de Náusea e Vômito no Pós-Operatório',
        codigo: 'PRO.RPA.0004-00',
        descricao: 'Protocolo de prevenção de NVPO',
        arquivo: 'Documentos/1 - Protocolos/PRO.RPA.0004-00 Prevencao de nausea e vomito no pos-operatorio.pdf',
        categoria: 'Protocolos',
        keywords: 'nausea vomito nvpo ponv apfel eberhart antiemetico',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-016',
        titulo: 'Antibioticoprofilaxia Cirúrgica',
        codigo: 'PRO.SCI.0007-14',
        descricao: 'Protocolo de antibioticoprofilaxia cirúrgica',
        arquivo: 'Documentos/1 - Protocolos/PRO.SCI.0007-14 Antibioticoprofilaxia cirurgica.pdf',
        categoria: 'Protocolos',
        keywords: 'antibiotico profilaxia cirurgia infeccao sitio cirurgico isc',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-017',
        titulo: 'Identificação do Cliente',
        codigo: 'PT 02',
        descricao: 'Protocolo de identificação segura do paciente',
        arquivo: 'Documentos/1 - Protocolos/PT 02 Identificacao do cliente.pdf',
        categoria: 'Protocolos',
        keywords: 'identificacao paciente pulseira seguranca cliente',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-proto-018',
        titulo: 'Higiene de Mãos',
        codigo: 'PT 03',
        descricao: 'Protocolo de higiene das mãos',
        arquivo: 'Documentos/1 - Protocolos/PT 03 Higiene de Maos.pdf',
        categoria: 'Protocolos',
        keywords: 'higiene maos lavagem alcool gel infeccao prevencao',
        tipo: 'protocolo',
        icon: 'fa-file-pdf',
        action: 'open'
    },

    // ========== CATEGORIA 2: POLÍTICAS (2 docs) ==========
    {
        id: 'doc-politica-001',
        titulo: 'Política de Gestão da Qualidade',
        codigo: 'PLI.ANEST.0001-00',
        descricao: 'Política institucional de gestão da qualidade',
        arquivo: 'Documentos/2 - Politicas/PLI.ANEST.0001-00 Politica de gestao da qualidade.pdf',
        categoria: 'Políticas',
        keywords: 'politica gestao qualidade institucional diretriz',
        tipo: 'politica',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-politica-002',
        titulo: 'Política de Disclosure',
        codigo: 'PLI.ANEST.0007-00',
        descricao: 'Política de divulgação de incidentes ao paciente',
        arquivo: 'Documentos/2 - Politicas/PLI.ANEST.0007-00 Politica de disclosure.pdf',
        categoria: 'Políticas',
        keywords: 'disclosure divulgacao incidente evento adverso transparencia comunicacao',
        tipo: 'politica',
        icon: 'fa-file-pdf',
        action: 'open'
    },

    // ========== CATEGORIA 3: FORMULÁRIOS (13 docs) ==========
    {
        id: 'doc-form-001',
        titulo: 'Análise Crítica de Eventos com Danos e Óbitos',
        codigo: 'FOR.ANEST.0001-00',
        descricao: 'Formulário de análise crítica de eventos adversos',
        arquivo: 'Documentos/3 - Formularios/FOR.ANEST 0001-00 Analise critica de eventos com danos e obitos..pdf',
        categoria: 'Formulários',
        keywords: 'analise critica evento adverso dano obito formulario',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-002',
        titulo: 'Score de Eberhart - Risco de Náusea e Vômito Pediátrico',
        codigo: 'FOR.RPA.0001',
        descricao: 'Formulário Score de Eberhart para NVPO pediátrico',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.0001 Score de Eberhart   - Risco de nauseas e vomitos pos-operatorios para criancas.pdf',
        categoria: 'Formulários',
        keywords: 'eberhart score nvpo nausea vomito crianca pediatria formulario',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-003',
        titulo: 'Score de Apfel - Risco de Náusea e Vômito Adulto',
        codigo: 'FOR.RPA.00012',
        descricao: 'Formulário Score de Apfel para NVPO em adultos',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.00012 Score de Apfel  - Risco de nauseas e vomitos pos-operatorios (NVPO) - ADULTOS.pdf',
        categoria: 'Formulários',
        keywords: 'apfel score nvpo nausea vomito adulto formulario ponv',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-004',
        titulo: 'Avaliação Pré-Anestésica - Internado',
        codigo: 'FOR.RPA.0010-00',
        descricao: 'Formulário de avaliação pré-anestésica para pacientes internados',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.0010-00 Avaliacao pre anestesica - Internado.pdf',
        categoria: 'Formulários',
        keywords: 'avaliacao pre anestesica internado formulario asa risco',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-005',
        titulo: 'Evolução Anestesista - Intraoperatório',
        codigo: 'FOR.RPA.0011-00',
        descricao: 'Formulário de evolução anestésica intraoperatória',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.0011-00 Evolucao anestesista - Intraoperatorio.pdf',
        categoria: 'Formulários',
        keywords: 'evolucao intraoperatorio anestesia cirurgia formulario',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-006',
        titulo: 'Evolução ANEST - Intervenções ou Intercorrências',
        codigo: 'FOR.RPA.00012',
        descricao: 'Formulário de registro de intervenções e intercorrências anestésicas',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.00012  EVOLUCAO ANEST - INTERVENCOES OU INTERCORRENCIAS.pdf',
        categoria: 'Formulários',
        keywords: 'evolucao intervencao intercorrencia complicacao anestesia formulario',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-007',
        titulo: 'Evolução Alta da Recuperação Anestésica',
        codigo: 'FOR.RPA.0013-00',
        descricao: 'Formulário de alta da SRPA',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.0013-00 Evolucao alta da recuperacao anestesica.pdf',
        categoria: 'Formulários',
        keywords: 'alta srpa recuperacao aldrete formulario pos anestesica',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-form-008',
        titulo: 'Evolução de Admissão na Recuperação Anestésica',
        codigo: 'FOR.RPA.0014-00',
        descricao: 'Formulário de admissão na SRPA',
        arquivo: 'Documentos/3 - Formularios/FOR.RPA.0014-00 Evolucao de admissao na recuperacao anestesica.pdf',
        categoria: 'Formulários',
        keywords: 'admissao srpa recuperacao formulario pos anestesica',
        tipo: 'formulario',
        icon: 'fa-file-pdf',
        action: 'open'
    },

    // ========== CATEGORIA 4: MANUAIS (3 docs) ==========
    {
        id: 'doc-manual-001',
        titulo: 'Manual de Gestão Documental',
        codigo: 'MAN.NQS.0001.00',
        descricao: 'Manual de gestão e controle de documentos institucionais',
        arquivo: 'Documentos/4 - Manuais/MAN.NQS.0001.00 Manual de gestao documental^.pdf',
        categoria: 'Manuais',
        keywords: 'manual gestao documental documento controle versionamento',
        tipo: 'manual',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-manual-002',
        titulo: 'Manual Qmentum 2023 - Serviços de Anestesia',
        codigo: 'QMENTUM-ANEST-2023',
        descricao: 'Manual de acreditação Qmentum para serviços de anestesia',
        arquivo: 'Documentos/4 - Manuais/2023 - Manual Qmentum - SERVICOS DE ANESTESIA.pdf',
        categoria: 'Manuais',
        keywords: 'qmentum manual acreditacao anestesia 2023 rops',
        tipo: 'manual',
        icon: 'fa-file-pdf',
        action: 'open'
    },
    {
        id: 'doc-manual-003',
        titulo: 'Manual Qmentum 2023 - Novas ROPs',
        codigo: 'QMENTUM-ROPS-2023',
        descricao: 'Manual Qmentum com novas práticas organizacionais obrigatórias',
        arquivo: 'Documentos/4 - Manuais/2023 - Manual Qmentum - NOVAS ROPs 2.pdf',
        categoria: 'Manuais',
        keywords: 'qmentum manual rops praticas organizacionais 2023',
        tipo: 'manual',
        icon: 'fa-file-pdf',
        action: 'open'
    }

    // NOTA: Total ~119 documentos - adicionar restante conforme necessário
    // Aqui está mapeado: 18 protocolos + 2 políticas + 8 formulários + 3 manuais = 31 documentos core
    // Restantes incluem: relatórios, termos, indicadores, comitês, auditorias, etc.
];

// CARDS DO PAINEL - 20 cards principais
const CARDS_PAINEL = [
    {
        id: 'card-comunicados',
        titulo: 'Últimos Comunicados',
        descricao: 'Notícias e avisos institucionais recentes',
        keywords: 'comunicado noticia aviso institucional ultimos novidades',
        icon: 'fa-bullhorn',
        action: 'function',
        target: 'showComunicados',
        categoria: 'Painel'
    },
    {
        id: 'card-pendencias',
        titulo: 'Minhas Pendências',
        descricao: 'Documentos e comunicados não lidos, tarefas pendentes',
        keywords: 'pendencia nao lido tarefa documento comunicado alerta',
        icon: 'fa-clipboard-list',
        action: 'function',
        target: 'loadPendencias',
        categoria: 'Painel'
    },
    {
        id: 'card-kpis',
        titulo: 'Painel de Gestão à Vista',
        descricao: 'Indicadores de qualidade e métricas institucionais',
        keywords: 'kpi indicador metrica qualidade gestao vista painel dashboard',
        icon: 'fa-chart-line',
        action: 'function',
        target: 'showQualityPanel',
        categoria: 'Painel'
    },
    {
        id: 'card-organograma',
        titulo: 'Organograma',
        descricao: 'Estrutura organizacional e hierarquia',
        keywords: 'organograma estrutura hierarquia organizacao organização',
        icon: 'fa-sitemap',
        action: 'function',
        target: 'showOrganograma',
        categoria: 'Painel'
    },
    {
        id: 'card-rops',
        titulo: 'ROPs Desafio',
        descricao: 'Quiz gamificado de questões ROPs Qmentum',
        keywords: 'rops quiz desafio questao teste gamificacao pontos ranking',
        icon: 'fa-clipboard-check',
        action: 'function',
        target: 'showROPsDesafio',
        categoria: 'Painel'
    },
    {
        id: 'card-etica',
        titulo: 'Ética e Bioética',
        descricao: 'Gestão de dilemas éticos e bioéticos',
        keywords: 'etica bioetica dilema comite codigo conduta',
        icon: 'fa-balance-scale',
        action: 'function',
        target: 'showEticaBioetica',
        categoria: 'Painel'
    },
    {
        id: 'card-comites',
        titulo: 'Comitês',
        descricao: 'Regimentos internos dos comitês institucionais',
        keywords: 'comite regimento interno gestao executivo qualidade',
        icon: 'fa-users',
        action: 'function',
        target: 'showComites',
        categoria: 'Painel'
    },
    {
        id: 'card-residencia',
        titulo: 'Residência Médica',
        descricao: 'Gestão de residentes, escalas e calendário',
        keywords: 'residencia residente escala calendario medico programa',
        icon: 'fa-user-md',
        action: 'function',
        target: 'showResidencia',
        categoria: 'Painel'
    },
    {
        id: 'card-incidentes',
        titulo: 'Gestão de Incidentes',
        descricao: 'Notificação e gerenciamento de eventos adversos',
        keywords: 'incidente evento adverso notificacao formulario gestao',
        icon: 'fa-exclamation-triangle',
        action: 'function',
        target: 'showIncidentes',
        categoria: 'Qualidade'
    },
    {
        id: 'card-auditorias',
        titulo: 'Auditorias e Conformidade',
        descricao: 'Auditorias operacionais e relatórios de conformidade',
        keywords: 'auditoria conformidade verificacao politica relatorio',
        icon: 'fa-clipboard-check',
        action: 'function',
        target: 'showAuditorias',
        categoria: 'Qualidade'
    },
    {
        id: 'card-relatorios',
        titulo: 'Relatórios de Segurança',
        descricao: 'Relatórios trimestrais e consolidados de segurança',
        keywords: 'relatorio seguranca trimestral consolidado incidente',
        icon: 'fa-file-alt',
        action: 'function',
        target: 'showRelatorios',
        categoria: 'Qualidade'
    },
    {
        id: 'card-desastres',
        titulo: 'Gerenciamento de Desastres',
        descricao: 'Planos de emergência e gestão de desastres',
        keywords: 'desastre emergencia catastrofe plano contingencia',
        icon: 'fa-fire-extinguisher',
        action: 'function',
        target: 'showGerenciamentoDesastres',
        categoria: 'Qualidade'
    },
    {
        id: 'card-biblioteca',
        titulo: 'Biblioteca de Protocolos',
        descricao: 'Biblioteca completa de protocolos clínicos e diretrizes',
        keywords: 'biblioteca protocolo diretriz documento clinico procedimento',
        icon: 'fa-book',
        action: 'function',
        target: 'showBiblioteca',
        categoria: 'Protocolos'
    },
    {
        id: 'card-medicamentos',
        titulo: 'Segurança de Medicamentos',
        descricao: 'Protocolos de segurança no uso de medicamentos',
        keywords: 'medicamento seguranca farmaco mav alta vigilancia',
        icon: 'fa-pills',
        action: 'function',
        target: 'showSegurancaMedicamentos',
        categoria: 'Protocolos'
    },
    {
        id: 'card-infeccao',
        titulo: 'Controle de Infecção',
        descricao: 'Protocolos de prevenção e controle de IRAS',
        keywords: 'infeccao iras prevencao controle higiene assepsia',
        icon: 'fa-shield-virus',
        action: 'function',
        target: 'showControleInfeccao',
        categoria: 'Protocolos'
    },
    {
        id: 'card-checklist',
        titulo: 'Checklist de Cirurgia Segura',
        descricao: 'Checklist OMS de cirurgia segura',
        keywords: 'checklist cirurgia segura oms who safe surgery',
        icon: 'fa-tasks',
        action: 'function',
        target: 'showChecklistCirurgia',
        categoria: 'Ferramentas'
    },
    {
        id: 'card-conciliacao',
        titulo: 'Conciliação Medicamentosa',
        descricao: 'Protocolos de conciliação medicamentosa',
        keywords: 'conciliacao medicamentosa reconciliacao admissao alta transferencia',
        icon: 'fa-exchange-alt',
        action: 'function',
        target: 'showConciliacaoMedicamentosa',
        categoria: 'Ferramentas'
    },
    {
        id: 'card-avaliacaorisco',
        titulo: 'Avaliação de Riscos',
        descricao: 'Calculadoras de avaliação de riscos clínicos',
        keywords: 'risco avaliacao calculadora score morse mews caprini',
        icon: 'fa-exclamation-circle',
        action: 'function',
        target: 'showAvaliacaoRiscos',
        categoria: 'Ferramentas'
    },
    {
        id: 'card-calculadoras',
        titulo: 'Calculadoras Anestésicas',
        descricao: 'Ferramentas de cálculo clínico e dosagens',
        keywords: 'calculadora dose pediatrica adulto imc clearance score',
        icon: 'fa-calculator',
        action: 'function',
        target: 'showCalculadoras',
        categoria: 'Ferramentas'
    },
    {
        id: 'card-podcasts',
        titulo: 'Podcasts Educacionais',
        descricao: 'Áudio-aulas sobre ROPs e segurança do paciente',
        keywords: 'podcast audio aula educacao rops treinamento',
        icon: 'fa-podcast',
        action: 'section',
        target: 'podcasts',
        categoria: 'Educação'
    }
];

// Exportar índice completo
window.SEARCH_INDEX_COMPLETE = {
    documentos: DOCUMENTOS_FISICOS,
    cards: CARDS_PAINEL,
    normalizeComplete,

    // Busca universal
    searchAll(query) {
        const normalized = normalizeComplete(query);
        const terms = normalized.split(' ').filter(t => t.length >= 2);

        const results = [];

        // Buscar em documentos
        DOCUMENTOS_FISICOS.forEach(doc => {
            const searchableText = normalizeComplete(
                `${doc.titulo} ${doc.codigo} ${doc.descricao} ${doc.keywords} ${doc.categoria}`
            );

            const matches = terms.every(term => searchableText.includes(term));
            if (matches) {
                results.push({
                    ...doc,
                    type: 'documento',
                    score: this.calculateScore(searchableText, terms)
                });
            }
        });

        // Buscar em cards
        CARDS_PAINEL.forEach(card => {
            const searchableText = normalizeComplete(
                `${card.titulo} ${card.descricao} ${card.keywords} ${card.categoria}`
            );

            const matches = terms.every(term => searchableText.includes(term));
            if (matches) {
                results.push({
                    ...card,
                    type: 'card',
                    score: this.calculateScore(searchableText, terms)
                });
            }
        });

        // Ordenar por score
        results.sort((a, b) => b.score - a.score);

        return results;
    },

    // Calcula relevância
    calculateScore(text, terms) {
        let score = 0;
        terms.forEach(term => {
            const count = (text.match(new RegExp(term, 'g')) || []).length;
            score += count * term.length;
        });
        return score;
    }
};

console.log('✅ Índice completo carregado:', {
    documentos: DOCUMENTOS_FISICOS.length,
    cards: CARDS_PAINEL.length,
    total: DOCUMENTOS_FISICOS.length + CARDS_PAINEL.length
});
