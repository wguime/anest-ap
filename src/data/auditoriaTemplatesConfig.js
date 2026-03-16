/**
 * Auditoria Templates Config - Configuracao de templates e checklist para auditorias interativas
 */
import {
  FileEdit,
  PlayCircle,
  CheckCircle2,
  Check,
  X,
  Minus,
} from 'lucide-react'

// Status de execucao de auditoria (cores DS: success, warning, secondary)
export const EXECUCAO_STATUS = {
  rascunho: {
    id: 'rascunho',
    label: 'Rascunho',
    color: '#6B7280',
    bgColor: '#E8F5E9',
    darkBgColor: '#243530',
    icon: FileEdit,
  },
  em_andamento: {
    id: 'em_andamento',
    label: 'Em Andamento',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    darkBgColor: '#3D2F0A',
    icon: PlayCircle,
  },
  concluida: {
    id: 'concluida',
    label: 'Concluida',
    color: '#34C759',
    bgColor: '#E8F5E9',
    darkBgColor: '#243530',
    icon: CheckCircle2,
  },
}

// Tipos de resposta para itens de auditoria (DS: success, destructive, muted)
export const RESPOSTA_TIPO = {
  C: {
    label: 'Conforme',
    color: '#34C759',
    icon: Check,
  },
  NC: {
    label: 'Nao Conforme',
    color: '#DC2626',
    icon: X,
  },
  NA: {
    label: 'Nao Aplicavel',
    color: '#6B7280',
    icon: Minus,
  },
}

