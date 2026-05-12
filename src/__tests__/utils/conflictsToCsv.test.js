/**
 * Sprint 15a / F6.3 closeout (A2.b) — conflictsToCsv tests.
 *
 * Cobertura:
 *  - Header sempre presente
 *  - Lista vazia → só header
 *  - Escape RFC 4180: aspas, vírgulas, quebras de linha
 *  - JSON.stringify para payload e server_state
 *  - downloadConflictsCsv aciona createElement('a').click() + revokeObjectURL
 *  - BOM UTF-8 prefixado no Blob (Excel pt-BR)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  conflictsToCsv,
  downloadConflictsCsv,
} from '@/utils/conflictsToCsv'

// Helper p/ inspecionar a primeira chamada de Blob (que recebe o array
// de partes — primeira parte é o BOM + CSV).
function lastBlobParts() {
  const calls = global.Blob.mock.calls
  return calls[calls.length - 1]?.[0]
}

describe('conflictsToCsv()', () => {
  it('inclui header canônico mesmo com lista vazia', () => {
    const csv = conflictsToCsv([])
    expect(csv).toBe(
      'id,op_id,op_string,user_name,user_id,status,created_at,resolved_by,resolved_at,resolution_notes,payload_json,server_state_json'
    )
  })

  it('aceita null/undefined sem quebrar', () => {
    const csv = conflictsToCsv(null)
    expect(csv.startsWith('id,op_id,op_string')).toBe(true)
  })

  it('serializa 3 conflitos com escapes RFC 4180 + JSON em payload/server_state', () => {
    const conflicts = [
      {
        id: 'c1',
        opId: 'op-1',
        opString: 'documento.recordAcknowledgement',
        userName: 'Alice',
        userId: 'u-1',
        status: 'pending',
        createdAt: '2026-05-12T00:00:00Z',
        resolvedBy: null,
        resolvedAt: null,
        resolutionNotes: null,
        payload: { docId: 'd-1', userId: 'u-1' },
        serverState: null,
      },
      {
        // Caso com vírgula no userName (deve ser envolvido em aspas)
        id: 'c2',
        opId: 'op-2',
        opString: 'comunicado.confirmLeitura',
        userName: 'Bob, Jr.',
        userId: 'u-2',
        status: 'resolved_manual',
        createdAt: '2026-05-12T01:00:00Z',
        resolvedBy: 'admin-1',
        resolvedAt: '2026-05-12T02:00:00Z',
        resolutionNotes: 'aplicado patch após validação',
        payload: { comunicadoId: 'com-1' },
        serverState: { status: 'lida' },
      },
      {
        // Caso com aspas duplas + quebra de linha em resolutionNotes
        id: 'c3',
        opId: 'op-3',
        opString: 'comunicado.desfazerAcao',
        userName: 'Carol "C" Doe',
        userId: 'u-3',
        status: 'dismissed',
        createdAt: '2026-05-12T03:00:00Z',
        resolvedBy: 'admin-2',
        resolvedAt: '2026-05-12T04:00:00Z',
        resolutionNotes: 'linha 1\nlinha 2',
        payload: null,
        serverState: null,
      },
    ]
    const csv = conflictsToCsv(conflicts)

    // Header presente
    expect(csv.startsWith('id,op_id,op_string')).toBe(true)

    // Row 1 — payload JSON envolvido em aspas (contém vírgula interna).
    // {"docId":"d-1","userId":"u-1"} → "{""docId"":""d-1"",""userId"":""u-1""}"
    expect(csv).toContain('"{""docId"":""d-1"",""userId"":""u-1""}"')

    // Row 2 — userName "Bob, Jr." envolvido em aspas (vírgula interna)
    expect(csv).toContain('"Bob, Jr."')

    // Row 3 — aspas duplas internas escapadas + quebra de linha embutida
    expect(csv).toContain('"Carol ""C"" Doe"')
    expect(csv).toContain('"linha 1\nlinha 2"')

    // Snapshot completo (regressão estrutural)
    expect(csv).toMatchInlineSnapshot(`
      "id,op_id,op_string,user_name,user_id,status,created_at,resolved_by,resolved_at,resolution_notes,payload_json,server_state_json
      c1,op-1,documento.recordAcknowledgement,Alice,u-1,pending,2026-05-12T00:00:00Z,,,,"{""docId"":""d-1"",""userId"":""u-1""}",
      c2,op-2,comunicado.confirmLeitura,"Bob, Jr.",u-2,resolved_manual,2026-05-12T01:00:00Z,admin-1,2026-05-12T02:00:00Z,aplicado patch após validação,"{""comunicadoId"":""com-1""}","{""status"":""lida""}"
      c3,op-3,comunicado.desfazerAcao,"Carol ""C"" Doe",u-3,dismissed,2026-05-12T03:00:00Z,admin-2,2026-05-12T04:00:00Z,"linha 1
      linha 2",,"
    `)
  })
})

describe('downloadConflictsCsv()', () => {
  let createObjectURLSpy
  let revokeObjectURLSpy
  let blobInstances
  const RealBlob = global.Blob

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    revokeObjectURLSpy = vi.fn()
    global.URL.createObjectURL = createObjectURLSpy
    global.URL.revokeObjectURL = revokeObjectURLSpy

    // Wrappa Blob como classe (precisa ser constructible com `new`).
    // Captura parts/opts em `blobInstances` p/ asserts.
    blobInstances = []
    global.Blob = class MockBlob extends RealBlob {
      constructor(parts, opts) {
        super(parts, opts)
        blobInstances.push({ parts, opts })
      }
    }
  })

  // Helper: instrumenta a próxima chamada de `createElement('a')` para
  // retornar um anchor REAL (passa pelo appendChild do jsdom) com .click
  // espionado e captura do attr download.
  function captureNextAnchor() {
    const realCreate = document.createElement.bind(document)
    const captured = { click: null, download: null, anchor: null }
    const spy = vi.spyOn(document, 'createElement')
    spy.mockImplementationOnce((tag) => {
      const el = realCreate(tag)
      if (tag === 'a') {
        const clickSpy = vi.fn()
        // jsdom .click é uma função no prototype — vamos sobrescrever
        // no instance só pra esse anchor.
        Object.defineProperty(el, 'click', {
          value: clickSpy,
          configurable: true,
        })
        captured.click = clickSpy
        captured.anchor = el
      }
      return el
    })
    return captured
  }

  it('cria Blob com BOM UTF-8 e dispara click no <a>', () => {
    const captured = captureNextAnchor()

    downloadConflictsCsv([
      {
        id: 'x',
        opId: '1',
        opString: 'a.b',
        userName: 'Z',
        userId: 'u',
        status: 'pending',
        createdAt: 'now',
        resolvedBy: null,
        resolvedAt: null,
        resolutionNotes: null,
        payload: null,
        serverState: null,
      },
    ])

    expect(blobInstances.length).toBe(1)
    const { parts, opts } = blobInstances[0]
    // BOM começa com U+FEFF
    expect(parts[0].startsWith('﻿')).toBe(true)
    // CSV contém a linha do conflito (após header)
    expect(parts[0]).toContain('x,1,a.b,Z,u,pending,now,')
    // Type correto
    expect(opts.type).toBe('text/csv;charset=utf-8')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(captured.click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('filename default usa data ISO YYYY-MM-DD', () => {
    const captured = captureNextAnchor()
    downloadConflictsCsv([])
    expect(captured.anchor.getAttribute('download')).toMatch(
      /^conflitos-\d{4}-\d{2}-\d{2}\.csv$/
    )
  })

  it('aceita filename custom', () => {
    const captured = captureNextAnchor()
    downloadConflictsCsv([], 'custom-name.csv')
    expect(captured.anchor.getAttribute('download')).toBe('custom-name.csv')
  })
})
