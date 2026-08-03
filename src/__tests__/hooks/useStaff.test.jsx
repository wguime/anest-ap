import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const {
  authState,
  mockGetLegacyStaffMedicalLeaves,
  mockSubscribeStaff,
  mockSubscribeStaffMedicalLeaves,
  mockPublicCleanup,
  mockPrivateCleanup,
} = vi.hoisted(() => ({
  authState: {
    user: null,
    firebaseUser: { uid: 'firebase-uid-test' },
  },
  mockGetLegacyStaffMedicalLeaves: vi.fn(),
  mockSubscribeStaff: vi.fn(),
  mockSubscribeStaffMedicalLeaves: vi.fn(),
  mockPublicCleanup: vi.fn(),
  mockPrivateCleanup: vi.fn(),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => authState,
}))

vi.mock('@/services/staffService', () => ({
  getLegacyStaffMedicalLeaves: mockGetLegacyStaffMedicalLeaves,
  getStaff: vi.fn(),
  initializeStaffData: vi.fn(),
  subscribeStaff: mockSubscribeStaff,
  updateStaff: vi.fn(),
}))

vi.mock('@/services/staffMedicalLeaveService', () => ({
  saveStaffWithMedicalLeaves: vi.fn(),
  subscribeStaffMedicalLeaves: mockSubscribeStaffMedicalLeaves,
}))

import { useStaff } from '@/hooks/useStaff'

const publicStaff = {
  hospitais: { hro: [], unimed: [], materno: [], ferias: [], indisponivel: [] },
  consultorio: { recepcao: [], financeiro: [], ferias: [], indisponivel: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = {
    role: 'tecnico-enfermagem',
    permissions: { 'staff-absence-private': true },
  }
  authState.firebaseUser = { uid: 'firebase-uid-test' }
  mockSubscribeStaff.mockImplementation((callback) => {
    callback({ staff: publicStaff, error: null })
    return mockPublicCleanup
  })
  mockGetLegacyStaffMedicalLeaves.mockResolvedValue({ leaves: [], error: null })
  mockSubscribeStaffMedicalLeaves.mockImplementation((callback) => {
    callback({ leaves: [], error: null })
    return mockPrivateCleanup
  })
})

describe('useStaff — carregamento privado opt-in', () => {
  it('nao assina afastamentos privados por padrao mesmo com permissao explicita', async () => {
    const { result } = renderHook(() => useStaff())

    await waitFor(() => expect(result.current.staffLoading).toBe(false))
    expect(result.current.canManageAbsences).toBe(true)
    expect(mockSubscribeStaff).toHaveBeenCalledTimes(1)
    expect(mockSubscribeStaffMedicalLeaves).not.toHaveBeenCalled()
    expect(mockGetLegacyStaffMedicalLeaves).not.toHaveBeenCalled()
    expect(result.current.privateAbsencesReady).toBe(true)
  })

  it('nao assina o privado quando falta a permissao explicita mesmo com opt-in', async () => {
    authState.user = {
      role: 'administrador',
      isAdmin: true,
      permissions: {},
    }

    const { result } = renderHook(() => useStaff({ loadPrivateAbsences: true }))

    await waitFor(() => expect(result.current.staffLoading).toBe(false))
    expect(result.current.canManageAbsences).toBe(false)
    expect(mockSubscribeStaffMedicalLeaves).not.toHaveBeenCalled()
    expect(mockGetLegacyStaffMedicalLeaves).not.toHaveBeenCalled()
  })

  it('carrega legado e assina a colecao privada somente com opt-in e permissao', async () => {
    const { result } = renderHook(() => useStaff({ loadPrivateAbsences: true }))

    await waitFor(() => {
      expect(mockGetLegacyStaffMedicalLeaves).toHaveBeenCalledTimes(1)
      expect(mockSubscribeStaffMedicalLeaves).toHaveBeenCalledTimes(1)
      expect(result.current.privateAbsencesReady).toBe(true)
    })
    expect(result.current.canManageAbsences).toBe(true)
    expect(result.current.medicalLeavesLoading).toBe(false)
  })
})
