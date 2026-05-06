/**
 * EditDocumentModal — extraído de DocumentoDetalhePage.jsx (W3-2).
 * Lazy-loaded: só é fetched quando admin clica em "Editar".
 *
 * W2-2 (UX/A11y residual):
 *   • DS <Modal> (focus trap, ESC, role="dialog", aria-modal).
 *   • Required: titulo, classificacao (acesso), proximaRevisao.
 *   • Validação live no onChange; Save desabilitado enquanto inválido.
 *   • <FormField error=...> injeta aria-invalid + aria-describedby.
 *   • Unsaved changes guard via useUnsavedChangesGuard.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Button,
  Modal,
  ConfirmDialog,
  FormField,
  Input,
  Textarea,
  Select,
  Switch,
  useToast,
} from '@/design-system';
import { Check } from 'lucide-react';
import { TIPO_CONFIG } from '@/data/documentTypes';
import { useUsersManagement } from '@/contexts/UsersManagementContext';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { CONFIDENTIALITY_OPTIONS } from '@/utils/confidentiality';
import { formatDocDate } from '@/data/documentTypes';
import supabaseDocumentService from '@/services/supabaseDocumentService';

const CONFIDENTIALITY_FLAG_ENABLED =
  import.meta.env?.VITE_FEATURE_CONFIDENTIALITY === 'true';

const RETENTION_FLAG_ENABLED =
  import.meta.env?.VITE_FEATURE_RETENTION === 'true';

// =============================================================================
// LegalHoldSection — Onda1-3 (Retention + Legal hold)
// Renderizada apenas para admins quando VITE_FEATURE_RETENTION === 'true'.
// =============================================================================
function LegalHoldSection({ documento, firebaseUser, currentUser }) {
  const { toast } = useToast();
  const [holdState, setHoldState] = useState(!!documento?.legalHold);
  const [reason, setReason] = useState(documento?.legalHoldReason || '');
  const [submitting, setSubmitting] = useState(false);

  const retentionLabel = useMemo(() => {
    if (!documento?.retentionUntil) return 'Não definida';
    try {
      return formatDocDate(documento.retentionUntil);
    } catch {
      return String(documento.retentionUntil);
    }
  }, [documento?.retentionUntil]);

  const handleToggle = async (nextChecked) => {
    if (!firebaseUser?.uid) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para alterar o legal hold.',
        variant: 'error',
      });
      return;
    }
    if (nextChecked && (!reason || reason.trim().length === 0)) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo do legal hold antes de ativar.',
        variant: 'warning',
      });
      return;
    }
    setSubmitting(true);
    try {
      await supabaseDocumentService.setLegalHold(
        documento.id,
        nextChecked ? reason.trim() : '',
        {
          userId: firebaseUser.uid,
          userName: currentUser?.nome || currentUser?.displayName || firebaseUser.email,
          userEmail: firebaseUser.email,
        },
        { hold: nextChecked }
      );
      setHoldState(nextChecked);
      toast({
        title: nextChecked ? 'Legal hold aplicado' : 'Legal hold removido',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Erro ao alterar legal hold',
        description: err?.message || 'Tente novamente.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[16px] border border-warning/30 bg-warning/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[14px] font-bold text-foreground">Legal hold</span>
          <span className="text-[12px] text-muted-foreground">
            Bloqueia exclusão e arquivamento enquanto ativo.
          </span>
        </div>
        <Switch
          checked={holdState}
          disabled={submitting}
          onChange={handleToggle}
          aria-label="Ativar legal hold"
        />
      </div>

      <FormField
        label="Motivo do legal hold"
        hint="Obrigatório ao ativar. Ex: investigação CRM, processo judicial."
      >
        <Textarea
          value={reason}
          onChange={(val) => setReason(val)}
          rows={2}
          placeholder="Descreva o motivo (litígio, auditoria externa, etc.)"
          disabled={holdState && submitting}
        />
      </FormField>

      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">Retention até:</span>
        <span className="font-medium text-foreground">{retentionLabel}</span>
      </div>
    </div>
  );
}

export default function EditDocumentModal({
  documento,
  onClose,
  onSave,
  isAdmin = false,
  firebaseUser = null,
  currentUser = null,
}) {
  // Helpers
  const getTagsString = (tags) => {
    if (!tags) return '';
    if (Array.isArray(tags)) return tags.join(', ');
    if (typeof tags === 'string') return tags;
    return '';
  };

  const getDateString = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (typeof dateStr === 'string') return dateStr.split('T')[0];
      return '';
    } catch {
      return '';
    }
  };

  // Fallback caso TIPO_CONFIG não esteja disponível
  const tiposDisponiveis = TIPO_CONFIG
    ? Object.entries(TIPO_CONFIG)
    : [
        ['protocolo', { label: 'Protocolo' }],
        ['politica', { label: 'Politica' }],
        ['formulario', { label: 'Formulario' }],
        ['manual', { label: 'Manual' }],
        ['relatorio', { label: 'Relatorio' }],
        ['etica', { label: 'Etica e Bioetica' }],
      ];

  const tipoOptions = useMemo(
    () =>
      tiposDisponiveis.map(([key, conf]) => ({
        value: key,
        label: conf?.label || key,
      })),
    [tiposDisponiveis]
  );

  const classificacaoOptions = [
    { value: 'publico', label: 'Publico' },
    { value: 'interno', label: 'Interno' },
    { value: 'confidencial', label: 'Confidencial' },
    { value: 'restrito', label: 'Restrito' },
  ];

  const { users: allUsers } = useUsersManagement();
  const userOptions = useMemo(
    () =>
      (allUsers || [])
        .filter((u) => u.active)
        .map((u) => ({ value: u.nome, label: u.nome }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [allUsers]
  );

  const initialFormRef = useRef(null);
  const initialForm = useMemo(
    () => ({
      titulo: documento?.titulo || '',
      codigo: documento?.codigo || '',
      tipo: documento?.tipo || 'protocolo',
      setorId: documento?.setorId || 'anestesia',
      descricao: documento?.descricao || '',
      tags: getTagsString(documento?.tags),
      responsavelRevisao: documento?.responsavelRevisao || '',
      proximaRevisao: getDateString(documento?.proximaRevisao),
      origem: documento?.origem || '',
      dataPublicacao: getDateString(documento?.dataPublicacao),
      dataVersao: getDateString(documento?.dataVersao),
      classificacaoAcesso: documento?.classificacaoAcesso || 'interno',
      confidentialityLevel: documento?.confidentialityLevel || 'interno',
      setorNome: documento?.setorNome || '',
      localArmazenamento: documento?.localArmazenamento || 'Supabase Cloud Storage',
      responsavelElaboracao: documento?.responsavelElaboracao || '',
      responsavelAprovacao: documento?.responsavelAprovacao || '',
    }),
    [documento]
  );

  if (initialFormRef.current === null) {
    initialFormRef.current = initialForm;
  }

  const [formData, setFormData] = useState(initialForm);

  const errors = useMemo(() => {
    const e = {};
    if (!formData.titulo || formData.titulo.trim().length === 0) {
      e.titulo = 'Título é obrigatório.';
    } else if (formData.titulo.trim().length < 3) {
      e.titulo = 'Título deve ter ao menos 3 caracteres.';
    }
    if (!formData.classificacaoAcesso) {
      e.classificacaoAcesso = 'Selecione a classificação de acesso.';
    }
    if (!formData.proximaRevisao) {
      e.proximaRevisao = 'Data da próxima revisão é obrigatória.';
    }
    return e;
  }, [formData.titulo, formData.classificacaoAcesso, formData.proximaRevisao]);

  const isValid = Object.keys(errors).length === 0;

  const isDirty = useMemo(() => {
    const snap = initialFormRef.current || {};
    return Object.keys(formData).some((k) => formData[k] !== snap[k]);
  }, [formData]);

  const guard = useUnsavedChangesGuard(isDirty);

  const handleClose = useCallback(() => {
    guard.requestClose(onClose);
  }, [guard, onClose]);

  const handleField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;

    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);

    const payload = {
      ...formData,
      tags: tagsArray,
      origem: formData.origem || null,
      dataPublicacao: formData.dataPublicacao || null,
      dataVersao: formData.dataVersao || null,
      classificacaoAcesso: formData.classificacaoAcesso || 'interno',
      localArmazenamento: formData.localArmazenamento || null,
      responsavelElaboracao: formData.responsavelElaboracao || null,
      responsavel: formData.responsavelElaboracao || null,
      responsavelAprovacao: formData.responsavelAprovacao || null,
      setorNome: formData.setorNome || null,
      updatedAt: new Date().toISOString(),
    };

    if (CONFIDENTIALITY_FLAG_ENABLED && isAdmin) {
      payload.confidentialityLevel = formData.confidentialityLevel || 'interno';
    } else {
      delete payload.confidentialityLevel;
    }

    onSave(payload);
  }, [isValid, formData, onSave, isAdmin]);

  return (
    <>
      <Modal
        open={true}
        onClose={handleClose}
        title="Editar Documento"
        description="Os campos marcados com * são obrigatórios."
        size="lg"
        closeOnOverlayClick={!isDirty}
        closeOnEscape={!isDirty}
        footer={
          <>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid} aria-disabled={!isValid}>
              <Check className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </>
        }
      >
        <Modal.Body>
          <div className="space-y-4 pb-2">
            <FormField label="Título" required error={errors.titulo}>
              <Input
                type="text"
                value={formData.titulo}
                onChange={(e) => handleField('titulo', e.target.value)}
                placeholder="Nome do documento"
                autoFocus
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Código">
                <Input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => handleField('codigo', e.target.value)}
                />
              </FormField>
              <FormField label="Tipo">
                <Select
                  value={formData.tipo}
                  onChange={(val) => handleField('tipo', val)}
                  options={tipoOptions}
                  placeholder="Selecione o tipo"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Origem">
                <Input
                  type="text"
                  value={formData.origem}
                  onChange={(e) => handleField('origem', e.target.value)}
                  placeholder="Ex: Diretoria, Comitê"
                />
              </FormField>
              <FormField label="Departamento">
                <Input
                  type="text"
                  value={formData.setorNome}
                  onChange={(e) => handleField('setorNome', e.target.value)}
                  placeholder="Ex: Anestesia, UTI"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Classificação de Acesso"
                required
                error={errors.classificacaoAcesso}
              >
                <Select
                  value={formData.classificacaoAcesso}
                  onChange={(val) => handleField('classificacaoAcesso', val)}
                  options={classificacaoOptions}
                  placeholder="Selecione a classificação"
                />
              </FormField>
              <FormField label="Local de Armazenamento">
                <Input
                  type="text"
                  value={formData.localArmazenamento}
                  onChange={(e) => handleField('localArmazenamento', e.target.value)}
                  placeholder="Ex: Servidor, Nuvem"
                />
              </FormField>
            </div>

            {CONFIDENTIALITY_FLAG_ENABLED && isAdmin && (
              <FormField
                label="Nível de Confidencialidade"
                hint="Define o clearance mínimo necessário para leitura."
              >
                <Select
                  value={formData.confidentialityLevel}
                  onChange={(val) => handleField('confidentialityLevel', val)}
                  options={CONFIDENTIALITY_OPTIONS}
                  placeholder="Selecione o nível"
                />
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Data de Publicação">
                <Input
                  type="date"
                  value={formData.dataPublicacao}
                  onChange={(e) => handleField('dataPublicacao', e.target.value)}
                />
              </FormField>
              <FormField label="Data da Versão">
                <Input
                  type="date"
                  value={formData.dataVersao}
                  onChange={(e) => handleField('dataVersao', e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Descrição">
              <Textarea
                value={formData.descricao}
                onChange={(val) => handleField('descricao', val)}
                rows={3}
                placeholder="Descreva brevemente o documento"
              />
            </FormField>

            <FormField label="Tags" hint="Separe por vírgula">
              <Input
                type="text"
                value={formData.tags}
                onChange={(e) => handleField('tags', e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Resp. Elaboração">
                <Select
                  value={formData.responsavelElaboracao}
                  onChange={(val) => handleField('responsavelElaboracao', val)}
                  options={userOptions}
                  placeholder="Selecione um usuário"
                  searchable
                />
              </FormField>
              <FormField label="Resp. Aprovação">
                <Select
                  value={formData.responsavelAprovacao}
                  onChange={(val) => handleField('responsavelAprovacao', val)}
                  options={userOptions}
                  placeholder="Selecione um usuário"
                  searchable
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Responsável Revisão">
                <Select
                  value={formData.responsavelRevisao}
                  onChange={(val) => handleField('responsavelRevisao', val)}
                  options={userOptions}
                  placeholder="Selecione um usuário"
                  searchable
                />
              </FormField>
              <FormField label="Próxima Revisão" required error={errors.proximaRevisao}>
                <Input
                  type="date"
                  value={formData.proximaRevisao}
                  onChange={(e) => handleField('proximaRevisao', e.target.value)}
                />
              </FormField>
            </div>

            {isAdmin && RETENTION_FLAG_ENABLED && (
              <LegalHoldSection
                documento={documento}
                firebaseUser={firebaseUser}
                currentUser={currentUser}
              />
            )}
          </div>
        </Modal.Body>
      </Modal>

      <ConfirmDialog
        open={guard.confirmOpen}
        onClose={guard.cancelClose}
        onConfirm={guard.confirmClose}
        title="Descartar alterações?"
        description="Você tem alterações não salvas. Se sair agora elas serão perdidas."
        confirmText="Descartar"
        cancelText="Continuar editando"
        variant="danger"
      />
    </>
  );
}
