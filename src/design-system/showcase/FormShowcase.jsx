// FormShowcase.jsx
// Showcase visual de todos os componentes de formulário do ANEST Design System

import { useState } from 'react';
import { useTheme } from '../hooks/useTheme.jsx';
import { Select } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup } from '../components/ui/radio';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { DatePicker } from '../components/ui/date-picker';
import { FileUpload } from '../components/ui/file-upload';
import { FormField } from '../components/ui/form-field';
import { Input } from '../components/ui/input';

// ============================================================================
// SECTION COMPONENT
// ============================================================================

function Section({ title, description, children }) {
  const { isDark } = useTheme();
  
  return (
    <section
      className="mb-8 md:mb-12"
    >
      <div className="mb-4 md:mb-6">
        <h2
          style={{
            color: isDark ? '#2ECC71' : '#004225',
          }}
          className="text-base md:text-lg font-bold mb-2"
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              fontSize: '14px',
              color: isDark ? '#A3B8B0' : '#6B7280',
            }}
            className="text-sm"
          >
            {description}
          </p>
        )}
      </div>
      
      <div
        className="grid gap-6 md:gap-8"
      >
        {children}
      </div>
    </section>
  );
}

// ============================================================================
// DEMO CARD COMPONENT
// ============================================================================

function DemoCard({ title, children }) {
  const { isDark } = useTheme();
  
  return (
    <div
      className="rounded-xl md:rounded-2xl p-4 md:p-6"
      style={{
        // Light: section containers use cardElevated (#E8F5E9) for card contrast
        background: isDark ? '#1A2420' : '#E8F5E9',
        border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
        overflow: 'visible',
      }}
    >
      {title && (
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: isDark ? '#A3B8B0' : '#6B7280',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// FORM SHOWCASE COMPONENT
// ============================================================================

export function FormShowcase() {
  const { isDark } = useTheme();
  
  // State for interactive demos
  const [selectValue, setSelectValue] = useState('');
  const [selectError, setSelectError] = useState('');
  const [checkboxStates, setCheckboxStates] = useState({
    default: false,
    checked: true,
    withDesc: false,
    error: false,
  });
  const [radioValue, setRadioValue] = useState('option1');
  const [radioHorizontalValue, setRadioHorizontalValue] = useState('sim');
  const [textareaValue, setTextareaValue] = useState('');
  const [textareaWithCount, setTextareaWithCount] = useState('Este é um texto de exemplo para demonstrar o contador de caracteres.');
  const [switchStates, setSwitchStates] = useState({
    default: false,
    on: true,
    withLabel: false,
  });
  const [dateValue, setDateValue] = useState(null);
  const [dateError, setDateError] = useState('');
  const [files, setFiles] = useState(null);
  const [filesMultiple, setFilesMultiple] = useState(null);
  
  // Form field demo state
  const [formDemo, setFormDemo] = useState({
    nome: '',
    email: '',
    cargo: '',
    notificacoes: true,
    termos: false,
  });
  const [formErrors, setFormErrors] = useState({});
  
  // Select options
  const selectOptions = [
    { value: 'sp', label: 'São Paulo' },
    { value: 'rj', label: 'Rio de Janeiro' },
    { value: 'mg', label: 'Minas Gerais' },
    { value: 'rs', label: 'Rio Grande do Sul', disabled: true },
    { value: 'ba', label: 'Bahia' },
  ];
  
  const cargoOptions = [
    { value: 'anestesiologista', label: 'Anestesiologista' },
    { value: 'medico-residente', label: 'Médico Residente' },
    { value: 'enfermeiro', label: 'Enfermeiro' },
    { value: 'tec-enfermagem', label: 'Téc. Enfermagem' },
  ];
  
  // Radio options
  const radioOptions = [
    { value: 'option1', label: 'Opção 1', description: 'Descrição da primeira opção' },
    { value: 'option2', label: 'Opção 2', description: 'Descrição da segunda opção' },
    { value: 'option3', label: 'Opção 3', disabled: true },
  ];
  
  const radioHorizontalOptions = [
    { value: 'sim', label: 'Sim' },
    { value: 'nao', label: 'Não' },
    { value: 'talvez', label: 'Talvez' },
  ];
  
  // Handle form validation demo
  const handleValidateForm = () => {
    const errors = {};
    if (!formDemo.nome.trim()) errors.nome = 'Nome é obrigatório';
    if (!formDemo.email.trim()) errors.email = 'Email é obrigatório';
    if (!formDemo.cargo) errors.cargo = 'Selecione um cargo';
    if (!formDemo.termos) errors.termos = 'Você precisa aceitar os termos';
    setFormErrors(errors);
  };
  
  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: isDark ? '#111916' : '#F0FFF4',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div className="mb-8 md:mb-12">
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: isDark ? '#FFFFFF' : '#000000',
            marginBottom: '8px',
          }}
        >
          📋 Componentes de Formulário
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: isDark ? '#A3B8B0' : '#6B7280',
          }}
        >
          Componentes do ANEST Design System para criação de formulários acessíveis e consistentes.
        </p>
      </div>
      
      {/* ================================================================== */}
      {/* SELECT */}
      {/* ================================================================== */}
      <Section
        title="Select (Dropdown)"
        description="Componente de seleção com dropdown animado, suporte a teclado e estados visuais."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Default">
            <Select
              options={selectOptions}
              value={selectValue}
              onChange={setSelectValue}
              label="Estado"
              placeholder="Selecione um estado"
            />
          </DemoCard>
          
          <DemoCard title="Com Erro">
            <Select
              options={selectOptions}
              value={selectError}
              onChange={setSelectError}
              label="Estado"
              placeholder="Selecione um estado"
              error="Este campo é obrigatório"
            />
          </DemoCard>
          
          <DemoCard title="Disabled">
            <Select
              options={selectOptions}
              value="sp"
              onChange={() => {}}
              label="Estado"
              disabled
            />
          </DemoCard>
          
          <DemoCard title="Tamanhos">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Select options={selectOptions} value="" onChange={() => {}} placeholder="Small" size="sm" />
              <Select options={selectOptions} value="" onChange={() => {}} placeholder="Medium (default)" size="md" />
              <Select options={selectOptions} value="" onChange={() => {}} placeholder="Large" size="lg" />
            </div>
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* CHECKBOX */}
      {/* ================================================================== */}
      <Section
        title="Checkbox"
        description="Checkbox customizado com animação de check, suporte a label e descrição."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Estados">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Checkbox
                checked={checkboxStates.default}
                onChange={(checked) => setCheckboxStates(s => ({ ...s, default: checked }))}
                label="Checkbox desmarcado"
              />
              <Checkbox
                checked={checkboxStates.checked}
                onChange={(checked) => setCheckboxStates(s => ({ ...s, checked: checked }))}
                label="Checkbox marcado"
              />
              <Checkbox
                checked={checkboxStates.withDesc}
                onChange={(checked) => setCheckboxStates(s => ({ ...s, withDesc: checked }))}
                label="Com descrição"
                description="Esta é uma descrição adicional para o checkbox"
              />
              <Checkbox
                checked={checkboxStates.error}
                onChange={(checked) => setCheckboxStates(s => ({ ...s, error: checked }))}
                label="Com erro"
                error="Este campo é obrigatório"
              />
              <Checkbox
                checked={true}
                onChange={() => {}}
                label="Disabled"
                disabled
              />
            </div>
          </DemoCard>
          
          <DemoCard title="Tamanhos">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Checkbox checked={true} onChange={() => {}} label="Small" size="sm" />
              <Checkbox checked={true} onChange={() => {}} label="Medium (default)" size="md" />
              <Checkbox checked={true} onChange={() => {}} label="Large" size="lg" />
            </div>
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* RADIO GROUP */}
      {/* ================================================================== */}
      <Section
        title="Radio Group"
        description="Grupo de radio buttons com suporte a orientação vertical/horizontal."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Vertical (default)">
            <RadioGroup
              options={radioOptions}
              value={radioValue}
              onChange={setRadioValue}
              label="Escolha uma opção"
              name="radio-vertical"
            />
          </DemoCard>
          
          <DemoCard title="Horizontal">
            <RadioGroup
              options={radioHorizontalOptions}
              value={radioHorizontalValue}
              onChange={setRadioHorizontalValue}
              label="Confirma participação?"
              name="radio-horizontal"
              orientation="horizontal"
            />
          </DemoCard>
          
          <DemoCard title="Com Erro">
            <RadioGroup
              options={radioHorizontalOptions}
              value=""
              onChange={() => {}}
              label="Selecione uma opção"
              name="radio-error"
              error="Seleção obrigatória"
            />
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* TEXTAREA */}
      {/* ================================================================== */}
      <Section
        title="Textarea"
        description="Campo de texto multilinha com contador de caracteres opcional."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Default">
            <Textarea
              value={textareaValue}
              onChange={setTextareaValue}
              label="Observações"
              placeholder="Digite suas observações aqui..."
              rows={4}
            />
          </DemoCard>
          
          <DemoCard title="Com Contador">
            <Textarea
              value={textareaWithCount}
              onChange={setTextareaWithCount}
              label="Descrição"
              placeholder="Digite uma descrição..."
              maxLength={200}
              showCount
              rows={4}
            />
          </DemoCard>
          
          <DemoCard title="Com Erro">
            <Textarea
              value=""
              onChange={() => {}}
              label="Justificativa"
              placeholder="Digite a justificativa..."
              error="Este campo é obrigatório"
              rows={3}
            />
          </DemoCard>
          
          <DemoCard title="Resize Options">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Textarea value="" onChange={() => {}} placeholder="resize: none" resize="none" rows={2} />
              <Textarea value="" onChange={() => {}} placeholder="resize: vertical (default)" resize="vertical" rows={2} />
              <Textarea value="" onChange={() => {}} placeholder="resize: both" resize="both" rows={2} />
            </div>
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* SWITCH */}
      {/* ================================================================== */}
      <Section
        title="Switch (Toggle)"
        description="Toggle switch com animação suave para opções on/off."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Estados">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Switch
                checked={switchStates.default}
                onChange={(checked) => setSwitchStates(s => ({ ...s, default: checked }))}
                label="Switch desligado"
              />
              <Switch
                checked={switchStates.on}
                onChange={(checked) => setSwitchStates(s => ({ ...s, on: checked }))}
                label="Switch ligado"
              />
              <Switch
                checked={switchStates.withLabel}
                onChange={(checked) => setSwitchStates(s => ({ ...s, withLabel: checked }))}
                label="Notificações por email"
                description="Receber alertas e atualizações"
              />
              <Switch
                checked={true}
                onChange={() => {}}
                label="Disabled"
                disabled
              />
            </div>
          </DemoCard>
          
          <DemoCard title="Tamanhos">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Switch checked={true} onChange={() => {}} label="Small" size="sm" />
              <Switch checked={true} onChange={() => {}} label="Medium (default)" size="md" />
              <Switch checked={true} onChange={() => {}} label="Large" size="lg" />
            </div>
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* DATE PICKER */}
      {/* ================================================================== */}
      <Section
        title="DatePicker"
        description="Seletor de data simplificado usando input nativo estilizado."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Default">
            <DatePicker
              value={dateValue}
              onChange={setDateValue}
              label="Data do procedimento"
            />
          </DemoCard>
          
          <DemoCard title="Com Limites">
            <DatePicker
              value={null}
              onChange={() => {}}
              label="Data (próximos 30 dias)"
              minDate={new Date()}
              maxDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
            />
          </DemoCard>
          
          <DemoCard title="Com Erro">
            <DatePicker
              value={null}
              onChange={setDateError}
              label="Data obrigatória"
              error="Selecione uma data válida"
            />
          </DemoCard>
          
          <DemoCard title="Disabled">
            <DatePicker
              value={new Date()}
              onChange={() => {}}
              label="Data"
              disabled
            />
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* FILE UPLOAD */}
      {/* ================================================================== */}
      <Section
        title="FileUpload"
        description="Upload de arquivos com dropzone ou botão, validação de tamanho e preview."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <DemoCard title="Dropzone (default)">
            <FileUpload
              value={files}
              onChange={setFiles}
              label="Anexar documento"
              description="PDF, DOC até 10MB"
              accept=".pdf,.doc,.docx"
              maxSize={10 * 1024 * 1024}
            />
          </DemoCard>
          
          <DemoCard title="Multiple Files">
            <FileUpload
              value={filesMultiple}
              onChange={setFilesMultiple}
              label="Anexar imagens"
              description="PNG, JPG até 5MB cada"
              accept="image/*"
              maxSize={5 * 1024 * 1024}
              multiple
            />
          </DemoCard>
          
          <DemoCard title="Button Variant">
            <FileUpload
              value={null}
              onChange={() => {}}
              label="Selecionar arquivo"
              description="Qualquer formato até 20MB"
              variant="button"
              maxSize={20 * 1024 * 1024}
            />
          </DemoCard>
          
          <DemoCard title="Com Erro">
            <FileUpload
              value={null}
              onChange={() => {}}
              label="Documento obrigatório"
              error="Por favor, anexe um documento"
            />
          </DemoCard>
        </div>
      </Section>
      
      {/* ================================================================== */}
      {/* FORM FIELD WRAPPER */}
      {/* ================================================================== */}
      <Section
        title="FormField Wrapper"
        description="Componente wrapper para padronizar labels, hints e mensagens de erro."
      >
        <DemoCard title="Exemplo de Formulário Completo">
          <div style={{ display: 'grid', gap: '24px', maxWidth: '500px' }}>
            <FormField
              label="Nome completo"
              required
              error={formErrors.nome}
              hint="Digite seu nome como no documento"
            >
              <Input
                value={formDemo.nome}
                onChange={(e) => setFormDemo(s => ({ ...s, nome: e.target.value }))}
                placeholder="Ex: João da Silva"
              />
            </FormField>
            
            <FormField
              label="Email"
              required
              error={formErrors.email}
            >
              <Input
                type="email"
                value={formDemo.email}
                onChange={(e) => setFormDemo(s => ({ ...s, email: e.target.value }))}
                placeholder="seu@email.com"
              />
            </FormField>
            
            <FormField
              label="Cargo"
              required
              error={formErrors.cargo}
            >
              <Select
                options={cargoOptions}
                value={formDemo.cargo}
                onChange={(value) => setFormDemo(s => ({ ...s, cargo: value }))}
                placeholder="Selecione seu cargo"
              />
            </FormField>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Switch
                checked={formDemo.notificacoes}
                onChange={(checked) => setFormDemo(s => ({ ...s, notificacoes: checked }))}
                label="Receber notificações"
                description="Alertas sobre plantões e atualizações"
              />
              
              <Checkbox
                checked={formDemo.termos}
                onChange={(checked) => setFormDemo(s => ({ ...s, termos: checked }))}
                label="Aceito os termos e condições"
                error={formErrors.termos}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleValidateForm}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isDark ? '#2ECC71' : '#004225',
                  color: isDark ? '#0A0F0D' : '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Validar Formulário
              </button>
              
              <button
                type="button"
                onClick={() => setFormErrors({})}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: `1px solid ${isDark ? '#2A3F36' : '#A5D6A7'}`,
                  background: 'transparent',
                  color: isDark ? '#A3B8B0' : '#6B7280',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Limpar Erros
              </button>
            </div>
          </div>
        </DemoCard>
      </Section>
      
      {/* ================================================================== */}
      {/* ACCESSIBILITY INFO */}
      {/* ================================================================== */}
      <Section
        title="♿ Acessibilidade"
        description="Todos os componentes seguem as melhores práticas de acessibilidade."
      >
        <DemoCard>
          <div style={{ display: 'grid', gap: '16px', color: isDark ? '#A3B8B0' : '#6B7280', fontSize: '14px' }}>
            <div>
              <strong style={{ color: isDark ? '#FFFFFF' : '#000000' }}>✓ Labels associados:</strong>
              {' '}Todos os inputs possuem labels corretamente associados via htmlFor/id.
            </div>
            <div>
              <strong style={{ color: isDark ? '#FFFFFF' : '#000000' }}>✓ ARIA attributes:</strong>
              {' '}aria-invalid, aria-describedby, aria-expanded, aria-controls implementados.
            </div>
            <div>
              <strong style={{ color: isDark ? '#FFFFFF' : '#000000' }}>✓ Navegação por teclado:</strong>
              {' '}Tab, Enter, Space, Arrow keys funcionam em todos os componentes.
            </div>
            <div>
              <strong style={{ color: isDark ? '#FFFFFF' : '#000000' }}>✓ Focus visible:</strong>
              {' '}Ring de foco visível para navegação por teclado.
            </div>
            <div>
              <strong style={{ color: isDark ? '#FFFFFF' : '#000000' }}>✓ Screen readers:</strong>
              {' '}Textos de erro e descrições anunciados corretamente.
            </div>
          </div>
        </DemoCard>
      </Section>
    </div>
  );
}

export default FormShowcase;

