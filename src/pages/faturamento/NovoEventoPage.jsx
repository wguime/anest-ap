/**
 * NovoEventoPage - Formulário para criar novo evento de faturamento
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Save,
  User,
  Calendar,
  Building2,
  Stethoscope,
  FileText,
  DollarSign,
} from 'lucide-react';
import { Button, BottomNav } from '@/design-system';
import { FaturamentoProvider, useFaturamento } from '../../contexts/FaturamentoContext';
import { useCadastros, useCalculoValores } from '../../hooks/useFaturamento';
import {
  PORTES_LIST,
  PROCEDIMENTOS_COMUNS,
  TIPOS_EVENTO,
  formatarMoeda,
  calcularValorEvento,
} from '../../data/cbhpmData';

function NovoEventoContent({ onNavigate, goBack }) {
  const { createEvento, getConvenioById } = useFaturamento();
  const { convenios, hospitais, cirurgioes, anestesistas } = useCadastros();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    type: 'honorario',
    patientName: '',
    patientDocument: '',
    eventDate: new Date().toISOString().split('T')[0],
    healthInsuranceId: '',
    hospitalId: '',
    surgeonId: '',
    anesthesiologistId: '',
    procedureCode: '',
    procedureDescription: '',
    porte: '',
    observations: '',
  });

  // Calcular valor baseado no porte e convênio
  const [valorCalculado, setValorCalculado] = useState(0);

  useEffect(() => {
    if (form.porte && form.healthInsuranceId) {
      const convenio = getConvenioById(form.healthInsuranceId);
      const valor = calcularValorEvento(form.porte, convenio);
      setValorCalculado(valor);
    } else if (form.porte) {
      const porteInfo = PORTES_LIST.find(p => p.codigo === form.porte);
      setValorCalculado(porteInfo?.valor || 0);
    } else {
      setValorCalculado(0);
    }
  }, [form.porte, form.healthInsuranceId, getConvenioById]);

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Novo Evento
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

  const handleProcedimentoSelect = (codigo) => {
    const proc = PROCEDIMENTOS_COMUNS.find(p => p.codigo === codigo);
    if (proc) {
      setForm(prev => ({
        ...prev,
        procedureCode: proc.codigo,
        procedureDescription: proc.descricao,
        porte: proc.porte,
      }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!form.patientName.trim()) {
      newErrors.patientName = 'Nome do paciente é obrigatório';
    }
    if (!form.eventDate) {
      newErrors.eventDate = 'Data é obrigatória';
    }
    if (!form.healthInsuranceId) {
      newErrors.healthInsuranceId = 'Convênio é obrigatório';
    }
    if (!form.porte) {
      newErrors.porte = 'Porte é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (status = 'rascunho') => {
    if (!validate()) return;

    setSaving(true);

    const convenio = getConvenioById(form.healthInsuranceId);
    const hospital = hospitais.find(h => h.id === form.hospitalId);
    const cirurgiao = cirurgioes.find(c => c.id === form.surgeonId);
    const anestesista = anestesistas.find(a => a.id === form.anesthesiologistId);
    const porteInfo = PORTES_LIST.find(p => p.codigo === form.porte);

    const eventoData = {
      ...form,
      healthInsuranceName: convenio?.name || '',
      hospitalName: hospital?.name || '',
      surgeonName: cirurgiao?.name || '',
      anesthesiologistName: anestesista?.name || '',
      eventDate: new Date(form.eventDate),
      baseValue: porteInfo?.valor || 0,
      finalValue: valorCalculado,
      status,
    };

    const result = await createEvento(eventoData);

    setSaving(false);

    if (result.success) {
      goBack();
    } else {
      setErrors({ submit: result.error || 'Erro ao criar evento' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-32">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Tipo de Evento */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36]">
          <label className="text-sm font-medium text-[#004225] dark:text-white mb-2 block">
            Tipo de Evento
          </label>
          <div className="flex gap-2">
            {Object.values(TIPOS_EVENTO).map((tipo) => (
              <button
                key={tipo.codigo}
                type="button"
                onClick={() => updateForm('type', tipo.codigo)}
                className={`flex-1 p-3 rounded-xl border transition-colors ${
                  form.type === tipo.codigo
                    ? 'bg-[#004225] border-[#004225] text-white'
                    : 'bg-white dark:bg-[#1A2420] border-[#C8E6C9] dark:border-[#2A3F36] text-[#004225] dark:text-white'
                }`}
              >
                <span className="text-sm font-medium">{tipo.descricao}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dados do Paciente */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-[#004225] dark:text-[#2ECC71]" />
            <span className="font-medium text-[#004225] dark:text-white">Paciente</span>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Nome *</label>
            <input
              type="text"
              value={form.patientName}
              onChange={(e) => updateForm('patientName', e.target.value)}
              placeholder="Nome completo do paciente"
              className={`w-full p-3 bg-white dark:bg-[#212D28] border rounded-xl text-[#004225] dark:text-white placeholder-[#6B7280] focus:outline-none ${
                errors.patientName
                  ? 'border-[#DC2626]'
                  : 'border-[#C8E6C9] dark:border-[#2A3F36] focus:border-[#004225] dark:focus:border-[#2ECC71]'
              }`}
            />
            {errors.patientName && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.patientName}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">CPF</label>
            <input
              type="text"
              value={form.patientDocument}
              onChange={(e) => updateForm('patientDocument', e.target.value)}
              placeholder="000.000.000-00"
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white placeholder-[#6B7280] focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
            />
          </div>
        </div>

        {/* Data e Local */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-[#004225] dark:text-[#2ECC71]" />
            <span className="font-medium text-[#004225] dark:text-white">Data e Local</span>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Data do Procedimento *</label>
            <input
              type="date"
              value={form.eventDate}
              onChange={(e) => updateForm('eventDate', e.target.value)}
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
            />
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Hospital</label>
            <select
              value={form.hospitalId}
              onChange={(e) => updateForm('hospitalId', e.target.value)}
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
            >
              <option value="">Selecione o hospital</option>
              {hospitais.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Convênio e Profissionais */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-5 h-5 text-[#004225] dark:text-[#2ECC71]" />
            <span className="font-medium text-[#004225] dark:text-white">Convênio e Equipe</span>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Convênio *</label>
            <select
              value={form.healthInsuranceId}
              onChange={(e) => updateForm('healthInsuranceId', e.target.value)}
              className={`w-full p-3 bg-white dark:bg-[#212D28] border rounded-xl text-[#004225] dark:text-white focus:outline-none ${
                errors.healthInsuranceId
                  ? 'border-[#DC2626]'
                  : 'border-[#C8E6C9] dark:border-[#2A3F36] focus:border-[#004225] dark:focus:border-[#2ECC71]'
              }`}
            >
              <option value="">Selecione o convênio</option>
              {convenios.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.healthInsuranceId && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.healthInsuranceId}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Cirurgião</label>
            <select
              value={form.surgeonId}
              onChange={(e) => updateForm('surgeonId', e.target.value)}
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
            >
              <option value="">Selecione o cirurgião</option>
              {cirurgioes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Anestesista</label>
            <select
              value={form.anesthesiologistId}
              onChange={(e) => updateForm('anesthesiologistId', e.target.value)}
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
            >
              <option value="">Selecione o anestesista</option>
              {anestesistas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Procedimento */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-[#004225] dark:text-[#2ECC71]" />
            <span className="font-medium text-[#004225] dark:text-white">Procedimento</span>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Procedimento Comum</label>
            <select
              value={form.procedureCode}
              onChange={(e) => handleProcedimentoSelect(e.target.value)}
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
            >
              <option value="">Selecione ou digite abaixo</option>
              {PROCEDIMENTOS_COMUNS.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.descricao} (Porte {p.porte})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Descrição do Procedimento</label>
            <textarea
              value={form.procedureDescription}
              onChange={(e) => updateForm('procedureDescription', e.target.value)}
              placeholder="Descreva o procedimento realizado"
              rows={2}
              className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white placeholder-[#6B7280] focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71] resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Porte Anestésico *</label>
            <select
              value={form.porte}
              onChange={(e) => updateForm('porte', e.target.value)}
              className={`w-full p-3 bg-white dark:bg-[#212D28] border rounded-xl text-[#004225] dark:text-white focus:outline-none ${
                errors.porte
                  ? 'border-[#DC2626]'
                  : 'border-[#C8E6C9] dark:border-[#2A3F36] focus:border-[#004225] dark:focus:border-[#2ECC71]'
              }`}
            >
              <option value="">Selecione o porte</option>
              {PORTES_LIST.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo} - {formatarMoeda(p.valor)}
                </option>
              ))}
            </select>
            {errors.porte && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.porte}</p>
            )}
          </div>
        </div>

        {/* Valor Calculado */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#34C759]" />
              <span className="font-medium text-[#004225] dark:text-white">Valor Calculado</span>
            </div>
            <span className="text-2xl font-bold text-[#34C759]">
              {formatarMoeda(valorCalculado)}
            </span>
          </div>
          {form.healthInsuranceId && form.porte && (
            <p className="text-xs text-[#6B7280] mt-2">
              Valor ajustado conforme negociação do convênio
            </p>
          )}
        </div>

        {/* Observações */}
        <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36]">
          <label className="text-xs text-[#6B7280] mb-1 block">Observações</label>
          <textarea
            value={form.observations}
            onChange={(e) => updateForm('observations', e.target.value)}
            placeholder="Observações adicionais..."
            rows={3}
            className="w-full p-3 bg-white dark:bg-[#212D28] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white placeholder-[#6B7280] focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71] resize-none"
          />
        </div>

        {/* Erro de Submit */}
        {errors.submit && (
          <div className="p-3 bg-[#DC2626]/10 border border-[#DC2626] rounded-xl">
            <p className="text-sm text-[#DC2626]">{errors.submit}</p>
          </div>
        )}
      </div>

      {/* Footer com Botões */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white dark:bg-[#1A2420] border-t border-[#C8E6C9] dark:border-[#2A3F36]">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleSubmit('rascunho')}
            disabled={saving}
          >
            Salvar Rascunho
          </Button>
          <Button
            variant="default"
            className="flex-1"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={() => handleSubmit('pendente')}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Criar Evento'}
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

export default function NovoEventoPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <NovoEventoContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
