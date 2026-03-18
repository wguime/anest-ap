/**
 * NovaNotaPage - Formulário para criar nova nota fiscal
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Save,
  FileText,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  Plus,
  X,
} from 'lucide-react';
import { Button, BottomNav } from '@/design-system';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';
import { useNotas, useCadastros, useEventos } from '../../hooks/useFaturamento';
import { formatarMoeda } from '../../data/cbhpmData';

function NovaNotaContent({ onNavigate, goBack }) {
  const { createNota } = useNotas();
  const { convenioOptions } = useCadastros();
  const { eventos } = useEventos();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedEventos, setSelectedEventos] = useState([]);

  const [form, setForm] = useState({
    number: '',
    healthInsuranceId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    observations: '',
  });

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Nova Nota Fiscal
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const toggleEvento = (eventoId) => {
    setSelectedEventos(prev =>
      prev.includes(eventoId)
        ? prev.filter(id => id !== eventoId)
        : [...prev, eventoId]
    );
  };

  const totalValue = selectedEventos.reduce((sum, id) => {
    const ev = eventos.find(e => e.id === id);
    return sum + (ev?.finalValue || 0);
  }, 0);

  // Eventos aprovados disponíveis para vincular
  const eventosDisponiveis = eventos.filter(
    e => e.status === 'aprovado' || e.status === 'pendente'
  );

  const validate = () => {
    const newErrors = {};
    if (!form.number.trim()) newErrors.number = 'Número é obrigatório';
    if (!form.healthInsuranceId) newErrors.healthInsuranceId = 'Convênio é obrigatório';
    if (!form.issueDate) newErrors.issueDate = 'Data de emissão é obrigatória';
    if (selectedEventos.length === 0) newErrors.eventos = 'Selecione ao menos um evento';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    const convenio = convenioOptions.find(c => c.value === form.healthInsuranceId);

    const notaData = {
      number: form.number,
      healthInsuranceId: form.healthInsuranceId,
      healthInsuranceName: convenio?.label || '',
      issueDate: new Date(form.issueDate),
      dueDate: form.dueDate ? new Date(form.dueDate) : null,
      events: selectedEventos,
      totalValue,
      status: 'emitida',
      observations: form.observations,
    };

    const result = await createNota(notaData);
    setSaving(false);

    if (result?.success !== false) {
      goBack();
    } else {
      setErrors({ submit: result?.error || 'Erro ao criar nota' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Dados da Nota */}
        <div className="rounded-[20px] p-4 bg-card border border-border space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Dados da Nota</span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Número da Nota *</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={form.number}
                onChange={(e) => updateForm('number', e.target.value)}
                placeholder="Ex: NF-2025-001"
                className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-card border rounded-xl text-foreground placeholder-[#6B7280] focus:outline-none ${
                  errors.number
                    ? 'border-destructive'
                    : 'border-border focus:border-primary dark:focus:border-primary'
                }`}
              />
            </div>
            {errors.number && <p className="text-xs text-destructive mt-1">{errors.number}</p>}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Convênio *</label>
            <select
              value={form.healthInsuranceId}
              onChange={(e) => updateForm('healthInsuranceId', e.target.value)}
              className={`w-full p-3 bg-white dark:bg-card border rounded-xl text-foreground focus:outline-none ${
                errors.healthInsuranceId
                  ? 'border-destructive'
                  : 'border-border focus:border-primary dark:focus:border-primary'
              }`}
            >
              <option value="">Selecione o convênio</option>
              {convenioOptions.filter(c => c.value !== 'all').map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.healthInsuranceId && <p className="text-xs text-destructive mt-1">{errors.healthInsuranceId}</p>}
          </div>
        </div>

        {/* Datas */}
        <div className="rounded-[20px] p-4 bg-card border border-border space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Datas</span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data de Emissão *</label>
            <input
              type="date"
              value={form.issueDate}
              onChange={(e) => updateForm('issueDate', e.target.value)}
              className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary dark:focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Vencimento</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => updateForm('dueDate', e.target.value)}
              className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary dark:focus:border-primary"
            />
          </div>
        </div>

        {/* Eventos */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Eventos</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedEventos.length} selecionado{selectedEventos.length !== 1 ? 's' : ''}
            </span>
          </div>

          {errors.eventos && <p className="text-xs text-destructive mb-2">{errors.eventos}</p>}

          {eventosDisponiveis.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {eventosDisponiveis.map((evento) => {
                const isSelected = selectedEventos.includes(evento.id);
                return (
                  <button
                    key={evento.id}
                    type="button"
                    onClick={() => toggleEvento(evento.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-muted dark:bg-[#1E3A2F] border-primary'
                        : 'bg-white dark:bg-card border-border'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-foreground truncate">
                        {evento.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {evento.procedureDescription || 'Sem descrição'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {formatarMoeda(evento.finalValue)}
                      </span>
                      {isSelected && <X className="w-4 h-4 text-destructive" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento disponível</p>
          )}
        </div>

        {/* Total */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              <span className="font-medium text-foreground">Valor Total</span>
            </div>
            <span className="text-2xl font-bold text-success">
              {formatarMoeda(totalValue)}
            </span>
          </div>
        </div>

        {/* Observações */}
        <div className="rounded-[20px] p-4 bg-card border border-border">
          <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
          <textarea
            value={form.observations}
            onChange={(e) => updateForm('observations', e.target.value)}
            placeholder="Observações adicionais..."
            rows={3}
            className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground placeholder-[#6B7280] focus:outline-none focus:border-primary dark:focus:border-primary resize-none"
          />
        </div>

        {errors.submit && (
          <div className="p-3 bg-destructive/10 border border-destructive rounded-xl">
            <p className="text-sm text-destructive">{errors.submit}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-20 left-0 right-0 p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+1rem))] bg-card border-t border-border">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={goBack}
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            className="flex-1"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Criar Nota'}
          </Button>
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}

export default function NovaNotaPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <NovaNotaContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
