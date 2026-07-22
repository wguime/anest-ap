/**
 * NovaCirurgiaParticularPage - Form de lançamento (criar/editar) de cobrança
 * de cirurgia particular, com import opcional da Escala Cirúrgica do dia.
 *
 * LGPD: paciente é nome COMPLETO (base legal na migration 20260722100000);
 * nunca logar dados do paciente no console. Import da escala traz só as
 * INICIAIS (CHECK da escala) — o save fica bloqueado até completar o nome.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { Save, CalendarSearch, Ban } from 'lucide-react'
import {
  Card, Button, Badge, Input, Select, Textarea, DatePicker, Modal, ConfirmDialog, EmptyState,
} from '@/design-system'
import { useToast } from '@/design-system'
import { useHaptic } from '@/design-system/hooks'
import { PageHeader } from '@/components'
import { useUser } from '@/contexts/UserContext'
import { useCirurgiasParticulares } from '@/contexts/CirurgiasParticularesContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import useProfissionaisCateter from '@/hooks/useProfissionaisCateter'
import supabaseEscalaCirurgicaService from '@/services/supabaseEscalaCirurgicaService'
import { requireUserId } from '@/utils/audit'
import { parseLocalDate, toLocalISODate } from '@/utils/dateUtils'
import {
  STATUS_PAGAMENTO, parseValorBRL, pareceIniciais, casoImportavel, HOSPITAL_LABEL,
} from '@/lib/cirurgiasParticulares'
import { familiaConvenio } from '@/pages/escala-cirurgica/utils'
import { formatCurrency } from '@/utils/formatters'

const LOCAIS_OPTIONS = [
  { value: 'Unimed', label: 'Unimed' },
  { value: 'HRO', label: 'HRO' },
  { value: 'Materno-infantil', label: 'Materno-infantil' },
  { value: 'Hospital de Olhos', label: 'Hospital de Olhos' },
  { value: 'Consultório', label: 'Consultório' },
  { value: 'outro', label: 'Outro...' },
]

const HOSPITAIS_ESCALA = ['unimed', 'hro', 'materno']

const initialForm = {
  paciente: '',
  cirurgiao: '',
  anestesistaNome: '',
  dataCirurgia: new Date(),
  procedimento: '',
  local: '',
  localOutro: '',
  valor: '',
  statusPagamento: 'pendente',
  dataPagamento: null,
  observacoes: '',
  escalaCasoId: null,
}

// Mapeia um lançamento (camelCase, do context) p/ o shape do formulário.
function cirurgiaToForm(c) {
  const localConhecido = LOCAIS_OPTIONS.some((o) => o.value !== 'outro' && o.value === c.local)
  return {
    paciente: c.paciente || '',
    cirurgiao: c.cirurgiao || '',
    anestesistaNome: c.anestesistaNome || '',
    // data_cirurgia é coluna DATE — parse local, senão em UTC-3 volta um dia
    dataCirurgia: c.dataCirurgia ? parseLocalDate(c.dataCirurgia) : null,
    procedimento: c.procedimento || '',
    local: localConhecido ? c.local : (c.local ? 'outro' : ''),
    localOutro: localConhecido ? '' : (c.local || ''),
    valor: c.valor != null ? String(c.valor).replace('.', ',') : '',
    statusPagamento: c.statusPagamento || 'pendente',
    dataPagamento: c.dataPagamento ? parseLocalDate(c.dataPagamento) : null,
    observacoes: c.observacoes || '',
    escalaCasoId: c.escalaCasoId || null,
  }
}

/** Modal de import: casos PARTICULAR da escala do dia escolhido. */
function ImportarDaEscalaModal({ open, onClose, onSelect, jaLancadoIds }) {
  const [data, setData] = useState(() => new Date())
  const [hospital, setHospital] = useState('unimed')
  const [carregando, setCarregando] = useState(false)
  const [casos, setCasos] = useState(null) // null = ainda não buscou

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCarregando(true)
    supabaseEscalaCirurgicaService
      .fetchEscala(toLocalISODate(data), hospital)
      .then((escala) => {
        if (cancelled) return
        const todos = escala?.casos || []
        setCasos(todos.filter((c) => familiaConvenio(c.convenio) === 'particular'))
      })
      .catch(() => {
        if (!cancelled) setCasos([])
      })
      .finally(() => {
        if (!cancelled) setCarregando(false)
      })
    return () => { cancelled = true }
  }, [open, data, hospital])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar da escala"
      description="Casos com convênio Particular na escala do dia. Suspensas não geram cobrança."
    >
      <div className="space-y-3">
        <DatePicker label="Data da escala" value={data} onChange={(d) => d && setData(d)} />

        <div className="grid grid-cols-3 gap-2">
          {HOSPITAIS_ESCALA.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHospital(h)}
              className={`py-2.5 px-2 min-h-[44px] rounded-[14px] border text-xs font-medium transition-all active:scale-95 ${
                hospital === h
                  ? 'border-[hsl(var(--primary-hover))] bg-primary/10 text-primary dark:border-[hsl(var(--primary))] dark:bg-primary/20'
                  : 'border-[hsl(var(--input))] bg-card text-muted-foreground'
              }`}
            >
              {HOSPITAL_LABEL[h]}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Card key={i} className="p-3 animate-pulse">
                <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : !casos?.length ? (
          <EmptyState
            title="Nenhum caso particular"
            description={casos === null ? 'Escolha data e hospital.' : 'A escala deste dia não tem caso com convênio Particular (ou não foi publicada).'}
          />
        ) : (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {casos.map((caso) => {
              const suspensa = caso.statusExtra === 'suspensa'
              const jaLancado = jaLancadoIds.has(caso.id)
              const desabilitado = suspensa || jaLancado || !casoImportavel(caso)
              return (
                <button
                  key={caso.id}
                  type="button"
                  disabled={desabilitado}
                  onClick={() => onSelect(caso, hospital, toLocalISODate(data))}
                  className={`w-full text-left rounded-xl border border-border p-3 transition-all ${
                    desabilitado ? 'opacity-50' : 'bg-card active:scale-[0.99] hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {caso.hora ? `${caso.hora} · ` : ''}{caso.sala}
                    </p>
                    <span className="flex gap-1">
                      {suspensa && <Badge variant="destructive" badgeStyle="subtle">Suspensa</Badge>}
                      {jaLancado && <Badge variant="default" badgeStyle="subtle">Já lançado</Badge>}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {caso.pacienteIniciais || 'Paciente s/ iniciais'} · {caso.procedimento || 'Procedimento não informado'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Cir.: {caso.cirurgiao || '—'} · Anest.: {caso.anestesista || '—'}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function NovaCirurgiaParticularPage({ _onNavigate, goBack, params }) {
  const { user } = useUser()
  const { cirurgias, addCirurgia, updateCirurgia, cancelarCirurgia, getCirurgiaById } = useCirurgiasParticulares()
  const { users = [] } = useUsersManagement()
  const { anestesiologistas } = useProfissionaisCateter()
  const { toast } = useToast()
  const haptic = useHaptic()

  // Modo edição: params.cirurgiaId presente. key no App.jsx força remount →
  // lazy initializer lê o registro certo (regra navegacao: KEY + lazy state).
  const editId = params?.cirurgiaId || null
  const editing = !!editId
  const [form, setForm] = useState(() => {
    if (editId) {
      const existing = getCirurgiaById(editId)
      if (existing) return cirurgiaToForm(existing)
    }
    return initialForm
  })
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const registroAtual = editing ? getCirurgiaById(editId) : null
  const cancelada = !!registroAtual?.canceladaEm

  // Hidratação tardia: em refresh da URL de edição o context pode ainda não
  // ter carregado o registro no mount. Preenche uma única vez quando chegar.
  const hydratedRef = useRef(!editing || !!form.paciente)
  useEffect(() => {
    if (hydratedRef.current) return
    const existing = getCirurgiaById(editId)
    if (existing) {
      hydratedRef.current = true
      setForm(cirurgiaToForm(existing))
    }
  }, [editId, getCirurgiaById])

  // Default do anestesista = usuário logado, quando ele está no roster.
  const defaultAnestesistaRef = useRef(editing)
  useEffect(() => {
    if (defaultAnestesistaRef.current) return
    if (!anestesiologistas.length) return
    defaultAnestesistaRef.current = true
    setForm((prev) => {
      if (prev.anestesistaNome) return prev
      const meuNome = anestesiologistas.find((a) => a.value === user?.displayName)?.value
      return meuNome ? { ...prev, anestesistaNome: meuNome } : prev
    })
  }, [anestesiologistas, user])

  // Casos da escala já lançados (ativos) — desabilitados no picker.
  const jaLancadoIds = useMemo(
    () => new Set(cirurgias.filter((c) => c.escalaCasoId && !c.canceladaEm).map((c) => c.escalaCasoId)),
    [cirurgias]
  )

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // data_pagamento auto: virou pago → hoje (editável); saiu de pago → limpa
      if (field === 'statusPagamento') {
        if (value === 'pago' && !prev.dataPagamento) next.dataPagamento = new Date()
        if (value !== 'pago') next.dataPagamento = null
      }
      return next
    })
  }

  const handleImportSelect = (caso, hospital, dataISO) => {
    // Resolve o anestesista do caso: uid do roster → nome do profile.
    const perfil = caso.anestesistaUserId
      ? users.find((u) => (u.id || u.uid) === caso.anestesistaUserId)
      : null
    const nomeResolvido = perfil?.nome && anestesiologistas.some((a) => a.value === perfil.nome)
      ? perfil.nome
      : ''

    setForm((prev) => ({
      ...prev,
      paciente: caso.pacienteIniciais || '',
      cirurgiao: caso.cirurgiao || '',
      anestesistaNome: nomeResolvido || prev.anestesistaNome,
      dataCirurgia: parseLocalDate(dataISO),
      procedimento: caso.procedimento || '',
      local: HOSPITAL_LABEL[hospital] || 'outro',
      localOutro: '',
      escalaCasoId: caso.id,
    }))
    setImportOpen(false)
    toast({
      title: 'Dados importados da escala',
      description: 'Complete o NOME do paciente (a escala só tem iniciais) e o valor.',
      variant: 'info',
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const obrigatorios = [
      [form.paciente.trim(), 'Informe o nome do paciente.'],
      [form.cirurgiao.trim(), 'Informe o cirurgião.'],
      [form.anestesistaNome, 'Selecione o anestesiologista.'],
      [form.dataCirurgia, 'Informe a data da cirurgia.'],
      [form.procedimento.trim(), 'Informe o procedimento.'],
      [form.local && (form.local !== 'outro' || form.localOutro.trim()), 'Informe o local.'],
    ]
    for (const [ok, msg] of obrigatorios) {
      if (!ok) {
        toast({ title: 'Campo obrigatório', description: msg, variant: 'error' })
        return
      }
    }

    // Import da escala traz só iniciais — cobrança precisa do nome completo.
    if (form.escalaCasoId && pareceIniciais(form.paciente)) {
      toast({
        title: 'Complete o nome do paciente',
        description: 'O import da escala traz só as iniciais. Digite o nome completo para a cobrança.',
        variant: 'error',
      })
      return
    }

    const valor = parseValorBRL(form.valor)
    if (valor == null) {
      toast({ title: 'Valor inválido', description: 'Informe o valor cobrado (ex: 1.500,00).', variant: 'error' })
      return
    }

    setSaving(true)
    haptic('success')
    try {
      const audited = requireUserId(
        { userId: user?.uid || user?.id, userName: user?.displayName },
        'NovaCirurgiaParticular.submit'
      )

      const anestesistaPerfil = users.find((u) => u.nome === form.anestesistaNome)
      const payload = {
        paciente: form.paciente.trim(),
        cirurgiao: form.cirurgiao.trim(),
        anestesistaNome: form.anestesistaNome,
        anestesistaUserId: anestesistaPerfil?.id || anestesistaPerfil?.uid || null,
        dataCirurgia: toLocalISODate(form.dataCirurgia),
        procedimento: form.procedimento.trim(),
        local: form.local === 'outro' ? form.localOutro.trim() : form.local,
        valor,
        statusPagamento: form.statusPagamento,
        dataPagamento:
          form.statusPagamento === 'pago' && form.dataPagamento
            ? toLocalISODate(form.dataPagamento)
            : null,
        observacoes: form.observacoes.trim() || null,
        escalaCasoId: form.escalaCasoId,
      }

      if (editing) {
        await updateCirurgia(editId, payload, audited)
        toast({ title: 'Lançamento atualizado', description: 'Alterações salvas.', variant: 'success' })
      } else {
        await addCirurgia(payload, audited)
        toast({
          title: 'Cirurgia registrada',
          description: `Cobrança de ${formatCurrency(valor)} lançada.`,
          variant: 'success',
        })
      }
      goBack()
    } catch (err) {
      // Índice único parcial: 23505 = este caso da escala já tem lançamento ativo.
      const duplicado = /uq_cirurgias_particulares_escala_caso|duplicate key/i.test(err.message || '')
      toast({
        title: editing ? 'Erro ao atualizar' : 'Erro ao registrar',
        description: duplicado
          ? 'Este caso da escala já tem um lançamento ativo.'
          : err.message || 'Tente novamente.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelar = async () => {
    try {
      const audited = requireUserId(
        { userId: user?.uid || user?.id, userName: user?.displayName },
        'NovaCirurgiaParticular.cancelar'
      )
      await cancelarCirurgia(editId, motivoCancel.trim() || null, audited)
      toast({ title: 'Lançamento cancelado', description: 'O registro saiu da listagem (trilha preservada).', variant: 'success' })
      setCancelOpen(false)
      goBack()
    } catch (err) {
      toast({ title: 'Erro ao cancelar', description: err.message || 'Tente novamente.', variant: 'error' })
    }
  }

  // Enter num input de linha única não pode submeter (padrão NovoCateterPage).
  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
    }
  }

  const nomeIncompleto = !!form.escalaCasoId && !!form.paciente && pareceIniciais(form.paciente)

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title={editing ? 'Editar Lançamento' : 'Nova Cirurgia Particular'} onBack={goBack} />

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="px-4 sm:px-5 py-4 space-y-4">
        {cancelada && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <Ban className="w-4 h-4 flex-shrink-0" />
            Lançamento cancelado{registroAtual?.motivoCancelamento ? ` — ${registroAtual.motivoCancelamento}` : ''}
          </div>
        )}

        {!editing && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setImportOpen(true)}
            leftIcon={<CalendarSearch className="w-4 h-4" />}
          >
            Importar da escala do dia
          </Button>
        )}

        {/* Seção: Cirurgia */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Cirurgia</h3>

          <div>
            <Input
              label="Paciente *"
              placeholder="Nome completo"
              value={form.paciente}
              onChange={(e) => handleChange('paciente', e.target.value)}
              required
            />
            {nomeIncompleto && (
              <p className="mt-1 text-xs text-warning">
                Importado da escala com iniciais — complete o nome para salvar.
              </p>
            )}
          </div>

          <Input
            label="Cirurgião *"
            placeholder="Nome do cirurgião"
            value={form.cirurgiao}
            onChange={(e) => handleChange('cirurgiao', e.target.value)}
            required
          />

          <Select
            label="Anestesiologista *"
            searchable
            options={anestesiologistas}
            value={form.anestesistaNome}
            onChange={(val) => handleChange('anestesistaNome', val)}
            placeholder="Selecione o anestesiologista..."
          />

          <DatePicker
            label="Data da cirurgia *"
            placeholder="Selecione a data"
            value={form.dataCirurgia}
            onChange={(date) => handleChange('dataCirurgia', date)}
          />

          <Input
            label="Procedimento *"
            placeholder="Tipo de procedimento"
            value={form.procedimento}
            onChange={(e) => handleChange('procedimento', e.target.value)}
            required
          />

          <Select
            label="Local *"
            options={LOCAIS_OPTIONS}
            value={form.local}
            onChange={(val) => handleChange('local', val)}
            placeholder="Onde foi realizada..."
          />

          {form.local === 'outro' && (
            <Input
              label="Qual local?"
              placeholder="Nome do local"
              value={form.localOutro}
              onChange={(e) => handleChange('localOutro', e.target.value)}
            />
          )}
        </Card>

        {/* Seção: Cobrança */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Cobrança</h3>

          <Input
            label="Valor cobrado (R$) *"
            inputMode="decimal"
            placeholder="Ex: 1.500,00"
            value={form.valor}
            onChange={(e) => handleChange('valor', e.target.value)}
            required
          />

          <Select
            label="Status do pagamento"
            options={STATUS_PAGAMENTO.map((s) => ({ value: s.value, label: s.label }))}
            value={form.statusPagamento}
            onChange={(val) => handleChange('statusPagamento', val)}
          />

          {form.statusPagamento === 'pago' && (
            <DatePicker
              label="Data do pagamento"
              placeholder="Selecione a data"
              value={form.dataPagamento}
              onChange={(date) => handleChange('dataPagamento', date)}
            />
          )}

          <Textarea
            label="Observações"
            placeholder="Somente informações de cobrança (forma de pagamento, nº do recibo) — não registrar dados clínicos do paciente."
            value={form.observacoes}
            onChange={(val) => handleChange('observacoes', val)}
            rows={2}
          />
        </Card>

        <Button
          type="submit"
          variant="default"
          className="w-full"
          disabled={saving}
          loading={saving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          {editing ? 'Salvar Alterações' : 'Registrar Cirurgia'}
        </Button>

        {editing && !cancelada && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive"
            onClick={() => setCancelOpen(true)}
            leftIcon={<Ban className="w-4 h-4" />}
          >
            Cancelar lançamento
          </Button>
        )}
      </form>

      <ImportarDaEscalaModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSelect={handleImportSelect}
        jaLancadoIds={jaLancadoIds}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancelar}
        variant="danger"
        title="Cancelar lançamento?"
        description="O registro sai da listagem e dos relatórios, mas a trilha de auditoria é preservada (sem exclusão)."
        confirmText="Cancelar lançamento"
      >
        <Textarea
          label="Motivo (opcional)"
          placeholder="Ex: lançamento duplicado, cirurgia suspensa..."
          value={motivoCancel}
          onChange={(val) => setMotivoCancel(val)}
          rows={2}
        />
      </ConfirmDialog>
    </div>
  )
}
