// Dados mockados para Centro de Gestão (PermissionsPage)

// Usuários com dados de acesso para analytics
export const mockUsers = [
  {
    id: 'u1',
    nome: 'Dr. Carlos Silva',
    role: 'anestesiologista',
    email: 'carlos@anest.com',
    active: true,
    customPermissions: false,
    isAdmin: true, // Permissão de administrador separada do cargo
    isCoordenador: true, // Função adicional (pode coexistir com outros cargos)
    lastAccess: '2025-01-15T14:30:00',
    accessCount: 142,
    documentsAccessed: ['prot-001', 'prot-005', 'pol-002']
  },
  {
    id: 'u2',
    nome: 'Dra. Ana Costa',
    role: 'anestesiologista',
    email: 'ana@anest.com',
    active: true,
    customPermissions: false,
    lastAccess: '2025-01-14T09:15:00',
    accessCount: 87,
    documentsAccessed: ['prot-001', 'man-003']
  },
  {
    id: 'u3',
    nome: 'Dr. Pedro Alves',
    role: 'medico-residente',
    email: 'pedro@anest.com',
    active: true,
    customPermissions: false,
    lastAccess: '2025-01-15T11:00:00',
    accessCount: 56,
    documentsAccessed: ['prot-002']
  },
  {
    id: 'u4',
    nome: 'Enf. Maria Santos',
    role: 'enfermeiro',
    email: 'maria@anest.com',
    active: true,
    customPermissions: false,
    lastAccess: '2025-01-13T16:45:00',
    accessCount: 34,
    documentsAccessed: ['form-001', 'prot-003']
  },
  {
    id: 'u5',
    nome: 'Téc. João Lima',
    role: 'tec-enfermagem',
    email: 'joao@anest.com',
    active: true,
    customPermissions: false,
    lastAccess: '2025-01-12T08:30:00',
    accessCount: 21,
    documentsAccessed: []
  },
  {
    id: 'u6',
    nome: 'Dra. Paula Mendes',
    role: 'anestesiologista',
    email: 'paula@anest.com',
    active: true,
    customPermissions: false,
    isCoordenador: true,
    lastAccess: '2025-01-15T10:20:00',
    accessCount: 98,
    documentsAccessed: ['prot-001', 'rel-001']
  },
  {
    id: 'u7',
    nome: 'Dr. Roberto Nascimento',
    role: 'anestesiologista',
    email: 'roberto@anest.com',
    active: true,
    customPermissions: false,
    lastAccess: '2025-01-14T15:00:00',
    accessCount: 45,
    documentsAccessed: ['med-001']
  },
  {
    id: 'u8',
    nome: 'Visitante Externo',
    role: 'colaborador',
    email: 'visitante@anest.com',
    active: false,
    customPermissions: false,
    lastAccess: '2025-01-10T09:00:00',
    accessCount: 12,
    documentsAccessed: []
  },
];

// Roles com cores padronizadas
// Nota: Administrador é uma permissão especial separada do cargo
export const mockRoles = [
  { id: 'anestesiologista', name: 'Anestesiologista', color: '#2563eb' },
  { id: 'medico-residente', name: 'Médico Residente', color: '#8b5cf6' },
  { id: 'enfermeiro', name: 'Enfermeiro', color: '#10b981' },
  { id: 'tec-enfermagem', name: 'Téc. Enfermagem', color: '#06b6d4' },
  { id: 'farmaceutico', name: 'Farmacêutico', color: '#ec4899' },
  { id: 'colaborador', name: 'Colaborador', color: '#6366f1' },
  { id: 'secretaria', name: 'Secretária', color: '#f59e0b' },
];

// Função adicional (pode ser marcada simultaneamente a qualquer cargo)
export const COORDENADOR_BADGE = { id: 'coordenador', name: 'Coordenador', color: '#16a085' };

