/**
 * Gate da Escala Cirúrgica — OPERAR ≠ PUBLICAR (dono 2026-09-08).
 *
 * A conta das funcionárias da Unimed (`func-unimed`) faz tudo que a equipe faz
 * na tela do dia — "as mesmas funcionalidades que os usuários têm ao acessarem
 * as escalas. nao podem publicar escalas apenas". Até 08/09 o módulo tinha um
 * gate só (`podeEditar` = `podeVer`), e a tela de importação usava ele: sem esta
 * trava, qualquer volta ao gate único devolve a importação para elas em silêncio.
 *
 * Espelho da RLS: `can_write_escala_cirurgica()` (operar, inclui func-unimed) e
 * `can_publicar_escala_cirurgica()` (publicar, não inclui) — migration
 * `20260908190000_escala_papel_func_unimed.sql`.
 */
import { describe, it, expect } from 'vitest'
import {
  podeVerEscalaCirurgica,
  podeEditarEscalaCirurgica,
  podePublicarEscalaCirurgica,
} from '@/pages/escala-cirurgica/gate'

const comPapel = (role) => ({ uid: 'u-1', role })
const admin = { uid: 'u-admin', role: 'colaborador', isAdmin: true }

// Quem opera o dia (mesmo conjunto de can_write_escala_cirurgica)
const OPERAM = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria', 'func-unimed']
// Quem publica (can_publicar_escala_cirurgica) — os de cima MENOS func-unimed
const PUBLICAM = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria']

describe('gate da escala — funcionárias da Unimed operam, não publicam', () => {
  it('func-unimed vê e edita a escala', () => {
    const u = comPapel('func-unimed')
    expect(podeVerEscalaCirurgica(u)).toBe(true)
    expect(podeEditarEscalaCirurgica(u)).toBe(true)
  })

  it('func-unimed NÃO publica — é isso que esconde a tela de importação', () => {
    expect(podePublicarEscalaCirurgica(comPapel('func-unimed'))).toBe(false)
  })

  it.each(PUBLICAM)('%s continua publicando', (role) => {
    expect(podePublicarEscalaCirurgica(comPapel(role))).toBe(true)
  })

  it.each(OPERAM)('%s opera a escala', (role) => {
    expect(podeEditarEscalaCirurgica(comPapel(role))).toBe(true)
  })

  it('admin publica mesmo com papel fora da equipe', () => {
    expect(podePublicarEscalaCirurgica(admin)).toBe(true)
  })

  it('quem publica também opera (publicar é subconjunto de operar)', () => {
    for (const role of PUBLICAM) {
      expect(podeEditarEscalaCirurgica(comPapel(role))).toBe(true)
    }
  })

  it('alias legado normaliza nos dois gates', () => {
    // 'tecnico_enfermagem' é grafia antiga de 'tec-enfermagem'
    expect(podeEditarEscalaCirurgica(comPapel('tecnico_enfermagem'))).toBe(true)
    expect(podePublicarEscalaCirurgica(comPapel('tecnico_enfermagem'))).toBe(true)
  })

  it.each(['colaborador', 'enfermeiro', 'farmaceutico'])(
    '%s fica fora dos dois gates',
    (role) => {
      expect(podeEditarEscalaCirurgica(comPapel(role))).toBe(false)
      expect(podePublicarEscalaCirurgica(comPapel(role))).toBe(false)
    },
  )

  it('sem usuário, nada', () => {
    expect(podeEditarEscalaCirurgica(null)).toBe(false)
    expect(podePublicarEscalaCirurgica(undefined)).toBe(false)
  })
})

// ── Conta de acesso restrito ────────────────────────────────────────────────
// Notícias, sino e convite de push não passam por permissão de card: se este
// helper voltar a false para `func-unimed`, a conta que "não recebe nenhum tipo
// de informação" volta a receber, e nenhum outro teste percebe.
describe('conta somente-escala', () => {
  it('func-unimed é conta de acesso restrito', async () => {
    const { ehContaSomenteEscala } = await import('@/utils/userTypes')
    expect(ehContaSomenteEscala({ role: 'func-unimed' })).toBe(true)
  })

  it.each(['anestesiologista', 'secretaria', 'tec-enfermagem', 'colaborador', 'medico-residente'])(
    '%s NÃO é conta restrita — a Home dessa gente não muda',
    async (role) => {
      const { ehContaSomenteEscala } = await import('@/utils/userTypes')
      expect(ehContaSomenteEscala({ role })).toBe(false)
    },
  )

  it('sem usuário não é conta restrita (evita esconder a Home no primeiro render)', async () => {
    const { ehContaSomenteEscala } = await import('@/utils/userTypes')
    expect(ehContaSomenteEscala(null)).toBe(false)
  })
})
