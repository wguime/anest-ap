/**
 * AdminConteudoPage.jsx
 * Gestão de conteúdo educacional (rebuild)
 * Layout 3 painéis: Navigator (árvore) | Editor | Sidebar (status/links)
 */

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  BarChart3,
  Plus,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Save,
  Trash2,
} from 'lucide-react';
import {
  Card,
  Button,
  Input,
  Textarea,
  FormField,
  Select,
  Checkbox,
  Badge,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/design-system';
import { ListTree, Sparkles } from 'lucide-react';

import { useEducacaoData } from '../hooks/useEducacaoData';
import { ReorderableList } from './components/ReorderableList';
import { CascadeCreator } from './components/CascadeCreator';
import { cn } from '@/design-system/utils/tokens';

const NODE_ICON = {
  trilha: GitBranch,
  curso: BookOpen,
  modulo: FolderOpen,
  aula: Video,
};

const NODE_LABEL = {
  trilha: 'Trilha',
  curso: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
};

function safeLower(s) {
  return String(s || '').toLowerCase();
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  } catch {
    return '—';
  }
}

function buildLegacyBlocksFromAula(aula) {
  if (!aula) return [];
  // Se já possui blocks, respeitar
  if (Array.isArray(aula.blocks) && aula.blocks.length) return aula.blocks;

  // Compatibilidade: transformar modelo antigo (tipo/url/descricao) em blocos
  const blocks = [];
  if (aula.descricao) {
    blocks.push({
      id: crypto?.randomUUID?.() || `b_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: 'text',
      data: { html: `<p>${String(aula.descricao || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` },
    });
  }
  if (aula.url && aula.tipo) {
    blocks.push({
      id: crypto?.randomUUID?.() || `b_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: aula.tipo,
      data: { url: aula.url, mimeType: aula.mimeType || '', title: aula.titulo || '' },
    });
  }
  return blocks;
}

function sanitizeHtmlLight(html) {
  // Sanitização leve (allowlist de tags simples) para evitar scripts/event handlers.
  // Sem dependências externas.
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    const allowedTags = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'A', 'H3', 'H4']);
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!allowedTags.has(el.tagName)) {
        // troca por texto (mantém conteúdo)
        const span = doc.createElement('span');
        span.textContent = el.textContent || '';
        el.replaceWith(span);
        continue;
      }
      // remove atributos perigosos
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'style') el.removeAttribute(attr.name);
        if (el.tagName === 'A' && name === 'href') {
          const href = String(el.getAttribute('href') || '');
          if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
            el.removeAttribute('href');
          } else {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noreferrer');
          }
        }
      });
    }
    return doc.body.innerHTML;
  } catch {
    return String(html || '');
  }
}

function RichTextSimple({ value, onChange }) {
  const [internal, setInternal] = useState(value || '');

  const sync = useCallback((next) => {
    setInternal(next);
    onChange?.(next);
  }, [onChange]);

  // Atualizar quando valor externo mudar
  useMemo(() => {
    setInternal(value || '');
    return null;
  }, [value]);

  const apply = (command) => {
    try {
      document.execCommand(command, false, null);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap gap-2 p-2 border-b border-border bg-muted/30">
        <Button type="button" size="sm" variant="outline" onClick={() => apply('bold')}>Negrito</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => apply('italic')}>Itálico</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => apply('insertUnorderedList')}>Lista</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => apply('insertOrderedList')}>1-2-3</Button>
      </div>
      <div
        className="p-3 min-h-[120px] prose prose-sm dark:prose-invert max-w-none focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => sync(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: internal }}
      />
    </div>
  );
}

function BlockRenderer({ blocks }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  if (safeBlocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {safeBlocks.map((b) => {
        if (!b?.type) return null;
        if (b.type === 'text') {
          return (
            <div
              key={b.id}
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtmlLight(b?.data?.html) }}
            />
          );
        }
        if (b.type === 'heading') {
          return (
            <h3 key={b.id} className="text-base font-semibold text-foreground">
              {b?.data?.text || '—'}
            </h3>
          );
        }
        if (b.type === 'callout') {
          return (
            <div key={b.id} className="p-3 rounded-xl bg-muted text-sm text-foreground">
              {b?.data?.text || '—'}
            </div>
          );
        }
        if (b.type === 'document') {
          const url = b?.data?.url || '';
          return (
            <div key={b.id} className="p-3 rounded-xl border border-border bg-card">
              <p className="text-sm font-medium">Arquivo</p>
              <a className="text-sm text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </div>
          );
        }
        // Para mídias (youtube/vimeo/video/audio) ainda exibimos como link no admin.
        const url = b?.data?.url || '';
        return (
          <div key={b.id} className="p-3 rounded-xl border border-border bg-card">
            <p className="text-sm font-medium">{b.type}</p>
            <a className="text-sm text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
              Abrir
            </a>
          </div>
        );
      })}
    </div>
  );
}

