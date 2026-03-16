/**
 * CateterDetalhePage - Catheter detail with tabs: Dados + Evolução PO
 */
import { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  Clock,
  Plus,
} from 'lucide-react'
import {
  Card,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
} from '@/design-system'
import { useToast } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useCateterPeridural } from '@/contexts/CateterPeridualContext'
import { CATETER_STATUS, BROMAGE_SCALE, calcHorasCateter } from '@/data/cateterPeridualConfig'
import AlertaDuracao from './components/AlertaDuracao'
import FollowupForm from './components/FollowupForm'
import RemoverCateterModal from './components/RemoverCateterModal'

function InfoItem({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  )
}

export default function CateterDetalhePage({ onNavigate, goBack, params }) {
  const { user } = useUser()
  const { cateteres, markAsRemoved, fetchFollowups, addFollowup } = useCateterPeridural()
  const { toast } = useToast()
  const [followups, setFollowups] = useState([])
  const [loadingFollowups, setLoadingFollowups] = useState(true)
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const cateter = useMemo(
    () => cateteres.find((c) => c.id === params?.id),
    [cateteres, params?.id]
  )

  useEffect(() => {
    if (!params?.id) return
    async function load() {
      try {
        const data = await fetchFollowups(params.id)
        setFollowups(data)
      } catch (err) {
        console.error('[CateterDetalhe] Error loading followups:', err)
      } finally {
        setLoadingFollowups(false)
      }
    }
    load()
  }, [params?.id, fetchFollowups])

  if (!cateter) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border-strong shadow-sm">
          <div className="px-4 sm:px-5 py-3">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary-hover dark:text-primary"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
        </nav>
        <div className="h-14" />
        <div className="px-4 py-8 text-center text-muted-foreground">
          Cateter não encontrado.
        </div>
      </div>
    )
  }

  const statusConfig = CATETER_STATUS[cateter.status] || CATETER_STATUS.ativo
  const horas = calcHorasCateter(cateter.dataInsercao)
  const dias = Math.floor(horas / 24)
  const nextDiaPo = followups.length > 0 ? Math.max(...followups.map((f) => f.diaPo)) + 1 : 1

  const handleRemove = async (dataRetirada, motivo) => {
    setSaving(true)
    try {
      await markAsRemoved(cateter.id, dataRetirada, motivo, {
        userId: user?.uid,
        userName: user?.displayName,
      })
      setShowRemoveModal(false)
      toast({
        title: 'Cateter retirado',
        description: 'Status atualizado para retirado.',
        variant: 'success',
      })
    } catch (err) {
      console.error('[CateterDetalhe] Error removing:', err)
      toast({ title: 'Erro ao retirar', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddFollowup = async (followupData) => {
    setSaving(true)
    try {
      const result = await addFollowup(
        { ...followupData, cateterId: cateter.id },
        { userId: user?.uid, userName: user?.displayName }
      )
      setFollowups((prev) => [...prev, result])
      setShowFollowupForm(false)
      toast({
        title: 'Avaliação registrada',
        description: `${followupData.diaPo}o PO registrado com sucesso.`,
        variant: 'success',
      })
    } catch (err) {
      console.error('[CateterDetalhe] Error adding followup:', err)
      toast({ title: 'Erro', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const bromageLabel = (score) => {
    const item = BROMAGE_SCALE.find((b) => b.value === score)
    return item ? item.label : `${score}`
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border-strong shadow-sm">
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
            <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
              Detalhe do Cateter
            </h1>
            <div className="min-w-[70px]" />
          </div>
        </div>
      </nav>

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 flex flex-col gap-3">
        {/* Alert banner */}
        {cateter.status === 'ativo' && (
          <AlertaDuracao dataInsercao={cateter.dataInsercao} />
        )}

        {/* Patient header card */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-base font-semibold text-foreground">
              {cateter.paciente}
            </h2>
            <Badge variant={statusConfig.variant} badgeStyle="solid">
              {statusConfig.label}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <InfoItem label="Leito" value={cateter.leito} />
            <InfoItem label="Nível" value={cateter.nivelPuncao} />
            <InfoItem label="CPD" value={cateter.tamanhoCpd} />
          </div>
          {cateter.status === 'ativo' && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
              <Clock className="w-3 h-3 inline mr-1" />
              {dias}d {horas % 24}h desde inserção
            </p>
          )}
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="dados" variant="default">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="evolucao">
              Evolução PO ({followups.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dados */}
          <TabsContent value="dados" className="mt-3">
            <div className="space-y-3">
              {/* Paciente / Admin — grid compacto */}
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Paciente / Admin
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoItem label="Cirurgia" value={cateter.cirurgia} />
                  <InfoItem
                    label="Data Cirurgia"
                    value={cateter.dataCirurgia ? new Date(cateter.dataCirurgia).toLocaleDateString('pt-BR') : null}
                  />
                  <InfoItem label="Cirurgião" value={cateter.cirurgiao} />
                  <InfoItem label="Anestesista" value={cateter.anestesista} />
                </div>
              </Card>

              {/* Dados Técnicos — grid compacto */}
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Dados Técnicos
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoItem label="Nível Punção" value={cateter.nivelPuncao} />
                  <InfoItem label="Tamanho CPD" value={cateter.tamanhoCpd} />
                  <InfoItem label="Marca Pele" value={cateter.marcaCpdPele ? `${cateter.marcaCpdPele} cm` : null} />
                  <InfoItem label="Marca Dentro" value={cateter.marcaCpdDentro ? `${cateter.marcaCpdDentro} cm` : null} />
                  <InfoItem
                    label="Inserção"
                    value={cateter.dataInsercao ? new Date(cateter.dataInsercao).toLocaleString('pt-BR') : null}
                  />
                </div>
              </Card>

              {/* Transoperatório */}
              {(cateter.dosesTransoperatorias || cateter.repiqueSrpa) && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Transoperatório
                  </h3>
                  <div className="space-y-2">
                    {cateter.dosesTransoperatorias && (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Doses Transoperatórias</p>
                        <p className="text-sm text-foreground">{cateter.dosesTransoperatorias}</p>
                      </div>
                    )}
                    {cateter.repiqueSrpa && (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Repique SRPA</p>
                        <p className="text-sm text-foreground">{cateter.repiqueSrpa}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Plano Pós-Operatório */}
              {cateter.planoPosOperatorio && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Plano Pós-Operatório
                  </h3>
                  <p className="text-sm text-foreground">{cateter.planoPosOperatorio}</p>
                </Card>
              )}

              {/* Retirada info */}
              {cateter.status === 'retirado' && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Retirada
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <InfoItem
                      label="Data Retirada"
                      value={cateter.dataRetirada ? new Date(cateter.dataRetirada).toLocaleDateString('pt-BR') : null}
                    />
                    <InfoItem label="Motivo" value={cateter.motivoRetirada} />
                  </div>
                </Card>
              )}

              {/* Botão retirar */}
              {cateter.status === 'ativo' && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowRemoveModal(true)}
                >
                  Retirar Cateter
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Tab: Evolução PO */}
          <TabsContent value="evolucao" className="mt-3">
            <div className="space-y-3">
              {loadingFollowups ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Card key={i} className="p-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </Card>
                  ))}
                </div>
              ) : followups.length === 0 && !showFollowupForm ? (
                <EmptyState
                  title="Sem evolução PO"
                  description="Nenhuma avaliação registrada ainda."
                  action={cateter.status === 'ativo' ? {
                    label: `Adicionar ${nextDiaPo}o PO`,
                    onClick: () => setShowFollowupForm(true),
                  } : undefined}
                />
              ) : (
                followups.map((fu) => (
                  <Card key={fu.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        {fu.diaPo}o PO
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {fu.createdAt ? new Date(fu.createdAt).toLocaleDateString('pt-BR') : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {fu.planoDia && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Plano: </span>
                          <span className="text-foreground">{fu.planoDia}</span>
                        </div>
                      )}
                      {fu.sitioInsercao && (
                        <div>
                          <span className="text-muted-foreground">Sítio: </span>
                          <Badge
                            variant={fu.sitioInsercao === 'Normal' ? 'success' : 'warning'}
                            badgeStyle="subtle"
                            className="text-[10px]"
                          >
                            {fu.sitioInsercao}
                          </Badge>
                        </div>
                      )}
                      {fu.bromageScore != null && (
                        <div>
                          <span className="text-muted-foreground">Bromage: </span>
                          <span className="text-foreground">{fu.bromageScore}</span>
                        </div>
                      )}
                      {fu.nivelSensitivo && (
                        <div>
                          <span className="text-muted-foreground">Nível: </span>
                          <span className="text-foreground">{fu.nivelSensitivo}</span>
                        </div>
                      )}
                      {fu.marcaPeleAtual != null && (
                        <div>
                          <span className="text-muted-foreground">Marca pele: </span>
                          <span className="text-foreground">{fu.marcaPeleAtual} cm</span>
                        </div>
                      )}
                      {fu.taxaInfusao && (
                        <div>
                          <span className="text-muted-foreground">Infusão: </span>
                          <span className="text-foreground">{fu.taxaInfusao}</span>
                        </div>
                      )}
                      {fu.complicacoes && (
                        <div>
                          <span className="text-muted-foreground">Compl.: </span>
                          <Badge variant="destructive" badgeStyle="subtle" className="text-[10px]">
                            {fu.complicacoes}
                          </Badge>
                        </div>
                      )}
                      {fu.observacoes && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Obs: </span>
                          <span className="text-foreground">{fu.observacoes}</span>
                        </div>
                      )}
                    </div>
                    {fu.avaliadoPorNome && (
                      <p className="text-[11px] text-muted-foreground pt-2 mt-2 border-t border-border">
                        Avaliado por: {fu.avaliadoPorNome}
                      </p>
                    )}
                  </Card>
                ))
              )}

              {/* Add followup */}
              {cateter.status === 'ativo' && (
                <>
                  {showFollowupForm ? (
                    <div>
                      <FollowupForm
                        diaPo={nextDiaPo}
                        onSubmit={handleAddFollowup}
                        saving={saving}
                      />
                      <Button
                        variant="ghost"
                        className="w-full mt-2"
                        onClick={() => setShowFollowupForm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowFollowupForm(true)}
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      Adicionar {nextDiaPo}o PO
                    </Button>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Remove Modal */}
      <RemoverCateterModal
        open={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={handleRemove}
        saving={saving}
      />
    </div>
  )
}
