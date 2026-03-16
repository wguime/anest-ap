import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, DatePicker } from '@/design-system';
import {
  User,
  AlertTriangle,
  Activity,
  Stethoscope,
  Send,
  EyeOff,
  Check,
  Info,
  Lock,
  Shield,
  ChevronLeft
} from 'lucide-react';
import {
  INCIDENT_TYPES,
  SEVERITY_LEVELS,
  LOCAIS,
  FUNCOES,
  FASES_PROCEDIMENTO,
  TIPOS_ANESTESIA,
  MONITORAMENTOS,
  IDENTIFICATION_TYPES,
  generateIncidentProtocol,
  generateTrackingCode,
  createGestaoInternaTemplate
} from '@/data/incidentesConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { useMessages } from '@/contexts/MessagesContext';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { PrivacyPolicyModal } from '@/components/PrivacyPolicyModal';
import { useUser } from '@/contexts/UserContext';

// Time picker using DS Selects (hora + minuto)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const v = String(i).padStart(2, '0');
  return { value: v, label: v };
});
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const v = String(i).padStart(2, '0');
  return { value: v, label: v };
});

function TimePicker({ value, onChange }) {
  const [hour, minute] = value ? value.split(':') : ['', ''];
  const handleHour = (h) => onChange(h && minute ? `${h}:${minute}` : h ? `${h}:00` : '');
  const handleMinute = (m) => onChange(hour && m ? `${hour}:${m}` : '');
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        value={hour}
        onChange={handleHour}
        placeholder="Hora"
        options={HOUR_OPTIONS}
        size="sm"
      />
      <Select
        value={minute}
        onChange={handleMinute}
        placeholder="Min"
        options={MINUTE_OPTIONS}
        size="sm"
      />
    </div>
  );
}

// Input field component
function FormField({ label, required, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#111827] dark:text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">{hint}</p>
      )}
    </div>
  );
}

// Text input
function TextInput({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] bg-white dark:bg-[#1A2F23] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] dark:placeholder:text-[#4B5E55] focus:outline-none focus:ring-2 focus:ring-[#006837] dark:focus:ring-[#2ECC71] focus:border-transparent transition-all"
      {...props}
    />
  );
}

// Textarea
function TextArea({ value, onChange, placeholder, rows = 4, ...props }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] bg-white dark:bg-[#1A2F23] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] dark:placeholder:text-[#4B5E55] focus:outline-none focus:ring-2 focus:ring-[#006837] dark:focus:ring-[#2ECC71] focus:border-transparent transition-all resize-none"
      {...props}
    />
  );
}


// Checkbox group
function CheckboxGroup({ options, selected, onChange }) {
  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleOption(opt.value)}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${isSelected
                ? 'bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916]'
                : 'bg-[#F3F4F6] dark:bg-[#243530] text-[#6B7280] dark:text-[#6B8178] hover:bg-[#E5E7EB] dark:hover:bg-[#2D4A3E]'
              }
            `}
          >
            {isSelected && <Check className="w-4 h-4" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Componente de seleção de tipo de identificação
function IdentificationTypeSelector({ selected, onSelect }) {
  const getIcon = (type) => {
    switch (type) {
      case 'identificado': return <User className="w-5 h-5" />;
      case 'confidencial': return <Lock className="w-5 h-5" />;
      case 'anonimo': return <EyeOff className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#111827] dark:text-white">
        Como deseja se identificar? <span className="text-red-500">*</span>
      </p>
      <div className="space-y-2">
        {Object.values(IDENTIFICATION_TYPES).map((type) => {
          const isSelected = selected === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onSelect(type.value)}
              className={`
                w-full p-4 rounded-xl border-2 text-left transition-all
                ${isSelected
                  ? 'border-[#006837] dark:border-[#2ECC71] bg-[#F0FFF4] dark:bg-[#0D2818]'
                  : 'border-[#E5E7EB] dark:border-[#2D4A3E] bg-white dark:bg-[#1A2F23] hover:border-[#006837]/50 dark:hover:border-[#2ECC71]/50'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isSelected
                      ? 'bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916]'
                      : 'bg-[#F3F4F6] dark:bg-[#243530] text-[#6B7280] dark:text-[#6B8178]'
                    }
                  `}
                >
                  {getIcon(type.value)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isSelected ? 'text-[#006837] dark:text-[#2ECC71]' : 'text-[#111827] dark:text-white'}`}>
                      {type.label}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-1">
                    {type.description}
                  </p>
                  <p className="text-xs font-medium mt-1" style={{ color: type.color }}>
                    {type.visibilidade}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Seção 1: Notificante
