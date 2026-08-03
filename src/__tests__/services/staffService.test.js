import { beforeEach, describe, expect, it, vi } from 'vitest'
import { doc, getDoc, setDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collectionName, id) => ({ collection: collectionName, id })),
  getDoc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
}))

vi.mock('../../config/firebase', () => ({ db: {} }))

vi.mock('../../services/firestoreSubscriptionHelper', () => ({
  createFirestoreSubscription: vi.fn((ref, handlers, options) => {
    globalThis._lastStaffSub = { ref, handlers, options }
    return {
      cleanup: vi.fn(() => { globalThis._lastStaffSub = null }),
    }
  }),
}))

import {
  getLegacyStaffMedicalLeaves,
  getStaff,
  initializeStaffData,
  subscribeStaff,
  updateStaff,
} from '../../services/staffService'

function realStaff(overrides = {}) {
  return {
    hospitais: {
      hro: [{ nome: 'Ana', turno: '07:00-13:00', status: 'ativa' }],
      unimed: [],
      materno: [],
      ferias: [],
      atestado: [],
    },
    consultorio: {
      volanFinanceiro: [],
      administrativo: [],
      recepcao: [{ nome: 'Beatriz', turno: '08:00-17:00', status: 'ativa' }],
      telefoneWhatsapp: [],
      financeiro: [],
      enfermagemQmentum: [],
      ferias: [],
      atestado: [],
    },
    staffCatalog: ['Ana', 'Beatriz'],
    hospitaisCardData: '2026-09-11',
    hospitaisCardTurno: 'manha',
    ...overrides,
  }
}

function staffWithLegacyMedicalLeaves() {
  const staff = realStaff()
  staff.hospitais.atestado = [{
    nome: 'Maria Sensivel',
    turno: '03/08 - 09/08',
    status: 'atestado',
  }]
  staff.consultorio.atestado = [{
    nome: 'Joana Sensivel',
    turno: 'A partir de 10/08',
    status: 'atestado',
  }]
  return staff
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis._lastStaffSub = null
  setDoc.mockResolvedValue(undefined)
})

