/**
 * ExecucaoAuditoriaPage - Execucao interativa de checklist de auditoria
 */
import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  BottomNav,
  Progress,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import {
  ChevronLeft,
  GraduationCap,
  CheckCircle2,
  Calendar,
  MapPin,
} from 'lucide-react'
import { useAuditoriasInterativas } from '@/contexts/AuditoriasInterativasContext'
import { AUDIT_TEMPLATES, calcularScore } from '@/data/auditoriaTemplatesConfig'
import { getAuditoriaTipoConfig } from '@/data/auditoriasConfig'
import DeadlineBadge from '@/components/DeadlineBadge'
import AuditChecklistItem from './components/AuditChecklistItem'

export default function ExecucaoAuditoriaPage({ onNavigate, goBack, params }) {
  const execucaoId = params?.execucaoId
  const { getExecucaoById, updateExecucao, finalizeExecucao } = useAuditoriasInterativas()
  const execucao = getExecucaoById(execucaoId)
  const [localRespostas, setLocalRespostas] = useState(execucao?.respostas || {})
  const [isFinalizing, setIsFinalizing] = useState(false)

  const template = execucao ? AUDIT_TEMPLATES[execucao.templateTipo] : null
  const items = template?.items || []
  const tipoConfig = execucao ? getAuditoriaTipoConfig(execucao.templateTipo) : null
  const TipoIcon = tipoConfig?.icon

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups = {}
    items.forEach((item) => {
      const cat = item.category || 'Geral'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    return Object.entries(groups)
  }, [items])

  // Progress
  const answeredCount = Object.values(localRespostas).filter((r) => r?.resposta || (typeof r === 'string' && r)).length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  const handleRespostaChange = useCallback((itemId, respostaData) => {
    setLocalRespostas((prev) => {
      const next = { ...prev, [itemId]: respostaData }
      // Build simple respostas map for calcularScore
      const simpleRespostas = {}
      Object.entries(next).forEach(([key, val]) => {
        if (val?.resposta) simpleRespostas[key] = val.resposta
        else if (typeof val === 'string') simpleRespostas[key] = val
      })
      // Auto-save
      if (execucao) {
        updateExecucao(execucao.id, { respostas: next })
      }
      return next
    })
  }, [execucao, updateExecucao])

  const handleFinalizar = async () => {
    if (isFinalizing) return
    setIsFinalizing(true)
    try {
      // Build simple respostas for score calc
      const simpleRespostas = {}
      Object.entries(localRespostas).forEach(([key, val]) => {
        if (val?.resposta) simpleRespostas[key] = val.resposta
        else if (typeof val === 'string') simpleRespostas[key] = val
      })

      const score = calcularScore(simpleRespostas)
      // Save final respostas before finalizing
      await updateExecucao(execucao.id, { respostas: localRespostas })
      await finalizeExecucao(execucao.id, score)
      onNavigate('auditoriaResultado', { execucaoId: execucao.id })
    } catch (err) {
      console.error('Erro ao finalizar auditoria:', err)
      setIsFinalizing(false)
    }
  }

  if (!execucao || !template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Auditoria nao encontrada.</p>
      </div>
    )
  }

  // Header - clean nav matching "painel de etica" style
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
            Auditoria Interativa
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Audit info card */}
        <div className="rounded-[20px] border border-border-strong bg-card p-4 mb-5">
          {/* Título e tipo */}
          <div className="flex items-start gap-3">
            {TipoIcon && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                <TipoIcon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-foreground dark:text-white leading-snug">
                {execucao.titulo}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {tipoConfig && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                    {tipoConfig.label}
                  </span>
                )}
                {execucao.setorNome && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {execucao.setorNome}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progresso */}
          <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {answeredCount} de {totalCount} respondidos
              </span>
              <span className="font-bold text-foreground dark:text-white tabular-nums">{progressPercent}%</span>
            </div>
            <Progress
              value={progressPercent}
              size="sm"
              variant={progressPercent >= 100 ? 'success' : progressPercent >= 50 ? 'warning' : 'error'}
            />
          </div>

          {/* Data e prazo */}
          {(execucao.dataAuditoria || (execucao.prazo && execucao.status !== 'concluida')) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
              {execucao.dataAuditoria && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 shrink-0" />
                  Data: {new Date(execucao.dataAuditoria + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              {execucao.prazo && execucao.status !== 'concluida' && (
                <DeadlineBadge prazo={execucao.prazo} compact showDays />
              )}
            </div>
          )}
        </div>

        {groupedItems.map(([category, catItems]) => (
          <div key={category} className="mb-6">
            <h3 className="text-xs font-semibold text-primary-hover dark:text-primary uppercase tracking-wider mb-3">
              {category}
            </h3>
            <div className="space-y-3">
              {catItems.map((item, idx) => (
                <AuditChecklistItem
                  key={item.id}
                  item={item}
                  index={idx + 1}
                  resposta={localRespostas[item.id]}
                  onRespostaChange={handleRespostaChange}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Finalizar button */}
        <button
          type="button"
          onClick={handleFinalizar}
          disabled={isFinalizing || answeredCount === 0}
          className={cn(
            'w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all',
            answeredCount > 0 && !isFinalizing
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          <CheckCircle2 className="w-5 h-5" />
          {isFinalizing ? 'Finalizando...' : 'Finalizar Auditoria'}
        </button>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground"
                fill="none"
              />
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
