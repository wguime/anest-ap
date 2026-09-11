/**
 * Gate do Extrato de Férias — quem VÊ é o CARGO, não uma lista de e-mails.
 *
 * Dono 2026-09-11: "libere a funcionalidade de conferência de extrato de férias
 * para todos os anestesistas (NÃO é para liberar para funcionários, enfermeiros,
 * farmacêuticos, residentes...)". Até então o gate era uma allowlist de 5
 * e-mails; o teste trava os dois lados do pedido — entra todo anestesiologista
 * (inclusive quem nunca esteve na lista) e fica de fora cada cargo que o dono
 * nomeou, mesmo com isAdmin.
 *
 * `import.meta.env.DEV` abre o gate em dev local; aqui ele é desligado para o
 * teste medir o que produção vê. Espelho da RLS: `can_access_extrato_ferias()`
 * (migration 20260911180000_extrato_ferias_todos_anestesiologistas.sql).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { podeVerExtratoFerias, EMAILS_ALERTAS_FERIAS, getSocioDoUsuario } from '@/pages/ferias/gate'

describe('podeVerExtratoFerias — cargo, não e-mail', () => {
  beforeEach(() => vi.stubEnv('DEV', false))
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['anestesiologista', 'colega.qualquer@gmail.com'],
    ['Anestesiologista', 'outro@hotmail.com'], // label como cargo
    ['medico', 'legado@gmail.com'], // alias legado normaliza para anestesiologista
  ])('anestesiologista entra sem estar em lista nenhuma (%s)', (role, email) => {
    expect(EMAILS_ALERTAS_FERIAS).not.toContain(email)
    expect(podeVerExtratoFerias({ role, email })).toBe(true)
  })

  it.each([
    'medico-residente',
    'residente',
    'enfermeiro',
    'tec-enfermagem',
    'farmaceutico',
    'secretaria',
    'colaborador',
    'func-unimed',
    'func-hro',
  ])('cargo %s fica de fora, mesmo admin', (role) => {
    expect(podeVerExtratoFerias({ role, email: 'x@y.com' })).toBe(false)
    expect(podeVerExtratoFerias({ role, email: 'x@y.com', isAdmin: true })).toBe(false)
  })

  it('sem cargo ou sem usuário → fora (admin puro não basta)', () => {
    expect(podeVerExtratoFerias(null)).toBe(false)
    expect(podeVerExtratoFerias({ email: 'x@y.com' })).toBe(false)
    expect(podeVerExtratoFerias({ isAdmin: true })).toBe(false)
  })

  it('quem estava na lista antiga continua entrando — pelo cargo', () => {
    for (const email of EMAILS_ALERTAS_FERIAS) {
      expect(podeVerExtratoFerias({ role: 'anestesiologista', email })).toBe(true)
    }
  })

  it('ver não é marcar: anestesiologista fora de EMAIL_TO_SOCIO não ganha sócio', () => {
    expect(getSocioDoUsuario({ role: 'anestesiologista', email: 'colega.qualquer@gmail.com' })).toBeNull()
    expect(getSocioDoUsuario({ role: 'anestesiologista', email: 'wguime@yahoo.com.br' })).toBe('G. MELO')
  })
})
