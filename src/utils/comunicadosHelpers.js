// Calcula total real de destinatários com base nos users ativos
export const calcularTotalDestinatarios = (comunicado, users = []) => {
  const activeUsers = users.filter(u => u.active !== false);
  if (!comunicado.destinatarios?.length) return activeUsers.length; // Todos
  return activeUsers.filter(u => comunicado.destinatarios.includes(u.role)).length;
};

// Cores por tipo de comunicado (padrão do App legado)
export const tipoColors = {
  'Urgente': '#dc2626',
  'Importante': '#f59e0b',
  'Informativo': '#3b82f6',
  'Evento': '#9333ea',
  'Geral': '#6b7280',
};

export const getTipoColor = (tipo) => tipoColors[tipo] || tipoColors['Geral'];

// === Novas constantes Qmentum ===

export const ROLES_DESTINATARIOS = [
  { key: 'anestesiologista', label: 'Anestesiologista' },
  { key: 'medico-residente', label: 'Médico Residente' },
  { key: 'enfermeiro', label: 'Enfermeiro' },
  { key: 'tec-enfermagem', label: 'Téc. Enfermagem' },
  { key: 'farmaceutico', label: 'Farmacêutico' },
  { key: 'colaborador', label: 'Colaborador' },
  { key: 'secretaria', label: 'Secretária' },
  { key: 'coordenador', label: 'Coordenador' },
];

export const ROP_AREAS = [
  { key: 'geral', label: 'Geral', color: '#6b7280' },
  { key: 'cultura-seguranca', label: 'ROP 1 – Cultura de Segurança', color: '#9C27B0' },
  { key: 'comunicacao', label: 'ROP 2 – Comunicação', color: '#10b981' },
  { key: 'uso-medicamentos', label: 'ROP 3 – Uso de Medicamentos', color: '#2196F3' },
  { key: 'vida-profissional', label: 'ROP 4 – Vida Profissional', color: '#4CAF50' },
  { key: 'prevencao-infeccoes', label: 'ROP 5 – Prevenção de Infecções', color: '#FF9800' },
  { key: 'avaliacao-riscos', label: 'ROP 6 – Avaliação de Riscos', color: '#00BCD4' },
];

export const STATUS_COMUNICADO = [
  { key: 'rascunho', label: 'Rascunho', color: '#6b7280' },
  { key: 'aprovado', label: 'Aprovado', color: '#f59e0b' },
  { key: 'publicado', label: 'Publicado', color: '#10b981' },
];

// Helper para formatar data relativa
export const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

// Helper para formatar data completa
export const formatFullDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

// Helper para formatar data no card (DD/MM/AAAA)
export const formatCardDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Helper para formatar data/hora do evento
export const formatEventDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper para ícone de arquivo
export const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'pdf': 'FileText',
    'doc': 'FileText',
    'docx': 'FileText',
    'xls': 'Table',
    'xlsx': 'Table',
    'ppt': 'Presentation',
    'pptx': 'Presentation',
    'jpg': 'Image',
    'jpeg': 'Image',
    'png': 'Image',
    'gif': 'Image',
    'webp': 'Image',
  };
  return icons[ext] || 'File';
};

// Helper para verificar prazo vencido
export const isPrazoVencido = (comunicado) => {
  if (!comunicado.prazoConfirmacao) return false;
  return new Date(comunicado.prazoConfirmacao) < new Date();
};

// Helper para verificar se comunicado expirou
export const isExpirado = (comunicado) => {
  if (!comunicado.dataValidade) return false;
  return new Date(comunicado.dataValidade) < new Date();
};

// Tipos de comunicado disponíveis
export const tiposComunicado = [
  { value: 'Geral', label: 'Geral', color: '#6b7280' },
  { value: 'Informativo', label: 'Informativo', color: '#3b82f6' },
  { value: 'Importante', label: 'Importante', color: '#f59e0b' },
  { value: 'Urgente', label: 'Urgente', color: '#dc2626' },
  { value: 'Evento', label: 'Evento', color: '#9333ea' },
];
