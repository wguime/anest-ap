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
  SETORES,
  TURNOS,
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

// Input field component
function FormField({ label, required, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
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
      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border bg-white dark:bg-muted text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:border-transparent transition-all"
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
      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border bg-white dark:bg-muted text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:border-transparent transition-all resize-none"
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
                ? 'bg-primary text-white dark:text-primary-foreground'
                : 'bg-[#F3F4F6] dark:bg-muted text-muted-foreground hover:bg-[#E5E7EB] dark:hover:bg-[#2D4A3E]'
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
      <p className="text-sm font-medium text-foreground">
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
                  ? 'border-primary bg-background dark:bg-[#0D2818]'
                  : 'border-[#E5E7EB] dark:border-border bg-white dark:bg-muted hover:border-primary/50 dark:hover:border-primary/50'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isSelected
                      ? 'bg-primary text-white dark:text-primary-foreground'
                      : 'bg-[#F3F4F6] dark:bg-muted text-muted-foreground'
                    }
                  `}
                >
                  {getIcon(type.value)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {type.label}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
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
      <div className="p-4 rounded-xl bg-muted border border-border">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Proteção de Dados (LGPD)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
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
        <div className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-warning/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#92400E] dark:text-warning">
                Código de Rastreio
              </p>
              <p className="text-xs text-[#A16207] dark:text-warning mt-1">
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

  const severidadeOptions = SEVERITY_LEVELS.map((sev) => ({
    value: sev.value,
    label: `${sev.label} - ${sev.description}`,
  }));

  const localOptions = LOCAIS.map((l) => ({ value: l.value, label: l.label }));
  const setorOptions = SETORES.map((s) => ({ value: s.value, label: s.label }));
  const turnoOptions = TURNOS.map((t) => ({ value: t.value, label: t.label }));

  const showLocalComplemento = data.local === 'clinicas_odontologicas' || data.local === 'outros';
  const showSetorComplemento = data.setor === 'outros';
  const showPacienteFields = data.houvePackienteEnvolvido === 'sim';

  return (
    <div className="space-y-5">
      {/* Data do registro (somente leitura) */}
      <FormField label="Data do registro">
        <input
          type="text"
          value={data.dataRegistro}
          readOnly
          disabled
          className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-border bg-muted text-muted-foreground focus:outline-none transition-all cursor-not-allowed"
        />
      </FormField>

      <FormField label="Data da ocorrência do incidente/evento" required>
        <DatePicker
          value={data.dataOcorrencia ? new Date(data.dataOcorrencia + 'T00:00:00') : null}
          onChange={(date) => updateField('dataOcorrencia', date ? date.toISOString().slice(0, 10) : '')}
          placeholder="dd/mm/aaaa"
        />
      </FormField>

      <FormField label="Hora / Turno da ocorrência" required>
        <Select
          value={data.turno}
          onChange={(value) => updateField('turno', value)}
          placeholder="Selecione o turno"
          options={turnoOptions}
        />
      </FormField>

      <FormField label="Local da ocorrência" required>
        <Select
          value={data.local}
          onChange={(value) => onChange({ ...data, local: value, localComplemento: '' })}
          placeholder="Selecione o local"
          options={localOptions}
        />
      </FormField>

      {showLocalComplemento && (
        <FormField label="Especifique o local" required>
          <TextInput
            value={data.localComplemento}
            onChange={(value) => updateField('localComplemento', value)}
            placeholder="Informe o nome do local..."
          />
        </FormField>
      )}

      <FormField label="Setor da ocorrência" required>
        <Select
          value={data.setor}
          onChange={(value) => onChange({ ...data, setor: value, setorComplemento: '' })}
          placeholder="Selecione o setor"
          options={setorOptions}
        />
      </FormField>

      {showSetorComplemento && (
        <FormField label="Especifique o setor" required>
          <TextInput
            value={data.setorComplemento}
            onChange={(value) => updateField('setorComplemento', value)}
            placeholder="Informe o nome do setor..."
          />
        </FormField>
      )}

      {/* Houve paciente envolvido? */}
      <FormField label="Houve paciente envolvido?">
        <div className="flex gap-3">
          {[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...data, houvePackienteEnvolvido: opt.value, numeroAtendimento: '', nomeCompletoPaciente: '', dataNascimentoPaciente: '' })}
              className={`
                flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                ${data.houvePackienteEnvolvido === opt.value
                  ? 'border-primary bg-primary text-white dark:text-primary-foreground'
                  : 'border-[#E5E7EB] dark:border-border bg-white dark:bg-muted text-foreground hover:border-primary/50'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FormField>

      {showPacienteFields && (
        <div className="space-y-4 pl-1 border-l-2 border-primary/20">
          <FormField label="Número do atendimento">
            <TextInput
              value={data.numeroAtendimento}
              onChange={(value) => updateField('numeroAtendimento', value)}
              placeholder="Nº do atendimento/prontuário"
            />
          </FormField>

          <FormField label="Nome completo do paciente">
            <TextInput
              value={data.nomeCompletoPaciente}
              onChange={(value) => updateField('nomeCompletoPaciente', value)}
              placeholder="Nome completo"
            />
          </FormField>

          <FormField label="Data de nascimento">
            <DatePicker
              value={data.dataNascimentoPaciente ? new Date(data.dataNascimentoPaciente + 'T00:00:00') : null}
              onChange={(date) => updateField('dataNascimentoPaciente', date ? date.toISOString().slice(0, 10) : '')}
              placeholder="dd/mm/aaaa"
            />
          </FormField>
        </div>
      )}

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

      <FormField label="Consequências para o paciente, equipe ou processo">
        <TextArea
          value={data.descricaoDano}
          onChange={(value) => updateField('descricaoDano', value)}
          placeholder="Descreva as consequências observadas para o paciente, equipe ou processo assistencial..."
          rows={3}
        />
      </FormField>

      <FormField label="Profissionais envolvidos">
        <TextArea
          value={data.profissionaisEnvolvidos}
          onChange={(value) => updateField('profissionaisEnvolvidos', value)}
          placeholder="Nome, função/categoria profissional e setor de atuação..."
          rows={3}
        />
      </FormField>

      <FormField label="Conduta imediata adotada">
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
      <div className="p-4 rounded-xl bg-muted border border-[#A7F3D0] dark:border-border">
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
      <div className="w-full max-w-md bg-white dark:bg-muted rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#D1FAE5] dark:bg-[#065F46] flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">
            Incidente Registrado
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            Sua notificação foi enviada com sucesso aos responsáveis.
          </p>

          <div className="w-full space-y-4 mb-6">
            <div className="p-4 rounded-xl bg-[#F3F4F6] dark:bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Protocolo</p>
              <p className="text-lg font-mono font-semibold text-foreground">
                {protocolo}
              </p>
            </div>

            {showTrackingCode && (
              <div className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-warning/30">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-[#92400E] dark:text-warning" />
                  <p className="text-xs text-[#92400E] dark:text-warning font-medium">
                    Código de Rastreio (guarde este código!)
                  </p>
                </div>
                <p className="text-lg font-mono font-semibold text-[#92400E] dark:text-warning">
                  {trackingCode}
                </p>
                <p className="text-xs text-[#A16207] dark:text-warning mt-2">
                  Use este código para acompanhar o andamento da sua notificação de forma {tipoIdentificacao === 'anonimo' ? 'anônima' : 'confidencial'}.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl bg-primary text-white dark:text-primary-foreground font-medium hover:bg-[#005530] dark:hover:bg-[#27AE60] transition-colors"
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
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-white dark:text-primary-foreground">{number}</span>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {title}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
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
    dataRegistro: new Date().toISOString().slice(0, 10),
    dataOcorrencia: '',
    turno: '',
    local: '',
    localComplemento: '',
    setor: '',
    setorComplemento: '',
    houvePackienteEnvolvido: '',
    numeroAtendimento: '',
    nomeCompletoPaciente: '',
    dataNascimentoPaciente: '',
    tipo: '',
    subtipo: '',
    severidade: '',
    descricao: '',
  });

  const [impacto, setImpacto] = useState({
    danoAoPaciente: '',
    descricaoDano: '',
    profissionaisEnvolvidos: '',
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
    if (incidente.dataOcorrencia === '') return false;
    if (incidente.turno === '') return false;
    if (incidente.local === '') return false;
    if ((incidente.local === 'clinicas_odontologicas' || incidente.local === 'outros') && incidente.localComplemento.trim() === '') return false;
    if (incidente.setor === '') return false;
    if (incidente.setor === 'outros' && incidente.setorComplemento.trim() === '') return false;
    if (incidente.tipo === '') return false;
    if (incidente.severidade === '') return false;
    if (incidente.descricao.trim() === '') return false;
    return true;
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('incidentes')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Nova Notificação
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">

        {/* Seção 1: Identificação */}
        <div className="bg-white dark:bg-muted rounded-2xl p-5 border border-[#E5E7EB] dark:border-border mb-4">
          <SectionHeader
            number={1}
            icon={User}
            title="Identificação"
            description="Como deseja se identificar"
          />
          <SecaoNotificante data={notificante} onChange={setNotificante} onOpenPrivacy={() => setShowPrivacyPolicy(true)} />
        </div>

        {/* Seção 2: Dados do Incidente */}
        <div className="bg-white dark:bg-muted rounded-2xl p-5 border border-[#E5E7EB] dark:border-border mb-4">
          <SectionHeader
            number={2}
            icon={AlertTriangle}
            title="Dados do Incidente"
            description="O que aconteceu"
          />
          <SecaoIncidente data={incidente} onChange={setIncidente} />
        </div>

        {/* Seção 3: Impacto e Ações */}
        <div className="bg-white dark:bg-muted rounded-2xl p-5 border border-[#E5E7EB] dark:border-border mb-4">
          <SectionHeader
            number={3}
            icon={Activity}
            title="Impacto e Ações"
            description="Danos e medidas tomadas"
          />
          <SecaoImpacto data={impacto} onChange={setImpacto} />
        </div>

        {/* Seção 4: Contexto Anestesiológico */}
        <div className="bg-white dark:bg-muted rounded-2xl p-5 border border-[#E5E7EB] dark:border-border mb-4">
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
          <div className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-warning/30 mb-4">
            <p className="text-sm text-[#92400E] dark:text-warning">
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
                    ? 'bg-primary border-primary'
                    : 'border-[#E5E7EB] dark:border-border'
                  }
                `}
              >
                {consentimento && <Check className="w-3 h-3 text-white dark:text-primary-foreground" />}
              </div>
              <span className="text-xs text-muted-foreground">
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
              ? 'bg-primary text-white dark:text-primary-foreground hover:bg-[#005530] dark:hover:bg-[#27AE60]'
              : 'bg-[#E5E7EB] dark:bg-[#2D4A3E] text-muted-foreground dark:text-muted-foreground cursor-not-allowed'
            }
          `}
        >
          <Send className="w-4 h-4" />
          Enviar Notificação
        </button>

        <p className="text-xs text-center text-muted-foreground mt-3">
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
