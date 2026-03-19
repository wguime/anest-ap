/**
 * NewDocumentModal Component
 *
 * Modal para criação de novos documentos no Centro de Gestão.
 * Funciona para todas as categorias de documentos.
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
import { CATEGORY_LABELS, DOCUMENT_STATUS, CLASSIFICACAO_ACESSO_OPTIONS, CATEGORY_SUBSECTIONS } from '@/types/documents'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { useAuth } from '@/hooks/useAuth'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import supabaseDocumentService from '@/services/supabaseDocumentService'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Tipo de Documento — classificação estrutural do documento
 * (equivale às subseções da antiga categoria Biblioteca)
 */
const TIPO_DOCUMENTO_OPTIONS = [
  { value: 'regimento_interno',  label: 'Regimento Interno' },
  { value: 'politicas',          label: 'Políticas' },
  { value: 'contratos_legais',   label: 'Contratos e Documentos Legais' },
  { value: 'protocolos',         label: 'Protocolos' },
  { value: 'manuais',            label: 'Manuais' },
  { value: 'formularios',        label: 'Formulários' },
  { value: 'relatorios',         label: 'Relatórios' },
  { value: 'fluxogramas',        label: 'Fluxogramas' },
  { value: 'mapas_processos',    label: 'Mapas de Processos' },
  { value: 'mapas_riscos',       label: 'Mapas de Riscos' },
  { value: 'tabelas',            label: 'Tabelas' },
  { value: 'outro',              label: 'Outro' },
]

/**
 * Seções principais — 11 categorias numeradas (00–10)
 */
const SECAO_PRINCIPAL_OPTIONS = [
  { value: 'modelos',           label: '00 Modelos' },
  { value: 'governanca',        label: '01 Governança' },
  { value: 'institucional',     label: '02 Institucional' },
  { value: 'assistencial',      label: '03 Assistencial' },
  { value: 'gestao_pessoas',    label: '04 Gestão Pessoas' },
  { value: 'residencia',        label: '05 Residência' },
  { value: 'financeiro',        label: '06 Financeiro' },
  { value: 'qualidade',         label: '07 Qualidade' },
  { value: 'tecnologia_mat',    label: '08 Tecnologia Mat' },
  { value: 'relatorios_gerais', label: '09 Relatórios Gerais' },
  { value: 'obsoletos',         label: '10 Obsoletos' },
]

/**
 * Subseções por seção — derivadas de CATEGORY_SUBSECTIONS + opção "Outro"
 */
const CUSTOM_OPTION = { value: '__custom__', label: 'Outro / Nova subseção' }
const SECTION_OPTIONS = Object.fromEntries(
  Object.entries(CATEGORY_SUBSECTIONS).map(([cat, subs]) => [cat, [...subs, CUSTOM_OPTION]])
)

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * NewDocumentModal
 *
 * @param {boolean} props.open       - Controla visibilidade do modal
 * @param {Function} props.onClose   - Callback ao fechar
 * @param {string}  [props.category] - Categoria pré-selecionada (opcional)
 */
