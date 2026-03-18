import { useState, useEffect } from 'react';
import {
  Building2,
  UserCog,
  Users,
  Briefcase,
  MessageSquare,
  Stethoscope,
  ClipboardList,
  Plus,
  X,
  User,
  Mail,
} from 'lucide-react';
import { Modal } from '@/design-system/components/ui/modal';
import { Button } from '@/design-system/components/ui/button';
import { Input } from '@/design-system/components/ui/input';
import { Select } from '@/design-system/components/ui/select';
import { cn } from '@/design-system/utils/tokens';
import { NODE_TYPES } from '@/data/organogramaData';

// Mapeamento de ícones por tipo
const ICON_MAP = {
  governance: Building2,
  executive: UserCog,
  technical: Stethoscope,
  admin: ClipboardList,
  committee: Users,
  operational: Briefcase,
  advisory: MessageSquare,
};

// Opções de tipo para o Select
const TYPE_OPTIONS = NODE_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

/**
 * Modal para adicionar ou editar um cargo do organograma
 *
 * @param {boolean} open - Se o modal está aberto
 * @param {function} onClose - Callback para fechar o modal
 * @param {object} node - Nó sendo editado (null para criar novo)
 * @param {string} parentId - ID do nó pai (para criação)
 * @param {boolean} isAdvisory - Se está criando um advisory node
 * @param {function} onSave - Callback ao salvar (nodeData)
 * @param {function} onDelete - Callback ao deletar
 * @param {boolean} canDelete - Se pode deletar (false para root)
 * @param {boolean} saving - Se está salvando
 */
