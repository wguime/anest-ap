/**
 * NewDocumentModal Component
 *
 * Modal for creating new documents in the Centro de Gestao.
 * Generic modal that works for all document categories.
 *
 * @module management/components/NewDocumentModal
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Modal,
  Button,
  Input,
  Textarea,
  FormField,
  Select,
  FileUpload,
  useToast,
} from '@/design-system'
import { FilePlus, Loader2, Send } from 'lucide-react'
import { CATEGORY_LABELS, DOCUMENT_STATUS, CLASSIFICACAO_ACESSO_OPTIONS } from '@/types/documents'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { useAuth } from '@/hooks/useAuth'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import supabaseDocumentService from '@/services/supabaseDocumentService'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Section options by category - determines which accordion group a new document belongs to
 */
const SECTION_OPTIONS = {
  etica: [
    { value: 'codigoEtica', label: 'Codigo de Etica' },
    { value: 'diretrizes', label: 'Diretrizes Institucionais' },
    { value: 'emissaoParecer', label: 'Emissao de Parecer Tecnico-Etico' },
    { value: 'dilemas', label: 'Gestao de Dilemas Bioeticos' },
    { value: 'parecerUti', label: 'Parecer Etico - UTI' },
    { value: '__custom__', label: 'Outro / Adicionar nova secao' },
  ],
  biblioteca: [
    { value: 'regimento_interno', label: 'Regimento interno' },
    { value: 'politicas', label: 'Políticas' },
    { value: 'contratos_legais', label: 'Contratos e Documentos Legais' },
    { value: 'protocolos', label: 'Protocolos' },
    { value: 'manuais', label: 'Manuais' },
    { value: 'formularios', label: 'Formulários' },
    { value: 'relatorios', label: 'Relatórios' },
    { value: 'fluxogramas', label: 'Fluxogramas' },
    { value: 'mapas_processos', label: 'Mapas de Processos' },
    { value: 'mapas_riscos', label: 'Mapas de Riscos' },
    { value: 'tabelas', label: 'Tabelas' },
    { value: '__custom__', label: 'Outros (adicionar nova seção)' },
  ],
  comites: [
    { value: 'regimento_interno', label: 'Regimento Interno' },
    { value: 'executivo', label: 'Executivo de Gestao' },
    { value: 'financeiro', label: 'Comite Financeiro' },
    { value: 'gestao_pessoas', label: 'Gestao de Pessoas' },
    { value: 'escalas', label: 'Comite de Escalas' },
    { value: 'tecnologia', label: 'Tecnologia e Materiais' },
    { value: 'qualidade', label: 'Comite de Qualidade' },
    { value: 'educacao', label: 'Educacao e Residencia' },
    { value: 'etica_conduta', label: 'Etica e Conduta' },
    { value: 'desastres', label: 'Emergencias e Desastres' },
    { value: 'organograma', label: 'Organograma Institucional' },
    { value: '__custom__', label: 'Outro / Adicionar nova secao' },
  ],
  auditorias: [
    { value: 'higiene_maos', label: 'Higiene das Maos' },
    { value: 'uso_medicamentos', label: 'Uso de Medicamentos' },
    { value: 'abreviaturas', label: 'Abreviaturas Perigosas' },
    { value: 'politica_qualidade', label: 'Politica de Gestao da Qualidade' },
    { value: 'politica_disclosure', label: 'Politica de Disclosure' },
    { value: 'relatorio_rops', label: 'Relatorio de Auditorias ROPs' },
    { value: 'operacional', label: 'Auditorias Operacionais' },
    { value: 'conformidade', label: 'Conformidade e Politicas' },
    { value: 'procedimento', label: 'Procedimentos Clinicos' },
    { value: 'seguranca_paciente', label: 'Seguranca do Paciente' },
    { value: 'controle_infeccao', label: 'Controle de Infeccao' },
    { value: 'equipamentos', label: 'Equipamentos Medicos' },
    { value: '__custom__', label: 'Outro / Adicionar nova secao' },
  ],
  relatorios: [
    { value: 'trimestral', label: 'Relatorio Trimestral' },
    { value: 'incidentes', label: 'Consolidado de Incidentes' },
    { value: 'indicadores', label: 'Indicadores de Qualidade' },
    { value: '__custom__', label: 'Outro / Adicionar nova secao' },
  ],
}

