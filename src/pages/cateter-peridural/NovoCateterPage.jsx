/**
 * NovoCateterPage - Form to register (or edit) an epidural catheter
 */
import { useState, useEffect, useRef } from 'react'
import { Save } from 'lucide-react'
import { Card, Button, Input, Select, Textarea, DatePicker, DateTimePicker } from '@/design-system'
import { PageHeader } from '@/components'
import { useToast } from '@/design-system'
import { useHaptic } from '@/design-system/hooks'
import { useUser } from '@/contexts/UserContext'
import { useCateterPeridural } from '@/contexts/CateterPeridualContext'
import { useMessages } from '@/contexts/MessagesContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { getCateterRecipients, buildCateterNotificationPayload } from '@/utils/cateterNotifications'
import { HOSPITAIS_OPTIONS } from '@/data/cateterPeridualConfig'
import { requireUserId } from '@/utils/audit'
import { parseLocalDate, toLocalISODate } from '@/utils/dateUtils'
import useProfissionaisCateter from '@/hooks/useProfissionaisCateter'

const initialForm = {
  hospital: 'unimed',
  paciente: '',
  leito: '',
  cirurgia: '',
  dataCirurgia: null,
  cirurgiao: '',
  anestesista: '',
  residente: '',
  nivelPuncao: '',
  tamanhoCpd: '',
  marcaCpdPele: '',
  marcaCpdDentro: '',
  dosesTransoperatorias: '',
  repiqueSrpa: '',
  planoPosOperatorio: '',
  dataInsercao: new Date(),
}

// Mapeia um cateter (camelCase, do context) para o shape do formulário,
// convertendo datas em Date e números em string para os inputs controlados.
function cateterToForm(c) {
  return {
    hospital: c.hospital || 'unimed',
    paciente: c.paciente || '',
    leito: c.leito || '',
    cirurgia: c.cirurgia || '',
    // data_cirurgia é coluna DATE — parse local, senão em UTC-3 volta um dia
    dataCirurgia: c.dataCirurgia ? parseLocalDate(c.dataCirurgia) : null,
    cirurgiao: c.cirurgiao || '',
    anestesista: c.anestesista || '',
    residente: c.residente || '',
    nivelPuncao: c.nivelPuncao || '',
    tamanhoCpd: c.tamanhoCpd || '',
    marcaCpdPele: c.marcaCpdPele != null ? String(c.marcaCpdPele) : '',
    marcaCpdDentro: c.marcaCpdDentro != null ? String(c.marcaCpdDentro) : '',
    dosesTransoperatorias: c.dosesTransoperatorias || '',
    repiqueSrpa: c.repiqueSrpa || '',
    planoPosOperatorio: c.planoPosOperatorio || '',
    dataInsercao: c.dataInsercao ? new Date(c.dataInsercao) : new Date(),
  }
}

