/**
 * CategoriasManagerPage.jsx
 *
 * Wave 1.7 T1.7.10 — Gerenciamento CRUD de categorias de cursos.
 * Source-of-truth: tabela `public.educacao_categorias` (Supabase, RLS admin-only writes).
 *
 * Substitui o legado `mockCategorias` hard-coded em `educacaoUtils.js`.
 * Acessível em `case 'categorias-manager'` do App.jsx.
 *
 * Audit trail: toda mutation passa por `requireUserId()` (rule: audit-trail.md).
 */

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Plus,
  Edit2,
  Trash2,
  Tag as TagIcon,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Modal,
  ConfirmDialog,
  FormField,
  Select,
  Switch,
  EmptyState,
  Spinner,
  Alert,
  useToast,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { useUser } from '@/contexts/UserContext';
import { requireUserId } from '@/utils/audit';
import { supabase } from '@/config/supabase';
import {
  useCategorias,
  clearCategoriasCache,
} from '@/hooks/useCategorias';

const COR_OPTIONS = [
  { value: 'green', label: 'Verde' },
  { value: 'purple', label: 'Roxo' },
  { value: 'blue', label: 'Azul' },
  { value: 'cyan', label: 'Ciano' },
  { value: 'pink', label: 'Rosa' },
  { value: 'indigo', label: 'Índigo' },
  { value: 'orange', label: 'Laranja' },
  { value: 'teal', label: 'Verde-água' },
  { value: 'red', label: 'Vermelho' },
];

