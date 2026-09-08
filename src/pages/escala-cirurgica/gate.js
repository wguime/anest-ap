/**
 * Gate de visibilidade da Escala Cirúrgica.
 *
 * A escala é COLABORATIVA (decisão do dono 2026-07-24): a equipe do centro
 * cirúrgico opera junta. Visível/editável para anestesiologista, medico-residente,
 * técnico de enfermagem e secretária (confecciona a escala) + admin — mesmo
 * conjunto da RLS (can_write_escala_cirurgica). Papéis fora dessa equipe não veem
 * o card/rota (a RLS bloqueia os dados — iniciais+procedimento+cirurgião podem
 * reidentificar em hospital pequeno). Dev local segue aberto.
 *
 * Histórico: 2026-07-21→22 piloto do dono; 07-22 liberado ao grupo clínico;
 * 07-24 incluídos técnicos de enfermagem (escala colaborativa); 09-08 entra
 * `func-unimed` (funcionárias da Unimed) — opera o dia como os demais, mas NÃO
 * publica: daí `podePublicarEscalaCirurgica` viver aqui também.
 */
import { normalizeRole } from '@/utils/userTypes'

const PAPEIS_COM_ACESSO = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria', 'func-unimed']

/**
 * Quem PUBLICA a escala (importar a foto, substituir o turno). Subconjunto de
 * PAPEIS_COM_ACESSO — espelha a RLS `can_publicar_escala_cirurgica()`.
 * `func-unimed` (funcionárias da Unimed, dono 2026-09-08) opera o dia inteiro
 * mas fica de fora daqui: publicar é da equipe.
 */
const PAPEIS_QUE_PUBLICAM = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria']

export const podeVerEscalaCirurgica = (user) =>
  import.meta.env.DEV ||
  !!user?.isAdmin ||
  PAPEIS_COM_ACESSO.includes(normalizeRole(user?.role))

/**
 * Editar = ver (mesmo conjunto da RLS `can_write_escala_cirurgica`). ÚNICA fonte
 * do canEdit do módulo: as cópias inline em cada página comparavam `role` cru
 * (`user.role.toLowerCase()`), então um cargo gravado num alias legado
 * ('medico', 'residente', 'tecnico_enfermagem') passava no gate de visibilidade
 * — que normaliza — e caía fora do canEdit, deixando a pessoa com a escala só de
 * leitura sem explicação. Sem escape de DEV: aqui o botão que aparece precisa
 * salvar de verdade, e a RLS recusaria a escrita.
 */
export const podeEditarEscalaCirurgica = (user) =>
  !!user?.isAdmin || PAPEIS_COM_ACESSO.includes(normalizeRole(user?.role))

/**
 * Publicar = importar a foto e substituir o turno. Sem escape de DEV pelo mesmo
 * motivo de `podeEditarEscalaCirurgica`: o botão que aparece precisa publicar de
 * verdade, e a RPC (`pode_publicar_escala_turno`) recusaria. A ÚNICA publicação
 * que quem não passa aqui faz é a linha vazia do dia (`garantirEscala`), que o
 * servidor libera à parte — por isso ela não consulta este gate.
 */
export const podePublicarEscalaCirurgica = (user) =>
  !!user?.isAdmin || PAPEIS_QUE_PUBLICAM.includes(normalizeRole(user?.role))
