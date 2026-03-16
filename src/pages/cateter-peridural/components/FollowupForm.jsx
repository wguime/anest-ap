/**
 * FollowupForm - Daily PO evaluation form
 */
import { useState } from 'react'
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
} from '@/design-system'
import { SITIO_INSERCAO_OPTIONS, BROMAGE_SCALE, COMPLICACOES_COMUNS } from '@/data/cateterPeridualConfig'

export default function FollowupForm({ diaPo, onSubmit, saving }) {
  const [form, setForm] = useState({
    planoDia: '',
    sitioInsercao: '',
    bromageScore: '',
    nivelSensitivo: '',
    marcaPeleAtual: '',
    taxaInfusao: '',
    complicacoes: '',
    observacoes: '',
  })

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      diaPo,
      planoDia: form.planoDia || null,
      sitioInsercao: form.sitioInsercao || null,
      bromageScore: form.bromageScore !== '' ? Number(form.bromageScore) : null,
      nivelSensitivo: form.nivelSensitivo || null,
      marcaPeleAtual: form.marcaPeleAtual ? Number(form.marcaPeleAtual) : null,
      taxaInfusao: form.taxaInfusao || null,
      complicacoes: form.complicacoes || null,
      observacoes: form.observacoes || null,
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
        Nova Avaliação — {diaPo}o PO
      </h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          label="Plano do dia"
          placeholder="Descreva o plano para este PO..."
          value={form.planoDia}
          onChange={(val) => handleChange('planoDia', val)}
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3 items-end">
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

        <div className="grid grid-cols-2 gap-3 items-end">
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

        <Button
          type="submit"
          variant="default"
          className="w-full"
          disabled={saving}
          loading={saving}
        >
          Salvar Avaliação
        </Button>
      </form>
    </Card>
  )
}
