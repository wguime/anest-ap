/**
 * Rótulo das teclas conforme o computador (dono 09/10/2026): a tela de publicação mostra
 * os atalhos escritos ao lado de cada ação, e as secretárias usam Windows — "⌘↵" ali não
 * diz nada. Os atalhos em si aceitam as duas teclas (⌘ ou Ctrl); aqui é só o RÓTULO.
 */
const plataforma = typeof navigator !== 'undefined'
  ? `${navigator.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`
  : ''
export const EH_MAC = /Mac|iPhone|iPad/i.test(plataforma)
/** ⌘ no Mac, Ctrl no resto — já com o separador quando precisa ("Ctrl+V"). */
export const MOD = EH_MAC ? '⌘' : 'Ctrl+'
/** ⌥ no Mac, Alt no resto. */
export const ALT = EH_MAC ? '⌥' : 'Alt+'