// Mapeia cor_token → classes Tailwind DS (tokens semânticos category-*).
// NÃO hardcode hex aqui — usamos as classes geradas pelo tailwind.config.js.
const COR_SWATCH_CLASS = {
  green: 'bg-category-green-bg text-category-green-fg border-category-green',
  purple: 'bg-category-purple-bg text-category-purple-fg border-category-purple',
  blue: 'bg-category-blue-bg text-category-blue-fg border-category-blue',
  cyan: 'bg-category-cyan-bg text-category-cyan-fg border-category-cyan',
  pink: 'bg-category-pink-bg text-category-pink-fg border-category-pink',
  indigo: 'bg-category-indigo-bg text-category-indigo-fg border-category-indigo',
  orange: 'bg-category-orange-bg text-category-orange-fg border-category-orange',
  teal: 'bg-category-teal-bg text-category-teal-fg border-category-teal',
  red: 'bg-category-red-bg text-category-red-fg border-category-red',
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function CategoriasManagerPage({ goBack }) {
  const { toast } = useToast();
  const { user } = useUser();
  const { categorias, loading, error, refetch } = useCategorias({
    apenasAtivas: false,
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [editing, setEditing] = useState(null); // categoria sendo editada (ou null = nova)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    slug: '',
    nome: '',
    corToken: 'green',
    ordem: 0,
    ativa: true,
  });
  const [formError, setFormError] = useState(null);

  const sortedCategorias = useMemo(
    () => [...(categorias || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [categorias]
  );

  const openCreate = () => {
    setEditing(null);
    setFormState({
      slug: '',
      nome: '',
      corToken: 'green',
      ordem: (sortedCategorias[sortedCategorias.length - 1]?.ordem ?? 0) + 1,
      ativa: true,
    });
    setFormError(null);
    setShowFormModal(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setFormState({
      slug: cat.slug,
      nome: cat.nome,
      corToken: cat.corToken || 'green',
      ordem: cat.ordem ?? 0,
      ativa: cat.ativa !== false,
    });
    setFormError(null);
    setShowFormModal(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowFormModal(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSave = useCallback(async () => {
    setFormError(null);

    const nome = (formState.nome || '').trim();
    if (!nome) {
      setFormError('Nome obrigatório.');
      return;
    }

    const slug = (formState.slug || slugify(nome)).trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setFormError('Slug deve conter apenas letras minúsculas, números e hífen.');
      return;
    }

    let audit;
    try {
      audit = requireUserId(
        {
          userId: user?.uid,
          userName: user?.displayName,
          userEmail: user?.email,
        },
        'CategoriasManagerPage.save'
      );
    } catch (e) {
      toast({
        variant: 'error',
        title: 'Sessão expirada',
        description: 'Faça login novamente para gerenciar categorias.',
      });
      if (import.meta.env.DEV) console.error(e);
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const { error: e } = await supabase
          .from('educacao_categorias')
          .update({
            slug,
            nome,
            cor_token: formState.corToken,
            ordem: Number(formState.ordem) || 0,
            ativa: !!formState.ativa,
            updated_by: audit.userId,
          })
          .eq('id', editing.uuid);
        if (e) throw e;
        toast({ variant: 'success', title: 'Categoria atualizada' });
      } else {
        const { error: e } = await supabase
          .from('educacao_categorias')
          .insert({
            slug,
            nome,
            cor_token: formState.corToken,
            ordem: Number(formState.ordem) || 0,
            ativa: !!formState.ativa,
            created_by: audit.userId,
          });
        if (e) throw e;
        toast({ variant: 'success', title: 'Categoria criada' });
      }
      clearCategoriasCache();
      await refetch();
      setShowFormModal(false);
      setEditing(null);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[CategoriasManager] save error:', e);
      const msg = String(e?.message || '');
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setFormError('Já existe uma categoria com este slug.');
      } else {
        setFormError('Erro ao salvar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [editing, formState, refetch, toast, user]);

  const handleDeleteClick = (cat) => {
    setToDelete(cat);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!toDelete) return;
    let audit;
    try {
      audit = requireUserId(
        { userId: user?.uid, userName: user?.displayName, userEmail: user?.email },
        'CategoriasManagerPage.delete'
      );
    } catch (e) {
      toast({
        variant: 'error',
        title: 'Sessão expirada',
        description: 'Faça login novamente.',
      });
      if (import.meta.env.DEV) console.error(e);
      return;
    }
    setSubmitting(true);
    try {
      const { error: e } = await supabase
        .from('educacao_categorias')
        .delete()
        .eq('id', toDelete.uuid);
      if (e) throw e;
      clearCategoriasCache();
      await refetch();
      toast({
        variant: 'success',
        title: 'Categoria removida',
        description: `Removida por ${audit.userName}.`,
      });
      setShowDeleteConfirm(false);
      setToDelete(null);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[CategoriasManager] delete error:', e);
      toast({
        variant: 'error',
        title: 'Erro ao remover',
        description: 'Verifique se não há cursos vinculados.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [toDelete, refetch, toast, user]);

  const handleToggleAtiva = useCallback(
    async (cat) => {
      let audit;
      try {
        audit = requireUserId(
          { userId: user?.uid, userName: user?.displayName, userEmail: user?.email },
          'CategoriasManagerPage.toggleAtiva'
        );
      } catch (e) {
        toast({ variant: 'error', title: 'Sessão expirada' });
        if (import.meta.env.DEV) console.error(e);
        return;
      }
      try {
        const { error: e } = await supabase
          .from('educacao_categorias')
          .update({ ativa: !cat.ativa, updated_by: audit.userId })
          .eq('id', cat.uuid);
        if (e) throw e;
        clearCategoriasCache();
        await refetch();
      } catch (e) {
        if (import.meta.env.DEV) console.error('[CategoriasManager] toggle error:', e);
        toast({ variant: 'error', title: 'Erro ao alterar status' });
      }
    },
    [refetch, toast, user]
  );

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px]"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Categorias de Cursos
          </h1>
          <div className="min-w-[70px] flex justify-end" />
        </div>
      </div>
    </nav>
  );

  const formFooter = (
    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
      <Button variant="outline" onClick={closeForm} disabled={submitting}>
        Cancelar
      </Button>
      <Button onClick={handleSave} loading={submitting}>
        {editing ? 'Salvar alterações' : 'Criar categoria'}
      </Button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-primary" />
                Categorias
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Use para organizar cursos. Slug não pode mudar depois de vinculado.
              </p>
            </div>
            <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
              Nova
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="error">
            Não foi possível carregar categorias. Tente recarregar a página.
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : sortedCategorias.length === 0 ? (
          <Card>
            <CardContent className="p-4">
              <EmptyState
                icon={<TagIcon className="w-12 h-12" />}
                title="Nenhuma categoria"
                description="Crie a primeira categoria para começar a organizar cursos."
                size="sm"
                action={{ label: 'Nova categoria', onClick: openCreate }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-2 sm:p-3">
              <ul className="divide-y divide-border">
                {sortedCategorias.map((cat) => (
                  <li
                    key={cat.uuid || cat.slug}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-2"
                  >
                    <span
                      className={cn(
                        'inline-flex h-10 w-10 items-center justify-center rounded-lg border shrink-0',
                        COR_SWATCH_CLASS[cat.corToken] ||
                          'bg-muted text-muted-foreground border-border'
                      )}
                      aria-hidden="true"
                    >
                      <TagIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {cat.nome}
                        </span>
                        {!cat.ativa && (
                          <Badge variant="outline" size="sm">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                        {cat.slug} · ordem {cat.ordem}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => handleToggleAtiva(cat)}
                        aria-label={cat.ativa ? 'Desativar' : 'Ativar'}
                        title={cat.ativa ? 'Desativar' : 'Ativar'}
                      >
                        {cat.ativa ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => openEdit(cat)}
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(cat)}
                        aria-label="Remover"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal
        open={showFormModal}
        onClose={closeForm}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        description="Categorias agrupam cursos. Slug é usado em URLs e filtros."
        size="md"
        footer={formFooter}
      >
        <div className="space-y-4">
          <FormField label="Nome" required>
            <div>
              <Input
                value={formState.nome}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    nome: e.target.value,
                    slug: editing ? prev.slug : slugify(e.target.value),
                  }))
                }
                placeholder="Ex: Segurança do Paciente"
                maxLength={80}
              />
            </div>
          </FormField>

          <FormField label="Slug" hint="Apenas a-z, 0-9 e hífen. Não mude depois de usar.">
            <div>
              <Input
                value={formState.slug}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase(),
                  }))
                }
                placeholder="seguranca-paciente"
                maxLength={60}
                className="font-mono"
              />
            </div>
          </FormField>

          <FormField label="Cor (token DS)">
            <Select
              value={formState.corToken}
              onChange={(v) => setFormState((prev) => ({ ...prev, corToken: v }))}
              options={COR_OPTIONS}
            />
          </FormField>

          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2',
              COR_SWATCH_CLASS[formState.corToken] ||
                'bg-muted text-muted-foreground border-border'
            )}
          >
            <TagIcon className="w-4 h-4" />
            <span className="text-sm font-medium">
              Preview: {formState.nome || 'Categoria'}
            </span>
          </div>

          <FormField label="Ordem" hint="Menor aparece primeiro.">
            <div>
              <Input
                type="number"
                value={formState.ordem}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    ordem: Number(e.target.value) || 0,
                  }))
                }
                min={0}
                max={999}
              />
            </div>
          </FormField>

          <FormField label="Ativa">
            <div className="flex items-center gap-3">
              <Switch
                checked={formState.ativa}
                onCheckedChange={(v) =>
                  setFormState((prev) => ({ ...prev, ativa: !!v }))
                }
              />
              <span className="text-sm text-muted-foreground">
                {formState.ativa ? 'Visível para alunos' : 'Oculta para alunos'}
              </span>
            </div>
          </FormField>

          {formError && <Alert variant="error">{formError}</Alert>}
        </div>
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          if (!submitting) {
            setShowDeleteConfirm(false);
            setToDelete(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
        title="Remover categoria?"
        description={
          toDelete
            ? `"${toDelete.nome}" será removida. Cursos vinculados podem ficar sem categoria.`
            : ''
        }
        confirmText="Remover"
        cancelText="Cancelar"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}

export { CategoriasManagerPage };
