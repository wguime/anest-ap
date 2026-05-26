/**
 * Tests for src/pages/management/utils/incidentAccess.js
 *
 * Política (definida em 2026-05-11):
 *   Centro de Gestão > Incidentes e páginas individuais
 *   (`incidente-gestao` / `denuncia-gestao`) devem ser visíveis apenas para:
 *   - admin pleno (user.isAdmin === true OU role === 'administrador'); ou
 *   - usuários explicitamente marcados como responsáveis
 *     (user.incidentSettings.isResponsible === true).
 *
 *   Coordenadores comuns NÃO veem Incidentes (a menos que também sejam
 *   responsáveis). Esse bug foi reportado pelo Guilherme e corrigido nesta
 *   feature/sprint12-rotacao-cert-hmac (após o trabalho de HMAC).
 */
import { describe, it, expect } from 'vitest'
import { isFullAdmin, isCoordenador, isIncidentResponsible, canAccessCentroGestao, canAccessIncidentManagement, canAccessIncidenteGestao, canAccessDenunciaGestao, getVisibleCentroGestaoSections, getAllowedIncidentViewModes } from '../../../pages/management/utils/incidentAccess'

// ============================================================================
// FIXTURES — 6 perfis canônicos
// ============================================================================

const adminPleno = {
  uid: 'u-admin',
  isAdmin: true,
  role: 'administrador',
  incidentSettings: null,
  permissions: {},
}

const coordComum = {
  uid: 'u-coord',
  isAdmin: false,
  isCoordenador: true,
  role: 'coordenador',
  incidentSettings: { isResponsible: false },
  permissions: {},
}

const coordResponsavel = {
  uid: 'u-coord-resp',
  isAdmin: false,
  isCoordenador: true,
  role: 'coordenador',
  incidentSettings: { isResponsible: true, receberIncidentes: true, receberDenuncias: false },
  permissions: {},
}

const responsavelPuro = {
  uid: 'u-resp',
  isAdmin: false,
  isCoordenador: false,
  role: 'anestesiologista',
  incidentSettings: { isResponsible: true, receberIncidentes: true, receberDenuncias: true },
  permissions: {},
}

const residenciaEdit = {
  uid: 'u-res-edit',
  isAdmin: false,
  isCoordenador: false,
  role: 'anestesiologista',
  incidentSettings: { isResponsible: false },
  permissions: { 'residencia-edit': true },
}

const colaboradorComum = {
  uid: 'u-colab',
  isAdmin: false,
  isCoordenador: false,
  role: 'colaborador',
  incidentSettings: { isResponsible: false },
  permissions: {},
}

const responsavelIncOnly = {
  uid: 'u-resp-inc',
  isAdmin: false,
  isCoordenador: false,
  role: 'enfermeiro',
  incidentSettings: { isResponsible: true, receberIncidentes: true, receberDenuncias: false },
  permissions: {},
}

const responsavelDenOnly = {
  uid: 'u-resp-den',
  isAdmin: false,
  isCoordenador: false,
  role: 'enfermeiro',
  incidentSettings: { isResponsible: true, receberIncidentes: false, receberDenuncias: true },
  permissions: {},
}

const responsavelBothOff = {
  uid: 'u-resp-off',
  isAdmin: false,
  isCoordenador: false,
  role: 'enfermeiro',
  incidentSettings: { isResponsible: true, receberIncidentes: false, receberDenuncias: false },
  permissions: {},
}

const tecEnfEdit = {
  uid: 'u-tec-edit',
  isAdmin: false,
  isCoordenador: false,
  role: 'tec-enfermagem',
  incidentSettings: null,
  permissions: { 'tec-enf-secretaria-edit': true },
}

// ============================================================================
// isFullAdmin
// ============================================================================

