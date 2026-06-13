/**
 * FollowupForm - Daily PO evaluation form with optional catheter removal
 */
import { useState } from 'react'
import { Card, Button, Input, Select, Textarea, Switch, DatePicker } from '@/design-system'
import { useToast } from '@/design-system'
import { useHaptic } from '@/design-system/hooks'
import { SITIO_INSERCAO_OPTIONS, BROMAGE_SCALE, COMPLICACOES_COMUNS, MOTIVOS_RETIRADA } from '@/data/cateterPeridualConfig'
import { computeDiaPo, formatDiaPoLabel } from '@/lib/cateterPo'
import useProfissionaisCateter from '@/hooks/useProfissionaisCateter'

export default function FollowupForm({ dataInsercao, hospital, onSubmit, saving }) {
  const { toast } = useToast()
  const haptic = useHaptic()
  const { anestesiologistas, residentes } = useProfissionaisCateter()
  const isHro = hospital === 'hro'

  // Data da avaliação obrigatória; o nº do PO é derivado dela (não digitado).
  // O mesmo cateter pode ser avaliado mais de uma vez no mesmo dia → mesmo PO.
  const [dataAvaliacao, setDataAvaliacao] = useState(new Date())
  const diaPo = computeDiaPo(dataAvaliacao, dataInsercao)

  const [form, setForm] = useState({
    planoDia: '',
    sitioInsercao: '',
    bromageScore: '',
    nivelSensitivo: '',
    marcaPeleAtual: '',
    taxaInfusao: '',
    complicacoes: '',
    observacoes: '',
    anestesistaNome: '',
    residenteNome: '',
  })

  const [retirarCateter, setRetirarCateter] = useState(false)
  const [dataRetirada, setDataRetirada] = useState(new Date())
  const [motivoRetirada, setMotivoRetirada] = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')

  const motivoOptions = MOTIVOS_RETIRADA.map((m) => ({ value: m, label: m }))

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!dataAvaliacao) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a data da avaliação.',
        variant: 'error',
      })
      return
    }

    if (diaPo == null) {
      toast({
        title: 'Data inválida',
        description: 'A data da avaliação não pode ser anterior à inserção do cateter.',
        variant: 'error',
      })
      return
    }

    if (isHro) {
      if (!form.anestesistaNome && !form.residenteNome) {
        toast({
          title: 'Campo obrigatório',
          description: 'Informe o anestesiologista e/ou o residente.',
          variant: 'error',
        })
        return
      }
    } else {
      if (!form.anestesistaNome) {
        toast({
          title: 'Campo obrigatório',
          description: 'Selecione o anestesiologista.',
          variant: 'error',
        })
        return
      }
    }

    if (retirarCateter && !motivoRetirada) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione o motivo da retirada.',
        variant: 'error',
      })
      return
    }

    const motivoFinal = motivoRetirada === 'Outro' ? motivoOutro.trim() || 'Outro' : motivoRetirada
    haptic('success')

    onSubmit({
      diaPo,
      dataAvaliacao: dataAvaliacao.toISOString(),
      planoDia: form.planoDia || null,
      sitioInsercao: form.sitioInsercao || null,
      bromageScore: form.bromageScore !== '' ? Number(form.bromageScore) : null,
      nivelSensitivo: form.nivelSensitivo || null,
      marcaPeleAtual: form.marcaPeleAtual ? Number(form.marcaPeleAtual) : null,
      taxaInfusao: form.taxaInfusao || null,
      complicacoes: form.complicacoes || null,
      observacoes: form.observacoes || null,
      anestesistaNome: form.anestesistaNome || null,
      residenteNome: form.residenteNome || null,
      ...(retirarCateter && {
        retirada: {
          dataRetirada: dataRetirada ? dataRetirada.toISOString() : new Date().toISOString(),
          motivo: motivoFinal,
        },
      }),
    })
  }

  const sitioOptions = SITIO_INSERCAO_OPTIONS.map((s) => ({ value: s, label: s }))
  const bromageOptions = BROMAGE_SCALE.map((b) => ({
    value: String(b.value),
    label: b.label,
  }))
  const complicacoesOptions = COMPLICACOES_COMUNS.map((c) => ({ value: c, label: c }))

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Nova Avaliação — {formatDiaPoLabel(diaPo)}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <DatePicker
          label="Data da avaliação *"
          placeholder="Selecione a data"
          value={dataAvaliacao}
          onChange={(date) => setDataAvaliacao(date)}
        />
        <p className="text-xs text-muted-foreground -mt-1">
          {diaPo == null
            ? 'A data não pode ser anterior à inserção do cateter.'
            : `Calculado automaticamente: ${formatDiaPoLabel(diaPo)}.`}
        </p>

        <Select
          label={isHro ? 'Anestesiologista' : 'Anestesiologista *'}
          searchable
          options={anestesiologistas}
          value={form.anestesistaNome}
          onChange={(val) => handleChange('anestesistaNome', val)}
          placeholder="Selecione o anestesiologista..."
        />

        {isHro && (
          <Select
            label="Residente"
            searchable
            options={residentes}
            value={form.residenteNome}
            onChange={(val) => handleChange('residenteNome', val)}
            placeholder="Selecione o residente..."
          />
        )}

        <Textarea
          label="Plano do dia"
          placeholder="Descreva o plano para este PO..."
          value={form.planoDia}
          onChange={(val) => handleChange('planoDia', val)}
          rows={2}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Select
            label="Sítio de inserção"
            options={sitioOptions}
            value={form.sitioInsercao}
            onChange={(val) => handleChange('sitioInsercao', val)}
            placeholder="Selecione..."
          />
          <Select
            label="Escala Bromage"
            options={bromageOptions}
            value={form.bromageScore}
            onChange={(val) => handleChange('bromageScore', val)}
            placeholder="Selecione..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <Input
            label="Nível sensitivo"
            placeholder="Ex: T10"
            value={form.nivelSensitivo}
            onChange={(e) => handleChange('nivelSensitivo', e.target.value)}
          />
          <Input
            label="Marca pele atual (cm)"
            type="number"
            step="0.1"
            placeholder="cm"
            value={form.marcaPeleAtual}
            onChange={(e) => handleChange('marcaPeleAtual', e.target.value)}
          />
        </div>

        <Input
          label="Taxa de infusão"
          placeholder="Ex: 5 mL/h"
          value={form.taxaInfusao}
          onChange={(e) => handleChange('taxaInfusao', e.target.value)}
        />

        <Select
          label="Complicações"
          options={complicacoesOptions}
          value={form.complicacoes}
          onChange={(val) => handleChange('complicacoes', val)}
          placeholder="Nenhuma"
        />

        <Textarea
          label="Observações"
          placeholder="Observações adicionais..."
          value={form.observacoes}
          onChange={(val) => handleChange('observacoes', val)}
          rows={2}
        />

        {isHro && (
          <p className="text-xs text-muted-foreground">
            * Em HRO, é obrigatório informar o anestesiologista e/ou o residente.
          </p>
        )}

        <div className="pt-3 mt-3 border-t border-border space-y-3">
          <Switch
            checked={retirarCateter}
            onChange={setRetirarCateter}
            label="Retirar cateter após esta avaliação"
            size="sm"
          />

          {retirarCateter && (
            <div className="space-y-3 pl-1">
              <DatePicker
                label="Data da Retirada"
                placeholder="Selecione a data"
                value={dataRetirada}
                onChange={(date) => setDataRetirada(date)}
              />
              <Select
                label="Motivo da Retirada *"
                options={motivoOptions}
                value={motivoRetirada}
                onChange={(val) => setMotivoRetirada(val)}
                placeholder="Selecione o motivo..."
              />
              {motivoRetirada === 'Outro' && (
                <Textarea
                  label="Especifique o motivo"
                  placeholder="Descreva o motivo..."
                  value={motivoOutro}
                  onChange={(val) => setMotivoOutro(val)}
                  rows={2}
                />
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant={retirarCateter ? 'destructive' : 'default'}
          className="w-full"
          disabled={saving}
          loading={saving}
        >
          {retirarCateter ? 'Salvar Avaliação e Retirar Cateter' : 'Salvar Avaliação'}
        </Button>
      </form>
    </Card>
  )
}
