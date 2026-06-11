/**
 * tagsService — taxonomia hierárquica de tags (Sprint 8 / O2-7).
 *
 * Cobre:
 *  - listTags (mapping snake→camel, ordenação, data null, erro → throw)
 *  - getTag (eq slug + single, PGRST116 → null, outro erro → throw)
 *  - createTag (payload insert, validação slug/label, audit requireUserId,
 *    erro → throw; created_by recebe o UID string — ver nota abaixo)
 *  - updateTag (payload parcial camelCase→snake_case, eq slug, audit, erro)
 *  - deleteTag (delete + eq slug, retorna true, audit, erro)
 *  - getTagDescendants / getDocumentIdsByTagTree (RPC name + args + mapping)
 *  - buildTagTree (função pura: roots, children, órfãos, vazio)
 *
 * NOTA (bug corrigido 2026-06-11):
 *  createTag fazia `created_by: user` onde `user = requireUserId(...)` retorna
 *  um OBJETO {userId, userName, userEmail}. Corrigido para `user.userId` —
 *  o teste "created_by recebe o UID string" trava o contrato correto.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Hoisted mocks — referenciados dentro de vi.mock() factory
// ============================================================================
const mocks = vi.hoisted(() => {
  const state = {
    // resultado de chains terminados em .single()
    singleResult: { data: null, error: null },
    // resultado de chains await-ados direto (listTags: order().order(); deleteTag: eq())
    thenResult: { data: null, error: null },
    rpcResult: { data: null, error: null },
    lastTable: null,
    lastInsertPayload: null,
    lastUpdatePayload: null,
    lastEqFilters: [],
    lastOrderCalls: [],
    deleteCalled: false,
    lastRpcCall: null,
  }

  function makeChain() {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn((payload) => {
        state.lastInsertPayload = payload
        return chain
      }),
      update: vi.fn((payload) => {
        state.lastUpdatePayload = payload
        return chain
      }),
      delete: vi.fn(() => {
        state.deleteCalled = true
        return chain
      }),
      eq: vi.fn((col, val) => {
        state.lastEqFilters.push([col, val])
        return chain
      }),
      order: vi.fn((col, opts) => {
        state.lastOrderCalls.push([col, opts])
        return chain
      }),
      single: vi.fn(() => Promise.resolve(state.singleResult)),
      // chain await-ado sem .single() → thenResult
      then: (resolve, reject) => Promise.resolve(state.thenResult).then(resolve, reject),
    }
    return chain
  }

  const fromMock = vi.fn((table) => {
    state.lastTable = table
    return makeChain()
  })

  const rpcMock = vi.fn((fnName, args) => {
    state.lastRpcCall = [fnName, args]
    return Promise.resolve(state.rpcResult)
  })

  return { state, fromMock, rpcMock }
})

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}))

// ============================================================================
// Import APÓS mocks — @/utils/audit é real (lógica pura, não mockar)
// ============================================================================
import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getTagDescendants,
  getDocumentIdsByTagTree,
  buildTagTree,
} from '@/services/tagsService'
import { MissingUserIdError } from '@/utils/audit'

const USER = { uid: 'uid-real-123', displayName: 'Guilherme' }

const DB_ROW = {
  slug: 'anestesia-regional',
  label: 'Anestesia Regional',
  parent_slug: 'anestesia',
  descricao: 'Bloqueios e afins',
  color: '#2E8B57',
  created_by: 'uid-real-123',
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-02T11:00:00Z',
}

const EXPECTED_TAG = {
  slug: 'anestesia-regional',
  label: 'Anestesia Regional',
  parentSlug: 'anestesia',
  descricao: 'Bloqueios e afins',
  color: '#2E8B57',
  createdBy: 'uid-real-123',
  createdAt: '2026-06-01T10:00:00Z',
  updatedAt: '2026-06-02T11:00:00Z',
}

describe('tagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.singleResult = { data: null, error: null }
    mocks.state.thenResult = { data: null, error: null }
    mocks.state.rpcResult = { data: null, error: null }
    mocks.state.lastTable = null
    mocks.state.lastInsertPayload = null
    mocks.state.lastUpdatePayload = null
    mocks.state.lastEqFilters = []
    mocks.state.lastOrderCalls = []
    mocks.state.deleteCalled = false
    mocks.state.lastRpcCall = null
    // handleError loga via console.error antes de lançar — silenciar ruído
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // ==========================================================================
  // listTags
  // ==========================================================================
  describe('listTags', () => {
    it('lê da tabela tags, ordena por parent_slug (nullsFirst) e label, mapeia snake→camel', async () => {
      mocks.state.thenResult = { data: [DB_ROW], error: null }
      const result = await listTags()

      expect(mocks.fromMock).toHaveBeenCalledWith('tags')
      expect(mocks.state.lastOrderCalls).toEqual([
        ['parent_slug', { ascending: true, nullsFirst: true }],
        ['label', { ascending: true }],
      ])
      expect(result).toEqual([EXPECTED_TAG])
    })

    it('normaliza campos opcionais ausentes para null', async () => {
      mocks.state.thenResult = {
        data: [{ slug: 'raiz', label: 'Raiz', created_by: 'u1' }],
        error: null,
      }
      const [tag] = await listTags()
      expect(tag.parentSlug).toBeNull()
      expect(tag.descricao).toBeNull()
      expect(tag.color).toBeNull()
    })

    it('retorna [] quando data=null', async () => {
      mocks.state.thenResult = { data: null, error: null }
      await expect(listTags()).resolves.toEqual([])
    })

    it('erro do Supabase → lança tagsService.listTags e loga', async () => {
      mocks.state.thenResult = { data: null, error: { message: 'rls denied' } }
      await expect(listTags()).rejects.toThrow('tagsService.listTags: rls denied')
      expect(console.error).toHaveBeenCalled()
    })

    it('erro sem message → "erro desconhecido"', async () => {
      mocks.state.thenResult = { data: null, error: {} }
      await expect(listTags()).rejects.toThrow('tagsService.listTags: erro desconhecido')
    })
  })

  // ==========================================================================
  // getTag
  // ==========================================================================
  describe('getTag', () => {
    it('filtra por slug + single e mapeia para camelCase', async () => {
      mocks.state.singleResult = { data: DB_ROW, error: null }
      const tag = await getTag('anestesia-regional')

      expect(mocks.fromMock).toHaveBeenCalledWith('tags')
      expect(mocks.state.lastEqFilters).toEqual([['slug', 'anestesia-regional']])
      expect(tag).toEqual(EXPECTED_TAG)
    })

    it('PGRST116 (row não encontrada) → retorna null sem lançar', async () => {
      mocks.state.singleResult = {
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }
      await expect(getTag('inexistente')).resolves.toBeNull()
    })

    it('outro erro → lança tagsService.getTag', async () => {
      mocks.state.singleResult = {
        data: null,
        error: { code: '42703', message: 'column missing' },
      }
      await expect(getTag('x')).rejects.toThrow('tagsService.getTag: column missing')
    })
  })

  // ==========================================================================
  // createTag
  // ==========================================================================
  describe('createTag', () => {
    it('insere na tabela tags com payload snake_case e label trimmed, retorna camelCase', async () => {
      mocks.state.singleResult = { data: DB_ROW, error: null }
      const tag = await createTag(
        {
          slug: 'anestesia-regional',
          label: '  Anestesia Regional  ',
          parentSlug: 'anestesia',
          descricao: 'Bloqueios e afins',
          color: '#2E8B57',
        },
        USER
      )

      expect(mocks.fromMock).toHaveBeenCalledWith('tags')
      expect(mocks.state.lastInsertPayload).toMatchObject({
        slug: 'anestesia-regional',
        label: 'Anestesia Regional', // trimmed
        parent_slug: 'anestesia',
        descricao: 'Bloqueios e afins',
        color: '#2E8B57',
      })
      expect(tag).toEqual(EXPECTED_TAG)
    })

    it('defaults: parentSlug/descricao/color omitidos → null no payload', async () => {
      mocks.state.singleResult = { data: { slug: 'raiz', label: 'Raiz' }, error: null }
      await createTag({ slug: 'raiz', label: 'Raiz' }, USER)
      expect(mocks.state.lastInsertPayload.parent_slug).toBeNull()
      expect(mocks.state.lastInsertPayload.descricao).toBeNull()
      expect(mocks.state.lastInsertPayload.color).toBeNull()
    })

    it('created_by recebe o UID string de requireUserId (não o objeto inteiro)', async () => {
      mocks.state.singleResult = { data: { slug: 'x', label: 'X' }, error: null }
      await createTag({ slug: 'x', label: 'X' }, USER)
      // requireUserId retorna {userId, userName, userEmail}; o service grava
      // apenas user.userId em created_by (bug do objeto inteiro corrigido).
      expect(mocks.state.lastInsertPayload.created_by).toBe('uid-real-123')
    })

    it('slug inválido (maiúsculas) → lança e NÃO chama Supabase', async () => {
      await expect(createTag({ slug: 'Tag-Maiuscula', label: 'X' }, USER)).rejects.toThrow(
        /slug inválido/
      )
      expect(mocks.fromMock).not.toHaveBeenCalled()
    })

    it('slug inválido (começa com hífen) → lança', async () => {
      await expect(createTag({ slug: '-tag', label: 'X' }, USER)).rejects.toThrow(
        /slug inválido/
      )
    })

    it('slug vazio → lança', async () => {
      await expect(createTag({ slug: '', label: 'X' }, USER)).rejects.toThrow(/slug inválido/)
    })

    it('label vazio/whitespace → lança', async () => {
      await expect(createTag({ slug: 'ok', label: '   ' }, USER)).rejects.toThrow(
        /label obrigatório/
      )
      expect(mocks.fromMock).not.toHaveBeenCalled()
    })

    it('sem userInfo → MissingUserIdError ANTES de validar slug ou tocar o Supabase', async () => {
      await expect(createTag({ slug: 'ok', label: 'Ok' }, {})).rejects.toThrow(
        MissingUserIdError
      )
      expect(mocks.fromMock).not.toHaveBeenCalled()
    })

    it('uid literal proibido ("admin") → MissingUserIdError', async () => {
      await expect(
        createTag({ slug: 'ok', label: 'Ok' }, { uid: 'admin' })
      ).rejects.toThrow(MissingUserIdError)
    })

    it('erro do Supabase → lança tagsService.createTag', async () => {
      mocks.state.singleResult = {
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      }
      await expect(createTag({ slug: 'dup', label: 'Dup' }, USER)).rejects.toThrow(
        'tagsService.createTag: duplicate key value violates unique constraint'
      )
    })
  })

  // ==========================================================================
  // updateTag
  // ==========================================================================
  describe('updateTag', () => {
    it('payload parcial: só campos definidos, camelCase→snake_case, eq por slug', async () => {
      mocks.state.singleResult = { data: DB_ROW, error: null }
      const tag = await updateTag(
        'anestesia-regional',
        { label: 'Novo Label', parentSlug: 'anestesia' },
        USER
      )

      expect(mocks.fromMock).toHaveBeenCalledWith('tags')
      expect(mocks.state.lastUpdatePayload).toEqual({
        label: 'Novo Label',
        parent_slug: 'anestesia',
      })
      expect(mocks.state.lastEqFilters).toEqual([['slug', 'anestesia-regional']])
      expect(tag).toEqual(EXPECTED_TAG)
    })

    it('null explícito é incluído (limpar parentSlug/color); undefined é omitido', async () => {
      mocks.state.singleResult = { data: DB_ROW, error: null }
      await updateTag('x', { parentSlug: null, color: null }, USER)
      expect(mocks.state.lastUpdatePayload).toEqual({
        parent_slug: null,
        color: null,
      })
      expect(mocks.state.lastUpdatePayload).not.toHaveProperty('label')
      expect(mocks.state.lastUpdatePayload).not.toHaveProperty('descricao')
    })

    it('sem userInfo → MissingUserIdError sem tocar o Supabase', async () => {
      await expect(updateTag('x', { label: 'Y' }, {})).rejects.toThrow(MissingUserIdError)
      expect(mocks.fromMock).not.toHaveBeenCalled()
    })

    it('erro do Supabase → lança tagsService.updateTag', async () => {
      mocks.state.singleResult = { data: null, error: { message: 'rls denied' } }
      await expect(updateTag('x', { label: 'Y' }, USER)).rejects.toThrow(
        'tagsService.updateTag: rls denied'
      )
    })
  })

  // ==========================================================================
  // deleteTag
  // ==========================================================================
  describe('deleteTag', () => {
    it('delete + eq por slug na tabela tags, retorna true', async () => {
      mocks.state.thenResult = { error: null }
      const ok = await deleteTag('anestesia-regional', USER)

      expect(ok).toBe(true)
      expect(mocks.fromMock).toHaveBeenCalledWith('tags')
      expect(mocks.state.deleteCalled).toBe(true)
      expect(mocks.state.lastEqFilters).toEqual([['slug', 'anestesia-regional']])
    })

    it('sem userInfo → MissingUserIdError sem tocar o Supabase', async () => {
      await expect(deleteTag('x', {})).rejects.toThrow(MissingUserIdError)
      expect(mocks.fromMock).not.toHaveBeenCalled()
    })

    it('erro do Supabase → lança tagsService.deleteTag', async () => {
      mocks.state.thenResult = { error: { message: 'fk violation' } }
      await expect(deleteTag('x', USER)).rejects.toThrow('tagsService.deleteTag: fk violation')
    })
  })

  // ==========================================================================
  // getTagDescendants (RPC)
  // ==========================================================================
  describe('getTagDescendants', () => {
    it('chama rpc_tag_descendants com {p_slug} e mapeia rows', async () => {
      mocks.state.rpcResult = {
        data: [
          { slug: 'anestesia', label: 'Anestesia', parent_slug: null, depth: 0 },
          { slug: 'anestesia-regional', label: 'Regional', parent_slug: 'anestesia', depth: 1 },
        ],
        error: null,
      }
      const rows = await getTagDescendants('anestesia')

      expect(mocks.rpcMock).toHaveBeenCalledWith('rpc_tag_descendants', {
        p_slug: 'anestesia',
      })
      expect(rows).toEqual([
        { slug: 'anestesia', label: 'Anestesia', parentSlug: null, depth: 0 },
        { slug: 'anestesia-regional', label: 'Regional', parentSlug: 'anestesia', depth: 1 },
      ])
    })

    it('data=null → []', async () => {
      mocks.state.rpcResult = { data: null, error: null }
      await expect(getTagDescendants('x')).resolves.toEqual([])
    })

    it('erro → lança tagsService.getTagDescendants', async () => {
      mocks.state.rpcResult = { data: null, error: { message: 'function missing' } }
      await expect(getTagDescendants('x')).rejects.toThrow(
        'tagsService.getTagDescendants: function missing'
      )
    })
  })

  // ==========================================================================
  // getDocumentIdsByTagTree (RPC)
  // ==========================================================================
  describe('getDocumentIdsByTagTree', () => {
    it('chama rpc_documentos_by_tag_tree com {p_slug}', async () => {
      mocks.state.rpcResult = { data: [], error: null }
      await getDocumentIdsByTagTree('anestesia')
      expect(mocks.rpcMock).toHaveBeenCalledWith('rpc_documentos_by_tag_tree', {
        p_slug: 'anestesia',
      })
    })

    it('rows string passam direto; rows objeto extraem .id', async () => {
      mocks.state.rpcResult = {
        data: ['doc-1', { id: 'doc-2' }, { id: 'doc-3', titulo: 'x' }],
        error: null,
      }
      await expect(getDocumentIdsByTagTree('t')).resolves.toEqual([
        'doc-1',
        'doc-2',
        'doc-3',
      ])
    })

    it('data=null → []', async () => {
      mocks.state.rpcResult = { data: null, error: null }
      await expect(getDocumentIdsByTagTree('t')).resolves.toEqual([])
    })

    it('erro → lança tagsService.getDocumentIdsByTagTree', async () => {
      mocks.state.rpcResult = { data: null, error: { message: 'boom' } }
      await expect(getDocumentIdsByTagTree('t')).rejects.toThrow(
        'tagsService.getDocumentIdsByTagTree: boom'
      )
    })
  })

  // ==========================================================================
  // buildTagTree (função pura, sem Supabase)
  // ==========================================================================
  describe('buildTagTree', () => {
    it('monta árvore: roots no topo, filhos aninhados em .children', () => {
      const flat = [
        { slug: 'anestesia', label: 'Anestesia', parentSlug: null },
        { slug: 'regional', label: 'Regional', parentSlug: 'anestesia' },
        { slug: 'raqui', label: 'Raqui', parentSlug: 'regional' },
        { slug: 'gestao', label: 'Gestão', parentSlug: null },
      ]
      const roots = buildTagTree(flat)

      expect(roots).toHaveLength(2)
      const anestesia = roots.find((r) => r.slug === 'anestesia')
      expect(anestesia.children).toHaveLength(1)
      expect(anestesia.children[0].slug).toBe('regional')
      expect(anestesia.children[0].children[0].slug).toBe('raqui')
      const gestao = roots.find((r) => r.slug === 'gestao')
      expect(gestao.children).toEqual([])
    })

    it('parentSlug apontando para tag inexistente → vira root (órfão não some)', () => {
      const roots = buildTagTree([
        { slug: 'orfao', label: 'Órfão', parentSlug: 'pai-deletado' },
      ])
      expect(roots).toHaveLength(1)
      expect(roots[0].slug).toBe('orfao')
    })

    it('lista vazia → []', () => {
      expect(buildTagTree([])).toEqual([])
    })

    it('não muta os objetos de entrada', () => {
      const input = [
        { slug: 'a', label: 'A', parentSlug: null },
        { slug: 'b', label: 'B', parentSlug: 'a' },
      ]
      buildTagTree(input)
      expect(input[0]).not.toHaveProperty('children')
      expect(input[1]).not.toHaveProperty('children')
    })
  })
})
