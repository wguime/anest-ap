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
import {
  isFullAdmin,
  isCoordenador,
  isIncidentResponsible,
  canAccessCentroGestao,
  canAccessIncidentManagement,
  getVisibleCentroGestaoSections,
  getAllowedIncidentViewModes,
} from '../../../pages/management/utils/incidentAccess'

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

  it('fallback para ["incidentes"] quando user não tem configuração', () => {
    expect(getAllowedIncidentViewModes(coordComum)).toEqual(['incidentes'])
    expect(getAllowedIncidentViewModes(colaboradorComum)).toEqual(['incidentes'])
  })
})

// ============================================================================
// MATRIZ DE CENÁRIOS (alinha com a tabela do release notes do bug-fix)
// ============================================================================

describe('MATRIZ — política de acesso Centro de Gestão > Incidentes', () => {
  const cases = [
    { name: 'admin pleno',          user: adminPleno,         canCenter: true,  canIncident: true,  showsIncidentTab: 'sempre' },
    { name: 'coordenador comum',    user: coordComum,         canCenter: true,  canIncident: false, showsIncidentTab: 'nunca' },
    { name: 'coordenador + resp.',  user: coordResponsavel,   canCenter: true,  canIncident: true,  showsIncidentTab: 'sim' },
    { name: 'responsável puro',     user: responsavelPuro,    canCenter: true,  canIncident: true,  showsIncidentTab: 'sim (única)' },
    { name: 'residencia-edit',      user: residenciaEdit,     canCenter: true,  canIncident: false, showsIncidentTab: 'nunca' },
    { name: 'colaborador comum',    user: colaboradorComum,   canCenter: false, canIncident: false, showsIncidentTab: 'nunca' },
  ]

  cases.forEach(({ name, user, canCenter, canIncident, showsIncidentTab }) => {
    describe(`perfil: ${name}`, () => {
      it(`entrada em Centro de Gestão: ${canCenter ? 'permitida' : 'BLOQUEADA'}`, () => {
        expect(canAccessCentroGestao(user)).toBe(canCenter)
      })

      it(`acesso a páginas de gestão de incidentes: ${canIncident ? 'permitido' : 'BLOQUEADO'}`, () => {
        expect(canAccessIncidentManagement(user)).toBe(canIncident)
      })

      it(`aba Incidentes no sidebar: ${showsIncidentTab}`, () => {
        const sections = getVisibleCentroGestaoSections(user)
        if (showsIncidentTab === 'sempre') {
          expect(sections).toBeNull() // admin vê tudo
        } else if (showsIncidentTab === 'nunca') {
          if (sections === null) {
            // não deveria acontecer para estes perfis
            throw new Error(`Inesperado: ${name} recebeu sections=null`)
          }
          expect(sections).not.toContain('incidentes')
        } else {
          expect(sections).toContain('incidentes')
        }
      })
    })
  })
})