// Permissões organizadas por seção (baseado no legado BASE_PERMISSIONS)
export const mockPermissionSections = {
  cards: [
    { key: 'card-comunicados', label: 'Comunicados' },
    { key: 'card-pendencias', label: 'Pendências' },
    { key: 'card-kpis', label: 'KPIs' },
    { key: 'card-rops', label: 'ROPs' },
    { key: 'card-residencia', label: 'Residência' },
    { key: 'card-incidentes', label: 'Incidentes' },
    { key: 'card-auditorias', label: 'Auditorias' },
    { key: 'card-relatorios', label: 'Relatórios' },
    { key: 'card-biblioteca', label: 'Biblioteca' },
    { key: 'card-medicamentos', label: 'Medicamentos' },
    { key: 'card-infeccao', label: 'Infecção' },
    { key: 'card-checklist', label: 'Checklist' },
    { key: 'card-calculadoras', label: 'Calculadoras' },
  ],
  rops: [
    { key: 'rop-cultura', label: 'Cultura de Segurança' },
    { key: 'rop-comunicacao', label: 'Comunicação' },
    { key: 'rop-medicamentos', label: 'Medicamentos' },
    { key: 'rop-vida-profissional', label: 'Vida Profissional' },
    { key: 'rop-infeccoes', label: 'Infecções' },
    { key: 'rop-riscos', label: 'Riscos' },
  ],
  documentos: [
    { key: 'doc-protocolos', label: 'Protocolos' },
    { key: 'doc-politicas', label: 'Políticas' },
    { key: 'doc-formularios', label: 'Formulários' },
    { key: 'doc-manuais', label: 'Manuais' },
    { key: 'doc-relatorios', label: 'Relatórios' },
    { key: 'doc-create', label: 'Criar Documentos' },
    { key: 'doc-edit', label: 'Editar Documentos' },
    { key: 'doc-delete', label: 'Excluir Documentos' },
  ],
  modulos: [
    { key: 'residencia', label: 'Residência' },
    { key: 'podcasts', label: 'Podcasts' },
    { key: 'notificacoes', label: 'Notificações' },
    { key: 'ranking', label: 'Ranking' },
    { key: 'admin-panel', label: 'Painel Admin' },
  ],
  incidentes: [
    { key: 'incidente-view', label: 'Visualizar Incidentes' },
    { key: 'incidente-create', label: 'Criar Incidentes' },
    { key: 'incidente-manage', label: 'Gerenciar Incidentes' },
    { key: 'incidente-respond', label: 'Responder Incidentes' },
    { key: 'incidente-close', label: 'Encerrar Incidentes' },
    { key: 'denuncia-view', label: 'Visualizar Denúncias' },
    { key: 'denuncia-manage', label: 'Gerenciar Denúncias' },
    { key: 'denuncia-respond', label: 'Responder Denúncias' },
    { key: 'denuncia-close', label: 'Encerrar Denúncias' },
  ],
};

// Documentos mais acessados (para analytics)
export const mockDocumentStats = [
  { id: 'prot-001', titulo: 'Protocolo de Sedação', acessos: 45 },
  { id: 'man-001', titulo: 'Manual TEV', acessos: 38 },
  { id: 'check-001', titulo: 'Checklist Cirurgia Segura', acessos: 32 },
  { id: 'prot-002', titulo: 'Protocolo Dor', acessos: 28 },
  { id: 'pol-001', titulo: 'Política de Qualidade', acessos: 25 },
];

// Emails autorizados (aba 2)
export const mockAuthorizedEmails = [
  { email: 'novo.medico@anest.com', addedAt: '2025-01-10', addedBy: 'Admin' },
  { email: 'enfermeiro.teste@anest.com', addedAt: '2025-01-08', addedBy: 'Admin' },
];

// Responsáveis por Incidentes/Denúncias (aba 5 - Incidentes)
export const mockIncidentResponsibles = [
  {
    id: 'u1',
    nome: 'Dr. Carlos Silva',
    email: 'carlos@anest.com',
    role: 'anestesiologista',
    isAdmin: true,
    receberIncidentes: true,
    receberDenuncias: true,
    categorias: ['medicacao', 'via_aerea', 'cardiovascular', 'equipamento'],
    notificarEmail: true,
    notificarApp: true,
  },
  {
    id: 'u6',
    nome: 'Dra. Paula Mendes',
    email: 'paula@anest.com',
    role: 'anestesiologista',
    isCoordenador: true,
    receberIncidentes: true,
    receberDenuncias: false,
    categorias: ['medicacao', 'identificacao', 'queda'],
    notificarEmail: true,
    notificarApp: true,
  },
  {
    id: 'u2',
    nome: 'Dra. Ana Costa',
    email: 'ana@anest.com',
    role: 'anestesiologista',
    receberIncidentes: true,
    receberDenuncias: false,
    categorias: ['medicacao'],
    notificarEmail: false,
    notificarApp: true,
  },
];

// Helper para obter cor do role
export const getRoleColor = (roleId) => {
  if (roleId === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.color;
  const role = mockRoles.find(r => r.id === roleId);
  return role?.color || '#6c757d';
};

// Helper para obter nome do role
export const getRoleName = (roleId) => {
  if (roleId === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.name;
  const role = mockRoles.find(r => r.id === roleId);
  return role?.name || roleId;
};