export function OrgEditModal({
  open,
  onClose,
  node,
  parentId,
  isAdvisory = false,
  onSave,
  onDelete,
  canDelete = true,
  saving = false,
}) {
  // Estado do formulário
  const [formData, setFormData] = useState({
    cargo: '',
    tipo: 'operational',
    responsaveis: [''],
    descricao: '',
    contatos: [''],
  });

  const [errors, setErrors] = useState({});

  // Helper para converter string/array para array
  const toArray = (value) => {
    if (!value) return [''];
    if (Array.isArray(value)) return value.length > 0 ? value : [''];
    return [value];
  };

  // Preencher formulário quando o node mudar
  useEffect(() => {
    if (node) {
      setFormData({
        cargo: node.cargo || '',
        tipo: node.tipo || 'operational',
        responsaveis: toArray(node.responsavel),
        descricao: node.descricao || '',
        contatos: toArray(node.contato),
      });
    } else {
      // Novo nó
      setFormData({
        cargo: '',
        tipo: isAdvisory ? 'advisory' : 'operational',
        responsaveis: [''],
        descricao: '',
        contatos: [''],
      });
    }
    setErrors({});
  }, [node, isAdvisory, open]);

  // Atualizar campo simples do formulário
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Atualizar item de array
  const updateArrayItem = (field, index, value) => {
    setFormData((prev) => {
      const newArray = [...prev[field]];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
    // Limpar erro específico
    if (errors[`${field}_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${field}_${index}`];
        return next;
      });
    }
  };

  // Adicionar item ao array
  const addArrayItem = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  // Remover item do array
  const removeArrayItem = (field, index) => {
    setFormData((prev) => {
      const newArray = prev[field].filter((_, i) => i !== index);
      return { ...prev, [field]: newArray.length > 0 ? newArray : [''] };
    });
  };

  // Validar email
  const isValidEmail = (email) => {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Validar formulário
  const validate = () => {
    const newErrors = {};

    if (!formData.cargo.trim()) {
      newErrors.cargo = 'O nome do cargo é obrigatório';
    }

    // Validar emails
    formData.contatos.forEach((email, index) => {
      if (email.trim() && !isValidEmail(email.trim())) {
        newErrors[`contatos_${index}`] = 'Email inválido';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Salvar
  const handleSave = () => {
    if (!validate()) return;

    // Filtrar valores vazios e converter para formato adequado
    const responsaveisFiltered = formData.responsaveis
      .map((r) => r.trim())
      .filter(Boolean);
    const contatosFiltered = formData.contatos
      .map((c) => c.trim())
      .filter(Boolean);

    const nodeData = {
      cargo: formData.cargo.trim(),
      tipo: formData.tipo,
      // Salvar como array se múltiplos, string se único, null se vazio
      responsavel: responsaveisFiltered.length > 1
        ? responsaveisFiltered
        : responsaveisFiltered.length === 1
        ? responsaveisFiltered[0]
        : null,
      descricao: formData.descricao.trim() || null,
      contato: contatosFiltered.length > 1
        ? contatosFiltered
        : contatosFiltered.length === 1
        ? contatosFiltered[0]
        : null,
    };

    onSave?.(nodeData);
  };

  // Deletar
  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja remover "${node?.cargo}"?\n\nTodos os cargos subordinados também serão removidos.`)) {
      onDelete?.(node);
    }
  };

  const isEditing = !!node;
  const title = isEditing
    ? 'Editar Cargo'
    : isAdvisory
    ? 'Novo Comitê Consultivo'
    : 'Novo Cargo';

  const Icon = ICON_MAP[formData.tipo] || Briefcase;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      className="flex flex-col"
    >
      <Modal.Body className="flex-1 overflow-y-auto max-h-[60vh]">
        <div className="space-y-5">
          {/* Preview do tipo */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background dark:bg-muted border border-border">
            <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center border border-border">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-foreground truncate">
                {formData.cargo || 'Nome do Cargo'}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {TYPE_OPTIONS.find((t) => t.value === formData.tipo)?.label || 'Tipo'}
              </p>
            </div>
          </div>

          {/* Nome do Cargo */}
          <div>
            <Input
              label="Nome do Cargo *"
              placeholder="Ex: Coordenador Geral"
              value={formData.cargo}
              onChange={(e) => updateField('cargo', e.target.value)}
              error={errors.cargo}
              disabled={saving}
            />
          </div>

          {/* Tipo */}
          <div>
            <Select
              label="Tipo"
              options={TYPE_OPTIONS}
              value={formData.tipo}
              onChange={(value) => updateField('tipo', value)}
              disabled={saving || isAdvisory}
            />
            {isAdvisory && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Comitês consultivos ficam ao lado do cargo pai (não na hierarquia vertical)
              </p>
            )}
          </div>

          {/* Responsáveis (múltiplos) */}
          <div>
            <label className="block text-[13px] font-medium text-foreground dark:text-[#D1D5DB] mb-1.5">
              Responsáveis
            </label>
            <div className="space-y-2">
              {formData.responsaveis.map((responsavel, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={index === 0 ? "Nome do responsável" : "Outro responsável"}
                        value={responsavel}
                        onChange={(e) => updateArrayItem('responsaveis', index, e.target.value)}
                        disabled={saving}
                        className={cn(
                          'w-full pl-10 pr-4 py-2.5 rounded-xl border bg-card',
                          'text-[15px] text-[#000000] dark:text-white',
                          'placeholder:text-muted-foreground dark:placeholder:text-muted-foreground',
                          'border-border',
                          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      />
                    </div>
                  </div>
                  {formData.responsaveis.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('responsaveis', index)}
                      disabled={saving}
                      className="p-2 rounded-lg text-destructive hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/30 transition-colors"
                      aria-label="Remover responsável"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addArrayItem('responsaveis')}
                disabled={saving}
                className="flex items-center gap-2 text-[13px] text-primary hover:underline disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Adicionar responsável
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[13px] font-medium text-foreground dark:text-[#D1D5DB] mb-1.5">
              Descrição
            </label>
            <textarea
              placeholder="Breve descrição das responsabilidades..."
              value={formData.descricao}
              onChange={(e) => updateField('descricao', e.target.value)}
              disabled={saving}
              rows={3}
              className={cn(
                'w-full px-4 py-3 rounded-xl border bg-card',
                'text-[15px] text-[#000000] dark:text-white',
                'placeholder:text-muted-foreground dark:placeholder:text-muted-foreground',
                'border-border',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                'resize-none',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            />
          </div>

          {/* Emails de Contato (múltiplos) */}
          <div>
            <label className="block text-[13px] font-medium text-foreground dark:text-[#D1D5DB] mb-1.5">
              Emails de Contato
            </label>
            <div className="space-y-2">
              {formData.contatos.map((contato, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        placeholder={index === 0 ? "email@anest.com.br" : "Outro email"}
                        value={contato}
                        onChange={(e) => updateArrayItem('contatos', index, e.target.value)}
                        disabled={saving}
                        className={cn(
                          'w-full pl-10 pr-4 py-2.5 rounded-xl border bg-card',
                          'text-[15px] text-[#000000] dark:text-white',
                          'placeholder:text-muted-foreground dark:placeholder:text-muted-foreground',
                          errors[`contatos_${index}`]
                            ? 'border-[#EF4444] focus:ring-[#EF4444]'
                            : 'border-border focus:ring-primary',
                          'focus:outline-none focus:ring-2 focus:border-transparent',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      />
                    </div>
                    {errors[`contatos_${index}`] && (
                      <p className="mt-1 text-[12px] text-destructive">
                        {errors[`contatos_${index}`]}
                      </p>
                    )}
                  </div>
                  {formData.contatos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('contatos', index)}
                      disabled={saving}
                      className="p-2 rounded-lg text-destructive hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/30 transition-colors mt-0.5"
                      aria-label="Remover email"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addArrayItem('contatos')}
                disabled={saving}
                className="flex items-center gap-2 text-[13px] text-primary hover:underline disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Adicionar email
              </button>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        {/* Botão Deletar (apenas para edição e se permitido) */}
        {isEditing && canDelete && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={saving}
            className="mr-auto"
          >
            Remover
          </Button>
        )}

        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default OrgEditModal;
