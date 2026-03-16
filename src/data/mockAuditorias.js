// Dados mockados dos documentos de auditoria
// Estrutura IGUAL ao mockDocumentos.js
// Total: documentos organizados por tipo de auditoria

// Helper para gerar versoes de um documento
const gerarVersoes = (doc, numVersoes = 1) => {
  const versoes = [];
  for (let v = doc.versaoAtual; v >= 1; v--) {
    versoes.push({
      versao: v,
      arquivoURL: v === doc.versaoAtual ? doc.arquivoURL : '#',
      arquivoNome: `${doc.codigo.replace('-00', '')}-${String(v).padStart(2, '0')}.pdf`,
      descricaoAlteracao: v === 1 ? 'Versao inicial do documento' : `Revisao ${v} - Atualizacoes conforme analise critica`,
      motivoAlteracao: v === 1 ? 'Criacao do documento' : 'Revisao periodica / Melhoria continua',
      status: v === doc.versaoAtual ? 'ativo' : 'arquivado',
      createdAt: new Date(new Date(doc.createdAt).getTime() + (v - 1) * 90 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: doc.createdBy,
      createdByName: doc.createdByName,
      aprovadoPor: 'Dr. Coordenador',
      dataAprovacao: new Date(new Date(doc.createdAt).getTime() + (v - 1) * 90 * 24 * 60 * 60 * 1000 + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return versoes;
};

export const mockAuditoriaDocumentos = [
  // ===================== HIGIENE DAS MAOS (4 documentos) =====================
  {
    id: 'aud-hig-001',
    codigo: 'AUD.HIG.001-01',
    titulo: 'Formulario de Observacao - Higiene das Maos Q1 2025',
    descricao: 'Formulario para registro de observacoes de adesao aos 5 momentos de higiene das maos conforme OMS - Primeiro trimestre 2025',
    tipo: 'higiene_maos',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['higiene', 'observacao', '2025', 'Q1', 'OMS'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2025-01-15T10:00:00Z',
    createdBy: 'coordenador@anest.com.br',
    createdByName: 'Dr. Joao Silva',
    updatedAt: '2025-01-15T10:00:00Z',
    proximaRevisao: '2025-04-15',
    responsavelRevisao: 'Dra. Maria Santos',
    versoes: [
      {
        versao: 1,
        arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        arquivoNome: 'AUD.HIG.001-01.pdf',
        descricaoAlteracao: 'Versao inicial do formulario Q1 2025',
        motivoAlteracao: 'Inicio do ciclo de auditorias 2025',
        status: 'ativo',
        createdAt: '2025-01-15T10:00:00Z',
        createdBy: 'coordenador@anest.com.br',
        createdByName: 'Dr. Joao Silva',
        aprovadoPor: 'Dra. Ana Coordenadora',
        dataAprovacao: '2025-01-16T10:00:00Z',
      },
    ],
  },
  {
    id: 'aud-hig-002',
    codigo: 'AUD.HIG.002-02',
    titulo: 'Relatorio Trimestral de Adesao - Higiene das Maos',
    descricao: 'Relatorio consolidado trimestral com indicadores de adesao a higienizacao das maos por setor e categoria profissional',
    tipo: 'higiene_maos',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 2,
    status: 'ativo',
    tags: ['relatorio', 'trimestral', 'indicadores', 'adesao'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-10-01T10:00:00Z',
    createdBy: 'coordenador@anest.com.br',
    createdByName: 'Dr. Joao Silva',
    updatedAt: '2025-01-10T10:00:00Z',
    proximaRevisao: '2025-04-10',
    responsavelRevisao: 'Dr. Joao Silva',
    versoes: [
      {
        versao: 2,
        arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        arquivoNome: 'AUD.HIG.002-02.pdf',
        descricaoAlteracao: 'Atualizacao com dados do Q4 2024',
        motivoAlteracao: 'Revisao trimestral',
        status: 'ativo',
        createdAt: '2025-01-10T10:00:00Z',
        createdBy: 'coordenador@anest.com.br',
        createdByName: 'Dr. Joao Silva',
        aprovadoPor: 'Dr. Coordenador',
        dataAprovacao: '2025-01-12T10:00:00Z',
      },
      {
        versao: 1,
        arquivoURL: '#',
        arquivoNome: 'AUD.HIG.002-01.pdf',
        descricaoAlteracao: 'Versao inicial',
        motivoAlteracao: 'Criacao do documento',
        status: 'arquivado',
        createdAt: '2024-10-01T10:00:00Z',
        createdBy: 'coordenador@anest.com.br',
        createdByName: 'Dr. Joao Silva',
        aprovadoPor: 'Dr. Coordenador',
        dataAprovacao: '2024-10-05T10:00:00Z',
      },
    ],
  },
  {
    id: 'aud-hig-003',
    codigo: 'AUD.HIG.003-01',
    titulo: 'Checklist de Insumos - Pontos de Higienizacao',
    descricao: 'Checklist para verificacao de disponibilidade de insumos nos pontos de higienizacao das maos',
    tipo: 'higiene_maos',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['checklist', 'insumos', 'dispensadores'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-08-01T10:00:00Z',
    createdBy: 'enfermeiro@anest.com.br',
    createdByName: 'Enf. Patricia Lima',
    updatedAt: '2024-08-01T10:00:00Z',
    proximaRevisao: '2025-08-01',
    responsavelRevisao: 'Enf. Patricia Lima',
  },
  {
    id: 'aud-hig-004',
    codigo: 'AUD.HIG.004-01',
    titulo: 'Plano de Acao - Melhoria da Adesao',
    descricao: 'Plano de acao com estrategias para melhoria dos indices de adesao a higienizacao das maos',
    tipo: 'higiene_maos',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['plano de acao', 'melhoria', 'estrategias'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-11-15T10:00:00Z',
    createdBy: 'coordenador@anest.com.br',
    createdByName: 'Dr. Joao Silva',
    updatedAt: '2024-11-15T10:00:00Z',
    proximaRevisao: '2025-05-15',
    responsavelRevisao: 'Dr. Joao Silva',
  },

  // ===================== USO DE MEDICAMENTOS (3 documentos) =====================
  {
    id: 'aud-med-001',
    codigo: 'AUD.MED.001-01',
    titulo: 'Auditoria de Prescricao de Medicamentos',
    descricao: 'Formulario de auditoria para verificacao de prescricoes medicas quanto a legibilidade, completude e conformidade',
    tipo: 'uso_medicamentos',
    setorId: 'farmacia',
    setorNome: 'Farmacia',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['prescricao', 'conformidade', 'farmacia'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-09-01T10:00:00Z',
    createdBy: 'farmaceutico@anest.com.br',
    createdByName: 'Dra. Carla Farmaceutica',
    updatedAt: '2024-09-01T10:00:00Z',
    proximaRevisao: '2025-09-01',
    responsavelRevisao: 'Dra. Carla Farmaceutica',
  },
  {
    id: 'aud-med-002',
    codigo: 'AUD.MED.002-01',
    titulo: 'Auditoria de Administracao de Medicamentos',
    descricao: 'Checklist de auditoria dos 9 certos na administracao de medicamentos',
    tipo: 'uso_medicamentos',
    setorId: 'farmacia',
    setorNome: 'Farmacia',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['administracao', '9 certos', 'seguranca'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-09-15T10:00:00Z',
    createdBy: 'enfermeiro@anest.com.br',
    createdByName: 'Enf. Patricia Lima',
    updatedAt: '2024-09-15T10:00:00Z',
    proximaRevisao: '2025-09-15',
    responsavelRevisao: 'Enf. Patricia Lima',
  },
  {
    id: 'aud-med-003',
    codigo: 'AUD.MED.003-01',
    titulo: 'Relatorio de Medicamentos de Alta Vigilancia',
    descricao: 'Relatorio de auditoria de armazenamento e uso de medicamentos de alta vigilancia (MAV)',
    tipo: 'uso_medicamentos',
    setorId: 'farmacia',
    setorNome: 'Farmacia',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['MAV', 'alta vigilancia', 'armazenamento'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-10-01T10:00:00Z',
    createdBy: 'farmaceutico@anest.com.br',
    createdByName: 'Dra. Carla Farmaceutica',
    updatedAt: '2024-10-01T10:00:00Z',
    proximaRevisao: '2025-10-01',
    responsavelRevisao: 'Dra. Carla Farmaceutica',
  },

  // ===================== ABREVIATURAS PERIGOSAS (2 documentos) =====================
  {
    id: 'aud-abr-001',
    codigo: 'AUD.ABR.001-02',
    titulo: 'Lista de Abreviaturas Nao Permitidas',
    descricao: 'Lista oficial de abreviaturas, siglas e simbolos proibidos na prescricao e documentacao clinica',
    tipo: 'abreviaturas',
    setorId: 'seguranca',
    setorNome: 'Seguranca do Paciente',
    versaoAtual: 2,
    status: 'ativo',
    tags: ['abreviaturas', 'proibidas', 'prescricao'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-01-01T10:00:00Z',
    createdBy: 'coordenador@anest.com.br',
    createdByName: 'Dr. Joao Silva',
    updatedAt: '2025-01-05T10:00:00Z',
    proximaRevisao: '2026-01-05',
    responsavelRevisao: 'Dr. Joao Silva',
    versoes: [
      {
        versao: 2,
        arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        arquivoNome: 'AUD.ABR.001-02.pdf',
        descricaoAlteracao: 'Inclusao de novas abreviaturas identificadas',
        motivoAlteracao: 'Revisao anual',
        status: 'ativo',
        createdAt: '2025-01-05T10:00:00Z',
        createdBy: 'coordenador@anest.com.br',
        createdByName: 'Dr. Joao Silva',
        aprovadoPor: 'Dra. Ana Coordenadora',
        dataAprovacao: '2025-01-07T10:00:00Z',
      },
      {
        versao: 1,
        arquivoURL: '#',
        arquivoNome: 'AUD.ABR.001-01.pdf',
        descricaoAlteracao: 'Versao inicial',
        motivoAlteracao: 'Criacao do documento',
        status: 'arquivado',
        createdAt: '2024-01-01T10:00:00Z',
        createdBy: 'coordenador@anest.com.br',
        createdByName: 'Dr. Joao Silva',
        aprovadoPor: 'Dr. Coordenador',
        dataAprovacao: '2024-01-05T10:00:00Z',
      },
    ],
  },
  {
    id: 'aud-abr-002',
    codigo: 'AUD.ABR.002-01',
    titulo: 'Auditoria de Uso de Abreviaturas',
    descricao: 'Formulario de auditoria para identificar uso de abreviaturas proibidas em prontuarios e prescricoes',
    tipo: 'abreviaturas',
    setorId: 'seguranca',
    setorNome: 'Seguranca do Paciente',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['auditoria', 'prontuario', 'conformidade'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-06-01T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Enf. Quality Analyst',
    updatedAt: '2024-06-01T10:00:00Z',
    proximaRevisao: '2025-06-01',
    responsavelRevisao: 'Enf. Quality Analyst',
  },

  // ===================== POLITICA DE GESTAO DA QUALIDADE (2 documentos) =====================
  {
    id: 'aud-pol-001',
    codigo: 'POL.QUAL.001-03',
    titulo: 'Politica de Gestao da Qualidade - ANEST',
    descricao: 'Politica institucional que estabelece as diretrizes, principios e compromissos da organizacao com a qualidade assistencial',
    tipo: 'politica_qualidade',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 3,
    status: 'ativo',
    tags: ['politica', 'qualidade', 'diretrizes', 'institucional'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2023-01-01T10:00:00Z',
    createdBy: 'direcao@anest.com.br',
    createdByName: 'Dr. Diretor Clinico',
    updatedAt: '2025-01-02T10:00:00Z',
    proximaRevisao: '2026-01-02',
    responsavelRevisao: 'Dr. Diretor Clinico',
    versoes: [
      {
        versao: 3,
        arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        arquivoNome: 'POL.QUAL.001-03.pdf',
        descricaoAlteracao: 'Alinhamento com requisitos Qmentum 2025',
        motivoAlteracao: 'Atualizacao para acreditacao',
        status: 'ativo',
        createdAt: '2025-01-02T10:00:00Z',
        createdBy: 'direcao@anest.com.br',
        createdByName: 'Dr. Diretor Clinico',
        aprovadoPor: 'Diretoria Executiva',
        dataAprovacao: '2025-01-05T10:00:00Z',
      },
    ],
  },
  {
    id: 'aud-pol-002',
    codigo: 'POL.QUAL.002-01',
    titulo: 'Manual do Sistema de Gestao da Qualidade',
    descricao: 'Manual que descreve o Sistema de Gestao da Qualidade, seus processos e interacoes',
    tipo: 'politica_qualidade',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['manual', 'SGQ', 'processos'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-03-01T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Coord. Qualidade',
    updatedAt: '2024-03-01T10:00:00Z',
    proximaRevisao: '2025-03-01',
    responsavelRevisao: 'Coord. Qualidade',
  },

  // ===================== POLITICA DE DISCLOSURE (2 documentos) =====================
  {
    id: 'aud-disc-001',
    codigo: 'POL.DISC.001-02',
    titulo: 'Politica de Disclosure - Comunicacao de Eventos Adversos',
    descricao: 'Politica que estabelece diretrizes para comunicacao aberta e transparente com pacientes e familiares sobre eventos adversos',
    tipo: 'politica_disclosure',
    setorId: 'seguranca',
    setorNome: 'Seguranca do Paciente',
    versaoAtual: 2,
    status: 'ativo',
    tags: ['disclosure', 'comunicacao', 'eventos adversos', 'transparencia'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2023-06-01T10:00:00Z',
    createdBy: 'seguranca@anest.com.br',
    createdByName: 'Coord. Seguranca Paciente',
    updatedAt: '2024-12-01T10:00:00Z',
    proximaRevisao: '2025-12-01',
    responsavelRevisao: 'Coord. Seguranca Paciente',
    versoes: [
      {
        versao: 2,
        arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
        arquivoNome: 'POL.DISC.001-02.pdf',
        descricaoAlteracao: 'Inclusao de fluxograma e templates de comunicacao',
        motivoAlteracao: 'Melhoria do processo',
        status: 'ativo',
        createdAt: '2024-12-01T10:00:00Z',
        createdBy: 'seguranca@anest.com.br',
        createdByName: 'Coord. Seguranca Paciente',
        aprovadoPor: 'Dr. Diretor Clinico',
        dataAprovacao: '2024-12-05T10:00:00Z',
      },
    ],
  },
  {
    id: 'aud-disc-002',
    codigo: 'FOR.DISC.001-01',
    titulo: 'Formulario de Registro de Disclosure',
    descricao: 'Formulario para documentacao do processo de disclosure realizado com paciente e/ou familia',
    tipo: 'politica_disclosure',
    setorId: 'seguranca',
    setorNome: 'Seguranca do Paciente',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['formulario', 'registro', 'documentacao'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-01-15T10:00:00Z',
    createdBy: 'seguranca@anest.com.br',
    createdByName: 'Coord. Seguranca Paciente',
    updatedAt: '2024-01-15T10:00:00Z',
    proximaRevisao: '2025-01-15',
    responsavelRevisao: 'Coord. Seguranca Paciente',
  },

  // ===================== RELATORIO DE AUDITORIAS ROPs (3 documentos) =====================
  {
    id: 'aud-rops-001',
    codigo: 'REL.ROPS.2024-Q4',
    titulo: 'Relatorio de Auditorias ROPs - Q4 2024',
    descricao: 'Relatorio consolidado das auditorias das Praticas Organizacionais Requeridas (ROPs) do quarto trimestre de 2024',
    tipo: 'relatorio_rops',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['ROPs', 'trimestral', 'Q4', '2024', 'Qmentum'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2025-01-10T10:00:00Z',
    createdBy: 'coordenador@anest.com.br',
    createdByName: 'Dr. Joao Silva',
    updatedAt: '2025-01-10T10:00:00Z',
    proximaRevisao: '2025-04-10',
    responsavelRevisao: 'Dr. Joao Silva',
  },
  {
    id: 'aud-rops-002',
    codigo: 'REL.ROPS.2024-ANUAL',
    titulo: 'Relatorio Anual de Auditorias ROPs - 2024',
    descricao: 'Relatorio anual consolidado de todas as auditorias ROPs realizadas em 2024',
    tipo: 'relatorio_rops',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['ROPs', 'anual', '2024', 'consolidado'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2025-01-15T10:00:00Z',
    createdBy: 'coordenador@anest.com.br',
    createdByName: 'Dr. Joao Silva',
    updatedAt: '2025-01-15T10:00:00Z',
    proximaRevisao: '2026-01-15',
    responsavelRevisao: 'Dr. Joao Silva',
  },
  {
    id: 'aud-rops-003',
    codigo: 'CHK.ROPS.001-01',
    titulo: 'Checklist de Auditoria ROPs',
    descricao: 'Checklist padronizado para realizacao de auditorias das Praticas Organizacionais Requeridas',
    tipo: 'relatorio_rops',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['checklist', 'auditoria', 'ROPs', 'padronizado'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-06-01T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Coord. Qualidade',
    updatedAt: '2024-06-01T10:00:00Z',
    proximaRevisao: '2025-06-01',
    responsavelRevisao: 'Coord. Qualidade',
  },

  // ===================== OPERACIONAL (2 documentos) =====================
  {
    id: 'aud-oper-001',
    codigo: 'AUD.OPER.001-01',
    titulo: 'Auditoria de Processos Assistenciais',
    descricao: 'Formulario de auditoria para verificacao de conformidade dos processos assistenciais',
    tipo: 'operacional',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['processos', 'assistencial', 'conformidade'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-07-01T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Coord. Qualidade',
    updatedAt: '2024-07-01T10:00:00Z',
    proximaRevisao: '2025-07-01',
    responsavelRevisao: 'Coord. Qualidade',
  },
  {
    id: 'aud-oper-002',
    codigo: 'REL.OPER.2024-01',
    titulo: 'Relatorio de Auditorias Operacionais - 2024',
    descricao: 'Consolidado das auditorias operacionais realizadas no ano de 2024',
    tipo: 'operacional',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['relatorio', 'operacional', '2024'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2025-01-05T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Coord. Qualidade',
    updatedAt: '2025-01-05T10:00:00Z',
    proximaRevisao: '2026-01-05',
    responsavelRevisao: 'Coord. Qualidade',
  },

  // ===================== CONFORMIDADE (2 documentos) =====================
  {
    id: 'aud-conf-001',
    codigo: 'AUD.CONF.001-01',
    titulo: 'Auditoria de Conformidade com Politicas',
    descricao: 'Checklist de auditoria para verificacao de conformidade com politicas institucionais',
    tipo: 'conformidade',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['conformidade', 'politicas', 'institucional'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2024-04-01T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Coord. Qualidade',
    updatedAt: '2024-04-01T10:00:00Z',
    proximaRevisao: '2025-04-01',
    responsavelRevisao: 'Coord. Qualidade',
  },
  {
    id: 'aud-conf-002',
    codigo: 'REL.CONF.2024-01',
    titulo: 'Relatorio de Conformidade - 2024',
    descricao: 'Relatorio anual de conformidade com normas e regulamentos aplicaveis',
    tipo: 'conformidade',
    setorId: 'qualidade',
    setorNome: 'Gestao da Qualidade',
    versaoAtual: 1,
    status: 'ativo',
    tags: ['relatorio', 'conformidade', 'normas', '2024'],
    arquivoURL: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    createdAt: '2025-01-08T10:00:00Z',
    createdBy: 'qualidade@anest.com.br',
    createdByName: 'Coord. Qualidade',
    updatedAt: '2025-01-08T10:00:00Z',
    proximaRevisao: '2026-01-08',
    responsavelRevisao: 'Coord. Qualidade',
  },
];

// =============================================================================
// HELPERS DE CONSULTA
// =============================================================================

// Buscar documento por ID
export const getAuditoriaDocumentoById = (id) => {
  return mockAuditoriaDocumentos.find(d => d.id === id);
};

// Filtrar documentos por status
export const getAuditoriaDocumentosByStatus = (status) => {
  return mockAuditoriaDocumentos.filter(d => d.status === status);
};

// Buscar documentos por termo
export const searchAuditoriaDocumentos = (term) => {
  const lowerTerm = term.toLowerCase();
  return mockAuditoriaDocumentos.filter(d =>
    d.status === 'ativo' && (
      d.titulo.toLowerCase().includes(lowerTerm) ||
      d.codigo.toLowerCase().includes(lowerTerm) ||
      d.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))
    )
  );
};

// Agrupar documentos por tipo
export const getAuditoriaDocumentosPorTipo = () => {
  const grupos = {};
  mockAuditoriaDocumentos
    .filter(d => d.status === 'ativo')
    .forEach(doc => {
      if (!grupos[doc.tipo]) {
        grupos[doc.tipo] = [];
      }
      grupos[doc.tipo].push(doc);
    });
  return grupos;
};

// Contar documentos por tipo
export const getAuditoriaCountPorTipo = () => {
  const tipos = {};
  mockAuditoriaDocumentos.forEach(d => {
    tipos[d.tipo] = (tipos[d.tipo] || 0) + 1;
  });
  return tipos;
};

// Estatisticas gerais
export const auditoriaStats = {
  total: mockAuditoriaDocumentos.length,
  ativos: mockAuditoriaDocumentos.filter(d => d.status === 'ativo').length,
  arquivados: mockAuditoriaDocumentos.filter(d => d.status === 'arquivado').length,
  porTipo: getAuditoriaCountPorTipo(),
};

// =============================================================================
// FUNCOES DE MUTACAO (para gestao documental)
// =============================================================================

// Gerar codigo unico para novo documento
export const gerarCodigoAuditoria = (tipo) => {
  const prefixos = {
    higiene_maos: 'AUD.HIG',
    uso_medicamentos: 'AUD.MED',
    abreviaturas: 'AUD.ABR',
    politica_qualidade: 'POL.QUAL',
    politica_disclosure: 'POL.DISC',
    relatorio_rops: 'REL.ROPS',
    operacional: 'AUD.OPER',
    conformidade: 'AUD.CONF',
  };
  const prefix = prefixos[tipo] || 'AUD.GEN';
  const count = mockAuditoriaDocumentos.filter(d => d.tipo === tipo).length + 1;
  return `${prefix}.${String(count).padStart(3, '0')}-01`;
};

// Adicionar novo documento
export const addAuditoriaDocumento = (docData) => {
  const newDoc = {
    id: `aud-${Date.now()}`,
    codigo: docData.codigo || gerarCodigoAuditoria(docData.tipo),
    titulo: docData.titulo,
    descricao: docData.descricao || '',
    tipo: docData.tipo,
    setorId: docData.setorId || 'qualidade',
    setorNome: docData.setorNome || 'Gestao da Qualidade',
    versaoAtual: 1,
    status: docData.status || 'ativo',
    tags: docData.tags || [],
    arquivoURL: docData.arquivoURL || '',
    createdAt: new Date().toISOString(),
    createdBy: docData.createdBy || 'admin@anest.com.br',
    createdByName: docData.createdByName || 'Administrador',
    updatedAt: new Date().toISOString(),
    proximaRevisao: docData.proximaRevisao || null,
    responsavelRevisao: docData.responsavelRevisao || null,
    versoes: [{
      versao: 1,
      arquivoURL: docData.arquivoURL || '',
      arquivoNome: `${docData.codigo || 'documento'}.pdf`,
      descricaoAlteracao: 'Versao inicial do documento',
      motivoAlteracao: 'Criacao do documento',
      status: 'ativo',
      createdAt: new Date().toISOString(),
      createdBy: docData.createdBy || 'admin@anest.com.br',
      createdByName: docData.createdByName || 'Administrador',
      aprovadoPor: null,
      dataAprovacao: null,
    }],
  };
  mockAuditoriaDocumentos.push(newDoc);
  return newDoc;
};

// Atualizar documento existente
export const updateAuditoriaDocumento = (id, updates) => {
  const index = mockAuditoriaDocumentos.findIndex(d => d.id === id);
  if (index !== -1) {
    mockAuditoriaDocumentos[index] = {
      ...mockAuditoriaDocumentos[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return mockAuditoriaDocumentos[index];
  }
  return null;
};

// Arquivar documento
export const archiveAuditoriaDocumento = (id) => {
  return updateAuditoriaDocumento(id, { status: 'arquivado' });
};

// Restaurar documento arquivado
export const restoreAuditoriaDocumento = (id) => {
  return updateAuditoriaDocumento(id, { status: 'ativo' });
};

// Adicionar nova versao ao documento
export const addAuditoriaVersion = (docId, versionData) => {
  const doc = mockAuditoriaDocumentos.find(d => d.id === docId);
  if (doc) {
    const newVersionNumber = doc.versaoAtual + 1;
    const newVersion = {
      versao: newVersionNumber,
      arquivoURL: versionData.arquivoURL || doc.arquivoURL,
      arquivoNome: `${doc.codigo.replace(/-\d+$/, '')}-${String(newVersionNumber).padStart(2, '0')}.pdf`,
      descricaoAlteracao: versionData.descricaoAlteracao || 'Atualizacao do documento',
      motivoAlteracao: versionData.motivoAlteracao || 'Revisao',
      status: 'ativo',
      createdAt: new Date().toISOString(),
      createdBy: versionData.createdBy || 'admin@anest.com.br',
      createdByName: versionData.createdByName || 'Administrador',
      aprovadoPor: null,
      dataAprovacao: null,
    };

    // Marcar versao anterior como arquivada
    if (doc.versoes && doc.versoes.length > 0) {
      doc.versoes[0].status = 'arquivado';
    }

    // Adicionar nova versao no inicio do array
    doc.versoes = [newVersion, ...(doc.versoes || [])];
    doc.versaoAtual = newVersionNumber;
    doc.updatedAt = new Date().toISOString();
    doc.arquivoURL = versionData.arquivoURL || doc.arquivoURL;

    return doc;
  }
  return null;
};

// Deletar documento
export const deleteAuditoriaDocumento = (id) => {
  const index = mockAuditoriaDocumentos.findIndex(d => d.id === id);
  if (index !== -1) {
    mockAuditoriaDocumentos.splice(index, 1);
    return true;
  }
  return false;
};

// Obter documentos com revisao vencida
export const getAuditoriasPendentesRevisao = () => {
  const hoje = new Date();
  return mockAuditoriaDocumentos.filter(d => {
    if (d.status !== 'ativo' || !d.proximaRevisao) return false;
    return new Date(d.proximaRevisao) <= hoje;
  });
};

// Obter documentos com revisao proxima (nos proximos 30 dias)
export const getAuditoriasRevisaoProxima = (dias = 30) => {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  return mockAuditoriaDocumentos.filter(d => {
    if (d.status !== 'ativo' || !d.proximaRevisao) return false;
    const revisao = new Date(d.proximaRevisao);
    return revisao > hoje && revisao <= limite;
  });
};
