import { useMemo, useState } from 'react'
import { z } from 'zod'
import { Upload, CheckCircle2, AlertTriangle, Loader2, RotateCcw, FileText, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Select,
  Alert,
  Badge,
  Spinner,
  FormField,
  ConfirmDialog,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useEducacaoData } from '../hooks/useEducacaoData'
import * as educacaoService from '@/services/educacaoService'

/**
 * QuestionBankImporter — T1.5.14
 *
 * Bulk import de questões de quiz (JSONL — uma questão por linha).
 *
 * Pipeline: Upload → Parse JSONL → Validate Zod → Preview tabela →
 * Dry-run → Confirmar → Cloud Function (importQuestionsJsonl) → History + Rollback (24h).
 *
 * Schema JSONL esperado (cada linha):
 * { "pergunta": "...", "opcoes": ["A","B","C","D"], "respostaCorreta": 0, "explicacao": "..." }
 */

const PerguntaSchema = z.object({
  pergunta: z.string().trim().min(3, 'mínimo 3 caracteres'),
  opcoes: z.array(z.string().trim().min(1, 'opção vazia')).min(2, 'pelo menos 2 opções').max(8, 'máximo 8 opções'),
  respostaCorreta: z.number().int().nonnegative('índice negativo'),
  explicacao: z.string().optional(),
}).refine(
  (d) => d.respostaCorreta < d.opcoes.length,
  { message: 'respostaCorreta fora do range das opções', path: ['respostaCorreta'] }
)

const MAX_PER_IMPORT = 500

function parseJsonl(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.map((line, idx) => {
    try {
      return { ok: true, idx, raw: JSON.parse(line) }
    } catch (err) {
      return { ok: false, idx, raw: null, error: `JSON inválido (linha ${idx + 1}): ${err.message}` }
    }
  })
}

function validateRows(parsed) {
  return parsed.map((row) => {
    if (!row.ok) return row
    const result = PerguntaSchema.safeParse(row.raw)
    if (result.success) {
      return { ...row, valid: true, data: result.data }
    }
    const msg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    return { ...row, valid: false, error: `linha ${row.idx + 1}: ${msg}` }
  })
}