describe('staffService', () => {
  describe('getStaff', () => {
    it('retorna a escala no schema real sem secoes ou detalhes medicos publicos', async () => {
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => staffWithLegacyMedicalLeaves(),
      })

      const result = await getStaff()

      expect(result.error).toBeNull()
      expect(result.staff.hospitais.hro).toEqual([
        { nome: 'Ana', turno: '07:00-13:00', status: 'ativa' },
      ])
      expect(result.staff.consultorio.recepcao).toEqual([
        { nome: 'Beatriz', turno: '08:00-17:00', status: 'ativa' },
      ])
      expect(result.staff.hospitais).not.toHaveProperty('atestado')
      expect(result.staff.consultorio).not.toHaveProperty('atestado')
      expect(result.staff.hospitais.indisponivel).toEqual([
        { nome: 'ATESTADO', status: 'indisponivel' },
      ])
      expect(result.staff.consultorio.indisponivel).toEqual([
        { nome: 'ATESTADO', status: 'indisponivel' },
      ])
      expect(JSON.stringify(result.staff)).not.toContain('Maria Sensivel')
      expect(JSON.stringify(result.staff)).not.toContain('Joana Sensivel')
      expect(JSON.stringify(result.staff)).not.toContain('03/08 - 09/08')
      expect(doc).toHaveBeenCalledWith({}, 'staff', 'schedule')
    })

    it('nao inclui o legado sensivel no envelope da leitura publica', async () => {
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => staffWithLegacyMedicalLeaves(),
      })

      const result = await getStaff()

      expect(result).not.toHaveProperty('legacyMedicalLeaves')
    })

    it('le o legado somente pelo caminho transitorio de migracao privada', async () => {
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => staffWithLegacyMedicalLeaves(),
      })

      const result = await getLegacyStaffMedicalLeaves()

      expect(result.error).toBeNull()
      expect(result.leaves).toEqual([
        expect.objectContaining({
          scope: 'hospitais',
          employeeName: 'Maria Sensivel',
          legacyRange: '03/08 - 09/08',
          source: 'legacy',
          requiresDateConfirmation: true,
        }),
        expect.objectContaining({
          scope: 'consultorio',
          employeeName: 'Joana Sensivel',
          legacyRange: 'A partir de 10/08',
          source: 'legacy',
          requiresDateConfirmation: true,
        }),
      ])
    })

    it('retorna staff nulo quando o documento nao existe', async () => {
      getDoc.mockResolvedValueOnce({ exists: () => false })

      await expect(getStaff()).resolves.toEqual({ staff: null, error: null })
    })

    it('retorna erro quando a leitura falha', async () => {
      getDoc.mockRejectedValueOnce(new Error('Network offline'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(getStaff()).resolves.toEqual({ staff: null, error: 'Network offline' })
      consoleSpy.mockRestore()
    })
  })

  describe('updateStaff', () => {
    it('grava somente o schema publico e inclui o UID real na auditoria', async () => {
      const staffData = realStaff()
      staffData.hospitais.indisponivel = [
        { nome: 'ATESTADO', status: 'indisponivel' },
      ]

      const result = await updateStaff(staffData, 'firebase-uid-42')

      expect(result).toMatchObject({ success: true, error: null })
      expect(setDoc).toHaveBeenCalledTimes(1)
      const written = setDoc.mock.calls[0][1]
      expect(written.hospitais).not.toHaveProperty('atestado')
      expect(written.consultorio).not.toHaveProperty('atestado')
      expect(written.hospitais.indisponivel).toEqual([
        { nome: 'ATESTADO', status: 'indisponivel' },
      ])
      expect(written.updatedBy).toBe('firebase-uid-42')
      expect(written.updatedAt).toEqual({ kind: 'serverTimestamp' })
      expect(written.revision).toBe(1)
      expect(result.staff.revision).toBe(1)
      expect(result.staff).toEqual(expect.objectContaining({
        hospitais: expect.any(Object),
        consultorio: expect.any(Object),
      }))
    })

    it('incrementa a revision existente em toda escrita publica', async () => {
      const result = await updateStaff(realStaff({ revision: 7 }), 'firebase-uid-42')

      expect(result.success).toBe(true)
      expect(result.staff.revision).toBe(8)
      expect(setDoc.mock.calls[0][1].revision).toBe(8)
    })

    it('recusa dados medicos no caminho publico sem fazer escrita parcial', async () => {
      const result = await updateStaff(staffWithLegacyMedicalLeaves(), 'firebase-uid-42')

      expect(result).toEqual({
        success: false,
        error: 'Atestados devem ser salvos pelo fluxo privado de afastamentos.',
      })
      expect(setDoc).not.toHaveBeenCalled()
    })

    it('propaga erro de escrita', async () => {
      setDoc.mockRejectedValueOnce(new Error('Permission denied'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await updateStaff(realStaff(), 'firebase-uid-1')

      expect(result).toEqual({ success: false, error: 'Permission denied' })
      consoleSpy.mockRestore()
    })
  })

  describe('subscribeStaff', () => {
    it('anonimiza snapshot existente antes de notificar o consumidor', () => {
      const callback = vi.fn()
      subscribeStaff(callback)

      globalThis._lastStaffSub.handlers.onData({
        exists: () => true,
        data: () => staffWithLegacyMedicalLeaves(),
      })

      const payload = callback.mock.calls[0][0]
      expect(payload.error).toBeNull()
      expect(payload.staff.hospitais).not.toHaveProperty('atestado')
      expect(payload.staff.consultorio).not.toHaveProperty('atestado')
      expect(payload.staff.hospitais.indisponivel[0]).toEqual({
        nome: 'ATESTADO',
        status: 'indisponivel',
      })
      expect(JSON.stringify(payload.staff)).not.toContain('Maria Sensivel')
    })

    it('notifica staff nulo para snapshot ausente', () => {
      const callback = vi.fn()
      subscribeStaff(callback)

      globalThis._lastStaffSub.handlers.onData({ exists: () => false })

      expect(callback).toHaveBeenCalledWith({ staff: null, error: null })
    })

    it('propaga erro do listener e o callback de status', () => {
      const callback = vi.fn()
      const onStatusChange = vi.fn()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      subscribeStaff(callback, { onStatusChange })

      expect(globalThis._lastStaffSub.options.onStatusChange).toBe(onStatusChange)
      globalThis._lastStaffSub.handlers.onError(new Error('listener-fail'))
      expect(callback).toHaveBeenCalledWith({ staff: null, error: 'listener-fail' })
      consoleSpy.mockRestore()
    })
  })

  describe('initializeStaffData', () => {
    it('inicializa documento ausente sem persistir atestados legados', async () => {
      getDoc.mockResolvedValueOnce({ exists: () => false })

      const result = await initializeStaffData(staffWithLegacyMedicalLeaves(), 'firebase-uid-admin')

      expect(result).toEqual({ success: true, error: null })
      const written = setDoc.mock.calls[0][1]
      expect(written.hospitais).not.toHaveProperty('atestado')
      expect(written.consultorio).not.toHaveProperty('atestado')
      expect(written.hospitais.indisponivel).toEqual([
        { nome: 'ATESTADO', status: 'indisponivel' },
      ])
      expect(written.consultorio.indisponivel).toEqual([
        { nome: 'ATESTADO', status: 'indisponivel' },
      ])
      expect(written.updatedBy).toBe('firebase-uid-admin')
    })

    it('nao sobrescreve documento existente', async () => {
      getDoc.mockResolvedValueOnce({ exists: () => true })

      await expect(initializeStaffData(realStaff(), 'uid')).resolves.toEqual({
        success: true,
        error: null,
      })
      expect(setDoc).not.toHaveBeenCalled()
    })

    it('propaga erro de inicializacao', async () => {
      getDoc.mockRejectedValueOnce(new Error('Read failure'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(initializeStaffData(realStaff(), 'uid')).resolves.toEqual({
        success: false,
        error: 'Read failure',
      })
      consoleSpy.mockRestore()
    })
  })
})