describe('isFullAdmin', () => {
  it('retorna true para isAdmin=true', () => {
    expect(isFullAdmin(adminPleno)).toBe(true)
  })

  it('retorna true para role="administrador" mesmo sem flag', () => {
    expect(isFullAdmin({ isAdmin: false, role: 'administrador' })).toBe(true)
  })

  it('retorna false para coordenadores (isCoordenador / role="coordenador")', () => {
    expect(isFullAdmin(coordComum)).toBe(false)
    expect(isFullAdmin(coordResponsavel)).toBe(false)
  })

  it('retorna false para responsável puro (anestesiologista)', () => {
    expect(isFullAdmin(responsavelPuro)).toBe(false)
  })

  it('retorna false para colaborador comum', () => {
    expect(isFullAdmin(colaboradorComum)).toBe(false)
  })

  it('retorna false para user null/undefined', () => {
    expect(isFullAdmin(null)).toBe(false)
    expect(isFullAdmin(undefined)).toBe(false)
  })

  it('é case-insensitive para role', () => {
    expect(isFullAdmin({ role: 'ADMINISTRADOR' })).toBe(true)
    expect(isFullAdmin({ role: 'Administrador' })).toBe(true)
  })
})

// ============================================================================
// isCoordenador
// ============================================================================

describe('isCoordenador', () => {
  it('retorna true para isCoordenador=true', () => {
    expect(isCoordenador(coordComum)).toBe(true)
  })

  it('retorna true para role="coordenador"', () => {
    expect(isCoordenador({ role: 'coordenador' })).toBe(true)
  })

  it('retorna false para admin pleno', () => {
    expect(isCoordenador(adminPleno)).toBe(false)
  })

  it('retorna false para colaborador comum', () => {
    expect(isCoordenador(colaboradorComum)).toBe(false)
  })
})

// ============================================================================
// isIncidentResponsible
// ============================================================================

describe('isIncidentResponsible', () => {
  it('retorna true quando incidentSettings.isResponsible === true', () => {
    expect(isIncidentResponsible(responsavelPuro)).toBe(true)
    expect(isIncidentResponsible(coordResponsavel)).toBe(true)
  })

  it('retorna false quando isResponsible !== true', () => {
    expect(isIncidentResponsible(coordComum)).toBe(false)
    expect(isIncidentResponsible(adminPleno)).toBe(false)
    expect(isIncidentResponsible(colaboradorComum)).toBe(false)
  })

  it('retorna false sem incidentSettings', () => {
    expect(isIncidentResponsible({})).toBe(false)
    expect(isIncidentResponsible(null)).toBe(false)
  })
})

// ============================================================================
// canAccessCentroGestao — guard de entrada da página
// ============================================================================

describe('canAccessCentroGestao', () => {
  it('permite admin pleno', () => {
    expect(canAccessCentroGestao(adminPleno)).toBe(true)
  })

  it('permite coordenador (ele tem acesso geral, só não vê Incidentes)', () => {
    expect(canAccessCentroGestao(coordComum)).toBe(true)
  })

  it('permite responsável por incidentes (só vê aba Incidentes)', () => {
    expect(canAccessCentroGestao(responsavelPuro)).toBe(true)
  })

  it('permite user com residencia-edit', () => {
    expect(canAccessCentroGestao(residenciaEdit)).toBe(true)
  })

  it('permite user com tec-enf-secretaria-edit', () => {
    expect(canAccessCentroGestao({
      isAdmin: false,
      isCoordenador: false,
      role: 'tec_enfermagem',
      permissions: { 'tec-enf-secretaria-edit': true },
    })).toBe(true)
  })

  it('BLOQUEIA colaborador comum sem nenhuma permissão especial', () => {
    expect(canAccessCentroGestao(colaboradorComum)).toBe(false)
  })

  it('BLOQUEIA user null/undefined', () => {
    expect(canAccessCentroGestao(null)).toBe(false)
    expect(canAccessCentroGestao(undefined)).toBe(false)
  })
})

// ============================================================================
// canAccessIncidentManagement — REGRA CENTRAL do bug-fix
// ============================================================================

