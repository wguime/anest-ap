import { useState, useCallback } from 'react';
import { Modal, Input, Textarea, Select, Switch, Button, Alert, useToast } from '@/design-system';
import { DELIBERACAO_TIPOS } from '@/constants/reunioes';
import reunioesService from '@/services/reunioesService';

/**
 * NovaDeliberacaoModal — Create a new deliberação (resolution/voting item) for a meeting.
 * Supports anonymous and identified voting modes with type selection.
 */
export default function NovaDeliberacaoModal({ open, onClose, reuniaoId, user, onSuccess }) {
  const { toast } = useToast();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('aprovacao');
  const [isAnonima, setIsAnonima] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setTitulo('');
    setDescricao('');
    setTipo('aprovacao');
    setIsAnonima(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  }, [submitting, resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitulo = titulo.trim();
    if (!trimmedTitulo) {
      toast({ variant: 'error', title: 'Título obrigatório' });
      return;
    }
    if (trimmedTitulo.length > 200) {
      toast({ variant: 'error', title: 'Título excede 200 caracteres' });
      return;
    }

    try {
      setSubmitting(true);

      const callerInfo = {
        userId: user?.uid || user?.id,
        userName: user?.displayName || user?.email,
        userEmail: user?.email,
      };

      await reunioesService.createDeliberacao(reuniaoId, {
        titulo: trimmedTitulo,
        descricao: descricao.trim(),
        tipo,
        isAnonima,
      }, callerInfo);

      toast({ variant: 'success', title: 'Deliberação criada com sucesso' });
      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao criar deliberação', description: error.message });
    } finally {
      setSubmitting(false);
    }
  }, [titulo, descricao, tipo, isAnonima, reuniaoId, user, toast, resetForm, onSuccess, onClose]);

  const tipoOptions = DELIBERACAO_TIPOS.map(t => ({
    value: t.value,
    label: t.label,
  }));

  const footer = (
    <div className="flex gap-2 w-full">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClose}
        disabled={submitting}
        className="flex-1"
        aria-label="Cancelar criação de deliberação"
      >
        Cancelar
      </Button>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || !titulo.trim()}
        className="flex-1"
        aria-label="Criar deliberação"
      >
        {submitting ? 'Criando...' : 'Criar Deliberação'}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nova Deliberação"
      size="md"
      footer={footer}
    >
      <div className="space-y-4">
        <div>
          <Input
            label="Título"
            placeholder="Ex: Aprovação do protocolo de segurança"
            value={titulo}
            onChange={(e) => setTitulo(typeof e === 'string' ? e : e.target.value)}
            maxLength={200}
            disabled={submitting}
            aria-label="Título da deliberação"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {titulo.length}/200 caracteres
          </p>
        </div>

        <div>
          <Textarea
            label="Descrição"
            placeholder="Contexto ou detalhes adicionais (opcional)"
            value={descricao}
            onChange={setDescricao}
            maxLength={1000}
            rows={3}
            showCount
            disabled={submitting}
            aria-label="Descrição da deliberação"
          />
        </div>

        <Select
          label="Tipo"
          options={tipoOptions}
          value={tipo}
          onChange={setTipo}
          disabled={submitting}
          aria-label="Tipo de deliberação"
        />

        <div className="space-y-2">
          <Switch
            label="Votação anônima"
            description="Votos não serão vinculados à identidade dos participantes"
            checked={isAnonima}
            onChange={setIsAnonima}
            disabled={submitting}
          />

          {isAnonima && (
            <Alert variant="warning">
              Votação anônima: votos não serão vinculados à identidade dos participantes.
              Esta opção não pode ser desativada após o primeiro voto.
            </Alert>
          )}
        </div>
      </div>
    </Modal>
  );
}
