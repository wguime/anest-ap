/**
 * Gate do Extrato de Férias.
 *
 * Decisão do dono (2026-08-03, revisada na mesma noite): acesso RESTRITO a
 * três pessoas — Guilherme Melo (as DUAS contas dele — decisão 27/07 de
 * manter ambas), Fernanda Guollo e Leandro Bernardes. Allowlist por E-MAIL
 * (estável entre Firestore/Supabase; uid ficaria órfão numa recriação de
 * conta). A RLS de ferias_violacoes_vistas espelha esta mesma lista
 * (migration 20260803233000). Dev local segue aberto.
 */

export const EMAILS_EXTRATO_FERIAS = [
  'wguime@yahoo.com.br',            // Guilherme Melo (conta 1)
  'anestesista.guilherme@gmail.com', // Guilherme Souza Melo (conta 2)
  'guollofernanda@gmail.com',       // Fernanda Guollo
  'leandrobernardes03@hotmail.com', // Leandro Bernardes
]

/**
 * E-mail → nome do sócio no Pega Plantão (chave de identidade do extrato).
 * ESPELHA a função SQL `ferias_nome_socio()` (migration 20260804120000),
 * usada no WITH CHECK que impede marcar férias em nome de outro — mudar
 * aqui exige mudar lá.
 */
export const EMAIL_TO_SOCIO = {
  'wguime@yahoo.com.br': 'G. MELO',
  'anestesista.guilherme@gmail.com': 'G. MELO',
  'guollofernanda@gmail.com': 'FERNANDA GUOLLO',
  'leandrobernardes03@hotmail.com': 'LEANDRO BERNARDES',
}

const emailDe = (user) => (user?.email || '').trim().toLowerCase()

export const podeVerExtratoFerias = (user) =>
  import.meta.env.DEV || EMAILS_EXTRATO_FERIAS.includes(emailDe(user))

/**
 * Sócio que o usuário pode marcar/desmarcar (self-service: só o próprio).
 * Em DEV sem e-mail casado, cai no sócio do dono para permitir testar o
 * fluxo localmente — em produção a RLS é quem manda.
 * @returns {string|null} nome do sócio ou null (sem direito de marcar)
 */
export function getSocioDoUsuario(user) {
  const socio = EMAIL_TO_SOCIO[emailDe(user)]
  if (socio) return socio
  return import.meta.env.DEV ? 'G. MELO' : null
}