describe('canAccessIncidentManagement (REGRA CENTRAL)', () => {
  it('permite admin pleno', () => {
    expect(canAccessIncidentManagement(adminPleno)).toBe(true)
  })

  it('permite responsável puro', () => {
    expect(canAccessIncidentManagement(responsavelPuro)).toBe(true)
  })

  it('permite coordenador SE também for responsável', () => {
    expect(canAccessIncidentManagement(coordResponsavel)).toBe(true)
  })

  it('BLOQUEIA coordenador comum (sem isResponsible) — bug-fix LGPD', () => {
    expect(canAccessIncidentManagement(coordComum)).toBe(false)
  })

  it('BLOQUEIA residencia-edit', () => {
    expect(canAccessIncidentManagement(residenciaEdit)).toBe(false)
  })

  it('BLOQUEIA colaborador comum', () => {
    expect(canAccessIncidentManagement(colaboradorComum)).toBe(false)
  })

  it('BLOQUEIA user null', () => {
    expect(canAccessIncidentManagement(null)).toBe(false)
  })

  it('BLOQUEIA quem tem incidentSettings mas isResponsible=false explícito', () => {
    expect(canAccessIncidentManagement({
      isAdmin: false,
      role: 'colaborador',
      incidentSettings: { isResponsible: false, receberIncidentes: true },
    })).toBe(false)
  })
})

// ============================================================================
// getVisibleCentroGestaoSections — quais abas aparecem no sidebar
// ============================================================================

describe('getVisibleCentroGestaoSections', () => {
  it('admin pleno: null (mostra todas as seções)', () => {
    expect(getVisibleCentroGestaoSections(adminPleno)).toBeNull()
  })

  describe('coordenador comum', () => {
    const sections = getVisibleCentroGestaoSections(coordComum)

    it('NÃO inclui incidentes (bug-fix principal)', () => {
      expect(sections).not.toContain('incidentes')
    })

    it('inclui as demais seções administrativas', () => {
      expect(sections).toContain('usuarios')
      expect(sections).toContain('documentos')
      expect(sections).toContain('comunicados')
      expect(sections).toContain('residencia')
      expect(sections).toContain('educacao')
    })

    it('retorna array não-vazio (nunca null)', () => {
      expect(Array.isArray(sections)).toBe(true)
      expect(sections.length).toBeGreaterThan(0)
    })
  })

  describe('coordenador + responsável', () => {
    const sections = getVisibleCentroGestaoSections(coordResponsavel)

    it('inclui incidentes', () => {
      expect(sections).toContain('incidentes')
    })

    it('mantém demais seções administrativas', () => {
      expect(sections).toContain('usuarios')
      expect(sections).toContain('documentos')
    })
  })

  describe('responsável puro (não-coord, não-admin)', () => {
    const sections = getVisibleCentroGestaoSections(responsavelPuro)

    it('inclui APENAS incidentes', () => {
      expect(sections).toEqual(['incidentes'])
    })

    it('NÃO inclui usuarios, documentos, comunicados, etc.', () => {
      expect(sections).not.toContain('usuarios')
      expect(sections).not.toContain('documentos')
      expect(sections).not.toContain('comunicados')
    })
  })

  describe('residencia-edit', () => {
    const sections = getVisibleCentroGestaoSections(residenciaEdit)

    it('inclui APENAS residencia', () => {
      expect(sections).toEqual(['residencia'])
    })

    it('NÃO inclui incidentes', () => {
      expect(sections).not.toContain('incidentes')
    })
  })

  describe('tec-enf-secretaria-edit', () => {
    const sections = getVisibleCentroGestaoSections({
      role: 'tec_enfermagem',
      permissions: { 'tec-enf-secretaria-edit': true },
    })

    it('inclui APENAS funcionarios', () => {
      expect(sections).toEqual(['funcionarios'])
    })

    it('NÃO inclui incidentes', () => {
      expect(sections).not.toContain('incidentes')
    })
  })

  describe('colaborador comum (sem permissões)', () => {
    const sections = getVisibleCentroGestaoSections(colaboradorComum)

    it('retorna ARRAY VAZIO (nunca null) — evita fallback "ver tudo"', () => {
      expect(sections).toEqual([])
      expect(sections).not.toBeNull()
    })
  })

  describe('user com múltiplas permissões especiais', () => {
    it('combina responsável + residencia-edit', () => {
      const sections = getVisibleCentroGestaoSections({
        role: 'enfermeiro',
        incidentSettings: { isResponsible: true },
        permissions: { 'residencia-edit': true },
      })
      expect(sections).toContain('incidentes')
      expect(sections).toContain('residencia')
      expect(sections).not.toContain('funcionarios')
    })
  })
})

// ============================================================================
// getAllowedIncidentViewModes
// ============================================================================

