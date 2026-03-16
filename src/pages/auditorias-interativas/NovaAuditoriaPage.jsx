/**
 * NovaAuditoriaPage - Wizard de 3 passos para criar nova auditoria
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BottomNav,
  Stepper,
  Card,
  Input,
  Select,
  DatePicker,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Check,
  ClipboardCheck,
  MapPin,
  User,
} from 'lucide-react'
import { useAuditoriasInterativas } from '@/contexts/AuditoriasInterativasContext'
import { useUser } from '@/contexts/UserContext'
import { AUDIT_TEMPLATES } from '@/data/auditoriaTemplatesConfig'
import { AUDITORIA_TIPO_CONFIG, AUDITORIA_SETORES } from '@/data/auditoriasConfig'

const STEPS = [
  { label: 'Tipo' },
  { label: 'Detalhes' },
  { label: 'Revisao' },
]

export default function NovaAuditoriaPage({ onNavigate, goBack }) {
  const { addExecucao } = useAuditoriasInterativas()
  const { user } = useUser()

  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTipo, setSelectedTipo] = useState(null)
  const [setor, setSetor] = useState('')
  const [dataAuditoria, setDataAuditoria] = useState(new Date().toISOString().split('T')[0])
  const [auditorNome, setAuditorNome] = useState(user?.displayName || user?.firstName || '')
  const [prazo, setPrazo] = useState('')

  const template = selectedTipo ? AUDIT_TEMPLATES[selectedTipo] : null
  const tipoConfig = selectedTipo ? AUDITORIA_TIPO_CONFIG[selectedTipo] : null

  const canNext = () => {
    if (currentStep === 0) return !!selectedTipo
    if (currentStep === 1) return !!setor && !!dataAuditoria && !!auditorNome
    return true
  }

  const handleNext = () => {
    if (currentStep < 2) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
    else goBack()
  }

  const handleIniciar = async () => {
    const setorObj = AUDITORIA_SETORES.find((s) => s.id === setor)
    const newExecucao = await addExecucao(
      {
        templateTipo: selectedTipo,
        titulo: `${template.titulo} - ${setorObj?.nome || setor}`,
        setorId: setor,
        setorNome: setorObj?.nome || setor,
        dataAuditoria,
        auditorNome,
        auditorId: user?.uid || user?.id || null,
        prazo: prazo || null,
        status: 'em_andamento',
      },
      { userId: user?.uid || user?.id, userName: auditorNome }
    )
    if (newExecucao) {
      onNavigate('execucaoAuditoria', { execucaoId: newExecucao.id })
    }
  }

  // Header
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-primary dark:text-foreground truncate text-center flex-1 mx-2">
            Nova Auditoria
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
        {/* Stepper */}
        <div className="mb-6">
          <Stepper currentStep={currentStep} steps={STEPS} variant="simple" />
        </div>

        {/* Step 1: Tipo */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
              Selecione o Tipo de Auditoria
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(AUDIT_TEMPLATES).map(([key, tpl]) => {
                const config = AUDITORIA_TIPO_CONFIG[key] || {}
                const Icon = config.icon || ClipboardCheck
                const isSelected = selectedTipo === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTipo(key)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95 text-center',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border-strong bg-card hover:border-border'
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-foreground leading-tight">
                      {config.label || tpl.titulo}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {tpl.items.length} itens
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Detalhes */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
              Detalhes da Auditoria
            </h2>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Setor
              </label>
              <Select
                options={AUDITORIA_SETORES.map((s) => ({ value: s.id, label: s.nome }))}
                value={setor}
                onChange={(val) => setSetor(val)}
                placeholder="Selecione o setor"
              />
            </div>

            <DatePicker
              label="Data da Auditoria"
              value={dataAuditoria ? new Date(dataAuditoria + 'T00:00:00') : null}
              onChange={(date) => setDataAuditoria(date ? date.toISOString().split('T')[0] : '')}
              placeholder="Selecione a data"
            />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Nome do Auditor
              </label>
              <Input
                type="text"
                value={auditorNome}
                onChange={(e) => setAuditorNome(e.target.value)}
                placeholder="Nome do auditor"
              />
            </div>

            <div>
              <DatePicker
                label="Prazo para conclusao"
                value={prazo ? new Date(prazo + 'T00:00:00') : null}
                onChange={(date) => setPrazo(date ? date.toISOString().split('T')[0] : '')}
                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                placeholder="dd/mm/aaaa"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Opcional — define o prazo limite para finalizar a auditoria
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Revisao */}
        {currentStep === 2 && template && (
          <div>
            <h2 className="text-sm font-semibold text-primary dark:text-foreground mb-3">
              Revise os Dados
            </h2>
            <div className="bg-card rounded-[20px] border border-border-strong p-4 space-y-3">
              <div className="flex items-center gap-3">
                {tipoConfig && (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                    <tipoConfig.icon className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tipoConfig?.label || template.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {template.items.length} itens no checklist
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Setor</span>
                  <span className="font-medium text-foreground">
                    {AUDITORIA_SETORES.find((s) => s.id === setor)?.nome || setor}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Data</span>
                  <span className="font-medium text-foreground">
                    {new Date(dataAuditoria + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Auditor</span>
                  <span className="font-medium text-foreground">{auditorNome}</span>
                </div>
                {prazo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prazo</span>
                    <span className="font-medium text-foreground">
                      {new Date(prazo + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center gap-3 mt-6">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 h-11 rounded-xl border-2 border-primary text-primary font-semibold text-sm active:scale-95 transition-all"
            >
              Voltar
            </button>
          )}
          {currentStep < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext()}
              className={cn(
                'flex-1 h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all',
                canNext()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Proximo
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleIniciar}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              Iniciar Auditoria
            </button>
          )}
        </div>
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