/**
 * Document type options by category
 */
const DOCUMENT_TYPES = {
  etica: [
    { value: 'codigo', label: 'Codigo de Etica' },
    { value: 'parecer', label: 'Parecer' },
    { value: 'resolucao', label: 'Resolucao' },
    { value: 'norma', label: 'Norma' },
    { value: 'outro', label: 'Outro' },
    { value: '__custom__', label: 'Adicionar novo tipo' },
  ],
  comites: [
    { value: 'ata', label: 'Ata de Reuniao' },
    { value: 'regimento', label: 'Regimento' },
    { value: 'relatorio', label: 'Relatorio' },
    { value: 'parecer', label: 'Parecer' },
    { value: 'outro', label: 'Outro' },
    { value: '__custom__', label: 'Adicionar novo tipo' },
  ],
  auditorias: [
    { value: 'relatorio', label: 'Relatorio de Auditoria' },
    { value: 'checklist', label: 'Checklist' },
    { value: 'plano', label: 'Plano de Acao' },
    { value: 'conformidade', label: 'Conformidade' },
    { value: 'outro', label: 'Outro' },
    { value: '__custom__', label: 'Adicionar novo tipo' },
  ],
  relatorios: [
    { value: 'mensal', label: 'Relatorio Mensal' },
    { value: 'trimestral', label: 'Relatorio Trimestral' },
    { value: 'anual', label: 'Relatorio Anual' },
    { value: 'incidente', label: 'Relatorio de Incidente' },
    { value: 'outro', label: 'Outro' },
    { value: '__custom__', label: 'Adicionar novo tipo' },
  ],
  biblioteca: [
    { value: 'protocolo', label: 'Protocolo' },
    { value: 'politica', label: 'Política' },
    { value: 'formulario', label: 'Formulário' },
    { value: 'manual', label: 'Manual' },
    { value: 'relatorio', label: 'Relatório' },
    { value: 'processo', label: 'Processo' },
    { value: 'termo', label: 'Termo' },
    { value: 'risco', label: 'Risco' },
    { value: 'plano', label: 'Plano' },
    { value: 'etica', label: 'Ética e Bioética' },
    { value: '__custom__', label: 'Adicionar novo tipo' },
  ],
  financeiro: [
    { value: 'orcamento', label: 'Orcamento' },
    { value: 'prestacao', label: 'Prestacao de Contas' },
    { value: 'relatorio', label: 'Relatorio Financeiro' },
    { value: 'contrato', label: 'Contrato' },
    { value: 'outro', label: 'Outro' },
    { value: '__custom__', label: 'Adicionar novo tipo' },
  ],
}

/**
 * Default document types (fallback)
 */
