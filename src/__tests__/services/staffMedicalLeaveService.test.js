import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeBatch } from 'firebase/firestore'

const {
  mockBatchCommit,
  mockBatchSet,
  mockBatchUpdate,
  mockCollection,
  mockDoc,
  mockQuery,
  mockWhere,
  mockTimestampFromDate,
  serverTimestampSentinel,
} = vi.hoisted(() => ({
  mockBatchCommit: vi.fn(() => Promise.resolve()),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockCollection: vi.fn((_db, name) => ({ kind: 'collection', name })),
  mockDoc: vi.fn(),
  mockQuery: vi.fn((...parts) => ({ kind: 'query', parts })),
  mockWhere: vi.fn((...parts) => ({ kind: 'where', parts })),
  mockTimestampFromDate: vi.fn((date) => ({
    kind: 'timestamp',
    iso: date.toISOString().slice(0, 10),
    toDate: () => date,
  })),
  serverTimestampSentinel: { kind: 'serverTimestamp' },
}))

vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: mockTimestampFromDate },
  collection: mockCollection,
  doc: mockDoc,
  query: mockQuery,
  serverTimestamp: vi.fn(() => serverTimestampSentinel),
  where: mockWhere,
  writeBatch: vi.fn(() => ({
    commit: mockBatchCommit,
    set: mockBatchSet,
    update: mockBatchUpdate,
  })),
}))

vi.mock('../../config/firebase', () => ({ db: { kind: 'db' } }))

vi.mock('../../services/firestoreSubscriptionHelper', () => ({
  createFirestoreSubscription: vi.fn((ref, handlers, options) => {
    globalThis._lastStaffMedicalLeaveSub = { ref, handlers, options }
    return {
      cleanup: vi.fn(() => { globalThis._lastStaffMedicalLeaveSub = null }),
    }
  }),
}))

import {
  saveStaffWithMedicalLeaves,
  subscribeStaffMedicalLeaves,
} from '../../services/staffMedicalLeaveService'

function scheduleWithLeaves(leaves = []) {
  return {
    hospitais: {
      hro: [{ nome: 'Ana', turno: '07:00-13:00', status: 'ativa' }],
      unimed: [],
      atestado: leaves,
    },
    consultorio: {
      recepcao: [{ nome: 'Beatriz', turno: '08:00-17:00', status: 'ativa' }],
      atestado: [],
    },
    staffCatalog: ['Ana', 'Beatriz', 'Maria'],
  }
}

function currentPublicSnapshot({
  revision,
  hospitalUnavailable = 1,
  consultorioUnavailable = 0,
} = {}) {
  const staff = scheduleWithLeaves([])
  delete staff.hospitais.atestado
  delete staff.consultorio.atestado
  staff.hospitais.indisponivel = Array.from(
    { length: hospitalUnavailable },
    () => ({ nome: 'INDISPONÍVEL', status: 'indisponivel' })
  )
  staff.consultorio.indisponivel = Array.from(
    { length: consultorioUnavailable },
    () => ({ nome: 'INDISPONÍVEL', status: 'indisponivel' })
  )
  if (revision !== undefined) staff.revision = revision
  return staff
}

function formLeave(overrides = {}) {
  return {
    nome: 'Maria',
    turno: '10/09/2026-14/09/2026',
    status: 'atestado',
    startsOn: '2026-09-10',
    endsOn: '2026-09-14',
    source: 'manual',
    previousAssignment: {
      sectionKey: 'hro',
      turno: '07:00-13:00',
      funcoes: 'Centro cirurgico',
      observacao: 'nao deve ir para o documento privado',
    },
    ...overrides,
  }
}

function firestoreTimestamp(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0)
  return { toDate: () => date }
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis._lastStaffMedicalLeaveSub = null
  let autoId = 0
  mockDoc.mockImplementation((first, collectionName, id) => {
    if (first?.kind === 'collection') {
      autoId += 1
      return { kind: 'doc', collection: first.name, id: `auto-${autoId}` }
    }
    return { kind: 'doc', collection: collectionName, id }
  })
  mockBatchCommit.mockResolvedValue(undefined)
})