export function QuestionBankImporter({ onClose }) {
  const { cursos } = useEducacaoData()
  const [cursoId, setCursoId] = useState('')
  const [fileName, setFileName] = useState(null)
  const [rawText, setRawText] = useState('')
  const [validated, setValidated] = useState(null) // null | Array<row>
  const [phase, setPhase] = useState('idle') // 'idle' | 'parsing' | 'dryrun' | 'applying' | 'done' | 'error'
  const [error, setError] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)

  const cursoOptions = useMemo(
    () => (cursos || []).map((c) => ({ value: c.id, label: c.titulo })),
    [cursos]
  )

  const stats = useMemo(() => {
    if (!validated) return null
    const valid = validated.filter((r) => r.valid).length
    const invalid = validated.filter((r) => !r.valid).length
    return { valid, invalid, total: validated.length }
  }, [validated])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    setPhase('parsing')
    setImportResult(null)
    try {
      const text = await file.text()
      setRawText(text)
      const parsed = parseJsonl(text)
      const v = validateRows(parsed)
      setValidated(v)
      if (v.length > MAX_PER_IMPORT) {
        setError(`Arquivo tem ${v.length} linhas; máximo é ${MAX_PER_IMPORT} por import.`)
      }
      setPhase('idle')
    } catch (err) {
      setError(`Falha ao ler arquivo: ${err.message}`)
      setPhase('error')
    }
  }

  const handleClear = () => {
    setFileName(null)
    setRawText('')
    setValidated(null)
    setImportResult(null)
    setError(null)
    setPhase('idle')
  }

  const validPerguntas = useMemo(
    () => (validated || []).filter((r) => r.valid).map((r) => r.data),
    [validated]
  )

  const canApply =
    cursoId &&
    validPerguntas.length > 0 &&
    stats?.invalid === 0 &&
    validPerguntas.length <= MAX_PER_IMPORT &&
    phase === 'idle'

  const handleDryRun = async () => {
    setPhase('dryrun')
    setError(null)
    try {
      const res = await educacaoService.importQuestionsJsonl(cursoId, validPerguntas, { dryRun: true })
      setImportResult({ ...res, dryRun: true })
      setPhase('idle')
    } catch (err) {
      setError(err?.message || 'Erro no dry-run')
      setPhase('error')
    }
  }

  // T1.7.11: substitui window.confirm bloqueante por ConfirmDialog DS.
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)

  const handleApply = () => {
    setShowApplyConfirm(true)
  }

  const confirmApply = async () => {
    setShowApplyConfirm(false)
    setPhase('applying')
    setError(null)
    try {
      const res = await educacaoService.importQuestionsJsonl(cursoId, validPerguntas, { dryRun: false })
      setImportResult(res)
      setPhase('done')
    } catch (err) {
      setError(err?.message || 'Erro ao importar')
      setPhase('error')
    }
  }

  const handleRollback = () => {
    if (!importResult?.importId) return
    setShowRollbackConfirm(true)
  }

  const confirmRollback = async () => {
    setShowRollbackConfirm(false)
    if (!importResult?.importId) return
    setRollbackBusy(true)
    setError(null)
    try {
      await educacaoService.rollbackImportQuestions(importResult.importId)
      setImportResult({ ...importResult, rolledBack: true })
    } catch (err) {
      setError(err?.message || 'Erro no rollback')
    } finally {
      setRollbackBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
        <div className="text-sm">
          Formato <code>.jsonl</code>: uma questão por linha em JSON. Campos: <code>pergunta</code>,{' '}
          <code>opcoes</code> (array), <code>respostaCorreta</code> (índice 0-based), <code>explicacao</code> (opcional).
          Limite: {MAX_PER_IMPORT} perguntas/import. Rollback disponível por 24h.
        </div>
      </Alert>

      <FormField label="Curso destino" required>
        <Select
          value={cursoId}
          onChange={setCursoId}
          options={cursoOptions}
          placeholder="Selecione o curso..."
        />
      </FormField>

      <FormField label="Arquivo JSONL" required>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg cursor-pointer hover:bg-muted/50 min-h-[44px]">
            <Upload className="w-4 h-4" />
            <span className="text-sm">{fileName || 'Escolher arquivo .jsonl'}</span>
            <input
              type="file"
              accept=".jsonl,.txt,application/jsonl,application/json"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          {fileName && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="min-h-[44px]" leftIcon={<Trash2 className="w-4 h-4" />}>
              Limpar
            </Button>
          )}
        </div>
      </FormField>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4 mr-2" />
          <div>{error}</div>
        </Alert>
      )}

      {/* Preview tabela */}
      {validated && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" badgeStyle="subtle">
                ✓ {stats.valid} válidas
              </Badge>
              {stats.invalid > 0 && (
                <Badge variant="destructive" badgeStyle="subtle">
                  ✗ {stats.invalid} com erro
                </Badge>
              )}
              <Badge variant="secondary" badgeStyle="subtle">
                Total: {stats.total}
              </Badge>
            </div>

            <div className="max-h-[320px] overflow-y-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 w-12">#</th>
                    <th className="text-left p-2 w-12">OK</th>
                    <th className="text-left p-2">Pergunta / Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((row, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        {row.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-success" aria-label="válida" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-destructive" aria-label="inválida" />
                        )}
                      </td>
                      <td className={cn('p-2 truncate max-w-md', !row.valid && 'text-destructive')}>
                        {row.valid
                          ? row.data.pergunta
                          : row.error || 'erro desconhecido'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dry-run result */}
      {importResult?.dryRun && (
        <Alert variant="info">
          <div className="text-sm">
            <strong>Dry-run OK:</strong> {importResult.questionsBefore} perguntas no curso → adicionar{' '}
            {importResult.questionsToAdd} → total final {importResult.questionsAfter}.
          </div>
        </Alert>
      )}

      {/* Apply result */}
      {importResult && importResult.success && !importResult.dryRun && !importResult.rolledBack && (
        <Alert variant="success">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <div className="text-sm">
            <strong>Import bem-sucedido!</strong> {importResult.questionsImported} perguntas adicionadas
            (total no curso: {importResult.questionsTotal}). ID: <code>{importResult.importId}</code>
          </div>
        </Alert>
      )}

      {importResult?.rolledBack && (
        <Alert variant="warning">
          <RotateCcw className="w-4 h-4 mr-2" />
          <div className="text-sm">Import revertido com sucesso.</div>
        </Alert>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleDryRun}
          disabled={!canApply || phase === 'dryrun'}
          leftIcon={phase === 'dryrun' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        >
          {phase === 'dryrun' ? 'Validando...' : 'Dry-run'}
        </Button>
        <Button
          variant="default"
          onClick={handleApply}
          disabled={!canApply || phase === 'applying' || phase === 'done'}
          leftIcon={phase === 'applying' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        >
          {phase === 'applying' ? 'Importando...' : `Importar ${validPerguntas.length} perguntas`}
        </Button>
        {importResult?.importId && !importResult.rolledBack && phase === 'done' && (
          <Button
            variant="destructive"
            onClick={handleRollback}
            disabled={rollbackBusy}
            leftIcon={rollbackBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          >
            {rollbackBusy ? 'Revertendo...' : 'Reverter (24h)'}
          </Button>
        )}
      </div>

      {/* T1.7.11: substituem window.confirm em handleApply e handleRollback */}
      <ConfirmDialog
        open={showApplyConfirm}
        onClose={() => setShowApplyConfirm(false)}
        onConfirm={confirmApply}
        title="Importar perguntas?"
        description={`${validPerguntas?.length || 0} perguntas serão adicionadas ao curso. Você pode reverter este import em até 24h.`}
        confirmText="Importar"
        cancelText="Cancelar"
      />

      <ConfirmDialog
        open={showRollbackConfirm}
        onClose={() => setShowRollbackConfirm(false)}
        onConfirm={confirmRollback}
        title="Reverter import?"
        description="Todas as perguntas adicionadas neste import serão removidas. Esta ação não pode ser desfeita."
        confirmText="Reverter"
        cancelText="Cancelar"
        variant="danger"
        loading={rollbackBusy}
      />
    </div>
  )
}
