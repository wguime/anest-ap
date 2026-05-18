/**
 * BulkImportPage — Sprint 5 / O2-4
 *
 * Admin-only. Drag-drop múltiplos PDFs → tabela editável de metadata por
 * linha → "Iniciar importação" → progress bar + log de erros pós-execução.
 *
 * Gating: VITE_FEATURE_BULK_IMPORT && isAdministrator(currentUser).
 *
 * Reusa: FileUpload (DS, variant=dropzone, multiple), Button, Input, Select,
 * Progress (DS), useBulkImport (Sprint 5), useToast.
 */

import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Select, Progress, useToast } from '@/design-system'
import { FileUpload } from '@/design-system/components/ui/file-upload'
import { ArrowLeft, FileText, Loader2, Upload, Trash2, AlertTriangle } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { isAdministrator } from '@/design-system/components/anest/admin-only'
import { useBulkImport, BULK_IMPORT_STATUS } from '@/hooks/useBulkImport'
import bulkImportService from '@/services/bulkImportService'
import { isBulkImportEnabled } from '@/utils/featureFlags'

const CATEGORIA_OPTIONS = [
  { value: 'biblioteca', label: 'Biblioteca' },
  { value: 'etica', label: 'Ética' },
  { value: 'comites', label: 'Comitês' },
  { value: 'auditorias', label: 'Auditorias' },
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'medicamentos', label: 'Medicamentos' },
  { value: 'infeccoes', label: 'Infecções' },
  { value: 'desastres', label: 'Desastres' },
]

const TIPO_OPTIONS = [
  { value: 'documento', label: 'Documento' },
  { value: 'protocolo', label: 'Protocolo' },
  { value: 'politica', label: 'Política' },
  { value: 'manual', label: 'Manual' },
  { value: 'formulario', label: 'Formulário' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'processo', label: 'Processo' },
]

