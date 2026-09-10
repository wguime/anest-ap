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

// ── Conta compartilhada de hospital ─────────────────────────────────────────
// O helper por PAPEL sobrou para duas coisas que não têm card nenhum: a aba
// "Minhas" da escala e o convite de push (token FCM é por aparelho, e a conta
// roda em vários tablets). Notícias e sino SAÍRAM daqui em 09/09 — se voltarem,
// a Home que o dono mandou abrir volta a ser calada pelo papel.
describe('conta de hospital', () => {
  it.each(CONTAS_HOSPITAL)('%s é conta compartilhada de hospital', async (role) => {
    const { ehContaDeHospital } = await import('@/utils/userTypes')
    expect(ehContaDeHospital({ role })).toBe(true)
  })

  it.each(['anestesiologista', 'secretaria', 'tec-enfermagem', 'colaborador', 'medico-residente'])(
    '%s NÃO é conta de hospital — nada dessa gente muda',
    async (role) => {
      const { ehContaDeHospital } = await import('@/utils/userTypes')
      expect(ehContaDeHospital({ role })).toBe(false)
    },
  )

  it('sem usuário não é conta de hospital (evita calar a Home no primeiro render)', async () => {
    const { ehContaDeHospital } = await import('@/utils/userTypes')
    expect(ehContaDeHospital(null)).toBe(false)
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

})

// ── O que a Home e o Menu dessas contas mostram (dono 2026-09-09) ───────────
// "na página home quero que apareçam: Plantão do Dia, Estágios Residência,
// Plantão Residência, Escala de Funcionários e Inbox — mais o carrossel de
// notícias. na aba Menu: quero que apareçam todos os ítens".
//
// É uma ALLOWLIST: card novo do app nasce desligado para conta compartilhada.
// Por isso a trava lista os LIGADOS por extenso e exige que todo o resto seja
// false — um `getAllCardIds(true)` distraído quebra aqui, não em produção.
describe('cards das contas de hospital', () => {
  const LIGADOS = [
    // Home, na ordem em que o dono pediu
    'plantao', 'estagios_residencia', 'plantao_residencia', 'escala_funcionarios', 'inbox',
    // Menu — os 4 widgets reais + as sub-rotas sem as quais eles abrem em tela negada
    'calculadoras', 'criterios_uti', 'cateter_peridural', 'cp_novo', 'cp_listagem',
    'manutencao', 'refeicao_unimed',
  ]

  it.each(CONTAS_HOSPITAL)('%s liga exatamente os cards pedidos, e nada mais', async (role) => {
    const { ROLE_PERMISSION_TEMPLATES } = await import('@/data/rolePermissionTemplates')
    const cards = ROLE_PERMISSION_TEMPLATES[role]
    const ligados = Object.entries(cards).filter(([, v]) => v === true).map(([k]) => k)
    expect(ligados.sort()).toEqual([...LIGADOS].sort())
  })

  it.each(CONTAS_HOSPITAL)('%s não vê Férias — foi o único "exceto" das duas vezes', async (role) => {
    const { ROLE_PERMISSION_TEMPLATES } = await import('@/data/rolePermissionTemplates')
    expect(ROLE_PERMISSION_TEMPLATES[role].ferias).toBe(false)
  })

  it.each(CONTAS_HOSPITAL)('%s segue fora de Gestão, Educação e Dashboard', async (role) => {
    const { ROLE_PERMISSION_TEMPLATES } = await import('@/data/rolePermissionTemplates')
    const cards = ROLE_PERMISSION_TEMPLATES[role]
    for (const id of ['incidentes', 'fazer_denuncia', 'faturamento', 'financeiro',
                      'dashboard_executivo', 'gestao_documental', 'biblioteca',
                      'educacao_continuada', 'res_gerenciar', 'qualidade']) {
      expect(cards[id]).toBe(false)
    }
  })

  it('o template cobre TODO card do NAV_STRUCTURE — chave faltando vira acesso liberado', async () => {
    // useCardPermissions: chave ausente + customPermissions + >5 keys = PERMITE.
    // Numa allowlist isso é o modo de falha silencioso a evitar.
    const { ROLE_PERMISSION_TEMPLATES, collectAllPermissionIds } = await import('@/data/rolePermissionTemplates')
    const cards = ROLE_PERMISSION_TEMPLATES['func-unimed']
    for (const { id } of collectAllPermissionIds()) {
      expect(cards, `card "${id}" fora do template`).toHaveProperty(id)
    }
  })
})