// Templates de auditoria para cada tipo
export const AUDIT_TEMPLATES = {
  higiene_maos: {
    tipo: 'higiene_maos',
    titulo: 'Auditoria de Higiene das Maos',
    descricao: 'Verificacao de conformidade com protocolo de higienizacao das maos nos 5 momentos preconizados pela OMS.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Higienizacao antes do contato com o paciente', description: 'Verificar se o profissional higieniza as maos antes de tocar o paciente.', category: 'Momento 1', required: true },
      { id: 'item-02', label: 'Higienizacao antes de procedimento assetico', description: 'Verificar higienizacao antes de procedimentos invasivos ou manipulacao de dispositivos.', category: 'Momento 2', required: true },
      { id: 'item-03', label: 'Higienizacao apos risco de exposicao a fluidos', description: 'Verificar higienizacao apos contato com fluidos corporais.', category: 'Momento 3', required: true },
      { id: 'item-04', label: 'Higienizacao apos contato com o paciente', description: 'Verificar se o profissional higieniza as maos ao sair do leito ou apos contato.', category: 'Momento 4', required: true },
      { id: 'item-05', label: 'Higienizacao apos contato com superficies proximas', description: 'Verificar higienizacao apos tocar equipamentos e superficies do entorno do paciente.', category: 'Momento 5', required: true },
      { id: 'item-06', label: 'Disponibilidade de alcool gel no ponto de assistencia', description: 'Verificar se dispensadores de alcool gel estao acessiveis e abastecidos.', category: 'Infraestrutura', required: true },
      { id: 'item-07', label: 'Tecnica correta de higienizacao', description: 'Observar se a tecnica de friccao abrange todas as superficies das maos por pelo menos 20 segundos.', category: 'Tecnica', required: true },
      { id: 'item-08', label: 'Taxa de adesao monitorada e divulgada', description: 'Verificar se taxas de adesao a higiene das maos sao medidas periodicamente e resultados divulgados a equipe (ROP Qmentum 5.1).', category: 'Monitoramento', required: true },
      { id: 'item-09', label: 'Sinalizacao visual nos pontos de assistencia', description: 'Verificar presenca de cartazes e lembretes visuais sobre os 5 momentos da higiene das maos nos pontos de assistencia.', category: 'Infraestrutura', required: true },
    ],
  },
  uso_medicamentos: {
    tipo: 'uso_medicamentos',
    titulo: 'Auditoria de Uso de Medicamentos',
    descricao: 'Avaliacao da conformidade com protocolos de prescricao, dispensacao e administracao de medicamentos.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Prescricao medica legivel e completa', description: 'Verificar se a prescricao contem nome do paciente, medicamento, dose, via, frequencia e duracao.', category: 'Prescricao', required: true },
      { id: 'item-02', label: 'Dupla checagem de medicamentos de alta vigilancia', description: 'Verificar se medicamentos potencialmente perigosos passam por dupla conferencia.', category: 'Seguranca', required: true },
      { id: 'item-03', label: 'Identificacao correta do paciente antes da administracao', description: 'Confirmar uso de pelo menos dois identificadores antes de administrar o medicamento.', category: 'Administracao', required: true },
      { id: 'item-04', label: 'Armazenamento adequado de medicamentos', description: 'Verificar condicoes de temperatura, validade e segregacao de medicamentos controlados.', category: 'Armazenamento', required: true },
      { id: 'item-05', label: 'Registro de administracao no prontuario', description: 'Verificar se a administracao foi registrada com horario, dose e responsavel.', category: 'Registro', required: true },
      { id: 'item-06', label: 'Reconciliacao medicamentosa na admissao', description: 'Verificar se foi realizada a reconciliacao medicamentosa com lista atualizada de medicamentos do paciente.', category: 'Reconciliacao', required: true },
      { id: 'item-07', label: 'Eletrolitos concentrados nao estocados em areas assistenciais', description: 'Verificar se eletrolitos concentrados (KCl, NaCl >0,9%, gluconato de calcio) nao estao disponiveis em areas de cuidado ao paciente (ROP Qmentum 3.2).', category: 'Seguranca', required: true },
      { id: 'item-08', label: 'Medicamentos LASA identificados e sinalizados', description: 'Verificar se medicamentos com nomes ou aparencia semelhantes (Look-Alike Sound-Alike) estao identificados e armazenados separadamente (ROP Qmentum 3.3).', category: 'Armazenamento', required: true },
      { id: 'item-09', label: 'Biblioteca de medicamentos em bombas de infusao', description: 'Verificar se bombas de infusao utilizam biblioteca de medicamentos (smart pump) com limites de dose configurados (ROP Qmentum 3.5).', category: 'Seguranca', required: true },
    ],
  },
  abreviaturas: {
    tipo: 'abreviaturas',
    titulo: 'Auditoria de Abreviaturas Perigosas',
    descricao: 'Verificacao do uso de abreviaturas proibidas ou perigosas em prescricoes e documentos clinicos.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Ausencia de abreviaturas proibidas em prescricoes', description: 'Verificar se nao ha abreviaturas da lista de "nao usar" (ex: U, UI, QD, QOD).', category: 'Prescricao', required: true },
      { id: 'item-02', label: 'Ausencia de abreviaturas perigosas em evolucoes', description: 'Verificar evolucoes medicas e de enfermagem quanto a abreviaturas ambiguas.', category: 'Evolucao', required: true },
      { id: 'item-03', label: 'Lista de abreviaturas padronizadas disponivel', description: 'Verificar se a lista institucional de abreviaturas aprovadas esta acessivel ao profissional.', category: 'Documentacao', required: true },
      { id: 'item-04', label: 'Dose escrita por extenso quando necessario', description: 'Verificar se doses menores que 1 utilizam zero antes do ponto decimal (0,5 mg em vez de .5 mg).', category: 'Prescricao', required: true },
      { id: 'item-05', label: 'Unidades de medida escritas por extenso', description: 'Verificar se "unidades" esta escrito por extenso em vez de "U" para insulina e heparina.', category: 'Prescricao', required: true },
      { id: 'item-06', label: 'Rotulos de farmacia e formularios pre-impressos conformes', description: 'Verificar se rotulos gerados pela farmacia e formularios pre-impressos nao contem abreviaturas da lista de "nao usar" (ROP Qmentum 2.2).', category: 'Farmacia', required: true },
    ],
  },
  politica_qualidade: {
    tipo: 'politica_qualidade',
    titulo: 'Auditoria de Politica de Gestao da Qualidade',
    descricao: 'Avaliacao da implementacao e aderencia a politica institucional de gestao da qualidade.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Politica de qualidade divulgada e acessivel', description: 'Verificar se a politica esta disponivel para consulta por todos os colaboradores.', category: 'Divulgacao', required: true },
      { id: 'item-02', label: 'Indicadores de qualidade monitorados', description: 'Verificar se indicadores estao sendo coletados e analisados conforme periodicidade definida.', category: 'Indicadores', required: true },
      { id: 'item-03', label: 'Planos de acao para nao conformidades', description: 'Verificar se nao conformidades geram planos de acao com prazos e responsaveis.', category: 'Melhoria', required: true },
      { id: 'item-04', label: 'Reunioes de analise critica realizadas', description: 'Verificar se reunioes periodicas de analise critica sao realizadas e documentadas.', category: 'Governanca', required: true },
      { id: 'item-05', label: 'Treinamentos de qualidade realizados', description: 'Verificar se treinamentos sobre politica e ferramentas de qualidade estao em dia.', category: 'Capacitacao', required: true },
      { id: 'item-06', label: 'Pesquisa de satisfacao do paciente aplicada', description: 'Verificar se pesquisas de satisfacao sao aplicadas e resultados analisados.', category: 'Satisfacao', required: true },
    ],
  },
  politica_disclosure: {
    tipo: 'politica_disclosure',
    titulo: 'Auditoria de Politica de Disclosure',
    descricao: 'Verificacao da conformidade com a politica de revelacao de eventos adversos ao paciente e familia.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Politica de disclosure formalizada e aprovada', description: 'Verificar se existe documento formal da politica de revelacao de eventos adversos.', category: 'Documentacao', required: true },
      { id: 'item-02', label: 'Equipe treinada em comunicacao de eventos', description: 'Verificar se profissionais receberam treinamento sobre como comunicar eventos adversos.', category: 'Capacitacao', required: true },
      { id: 'item-03', label: 'Registro de disclosure realizado', description: 'Verificar se as comunicacoes realizadas ao paciente/familia estao documentadas.', category: 'Registro', required: true },
      { id: 'item-04', label: 'Suporte ao paciente/familia apos evento', description: 'Verificar se foi oferecido suporte psicologico e acompanhamento apos a revelacao.', category: 'Acolhimento', required: true },
      { id: 'item-05', label: 'Fluxo de comunicacao interna definido', description: 'Verificar se existe fluxo claro de notificacao interna antes da comunicacao ao paciente.', category: 'Fluxo', required: true },
      { id: 'item-06', label: 'Relatorios trimestrais de seguranca apresentados', description: 'Verificar se relatorios trimestrais de seguranca do paciente sao apresentados ao corpo diretivo com acoes recomendadas (ROP Qmentum 1.3).', category: 'Governanca', required: true },
    ],
  },
  relatorio_rops: {
    tipo: 'relatorio_rops',
    titulo: 'Auditoria de ROPs (Required Organizational Practices)',
    descricao: 'Avaliacao da conformidade com as Praticas Organizacionais Requeridas do Qmentum.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Identificacao do paciente com pelo menos dois identificadores', description: 'Verificar uso de pulseira com nome completo e data de nascimento ou registro.', category: 'Seguranca', required: true },
      { id: 'item-02', label: 'Comunicacao efetiva em transferencias de cuidado', description: 'Verificar uso de ferramenta padronizada (SBAR) em passagens de plantao e transferencias.', category: 'Comunicacao', required: true },
      { id: 'item-03', label: 'Checklist de cirurgia segura aplicado', description: 'Verificar aplicacao das 3 fases: sign-in, time-out e sign-out em procedimentos cirurgicos.', category: 'Cirurgia Segura', required: true },
      { id: 'item-04', label: 'Protocolo de prevencao de quedas implementado', description: 'Verificar avaliacao de risco de queda e medidas preventivas conforme escore.', category: 'Prevencao', required: true },
      { id: 'item-05', label: 'Protocolo de prevencao de lesao por pressao', description: 'Verificar avaliacao de risco (Braden) e implementacao de medidas preventivas.', category: 'Prevencao', required: true },
      { id: 'item-06', label: 'Notificacao de eventos adversos realizada', description: 'Verificar se sistema de notificacao de incidentes esta ativo e acessivel.', category: 'Notificacao', required: true },
      { id: 'item-07', label: 'Cultura de seguranca promovida', description: 'Verificar se existem acoes de promocao da cultura de seguranca e relato nao punitivo.', category: 'Cultura', required: true },
      { id: 'item-08', label: 'Reconciliacao medicamentosa nas transicoes do cuidado', description: 'Verificar se a reconciliacao medicamentosa e realizada em todas as transicoes de cuidado (admissao, transferencia, alta) conforme ROP Qmentum.', category: 'Seguranca', required: true },
      { id: 'item-09', label: 'Profilaxia de tromboembolismo venoso avaliada', description: 'Verificar se pacientes cirurgicos e clinicos sao avaliados para risco de TEV e recebem profilaxia adequada conforme protocolo (ROP Qmentum).', category: 'Prevencao', required: true },
    ],
  },
  operacional: {
    tipo: 'operacional',
    titulo: 'Auditoria Operacional',
    descricao: 'Verificacao de conformidade com processos operacionais do centro cirurgico e areas de apoio.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Mapa cirurgico atualizado e acessivel', description: 'Verificar se o mapa cirurgico do dia esta disponivel e atualizado com horarios e equipes.', category: 'Planejamento', required: true },
      { id: 'item-02', label: 'Equipamentos conferidos antes do procedimento', description: 'Verificar se checklist de equipamentos foi preenchido antes do inicio da cirurgia.', category: 'Equipamentos', required: true },
      { id: 'item-03', label: 'Materiais e insumos disponiveis', description: 'Verificar se todos os materiais necessarios estao disponiveis e dentro da validade.', category: 'Materiais', required: true },
      { id: 'item-04', label: 'Limpeza terminal entre procedimentos', description: 'Verificar se a limpeza terminal da sala cirurgica foi realizada conforme protocolo.', category: 'Limpeza', required: true },
      { id: 'item-05', label: 'Registro de tempos cirurgicos', description: 'Verificar se horarios de inicio, termino e intercorrencias foram registrados.', category: 'Registro', required: true },
      { id: 'item-06', label: 'Disponibilidade da equipe conforme escala', description: 'Verificar se todos os membros da equipe estao presentes conforme escala.', category: 'Equipe', required: true },
    ],
  },
  conformidade: {
    tipo: 'conformidade',
    titulo: 'Auditoria de Conformidade e Politicas',
    descricao: 'Avaliacao de aderencia a politicas institucionais, regulamentos e normas vigentes.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Documentos regulatorios atualizados', description: 'Verificar se alvaras, licencas e certificacoes estao vigentes e acessiveis.', category: 'Regulatorio', required: true },
      { id: 'item-02', label: 'Politicas e procedimentos revisados no prazo', description: 'Verificar se documentos internos estao dentro do prazo de revisao.', category: 'Documentacao', required: true },
      { id: 'item-03', label: 'Consentimentos informados adequados', description: 'Verificar se termos de consentimento estao preenchidos, assinados e arquivados.', category: 'Consentimento', required: true },
      { id: 'item-04', label: 'Prontuarios completos e legíveis', description: 'Verificar se prontuarios contem todas as informacoes obrigatorias e estao legiveis.', category: 'Prontuario', required: true },
      { id: 'item-05', label: 'Protocolos clinicos seguidos conforme padrao', description: 'Verificar aderencia aos protocolos clinicos institucionais vigentes.', category: 'Protocolos', required: true },
    ],
  },
  procedimento: {
    tipo: 'procedimento',
    titulo: 'Auditoria de Procedimentos Clinicos',
    descricao: 'Verificacao de conformidade com protocolos e boas praticas em procedimentos clinicos.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Avaliacao pre-anestesica realizada', description: 'Verificar se o paciente passou por avaliacao pre-anestesica completa e documentada.', category: 'Pre-operatorio', required: true },
      { id: 'item-02', label: 'Jejum pre-operatorio confirmado', description: 'Verificar se o tempo de jejum foi respeitado conforme protocolo institucional.', category: 'Pre-operatorio', required: true },
      { id: 'item-03', label: 'Monitorizacao adequada durante procedimento', description: 'Verificar se monitorizacao basica (ECG, oximetria, pressao arterial, capnografia) esta em uso.', category: 'Intraoperatorio', required: true },
      { id: 'item-04', label: 'Registro anestesico completo', description: 'Verificar se ficha anestesica contem todos os dados obrigatorios do procedimento.', category: 'Registro', required: true },
      { id: 'item-05', label: 'Criterios de alta da RPA atendidos', description: 'Verificar se score de alta (Aldrete modificado) foi aplicado e critérios atendidos.', category: 'Pos-operatorio', required: true },
      { id: 'item-06', label: 'Orientacoes pos-operatorias fornecidas', description: 'Verificar se paciente e acompanhante receberam orientacoes por escrito.', category: 'Pos-operatorio', required: true },
      { id: 'item-07', label: 'Kit de hipertermia maligna disponivel e conferido', description: 'Verificar se o kit de hipertermia maligna (dantrolene e insumos) esta disponivel, dentro da validade e acessivel no centro cirurgico (ROP Qmentum).', category: 'Intraoperatorio', required: true },
      { id: 'item-08', label: 'Plano para via aerea dificil documentado', description: 'Verificar se existe plano documentado para manejo de via aerea dificil com equipamentos disponiveis e equipe treinada (ROP Qmentum).', category: 'Pre-operatorio', required: true },
    ],
  },
  seguranca_paciente: {
    tipo: 'seguranca_paciente',
    titulo: 'Auditoria de Seguranca do Paciente',
    descricao: 'Avaliacao abrangente das metas internacionais de seguranca do paciente.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Identificacao correta do paciente', description: 'Verificar pulseira de identificacao com nome completo e segundo identificador.', category: 'Meta 1', required: true },
      { id: 'item-02', label: 'Comunicacao efetiva entre profissionais', description: 'Verificar uso de tecnicas padronizadas de comunicacao (read-back, SBAR).', category: 'Meta 2', required: true },
      { id: 'item-03', label: 'Seguranca no uso de medicamentos de alta vigilancia', description: 'Verificar sinalizacao, armazenamento segregado e dupla checagem de medicamentos de alta vigilancia.', category: 'Meta 3', required: true },
      { id: 'item-04', label: 'Cirurgia segura - sitio, procedimento e paciente corretos', description: 'Verificar aplicacao do protocolo de cirurgia segura com demarcacao de sitio quando aplicavel.', category: 'Meta 4', required: true },
      { id: 'item-05', label: 'Reducao do risco de infeccao', description: 'Verificar aderencia a praticas de prevencao de infeccao (higiene das maos, precaucoes padrao).', category: 'Meta 5', required: true },
      { id: 'item-06', label: 'Reducao do risco de quedas', description: 'Verificar avaliacao de risco, sinalizacao e medidas preventivas implementadas.', category: 'Meta 6', required: true },
      { id: 'item-07', label: 'Prevencao de lesao por pressao', description: 'Verificar avaliacao de risco e mudanca de decubito conforme protocolo.', category: 'Prevencao', required: true },
      { id: 'item-08', label: 'Cultura de seguranca e notificacao de eventos', description: 'Verificar se ambiente favorece relato de incidentes sem punicao.', category: 'Cultura', required: true },
      { id: 'item-09', label: 'Profilaxia de tromboembolismo venoso (TEV)', description: 'Verificar se avaliacao de risco de TEV e realizada e profilaxia farmacologica/mecanica implementada conforme protocolo institucional (ROP Qmentum).', category: 'Prevencao', required: true },
    ],
  },
  controle_infeccao: {
    tipo: 'controle_infeccao',
    titulo: 'Auditoria de Controle de Infeccao',
    descricao: 'Verificacao de conformidade com protocolos de prevencao e controle de infeccoes relacionadas a assistencia.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Precaucoes padrao seguidas', description: 'Verificar uso adequado de EPIs conforme tipo de procedimento e exposicao.', category: 'Precaucoes', required: true },
      { id: 'item-02', label: 'Precaucoes de isolamento implementadas', description: 'Verificar sinalizacao, EPIs especificos e fluxo para pacientes em isolamento.', category: 'Isolamento', required: true },
      { id: 'item-03', label: 'Antibioticoprofilaxia cirurgica adequada', description: 'Verificar se antibiotico profilatico foi administrado no momento correto (ate 60 min antes da incisao).', category: 'Profilaxia', required: true },
      { id: 'item-04', label: 'Bundle de prevencao de infeccao de cateter venoso', description: 'Verificar aderencia ao bundle: higiene das maos, barreira maxima, clorexidina, sitio otimo, revisao diaria.', category: 'Bundle', required: true },
      { id: 'item-05', label: 'Processamento de materiais conforme protocolo', description: 'Verificar se limpeza, desinfeccao e esterilizacao seguem normas vigentes.', category: 'CME', required: true },
      { id: 'item-06', label: 'Vigilancia epidemiologica de IRAS', description: 'Verificar se dados de infeccao sao coletados, analisados e divulgados periodicamente.', category: 'Vigilancia', required: true },
      { id: 'item-07', label: 'Protocolos de limpeza ambiental seguidos', description: 'Verificar se protocolos de limpeza e desinfeccao de superficies e ambientes hospitalares sao seguidos conforme cronograma (ROP Qmentum).', category: 'Limpeza', required: true },
    ],
  },
  equipamentos: {
    tipo: 'equipamentos',
    titulo: 'Auditoria de Equipamentos Medicos',
    descricao: 'Verificacao do estado, manutencao e disponibilidade de equipamentos medico-hospitalares.',
    versao: 1,
    items: [
      { id: 'item-01', label: 'Manutencao preventiva em dia', description: 'Verificar se equipamentos possuem etiqueta de manutencao preventiva dentro do prazo.', category: 'Manutencao', required: true },
      { id: 'item-02', label: 'Calibracao de equipamentos de medicao', description: 'Verificar certificados de calibracao vigentes para monitores, bombas de infusao e ventiladores.', category: 'Calibracao', required: true },
      { id: 'item-03', label: 'Checklist de aparelho de anestesia realizado', description: 'Verificar se checklist diario do aparelho de anestesia foi preenchido antes do primeiro caso.', category: 'Anestesia', required: true },
      { id: 'item-04', label: 'Desfibrilador testado e funcional', description: 'Verificar se teste diario do desfibrilador foi realizado e registrado.', category: 'Emergencia', required: true },
      { id: 'item-05', label: 'Carrinho de emergencia conferido e lacrado', description: 'Verificar se carrinho de emergencia esta lacrado, conferido e dentro da validade.', category: 'Emergencia', required: true },
      { id: 'item-06', label: 'Equipamentos limpos e em bom estado', description: 'Verificar condicoes de limpeza e integridade fisica dos equipamentos em uso.', category: 'Conservacao', required: true },
    ],
  },
}