const DEFAULT_TYPES = [
  { value: 'documento', label: 'Documento' },
  { value: 'relatorio', label: 'Relatorio' },
  { value: 'formulario', label: 'Formulario' },
  { value: 'outro', label: 'Outro' },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * NewDocumentModal Component
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {string} props.category - Document category (etica, comites, etc.)
 */
function NewDocumentModal({ open, onClose, category }) {
  // Context and toast
  const { addDocument } = useDocumentsContext()
  const { toast } = useToast()
  const { user } = useAuth()
  const { users: allUsers } = useUsersManagement()

  const userOptions = useMemo(() =>
    (allUsers || [])
      .filter(u => u.active)
      .map(u => ({ value: u.nome, label: u.nome }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [allUsers]
  )

  // Form state — existing fields
  const [titulo, setTitulo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [secao, setSecao] = useState('')
  const [tipo, setTipo] = useState('')
  const [tags, setTags] = useState('')
  const [responsavelRevisao, setResponsavelRevisao] = useState('')
  const [proximaRevisao, setProximaRevisao] = useState('')
  const [enviarParaAprovacao, setEnviarParaAprovacao] = useState(false)
  const [arquivo, setArquivo] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state — new metadata fields
  const [origem, setOrigem] = useState('')
  const [dataPublicacao, setDataPublicacao] = useState('')
  const [dataVersao, setDataVersao] = useState('')
  const [classificacaoAcesso, setClassificacaoAcesso] = useState('interno')
  const [departamento, setDepartamento] = useState('')
  const [localArmazenamento, setLocalArmazenamento] = useState('Supabase Cloud Storage')
  const [responsavelElaboracao, setResponsavelElaboracao] = useState('')
  const [responsavelAprovacao, setResponsavelAprovacao] = useState('')
  const [customSecao, setCustomSecao] = useState('')
  const [customTipo, setCustomTipo] = useState('')
  const [versao, setVersao] = useState('1')

  // Get category label
  const categoryLabel = CATEGORY_LABELS[category] || category || 'Documento'

  // Get section options for this category (etica, comites, auditorias, relatorios)
  const sectionOptions = SECTION_OPTIONS[category] || null

  // Get document types for this category
  const documentTypes = DOCUMENT_TYPES[category] || DEFAULT_TYPES

  // Reset form
  const resetForm = useCallback(() => {
    setTitulo('')
    setCodigo('')
    setDescricao('')
    setSecao('')
    setTipo('')
    setTags('')
    setResponsavelRevisao('')
    setProximaRevisao('')
    setEnviarParaAprovacao(false)
    setArquivo(null)
    setOrigem('')
    setDataPublicacao('')
    setDataVersao('')
    setClassificacaoAcesso('interno')
    setDepartamento('')
    setLocalArmazenamento('Supabase Cloud Storage')
    setResponsavelElaboracao('')
    setResponsavelAprovacao('')
    setCustomSecao('')
    setCustomTipo('')
    setVersao('1')
  }, [])

  // Handle close
  const handleClose = useCallback(() => {
    resetForm()
    onClose?.()
  }, [resetForm, onClose])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!titulo.trim() || !category) return

    setIsSubmitting(true)

    try {
      // Parse tags from comma-separated string
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const docId = `doc-${Date.now()}`

      // Upload de arquivo
      let arquivoFields = {}
      if (arquivo) {
        const uploaded = await supabaseDocumentService.uploadFile(arquivo, category, docId)
        arquivoFields = {
          arquivoURL: uploaded.url,
          arquivoNome: arquivo.name,
          arquivoTamanho: arquivo.size,
          storagePath: uploaded.path,
        }
      }

      // Resolve custom values (section and type)
      const resolvedSecao = secao === '__custom__' ? customSecao.trim() : secao
      const resolvedTipo = tipo === '__custom__' ? customTipo.trim() : tipo

      const documentData = {
        id: docId,
        titulo: titulo.trim(),
        codigo: codigo.trim() || null,
        descricao: descricao.trim() || null,
        tipo: resolvedTipo || 'documento',
        tags: tagsArray,
        status: enviarParaAprovacao ? DOCUMENT_STATUS.PENDENTE : DOCUMENT_STATUS.RASCUNHO,
        versaoAtual: parseFloat(versao) || 1,
        responsavelRevisao: responsavelRevisao.trim() || null,
        proximaRevisao: proximaRevisao || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // New metadata fields
        origem: origem.trim() || null,
        dataPublicacao: dataPublicacao || null,
        dataVersao: dataVersao || null,
        classificacaoAcesso: classificacaoAcesso || 'interno',
        setorNome: departamento.trim() || null,
        localArmazenamento: localArmazenamento.trim() || null,
        responsavelElaboracao: responsavelElaboracao.trim() || null,
        responsavel: responsavelElaboracao.trim() || null,
        responsavelAprovacao: responsavelAprovacao.trim() || null,
        ...arquivoFields,
      }

      // Map section to the correct field based on category
      if (resolvedSecao && sectionOptions) {
        if (category === 'etica') {
          // Etica groups by doc.categoria
          documentData.categoria = resolvedSecao
          documentData.tipo = 'etica'
        } else {
          // Comites, auditorias, relatorios group by doc.tipo
          documentData.tipo = resolvedSecao
        }
      }

      // Passar userInfo para dual-path (mock/Supabase)
      const userInfo = {
        userId: user?.uid || 'sistema',
        userName: user?.displayName || 'Sistema',
        userEmail: user?.email || null,
      }

      await addDocument(category, documentData, userInfo)

      toast({
        title: 'Documento criado',
        description: `"${documentData.titulo}" foi adicionado com sucesso.`,
        variant: 'success',
      })

      resetForm()
      onClose?.()
    } catch (error) {
      console.error('Error adding document:', error)
      toast({
        title: 'Erro ao criar documento',
        description: error.message || 'Nao foi possivel criar o documento.',
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [titulo, codigo, descricao, secao, customSecao, tipo, customTipo, tags, responsavelRevisao, proximaRevisao, enviarParaAprovacao, arquivo, category, sectionOptions, addDocument, toast, resetForm, onClose, user, origem, dataPublicacao, dataVersao, classificacaoAcesso, departamento, localArmazenamento, responsavelElaboracao, responsavelAprovacao, versao])

  // Validation - titulo, responsavelRevisao and proximaRevisao are required
  // Section is required when section options are available
  // Custom section requires text when __custom__ is selected
  const isValid = titulo.trim().length > 0
    && responsavelRevisao.trim().length > 0
    && proximaRevisao.length > 0
    && (!sectionOptions || (secao.length > 0 && (secao !== '__custom__' || customSecao.trim().length > 0)))

  // Don't render if no category
  if (!category) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Novo Documento - ${categoryLabel}`}
      description="Preencha as informacoes do documento"
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <FilePlus className="w-4 h-4 mr-2" />
                Criar Documento
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 max-h-[calc(100dvh-280px)] sm:max-h-none">
        <div className="space-y-4 pb-12 sm:pb-8">
          {/* Row 1: Titulo e Codigo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Titulo" required>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Nome do documento"
                autoFocus
              />
            </FormField>

            <FormField label="Codigo/Referencia">
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: POL-001"
              />
            </FormField>
          </div>

          {/* Row 2: Tipo e Secao */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!sectionOptions && (
              <FormField label="Tipo">
                <Select
                  value={tipo}
                  onChange={setTipo}
                  placeholder="Selecione"
                  options={documentTypes}
                />
              </FormField>
            )}

            {/* Custom type input when "Adicionar novo tipo" is selected */}
            {!sectionOptions && tipo === '__custom__' && (
              <FormField label="Nome do novo tipo" required>
                <Input
                  value={customTipo}
                  onChange={(e) => setCustomTipo(e.target.value)}
                  placeholder="Digite o nome do tipo"
                />
              </FormField>
            )}

            {sectionOptions && (
              <FormField label="Secao" required>
                <Select
                  value={secao}
                  onChange={setSecao}
                  placeholder="Selecione a secao"
                  options={sectionOptions}
                />
              </FormField>
            )}

            {/* Custom section input when "Outro" is selected */}
            {secao === '__custom__' && (
              <FormField label="Nome da nova secao" required>
                <Input
                  value={customSecao}
                  onChange={(e) => setCustomSecao(e.target.value)}
                  placeholder="Digite o nome da secao"
                />
              </FormField>
            )}
          </div>

          {/* Row 3: Origem e Departamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Origem">
              <Input
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Ex: Diretoria, Comite, Externo"
              />
            </FormField>

            <FormField label="Departamento">
              <Input
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value)}
                placeholder="Ex: Anestesia, UTI, CC"
              />
            </FormField>
          </div>

          {/* Row 4: Classificacao de Acesso e Local de Armazenamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Classificacao de Acesso">
              <Select
                value={classificacaoAcesso}
                onChange={setClassificacaoAcesso}
                options={CLASSIFICACAO_ACESSO_OPTIONS}
              />
            </FormField>

            <FormField label="Local de Armazenamento">
              <Input
                value={localArmazenamento}
                onChange={(e) => setLocalArmazenamento(e.target.value)}
                placeholder="Ex: Servidor, Nuvem, Fisico"
              />
            </FormField>
          </div>

          {/* Row 5: Data Publicacao e Data Versao */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Data de Publicacao">
              <Input
                type="date"
                value={dataPublicacao}
                onChange={(e) => setDataPublicacao(e.target.value)}
              />
            </FormField>

            <FormField label="Data da Versao">
              <Input
                type="date"
                value={dataVersao}
                onChange={(e) => setDataVersao(e.target.value)}
              />
            </FormField>
          </div>

          {/* Versao */}
          <FormField label="Versao" hint="Número da versão inicial (ex: 1, 1.0, 2.0)">
            <Input
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder="1"
            />
          </FormField>

          {/* Tags */}
          <FormField label="Tags" hint="Separe por virgula">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="protocolo, seguranca"
            />
          </FormField>

          {/* Descricao */}
          <FormField label="Descricao">
            <Textarea
              value={descricao}
              onChange={setDescricao}
              placeholder="Breve descricao do documento (opcional)"
              rows={2}
            />
          </FormField>

          {/* Row 8: Resp. Elaboracao e Resp. Aprovacao */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Responsavel pela Elaboracao">
              <Select
                value={responsavelElaboracao}
                onChange={setResponsavelElaboracao}
                options={userOptions}
                placeholder="Selecione um usuario"
                searchable
              />
            </FormField>

            <FormField label="Responsavel pela Aprovacao">
              <Select
                value={responsavelAprovacao}
                onChange={setResponsavelAprovacao}
                options={userOptions}
                placeholder="Selecione um usuario"
                searchable
              />
            </FormField>
          </div>

          {/* Row 9: Resp. Revisao e Proxima Revisao */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Responsavel pela Revisao" required>
              <Select
                value={responsavelRevisao}
                onChange={setResponsavelRevisao}
                options={userOptions}
                placeholder="Selecione um usuario"
                searchable
              />
            </FormField>

            <FormField label="Proxima Revisao" required>
              <Input
                type="date"
                value={proximaRevisao}
                onChange={(e) => setProximaRevisao(e.target.value)}
              />
            </FormField>
          </div>

          {/* Enviar para aprovacao */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#E8F5E9] dark:bg-[#243530] cursor-pointer">
            <input
              type="checkbox"
              checked={enviarParaAprovacao}
              onChange={(e) => setEnviarParaAprovacao(e.target.checked)}
              className="w-5 h-5 rounded border-[#C8E6C9] dark:border-[#2A3F36] accent-[#006837]"
            />
            <div>
              <span className="text-sm font-medium text-[#004225] dark:text-white flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Enviar para aprovacao
              </span>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                O documento sera criado como "Aguardando Aprovacao" em vez de "Rascunho"
              </p>
            </div>
          </label>

          {/* Arquivo - variante compacta */}
          <div className="pt-2 pb-6">
            <label className="block text-sm font-semibold text-[#004225] dark:text-[#2ECC71] mb-2">
              Anexar Arquivo (opcional)
            </label>
            <FileUpload
              value={arquivo}
              onChange={setArquivo}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              maxSize={15 * 1024 * 1024}
              variant="button"
            />
            <p className="text-[13px] text-[#9CA3AF] dark:text-[#6B8178] mt-2">
              PDF, Word, Excel - max 15MB
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default NewDocumentModal