function NewDocumentModal({ open, onClose, category }) {
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

  // ── Estado do formulário ──────────────────────────────────────────────────
  const [titulo,                setTitulo]                = useState('')
  const [codigo,                setCodigo]                = useState('')
  const [descricao,             setDescricao]             = useState('')
  const [tipoDocumento,         setTipoDocumento]         = useState('')
  const [selectedCategory,      setSelectedCategory]      = useState(category || '')
  const [secao,                 setSecao]                 = useState('')
  const [customSecao,           setCustomSecao]           = useState('')
  const [tags,                  setTags]                  = useState('')
  const [responsavelRevisao,    setResponsavelRevisao]    = useState('')
  const [proximaRevisao,        setProximaRevisao]        = useState('')
  const [enviarParaAprovacao,   setEnviarParaAprovacao]   = useState(false)
  const [arquivo,               setArquivo]               = useState(null)
  const [isSubmitting,          setIsSubmitting]          = useState(false)
  const [origem,                setOrigem]                = useState('')
  const [dataPublicacao,        setDataPublicacao]        = useState('')
  const [dataVersao,            setDataVersao]            = useState('')
  const [classificacaoAcesso,   setClassificacaoAcesso]   = useState('interno')
  const [departamento,          setDepartamento]          = useState('')
  const [localArmazenamento,    setLocalArmazenamento]    = useState('Supabase Cloud Storage')
  const [responsavelElaboracao, setResponsavelElaboracao] = useState('')
  const [responsavelAprovacao,  setResponsavelAprovacao]  = useState('')
  const [versao,                setVersao]                = useState('1')

  // ── Derivados ─────────────────────────────────────────────────────────────
  const categoryLabel  = CATEGORY_LABELS[selectedCategory] || selectedCategory || ''
  const sectionOptions = SECTION_OPTIONS[selectedCategory] || null

  // Ao trocar seção, limpa subseção
  const handleCategoryChange = useCallback((val) => {
    setSelectedCategory(val)
    setSecao('')
    setCustomSecao('')
  }, [])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setTitulo('')
    setCodigo('')
    setDescricao('')
    setTipoDocumento('')
    setSelectedCategory(category || '')
    setSecao('')
    setCustomSecao('')
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
    setVersao('1')
  }, [category])

  const handleClose = useCallback(() => {
    resetForm()
    onClose?.()
  }, [resetForm, onClose])

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!titulo.trim() || !selectedCategory) return

    setIsSubmitting(true)

    try {
      const tagsArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const docId = `doc-${Date.now()}`

      let arquivoFields = {}
      if (arquivo) {
        const uploaded = await supabaseDocumentService.uploadFile(arquivo, selectedCategory, docId)
        arquivoFields = {
          arquivoURL:     uploaded.url,
          arquivoNome:    arquivo.name,
          arquivoTamanho: arquivo.size,
          storagePath:    uploaded.path,
        }
      }

      const resolvedSecao = secao === '__custom__' ? customSecao.trim() : secao

      const documentData = {
        id:                  docId,
        titulo:              titulo.trim(),
        codigo:              codigo.trim()              || null,
        descricao:           descricao.trim()           || null,
        tipo:                tipoDocumento              || 'documento',
        tipoDocumento:       tipoDocumento              || null,
        tags:                tagsArray,
        status:              enviarParaAprovacao ? DOCUMENT_STATUS.PENDENTE : DOCUMENT_STATUS.RASCUNHO,
        versaoAtual:         parseFloat(versao)         || 1,
        responsavelRevisao:  responsavelRevisao.trim()  || null,
        proximaRevisao:      proximaRevisao             || null,
        createdAt:           new Date().toISOString(),
        updatedAt:           new Date().toISOString(),
        origem:              origem.trim()              || null,
        dataPublicacao:      dataPublicacao             || null,
        dataVersao:          dataVersao                 || null,
        classificacaoAcesso: classificacaoAcesso        || 'interno',
        setorNome:           departamento.trim()        || null,
        localArmazenamento:  localArmazenamento.trim()  || null,
        responsavelElaboracao: responsavelElaboracao.trim() || null,
        responsavel:           responsavelElaboracao.trim() || null,
        responsavelAprovacao:  responsavelAprovacao.trim()  || null,
        ...arquivoFields,
      }

      // Mapeia subseção para o campo correto conforme a seção
      if (resolvedSecao && sectionOptions) {
        if (selectedCategory === 'etica') {
          documentData.categoria = resolvedSecao
        } else {
          // Para comitês, auditorias e relatórios, a subseção define o agrupamento
          documentData.tipo = resolvedSecao
        }
      }

      const userInfo = {
        userId:    user?.uid          || 'sistema',
        userName:  user?.displayName  || 'Sistema',
        userEmail: user?.email        || null,
      }

      await addDocument(selectedCategory, documentData, userInfo)

      toast({
        title:       'Documento criado',
        description: `"${documentData.titulo}" foi adicionado com sucesso.`,
        variant:     'success',
      })

      resetForm()
      onClose?.()
    } catch (error) {
      console.error('Erro ao criar documento:', error)
      toast({
        title:       'Erro ao criar documento',
        description: error.message || 'Não foi possível criar o documento.',
        variant:     'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    titulo, codigo, descricao, tipoDocumento, selectedCategory,
    secao, customSecao, tags, responsavelRevisao, proximaRevisao,
    enviarParaAprovacao, arquivo, sectionOptions, addDocument, toast,
    resetForm, onClose, user, origem, dataPublicacao, dataVersao,
    classificacaoAcesso, departamento, localArmazenamento,
    responsavelElaboracao, responsavelAprovacao, versao,
  ])

  // ── Validação ─────────────────────────────────────────────────────────────
  const isValid = titulo.trim().length > 0
    && selectedCategory.length > 0
    && responsavelRevisao.trim().length > 0
    && proximaRevisao.length > 0
    && (!sectionOptions || (secao.length > 0 && (secao !== '__custom__' || customSecao.trim().length > 0)))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={categoryLabel ? `Novo Documento — ${categoryLabel}` : 'Novo Documento'}
      description="Preencha as informações do documento"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
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

          {/* Título + Código */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Título" required>
              <Input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Nome do documento"
                autoFocus
              />
            </FormField>

            <FormField label="Código / Referência">
              <Input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: POL-001"
              />
            </FormField>
          </div>

          {/* Tipo de Documento */}
          <FormField label="Tipo de Documento">
            <Select
              value={tipoDocumento}
              onChange={setTipoDocumento}
              placeholder="Selecione o tipo de documento"
              options={TIPO_DOCUMENTO_OPTIONS}
            />
          </FormField>

          {/* Seção + Subseção lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Seção" required>
              <Select
                value={selectedCategory}
                onChange={handleCategoryChange}
                placeholder="Selecione a seção"
                options={SECAO_PRINCIPAL_OPTIONS}
              />
            </FormField>

            {sectionOptions && (
              <FormField label="Subseção" required>
                <Select
                  value={secao}
                  onChange={setSecao}
                  placeholder="Selecione a subseção"
                  options={sectionOptions}
                />
              </FormField>
            )}
          </div>

          {/* Campo de texto quando "Outro / Nova subseção" é selecionado */}
          {secao === '__custom__' && (
            <FormField label="Nome da nova subseção" required>
              <Input
                value={customSecao}
                onChange={e => setCustomSecao(e.target.value)}
                placeholder="Digite o nome da subseção"
              />
            </FormField>
          )}

          {/* Origem + Departamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Origem">
              <Input
                value={origem}
                onChange={e => setOrigem(e.target.value)}
                placeholder="Ex: Diretoria, Comitê, Externo"
              />
            </FormField>

            <FormField label="Departamento">
              <Input
                value={departamento}
                onChange={e => setDepartamento(e.target.value)}
                placeholder="Ex: Anestesia, UTI, CC"
              />
            </FormField>
          </div>

          {/* Classificação de Acesso + Local de Armazenamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Classificação de Acesso">
              <Select
                value={classificacaoAcesso}
                onChange={setClassificacaoAcesso}
                options={CLASSIFICACAO_ACESSO_OPTIONS}
              />
            </FormField>

            <FormField label="Local de Armazenamento">
              <Input
                value={localArmazenamento}
                onChange={e => setLocalArmazenamento(e.target.value)}
                placeholder="Ex: Servidor, Nuvem, Físico"
              />
            </FormField>
          </div>

          {/* Data de Publicação + Data da Versão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Data de Publicação">
              <Input
                type="date"
                value={dataPublicacao}
                onChange={e => setDataPublicacao(e.target.value)}
              />
            </FormField>

            <FormField label="Data da Versão">
              <Input
                type="date"
                value={dataVersao}
                onChange={e => setDataVersao(e.target.value)}
              />
            </FormField>
          </div>

          {/* Versão */}
          <FormField label="Versão" hint="Número da versão inicial (ex: 1, 1.0, 2.0)">
            <Input
              value={versao}
              onChange={e => setVersao(e.target.value)}
              placeholder="1"
            />
          </FormField>

          {/* Tags */}
          <FormField label="Tags" hint="Separe por vírgula">
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="protocolo, segurança"
            />
          </FormField>

          {/* Descrição */}
          <FormField label="Descrição">
            <Textarea
              value={descricao}
              onChange={setDescricao}
              placeholder="Breve descrição do documento (opcional)"
              rows={2}
            />
          </FormField>

          {/* Responsável pela Elaboração + Aprovação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Responsável pela Elaboração">
              <Select
                value={responsavelElaboracao}
                onChange={setResponsavelElaboracao}
                options={userOptions}
                placeholder="Selecione um usuário"
                searchable
              />
            </FormField>

            <FormField label="Responsável pela Aprovação">
              <Select
                value={responsavelAprovacao}
                onChange={setResponsavelAprovacao}
                options={userOptions}
                placeholder="Selecione um usuário"
                searchable
              />
            </FormField>
          </div>

          {/* Responsável pela Revisão + Próxima Revisão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Responsável pela Revisão" required>
              <Select
                value={responsavelRevisao}
                onChange={setResponsavelRevisao}
                options={userOptions}
                placeholder="Selecione um usuário"
                searchable
              />
            </FormField>

            <FormField label="Próxima Revisão" required>
              <Input
                type="date"
                value={proximaRevisao}
                onChange={e => setProximaRevisao(e.target.value)}
              />
            </FormField>
          </div>

          {/* Enviar para aprovação */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={enviarParaAprovacao}
              onChange={e => setEnviarParaAprovacao(e.target.checked)}
              className="w-5 h-5 rounded border-border accent-[#006837]"
            />
            <div>
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Enviar para aprovação
              </span>
              <p className="text-xs text-muted-foreground">
                O documento será criado como "Aguardando Aprovação" em vez de "Rascunho"
              </p>
            </div>
          </label>

          {/* Anexar arquivo */}
          <div className="pt-2 pb-6">
            <label className="block text-sm font-semibold text-primary mb-2">
              Anexar Arquivo (opcional)
            </label>
            <FileUpload
              value={arquivo}
              onChange={setArquivo}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              maxSize={15 * 1024 * 1024}
              variant="button"
            />
            <p className="text-[13px] text-muted-foreground mt-2">
              PDF, Word, Excel — máx. 15 MB
            </p>
          </div>

        </div>
      </div>
    </Modal>
  )
}

export default NewDocumentModal