function BlockEditor({ blocks, onChange }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  const setBlocks = (next) => {
    onChange?.(next);
  };

  const addBlock = (type) => {
    const id = crypto?.randomUUID?.() || `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const base = { id, type, data: {} };
    if (type === 'text') base.data = { html: '<p></p>' };
    if (type === 'heading') base.data = { text: '' };
    if (type === 'callout') base.data = { text: '' };
    if (type === 'document') base.data = { url: '', mimeType: '' };
    if (['youtube', 'vimeo', 'video', 'audio'].includes(type)) base.data = { url: '' };
    setBlocks([...safeBlocks, base]);
  };

  const updateBlock = (id, patch) => {
    setBlocks(safeBlocks.map((b) => (b.id === id ? { ...b, ...patch, data: { ...(b.data || {}), ...(patch.data || {}) } } : b)));
  };

  const removeBlock = (id) => {
    setBlocks(safeBlocks.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Blocos da aula</p>
        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>Adicionar bloco</Button>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem onClick={() => addBlock('heading')}>Título</DropdownItem>
            <DropdownItem onClick={() => addBlock('text')}>Texto</DropdownItem>
            <DropdownItem onClick={() => addBlock('callout')}>Callout</DropdownItem>
            <DropdownItem onClick={() => addBlock('video')}>Vídeo (upload)</DropdownItem>
            <DropdownItem onClick={() => addBlock('audio')}>Áudio (upload)</DropdownItem>
            <DropdownItem onClick={() => addBlock('youtube')}>YouTube</DropdownItem>
            <DropdownItem onClick={() => addBlock('vimeo')}>Vimeo</DropdownItem>
            <DropdownItem onClick={() => addBlock('document')}>Documento</DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      {safeBlocks.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Nenhum bloco ainda. Adicione “Texto” para começar.
        </div>
      ) : (
        <ReorderableList
          items={safeBlocks}
          onReorder={(newIds) => {
            const byId = new Map(safeBlocks.map((b) => [b.id, b]));
            setBlocks(newIds.map((id) => byId.get(id)).filter(Boolean));
          }}
          renderItem={(b) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" badgeStyle="subtle">{b.type}</Badge>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeBlock(b.id)} title="Remover bloco">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {b.type === 'heading' && (
                <Input
                  value={b?.data?.text || ''}
                  onChange={(e) => updateBlock(b.id, { data: { text: e.target.value } })}
                  placeholder="Título do bloco…"
                />
              )}

              {b.type === 'callout' && (
                <Textarea
                  value={b?.data?.text || ''}
                  onChange={(v) => updateBlock(b.id, { data: { text: v } })}
                  rows={2}
                  placeholder="Texto do callout…"
                />
              )}

              {b.type === 'text' && (
                <RichTextSimple
                  value={b?.data?.html || ''}
                  onChange={(html) => updateBlock(b.id, { data: { html } })}
                />
              )}

              {['youtube', 'vimeo', 'video', 'audio', 'document'].includes(b.type) && (
                <Input
                  value={b?.data?.url || ''}
                  onChange={(e) => updateBlock(b.id, { data: { url: e.target.value } })}
                  placeholder={b.type === 'document' ? 'URL do arquivo…' : 'URL da mídia…'}
                />
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

/**
 * AdminConteudoPage - Dashboard principal de gestão de conteúdo
 */
export default function AdminConteudoPage({ onNavigate, goBack }) {
  // Hook de dados
  const {
    trilhas,
    cursos,
    modulos,
    aulas,
    contentTree,
    stats,
    addTrilha,
    updateTrilha,
    deleteTrilha,
    addCurso,
    updateCurso,
    deleteCurso,
    addModulo,
    updateModulo,
    deleteModulo,
    addAula,
    updateAula,
    deleteAula,
    reorderCursosInTrilha,
    reorderModulosInCurso,
    reorderAulasInModulo,
    getModulosByCursoId,
    cursoModulosRel,
    moduloAulasRel,
    linkModuloToCurso,
    unlinkModuloFromCurso,
    linkAulaToModulo,
    unlinkAulaFromModulo,
  } = useEducacaoData();

  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState(null); // { type, id }
  const [editorState, setEditorState] = useState(null); // form buffer do item selecionado
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('estrutura');

  const selectedEntity = useMemo(() => {
    if (!selectedNode?.id || !selectedNode?.type) return null;
    if (selectedNode.type === 'trilha') return (trilhas || []).find(t => t.id === selectedNode.id) || null;
    if (selectedNode.type === 'curso') return (cursos || []).find(c => c.id === selectedNode.id) || null;
    if (selectedNode.type === 'modulo') return (modulos || []).find(m => m.id === selectedNode.id) || null;
    if (selectedNode.type === 'aula') return (aulas || []).find(a => a.id === selectedNode.id) || null;
    return null;
  }, [selectedNode, trilhas, cursos, modulos, aulas]);

  const selectNode = useCallback((node) => {
    if (!node?.id || !node?.type) return;
    if (isDirty) {
      const ok = window.confirm('Você tem alterações não salvas. Deseja descartar e trocar de item?');
      if (!ok) return;
    }
    setSelectedNode({ type: node.type, id: node.id });
    setIsDirty(false);
    setError(null);
    // buffer inicial do editor (normaliza aula.blocks)
    if (node.type === 'aula') {
      const aula = (aulas || []).find(a => a.id === node.id);
      setEditorState({
        ...(aula || {}),
        blocks: buildLegacyBlocksFromAula(aula || {}),
      });
    } else if (node.type === 'trilha') {
      const trilha = (trilhas || []).find(t => t.id === node.id);
      setEditorState({ ...(trilha || {}) });
    } else if (node.type === 'curso') {
      const curso = (cursos || []).find(c => c.id === node.id);
      setEditorState({ ...(curso || {}) });
    } else if (node.type === 'modulo') {
      const modulo = (modulos || []).find(m => m.id === node.id);
      setEditorState({ ...(modulo || {}) });
    } else {
      setEditorState(null);
    }
  }, [isDirty, aulas, trilhas, cursos, modulos]);

  const navigatorTree = useMemo(() => {
    const tree = Array.isArray(trilhas) ? trilhas : [];
    const cursosById = new Map((cursos || []).map(c => [c.id, c]));
    const modulosById = new Map((modulos || []).map(m => [m.id, m]));
    const aulasById = new Map((aulas || []).map(a => [a.id, a]));

    return tree.map((t) => {
      const childrenCursos = (t.cursos || [])
        .map((cid) => cursosById.get(cid))
        .filter(Boolean)
        .map((c) => {
          const rels = (cursoModulosRel || []).filter(r => r.cursoId === c.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
          const moduloIds = rels.length ? rels.map(r => r.moduloId) : (c.moduloIds || []);
          const childrenModulos = moduloIds
            .map((mid) => modulosById.get(mid))
            .filter(Boolean)
            .map((m) => {
              const relA = (moduloAulasRel || []).filter(r => r.moduloId === m.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
              const aulaIds = relA.length ? relA.map(r => r.aulaId) : (m.aulaIds || []);
              const childrenAulas = aulaIds
                .map((aid) => aulasById.get(aid))
                .filter(Boolean);
              return { type: 'modulo', id: m.id, titulo: m.titulo, ativo: m.ativo !== false, children: childrenAulas.map(a => ({ type: 'aula', id: a.id, titulo: a.titulo, ativo: a.ativo !== false, children: [] })) };
            });
          return { type: 'curso', id: c.id, titulo: c.titulo, ativo: c.ativo !== false, children: childrenModulos };
        });

      return { type: 'trilha', id: t.id, titulo: t.titulo, ativo: t.ativo !== false, children: childrenCursos };
    });
  }, [trilhas, cursos, modulos, aulas, cursoModulosRel, moduloAulasRel]);

  const filteredNavigatorTree = useMemo(() => {
    const q = safeLower(search).trim();
    if (!q) return navigatorTree;
    const filterNode = (node) => {
      const match = safeLower(node.titulo).includes(q) || safeLower(NODE_LABEL[node.type]).includes(q);
      const children = (node.children || []).map(filterNode).filter(Boolean);
      if (match || children.length) return { ...node, children };
      return null;
    };
    return navigatorTree.map(filterNode).filter(Boolean);
  }, [navigatorTree, search]);

  const links = useMemo(() => {
    if (!selectedNode?.id || !selectedNode?.type) return [];
    const id = selectedNode.id;
    if (selectedNode.type === 'curso') {
      return (trilhas || []).filter(t => (t.cursos || []).includes(id)).map(t => ({ type: 'trilha', id: t.id, titulo: t.titulo }));
    }
    if (selectedNode.type === 'modulo') {
      const rels = (cursoModulosRel || []).filter(r => r.moduloId === id);
      const cursoIds = rels.length ? Array.from(new Set(rels.map(r => r.cursoId))) : (cursos || []).filter(c => (c.moduloIds || []).includes(id)).map(c => c.id);
      return (cursos || []).filter(c => cursoIds.includes(c.id)).map(c => ({ type: 'curso', id: c.id, titulo: c.titulo }));
    }
    if (selectedNode.type === 'aula') {
      const rels = (moduloAulasRel || []).filter(r => r.aulaId === id);
      const moduloIds = rels.length ? Array.from(new Set(rels.map(r => r.moduloId))) : (aulas || []).find(a => a.id === id)?.moduloId ? [(aulas || []).find(a => a.id === id)?.moduloId] : [];
      return (modulos || []).filter(m => moduloIds.includes(m.id)).map(m => ({ type: 'modulo', id: m.id, titulo: m.titulo }));
    }
    return [];
  }, [selectedNode, trilhas, cursos, modulos, aulas, cursoModulosRel, moduloAulasRel]);

  const handleNew = useCallback(async (type) => {
    try {
      setError(null);
      let created;
      if (type === 'trilha') {
        created = await addTrilha({
          titulo: 'Nova trilha',
          descricao: '',
          cursos: [],
          ativo: true,
          ordem: 999,
          statusPublicacao: 'draft',
          releaseAt: null,
        });
      } else if (type === 'curso') {
        created = await addCurso({
          titulo: 'Novo treinamento',
          descricao: '',
          categoriaId: 'sem-categoria',
          duracaoMinutos: 30,
          metaPorcentagem: 100,
          obrigatorio: false,
          ativo: true,
          statusPublicacao: 'draft',
          releaseAt: null,
          moduloIds: [],
        });
      } else if (type === 'modulo') {
        created = await addModulo({
          titulo: 'Novo módulo',
          descricao: '',
          tipo: 'conteudo',
          cursoId: null,
          ativo: true,
        });
      } else if (type === 'aula') {
        created = await addAula({
          titulo: 'Nova aula',
          descricao: '',
          cursoId: null,
          moduloId: null,
          ativo: true,
          duracao: 10,
          blocks: [{ id: crypto?.randomUUID?.() || `b_${Date.now()}`, type: 'text', data: { html: '<p></p>' } }],
        });
      }
      if (created?.id) {
        selectNode({ type, id: created.id });
      }
    } catch (e) {
      setError(e?.message || 'Erro ao criar item');
    }
  }, [addTrilha, addCurso, addModulo, addAula, selectNode]);

  const handleSave = useCallback(async () => {
    if (!selectedNode?.id || !selectedNode?.type || !editorState) return;
    setIsSaving(true);
    setError(null);
    try {
      const { type, id } = selectedNode;
      if (type === 'trilha') {
        await updateTrilha(id, {
          titulo: editorState.titulo || '',
          descricao: editorState.descricao || '',
          ativo: editorState.ativo !== false,
          cursos: editorState.cursos || [],
        });
      } else if (type === 'curso') {
        await updateCurso(id, {
          titulo: editorState.titulo || '',
          descricao: editorState.descricao || '',
          ativo: editorState.ativo !== false,
          statusPublicacao: editorState.statusPublicacao || 'draft',
          releaseAt: editorState.releaseAt || null,
          duracaoMinutos: Number(editorState.duracaoMinutos || 0) || 0,
          metaPorcentagem: Number(editorState.metaPorcentagem || 100) || 100,
          obrigatorio: !!editorState.obrigatorio,
        });
      } else if (type === 'modulo') {
        await updateModulo(id, {
          titulo: editorState.titulo || '',
          descricao: editorState.descricao || '',
          ativo: editorState.ativo !== false,
          tipo: editorState.tipo || 'conteudo',
        });
      } else if (type === 'aula') {
        await updateAula(id, {
          titulo: editorState.titulo || '',
          descricao: editorState.descricao || '',
          ativo: editorState.ativo !== false,
          duracao: Number(editorState.duracao || 0) || 0,
          blocks: Array.isArray(editorState.blocks) ? editorState.blocks : [],
        });
      }
      setIsDirty(false);
    } catch (e) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  }, [selectedNode, editorState, updateTrilha, updateCurso, updateModulo, updateAula]);

  const updateField = (field, value) => {
    setEditorState((prev) => ({ ...(prev || {}), [field]: value }));
    setIsDirty(true);
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>

          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Gestão de Conteúdo
          </h1>

          <div className="min-w-[160px] flex justify-end gap-2">
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>Novo</Button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem onClick={() => handleNew('trilha')}>Nova trilha</DropdownItem>
                <DropdownItem onClick={() => handleNew('curso')}>Novo treinamento</DropdownItem>
                <DropdownItem onClick={() => handleNew('modulo')}>Novo módulo</DropdownItem>
                <DropdownItem onClick={() => handleNew('aula')}>Nova aula</DropdownItem>
              </DropdownContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate?.('relatoriosEducacao')}
              title="Relatórios"
            >
              <BarChart3 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );

  const EditorIcon = selectedNode?.type ? (NODE_ICON[selectedNode.type] || BookOpen) : BookOpen;

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-6 py-4">
        {/* Sistema de Abas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="estrutura" className="flex items-center gap-2">
              <ListTree className="w-4 h-4" />
              Estrutura
            </TabsTrigger>
            <TabsTrigger value="criar" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Criar Conteúdo
            </TabsTrigger>
          </TabsList>

          {/* Aba Estrutura - Layout 3 painéis INALTERADO */}
          <TabsContent value="estrutura">
            <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_320px] gap-4">
              {/* Navigator */}
              <Card className="p-4 h-[calc(100vh-200px)] overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold">Estrutura</p>
                  <Badge variant="secondary" badgeStyle="subtle">
                    {(trilhas || []).length} trilhas
                  </Badge>
                </div>
                <Input
                  variant="search"
                  placeholder="Buscar trilha, curso, módulo, aula…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="mt-3 h-[calc(100%-64px)] overflow-y-auto pr-1">
                  {filteredNavigatorTree.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Nenhum item encontrado.
                    </div>
                  ) : (
                    <NavigatorList
                      nodes={filteredNavigatorTree}
                      selectedNode={selectedNode}
                      onSelect={selectNode}
                    />
                  )}
                </div>
              </Card>

              {/* Editor */}
              <Card className="p-4 h-[calc(100vh-200px)] overflow-y-auto">
                {!selectedNode || !selectedEntity ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="max-w-[360px]">
                      <p className="text-sm font-semibold text-foreground">Selecione um item</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Use a árvore ao lado para editar trilhas, treinamentos, módulos e aulas.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <EditorIcon className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-semibold truncate">
                            {NODE_LABEL[selectedNode.type]}: {selectedEntity.titulo || '—'}
                          </p>
                          {isDirty && <Badge variant="warning" badgeStyle="subtle">Não salvo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: <span className="font-mono">{selectedNode.id}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        {isSaving ? 'Salvando…' : 'Salvar'}
                      </Button>
                    </div>

                    {error && (
                      <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}

                    <FormField label="Título" required>
                      <Input value={editorState?.titulo || ''} onChange={(e) => updateField('titulo', e.target.value)} />
                    </FormField>

                    <FormField label="Descrição">
                      <Textarea value={editorState?.descricao || ''} onChange={(v) => updateField('descricao', v)} rows={3} />
                    </FormField>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={editorState?.ativo !== false}
                        onChange={() => updateField('ativo', editorState?.ativo === false)}
                        label="Ativo"
                        compact
                      />
                      {selectedNode.type === 'curso' && (
                        <Checkbox
                          checked={!!editorState?.obrigatorio}
                          onChange={() => updateField('obrigatorio', !editorState?.obrigatorio)}
                          label="Obrigatório"
                          compact
                        />
                      )}
                    </div>

                    {selectedNode.type === 'curso' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Duração (min)">
                          <Input
                            type="number"
                            value={String(editorState?.duracaoMinutos ?? '')}
                            onChange={(e) => updateField('duracaoMinutos', e.target.value)}
                          />
                        </FormField>
                        <FormField label="Publicação">
                          <Select
                            value={editorState?.statusPublicacao || 'draft'}
                            onChange={(v) => updateField('statusPublicacao', v)}
                            options={[
                              { value: 'draft', label: 'Rascunho' },
                              { value: 'published', label: 'Publicado' },
                              { value: 'scheduled', label: 'Agendado' },
                            ]}
                          />
                        </FormField>
                      </div>
                    )}

                    {selectedNode.type === 'aula' && (
                      <>
                        <FormField label="Duração (min)">
                          <Input
                            type="number"
                            value={String(editorState?.duracao ?? '')}
                            onChange={(e) => updateField('duracao', e.target.value)}
                          />
                        </FormField>

                        <BlockEditor
                          blocks={editorState?.blocks || []}
                          onChange={(blocks) => updateField('blocks', blocks)}
                        />

                        <div className="pt-2 border-t border-border">
                          <p className="text-sm font-medium mb-2">Preview</p>
                          <BlockRenderer blocks={editorState?.blocks || []} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>

              {/* Sidebar */}
              <Card className="p-4 h-[calc(100vh-200px)] overflow-y-auto">
                <p className="text-sm font-semibold mb-3">Detalhes</p>
                {!selectedNode || !selectedEntity ? (
                  <p className="text-sm text-muted-foreground">Selecione um item para ver detalhes.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" badgeStyle="subtle">{NODE_LABEL[selectedNode.type]}</Badge>
                      {selectedEntity.ativo === false && (
                        <Badge variant="secondary" badgeStyle="subtle">Inativo</Badge>
                      )}
                      {selectedEntity.statusPublicacao && (
                        <Badge variant="info" badgeStyle="subtle">{selectedEntity.statusPublicacao}</Badge>
                      )}
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Atualizado</p>
                      <p className="font-medium">{formatDateTime(selectedEntity.updatedAt)}</p>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Criado</p>
                      <p className="font-medium">{formatDateTime(selectedEntity.createdAt)}</p>
                    </div>

                    {selectedEntity.releaseAt && (
                      <div className="text-sm">
                        <p className="text-muted-foreground text-xs">Release</p>
                        <p className="font-medium">{formatDateTime(selectedEntity.releaseAt)}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border">
                      <p className="text-sm font-semibold mb-2">Onde é usado</p>
                      {links.length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <div className="space-y-2">
                          {links.map((l) => (
                            <button
                              key={`${l.type}-${l.id}`}
                              className={cn(
                                "w-full text-left p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                              )}
                              onClick={() => selectNode({ type: l.type, id: l.id })}
                            >
                              <p className="text-sm font-medium">{l.titulo}</p>
                              <p className="text-xs text-muted-foreground">{NODE_LABEL[l.type]}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Aba Criar Conteúdo - Fluxo Cascata */}
          <TabsContent value="criar">
            <CascadeCreator onNavigate={onNavigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function NavigatorList({ nodes, selectedNode, onSelect, level = 0 }) {
  return (
    <div className="space-y-1">
      {nodes.map((n) => {
        const Icon = NODE_ICON[n.type] || BookOpen;
        const isSelected = selectedNode?.type === n.type && selectedNode?.id === n.id;
        return (
          <div key={`${n.type}-${n.id}`}>
            <button
              type="button"
              onClick={() => onSelect?.(n)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left border transition-colors",
                isSelected ? "bg-primary/10 border-primary" : "bg-card border-border hover:bg-muted"
              )}
              style={{ marginLeft: level * 12 }}
            >
              <Icon className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{n.titulo || '—'}</p>
                <p className="text-[11px] text-muted-foreground">{NODE_LABEL[n.type]}</p>
              </div>
              {n.ativo === false && (
                <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">Inativo</Badge>
              )}
            </button>

            {Array.isArray(n.children) && n.children.length > 0 && (
              <NavigatorList
                nodes={n.children}
                selectedNode={selectedNode}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