describe('subscribeStaffMedicalLeaves', () => {
  it('consulta somente afastamentos ativos e normaliza Timestamps para datas ISO', () => {
    const callback = vi.fn()

    subscribeStaffMedicalLeaves(callback)

    expect(mockCollection).toHaveBeenCalledWith({ kind: 'db' }, 'staffMedicalLeaves')
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active')
    globalThis._lastStaffMedicalLeaveSub.handlers.onData({
      docs: [{
        id: 'leave-1',
        data: () => ({
          scope: 'hospitais',
          employeeName: 'Maria',
          startsAt: firestoreTimestamp('2026-09-10'),
          endsAt: firestoreTimestamp('2026-09-14'),
          status: 'active',
          source: 'manual',
        }),
      }],
    })

    expect(callback).toHaveBeenCalledWith({
      leaves: [expect.objectContaining({
        id: 'leave-1',
        startsOn: '2026-09-10',
        endsOn: '2026-09-14',
      })],
      error: null,
    })
  })
})

describe('saveStaffWithMedicalLeaves', () => {
  it('salva afastamento privado e agenda publica anonima no mesmo batch com UID real', async () => {
    const staffData = scheduleWithLeaves([formLeave()])
    const currentPublicStaff = currentPublicSnapshot({
      hospitalUnavailable: 2,
      consultorioUnavailable: 1,
    })

    const result = await saveStaffWithMedicalLeaves({
      staffData,
      currentPublicStaff,
      existingLeaves: [],
      userId: 'firebase-uid-real',
      dateKey: '2026-09-11',
    })

    expect(result).toMatchObject({ success: true, error: null })
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)

    const privateWrite = mockBatchSet.mock.calls.find(([ref]) => ref.collection === 'staffMedicalLeaves')
    expect(privateWrite).toBeTruthy()
    expect(privateWrite[1]).toMatchObject({
      scope: 'hospitais',
      employeeName: 'Maria',
      kind: 'medical_leave',
      startsAt: expect.objectContaining({ kind: 'timestamp', iso: '2026-09-10' }),
      endsAt: expect.objectContaining({ kind: 'timestamp', iso: '2026-09-14' }),
      status: 'active',
      source: 'manual',
      previousAssignment: {
        sectionKey: 'hro',
        turno: '07:00-13:00',
        funcoes: 'Centro cirurgico',
      },
      createdAt: serverTimestampSentinel,
      createdBy: 'firebase-uid-real',
      updatedAt: serverTimestampSentinel,
      updatedBy: 'firebase-uid-real',
    })

    const publicWrite = mockBatchSet.mock.calls.find(([ref]) => ref.collection === 'staff')
    expect(publicWrite).toBeTruthy()
    expect(publicWrite[0]).toMatchObject({ collection: 'staff', id: 'schedule' })
    expect(publicWrite[1].hospitais).not.toHaveProperty('atestado')
    expect(publicWrite[1].consultorio).not.toHaveProperty('atestado')
    expect(publicWrite[1].hospitais.indisponivel)
      .toEqual(currentPublicStaff.hospitais.indisponivel)
    expect(publicWrite[1].consultorio.indisponivel)
      .toEqual(currentPublicStaff.consultorio.indisponivel)
    expect(publicWrite[1]).toMatchObject({
      revision: 1,
      updatedAt: serverTimestampSentinel,
      updatedBy: 'firebase-uid-real',
    })
    expect(result.staff.revision).toBe(1)

    const publicJson = JSON.stringify(publicWrite[1])
    // O catálogo pode conter o nome da funcionária; o que não pode vazar é
    // a associação desse nome a afastamento, datas ou seção médica.
    expect(publicWrite[1].staffCatalog).toContain('Maria')
    expect(publicJson).not.toContain('employeeName')
    expect(publicJson).not.toContain('atestado')
    expect(publicJson).not.toContain('startsOn')
    expect(publicJson).not.toContain('startsAt')
    expect(publicJson).not.toContain('2026-09-10')
    expect(publicJson).not.toContain('2026-09-14')
  })

  it('atualiza o afastamento mantido e cancela o removido sem apagar documentos', async () => {
    const kept = formLeave({ medicalLeaveId: 'leave-kept' })
    const existingLeaves = [
      { id: 'leave-kept', scope: 'hospitais', employeeName: 'Maria', status: 'active' },
      { id: 'leave-removed', scope: 'consultorio', employeeName: 'Joana', status: 'active' },
    ]

    const result = await saveStaffWithMedicalLeaves({
      staffData: scheduleWithLeaves([kept]),
      currentPublicStaff: currentPublicSnapshot({ revision: 3 }),
      existingLeaves,
      userId: 'firebase-uid-editor',
      dateKey: '2026-09-11',
    })

    expect(result.success).toBe(true)
    expect(mockBatchSet.mock.calls.filter(([ref]) => ref.collection === 'staffMedicalLeaves')).toHaveLength(0)

    const keptUpdate = mockBatchUpdate.mock.calls.find(([ref]) => ref.id === 'leave-kept')
    expect(keptUpdate[1]).toMatchObject({
      status: 'active',
      updatedAt: serverTimestampSentinel,
      updatedBy: 'firebase-uid-editor',
    })

    const cancelledUpdate = mockBatchUpdate.mock.calls.find(([ref]) => ref.id === 'leave-removed')
    expect(cancelledUpdate[1]).toEqual({
      status: 'cancelled',
      updatedAt: serverTimestampSentinel,
      updatedBy: 'firebase-uid-editor',
    })
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('updatePublic true cancela no privado sem restaurar no batch publico antes do trigger', async () => {
    const existingLeaves = [{
      id: 'leave-cancelled',
      scope: 'hospitais',
      employeeName: 'Maria',
      kind: 'medical_leave',
      startsAt: firestoreTimestamp('2026-09-10'),
      endsAt: firestoreTimestamp('2026-09-14'),
      startsOn: '2026-09-10',
      endsOn: '2026-09-14',
      status: 'active',
      source: 'manual',
      previousAssignment: {
        sectionKey: 'hro',
        turno: '07:00-13:00',
        funcoes: 'Centro cirurgico',
      },
    }]

    const currentPublicStaff = currentPublicSnapshot({
      revision: 8,
      hospitalUnavailable: 1,
    })
    const result = await saveStaffWithMedicalLeaves({
      staffData: scheduleWithLeaves([]),
      currentPublicStaff,
      existingLeaves,
      userId: 'firebase-uid-editor',
      dateKey: '2026-09-11',
    })

    expect(result.success).toBe(true)
    const cancelledUpdate = mockBatchUpdate.mock.calls.find(
      ([ref]) => ref.id === 'leave-cancelled'
    )
    expect(cancelledUpdate[1]).toEqual({
      status: 'cancelled',
      updatedAt: serverTimestampSentinel,
      updatedBy: 'firebase-uid-editor',
    })

    const publicWrite = mockBatchSet.mock.calls.find(([ref]) => ref.collection === 'staff')
    expect(publicWrite[1].hospitais.hro).toEqual([
      { nome: 'Ana', turno: '07:00-13:00', status: 'ativa' },
    ])
    expect(publicWrite[1].hospitais.indisponivel)
      .toEqual(currentPublicStaff.hospitais.indisponivel)
    expect(publicWrite[1].revision).toBe(9)

    const publicJson = JSON.stringify(publicWrite[1])
    expect(publicJson).not.toContain('atestado')
    expect(publicJson).not.toContain('medical_leave')
    expect(publicJson).not.toContain('employeeName')
    expect(publicJson).not.toContain('previousAssignment')
    expect(publicJson).not.toContain('startsAt')
    expect(publicJson).not.toContain('endsAt')
    expect(publicJson).not.toContain('2026-09-10')
    expect(publicJson).not.toContain('2026-09-14')
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('updatePublic false persiste somente o privado e retorna projecao publica sanitizada', async () => {
    const existingLeaves = [{
      id: 'leave-to-cancel',
      scope: 'consultorio',
      employeeName: 'Joana',
      kind: 'medical_leave',
      startsAt: firestoreTimestamp('2026-09-01'),
      endsAt: firestoreTimestamp('2026-09-30'),
      startsOn: '2026-09-01',
      endsOn: '2026-09-30',
      status: 'active',
      source: 'manual',
      previousAssignment: {
        sectionKey: 'recepcao',
        turno: '08:00-17:00',
      },
    }]

    const result = await saveStaffWithMedicalLeaves({
      staffData: scheduleWithLeaves([formLeave()]),
      existingLeaves,
      userId: 'firebase-uid-private-rh',
      dateKey: '2026-09-11',
      updatePublic: false,
    })

    expect(result.success).toBe(true)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)

    const privateCreate = mockBatchSet.mock.calls.find(
      ([ref]) => ref.collection === 'staffMedicalLeaves'
    )
    expect(privateCreate).toBeTruthy()
    expect(privateCreate[1]).toMatchObject({
      employeeName: 'Maria',
      kind: 'medical_leave',
      createdBy: 'firebase-uid-private-rh',
      updatedBy: 'firebase-uid-private-rh',
    })

    const privateCancellation = mockBatchUpdate.mock.calls.find(
      ([ref]) => ref.collection === 'staffMedicalLeaves' && ref.id === 'leave-to-cancel'
    )
    expect(privateCancellation[1]).toEqual({
      status: 'cancelled',
      updatedAt: serverTimestampSentinel,
      updatedBy: 'firebase-uid-private-rh',
    })

    expect(mockBatchSet.mock.calls.some(
      ([ref]) => ref.collection === 'staff' && ref.id === 'schedule'
    )).toBe(false)

    expect(result.staff.hospitais).not.toHaveProperty('atestado')
    expect(result.staff.consultorio).not.toHaveProperty('atestado')
    expect(result.staff.hospitais.indisponivel).toEqual([
      { nome: 'INDISPONÍVEL', status: 'indisponivel' },
    ])
    expect(result.staff.consultorio.indisponivel).toEqual([])
    expect(result.staff.consultorio.recepcao).toEqual([
      { nome: 'Beatriz', turno: '08:00-17:00', status: 'ativa' },
      { nome: 'Joana', turno: '08:00-17:00', status: 'ativa' },
    ])

    const projectionJson = JSON.stringify(result.staff)
    expect(projectionJson).not.toContain('atestado')
    expect(projectionJson).not.toContain('employeeName')
    expect(projectionJson).not.toContain('medical_leave')
    expect(projectionJson).not.toContain('previousAssignment')
    expect(projectionJson).not.toContain('startsAt')
    expect(projectionJson).not.toContain('endsAt')
    expect(projectionJson).not.toContain('2026-09-10')
    expect(projectionJson).not.toContain('2026-09-14')
  })

  it('updatePublic true incrementa a revision existente', async () => {
    const staffData = scheduleWithLeaves([formLeave()])
    staffData.revision = 99
    const currentPublicStaff = currentPublicSnapshot({ revision: 12 })

    const result = await saveStaffWithMedicalLeaves({
      staffData,
      currentPublicStaff,
      existingLeaves: [],
      userId: 'firebase-uid-real',
      dateKey: '2026-09-11',
      updatePublic: true,
    })

    const publicWrite = mockBatchSet.mock.calls.find(
      ([ref]) => ref.collection === 'staff' && ref.id === 'schedule'
    )
    expect(publicWrite[1].revision).toBe(13)
    expect(result.staff.revision).toBe(13)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('grava edicao operacional e privada no mesmo batch preservando placeholders server-owned', async () => {
    const staffData = scheduleWithLeaves([formLeave()])
    staffData.hospitais.hro = [{
      nome: 'Ana',
      turno: '13:00-19:00',
      status: 'ativa',
      observacao: 'Turno operacional atualizado',
    }]
    const currentPublicStaff = currentPublicSnapshot({
      revision: 20,
      hospitalUnavailable: 2,
      consultorioUnavailable: 1,
    })

    const result = await saveStaffWithMedicalLeaves({
      staffData,
      currentPublicStaff,
      existingLeaves: [],
      userId: 'firebase-uid-combined-editor',
      dateKey: '2026-09-11',
      updatePublic: true,
    })

    expect(result.success).toBe(true)
    expect(writeBatch).toHaveBeenCalledTimes(1)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    expect(mockBatchSet).toHaveBeenCalledTimes(2)

    const privateWrite = mockBatchSet.mock.calls.find(
      ([ref]) => ref.collection === 'staffMedicalLeaves'
    )
    const publicWrite = mockBatchSet.mock.calls.find(
      ([ref]) => ref.collection === 'staff' && ref.id === 'schedule'
    )
    expect(privateWrite[1]).toMatchObject({
      employeeName: 'Maria',
      createdBy: 'firebase-uid-combined-editor',
      updatedBy: 'firebase-uid-combined-editor',
    })
    expect(publicWrite[1].hospitais.hro).toEqual(staffData.hospitais.hro)
    expect(publicWrite[1].hospitais.indisponivel)
      .toEqual(currentPublicStaff.hospitais.indisponivel)
    expect(publicWrite[1].consultorio.indisponivel)
      .toEqual(currentPublicStaff.consultorio.indisponivel)
    expect(publicWrite[1].revision).toBe(21)
    expect(publicWrite[1].updatedBy).toBe('firebase-uid-combined-editor')
  })

  it('rejeita updatePublic true sem o snapshot publico atual', async () => {
    const result = await saveStaffWithMedicalLeaves({
      staffData: scheduleWithLeaves([formLeave()]),
      existingLeaves: [],
      userId: 'firebase-uid-real',
      dateKey: '2026-09-11',
      updatePublic: true,
    })

    expect(result).toEqual({
      success: false,
      error: 'Reabra o editor para carregar a versão atual da escala.',
    })
    expect(writeBatch).not.toHaveBeenCalled()
    expect(mockBatchSet).not.toHaveBeenCalled()
    expect(mockBatchUpdate).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  it.each([
    ['sem ano confirmado', { startsOn: null, endsOn: null, source: 'legacy' }],
    ['intervalo invertido', { startsOn: '2026-09-15', endsOn: '2026-09-10' }],
    ['dia inexistente', { startsOn: '2026-02-30', endsOn: '2026-03-02' }],
  ])('rejeita datas invalidas: %s', async (_label, invalidDates) => {
    const result = await saveStaffWithMedicalLeaves({
      staffData: scheduleWithLeaves([formLeave(invalidDates)]),
      currentPublicStaff: currentPublicSnapshot(),
      existingLeaves: [],
      userId: 'firebase-uid-real',
      dateKey: '2026-09-11',
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ano|datas|intervalo/i)
    expect(mockBatchSet).not.toHaveBeenCalled()
    expect(mockBatchUpdate).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  it('propaga falha do commit sem reportar sucesso', async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error('Permission denied'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await saveStaffWithMedicalLeaves({
      staffData: scheduleWithLeaves([formLeave()]),
      currentPublicStaff: currentPublicSnapshot(),
      existingLeaves: [],
      userId: 'firebase-uid-real',
      dateKey: '2026-09-11',
    })

    expect(result).toEqual({ success: false, error: 'Permission denied' })
    consoleSpy.mockRestore()
  })
})