export default function NovoCateterPage({ _onNavigate, goBack, params }) {
  const { user } = useUser()
  const { addCateter, updateCateter, getCateterById } = useCateterPeridural()
  const { createSystemNotification } = useMessages()
  const { users = [] } = useUsersManagement()
  const { toast } = useToast()
  const { anestesiologistas, residentes } = useProfissionaisCateter()

  // Modo edição: params.cateterId presente → pré-preenche e salva via updateCateter.
  // key={`novo-cateter-${cateterId}`} no App.jsx força remount, então o lazy
  // initializer abaixo lê o cateter certo (regra navegacao: KEY + lazy state).
  const editId = params?.cateterId || null
  const editing = !!editId
  const [form, setForm] = useState(() => {
    if (editId) {
      const existing = getCateterById(editId)
      if (existing) return cateterToForm(existing)
    }
    return initialForm
  })
  const [saving, setSaving] = useState(false)
  const haptic = useHaptic()

  // Hidratação tardia: em refresh da URL de edição o context pode ainda não ter
  // carregado o cateter no mount (form cai no initialForm vazio). Quando o
  // cateter aparecer, preenche uma única vez — sem clobberar edições do usuário.
  const hydratedRef = useRef(!editing || !!form.paciente)
  useEffect(() => {
    if (hydratedRef.current) return
    const existing = getCateterById(editId)
    if (existing) {
      hydratedRef.current = true
      setForm(cateterToForm(existing))
    }
  }, [editId, getCateterById])

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'hospital' && value !== 'hro') {
        next.residente = ''
      }
      return next
    })
  }

  // dataInsercao é um único Date com data E hora (o momento real da inserção).
  // O DateTimePicker separa os dois campos; estes handlers mesclam a parte
  // alterada preservando a outra — antes, trocar a data zerava o horário.
  const setInsercaoDate = (date) => {
    setForm((prev) => {
      if (!date) return { ...prev, dataInsercao: null }
      const base = prev.dataInsercao instanceof Date ? prev.dataInsercao : new Date()
      const next = new Date(date)
      next.setHours(base.getHours(), base.getMinutes(), 0, 0)
      return { ...prev, dataInsercao: next }
    })
  }

  const setInsercaoTime = (hhmm) => {
    if (!hhmm) return
    setForm((prev) => {
      const [h, m] = hhmm.split(':').map(Number)
      const base = prev.dataInsercao instanceof Date ? new Date(prev.dataInsercao) : new Date()
      base.setHours(h, m, 0, 0)
      return { ...prev, dataInsercao: base }
    })
  }

  const insercaoTimeValue = form.dataInsercao instanceof Date
    ? `${String(form.dataInsercao.getHours()).padStart(2, '0')}:${String(form.dataInsercao.getMinutes()).padStart(2, '0')}`
    : ''

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.paciente.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do paciente.',
        variant: 'error',
      })
      return
    }

    if (!form.anestesista) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione o anestesiologista.',
        variant: 'error',
      })
      return
    }

    setSaving(true)
    haptic('success')
    try {
      // Audit-trail: exige user real (uid OU id — alguns perfis vêm do Supabase
      // com `id`, não `uid`). Sem isso o registro era salvo com created_by null /
      // created_by_name "Usuário" (rule audit-trail). requireUserId lança se
      // ausente → cai no catch e o usuário vê erro em vez de gravar lixo.
      const audited = requireUserId(
        { userId: user?.uid || user?.id, userName: user?.displayName },
        'NovoCateterPage.submit'
      )

      const payload = {
        ...form,
        dataCirurgia: form.dataCirurgia ? toLocalISODate(form.dataCirurgia) : null,
        marcaCpdPele: form.marcaCpdPele ? Number(form.marcaCpdPele) : null,
        marcaCpdDentro: form.marcaCpdDentro ? Number(form.marcaCpdDentro) : null,
        dataInsercao: form.dataInsercao ? form.dataInsercao.toISOString() : new Date().toISOString(),
      }

      if (editing) {
        await updateCateter(editId, payload, audited)
        toast({
          title: 'Cateter atualizado',
          description: `Dados de ${form.paciente} salvos.`,
          variant: 'success',
        })
        goBack()
        return
      }

      const created = await addCateter(payload, audited)

      // Notificar todos os anestesistas e residentes (LGPD-safe: só iniciais + local)
      const recipientIds = getCateterRecipients(users)
      if (created?.id && recipientIds.length > 0) {
        try {
          const notif = buildCateterNotificationPayload({
            evento: 'novo',
            cateterId: created.id,
            pacienteNome: form.paciente,
            hospital: form.hospital,
            recipientIds,
          })
          await createSystemNotification(notif)
        } catch (notifErr) {
          console.warn('[NovoCateter] Falha notificando cateter:', notifErr)
          toast({
            title: 'Cateter salvo',
            description: 'O cateter foi registrado, mas a notificação à equipe falhou.',
            variant: 'warning',
          })
        }
      }

      toast({
        title: 'Cateter cadastrado',
        description: `Cateter de ${form.paciente} registrado com sucesso.`,
        variant: 'success',
      })
      goBack()
    } catch (err) {
      console.error('[NovoCateter] Error:', err)
      toast({
        title: editing ? 'Erro ao atualizar' : 'Erro ao cadastrar',
        description: err.message || 'Tente novamente.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Evita submit acidental: num <form> nativo, Enter num input de linha única
  // dispara o submit. No mobile o "return" do teclado salvava registros pela
  // metade (bug do "salvou automaticamente"). Só o botão Cadastrar/Salvar envia.
  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title={editing ? 'Editar Cateter' : 'Novo Cateter'} onBack={goBack} />

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="px-4 sm:px-5 py-4 space-y-4">
        {/* Hospital selector */}
        <Card className="p-4">
          <p className="text-sm font-medium text-foreground mb-2">Hospital</p>
          <div className="grid grid-cols-2 gap-2">
            {HOSPITAIS_OPTIONS.map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => handleChange('hospital', h.value)}
                className={`py-3 px-4 rounded-[16px] text-sm font-medium border transition-all active:scale-95 ${
                  form.hospital === h.value
                    ? 'border-[hsl(var(--primary-hover))] bg-primary/10 text-primary dark:border-[hsl(var(--primary))] dark:bg-primary/20 dark:text-primary'
                    : 'border-[hsl(var(--input))] bg-card text-muted-foreground'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Seção: Paciente */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Paciente</h3>

          <Input
            label="Paciente *"
            placeholder="Nome completo"
            value={form.paciente}
            onChange={(e) => handleChange('paciente', e.target.value)}
            required
          />

          <Input
            label="Cirurgião"
            placeholder="Nome"
            value={form.cirurgiao}
            onChange={(e) => handleChange('cirurgiao', e.target.value)}
          />

          <Select
            label="Anestesiologista *"
            searchable
            options={anestesiologistas}
            value={form.anestesista}
            onChange={(val) => handleChange('anestesista', val)}
            placeholder="Selecione o anestesiologista..."
          />

          {form.hospital === 'hro' && (
            <Select
              label="Residente"
              searchable
              options={residentes}
              value={form.residente}
              onChange={(val) => handleChange('residente', val)}
              placeholder="Selecione o residente (opcional)..."
            />
          )}

          <Input
            label="Leito"
            placeholder="Ex: 301-A"
            value={form.leito}
            onChange={(e) => handleChange('leito', e.target.value)}
          />

          <Input
            label="Cirurgia"
            placeholder="Tipo de cirurgia"
            value={form.cirurgia}
            onChange={(e) => handleChange('cirurgia', e.target.value)}
          />

          <DatePicker
            label="Data da Cirurgia"
            placeholder="Selecione a data"
            value={form.dataCirurgia}
            onChange={(date) => handleChange('dataCirurgia', date)}
          />
        </Card>

        {/* Seção: Dados Técnicos */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Dados Técnicos</h3>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Input
              label="Nível Punção"
              placeholder="Ex: T8-9"
              value={form.nivelPuncao}
              onChange={(e) => handleChange('nivelPuncao', e.target.value)}
            />
            <Input
              label="Tamanho CPD"
              placeholder="Ex: 18G"
              value={form.tamanhoCpd}
              onChange={(e) => handleChange('tamanhoCpd', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Input
              label="Marca pele (cm)"
              type="number"
              step="0.1"
              placeholder="cm"
              value={form.marcaCpdPele}
              onChange={(e) => handleChange('marcaCpdPele', e.target.value)}
            />
            <Input
              label="Marca dentro (cm)"
              type="number"
              step="0.1"
              placeholder="cm"
              value={form.marcaCpdDentro}
              onChange={(e) => handleChange('marcaCpdDentro', e.target.value)}
            />
          </div>

          <DateTimePicker
            label="Data e Hora da Inserção"
            datePlaceholder="Selecione a data"
            dateValue={form.dataInsercao}
            onDateChange={setInsercaoDate}
            timeValue={insercaoTimeValue}
            onTimeChange={setInsercaoTime}
            step={5}
          />
        </Card>

        {/* Seção: Transoperatório */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Transoperatório</h3>

          <Textarea
            label="Doses Transoperatórias"
            placeholder="Descreva as doses utilizadas..."
            value={form.dosesTransoperatorias}
            onChange={(val) => handleChange('dosesTransoperatorias', val)}
            rows={2}
          />
          <Textarea
            label="Repique na SRPA"
            placeholder="Descreva repiques na SRPA..."
            value={form.repiqueSrpa}
            onChange={(val) => handleChange('repiqueSrpa', val)}
            rows={2}
          />
        </Card>

        {/* Seção: Plano Pós-Operatório */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Plano Pós-Operatório</h3>

          <Textarea
            label="Plano Pós-Operatório"
            placeholder="Descreva o plano pós-operatório..."
            value={form.planoPosOperatorio}
            onChange={(val) => handleChange('planoPosOperatorio', val)}
            rows={3}
          />
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          variant="default"
          className="w-full"
          disabled={saving}
          loading={saving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          {editing ? 'Salvar Alterações' : 'Cadastrar Cateter'}
        </Button>
      </form>
    </div>
  )
}
