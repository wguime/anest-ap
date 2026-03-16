/**
 * NovoPlanoPage - Formulario de criacao de plano de acao
 */
import { useState } from 'react'
import {
  ChevronLeft,
  Save,
  ClipboardList,
} from 'lucide-react'
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Badge,
} from '@/design-system'
import { cn } from '@/design-system/utils/tokens'
import { useUser } from '@/contexts/UserContext'
import { usePlanosAcao } from '@/contexts/PlanosAcaoContext'
import { PRIORIDADES, TIPO_ORIGEM } from '@/data/planosAcaoConfig'

export default function NovoPlanoPage({ onNavigate, goBack, params }) {
  const { user } = useUser()
  const { addPlano } = usePlanosAcao()
  const [saving, setSaving] = useState(false)

  // Pre-fill from origin if provided
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    tipoOrigem: params?.tipoOrigem || 'manual',
    origemId: params?.origemId || '',
    origemDescricao: params?.origemDescricao || '',
    responsavelNome: '',
    prazo: '',
    prioridade: 'media',
    tags: '',
  })

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.titulo.trim()) return

    setSaving(true)
    try {
      const plano = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipoOrigem: form.tipoOrigem,
        origemId: form.origemId || null,
        origemDescricao: form.origemDescricao || null,
        status: 'planejamento',
        fasePdca: 'plan',
        responsavelId: user?.uid || null,
        responsavelNome: form.responsavelNome.trim() || user?.displayName || 'Nao atribuido',
        prazo: form.prazo || null,
        prioridade: form.prioridade,
        eficacia: null,
        evidencias: [],
        historico: [
          {
            data: new Date().toISOString(),
            acao: 'Plano criado',
            autor: user?.displayName || 'Sistema',
          },
        ],
        tags: form.tags
          ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        createdBy: user?.uid || '',
        createdByName: user?.displayName || '',
      }

      await addPlano(plano)
      goBack()
    } catch (err) {
      console.error('[NovoPlanoPage] Error creating plano:', err)
    } finally {
      setSaving(false)
    }
  }

  const isValid = form.titulo.trim().length > 0

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
              Novo Plano de Acao
            </h1>
            <div className="min-w-[70px]" />
          </div>
        </div>
      </nav>

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Titulo */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              Informacoes do Plano
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Titulo *
            </label>
            <Input
              placeholder="Ex: Implementar dupla checagem de medicamentos"
              value={form.titulo}
              onChange={(e) => updateField('titulo', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Descricao
            </label>
            <Textarea
              placeholder="Descreva o objetivo e as acoes planejadas..."
              value={form.descricao}
              onChange={(e) => updateField('descricao', e.target.value)}
              rows={4}
            />
          </div>
        </Card>

        {/* Origem */}
        <Card className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Origem
          </h2>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tipo de Origem
            </label>
            <Select
              value={form.tipoOrigem}
              onChange={(e) => updateField('tipoOrigem', e.target.value)}
            >
              {Object.entries(TIPO_ORIGEM).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </Select>
          </div>

          {form.tipoOrigem !== 'manual' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descricao da Origem
              </label>
              <Input
                placeholder="Ex: Incidente #INC-2025-001"
                value={form.origemDescricao}
                onChange={(e) => updateField('origemDescricao', e.target.value)}
              />
            </div>
          )}
        </Card>

        {/* Responsavel e Prazo */}
        <Card className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Responsavel e Prazo
          </h2>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Responsavel
            </label>
            <Input
              placeholder="Nome do responsavel"
              value={form.responsavelNome}
              onChange={(e) => updateField('responsavelNome', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Prazo
            </label>
            <Input
              type="date"
              value={form.prazo}
              onChange={(e) => updateField('prazo', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Prioridade
            </label>
            <Select
              value={form.prioridade}
              onChange={(e) => updateField('prioridade', e.target.value)}
            >
              {Object.entries(PRIORIDADES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tags (separadas por virgula)
            </label>
            <Input
              placeholder="Ex: medicamentos, seguranca, urgente"
              value={form.tags}
              onChange={(e) => updateField('tags', e.target.value)}
            />
          </div>
        </Card>

        {/* Submit */}
        <Button
          variant="default"
          className="w-full"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          {saving ? 'Salvando...' : 'Criar Plano de Acao'}
        </Button>
      </div>
    </div>
  )
}
