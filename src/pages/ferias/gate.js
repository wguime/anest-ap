/**
 * Gate do Extrato de Férias.
 *
 * Decisão do dono (2026-08-03): o extrato (dias marcados, cotas e alertas de
 * regra de TODOS os sócios) é assunto interno do corpo de anestesiologistas —
 * outros papéis não veem o pill no card da Home nem a rota. Admin passa;
 * dev local segue aberto (mesmo formato de escala-cirurgica/gate.js, a
 * fonte única de gate por papel do projeto).
 */
import { normalizeRole } from '@/utils/userTypes'

export const podeVerExtratoFerias = (user) =>
  import.meta.env.DEV ||
  !!user?.isAdmin ||
  normalizeRole(user?.role) === 'anestesiologista'
