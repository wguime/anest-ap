import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileUpload } from '@/design-system';
import {
  ShieldAlert,
  Send,
  Eye,
  EyeOff,
  Upload,
  X,
  Check,
  Info,
  Lock,
  FileText,
  User,
  Shield,
  ChevronLeft
} from 'lucide-react';
import {
  DENUNCIA_TYPES,
  IDENTIFICATION_TYPES,
  generateDenunciaProtocol,
  generateTrackingCode,
  createGestaoInternaTemplate
} from '@/data/incidentesConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { useMessages } from '@/contexts/MessagesContext';
import { useUser } from '@/contexts/UserContext';
import { PrivacyPolicyModal } from '@/components/PrivacyPolicyModal';

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

// Select
function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#2D4A3E] bg-white dark:bg-[#1A2F23] text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#006837] dark:focus:ring-[#2ECC71] focus:border-transparent transition-all appearance-none cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Toggle switch
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <div
        className={`
          relative w-11 h-6 rounded-full transition-colors
          ${checked ? 'bg-[#006837] dark:bg-[#2ECC71]' : 'bg-[#E5E7EB] dark:bg-[#2D4A3E]'}
        `}
      >
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>
      <span className="text-sm font-medium text-[#111827] dark:text-white">{label}</span>
    </button>
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

