/**
 * AuditoriaResultadoPage - Resultado de uma auditoria concluida
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BottomNav,
  Badge,
  useToast,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import {
  ChevronLeft,
  GraduationCap,
  AlertTriangle,
  FileText,
  MapPin,
  Calendar,
  User,
  Users,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { useAuditoriasInterativas } from '@/contexts/AuditoriasInterativasContext'
import { useUser } from '@/contexts/UserContext'
import { usePlanosAcao } from '@/contexts/PlanosAcaoContext'
import { AUDIT_TEMPLATES } from '@/data/auditoriaTemplatesConfig'
import { getAuditoriaTipoConfig } from '@/data/auditoriasConfig'
import AuditScoreCard from './components/AuditScoreCard'

export default function AuditoriaResultadoPage({ onNavigate, goBack, params }) {
  const execucaoId = params?.execucaoId
  const { getExecucaoById } = useAuditoriasInterativas()
  const { addPlano } = usePlanosAcao()
  const { toast } = useToast()
  const { user } = useUser()
  const roleKey = (user?.role || '').toLowerCase()
  const isAdmin = !!(user?.isAdmin || user?.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador')

  const execucao = getExecucaoById(execucaoId)
  const template = execucao ? AUDIT_TEMPLATES[execucao.templateTipo] : null
  const tipoConfig = execucao ? getAuditoriaTipoConfig(execucao.templateTipo) : null

  const [createdPlanos, setCreatedPlanos] = useState({})

  // Get respostas in the correct format
  const respostas = execucao?.respostas || {}

  // Score breakdown
  const scoreData = useMemo(() => {
    if (!respostas || !template) return { conformes: 0, naoConformes: 0, naoAplicaveis: 0, total: 0 }

    let conformes = 0
    let naoConformes = 0
    let naoAplicaveis = 0

    Object.values(respostas).forEach((r) => {
      const val = r?.resposta || (typeof r === 'string' ? r : null)
      if (val === 'C') conformes++
      else if (val === 'NC') naoConformes++
      else if (val === 'NA') naoAplicaveis++
    })

    return {
      conformes,
      naoConformes,
      naoAplicaveis,
      total: conformes + naoConformes + naoAplicaveis,
    }
  }, [respostas, template])

  // NC items
  const ncItems = useMemo(() => {
    if (!template || !respostas) return []
    return template.items.filter((item) => {
      const r = respostas[item.id]
      const val = r?.resposta || (typeof r === 'string' ? r : null)
      return val === 'NC'
    }).map((item) => ({
      ...item,
      observacao: respostas[item.id]?.observacao || '',
    }))
  }, [template, respostas])

  const handleGerarPlano = async (item) => {
    try {
      const plano = await addPlano(
        {
          titulo: `NC: ${item.label}`,
          descricao: `Nao conformidade identificada na auditoria "${execucao.titulo}".\n\nItem: ${item.label}\nCategoria: ${item.category || 'Geral'}\n${item.observacao ? `Observacao: ${item.observacao}` : ''}`,
          tipoOrigem: 'auditoria',
          origemId: execucaoId,
          origemDescricao: `${execucao.titulo} - ${item.label}`,
          prioridade: 'media',
          status: 'planejamento',
          fasePdca: 'plan',
          responsavelNome: execucao.auditorNome || '',
        },
        { userId: execucao.auditorId, userName: execucao.auditorNome }
      )
      if (plano) {
        setCreatedPlanos((prev) => ({ ...prev, [item.id]: plano.id }))
        toast({
          title: 'Plano de acao criado',
          description: `Plano criado para: ${item.label}`,
          variant: 'success',
        })
      }
    } catch (err) {
      console.error('Erro ao criar plano de acao:', err)
      toast({
        title: 'Erro',
        description: 'Nao foi possivel criar o plano de acao.',
        variant: 'error',
      })
    }
  }

  if (!execucao || !template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Auditoria nao encontrada.</p>
      </div>
    )
  }

  const dataFormatada = execucao.dataAuditoria
    ? new Date(execucao.dataAuditoria + 'T00:00:00').toLocaleDateString('pt-BR')
    : '-'

  // Header
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
            Resultado
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
        {/* Info Card */}
        <div className="rounded-[20px] border border-border-strong bg-card p-4 mb-4">
          <div className="flex items-start gap-3 mb-3">
            {tipoConfig && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                <tipoConfig.icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-primary dark:text-foreground leading-snug">
                {execucao.titulo}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {tipoConfig && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                    {tipoConfig.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-success">
                  <CheckCircle2 className="w-3 h-3" />
                  Concluida
                </span>
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            {execucao.setorNome && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {execucao.setorNome}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dataFormatada}
            </span>
            {execucao.auditorNome && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {execucao.auditorNome}
              </span>
            )}
            {execucao.tamanhoAmostra && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                n={execucao.tamanhoAmostra}
              </span>
            )}
          </div>
        </div>

        {/* Score Card */}
        <AuditScoreCard
          score={execucao.scoreConformidade || 0}
          totalItems={scoreData.total}
          conformes={scoreData.conformes}
          naoConformes={scoreData.naoConformes}
          naoAplicaveis={scoreData.naoAplicaveis}
        />

        {/* NC Items */}
        {ncItems.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Nao Conformidades ({ncItems.length})
            </h3>
            <div className="space-y-3">
              {ncItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-card rounded-[20px] border border-destructive/30 p-4"
                >
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  {item.category && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.category}
                    </p>
                  )}
                  {item.observacao && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      "{item.observacao}"
                    </p>
                  )}
                  <div className="mt-3">
                    {createdPlanos[item.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        Plano de acao criado
                      </span>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleGerarPlano(item)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Gerar Plano de Acao
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back to hub */}
        <button
          type="button"
          onClick={() => onNavigate('auditoriasInterativas')}
          className="w-full h-11 rounded-xl border-2 border-primary text-primary font-semibold text-sm flex items-center justify-center gap-2 mt-6 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Auditorias
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
