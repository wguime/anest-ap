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

export const podeVerExtratoFerias = (user) =>
  import.meta.env.DEV ||
  EMAILS_EXTRATO_FERIAS.includes((user?.email || '').trim().toLowerCase())
