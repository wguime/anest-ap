/**
 * Gate da Escala Cirúrgica — OPERAR ≠ PUBLICAR (dono 2026-09-08; conta HRO 09-09).
 *
 * As contas de hospital (`func-unimed`, `func-hro`) fazem tudo que a equipe faz
 * na tela do dia — "as mesmas funcionalidades que os usuários têm ao acessarem
 * as escalas. nao podem publicar escalas apenas". Até 08/09 o módulo tinha um
 * gate só (`podeEditar` = `podeVer`), e a tela de importação usava ele: sem esta
 * trava, qualquer volta ao gate único devolve a importação para elas em silêncio.
 *
 * A conta HRO nasceu "exatamente igual ao acesso para funcionárias da Unimed"
 * (dono 09/09) — o `it.each` das listas abaixo é o que impede que ela fique só
 * parecida: papel novo que entre numa lista e não na outra quebra aqui.
 *
 * Espelho da RLS: `can_write_escala_cirurgica()` (operar, inclui as duas) e
 * `can_publicar_escala_cirurgica()` (publicar, não inclui nenhuma) — migrations
 * `20260908190000_escala_papel_func_unimed.sql` e `20260910120000_escala_papel_func_hro.sql`.
 */
import { describe, it, expect } from 'vitest'
import {
  podeVerEscalaCirurgica,
  podeEditarEscalaCirurgica,
  podePublicarEscalaCirurgica,
  hospitalDaConta,
} from '@/pages/escala-cirurgica/gate'

const comPapel = (role) => ({ uid: 'u-1', role })
const admin = { uid: 'u-admin', role: 'colaborador', isAdmin: true }

// Contas compartilhadas de hospital — o recorte tem de valer para as DUAS
const CONTAS_HOSPITAL = ['func-unimed', 'func-hro']
// Quem opera o dia (mesmo conjunto de can_write_escala_cirurgica)
const OPERAM = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria', ...CONTAS_HOSPITAL]
// Quem publica (can_publicar_escala_cirurgica) — os de cima MENOS as contas de hospital
const PUBLICAM = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria']

describe('gate da escala — contas de hospital operam, não publicam', () => {
  it.each(CONTAS_HOSPITAL)('%s vê e edita a escala', (role) => {
    const u = comPapel(role)
    expect(podeVerEscalaCirurgica(u)).toBe(true)
    expect(podeEditarEscalaCirurgica(u)).toBe(true)
  })

  it.each(CONTAS_HOSPITAL)('%s NÃO publica — é isso que esconde a tela de importação', (role) => {
    expect(podePublicarEscalaCirurgica(comPapel(role))).toBe(false)
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
  it.each(CONTAS_HOSPITAL)('%s é conta de acesso restrito', async (role) => {
    const { ehContaSomenteEscala } = await import('@/utils/userTypes')
    expect(ehContaSomenteEscala({ role })).toBe(true)
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

// ── Hospital em que a tela abre (dono 2026-09-09) ───────────────────────────
// "HRO abre no HRO, Unimed na Unimed". Sem isto as duas nasciam na Unimed, e a
// conta do HRO abria todo dia no hospital errado.
describe('hospital da conta', () => {
  it('cada conta de hospital abre no hospital dela', () => {
    expect(hospitalDaConta(comPapel('func-unimed'))).toBe('unimed')
    expect(hospitalDaConta(comPapel('func-hro'))).toBe('hro')
  })

  it('gente da equipe não tem hospital fixo — quem escolhe é a varredura/o seletor', () => {
    for (const role of PUBLICAM) expect(hospitalDaConta(comPapel(role))).toBeNull()
    expect(hospitalDaConta(null)).toBeNull()
  })
})

// ── Rótulo do cargo (dono 2026-09-09) ───────────────────────────────────────
// "quero que nao tenha mais a palavra 'funcionária', quero apenas Unimed
// (quando o login for realizado pela Unimed) e HRO (quando o login for
// realizado pelo HRO)".
describe('rótulo das contas de hospital', () => {
  it('o cargo é o hospital, sem "funcionária"', async () => {
    const { TIPOS_USUARIO, getRoleName } = await import('@/utils/userTypes')
    expect(TIPOS_USUARIO['func-unimed'].label).toBe('Unimed')
    expect(TIPOS_USUARIO['func-hro'].label).toBe('HRO')
    expect(getRoleName('func-unimed')).toBe('Unimed')
    expect(getRoleName('func-hro')).toBe('HRO')
  })

  it.each(CONTAS_HOSPITAL)('%s não escreve "funcionária" em lugar nenhum', async (role) => {
    const { TIPOS_USUARIO, getRoleName } = await import('@/utils/userTypes')
    expect(TIPOS_USUARIO[role].label.toLowerCase()).not.toContain('funcion')
    expect(getRoleName(role).toLowerCase()).not.toContain('funcion')
  })

  it('as duas contas continuam com template de permissão ZERADO', async () => {
    const { ROLE_PERMISSION_TEMPLATES } = await import('@/data/rolePermissionTemplates')
    for (const role of CONTAS_HOSPITAL) {
      const cards = ROLE_PERMISSION_TEMPLATES[role]
      expect(Object.keys(cards).length).toBeGreaterThan(50)
      expect(Object.values(cards).every((v) => v === false)).toBe(true)
    }
  })
})