describe('getAllowedIncidentViewModes', () => {
  it('admin pleno: ambos modos', () => {
    expect(getAllowedIncidentViewModes(adminPleno)).toEqual(['incidentes', 'denuncias'])
  })

  it('responsável que recebe ambos', () => {
    expect(getAllowedIncidentViewModes(responsavelPuro)).toEqual(['incidentes', 'denuncias'])
  })

  it('responsável que recebe só incidentes', () => {
    expect(getAllowedIncidentViewModes(coordResponsavel)).toEqual(['incidentes'])
  })

  it('responsável que recebe só denuncias', () => {
    expect(getAllowedIncidentViewModes({
      incidentSettings: { isResponsible: true, receberIncidentes: false, receberDenuncias: true },
    })).toEqual(['denuncias'])
  })

  it('retorna [] quando user não tem nenhum tipo marcado (sem fallback)', () => {
    expect(getAllowedIncidentViewModes(coordComum)).toEqual([])
    expect(getAllowedIncidentViewModes(colaboradorComum)).toEqual([])
  })

  it('responsável Inc:ON Den:OFF → apenas incidentes', () => {
    expect(getAllowedIncidentViewModes(responsavelIncOnly)).toEqual(['incidentes'])
  })

  it('responsável Inc:OFF Den:ON → apenas denuncias', () => {
    expect(getAllowedIncidentViewModes(responsavelDenOnly)).toEqual(['denuncias'])
  })

  it('responsável Inc:OFF Den:OFF → [] (edge case)', () => {
    expect(getAllowedIncidentViewModes(responsavelBothOff)).toEqual([])
  })
})

// ============================================================================
// MATRIZ DE CENÁRIOS (alinha com a tabela do release notes do bug-fix)
// ============================================================================

// ============================================================================
// canAccessIncidenteGestao — guard granular para página incidente-gestao
// ============================================================================

describe('canAccessIncidenteGestao (guard granular incidentes)', () => {
  it('admin pleno: sempre permitido', () => {
    expect(canAccessIncidenteGestao(adminPleno)).toBe(true)
  })

  it('responsável com Inc:ON → permitido', () => {
    expect(canAccessIncidenteGestao(responsavelIncOnly)).toBe(true)
    expect(canAccessIncidenteGestao(responsavelPuro)).toBe(true)
  })

  it('responsável com Inc:OFF Den:ON → BLOQUEADO', () => {
    expect(canAccessIncidenteGestao(responsavelDenOnly)).toBe(false)
  })

  it('responsável com ambos OFF → BLOQUEADO', () => {
    expect(canAccessIncidenteGestao(responsavelBothOff)).toBe(false)
  })

  it('coordenador sem isResponsible → BLOQUEADO', () => {
    expect(canAccessIncidenteGestao(coordComum)).toBe(false)
  })

  it('coordenador + responsável com Inc:ON → permitido', () => {
    expect(canAccessIncidenteGestao(coordResponsavel)).toBe(true)
  })

  it('residencia-edit → BLOQUEADO', () => {
    expect(canAccessIncidenteGestao(residenciaEdit)).toBe(false)
  })

  it('colaborador comum → BLOQUEADO', () => {
    expect(canAccessIncidenteGestao(colaboradorComum)).toBe(false)
  })

  it('null → BLOQUEADO', () => {
    expect(canAccessIncidenteGestao(null)).toBe(false)
  })
})

// ============================================================================
// canAccessDenunciaGestao — guard granular para página denuncia-gestao
// ============================================================================

describe('canAccessDenunciaGestao (guard granular denúncias)', () => {
  it('admin pleno: sempre permitido', () => {
    expect(canAccessDenunciaGestao(adminPleno)).toBe(true)
  })

  it('responsável com Den:ON → permitido', () => {
    expect(canAccessDenunciaGestao(responsavelDenOnly)).toBe(true)
    expect(canAccessDenunciaGestao(responsavelPuro)).toBe(true)
  })

  it('responsável com Inc:ON Den:OFF → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(responsavelIncOnly)).toBe(false)
  })

  it('responsável com ambos OFF → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(responsavelBothOff)).toBe(false)
  })

  it('coordenador sem isResponsible → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(coordComum)).toBe(false)
  })

  it('coordenador + responsável com Den:OFF → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(coordResponsavel)).toBe(false)
  })

  it('residencia-edit → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(residenciaEdit)).toBe(false)
  })

  it('tec-enf-edit → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(tecEnfEdit)).toBe(false)
  })

  it('null → BLOQUEADO', () => {
    expect(canAccessDenunciaGestao(null)).toBe(false)
  })
})

