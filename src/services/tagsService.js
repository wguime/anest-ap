/**
 * tagsService — taxonomia hierárquica de tags (Sprint 8 / O2-7).
 *
 * A tabela `tags` é o catálogo (slug, label, parent_slug, color). A coluna
 * `documentos.tags` (text[]) referencia slugs daqui — backward-compatible
 * com filtros existentes.
 *
 * Frontend lê via `listTags()`, monta árvore via `buildTagTree(tags)`,
 * e filtra docs por `getDocumentIdsByTagTree(slug)`.
 */

import { supabase } from '@/config/supabase'
import { requireUserId } from '@/utils/audit'

function handleError(error, op) {
  console.error(`[tagsService] ${op}:`, error)
  throw new Error(`tagsService.${op}: ${error.message || 'erro desconhecido'}`)
}

/**
 * @typedef {Object} Tag
 * @property {string} slug
 * @property {string} label
 * @property {string|null} parentSlug
 * @property {string|null} descricao
 * @property {string|null} color
 * @property {string} createdBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function rowToTag(row) {
  if (!row) return null
  return {
    slug: row.slug,
    label: row.label,
    parentSlug: row.parent_slug ?? null,
    descricao: row.descricao ?? null,
    color: row.color ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listTags() {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('parent_slug', { ascending: true, nullsFirst: true })
    .order('label', { ascending: true })
  if (error) handleError(error, 'listTags')
  return (data || []).map(rowToTag)
}

export async function getTag(slug) {
  const { data, error } = await supabase
    .from('tags').select('*').eq('slug', slug).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    handleError(error, 'getTag')
  }
  return rowToTag(data)
}

export async function createTag({ slug, label, parentSlug = null, descricao = null, color = null }, userInfo = {}) {
  const user = requireUserId(userInfo, 'createTag')
  if (!slug || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    throw new Error('createTag: slug inválido (lower-snake/kebab-case)')
  }
  if (!label?.trim()) throw new Error('createTag: label obrigatório')
  const { data, error } = await supabase.from('tags').insert({
    slug, label: label.trim(), parent_slug: parentSlug, descricao, color, created_by: user,
  }).select().single()
  if (error) handleError(error, 'createTag')
  return rowToTag(data)
}

export async function updateTag(slug, updates, userInfo = {}) {
  requireUserId(userInfo, 'updateTag')
  const payload = {}
  if (updates.label !== undefined) payload.label = updates.label
  if (updates.parentSlug !== undefined) payload.parent_slug = updates.parentSlug
  if (updates.descricao !== undefined) payload.descricao = updates.descricao
  if (updates.color !== undefined) payload.color = updates.color
  const { data, error } = await supabase
    .from('tags').update(payload).eq('slug', slug).select().single()
  if (error) handleError(error, 'updateTag')
  return rowToTag(data)
}

export async function deleteTag(slug, userInfo = {}) {
  requireUserId(userInfo, 'deleteTag')
  const { error } = await supabase.from('tags').delete().eq('slug', slug)
  if (error) handleError(error, 'deleteTag')
  return true
}

/**
 * Retorna o slug + todos os descendentes (incluindo ele próprio).
 * Usa RPC recursiva no Postgres.
 */
export async function getTagDescendants(slug) {
  const { data, error } = await supabase.rpc('rpc_tag_descendants', { p_slug: slug })
  if (error) handleError(error, 'getTagDescendants')
  return (data || []).map((row) => ({
    slug: row.slug,
    label: row.label,
    parentSlug: row.parent_slug,
    depth: row.depth,
  }))
}

/**
 * Lista IDs de documentos que têm a tag ou qualquer descendente dela.
 * Usado pelo filtro hierárquico em BibliotecaPage.
 */
export async function getDocumentIdsByTagTree(slug) {
  const { data, error } = await supabase.rpc('rpc_documentos_by_tag_tree', { p_slug: slug })
  if (error) handleError(error, 'getDocumentIdsByTagTree')
  return (data || []).map((row) => (typeof row === 'string' ? row : row.id ?? row))
}

/**
 * Constrói árvore hierárquica a partir de lista plana.
 * Retorna apenas os roots; cada node tem .children[].
 */
export function buildTagTree(flatTags) {
  const bySlug = new Map(flatTags.map((t) => [t.slug, { ...t, children: [] }]))
  const roots = []
  for (const tag of bySlug.values()) {
    if (tag.parentSlug && bySlug.has(tag.parentSlug)) {
      bySlug.get(tag.parentSlug).children.push(tag)
    } else {
      roots.push(tag)
    }
  }
  return roots
}