// Deadline urgency configuration (Tailwind classes used by DeadlineBadge)
export const DEADLINE_URGENCY = {
  overdue:     { key: 'overdue',     label: 'Vencido',   color: '#DC2626', darkColor: '#EF4444', icon: 'AlertTriangle', bgColor: '#FEE2E2', darkBgColor: '#7F1D1D' },
  critical:    { key: 'critical',    label: 'Critico',   color: '#EA580C', darkColor: '#F97316', icon: 'AlertCircle',   bgColor: '#FFF7ED', darkBgColor: '#7C2D12' },
  approaching: { key: 'approaching', label: 'Proximo',   color: '#CA8A04', darkColor: '#EAB308', icon: 'Clock',         bgColor: '#FEFCE8', darkBgColor: '#713F12' },
  onTrack:     { key: 'onTrack',    label: 'No prazo',  color: '#16A34A', darkColor: '#22C55E', icon: 'CheckCircle',   bgColor: '#F0FDF4', darkBgColor: '#14532D' },
  none:        { key: 'none',       label: 'Sem prazo', color: '#6B7280', darkColor: '#9CA3AF', icon: null,             bgColor: '#F9FAFB', darkBgColor: '#374151' },
}

export function getDeadlineUrgency(prazo) {
  if (!prazo) return DEADLINE_URGENCY.none
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const deadline = new Date(prazo + 'T00:00:00')
  const diffDias = Math.ceil((deadline - hoje) / (1000 * 60 * 60 * 24))
  if (diffDias < 0) return { ...DEADLINE_URGENCY.overdue, dias: diffDias }
  if (diffDias <= 3) return { ...DEADLINE_URGENCY.critical, dias: diffDias }
  if (diffDias <= 7) return { ...DEADLINE_URGENCY.approaching, dias: diffDias }
  return { ...DEADLINE_URGENCY.onTrack, dias: diffDias }
}

// Calcula score de conformidade a partir das respostas
export function calcularScore(respostas) {
  if (!respostas || typeof respostas !== 'object') return 0

  const values = Object.values(respostas)
  const conformes = values.filter((r) => r === 'C').length
  const naoConformes = values.filter((r) => r === 'NC').length
  const total = conformes + naoConformes

  if (total === 0) return 0
  return Math.round((conformes / total) * 100)
}

// Retorna template por tipo com fallback
export function getTemplate(tipo) {
  return AUDIT_TEMPLATES[tipo] || null
}

// Retorna configuracao de status
export function getStatusConfig(status) {
  return EXECUCAO_STATUS[status] || EXECUCAO_STATUS.rascunho
}
