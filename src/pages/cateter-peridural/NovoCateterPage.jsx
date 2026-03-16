/**
 * NovoCateterPage - Form to register a new epidural catheter
 */
import { useState } from 'react'
import {
  ChevronLeft,
  Save,
} from 'lucide-react'
import {
  Card,
  Button,
  Input,
  Textarea,
  DatePicker,
} from '@/design-system'
import { useToast } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useCateterPeridural } from '@/contexts/CateterPeridualContext'
import { HOSPITAIS_OPTIONS } from '@/data/cateterPeridualConfig'

const initialForm = {
  hospital: 'unimed',
  paciente: '',
  leito: '',
  cirurgia: '',
  dataCirurgia: null,
  cirurgiao: '',
  anestesista: '',
  nivelPuncao: '',
  tamanhoCpd: '',
  marcaCpdPele: '',
  marcaCpdDentro: '',
  dosesTransoperatorias: '',
  repiqueSrpa: '',
  dataInsercao: new Date(),
}

export default function NovoCateterPage({ onNavigate, goBack }) {
  const { user } = useUser()
  const { addCateter } = useCateterPeridural()
  const { toast } = useToast()
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

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

    setSaving(true)
    try {
      await addCateter(
        {
          ...form,
          dataCirurgia: form.dataCirurgia ? form.dataCirurgia.toISOString().split('T')[0] : null,
          marcaCpdPele: form.marcaCpdPele ? Number(form.marcaCpdPele) : null,
          marcaCpdDentro: form.marcaCpdDentro ? Number(form.marcaCpdDentro) : null,
          dataInsercao: form.dataInsercao ? form.dataInsercao.toISOString() : new Date().toISOString(),
        },
        {
          userId: user?.uid,
          userName: user?.displayName || 'Usuário',
        }
      )
      toast({
        title: 'Cateter cadastrado',
        description: `Cateter de ${form.paciente} registrado com sucesso.`,
        variant: 'success',
      })
      goBack()
    } catch (err) {
      console.error('[NovoCateter] Error:', err)
      toast({
        title: 'Erro ao cadastrar',
        description: err.message || 'Tente novamente.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
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
              Novo Cateter
            </h1>
            <div className="min-w-[70px]" />
          </div>
        </div>
      </nav>

      <div className="h-14" aria-hidden="true" />

      <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 space-y-4">
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

          <div className="grid grid-cols-2 gap-3 items-end">
            <Input
              label="Cirurgião"
              placeholder="Nome"
              value={form.cirurgiao}
              onChange={(e) => handleChange('cirurgiao', e.target.value)}
            />
            <Input
              label="Anestesista"
              placeholder="Nome"
              value={form.anestesista}
              onChange={(e) => handleChange('anestesista', e.target.value)}
            />
          </div>

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

          <DatePicker
            label="Data Inserção"
            placeholder="Selecione a data"
            value={form.dataInsercao}
            onChange={(date) => handleChange('dataInsercao', date)}
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

        {/* Submit */}
        <Button
          type="submit"
          variant="default"
          className="w-full"
          disabled={saving}
          loading={saving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Cadastrar Cateter
        </Button>
      </form>
    </div>
  )
}
