/**
 * supabaseDocumentService — Approval workflow tests (Sprint 20 Stream 1.1)
 *
 * Cobre:
 *  - submitApproval (action=approved/rejected, flag OFF → sem hash, default path)
 *  - submitApproval audit fields (approver_id, comment, decided_at)
 *  - submitApproval lança quando insert falha
 *  - getMyPendingApprovals (filtro approver_id + action=pending)
 *  - setApprovalWorkflow (update doc.approval_workflow + insert pending rows)
 *  - getApprovalProgress (ordena por step_order)
 *  - setMultiStepApprovalWorkflow (delete + insert + audit)
 *  - getApprovalSteps (lê documento_approval_steps)
 *  - setLegalHold (hold=true requer reason, hold=false limpa)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    single: { data: null, error: null },
    select: { data: [], error: null },
    rpcResult: { data: null, error: null },
    lastTable: null,
    lastInsert: null,
    lastUpdate: null,
    lastEq: [],
    rpcCalls: [],
    singleQueue: [],
    selectQueue: [],
  }

  function makeChain() {
    let _resolved = false
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn((payload) => {
        state.lastInsert = payload
        return chain
      }),
      update: vi.fn((payload) => {
        state.lastUpdate = payload
        return chain
      }),
      delete: vi.fn(() => chain),
      eq: vi.fn((col, val) => {
        state.lastEq.push([col, val])
        return chain
      }),
      order: vi.fn(() => chain),
      single: vi.fn(() => {
        if (state.singleQueue.length > 0) return Promise.resolve(state.singleQueue.shift())
        return Promise.resolve(state.single)
      }),
      then: (resolve) => {
        if (_resolved) return Promise.resolve(undefined).then(resolve)
        _resolved = true
        if (state.selectQueue.length > 0) return Promise.resolve(state.selectQueue.shift()).then(resolve)
        return Promise.resolve(state.select).then(resolve)
      },
    }
    return chain
  }

  const fromMock = vi.fn((table) => {
    state.lastTable = table
    return makeChain()
  })

  const rpcMock = vi.fn((name, params) => {
    state.rpcCalls.push({ name, params })
    return Promise.resolve(state.rpcResult)
  })

  return { state, fromMock, rpcMock }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
    storage: { from: vi.fn(() => ({})) },
  },
}))

vi.mock('@/utils/featureFlags', () => ({
  isOcrEnabled: () => false,
  isBulkImportEnabled: () => false,
  isPdfaEnabled: () => false,
  isHashSignatureEnabled: () => false,
  isWatermarkEnabled: () => false,
  isRetentionEnabled: () => false,
  isConfidentialityEnabled: () => false,
  isMultiStepApprovalEnabled: () => true,
}))

vi.mock('@/utils/offlineQueue', () => ({ enqueue: vi.fn() }))
vi.mock('@/services/offlineQueueProcessor', () => ({ registerHandler: vi.fn() }))
vi.mock('@/services/conflictReplayRegistry', () => ({ registerReplayHandler: vi.fn() }))

const { default: svc } = await import('@/services/supabaseDocumentService')

const USER = { userId: 'u-aprov', userName: 'Dr. Aprovador', userEmail: 'a@anest.org' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.single = { data: null, error: null }
  mocks.state.select = { data: [], error: null }
  mocks.state.rpcResult = { data: null, error: null }
  mocks.state.lastTable = null
  mocks.state.lastInsert = null
  mocks.state.lastUpdate = null
  mocks.state.lastEq = []
  mocks.state.rpcCalls = []
  mocks.state.singleQueue = []
  mocks.state.selectQueue = []
})

describe('supabaseDocumentService — Approval', () => {
  describe('submitApproval', () => {
    it('insere aprovação com action=approved + audit log approved', async () => {
      mocks.state.singleQueue = [
        {
          data: {
            id: 'apr-1',
            documento_id: 'd1',
            approver_id: 'u-aprov',
            action: 'approved',
            comment: 'OK',
            decided_at: '2026-05-13T10:00:00Z',
          },
          error: null,
        },
      ]

      const result = await svc.submitApproval('d1', 'approved', { ...USER, comment: 'OK' })

      expect(result.id).toBe('apr-1')
      expect(result.action).toBe('approved')
      expect(mocks.state.lastInsert.documento_id).toBe('d1')
      expect(mocks.state.lastInsert.approver_id).toBe('u-aprov')
      expect(mocks.state.lastInsert.comment).toBe('OK')
      expect(mocks.state.lastInsert.decided_at).toBeTruthy()
      // audit log com action=approved
      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'approved')
      expect(logged).toBeTruthy()
    })

    it('insere aprovação com action=rejected → audit log rejected', async () => {
      mocks.state.singleQueue = [
        { data: { id: 'apr-2', action: 'rejected' }, error: null },
      ]

      await svc.submitApproval('d1', 'rejected', { ...USER, comment: 'Falta secção 3' })

      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'rejected')
      expect(logged).toBeTruthy()
    })

    it('lança quando insert falha', async () => {
      mocks.state.singleQueue = [{ data: null, error: { message: 'PG: rls' } }]
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.submitApproval('d1', 'approved', USER)).rejects.toThrow(/submitApproval/)

      spy.mockRestore()
    })
  })

  describe('getMyPendingApprovals', () => {
    it('filtra por approver_id + action=pending', async () => {
      mocks.state.select = {
        data: [{ id: 'apr-1', approver_id: 'u-aprov', action: 'pending', documentos: { id: 'd1' } }],
        error: null,
      }

      const result = await svc.getMyPendingApprovals('u-aprov')

      expect(result).toHaveLength(1)
      expect(mocks.state.lastEq).toContainEqual(['approver_id', 'u-aprov'])
      expect(mocks.state.lastEq).toContainEqual(['action', 'pending'])
    })
  })

  describe('setApprovalWorkflow', () => {
    it('atualiza approval_workflow JSON + insere 3 pending rows com step_order correto', async () => {
      // 1ª chamada: from documentos.update → select null pelo then()
      // 2ª chamada: from aprovacoes.insert → select retornará data com rows
      mocks.state.selectQueue = [
        { data: null, error: null }, // update doc
        {
          data: [
            { id: 'a1', step_order: 0, action: 'pending' },
            { id: 'a2', step_order: 1, action: 'pending' },
            { id: 'a3', step_order: 2, action: 'pending' },
          ],
          error: null,
        },
      ]

      const approvers = [
        { userId: 'u-1', userName: 'A', role: 'med' },
        { userId: 'u-2', userName: 'B', role: 'chefe' },
        { userId: 'u-3', userName: 'C', role: 'direcao' },
      ]

      const result = await svc.setApprovalWorkflow('d1', approvers, USER)

      expect(result).toHaveLength(3)
      // Verifica que approval_workflow foi montado corretamente em algum update
      // (não temos sequência fácil — verificamos o que ficou em lastUpdate ou lastInsert)
      expect(mocks.state.lastInsert).toBeInstanceOf(Array)
      expect(mocks.state.lastInsert[0].step_order).toBe(0)
      expect(mocks.state.lastInsert[2].step_order).toBe(2)
      // audit
      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'approval_workflow_set')
      expect(logged).toBeTruthy()
      expect(logged.params.p_changes.approvers).toBe(3)
    })

    it('lança quando update documentos falha', async () => {
      mocks.state.selectQueue = [{ data: null, error: { message: 'rls' } }]
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.setApprovalWorkflow('d1', [{ userId: 'u-1', userName: 'A', role: 'r' }], USER))
        .rejects.toThrow(/setApprovalWorkflow/)

      spy.mockRestore()
    })
  })

  describe('getApprovalProgress', () => {
    it('retorna lista ordenada por step_order em camelCase', async () => {
      mocks.state.select = {
        data: [
          { id: 'a1', step_order: 0, approver_id: 'u-1' },
          { id: 'a2', step_order: 1, approver_id: 'u-2' },
        ],
        error: null,
      }

      const result = await svc.getApprovalProgress('d1')

      expect(result).toHaveLength(2)
      expect(result[0].stepOrder).toBe(0)
      expect(result[0].approverId).toBe('u-1')
      expect(mocks.state.lastEq).toContainEqual(['documento_id', 'd1'])
    })
  })

  describe('setMultiStepApprovalWorkflow', () => {
    it('apaga steps + insere novos + grava audit', async () => {
      mocks.state.selectQueue = [
        { data: null, error: null }, // delete
        { data: null, error: null }, // insert
      ]

      await svc.setMultiStepApprovalWorkflow(
        'd1',
        [
          { mode: 'sequential', approverIds: ['u-1', 'u-2'], deadlineDays: 7 },
          { mode: 'parallel', approverIds: ['u-3', 'u-4'] },
        ],
        USER
      )

      // último insert = array de steps
      expect(Array.isArray(mocks.state.lastInsert)).toBe(true)
      expect(mocks.state.lastInsert).toHaveLength(2)
      expect(mocks.state.lastInsert[0].mode).toBe('sequential')
      expect(mocks.state.lastInsert[0].deadline_days).toBe(7)
      expect(mocks.state.lastInsert[1].deadline_days).toBeNull()
      // audit
      const logged = mocks.state.rpcCalls.find(
        (c) => c.params?.p_action === 'approval_workflow_set' && c.params?.p_changes?.multiStep === true
      )
      expect(logged).toBeTruthy()
      expect(logged.params.p_changes.stepCount).toBe(2)
    })

    it('aceita steps vazio (limpa workflow)', async () => {
      mocks.state.selectQueue = [{ data: null, error: null }] // só delete

      await svc.setMultiStepApprovalWorkflow('d1', [], USER)

      // insert não deve ter sido chamado
      expect(mocks.state.lastInsert).toBeNull()
      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'approval_workflow_set')
      expect(logged.params.p_changes.stepCount).toBe(0)
    })

    it('lança quando delete falha', async () => {
      mocks.state.selectQueue = [{ data: null, error: { message: 'rls denied' } }]
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.setMultiStepApprovalWorkflow('d1', [{ mode: 'parallel', approverIds: [] }], USER))
        .rejects.toThrow(/setMultiStepApprovalWorkflow/)

      spy.mockRestore()
    })
  })

  describe('getApprovalSteps', () => {
    it('retorna steps ordenados em camelCase', async () => {
      mocks.state.select = {
        data: [
          { id: 's1', step_order: 0, mode: 'sequential', approver_ids: ['u-1'] },
          { id: 's2', step_order: 1, mode: 'parallel', approver_ids: ['u-2', 'u-3'] },
        ],
        error: null,
      }

      const result = await svc.getApprovalSteps('d1')

      expect(result).toHaveLength(2)
      expect(result[0].stepOrder).toBe(0)
      expect(result[1].mode).toBe('parallel')
    })
  })

  describe('setLegalHold', () => {
    it('aplica hold=true + grava reason + audit legal_hold_set', async () => {
      mocks.state.single = {
        data: {
          id: 'd1',
          legal_hold: true,
          legal_hold_reason: 'Processo judicial 123/2026',
        },
        error: null,
      }

      const result = await svc.setLegalHold('d1', 'Processo judicial 123/2026', USER)

      expect(result.legalHold).toBe(true)
      expect(mocks.state.lastUpdate.legal_hold).toBe(true)
      expect(mocks.state.lastUpdate.legal_hold_reason).toBe('Processo judicial 123/2026')
      expect(mocks.state.lastUpdate.legal_hold_set_by).toBe('u-aprov')
      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'legal_hold_set')
      expect(logged).toBeTruthy()
    })

    it('remove hold quando options.hold=false', async () => {
      mocks.state.single = { data: { id: 'd1', legal_hold: false }, error: null }

      await svc.setLegalHold('d1', null, USER, { hold: false })

      expect(mocks.state.lastUpdate.legal_hold).toBe(false)
      expect(mocks.state.lastUpdate.legal_hold_reason).toBeNull()
      expect(mocks.state.lastUpdate.legal_hold_set_at).toBeNull()
      const logged = mocks.state.rpcCalls.find((c) => c.params?.p_action === 'legal_hold_released')
      expect(logged).toBeTruthy()
    })

    it('lança quando hold=true e reason está vazio', async () => {
      await expect(svc.setLegalHold('d1', '   ', USER)).rejects.toThrow(/motivo é obrigatório/)
      await expect(svc.setLegalHold('d1', '', USER)).rejects.toThrow(/motivo é obrigatório/)
    })
  })
})
