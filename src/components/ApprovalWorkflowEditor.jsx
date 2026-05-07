/**
 * ApprovalWorkflowEditor — Admin UI para configurar multi-step approval.
 *
 * Renderiza uma lista ordenada de steps. Cada step tem:
 *   - mode: sequential | parallel | any_one
 *   - approver_ids: lista de firebase UIDs (texto livre por enquanto; futura
 *     iteração troca por multi-select de usuários)
 *   - deadline_days: prazo opcional em dias após ativação
 *
 * Salva via supabaseDocumentService.setMultiStepApprovalWorkflow.
 *
 * Gating: VITE_FEATURE_MULTI_STEP_APPROVAL === 'true' (default false).
 *
 * Versão minimalista: estrutura JSX funcional + CRUD básico. Refinements
 * (drag-drop, multi-select autocomplete) ficam como TODO.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, Button, Input, Select } from '@/design-system'
import { useTheme } from '@/design-system/hooks'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Plus, Trash2, Save } from 'lucide-react'
import supabaseDocumentService from '@/services/supabaseDocumentService'

const FEATURE_ENABLED =
  import.meta.env?.VITE_FEATURE_MULTI_STEP_APPROVAL === 'true'

const DEFAULT_STEP = {
  mode: 'sequential',
  approverIds: [],
  deadlineDays: null,
}

const MODE_OPTIONS = [
  { value: 'sequential', label: 'Sequencial (todos, em ordem)' },
  { value: 'parallel', label: 'Paralelo (todos, simultâneo)' },
  { value: 'any_one', label: 'Qualquer um (basta 1 aprovar)' },
]

export function ApprovalWorkflowEditor({ documentoId, currentUser, onSaved, className }) {
  const { isDark } = useTheme()
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadExisting = useCallback(async () => {
    if (!documentoId) return
    setLoading(true)
    setError(null)
    try {
      const existing = await supabaseDocumentService.getApprovalSteps(documentoId)
      setSteps(
        (existing || []).map((s) => ({
          mode: s.mode,
          approverIds: s.approverIds || [],
          deadlineDays: s.deadlineDays,
        }))
      )
    } catch (err) {
      setError(err?.message || 'Falha ao carregar steps')
    } finally {
      setLoading(false)
    }
  }, [documentoId])

  useEffect(() => {
    loadExisting()
  }, [loadExisting])

  if (!FEATURE_ENABLED) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Multi-step approval está desabilitado. Habilite via flag{' '}
            <code className="font-mono">VITE_FEATURE_MULTI_STEP_APPROVAL</code>.
          </p>
        </CardContent>
      </Card>
    )
  }

  const addStep = () => setSteps((prev) => [...prev, { ...DEFAULT_STEP }])

  const removeStep = (idx) =>
    setSteps((prev) => prev.filter((_, i) => i !== idx))

  const moveStep = (idx, direction) => {
    setSteps((prev) => {
      const next = [...prev]
      const targetIdx = idx + direction
      if (targetIdx < 0 || targetIdx >= next.length) return prev
      ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
      return next
    })
  }

  const updateStep = (idx, patch) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))

  const handleSave = async () => {
    if (!documentoId || !currentUser) {
      setError('documentoId e currentUser obrigatórios')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await supabaseDocumentService.setMultiStepApprovalWorkflow(
        documentoId,
        steps,
        currentUser
      )
      onSaved?.(steps)
    } catch (err) {
      setError(err?.message || 'Falha ao salvar workflow')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">
            Workflow de Aprovação Multi-step
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={addStep}
            disabled={loading || saving}
            aria-label="Adicionar step"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar step
          </Button>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}

        {error && (
          <p
            className={cn(
              'text-sm rounded-md p-2',
              isDark ? 'bg-destructive/20 text-destructive' : 'bg-red-50 text-red-700'
            )}
            role="alert"
          >
            {error}
          </p>
        )}

        {!loading && steps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum step configurado. Clique em "Adicionar step" para começar.
          </p>
        )}

        <ol className="space-y-3">
          {steps.map((step, idx) => (
            <li
              key={idx}
              className={cn(
                'rounded-lg border p-3 space-y-2',
                isDark ? 'border-border bg-card' : 'border-border bg-white'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Step {idx + 1}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0 || saving}
                    aria-label={`Mover step ${idx + 1} para cima`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1 || saving}
                    aria-label={`Mover step ${idx + 1} para baixo`}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeStep(idx)}
                    disabled={saving}
                    aria-label={`Remover step ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Modo</span>
                  <Select
                    value={step.mode}
                    onChange={(value) => updateStep(idx, { mode: value })}
                    options={MODE_OPTIONS}
                    aria-label={`Modo do step ${idx + 1}`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-muted-foreground">
                    Prazo (dias após ativar)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={step.deadlineDays ?? ''}
                    onChange={(e) =>
                      updateStep(idx, {
                        deadlineDays:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="opcional"
                    aria-label={`Prazo do step ${idx + 1}`}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-muted-foreground">
                  Aprovadores (firebase UIDs separados por vírgula)
                </span>
                {/* TODO: trocar por multi-select autocomplete de usuários (busca em profiles). */}
                <Input
                  type="text"
                  value={step.approverIds.join(',')}
                  onChange={(e) =>
                    updateStep(idx, {
                      approverIds: e.target.value
                        .split(',')
                        .map((id) => id.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="uid1, uid2, uid3"
                  aria-label={`Aprovadores do step ${idx + 1}`}
                />
              </label>
            </li>
          ))}
        </ol>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={loading || saving || steps.length === 0}
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Salvando…' : 'Salvar workflow'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ApprovalWorkflowEditor
