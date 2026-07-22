/**
 * NovaCirurgiaParticularPage - Form de lançamento (criar/editar) de cobrança
 * de cirurgia particular.
 *
 * Casos PARTICULARES da escala publicada viram rascunho AUTOMATICAMENTE
 * (trigger fn_sync_cirurgia_particular — sem botão de import). Este form
 * abre o rascunho por params.cirurgiaId OU params.escalaCasoId (vindo do
 * "preencher cobrança agora?" do AddCasoSheet da escala).
 *
 * LGPD: paciente é nome COMPLETO (base legal na migration 20260722100000);
 * nunca logar dados do paciente no console. Rascunho da escala traz só as
 * INICIAIS (CHECK da escala) — o save fica bloqueado até completar o nome.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { Save, Ban } from 'lucide-react'
import {
  Card, Button, Input, Select, Textarea, DatePicker, ConfirmDialog,
} from '@/design-system'
import { useToast } from '@/design-system'
import { useHaptic } from '@/design-system/hooks'
import { PageHeader } from '@/components'
import { useUser } from '@/contexts/UserContext'
import { useCirurgiasParticulares } from '@/contexts/CirurgiasParticularesContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import useProfissionaisCateter from '@/hooks/useProfissionaisCateter'
import { requireUserId } from '@/utils/audit'
import { parseLocalDate, toLocalISODate } from '@/utils/dateUtils'
import { STATUS_PAGAMENTO, parseValorBRL, pareceIniciais, formatarCPF, limparCPF, validarCPF } from '@/lib/cirurgiasParticulares'
import { formatCurrency } from '@/utils/formatters'

// Locais-base: hospitais das escalas + unidades que aparecem nos boards
// (IOSC/HO/Centro de Coluna/Digimax/Accurata/Umanitá são seções da escala do
// HRO/Unimed). A lista final soma os locais JÁ USADOS em lançamentos
// anteriores (digitados via "Outro...") — cresce com o uso.
const LOCAIS_BASE = [
  'Unimed',
  'HRO',
  'Materno-infantil',
  'Hospital de Olhos',
  'IOSC',
  'Centro de Coluna',
  'Accurata',
  'Digimax',
  'Umanitá',
  'Consultório',
]

const initialForm = {
  paciente: '',
  pacienteCpf: '',
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
// `local` entra direto como valor selecionado — as options dinâmicas sempre
// incluem o valor atual (base + locais já usados), então nada vira "outro".
function cirurgiaToForm(c) {
  return {
    paciente: c.paciente || '',
    pacienteCpf: c.pacienteCpf ? formatarCPF(c.pacienteCpf) : '',
    cirurgiao: c.cirurgiao || '',
    anestesistaNome: c.anestesistaNome || '',
    // data_cirurgia é coluna DATE — parse local, senão em UTC-3 volta um dia
    dataCirurgia: c.dataCirurgia ? parseLocalDate(c.dataCirurgia) : null,
    procedimento: c.procedimento || '',
    local: c.local || '',
    localOutro: '',
    // Rascunho do auto-import nasce com valor 0 — mostrar vazio p/ o usuário
    // digitar o valor real (0 explícito ainda pode ser digitado).
    valor: c.valor != null && Number(c.valor) > 0 ? String(c.valor).replace('.', ',') : '',
    statusPagamento: c.statusPagamento || 'pendente',
    dataPagamento: c.dataPagamento ? parseLocalDate(c.dataPagamento) : null,
    observacoes: c.observacoes || '',
    escalaCasoId: c.escalaCasoId || null,
  }
}

export default function NovaCirurgiaParticularPage({ _onNavigate, goBack, params }) {
  const { user } = useUser()
  const { cirurgias, addCirurgia, updateCirurgia, cancelarCirurgia, getCirurgiaById } = useCirurgiasParticulares()
  const { users = [] } = useUsersManagement()
  const { anestesiologistas } = useProfissionaisCateter()
  const { toast } = useToast()
  const haptic = useHaptic()

  // Modo edição: params.cirurgiaId OU params.escalaCasoId (o AddCasoSheet da
  // escala navega com o id do CASO; o rascunho auto-criado pelo trigger é
  // resolvido aqui quando o context carrega). key no App.jsx força remount →
  // lazy initializer lê o registro certo (regra navegacao: KEY + lazy state).
  const draftDaEscala = params?.escalaCasoId
    ? cirurgias.find((c) => c.escalaCasoId === params.escalaCasoId && !c.canceladaEm)
    : null
  const editId = params?.cirurgiaId || draftDaEscala?.id || null
  const editing = !!editId
  const [form, setForm] = useState(() => {
    if (editId) {
      const existing = getCirurgiaById(editId)
      if (existing) return cirurgiaToForm(existing)
    }
    // Fallback: rascunho ainda não existe (trigger falhou/atrasou) — o form
    // nasce vazio mas já vinculado ao caso, então salvar não duplica depois
    // (índice único parcial) e mantém o vínculo p/ o alerta de suspensa.
    return { ...initialForm, escalaCasoId: params?.escalaCasoId || null }
  })
  const [saving, setSaving] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const registroAtual = editing ? getCirurgiaById(editId) : null
  const cancelada = !!registroAtual?.canceladaEm

  // Hidratação tardia: em refresh da URL de edição (ou navegação por
  // escalaCasoId) o context pode ainda não ter carregado o registro no
  // mount. Preenche uma única vez quando chegar.
  const hydratedRef = useRef(!(params?.cirurgiaId || params?.escalaCasoId) || !!form.paciente)
  useEffect(() => {
    if (hydratedRef.current) return
    if (!editId) return
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

  // Locais: base fixa (hospitais + unidades das escalas) ∪ locais já usados em
  // lançamentos ∪ o valor atual do form (registro antigo nunca vira "Outro").
  const locaisOptions = useMemo(() => {
    const set = new Set(LOCAIS_BASE)
    for (const c of cirurgias) if (c.local) set.add(c.local)
    if (form.local && form.local !== 'outro') set.add(form.local)
    const extras = [...set].filter((l) => !LOCAIS_BASE.includes(l)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [...LOCAIS_BASE, ...extras]
      .map((l) => ({ value: l, label: l }))
      .concat({ value: 'outro', label: 'Outro...' })
  }, [cirurgias, form.local])

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    const obrigatorios = [
      [form.paciente.trim(), 'Informe o nome do paciente.'],
      [form.pacienteCpf.trim(), 'Informe o CPF do paciente.'],
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

    if (!validarCPF(form.pacienteCpf)) {
      toast({ title: 'CPF inválido', description: 'Confira os dígitos do CPF do paciente.', variant: 'error' })
      return
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

    // Valor é OPCIONAL (decisão do dono 2026-07-22): vazio entra como R$ 0 —
    // a guia pode ser precificada depois. Texto inválido continua bloqueando.
    const valorTexto = form.valor.trim()
    const valor = valorTexto ? parseValorBRL(valorTexto) : 0
    if (valor == null) {
      toast({ title: 'Valor inválido', description: 'Use o formato 1.500,00 (ou deixe em branco para definir depois).', variant: 'error' })
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
        pacienteCpf: limparCPF(form.pacienteCpf),
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
            label="CPF do paciente *"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={form.pacienteCpf}
            onChange={(e) => handleChange('pacienteCpf', formatarCPF(e.target.value))}
            required
          />

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
            searchable
            options={locaisOptions}
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
            label="Valor cobrado (R$)"
            inputMode="decimal"
            placeholder="Ex: 1.500,00 (opcional — pode definir depois)"
            value={form.valor}
            onChange={(e) => handleChange('valor', e.target.value)}
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
