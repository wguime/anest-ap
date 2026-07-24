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
 * 07-24 incluídos técnicos de enfermagem (escala colaborativa).
 */
import { normalizeRole } from '@/utils/userTypes'

const PAPEIS_COM_ACESSO = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria']

export const podeVerEscalaCirurgica = (user) =>
  import.meta.env.DEV ||
  !!user?.isAdmin ||
  PAPEIS_COM_ACESSO.includes(normalizeRole(user?.role))
