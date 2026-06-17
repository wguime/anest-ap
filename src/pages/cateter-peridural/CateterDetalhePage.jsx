/**
 * CateterDetalhePage - Catheter detail with tabs: Dados + Evolução PO
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { Clock, Plus, ClipboardList, Pencil, Activity } from 'lucide-react'
import { Card, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent, EmptyState, SectionHeading } from '@/design-system'
import { PageHeader } from '@/components'
import { useToast } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useCateterPeridural } from '@/contexts/CateterPeridualContext'
import { useMessages } from '@/contexts/MessagesContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { getCateterRecipients, buildCateterNotificationPayload } from '@/utils/cateterNotifications'
import { CATETER_STATUS, BROMAGE_SCALE, calcHorasCateter, calcHorasSemAvaliacao, getEvolucaoAlertLevel, formatDuracaoHoras } from '@/data/cateterPeridualConfig'
import { formatDiaPoLabel } from '@/lib/cateterPo'
import { formatDate, formatDateTime } from '@/utils/formatters'
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
  const { createSystemNotification } = useMessages()
  const { users = [] } = useUsersManagement()
  const { toast } = useToast()
  const [followups, setFollowups] = useState([])
  const [loadingFollowups, setLoadingFollowups] = useState(true)
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('dados')
  const followupFormRef = useRef(null)

  // Ao abrir o form de evolução (inclusive vindo do botão na aba Dados, que troca
  // de aba), rolar até ele para não ficar abaixo do fold no mobile.
  useEffect(() => {
    if (showFollowupForm) {
      requestAnimationFrame(() => {
        followupFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [showFollowupForm])

  // Deep-link da inbox envia { cateterId } (cateterNotifications.js);
  // navegação interna envia { id }. Aceitar ambos.
  const cateterId = params?.id ?? params?.cateterId

  const cateter = useMemo(
    () => cateteres.find((c) => c.id === cateterId),
    [cateteres, cateterId]
  )

  useEffect(() => {
    if (!cateterId) return
    async function load() {
      try {
        const data = await fetchFollowups(cateterId)
        setFollowups(data)
      } catch (err) {
        console.error('[CateterDetalhe] Error loading followups:', err)
      } finally {
        setLoadingFollowups(false)
      }
    }
    load()
  }, [cateterId, fetchFollowups])

  if (!cateter) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <PageHeader title="Detalhe do Cateter" onBack={goBack} />
        <div className="px-4 py-8 text-center text-muted-foreground">
          Cateter não encontrado.
        </div>
      </div>
    )
  }

  const statusConfig = CATETER_STATUS[cateter.status] || CATETER_STATUS.ativo
  const horas = calcHorasCateter(cateter.dataInsercao)
  const dias = Math.floor(horas / 24)
  // Eixo "não evoluído": só conta a partir da última evolução real (sem fallback p/ inserção no texto).
  const horasSemAv = cateter.ultimaAvaliacaoAt ? calcHorasSemAvaliacao(cateter.ultimaAvaliacaoAt, null) : null
  const evolucaoLevel =
    cateter.status === 'ativo'
      ? getEvolucaoAlertLevel(cateter.ultimaAvaliacaoAt, cateter.dataInsercao)
      : 'normal'

  const handleRemove = async (dataRetirada, motivo) => {
    setSaving(true)
    try {
      await markAsRemoved(cateter.id, dataRetirada, motivo, {
        userId: user?.uid || user?.id,
        userName: user?.displayName,
      })

      // Notificar retirada (anestesistas + residentes)
      const recipientIds = getCateterRecipients(users)
      if (recipientIds.length > 0) {
        try {
          const payload = buildCateterNotificationPayload({
            evento: 'retirada',
            cateterId: cateter.id,
            pacienteNome: cateter.paciente,
            hospital: cateter.hospital,
            recipientIds,
          })
          await createSystemNotification(payload)
        } catch (notifErr) {
          console.warn('[CateterDetalhe] Falha notificando retirada:', notifErr)
          toast({
            title: 'Cateter retirado',
            description: 'Retirada registrada, mas a notificação à equipe falhou.',
            variant: 'warning',
          })
        }
      }

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
      const { retirada, ...followupFields } = followupData
      const result = await addFollowup(
        { ...followupFields, cateterId: cateter.id },
        { userId: user?.uid || user?.id, userName: user?.displayName }
      )
      setFollowups((prev) => [...prev, result])

      const recipientIds = getCateterRecipients(users)

      // Notificar evolução
      if (recipientIds.length > 0) {
        try {
          const payload = buildCateterNotificationPayload({
            evento: 'evolucao',
            cateterId: cateter.id,
            followupId: result?.id,
            pacienteNome: cateter.paciente,
            hospital: cateter.hospital,
            diaPo: followupFields.diaPo,
            recipientIds,
          })
          await createSystemNotification(payload)
        } catch (notifErr) {
          console.warn('[CateterDetalhe] Falha notificando evolução:', notifErr)
          toast({
            title: 'Avaliação registrada',
            description: 'Evolução salva, mas a notificação à equipe falhou.',
            variant: 'warning',
          })
        }
      }

      // Se retirada solicitada junto com a evolução
      if (retirada) {
        await markAsRemoved(cateter.id, retirada.dataRetirada, retirada.motivo, {
          userId: user?.uid || user?.id,
          userName: user?.displayName,
        })

        if (recipientIds.length > 0) {
          try {
            const payload = buildCateterNotificationPayload({
              evento: 'retirada',
              cateterId: cateter.id,
              pacienteNome: cateter.paciente,
              hospital: cateter.hospital,
              recipientIds,
            })
            await createSystemNotification(payload)
          } catch (notifErr) {
            console.warn('[CateterDetalhe] Falha notificando retirada:', notifErr)
            toast({
              title: 'Cateter retirado',
              description: 'Retirada registrada, mas a notificação à equipe falhou.',
              variant: 'warning',
            })
          }
        }
      }

      setShowFollowupForm(false)
      toast({
        title: retirada ? 'Avaliação registrada e cateter retirado' : 'Avaliação registrada',
        description: retirada
          ? `${formatDiaPoLabel(followupFields.diaPo)} registrado. Cateter marcado como retirado.`
          : `${formatDiaPoLabel(followupFields.diaPo)} registrado com sucesso.`,
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
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Detalhe do Cateter"
        onBack={goBack}
        actions={
          <button
            type="button"
            onClick={() => onNavigate('novoCateter', { cateterId: cateter.id })}
            className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px] px-1"
            aria-label="Editar dados do cateter"
          >
            <Pencil className="w-4 h-4" />
            <span className="text-sm font-medium">Editar</span>
          </button>
        }
      />

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
            <div className="mt-2 pt-2 border-t border-border space-y-1">
              <p className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {dias}d {horas % 24}h desde inserção
              </p>
              <p
                className={`text-xs ${
                  evolucaoLevel === 'critical'
                    ? 'text-destructive'
                    : evolucaoLevel === 'warning'
                      ? 'text-warning'
                      : 'text-muted-foreground'
                }`}
              >
                <Activity className="w-3 h-3 inline mr-1" />
                {cateter.ultimaAvaliacaoAt
                  ? `${formatDuracaoHoras(horasSemAv)} desde última evolução`
                  : 'Sem evolução registrada'}
              </p>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="default">
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
                <SectionHeading level={3} tone="muted" title="Paciente / Admin" className="mb-3" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoItem label="Cirurgia" value={cateter.cirurgia} />
                  <InfoItem
                    label="Data Cirurgia"
                    value={cateter.dataCirurgia ? formatDate(new Date(cateter.dataCirurgia)) : null}
                  />
                  <InfoItem label="Cirurgião" value={cateter.cirurgiao} />
                  <InfoItem label="Anestesiologista" value={cateter.anestesista} />
                  {cateter.residente && (
                    <InfoItem label="Residente" value={cateter.residente} />
                  )}
                </div>
              </Card>

              {/* Dados Técnicos — grid compacto */}
              <Card className="p-4">
                <SectionHeading level={3} tone="muted" title="Dados Técnicos" className="mb-3" />
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
                  <SectionHeading level={3} tone="muted" title="Transoperatório" className="mb-3" />
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
                  <SectionHeading level={3} tone="muted" title="Plano Pós-Operatório" className="mb-3" />
                  <p className="text-sm text-foreground">{cateter.planoPosOperatorio}</p>
                </Card>
              )}

              {/* Retirada info */}
              {cateter.status === 'retirado' && (
                <Card className="p-4">
                  <SectionHeading level={3} tone="muted" title="Retirada" className="mb-3" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <InfoItem
                      label="Data Retirada"
                      value={cateter.dataRetirada ? formatDate(new Date(cateter.dataRetirada)) : null}
                    />
                    <InfoItem label="Motivo" value={cateter.motivoRetirada} />
                  </div>
                </Card>
              )}

              {/* Botão evolução PO — direciona para aba de evolução */}
              {cateter.status === 'ativo' && (
                <div className="space-y-2">
                  <Button
                    variant="default"
                    className="w-full"
                    leftIcon={<ClipboardList className="w-4 h-4" />}
                    onClick={() => {
                      setActiveTab('evolucao')
                      setShowFollowupForm(true)
                    }}
                  >
                    Registrar Evolução PO
                  </Button>
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Para retirar o cateter, registre uma evolução PO e ative a opção de retirada no formulário.
                  </p>
                </div>
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
                    label: 'Registrar evolução PO',
                    onClick: () => setShowFollowupForm(true),
                  } : undefined}
                />
              ) : (
                followups.map((fu) => (
                  <Card key={fu.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        {formatDiaPoLabel(fu.diaPo)}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(fu.dataAvaliacao || fu.createdAt)}
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
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Bromage: </span>
                          <span className="text-foreground">{bromageLabel(fu.bromageScore)}</span>
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
                    {(fu.anestesistaNome || fu.residenteNome || fu.avaliadoPorNome) && (
                      <div className="text-[11px] text-muted-foreground pt-2 mt-2 border-t border-border space-y-0.5">
                        {fu.anestesistaNome && (
                          <p>Anestesiologista: {fu.anestesistaNome}</p>
                        )}
                        {fu.residenteNome && (
                          <p>Residente: {fu.residenteNome}</p>
                        )}
                        {fu.avaliadoPorNome && (
                          <p>Registrado por: {fu.avaliadoPorNome}</p>
                        )}
                      </div>
                    )}
                  </Card>
                ))
              )}

              {/* Add followup */}
              {cateter.status === 'ativo' && (
                <>
                  {showFollowupForm ? (
                    <div ref={followupFormRef}>
                      <FollowupForm
                        dataInsercao={cateter.dataInsercao}
                        hospital={cateter.hospital}
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
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowFollowupForm(true)}
                        leftIcon={<Plus className="w-4 h-4" />}
                      >
                        Adicionar evolução PO
                      </Button>

                      <p className="text-xs text-muted-foreground text-center px-4">
                        Para retirar o cateter, registre uma evolução PO e ative a opção de retirada no formulário.
                      </p>
                    </div>
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