function SecaoNotificante({ data, onChange, onOpenPrivacy }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const showPersonalFields = data.tipoIdentificacao !== 'anonimo';

  return (
    <div className="space-y-5">
      {/* Banner LGPD */}
      <div className="p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] border border-[#C8E6C9] dark:border-[#2A3F36]">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#004225] dark:text-white">
              Proteção de Dados (LGPD)
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-1">
              Seus dados são protegidos conforme a Lei Geral de Proteção de Dados. Você tem direito a acesso, correção e exclusão de suas informações.{' '}
              <button type="button" onClick={onOpenPrivacy} className="underline font-medium hover:opacity-80">Política de Privacidade</button>
            </p>
          </div>
        </div>
      </div>

      {/* Seletor de tipo de identificação */}
      <IdentificationTypeSelector
        selected={data.tipoIdentificacao}
        onSelect={(value) => updateField('tipoIdentificacao', value)}
      />

      {/* Aviso sobre código de rastreio para anônimos/confidenciais */}
      {(data.tipoIdentificacao === 'anonimo' || data.tipoIdentificacao === 'confidencial') && (
        <div className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F59E0B]/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#92400E] dark:text-[#FCD34D]">
                Código de Rastreio
              </p>
              <p className="text-xs text-[#A16207] dark:text-[#FBBF24] mt-1">
                Você receberá um código de rastreio para acompanhar o andamento do seu relato de forma segura.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campos pessoais (apenas para identificado e confidencial) */}
      {showPersonalFields && (
        <>
          <FormField label="Nome completo" required>
            <TextInput
              value={data.nome}
              onChange={(value) => updateField('nome', value)}
              placeholder="Seu nome"
            />
          </FormField>

          <FormField label="Função" required>
            <Select
              value={data.funcao}
              onChange={(value) => updateField('funcao', value)}
              placeholder="Selecione sua função"
              options={FUNCOES.map((f) => ({ value: f.value, label: f.label }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Setor">
              <TextInput
                value={data.setor}
                onChange={(value) => updateField('setor', value)}
                placeholder="Ex: Centro Cirúrgico"
              />
            </FormField>

            <FormField label="Ramal">
              <TextInput
                value={data.ramal}
                onChange={(value) => updateField('ramal', value)}
                placeholder="Ex: 1234"
              />
            </FormField>
          </div>

          <FormField label="Email" hint="Para receber atualizações sobre o incidente">
            <TextInput
              type="email"
              value={data.email}
              onChange={(value) => updateField('email', value)}
              placeholder="seu.email@exemplo.com"
            />
          </FormField>
        </>
      )}
    </div>
  );
}

// Seção 2: Incidente
function SecaoIncidente({ data, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  // Array de opções de tipo de incidente (extraído de INCIDENT_TYPES)
  const tipoOptions = [
    { value: 'medicacao', label: 'Medicação' },
    { value: 'cirurgia', label: 'Cirurgia' },
    { value: 'identificacao', label: 'Identificação' },
    { value: 'via_aerea', label: 'Via Aérea' },
    { value: 'cardiovascular', label: 'Cardiovascular' },
    { value: 'equipamento', label: 'Equipamento' },
    { value: 'queda', label: 'Queda' },
    { value: 'outros', label: 'Outros' },
  ];

  const subtipoOptions = data.tipo && INCIDENT_TYPES[data.tipo]?.subtipos
    ? INCIDENT_TYPES[data.tipo].subtipos.map((s) => ({ value: s.value, label: s.label }))
    : [];

  // SEVERITY_LEVELS é um array de objetos
  const severidadeOptions = SEVERITY_LEVELS.map((sev) => ({
    value: sev.value,
    label: `${sev.label} - ${sev.description}`,
  }));

  // LOCAIS é um array de objetos
  const localOptions = LOCAIS.map((l) => ({ value: l.value, label: l.label }));

  return (
    <div className="space-y-5">
      <FormField label="Data do incidente" required>
        <DatePicker
          value={data.dataOcorrencia ? new Date(data.dataOcorrencia + 'T00:00:00') : null}
          onChange={(date) => updateField('dataOcorrencia', date ? date.toISOString().slice(0, 10) : '')}
          placeholder="dd/mm/aaaa"
        />
      </FormField>

      <FormField label="Hora" required>
        <TimePicker
          value={data.horaOcorrencia}
          onChange={(value) => updateField('horaOcorrencia', value)}
        />
      </FormField>

      <FormField label="Local" required>
        <Select
          value={data.local}
          onChange={(value) => updateField('local', value)}
          placeholder="Selecione o local"
          options={localOptions}
        />
      </FormField>

      <FormField label="Tipo do incidente" required>
        <Select
          value={data.tipo}
          onChange={(newValue) => {
            onChange({ ...data, tipo: newValue, subtipo: '' });
          }}
          placeholder="Selecione o tipo"
          options={tipoOptions}
        />
      </FormField>

      {subtipoOptions.length > 0 && (
        <FormField label="Subtipo">
          <Select
            value={data.subtipo}
            onChange={(value) => updateField('subtipo', value)}
            placeholder="Selecione o subtipo"
            options={subtipoOptions}
          />
        </FormField>
      )}

      <FormField label="Severidade" required>
        <Select
          value={data.severidade}
          onChange={(value) => updateField('severidade', value)}
          placeholder="Selecione a severidade"
          options={severidadeOptions}
        />
      </FormField>

      {data.severidade && (() => {
        const sevConfig = SEVERITY_LEVELS.find(s => s.value === data.severidade);
        return sevConfig ? (
          <div
            className="p-3 rounded-xl border"
            style={{
              backgroundColor: `${sevConfig.color}15`,
              borderColor: `${sevConfig.color}40`,
            }}
          >
            <p className="text-sm" style={{ color: sevConfig.color }}>
              {sevConfig.description}
            </p>
          </div>
        ) : null;
      })()}

      <FormField label="Descrição detalhada do incidente" required>
        <TextArea
          value={data.descricao}
          onChange={(value) => updateField('descricao', value)}
          placeholder="Descreva o que aconteceu, quem estava envolvido, circunstâncias..."
          rows={5}
        />
      </FormField>
    </div>
  );
}

// Seção 3: Impacto
function SecaoImpacto({ data, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const danoOptions = [
    { value: 'nenhum', label: 'Nenhum dano' },
    { value: 'leve', label: 'Dano leve/temporário' },
    { value: 'moderado', label: 'Dano moderado' },
    { value: 'grave', label: 'Dano grave' },
    { value: 'obito', label: 'Óbito' },
  ];

  return (
    <div className="space-y-5">
      <FormField label="Houve dano ao paciente?" required>
        <Select
          value={data.danoAoPaciente}
          onChange={(value) => updateField('danoAoPaciente', value)}
          placeholder="Selecione"
          options={danoOptions}
        />
      </FormField>

      {data.danoAoPaciente && data.danoAoPaciente !== 'nenhum' && (
        <FormField label="Descreva o dano">
          <TextArea
            value={data.descricaoDano}
            onChange={(value) => updateField('descricaoDano', value)}
            placeholder="Descreva o tipo de dano sofrido pelo paciente..."
            rows={3}
          />
        </FormField>
      )}

      <FormField label="Quais ações foram tomadas imediatamente?">
        <TextArea
          value={data.acoesTomadas}
          onChange={(value) => updateField('acoesTomadas', value)}
          placeholder="Descreva as medidas adotadas após o incidente..."
          rows={3}
        />
      </FormField>

      <FormField label="Sugestões de melhoria">
        <TextArea
          value={data.sugestoesMelhoria}
          onChange={(value) => updateField('sugestoesMelhoria', value)}
          placeholder="O que poderia ser feito para evitar que isso aconteça novamente?"
          rows={3}
        />
      </FormField>
    </div>
  );
}

// Seção 4: Contexto Anestesiologia
function SecaoContexto({ data, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const faseOptions = FASES_PROCEDIMENTO.map((f) => ({ value: f.value, label: f.label }));
  const anestesiaOptions = TIPOS_ANESTESIA.map((a) => ({ value: a.value, label: a.label }));
  const monitoramentoOptions = MONITORAMENTOS.map((m) => ({ value: m.value, label: m.label }));

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] border border-[#A7F3D0] dark:border-[#2D4A3E]">
        <p className="text-sm text-[#047857] dark:text-[#6EE7B7]">
          Esta seção é específica para contextos anestesiológicos. Preencha se aplicável.
        </p>
      </div>

      <FormField label="Fase do procedimento">
        <Select
          value={data.faseProcedimento}
          onChange={(value) => updateField('faseProcedimento', value)}
          placeholder="Selecione a fase"
          options={faseOptions}
        />
      </FormField>

      <FormField label="Tipo de anestesia">
        <Select
          value={data.tipoAnestesia}
          onChange={(value) => updateField('tipoAnestesia', value)}
          placeholder="Selecione o tipo"
          options={anestesiaOptions}
        />
      </FormField>

      <FormField label="Monitoramento em uso">
        <CheckboxGroup
          options={monitoramentoOptions}
          selected={data.monitoramento || []}
          onChange={(value) => updateField('monitoramento', value)}
        />
      </FormField>

      <FormField label="Observações adicionais">
        <TextArea
          value={data.observacoes}
          onChange={(value) => updateField('observacoes', value)}
          placeholder="Informações complementares relevantes..."
          rows={3}
        />
      </FormField>
    </div>
  );
}

// Modal de sucesso
function SuccessModal({ protocolo, trackingCode, tipoIdentificacao, onClose }) {
  const showTrackingCode = (tipoIdentificacao === 'anonimo' || tipoIdentificacao === 'confidencial') && trackingCode;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-[#1A2F23] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#D1FAE5] dark:bg-[#065F46] flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-[#059669]" />
          </div>

          <h2 className="text-xl font-bold text-[#111827] dark:text-white mb-2">
            Incidente Registrado
          </h2>

          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-6">
            Sua notificação foi enviada com sucesso aos responsáveis.
          </p>

          <div className="w-full space-y-4 mb-6">
            <div className="p-4 rounded-xl bg-[#F3F4F6] dark:bg-[#243530]">
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-1">Protocolo</p>
              <p className="text-lg font-mono font-semibold text-[#111827] dark:text-white">
                {protocolo}
              </p>
            </div>

            {showTrackingCode && (
              <div className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F59E0B]/30">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-[#92400E] dark:text-[#FBBF24]" />
                  <p className="text-xs text-[#92400E] dark:text-[#FBBF24] font-medium">
                    Código de Rastreio (guarde este código!)
                  </p>
                </div>
                <p className="text-lg font-mono font-semibold text-[#92400E] dark:text-[#FCD34D]">
                  {trackingCode}
                </p>
                <p className="text-xs text-[#A16207] dark:text-[#FBBF24] mt-2">
                  Use este código para acompanhar o andamento da sua notificação de forma {tipoIdentificacao === 'anonimo' ? 'anônima' : 'confidencial'}.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916] font-medium hover:bg-[#005530] dark:hover:bg-[#27AE60] transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

// Header de seção
function SectionHeader({ number, icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-[#006837] dark:bg-[#2ECC71] flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-white dark:text-[#111916]">{number}</span>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
          <h2 className="text-lg font-semibold text-[#111827] dark:text-white">
            {title}
          </h2>
        </div>
        <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function NovoIncidentePage({ onNavigate }) {
  const { addIncidente } = useIncidents();
  const { createSystemNotification } = useMessages();
  const { incidentResponsibles } = useUsersManagement();
  const { user } = useUser();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Estado do formulário
  const [notificante, setNotificante] = useState({
    tipoIdentificacao: 'identificado',
    nome: '',
    funcao: '',
    setor: '',
    ramal: '',
    email: '',
  });

  const [incidente, setIncidente] = useState({
    dataOcorrencia: '',
    horaOcorrencia: '',
    local: '',
    tipo: '',
    subtipo: '',
    severidade: '',
    descricao: '',
  });

  const [impacto, setImpacto] = useState({
    danoAoPaciente: '',
    descricaoDano: '',
    acoesTomadas: '',
    sugestoesMelhoria: '',
  });

  const [contextoAnest, setContextoAnest] = useState({
    faseProcedimento: '',
    tipoAnestesia: '',
    monitoramento: [],
    observacoes: '',
  });

  // LGPD: consentimento explícito para tratamento de dados pessoais
  const [consentimento, setConsentimento] = useState(false);

  // Validação de cada seção
  const isNotificanteValid = () => {
    if (!notificante.tipoIdentificacao) return false;
    if (notificante.tipoIdentificacao === 'anonimo') return true;
    return notificante.nome.trim() !== '' && notificante.funcao !== '';
  };

  const isIncidenteValid = () => {
    return (
      incidente.dataOcorrencia !== '' &&
      incidente.horaOcorrencia !== '' &&
      incidente.local !== '' &&
      incidente.tipo !== '' &&
      incidente.severidade !== '' &&
      incidente.descricao.trim() !== ''
    );
  };

  const isImpactoValid = () => {
    return impacto.danoAoPaciente !== '';
  };

  // LGPD: consentimento é obrigatório para não-anônimos
  const isConsentimentoValid = () => {
    if (notificante.tipoIdentificacao === 'anonimo') return true;
    return consentimento;
  };

  // Validação completa do formulário
  const isFormValid = () => {
    return isNotificanteValid() && isIncidenteValid() && isImpactoValid() && isConsentimentoValid();
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;

    const protocolo = generateIncidentProtocol();
    const needsTrackingCode = notificante.tipoIdentificacao === 'anonimo' || notificante.tipoIdentificacao === 'confidencial';
    const trackingCode = needsTrackingCode ? generateTrackingCode() : null;

    // Dados do notificante baseado no tipo de identificação
    const notificanteData = {
      tipoIdentificacao: notificante.tipoIdentificacao,
    };

    // Adiciona dados pessoais apenas se não for anônimo
    if (notificante.tipoIdentificacao !== 'anonimo') {
      notificanteData.nome = notificante.nome;
      notificanteData.funcao = notificante.funcao;
      notificanteData.setor = notificante.setor;
      notificanteData.ramal = notificante.ramal;
      notificanteData.email = notificante.email;
    }

    const data = {
      id: `inc-${Date.now()}`,
      protocolo,
      trackingCode,
      status: 'pendente',
      notificante: notificanteData,
      incidente,
      impacto,
      contextoAnest,
      source: 'interno',
      createdAt: new Date().toISOString(),
      gestaoInterna: createGestaoInternaTemplate(),
      // LGPD: Não vincular userId a relatos anônimos para garantir anonimato real
      userId: notificante.tipoIdentificacao === 'anonimo' ? null : (user?.id || null),
    };

    // Adicionar ao contexto global
    try {
      await addIncidente(data);
    } catch (err) {
      console.error('Erro ao criar incidente:', err);
    }

    // Gerar notificação in-app para responsáveis
    const responsaveisIds = incidentResponsibles
      .filter(r => r.receberIncidentes && r.notificarApp)
      .map(r => r.id);
    createSystemNotification({
      category: 'incidente',
      subject: `Nova notificação: ${INCIDENT_TYPES[incidente.tipo]?.label || 'Incidente'}`,
      content: `Protocolo ${protocolo} - ${incidente.descricao?.substring(0, 100)}${incidente.descricao?.length > 100 ? '...' : ''}`,
      senderName: 'Sistema de Incidentes',
      priority: incidente.severidade === 'grave' || incidente.severidade === 'critico' ? 'urgente' : 'normal',
      actionUrl: 'incidentes',
      actionLabel: 'Ver Incidentes',
      actionParams: { protocolo },
      recipientIds: responsaveisIds.length > 0 ? responsaveisIds : undefined,
    });
    // Email: handled by supabaseIncidentsService

    setSubmittedData({
      protocolo,
      trackingCode,
      tipoIdentificacao: notificante.tipoIdentificacao
    });
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onNavigate('incidentes');
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('incidentes')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Nova Notificação
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Seção 1: Identificação */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-5 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          <SectionHeader
            number={1}
            icon={User}
            title="Identificação"
            description="Como deseja se identificar"
          />
          <SecaoNotificante data={notificante} onChange={setNotificante} onOpenPrivacy={() => setShowPrivacyPolicy(true)} />
        </div>

        {/* Seção 2: Dados do Incidente */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-5 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          <SectionHeader
            number={2}
            icon={AlertTriangle}
            title="Dados do Incidente"
            description="O que aconteceu"
          />
          <SecaoIncidente data={incidente} onChange={setIncidente} />
        </div>

        {/* Seção 3: Impacto e Ações */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-5 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          <SectionHeader
            number={3}
            icon={Activity}
            title="Impacto e Ações"
            description="Danos e medidas tomadas"
          />
          <SecaoImpacto data={impacto} onChange={setImpacto} />
        </div>

        {/* Seção 4: Contexto Anestesiológico */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-5 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
          <SectionHeader
            number={4}
            icon={Stethoscope}
            title="Contexto Anestesiológico"
            description="Informações específicas (opcional)"
          />
          <SecaoContexto data={contextoAnest} onChange={setContextoAnest} />
        </div>

        {/* Validação e indicadores */}
        {!isFormValid() && (
          <div className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F59E0B]/30 mb-4">
            <p className="text-sm text-[#92400E] dark:text-[#FCD34D]">
              <strong>Campos obrigatórios:</strong> Preencha todos os campos marcados com * para enviar o formulário.
            </p>
          </div>
        )}

        {/* LGPD: Checkbox de consentimento (apenas para não-anônimos) */}
        {notificante.tipoIdentificacao !== 'anonimo' && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setConsentimento(!consentimento)}
              className="flex items-start gap-3 text-left"
            >
              <div
                className={`
                  w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                  ${consentimento
                    ? 'bg-[#006837] dark:bg-[#2ECC71] border-[#006837] dark:border-[#2ECC71]'
                    : 'border-[#E5E7EB] dark:border-[#2D4A3E]'
                  }
                `}
              >
                {consentimento && <Check className="w-3 h-3 text-white dark:text-[#111916]" />}
              </div>
              <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                Autorizo o tratamento dos meus dados pessoais conforme a LGPD para fins de análise deste relato pelo Comitê de Ética.
              </span>
            </button>
          </div>
        )}

        {/* Botão de envio */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid()}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium transition-colors
            ${isFormValid()
              ? 'bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#111916] hover:bg-[#005530] dark:hover:bg-[#27AE60]'
              : 'bg-[#E5E7EB] dark:bg-[#2D4A3E] text-[#9CA3AF] dark:text-[#4B5E55] cursor-not-allowed'
            }
          `}
        >
          <Send className="w-4 h-4" />
          Enviar Notificação
        </button>

        <p className="text-xs text-center text-[#6B7280] dark:text-[#6B8178] mt-3">
          Ao enviar, você declara que as informações são verdadeiras.
        </p>
      </div>

      {/* Modal de sucesso */}
      {showSuccess && submittedData && (
        <SuccessModal
          protocolo={submittedData.protocolo}
          trackingCode={submittedData.trackingCode}
          tipoIdentificacao={submittedData.tipoIdentificacao}
          onClose={handleSuccessClose}
        />
      )}

      {/* Modal Política de Privacidade */}
      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
      )}
    </div>
  );
}