// ============================================================================
// SIDEBAR RENDERING — confirma que ManagementLayout filtra corretamente
// Replica a lógica de filteredNavItems de ManagementLayout.jsx (lines 381-395)
// ============================================================================

const NAVIGATION_ITEMS = [
  { id: 'usuarios-group', label: 'Usuarios', subItems: [
    { id: 'usuarios', label: 'Usuarios' }, { id: 'cargos', label: 'Cargos' },
    { id: 'emails', label: 'Emails' }, { id: 'auditLog', label: 'Auditorias' },
  ]},
  { id: 'documentos', label: 'Documentos' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'incidentes', label: 'Incidentes' },
  { id: 'residencia', label: 'Residencia' },
  { id: 'educacao', label: 'Educacao' },
  { id: 'funcionarios', label: 'Funcionarios' },
  { id: 'painel-group', label: 'Painel', subItems: [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'infraestrutura', label: 'Infraestrutura' },
    { id: 'lgpd', label: 'LGPD' }, { id: 'conflitos', label: 'Conflitos' },
    { id: 'indicadores', label: 'Indicadores' }, { id: 'planosAcao', label: 'Planos de Acao' },
    { id: 'apiTokens', label: 'API Tokens' },
  ]},
]

function getFilteredNavLabels(visibleSections) {
  if (!visibleSections) return null
  return NAVIGATION_ITEMS.reduce((acc, item) => {
    if (item.subItems?.length) {
      const vis = item.subItems.filter(s => visibleSections.includes(s.id))
      if (vis.length > 0) acc.push(...vis.map(s => s.label))
    } else if (visibleSections.includes(item.id)) {
      acc.push(item.label)
    }
    return acc
  }, [])
}

describe('Sidebar rendering — usuários com permissão única veem APENAS sua seção', () => {
  it('residencia-edit: vê SOMENTE "Residencia"', () => {
    const sections = getVisibleCentroGestaoSections(residenciaEdit)
    const navLabels = getFilteredNavLabels(sections)
    expect(navLabels).toEqual(['Residencia'])
  })

  it('tec-enf-edit: vê SOMENTE "Funcionarios"', () => {
    const sections = getVisibleCentroGestaoSections(tecEnfEdit)
    const navLabels = getFilteredNavLabels(sections)
    expect(navLabels).toEqual(['Funcionarios'])
  })

  it('responsável Inc-only: vê SOMENTE "Incidentes"', () => {
    const sections = getVisibleCentroGestaoSections(responsavelIncOnly)
    const navLabels = getFilteredNavLabels(sections)
    expect(navLabels).toEqual(['Incidentes'])
  })

  it('responsável Den-only: vê SOMENTE "Incidentes"', () => {
    const sections = getVisibleCentroGestaoSections(responsavelDenOnly)
    const navLabels = getFilteredNavLabels(sections)
    expect(navLabels).toEqual(['Incidentes'])
  })

  it('colaborador comum: vê NENHUMA seção', () => {
    const sections = getVisibleCentroGestaoSections(colaboradorComum)
    const navLabels = getFilteredNavLabels(sections)
    expect(navLabels).toEqual([])
  })

  it('coordenador sem resp: vê tudo EXCETO Incidentes, Conflitos, API Tokens', () => {
    const sections = getVisibleCentroGestaoSections(coordComum)
    const navLabels = getFilteredNavLabels(sections)
    expect(navLabels).not.toContain('Incidentes')
    expect(navLabels).not.toContain('Conflitos')
    expect(navLabels).not.toContain('API Tokens')
    expect(navLabels).toContain('Usuarios')
    expect(navLabels).toContain('Documentos')
    expect(navLabels).toContain('Residencia')
  })

  it('admin pleno: retorna null → ManagementLayout mostra TODAS as seções', () => {
    const sections = getVisibleCentroGestaoSections(adminPleno)
    expect(sections).toBeNull()
    expect(getFilteredNavLabels(sections)).toBeNull()
  })

  it('NUNCA mostra seções não-permitidas para perfis restritos', () => {
    const restrictedProfiles = [residenciaEdit, tecEnfEdit, responsavelIncOnly, responsavelDenOnly, responsavelBothOff]
    const allSections = ['Usuarios', 'Cargos', 'Emails', 'Auditorias', 'Documentos', 'Comunicados', 'Educacao', 'Dashboard', 'Infraestrutura', 'LGPD', 'Conflitos', 'Indicadores', 'Planos de Acao', 'API Tokens']

    for (const profile of restrictedProfiles) {
      const sections = getVisibleCentroGestaoSections(profile)
      const navLabels = getFilteredNavLabels(sections)
      for (const forbidden of allSections) {
        expect(navLabels).not.toContain(forbidden)
      }
    }
  })
})

