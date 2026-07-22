/**
 * Gate de visibilidade da Escala Cirúrgica.
 *
 * LIBERADO AO GRUPO em 2026-07-22 (fim do piloto de 1): visível para quem a RLS
 * de dados atende — papel clínico (anestesiologista/medico-residente), secretária
 * (confecciona a escala) e admin. Papéis não-clínicos não veem o card/rota (a RLS
 * bloquearia os dados de toda forma — iniciais+procedimento+cirurgião reidentificam
 * em hospital pequeno). Dev local segue aberto.
 *
 * Histórico: 2026-07-21→22 rodou como piloto exclusivo do dono (e-mail fixo).
 */
import { normalizeRole } from '@/utils/userTypes'

const PAPEIS_COM_ACESSO = ['anestesiologista', 'medico-residente', 'secretaria']

export const podeVerEscalaCirurgica = (user) =>
  import.meta.env.DEV ||
  !!user?.isAdmin ||
  PAPEIS_COM_ACESSO.includes(normalizeRole(user?.role))
