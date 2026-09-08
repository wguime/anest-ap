/**
 * Login por IDENTIFICADOR — quem não tem e-mail entra pelo nome da conta.
 *
 * Decisão do dono 2026-09-08: a conta compartilhada das funcionárias da Unimed
 * entra digitando `Unimed`, sem e-mail ("não irão receber nenhum tipo de
 * informação"). O Firebase Auth exige um e-mail internamente, então o que a
 * pessoa digita vira `unimed@anest.local` antes de chegar ao SDK.
 *
 * `.local` é reservado pela RFC 6762 e não é roteável: nada que o app mande
 * para um endereço desses sai para a internet nem cai na caixa de terceiros —
 * é justamente o que queremos numa conta que não recebe e-mail.
 *
 * Quem tem e-mail de verdade continua digitando o e-mail: a presença do `@`
 * decide, e o caminho antigo não muda em nada.
 */

/** Domínio interno das contas sem e-mail. Não roteável de propósito. */
export const DOMINIO_LOGIN_INTERNO = 'anest.local'

/** E-mail (tem `@`) — mesma checagem que o formulário já fazia. */
export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Identificador sem `@`: letras, números, ponto, hífen e underscore. Espaço
 * fica de fora para não gerar e-mail inválido a partir de um deslize de digitação.
 */
export const RE_IDENTIFICADOR = /^[a-z0-9][a-z0-9._-]*$/i

/** O que a pessoa digitou é um login aceitável (e-mail OU identificador)? */
export function ehLoginValido(raw) {
  const v = String(raw || '').trim()
  if (!v) return false
  return v.includes('@') ? RE_EMAIL.test(v) : RE_IDENTIFICADOR.test(v)
}

/**
 * Converte o que foi digitado no e-mail que o Firebase Auth espera.
 * `Unimed` → `unimed@anest.local`; `fulano@gmail.com` → ele mesmo, minúsculo.
 */
export function resolveLoginEmail(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return ''
  if (v.includes('@')) return v
  return `${v}@${DOMINIO_LOGIN_INTERNO}`
}
