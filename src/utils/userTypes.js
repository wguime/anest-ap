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
  // Contas compartilhadas do centro cirúrgico (dono 2026-09-08 e 09-09): só a
  // Escala Cirúrgica, e lá dentro tudo menos publicar. O rótulo é o HOSPITAL e
  // nada mais — "quero que nao tenha mais a palavra 'funcionária', quero apenas
  // Unimed (quando o login for realizado pela Unimed) e HRO (quando o login for
  // realizado pelo HRO)". Quem opera a escala lê o hospital, não o cargo.
  'func-unimed': { label: 'Unimed', cor: '#0ea5e9' },
  'func-hro': { label: 'HRO', cor: '#0ea5e9' },
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
  { id: 'func-unimed', name: 'Unimed', color: '#0ea5e9' },
  { id: 'func-hro', name: 'HRO', color: '#0ea5e9' },
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
  const role = (user?.role || '').toLowerCase();
  return ['admin', 'editor', 'administrador', 'coordenador'].includes(role);
};

// Aliases legados / variantes → chave canônica de TIPOS_USUARIO / ROLES
export const ROLE_ALIASES = {
  'anestesista': 'anestesiologista',
  'médico anestesista': 'anestesiologista',
  'medico anestesista': 'anestesiologista',
  'medico': 'anestesiologista',
  'médico': 'anestesiologista',
  'medico-staff': 'anestesiologista',
  'residente': 'medico-residente',
  'médico residente': 'medico-residente',
  'medico residente': 'medico-residente',
  'tecnico': 'tec-enfermagem',
  'técnico': 'tec-enfermagem',
  'tecnico_enfermagem': 'tec-enfermagem',
  'tecnico enfermagem': 'tec-enfermagem',
  'técnico enfermagem': 'tec-enfermagem',
  'téc. enfermagem': 'tec-enfermagem',
  'tec. enfermagem': 'tec-enfermagem',
  'tecnico-auxiliar': 'tec-enfermagem',
  'farmacêutico': 'farmaceutico',
  'secretária': 'secretaria',
  'administrativo': 'colaborador',
};

const ROLE_LABEL_TO_KEY = Object.entries(TIPOS_USUARIO).reduce((acc, [key, { label }]) => {
  const lbl = (label || '').toLowerCase();
  if (!acc[lbl]) acc[lbl] = key;
  return acc;
}, {});

// Normaliza role (chave, label ou alias legado) para chave canônica. Retorna null se não reconhecido.
export const normalizeRole = (role) => {
  if (!role) return null;
  const lower = String(role).toLowerCase().trim();
  if (ROLE_ALIASES[lower]) return ROLE_ALIASES[lower];
  if (TIPOS_USUARIO[role]) return role;
  if (TIPOS_USUARIO[lower]) return lower;
  if (ROLE_LABEL_TO_KEY[lower]) return ROLE_LABEL_TO_KEY[lower];
  return null;
};

/** Papéis das contas compartilhadas de hospital (Unimed, HRO). */
const PAPEIS_CONTA_HOSPITAL = ['func-unimed', 'func-hro'];

/**
 * Conta COMPARTILHADA de hospital (dono 2026-09-08 Unimed; 09-09 HRO).
 *
 * Nasceram restritas à Escala Cirúrgica ("não irão receber nenhum tipo de
 * informação"), e em 09/09 o dono abriu a Home delas: Plantão do Dia, Estágios
 * e Plantão Residência, Escala de Funcionários, Inbox e o carrossel de notícias,
 * mais a aba Menu inteira. O que passa por CARD virou permissão
 * (`ROLE_PERMISSION_TEMPLATES`); o que sobra aqui são as duas coisas que não têm
 * card nenhum e continuam valendo por ser conta compartilhada:
 *
 *  - a aba "Minhas" da Escala Cirúrgica não existe para elas (não assumem sala);
 *  - o convite de notificação PUSH não aparece — o token FCM é por APARELHO, e
 *    numa conta que roda em vários tablets do centro cirúrgico ele espalharia a
 *    mesma mensagem por todos eles. O sino in-app voltou; o push, não.
 *
 * ⚠️ O carrossel de notícias e o sino saíram deste gate em 09/09 — quem os
 * desliga, se um dia precisar, é permissão de card, não o papel.
 *
 * Papel, não lista de e-mails: a segunda conta assim (HRO) custou uma linha na
 * lista acima, como estava previsto.
 */
export const ehContaDeHospital = (user) => PAPEIS_CONTA_HOSPITAL.includes(normalizeRole(user?.role));

/**
 * Conta de TESTE (e2e) — nunca aparece em lista de seleção de gente real.
 * O usuário e2e tem cargo 'anestesiologista' de verdade (precisa passar nos gates
 * que os testes exercitam), então filtrar por cargo não o pega; o marcador
 * estável é o e-mail com "+e2e" (wguime+e2e2@…), que sobrevive a renomear o
 * display name. Pedido do dono 30/07: "E2e Tester" apareceu no seletor de
 * responsável da escala.
 */
export const ehContaDeTeste = (u) => /\+e2e/i.test(String(u?.email || ''));