function deriveTitulo(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function BulkImportPage({ goBack }) {
  const { toast } = useToast()
  const { firebaseUser, currentUser } = useUser() || {}
  const userIsAdmin = isAdministrator(currentUser)
  const featureOn = isBulkImportEnabled()

  const {
    startImport,
    status,
    progress,
    errors,
    summary,
    reset,
  } = useBulkImport()

  const [rows, setRows] = useState([])
  // Each row: { id, file, meta: {titulo, codigo, categoria, tipo, setorNome} }

  const isProcessing =
    status === BULK_IMPORT_STATUS.PREPARING || status === BULK_IMPORT_STATUS.PROCESSING

  // ------------------------------------------------------------------
  // Validation por linha + dedupe entre linhas
  // ------------------------------------------------------------------
  const validateRow = useCallback(
    (row) => {
      const seen = new Set()
      // Re-add codigos OUTSIDE this row to test dedupe context
      rows.forEach((r) => {
        if (r.id !== row.id && r.meta.codigo?.trim()) seen.add(r.meta.codigo.trim())
      })
      return bulkImportService.validateBulkRow(row.file, row.meta, seen)
    },
    [rows]
  )

  const allValid = useMemo(
    () => rows.length > 0 && rows.every((r) => validateRow(r).length === 0),
    [rows, validateRow]
  )

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleFilesAdded = useCallback((picked) => {
    const files = Array.isArray(picked) ? picked : picked ? [picked] : []
    if (files.length === 0) return
    setRows((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        meta: {
          titulo: deriveTitulo(file.name),
          codigo: '',
          categoria: 'biblioteca',
          tipo: 'documento',
          setorNome: '',
        },
      })),
    ])
  }, [])

  const updateMeta = useCallback((rowId, key, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, meta: { ...r.meta, [key]: value } } : r))
    )
  }, [])

  const removeRow = useCallback((rowId) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }, [])

  const handleStart = useCallback(async () => {
    if (!firebaseUser?.uid) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente.',
        variant: 'error',
      })
      return
    }
    if (!allValid) {
      toast({
        title: 'Linhas inválidas',
        description: 'Corrija as linhas em vermelho antes de iniciar.',
        variant: 'error',
      })
      return
    }
    const userInfo = {
      userId: firebaseUser.uid,
      userName: firebaseUser.displayName || firebaseUser.email || 'Admin',
      userEmail: firebaseUser.email || null,
    }
    try {
      const result = await startImport(
        rows.map((r) => ({ file: r.file, meta: r.meta })),
        { userInfo, source: 'manual_upload' }
      )
      if (result?.skipped) {
        toast({
          title: 'Bulk import desabilitado',
          description: 'A feature flag VITE_FEATURE_BULK_IMPORT está OFF.',
          variant: 'warning',
        })
        return
      }
      const verb =
        result.status === 'done' ? 'concluído' :
        result.status === 'partial' ? 'parcial' :
        'falhou'
      toast({
        title: `Importação ${verb}`,
        description: `${result.processed}/${result.total} documentos. ${result.failed} falhas.`,
        variant: result.status === 'done' ? 'success' : 'warning',
      })
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: err?.message || 'Falha desconhecida.',
        variant: 'error',
      })
    }
  }, [allValid, firebaseUser, rows, startImport, toast])

  const handleReset = useCallback(() => {
    setRows([])
    reset()
  }, [reset])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (!featureOn) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-warning" aria-hidden="true" />
          <h1 className="text-xl font-bold mb-2">Bulk import indisponível</h1>
          <p className="text-sm text-muted-foreground mb-4">
            A feature flag <code className="font-mono">VITE_FEATURE_BULK_IMPORT</code> está
            desligada. Peça para um admin habilitar para usar essa página.
          </p>
          <Button variant="outline" onClick={goBack}>Voltar</Button>
        </div>
      </div>
    )
  }

  if (!userIsAdmin) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" aria-hidden="true" />
          <h1 className="text-xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Bulk import é uma operação administrativa. Apenas admins podem importar documentos
            em massa.
          </p>
          <Button variant="outline" onClick={goBack}>Voltar</Button>
        </div>
      </div>
    )
  }

  const headerPortalTarget =
    typeof document !== 'undefined' ? document.getElementById('app-fixed-header') : null

  return (
    <div className="min-h-dvh bg-background pb-24">
      {headerPortalTarget &&
        createPortal(
          <div className="flex items-center gap-3 h-14 px-4 border-b border-border bg-card">
            <button
              onClick={goBack}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold">Importação em massa</h1>
              <p className="text-xs text-muted-foreground">
                Drag-drop múltiplos PDFs e edite os metadados antes de importar
              </p>
            </div>
          </div>,
          headerPortalTarget
        )}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 max-w-6xl mx-auto space-y-4">
        {/* Dropzone */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <FileUpload
            variant="dropzone"
            accept=".pdf,application/pdf"
            multiple
            maxSize={bulkImportService.MAX_FILE_SIZE}
            value={null}
            onChange={handleFilesAdded}
            disabled={isProcessing}
            label="Arraste PDFs aqui ou clique para selecionar"
            description="Até 50 MB por arquivo. Os arquivos são adicionados à fila — você pode editar metadados antes de importar."
          />
        </div>

        {/* Linhas com metadata */}
        {rows.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {rows.length} {rows.length === 1 ? 'documento' : 'documentos'} na fila
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRows([])}
                disabled={isProcessing}
              >
                Limpar fila
              </Button>
            </div>

            <div className="divide-y divide-border">
              {rows.map((row) => {
                const issues = validateRow(row)
                const hasError = issues.length > 0
                return (
                  <div
                    key={row.id}
                    className={
                      'p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start' +
                      (hasError ? ' bg-destructive/5' : '')
                    }
                  >
                    <div className="lg:col-span-3 flex items-start gap-2 min-w-0">
                      <FileText className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={row.file.name}>
                          {row.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(row.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="lg:col-span-3">
                      <Input
                        value={row.meta.titulo}
                        onChange={(e) => updateMeta(row.id, 'titulo', e.target.value)}
                        placeholder="Título *"
                        disabled={isProcessing}
                        aria-label="Título do documento"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Input
                        value={row.meta.codigo}
                        onChange={(e) => updateMeta(row.id, 'codigo', e.target.value)}
                        placeholder="Código"
                        disabled={isProcessing}
                        aria-label="Código do documento"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Select
                        value={row.meta.categoria}
                        onChange={(v) => updateMeta(row.id, 'categoria', v)}
                        options={CATEGORIA_OPTIONS}
                        disabled={isProcessing}
                        aria-label="Categoria"
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <Select
                        value={row.meta.tipo}
                        onChange={(v) => updateMeta(row.id, 'tipo', v)}
                        options={TIPO_OPTIONS}
                        disabled={isProcessing}
                        aria-label="Tipo"
                      />
                    </div>
                    <div className="lg:col-span-1 flex justify-end">
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={isProcessing}
                        className="p-2 rounded-xl hover:bg-muted disabled:opacity-50"
                        aria-label={`Remover ${row.file.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                    {hasError && (
                      <ul className="lg:col-span-12 text-xs text-destructive list-disc pl-5">
                        {issues.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Progress + ações */}
        {isProcessing && (
          <div className="bg-card rounded-2xl p-4 border border-border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {progress.phase === 'starting'
                  ? 'Iniciando…'
                  : `Processando ${progress.processed + progress.failed} de ${progress.total}`}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {progress.failed} falhas
              </span>
            </div>
            <Progress
              value={
                progress.total
                  ? ((progress.processed + progress.failed) / progress.total) * 100
                  : 0
              }
            />
          </div>
        )}

        {/* Resumo + erros pós-execução */}
        {summary && !isProcessing && (
          <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h3 className="text-sm font-semibold">Resumo da importação</h3>
            <p className="text-sm text-muted-foreground">
              {summary.processed} de {summary.total} importados, {summary.failed}{' '}
              {summary.failed === 1 ? 'falha' : 'falhas'} · status{' '}
              <span className="font-mono">{summary.status}</span>
            </p>
            {errors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">
                  Ver {errors.length} {errors.length === 1 ? 'erro' : 'erros'}
                </summary>
                <ul className="mt-2 space-y-1 pl-5 list-disc text-destructive">
                  {errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-mono">{e.file || '(sem nome)'}</span>: {e.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Botoeira */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleStart}
            disabled={!allValid || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Iniciar importação ({rows.length})
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
            Resetar
          </Button>
        </div>
      </div>
    </div>
  )
}
