// Tipos de usuário (profissões)
export const TIPOS_USUARIO = {
  medico: { label: 'Anestesiologista', cor: '#2563eb' }, // alias legado
  anestesiologista: { label: 'Anestesiologista', cor: '#2563eb' },
  residente: { label: 'Médico Residente', cor: '#8b5cf6' }, // alias legado
  'medico-residente': { label: 'Médico Residente', cor: '#8b5cf6' },
  enfermeiro: { label: 'Enfermeiro', cor: '#10b981' },
  tecnico_enfermagem: { label: 'Téc. Enfermagem', cor: '#06b6d4' }, // alias legado
  'tec-enfermagem': { label: 'Téc. Enfermagem', cor: '#06b6d4' },
  secretaria: { label: 'Secretária', cor: '#f59e0b' },
  farmaceutico: { label: 'Farmacêutico', cor: '#ec4899' },
  administrativo: { label: 'Colaborador', cor: '#6366f1' }, // alias legado
  colaborador: { label: 'Colaborador', cor: '#6366f1' },
  coordenador: { label: 'Coordenador', cor: '#16a085' },
};

// Definição de cargos (SSOT para UI)
export const ROLES = [
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

// Helper para obter cor do role
export const getRoleColor = (roleId) => {
  if (roleId === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.color;
  const role = ROLES.find(r => r.id === roleId);
  return role?.color || '#6c757d';
};

// Helper para obter nome do role
export const getRoleName = (roleId) => {
  if (roleId === COORDENADOR_BADGE.id) return COORDENADOR_BADGE.name;
  const role = ROLES.find(r => r.id === roleId);
  return role?.name || roleId;
};

// Helper de permissão para gerenciar conteúdo
export const canManageContent = (user) => {
  if (user?.isAdmin) return true;
  return ['admin', 'editor', 'administrador', 'Administrador', 'Coordenador'].includes(user?.role);
};