// Modal de sucesso
function SuccessModal({ protocolo, trackingCode, tipoIdentificacao, onClose }) {
  const showTrackingCode = (tipoIdentificacao === 'anonimo' || tipoIdentificacao === 'confidencial') && trackingCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-[#1A2F23] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#D1FAE5] dark:bg-[#065F46] flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-[#059669]" />
          </div>

          <h2 className="text-xl font-bold text-[#111827] dark:text-white mb-2">
            Denúncia Registrada
          </h2>

          <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-6">
            Sua denúncia foi recebida e será analisada pelo comitê responsável.
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
                  Use este código para acompanhar o andamento da sua denúncia de forma {tipoIdentificacao === 'anonimo' ? 'anônima' : 'confidencial'}.
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

export default function NovaDenunciaPage({ onNavigate }) {
  const { addDenuncia } = useIncidents();
  const { createSystemNotification } = useMessages();
  const { user } = useUser();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Estado do formulário
  const [denunciante, setDenunciante] = useState({
    tipoIdentificacao: 'anonimo', // 'identificado', 'confidencial', 'anonimo'
    nome: '',
    email: '',
    genero: '', // Novo campo: gênero (opcional)
  });

  const [denuncia, setDenuncia] = useState({
    tipo: '',
    titulo: '',
    descricao: '',
    pessoasEnvolvidas: '',
    testemunhas: '',
    dataOcorrencia: '',
    impacto: '',
    // Novos campos sobre o denunciado
    denunciadoCargo: '', // Cargo/função do denunciado
    denunciadoSetor: '', // Setor/departamento do denunciado
    denunciadoLocal: '', // Local de trabalho do denunciado
  });

  const [attachments, setAttachments] = useState([]);

  // LGPD: consentimento explícito para tratamento de dados pessoais
  const [consentimento, setConsentimento] = useState(false);

  const updateDenunciante = (field, value) => {
    setDenunciante((prev) => ({ ...prev, [field]: value }));
  };

  const updateDenuncia = (field, value) => {
    setDenuncia((prev) => ({ ...prev, [field]: value }));
  };

  // DENUNCIA_TYPES é um array de objetos {value, label, icon, color}
  const tipoOptions = DENUNCIA_TYPES.map((tipo) => ({
    value: tipo.value,
    label: tipo.label,
  }));

  const generoOptions = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'feminino', label: 'Feminino' },
    { value: 'nao_binario', label: 'Não-binário' },
    { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
  ];

  // LGPD: consentimento é obrigatório para não-anônimos
  const isConsentimentoValid = () => {
    if (denunciante.tipoIdentificacao === 'anonimo') return true;
    return consentimento;
  };

  const isFormValid = () => {
    return (
      denuncia.tipo !== '' &&
      denuncia.titulo.trim() !== '' &&
      denuncia.descricao.trim() !== '' &&
      isConsentimentoValid()
    );
  };

  const handleSubmit = () => {
    if (!isFormValid()) return;

    const protocolo = generateDenunciaProtocol();
    const needsTrackingCode = denunciante.tipoIdentificacao === 'anonimo' || denunciante.tipoIdentificacao === 'confidencial';
    const trackingCode = needsTrackingCode ? generateTrackingCode() : null;

    // Dados do denunciante baseado no tipo de identificação
    const denuncianteData = {
      tipoIdentificacao: denunciante.tipoIdentificacao,
    };

    // LGPD: Adiciona dados pessoais apenas se não for anônimo (inclui gênero)
    if (denunciante.tipoIdentificacao !== 'anonimo') {
      denuncianteData.nome = denunciante.nome;
      denuncianteData.email = denunciante.email;
      denuncianteData.genero = denunciante.genero;
    }

    const data = {
      id: `den-${Date.now()}`,
      protocolo,
      trackingCode,
      status: 'pending',
      denunciante: denuncianteData,
      denuncia,
      attachments,
      source: 'interno',
      createdAt: new Date().toISOString(),
      // Campos de gestão interna (invisíveis ao usuário)
      gestaoInterna: createGestaoInternaTemplate(),
      // LGPD: Não vincular userId a relatos anônimos para garantir anonimato real
      userId: denunciante.tipoIdentificacao === 'anonimo' ? null : (user?.id || null),
    };

    // Adicionar ao contexto global
    addDenuncia(data);

    // Gerar notificação in-app para responsáveis
    createSystemNotification({
      category: 'incidente',
      subject: `Nova denúncia: ${denuncia.titulo}`,
      content: `Protocolo ${protocolo} - ${denuncia.tipo}`,
      senderName: 'Canal de Denúncias',
      priority: 'alta',
      actionUrl: 'incidentes',
      actionLabel: 'Ver Denúncias',
    });
    // TODO: integrar com serviço de email para notificar responsáveis

    setSubmittedData({
      protocolo,
      trackingCode,
      tipoIdentificacao: denunciante.tipoIdentificacao
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
            Nova Denúncia
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
        {/* Banner de Segurança e LGPD */}
        <div className="mb-5 space-y-3">
          <div className="p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] border border-[#C8E6C9] dark:border-[#2A3F36]">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#004225] dark:text-white">
                  Canal Seguro e Confidencial
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-1">
                  Sua identidade será protegida. Você receberá um código de rastreio para acompanhar o andamento da denúncia.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] border border-[#C8E6C9] dark:border-[#2A3F36]">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#004225] dark:text-white">
                  Proteção de Dados (LGPD)
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-1">
                  Seus dados são protegidos conforme a Lei Geral de Proteção de Dados. Você tem direito a acesso, correção e exclusão de suas informações.{' '}
                  <button type="button" onClick={() => setShowPrivacyPolicy(true)} className="underline font-medium hover:opacity-80">Política de Privacidade</button>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-5 border border-[#E5E7EB] dark:border-[#2D4A3E] space-y-5">

          {/* Seção: Identificação */}
          <div>
            <h3 className="text-sm font-semibold text-[#111827] dark:text-white mb-4 flex items-center gap-2">
              <EyeOff className="w-4 h-4" />
              Identificação
            </h3>

            <div className="space-y-4">
              {/* Seletor de tipo de identificação */}
              <IdentificationTypeSelector
                selected={denunciante.tipoIdentificacao}
                onSelect={(value) => updateDenunciante('tipoIdentificacao', value)}
              />

              {/* Aviso sobre código de rastreio */}
              {(denunciante.tipoIdentificacao === 'anonimo' || denunciante.tipoIdentificacao === 'confidencial') && (
                <div className="p-3 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F59E0B]/30">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#A16207] dark:text-[#FBBF24]">
                      Você receberá um código de rastreio para acompanhar o andamento da sua denúncia de forma segura.
                    </p>
                  </div>
                </div>
              )}

              {/* Campos pessoais (apenas para identificado e confidencial) */}
              {denunciante.tipoIdentificacao !== 'anonimo' && (
                <>
                  <FormField label="Nome (opcional)">
                    <TextInput
                      value={denunciante.nome}
                      onChange={(value) => updateDenunciante('nome', value)}
                      placeholder="Seu nome"
                    />
                  </FormField>

                  <FormField label="Email (opcional)" hint="Para receber atualizações">
                    <TextInput
                      type="email"
                      value={denunciante.email}
                      onChange={(value) => updateDenunciante('email', value)}
                      placeholder="seu.email@exemplo.com"
                    />
                  </FormField>

                  <FormField label="Gênero (opcional)">
                    <Select
                      value={denunciante.genero}
                      onChange={(value) => updateDenunciante('genero', value)}
                      placeholder="Selecione"
                      options={generoOptions}
                    />
                  </FormField>
                </>
              )}
            </div>
          </div>

          <hr className="border-[#E5E7EB] dark:border-[#2D4A3E]" />

          {/* Seção: Denúncia */}
          <div>
            <h3 className="text-sm font-semibold text-[#111827] dark:text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Detalhes da Denúncia
            </h3>

            <div className="space-y-4">
              <FormField label="Tipo de denúncia" required>
                <Select
                  value={denuncia.tipo}
                  onChange={(value) => updateDenuncia('tipo', value)}
                  placeholder="Selecione o tipo"
                  options={tipoOptions}
                />
              </FormField>

              {denuncia.tipo && (() => {
                const tipoConfig = DENUNCIA_TYPES.find(t => t.value === denuncia.tipo);
                return tipoConfig ? (
                  <div
                    className="p-3 rounded-xl border"
                    style={{
                      backgroundColor: `${tipoConfig.color}15`,
                      borderColor: `${tipoConfig.color}40`,
                    }}
                  >
                    <p className="text-sm" style={{ color: tipoConfig.color }}>
                      {tipoConfig.label}
                    </p>
                  </div>
                ) : null;
              })()}

              <FormField label="Título" required>
                <TextInput
                  value={denuncia.titulo}
                  onChange={(value) => updateDenuncia('titulo', value)}
                  placeholder="Resumo breve da denúncia"
                />
              </FormField>

              <FormField label="Descrição detalhada" required>
                <TextArea
                  value={denuncia.descricao}
                  onChange={(value) => updateDenuncia('descricao', value)}
                  placeholder="Descreva o ocorrido com o máximo de detalhes possível. Inclua datas, horários, locais e circunstâncias."
                  rows={6}
                />
              </FormField>

              <FormField label="Data aproximada do ocorrido">
                <TextInput
                  type="date"
                  value={denuncia.dataOcorrencia}
                  onChange={(value) => updateDenuncia('dataOcorrencia', value)}
                />
              </FormField>

              <FormField label="Pessoas envolvidas" hint="Não é obrigatório identificar">
                <TextArea
                  value={denuncia.pessoasEnvolvidas}
                  onChange={(value) => updateDenuncia('pessoasEnvolvidas', value)}
                  placeholder="Nomes, cargos ou funções das pessoas envolvidas (se souber)"
                  rows={2}
                />
              </FormField>

              {/* Campos detalhados do denunciado */}
              <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1F17] space-y-4">
                <p className="text-xs font-medium text-[#6B7280] dark:text-[#6B8178]">
                  Informações sobre o denunciado (opcional)
                </p>

                <FormField label="Cargo/Função do denunciado">
                  <TextInput
                    value={denuncia.denunciadoCargo}
                    onChange={(value) => updateDenuncia('denunciadoCargo', value)}
                    placeholder="Ex: Anestesiologista, Médico Residente, Enfermeiro, Téc. Enfermagem, Coordenador..."
                  />
                </FormField>

                <FormField label="Setor/Departamento do denunciado">
                  <TextInput
                    value={denuncia.denunciadoSetor}
                    onChange={(value) => updateDenuncia('denunciadoSetor', value)}
                    placeholder="Ex: Centro Cirúrgico, UTI, Enfermaria..."
                  />
                </FormField>

                <FormField label="Local de trabalho do denunciado">
                  <TextInput
                    value={denuncia.denunciadoLocal}
                    onChange={(value) => updateDenuncia('denunciadoLocal', value)}
                    placeholder="Ex: Hospital X, Clínica Y, Unidade Z..."
                  />
                </FormField>
              </div>

              <FormField label="Testemunhas" hint="Se houver">
                <TextArea
                  value={denuncia.testemunhas}
                  onChange={(value) => updateDenuncia('testemunhas', value)}
                  placeholder="Pessoas que presenciaram o ocorrido"
                  rows={2}
                />
              </FormField>

              <FormField label="Impacto observado">
                <TextArea
                  value={denuncia.impacto}
                  onChange={(value) => updateDenuncia('impacto', value)}
                  placeholder="Quais foram as consequências ou potenciais riscos?"
                  rows={2}
                />
              </FormField>
            </div>
          </div>

          <hr className="border-[#E5E7EB] dark:border-[#2D4A3E]" />

          {/* Seção: Anexos */}
          <div>
            <h3 className="text-sm font-semibold text-[#111827] dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Anexos (opcional)
            </h3>

            <div className="p-4 rounded-xl border-2 border-dashed border-[#E5E7EB] dark:border-[#2D4A3E] bg-[#F9FAFB] dark:bg-[#0D1F17]">
              <div className="flex flex-col items-center text-center">
                <Upload className="w-8 h-8 text-[#9CA3AF] dark:text-[#4B5E55] mb-2" />
                <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-1">
                  Arraste arquivos ou clique para fazer upload
                </p>
                <p className="text-xs text-[#9CA3AF] dark:text-[#4B5E55]">
                  Documentos, imagens ou outros arquivos de evidência
                </p>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
                  }}
                />
                <label
                  htmlFor="file-upload"
                  className="mt-3 px-4 py-2 rounded-lg bg-white dark:bg-[#1A2F23] border border-[#E5E7EB] dark:border-[#2D4A3E] text-sm font-medium text-[#111827] dark:text-white cursor-pointer hover:bg-[#F3F4F6] dark:hover:bg-[#243530] transition-colors"
                >
                  Selecionar arquivos
                </label>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#F3F4F6] dark:bg-[#243530]"
                  >
                    <span className="text-sm text-[#111827] dark:text-white truncate">
                      {file}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                      className="p-1 rounded hover:bg-[#E5E7EB] dark:hover:bg-[#2D4A3E]"
                    >
                      <X className="w-4 h-4 text-[#6B7280] dark:text-[#6B8178]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LGPD: Checkbox de consentimento (apenas para não-anônimos) */}
        {denunciante.tipoIdentificacao !== 'anonimo' && (
          <div className="mt-4">
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
        <div className="mt-4">
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
            Enviar Denúncia
          </button>

          <p className="text-xs text-center text-[#6B7280] dark:text-[#6B8178] mt-3">
            Ao enviar, você declara que as informações são verdadeiras.
          </p>
        </div>
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
