/**
 * Mock Data de Denúncias - Sistema ANEST
 *
 * Canal de Denúncia Anônima.
 * Dados simulados para desenvolvimento.
 */

import { generateDenunciaProtocol, generateTrackingCode } from './incidentesConfig';

// Data base para cálculos relativos
const now = new Date();
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();

export const mockDenuncias = [
  {
    id: 'den-001',
    protocolo: 'DEN-20260108-0001',
    trackingCode: 'ANEST-2026-M7K9P2',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    status: 'investigating',
    source: 'interno',

    // Identificação (anônimo)
    denunciante: {
      isAnonimo: true,
      nome: null,
      email: null,
      telefone: null,
      funcao: null,
      setor: null,
    },

    // Dados da Denúncia
    denuncia: {
      tipo: 'assedio_moral',
      titulo: 'Comportamento inadequado de chefia',
      descricao: 'Tenho presenciado comportamentos inadequados por parte de um supervisor da equipe de enfermagem. Há intimidações constantes, gritos em público e humilhações durante passagens de plantão. Vários colegas já relataram situações semelhantes mas têm medo de se manifestar formalmente.',
      pessoasEnvolvidas: 'Supervisor do setor de enfermagem do CC',
      testemunhas: 'Diversos membros da equipe de enfermagem do turno noturno',
      dataOcorrencia: '2026-01-07',
      horaOcorrencia: '07:00',
      localOcorrencia: 'Centro Cirúrgico - Posto de Enfermagem',
      impacto: 'Clima organizacional ruim, funcionários com medo e desmotivados. Alguns já pediram transferência de setor.',
      evidencias: 'Outros funcionários podem confirmar os fatos.',
    },

    // Campos Admin
    admin: {
      assignedTo: ['user_admin'],
      investigador: 'user_admin',
      dataInicioInvestigacao: daysAgo(2),
      dataConclusao: null,
      conclusao: '',
      planoAcao: '',
      documentosAnexos: [],
      historicoStatus: [
        { status: 'pending', date: daysAgo(3), user: null },
        { status: 'in_review', date: daysAgo(2.5), user: 'user_admin' },
        { status: 'investigating', date: daysAgo(2), user: 'user_admin' },
      ],
      respostas: [
        {
          id: 'resp-001',
          responderId: 'user_admin',
          responderName: 'Comitê de Ética',
          content: 'Sua denúncia foi recebida e estamos iniciando a investigação. A confidencialidade será mantida em todas as etapas. Você pode acompanhar o andamento usando o código de rastreio fornecido.',
          createdAt: daysAgo(2),
          isInternal: false,
        },
      ],
      notasInternas: [
        {
          id: 'nota-001',
          authorId: 'user_admin',
          authorName: 'Administrador',
          content: 'Agendar entrevistas individuais com membros da equipe de enfermagem do turno noturno. Manter total sigilo sobre a origem da denúncia.',
          createdAt: daysAgo(2),
        },
      ],
      gravidade: 'alta',
      rca: {
        causaImediata: 'Comportamento abusivo recorrente de supervisor durante passagens de plantão, com intimidação e humilhações públicas.',
        cincosPorques: [
          { nivel: 1, pergunta: 'Por que o incidente ocorreu?', resposta: 'Supervisor adota postura autoritária e agressiva com a equipe' },
          { nivel: 2, pergunta: 'Por que o supervisor adota essa postura?', resposta: 'Falta de treinamento em liderança e gestão de equipe' },
          { nivel: 3, pergunta: 'Por que falta treinamento em liderança?', resposta: 'Promoção a cargo de supervisão sem programa de desenvolvimento de lideranças' },
        ],
        fatoresContribuintes: [
          { categoria: 'organizacional', descricao: 'Ausência de programa de desenvolvimento de lideranças para supervisores promovidos', adicionadoEm: daysAgo(1.5) },
          { categoria: 'comunicacao', descricao: 'Canal de denúncia interna pouco divulgado, gerando demora na detecção', adicionadoEm: daysAgo(1.5) },
        ],
        causaRaiz: 'Promoção a cargo de supervisão sem programa estruturado de desenvolvimento de competências de liderança, agravado por falta de canal efetivo de feedback da equipe.',
        classificacaoRisco: { probabilidade: 'provavel', gravidade: 'maior', score: 16, nivel: 'extremo' },
        observacoes: '',
        status: 'em_andamento',
        iniciadoEm: daysAgo(1.5),
        concluidoEm: null,
      },
      ropsVinculados: [
        { ropId: 'rop-4-3', ropArea: 'vida-profissional', areaTitle: 'Vida Profissional e Força de Trabalho', ropTitle: 'ROP 4.3 – Prevenção e Resposta à Violência no Local de Trabalho', areaColor: '#4CAF50', autoSugerido: true, adicionadoEm: daysAgo(1.5) },
        { ropId: 'rop-4-5', ropArea: 'vida-profissional', areaTitle: 'Vida Profissional e Força de Trabalho', ropTitle: 'ROP 4.5 – Bem‑estar da Equipe e Apoio ao Segundo Vítima', areaColor: '#4CAF50', autoSugerido: true, adicionadoEm: daysAgo(1.5) },
      ],
    },

    attachments: [],
  },

  {
    id: 'den-002',
    protocolo: 'DEN-20260105-0002',
    trackingCode: 'ANEST-2026-T4R6Y8',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(3),
    status: 'resolved',
    source: 'externo',

    denunciante: {
      isAnonimo: true,
      nome: null,
      email: null,
      telefone: null,
      funcao: null,
      setor: null,
    },

    denuncia: {
      tipo: 'seguranca_paciente',
      titulo: 'Não cumprimento de protocolo de higienização',
      descricao: 'Observei que um profissional da equipe de limpeza não está seguindo corretamente os protocolos de higienização das salas cirúrgicas entre procedimentos. Os produtos de limpeza são aplicados rapidamente e a sala é liberada antes do tempo adequado de ação.',
      pessoasEnvolvidas: 'Funcionário da equipe de higienização (turno vespertino)',
      testemunhas: 'Equipe de enfermagem do centro cirúrgico',
      dataOcorrencia: '2026-01-04',
      horaOcorrencia: '15:00',
      localOcorrencia: 'Centro Cirúrgico - Salas 2 e 3',
      impacto: 'Risco potencial de infecção para pacientes.',
      evidencias: 'Tempo de permanência dos produtos pode ser verificado por câmeras.',
    },

    admin: {
      assignedTo: ['user_coord'],
      investigador: 'user_coord',
      dataInicioInvestigacao: daysAgo(5),
      dataConclusao: daysAgo(3),
      conclusao: 'Denúncia procedente. Identificado treinamento insuficiente do profissional. Realizado retreinamento e intensificada supervisão.',
      planoAcao: 'Implementar checklist de limpeza com verificação de tempo. Retreinamento de toda a equipe de higienização.',
      documentosAnexos: [],
      historicoStatus: [
        { status: 'pending', date: daysAgo(6), user: null },
        { status: 'in_review', date: daysAgo(5.5), user: 'user_coord' },
        { status: 'investigating', date: daysAgo(5), user: 'user_coord' },
        { status: 'resolved', date: daysAgo(3), user: 'user_coord' },
      ],
      respostas: [
        {
          id: 'resp-002',
          responderId: 'user_coord',
          responderName: 'Coordenação de Qualidade',
          content: 'Obrigado pela sua denúncia. Após investigação, confirmamos a situação relatada. O profissional foi retreinado e implementamos melhorias no processo de verificação da limpeza.',
          createdAt: daysAgo(3),
          isInternal: false,
        },
      ],
      notasInternas: [],
      gravidade: 'media',
      rca: {
        causaImediata: 'Profissional de higienização não seguiu protocolo de tempo de ação dos produtos de limpeza entre procedimentos cirúrgicos.',
        cincosPorques: [
          { nivel: 1, pergunta: 'Por que o incidente ocorreu?', resposta: 'Produtos de limpeza aplicados rapidamente e sala liberada antes do tempo' },
          { nivel: 2, pergunta: 'Por que a sala foi liberada antes do tempo?', resposta: 'Profissional não tinha conhecimento adequado dos tempos de ação' },
          { nivel: 3, pergunta: 'Por que o profissional não tinha conhecimento adequado?', resposta: 'Treinamento inicial insuficiente e ausência de retreinamento periódico' },
          { nivel: 4, pergunta: 'Por que não há retreinamento periódico?', resposta: 'Não existe cronograma formal de reciclagem para equipe de higienização' },
          { nivel: 5, pergunta: 'Por que não existe cronograma de reciclagem?', resposta: 'Falta de integração entre CCIH e setor de treinamento para equipes de apoio' },
        ],
        fatoresContribuintes: [
          { categoria: 'processo_procedimento', descricao: 'Ausência de checklist de limpeza com verificação de tempo por sala', adicionadoEm: daysAgo(4) },
          { categoria: 'fatores_humanos', descricao: 'Treinamento insuficiente sobre tempos de ação dos produtos', adicionadoEm: daysAgo(4) },
          { categoria: 'organizacional', descricao: 'Falta de programa de reciclagem periódica para equipe de higienização', adicionadoEm: daysAgo(4) },
        ],
        causaRaiz: 'Falta de integração entre CCIH e setor de treinamento, resultando em ausência de programa de reciclagem periódica e checklist de verificação para equipe de higienização.',
        classificacaoRisco: { probabilidade: 'possivel', gravidade: 'maior', score: 12, nivel: 'alto' },
        observacoes: 'Retreinamento realizado. Checklist implementado. Supervisão intensificada por 30 dias.',
        status: 'concluida',
        iniciadoEm: daysAgo(5),
        concluidoEm: daysAgo(3),
      },
      ropsVinculados: [
        { ropId: 'rop-5-1', ropArea: 'prevencao-infeccoes', areaTitle: 'Prevenção de Infecções', ropTitle: 'ROP 5.1 – Higiene das Mãos: Adesão e Monitoramento', areaColor: '#FF9800', autoSugerido: true, adicionadoEm: daysAgo(5) },
        { ropId: 'rop-5-3', ropArea: 'prevencao-infeccoes', areaTitle: 'Prevenção de Infecções', ropTitle: 'ROP 5.3 – Limpeza e Desinfecção de Superfícies e Equipamentos', areaColor: '#FF9800', autoSugerido: true, adicionadoEm: daysAgo(5) },
        { ropId: 'rop-1-2', ropArea: 'cultura-seguranca', areaTitle: 'Cultura de Segurança', ropTitle: 'ROP 1.2 – Gestão de Incidentes sobre a Segurança dos Pacientes', areaColor: '#9C27B0', autoSugerido: false, adicionadoEm: daysAgo(4) },
      ],
    },

    attachments: [],
  },

  {
    id: 'den-003',
    protocolo: 'DEN-20260110-0001',
    trackingCode: 'ANEST-2026-W2E4Q6',
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(6),
    status: 'in_review',
    source: 'interno',

    denunciante: {
      isAnonimo: false,
      nome: 'Dr. Ricardo Almeida',
      email: 'ricardo.almeida@hospital.com',
      telefone: null,
      funcao: 'medico_anestesista',
      setor: 'centro_cirurgico',
    },

    denuncia: {
      tipo: 'violacao_politica',
      titulo: 'Desvio de materiais do estoque',
      descricao: 'Tenho notado uma discrepância significativa entre o estoque registrado e o estoque físico de alguns insumos de alto custo. Suspeito que possa haver desvio de materiais.',
      pessoasEnvolvidas: 'Não identificado especificamente',
      testemunhas: 'Equipe de materiais pode confirmar as discrepâncias',
      dataOcorrencia: '2026-01-09',
      horaOcorrencia: null,
      localOcorrencia: 'Almoxarifado do Centro Cirúrgico',
      impacto: 'Prejuízo financeiro para a instituição. Possível falta de materiais para procedimentos.',
      evidencias: 'Relatórios de estoque podem ser comparados com consumo real.',
    },

    admin: {
      assignedTo: ['user_admin'],
      investigador: null,
      dataInicioInvestigacao: null,
      dataConclusao: null,
      conclusao: '',
      planoAcao: '',
      documentosAnexos: [],
      historicoStatus: [
        { status: 'pending', date: daysAgo(1), user: null },
        { status: 'in_review', date: hoursAgo(6), user: 'user_admin' },
      ],
      respostas: [
        {
          id: 'resp-003',
          responderId: 'user_admin',
          responderName: 'Administração',
          content: 'Recebemos sua denúncia e iniciamos a análise. Por se tratar de denúncia nominal, você será contatado para mais informações se necessário.',
          createdAt: hoursAgo(6),
          isInternal: false,
        },
      ],
      notasInternas: [
        {
          id: 'nota-002',
          authorId: 'user_admin',
          authorName: 'Administrador',
          content: 'Solicitar auditoria de estoque ao departamento financeiro. Verificar acessos ao almoxarifado.',
          createdAt: hoursAgo(6),
        },
      ],
      gravidade: 'alta',
    },

    attachments: [],
  },

  {
    id: 'den-004',
    protocolo: 'DEN-20260101-0001',
    trackingCode: 'ANEST-2026-L8N0B3',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(7),
    status: 'closed',
    source: 'qrcode',

    denunciante: {
      isAnonimo: true,
      nome: null,
      email: null,
      telefone: null,
      funcao: null,
      setor: null,
    },

    denuncia: {
      tipo: 'discriminacao',
      titulo: 'Comentários discriminatórios',
      descricao: 'Um colega fez comentários discriminatórios sobre a origem de outro funcionário. A situação ocorreu durante o horário de almoço no refeitório.',
      pessoasEnvolvidas: 'Funcionário do setor administrativo',
      testemunhas: 'Outros funcionários presentes no refeitório',
      dataOcorrencia: '2025-12-30',
      horaOcorrencia: '12:30',
      localOcorrencia: 'Refeitório',
      impacto: 'Constrangimento e ambiente hostil para a vítima.',
      evidencias: 'Testemunhas podem confirmar.',
    },

    admin: {
      assignedTo: ['user_admin'],
      investigador: 'user_admin',
      dataInicioInvestigacao: daysAgo(9),
      dataConclusao: daysAgo(7),
      conclusao: 'Denúncia procedente. Funcionário foi advertido formalmente e encaminhado para treinamento de diversidade e inclusão.',
      planoAcao: 'Campanha de conscientização sobre diversidade para toda a instituição.',
      documentosAnexos: [],
      historicoStatus: [
        { status: 'pending', date: daysAgo(10), user: null },
        { status: 'in_review', date: daysAgo(9.5), user: 'user_admin' },
        { status: 'investigating', date: daysAgo(9), user: 'user_admin' },
        { status: 'resolved', date: daysAgo(7.5), user: 'user_admin' },
        { status: 'closed', date: daysAgo(7), user: 'user_admin' },
      ],
      respostas: [
        {
          id: 'resp-004',
          responderId: 'user_admin',
          responderName: 'Comitê de Ética',
          content: 'Agradecemos sua coragem em relatar esta situação. Após investigação, medidas disciplinares foram tomadas e estamos implementando ações educativas para toda a instituição.',
          createdAt: daysAgo(7),
          isInternal: false,
        },
      ],
      notasInternas: [],
      gravidade: 'media',
    },

    attachments: [],
  },

  {
    id: 'den-005',
    protocolo: 'DEN-20260111-0001',
    trackingCode: 'ANEST-2026-G5H7J9',
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(5),
    status: 'pending',
    source: 'interno',

    denunciante: {
      isAnonimo: true,
      nome: null,
      email: 'contato.anonimo@email.com', // Email para contato, mas anônimo
      telefone: null,
      funcao: null,
      setor: null,
    },

    denuncia: {
      tipo: 'conflito_interesse',
      titulo: 'Favoritismo em escalas de plantão',
      descricao: 'Existe um aparente favoritismo na elaboração das escalas de plantão. Alguns profissionais sempre conseguem os melhores horários enquanto outros ficam sempre com plantões em feriados e finais de semana.',
      pessoasEnvolvidas: 'Coordenação responsável pela escala',
      testemunhas: 'Equipe médica pode confirmar o padrão',
      dataOcorrencia: null,
      horaOcorrencia: null,
      localOcorrencia: 'Departamento de Anestesiologia',
      impacto: 'Desmotivação da equipe, sentimento de injustiça.',
      evidencias: 'Análise das escalas dos últimos 6 meses pode comprovar.',
    },

    admin: {
      assignedTo: [],
      investigador: null,
      dataInicioInvestigacao: null,
      dataConclusao: null,
      conclusao: '',
      planoAcao: '',
      documentosAnexos: [],
      historicoStatus: [
        { status: 'pending', date: hoursAgo(5), user: null },
      ],
      respostas: [],
      notasInternas: [],
      gravidade: 'media',
    },

    attachments: [],
  },

  {
    id: 'den-006',
    protocolo: 'DEN-20260103-0001',
    trackingCode: 'ANEST-2026-X1C3V5',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(4),
    status: 'closed',
    source: 'externo',

    denunciante: {
      isAnonimo: true,
      nome: null,
      email: null,
      telefone: null,
      funcao: null,
      setor: null,
    },

    denuncia: {
      tipo: 'negligencia',
      titulo: 'Falta de supervisão de residentes',
      descricao: 'Tenho observado que residentes do primeiro ano estão realizando procedimentos sem supervisão adequada de um anestesiologista. Situação recorrente no turno noturno.',
      pessoasEnvolvidas: 'Staff responsável pelo turno noturno',
      testemunhas: 'Equipe de enfermagem do CC',
      dataOcorrencia: '2026-01-02',
      horaOcorrencia: '23:00',
      localOcorrencia: 'Centro Cirúrgico',
      impacto: 'Risco à segurança dos pacientes e formação inadequada dos residentes.',
      evidencias: 'Registro de procedimentos pode mostrar horários e supervisores.',
    },

    admin: {
      assignedTo: ['user_coord'],
      investigador: 'user_coord',
      dataInicioInvestigacao: daysAgo(7),
      dataConclusao: daysAgo(4),
      conclusao: 'Parcialmente procedente. Identificada necessidade de reforço na supervisão noturna. Escala de staff ajustada.',
      planoAcao: 'Reestruturação da escala de supervisão para garantir cobertura adequada 24h.',
      documentosAnexos: [],
      historicoStatus: [
        { status: 'pending', date: daysAgo(8), user: null },
        { status: 'in_review', date: daysAgo(7.5), user: 'user_coord' },
        { status: 'investigating', date: daysAgo(7), user: 'user_coord' },
        { status: 'resolved', date: daysAgo(4.5), user: 'user_coord' },
        { status: 'closed', date: daysAgo(4), user: 'user_coord' },
      ],
      respostas: [
        {
          id: 'resp-006',
          responderId: 'user_coord',
          responderName: 'Coordenação Médica',
          content: 'Obrigado pelo relato. Verificamos a situação e realizamos ajustes na escala de supervisão. A presença de staff supervisor será garantida em todos os turnos.',
          createdAt: daysAgo(4),
          isInternal: false,
        },
      ],
      notasInternas: [],
      gravidade: 'alta',
    },

    attachments: [],
  },
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Retorna denúncia por ID
 */
export function getDenunciaById(id) {
  return mockDenuncias.find(den => den.id === id);
}

/**
 * Retorna denúncia por protocolo
 */
export function getDenunciaByProtocolo(protocolo) {
  return mockDenuncias.find(den => den.protocolo === protocolo);
}

/**
 * Retorna denúncia por código de rastreio
 */
export function getDenunciaByTrackingCode(trackingCode) {
  return mockDenuncias.find(den => den.trackingCode === trackingCode);
}

/**
 * Retorna denúncias filtradas por status
 */
export function getDenunciasByStatus(status) {
  return mockDenuncias.filter(den => den.status === status);
}

/**
 * Retorna denúncias filtradas por tipo
 */
export function getDenunciasByTipo(tipo) {
  return mockDenuncias.filter(den => den.denuncia.tipo === tipo);
}

/**
 * Retorna contagem de denúncias por status
 */
export function getDenunciasCountByStatus() {
  const counts = {};
  mockDenuncias.forEach(den => {
    counts[den.status] = (counts[den.status] || 0) + 1;
  });
  return counts;
}

/**
 * Retorna denúncias ordenadas por data (mais recentes primeiro)
 */
export function getDenunciasOrdenadas() {
  return [...mockDenuncias].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Retorna apenas denúncias anônimas
 */
export function getDenunciasAnonimas() {
  return mockDenuncias.filter(den => den.denunciante.isAnonimo);
}

/**
 * Retorna apenas denúncias nominais
 */
export function getDenunciasNominais() {
  return mockDenuncias.filter(den => !den.denunciante.isAnonimo);
}

export default mockDenuncias;
