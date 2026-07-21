/**
 * Gate de visibilidade da Escala Cirúrgica (fase de validação em produção).
 *
 * Decisão do dono 2026-07-21: o módulo entra em PRODUÇÃO visível EXCLUSIVAMENTE
 * para ele (piloto de 1), além de continuar aberto no dev local. Isto controla
 * apenas UI/rota — o acesso a dados segue coberto pela RLS por papel clínico.
 * Liberar para o grupo = trocar este predicado (ou remover o gate).
 */
export const EMAIL_DONO = 'wguime@yahoo.com.br'

export const podeVerEscalaCirurgica = (user) =>
  import.meta.env.DEV || (user?.email || '').toLowerCase() === EMAIL_DONO
