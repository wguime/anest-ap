import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BottomNav, Textarea, Input, Select, Button, Spinner } from '@/design-system'
import { ChevronLeft, GraduationCap, Plus, Trash2, Clock } from 'lucide-react'
import { useAutoavaliacao } from '@/contexts/AutoavaliacaoContext'
import { useUser } from '@/contexts/UserContext'
import { AVALIACAO_STATUS, EVIDENCE_TYPES, AREA_CONFIG } from '@/data/autoavaliacaoConfig'
import ropsData from '@/data/rops-data'

const statusOptions = Object.entries(AVALIACAO_STATUS).map(([key, cfg]) => {
  const Icon = cfg.icon
  return { key, ...cfg }
})

const evidenceTypeOptions = EVIDENCE_TYPES.map((t) => ({ value: t.id, label: t.label }))

function EvidenciaRow({ evidencia, index, onChange, onRemove }) {
  return (
    <div className="bg-muted rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Evidencia {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-destructive hover:opacity-70 transition-opacity"
          aria-label="Remover evidencia"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <Select
        options={evidenceTypeOptions}
        value={evidencia.tipo}
        onChange={(v) => onChange(index, 'tipo', v)}
        placeholder="Tipo de evidencia"
        size="sm"
      />
      <Input
        value={evidencia.descricao}
        onChange={(e) => onChange(index, 'descricao', e.target.value)}
        placeholder="Descricao da evidencia"
        size="sm"
      />
      <Input
        value={evidencia.referencia}
        onChange={(e) => onChange(index, 'referencia', e.target.value)}
        placeholder="Referencia (codigo, link, etc.)"
        size="sm"
      />
    </div>
  )
}

export default function AutoavaliacaoRopPage({ onNavigate, goBack, params }) {
  const { areaKey, ropId } = params || {}
  const { getAvaliacaoByRop, upsertAvaliacao, loading } = useAutoavaliacao()
  const { user } = useUser()
  const { cicloAtual } = useAutoavaliacao()

  const ropTitle = useMemo(() => {
    try {
      return ropsData[areaKey]?.subdivisoes?.[ropId]?.title || ropId
    } catch {
      return ropId
    }
  }, [areaKey, ropId])

  const areaConfig = AREA_CONFIG[areaKey]
  const existing = getAvaliacaoByRop(ropId)

  const [status, setStatus] = useState('nao_avaliado')
  const [observacoes, setObservacoes] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [prazo, setPrazo] = useState('')
  const [evidencias, setEvidencias] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Populate form from existing avaliacao
  useEffect(() => {
    if (existing) {
      setStatus(existing.status || 'nao_avaliado')
      setObservacoes(existing.observacoes || '')
      setResponsavel(existing.responsavelNome || user?.displayName || '')
      setPrazo(existing.prazo || '')
      setEvidencias(
        (existing.evidencias || []).map((e) => ({
          tipo: e.tipo || 'documento',
          descricao: e.descricao || '',
          referencia: e.referencia || '',
        }))
      )
    } else {
      setResponsavel(user?.displayName || '')
    }
  }, [existing, user?.displayName])

  const handleEvidenciaChange = (idx, field, value) => {
    setEvidencias((prev) => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const handleRemoveEvidencia = (idx) => {
    setEvidencias((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleAddEvidencia = () => {
    setEvidencias((prev) => [...prev, { tipo: 'documento', descricao: '', referencia: '' }])
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await upsertAvaliacao(
        {
          ...(existing || {}),
          ropId,
          ropArea: areaKey,
          ciclo: cicloAtual,
          status,
          observacoes: observacoes.trim() || null,
          evidencias: evidencias.filter((e) => e.descricao.trim()),
          responsavelNome: responsavel.trim() || null,
          responsavelId: user?.uid || user?.id || null,
          prazo: prazo || null,
          avaliadoEm: new Date().toISOString(),
        },
        { uid: user?.uid || user?.id, displayName: user?.displayName }
      )
      setSaved(true)
      setTimeout(() => goBack(), 800)
    } catch (err) {
      console.error('[AutoavaliacaoRopPage] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-primary dark:text-foreground truncate text-center flex-1 mx-2">
            Avaliar ROP
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {/* ROP info */}
        <div className="rounded-[20px] p-4 border bg-primary/10 border-primary/20">
          <p className="text-xs text-muted-foreground mb-1">
            {areaConfig?.title}
          </p>
          <h2 className="text-sm font-semibold text-primary dark:text-foreground">
            {ropTitle}
          </h2>
        </div>

        {/* Status selection */}
        <div>
          <label className="block text-sm font-semibold text-primary dark:text-primary mb-3">
            Status da Avaliacao
          </label>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((opt) => {
              const Icon = opt.icon
              const isSelected = status === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatus(opt.key)}
                  className={`flex items-center gap-2 p-3 rounded-[20px] border-2 transition-all text-left ${
                    isSelected
                      ? 'shadow-sm'
                      : 'border-border-strong bg-card'
                  }`}
                  style={
                    isSelected
                      ? {
                          borderColor: opt.color,
                          backgroundColor: opt.bgColor,
                        }
                      : undefined
                  }
                >
                  <Icon
                    className="w-5 h-5 shrink-0"
                    style={{ color: isSelected ? opt.color : '#9CA3AF' }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: isSelected ? opt.color : undefined }}
                  >
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Observacoes */}
        <Textarea
          label="Observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Descreva a avaliacao, achados, pendencias..."
          rows={4}
        />

        {/* Responsavel */}
        <Input
          label="Responsavel"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          placeholder="Nome do responsavel pela avaliacao"
        />

        {/* Prazo */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Prazo para avaliacao (opcional — padrao: fim do ciclo)
          </label>
          <Input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Evidencias */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-primary dark:text-primary">
              Evidencias
            </label>
            <button
              type="button"
              onClick={handleAddEvidencia}
              className="flex items-center gap-1 text-xs font-medium text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {evidencias.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma evidencia adicionada.
            </p>
          ) : (
            <div className="space-y-3">
              {evidencias.map((ev, idx) => (
                <EvidenciaRow
                  key={idx}
                  evidencia={ev}
                  index={idx}
                  onChange={handleEvidenciaChange}
                  onRemove={() => handleRemoveEvidencia(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving || status === 'nao_avaliado'}
          className="w-full"
        >
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Avaliacao'}
        </Button>

        {saved && (
          <p className="text-center text-sm text-success font-medium">
            Avaliacao salva com sucesso!
          </p>
        )}
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground" fill="none" />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home')
          else if (item.id === 'shield') onNavigate('gestao')
          else if (item.id === 'education') onNavigate('educacao')
          else if (item.id === 'menu') onNavigate('menuPage')
        }}
      />
    </div>
  )
}