// ============================================================================
// MATRIZ DE CENÁRIOS COMPLETA (12 perfis × 6 verificações)
// ============================================================================

describe('MATRIZ — política de acesso Centro de Gestão > Incidentes', () => {
  const cases = [
    { name: 'admin pleno',             user: adminPleno,          canCG: true,  sections: null,           viewModes: ['incidentes','denuncias'], incGestao: true,  denGestao: true },
    { name: 'coordenador comum',       user: coordComum,          canCG: true,  sections: 'no-incidentes', viewModes: [],                        incGestao: false, denGestao: false },
    { name: 'coordenador + resp.',     user: coordResponsavel,    canCG: true,  sections: 'has-incidentes', viewModes: ['incidentes'],            incGestao: true,  denGestao: false },
    { name: 'responsável ambos',       user: responsavelPuro,     canCG: true,  sections: ['incidentes'],  viewModes: ['incidentes','denuncias'], incGestao: true,  denGestao: true },
    { name: 'responsável Inc-only',    user: responsavelIncOnly,  canCG: true,  sections: ['incidentes'],  viewModes: ['incidentes'],            incGestao: true,  denGestao: false },
    { name: 'responsável Den-only',    user: responsavelDenOnly,  canCG: true,  sections: ['incidentes'],  viewModes: ['denuncias'],             incGestao: false, denGestao: true },
    { name: 'responsável both-off',    user: responsavelBothOff,  canCG: true,  sections: ['incidentes'],  viewModes: [],                        incGestao: false, denGestao: false },
    { name: 'residencia-edit',         user: residenciaEdit,      canCG: true,  sections: ['residencia'],  viewModes: [],                        incGestao: false, denGestao: false },
    { name: 'tec-enf-edit',            user: tecEnfEdit,          canCG: true,  sections: ['funcionarios'], viewModes: [],                       incGestao: false, denGestao: false },
    { name: 'colaborador comum',       user: colaboradorComum,    canCG: false, sections: [],              viewModes: [],                        incGestao: false, denGestao: false },
  ]

  cases.forEach(({ name, user, canCG, sections, viewModes, incGestao, denGestao }) => {
    describe(`perfil: ${name}`, () => {
      it(`entrada CG: ${canCG ? 'OK' : 'BLOQUEADO'}`, () => {
        expect(canAccessCentroGestao(user)).toBe(canCG)
      })

      it(`seções visíveis corretas`, () => {
        const result = getVisibleCentroGestaoSections(user)
        if (sections === null) {
          expect(result).toBeNull()
        } else if (sections === 'no-incidentes') {
          expect(result).not.toBeNull()
          expect(result).not.toContain('incidentes')
        } else if (sections === 'has-incidentes') {
          expect(result).not.toBeNull()
          expect(result).toContain('incidentes')
        } else {
          expect(result).toEqual(sections)
        }
      })

      it(`viewModes: ${JSON.stringify(viewModes)}`, () => {
        expect(getAllowedIncidentViewModes(user)).toEqual(viewModes)
      })

      it(`incidente-gestao: ${incGestao ? 'OK' : 'BLOQUEADO'}`, () => {
        expect(canAccessIncidenteGestao(user)).toBe(incGestao)
      })

      it(`denuncia-gestao: ${denGestao ? 'OK' : 'BLOQUEADO'}`, () => {
        expect(canAccessDenunciaGestao(user)).toBe(denGestao)
      })
    })
  })
})
