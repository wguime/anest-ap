/**
 * AdminConteudoPage.jsx
 * Gestão de conteúdo educacional (rebuild)
 * Layout 3 painéis: Navigator (árvore) | Editor | Sidebar (status/links)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import {
  ChevronLeft,
  BarChart3,
  Plus,
  Filter,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Save,
  Trash2,
  RefreshCw,
  AlertCircle,
  Upload,
  Loader2,
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
  DropdownSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ConfirmDialog,
  useToast,
  Tooltip,
  VideoPlayer,
  SearchBar,
} from '@/design-system';
import { ListTree, Sparkles, ClipboardList } from 'lucide-react';

import { useEducacaoData } from '../hooks/useEducacaoData';
import { ReorderableList } from './components/ReorderableList';
import { CascadeCreator } from './components/CascadeCreator';
import { TreeNavigator, useTreeExpansion } from './components/TreeNavigator';
import { TreeBreadcrumb } from './components/TreeBreadcrumb';
import { SyncStatusPanel } from './components/SyncStatusPanel';
import { PublishButton } from './components/PublishButton';
import { publishEntity, unpublishEntity } from '@/services/educacaoService';
import { QuizFormModal } from './QuizFormModal';
import { cn } from '@/design-system/utils/tokens';
import { HtmlContentViewer } from '../components/AulaPlayer';

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

function RichTextSimple({ value, onChange }) {
  const ref = useRef(null);

  const sync = useCallback(() => {
    const next = ref.current?.innerHTML ?? '';
    onChange?.(next);
  }, [onChange]);

  const apply = (command) => {
    try {
      document.execCommand(command, false, null);
      // Após aplicar formatação, sincronizar o HTML atual.
      sync();
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
        ref={ref}
        className="p-3 min-h-[120px] prose prose-sm dark:prose-invert max-w-none focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value || '') }}
      />
    </div>
  );
}

function BlockRenderer({ blocks }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  if (safeBlocks.length === 0) return null;

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = String(url).match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const extractVimeoId = (url) => {
    if (!url) return null;
    const patterns = [/vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/];
    for (const pattern of patterns) {
      const match = String(url).match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {safeBlocks.map((b) => {
        if (!b?.type) return null;
        if (b.type === 'text') {
          return (
            <div
              key={b.id}
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(b?.data?.html || '') }}
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
          const pendingUpload = !!b?.data?.pendingUpload;
          const fileName = b?.data?.fileName || '';
          const fileType = (b?.data?.fileType || '').toLowerCase();
          const isPdf =
            fileType === 'application/pdf' ||
            String(url).toLowerCase().includes('.pdf') ||
            String(fileName).toLowerCase().endsWith('.pdf');
          const isHtml =
            fileType === 'text/html' ||
            /\.html?(?:[?#]|$)/i.test(String(url)) ||
            /\.html?(?:[?#]|$)/i.test(String(fileName));
          return (
            <Card key={b.id} className="p-3">
              <p className="text-sm font-medium">Arquivo</p>
              {pendingUpload && !url ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Upload pendente{fileName ? `: ${fileName}` : ''}.
                </p>
              ) : isPdf && url ? (
                <div className="mt-2 space-y-2">
                  <iframe
                    title={fileName || 'PDF'}
                    src={url}
                    className="w-full h-[360px] rounded-lg border border-border"
                  />
                </div>
              ) : isHtml && url ? (
                <div className="mt-2 space-y-2">
                  <HtmlContentViewer src={url} title={fileName || 'HTML'} height="360px" />
                </div>
              ) : url ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Documento configurado (sem preview inline para este tipo).
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Sem URL configurada.
                </p>
              )}
            </Card>
          );
        }

        if (b.type === 'youtube') {
          const url = b?.data?.url || '';
          const id = extractYouTubeId(url);
          return (
            <Card key={b.id} className="p-3 space-y-2">
              <p className="text-sm font-medium">YouTube</p>
              {!url ? (
                <p className="text-sm text-muted-foreground">Sem URL configurada.</p>
              ) : !id ? (
                <a className="text-sm text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              ) : (
                <VideoPlayer type="youtube" videoId={id} title="Preview YouTube" />
              )}
            </Card>
          );
        }

        if (b.type === 'vimeo') {
          const url = b?.data?.url || '';
          const id = extractVimeoId(url);
          return (
            <Card key={b.id} className="p-3 space-y-2">
              <p className="text-sm font-medium">Vimeo</p>
              {!url ? (
                <p className="text-sm text-muted-foreground">Sem URL configurada.</p>
              ) : !id ? (
                <a className="text-sm text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              ) : (
                <VideoPlayer type="vimeo" videoId={id} title="Preview Vimeo" />
              )}
            </Card>
          );
        }

        if (b.type === 'video') {
          const url = b?.data?.url || '';
          const pendingUpload = !!b?.data?.pendingUpload;
          const fileName = b?.data?.fileName || '';
          return (
            <Card key={b.id} className="p-3 space-y-2">
              <p className="text-sm font-medium">Vídeo</p>
              {pendingUpload && !url ? (
                <p className="text-sm text-muted-foreground">Upload pendente{fileName ? `: ${fileName}` : ''}.</p>
              ) : url ? (
                <video className="w-full rounded-lg bg-black" controls src={url} />
              ) : (
                <p className="text-sm text-muted-foreground">Sem URL configurada.</p>
              )}
            </Card>
          );
        }

        if (b.type === 'audio') {
          const url = b?.data?.url || '';
          const pendingUpload = !!b?.data?.pendingUpload;
          const fileName = b?.data?.fileName || '';
          return (
            <Card key={b.id} className="p-3 space-y-2">
              <p className="text-sm font-medium">Áudio</p>
              {pendingUpload && !url ? (
                <p className="text-sm text-muted-foreground">Upload pendente{fileName ? `: ${fileName}` : ''}.</p>
              ) : url ? (
                <audio className="w-full" controls src={url} />
              ) : (
                <p className="text-sm text-muted-foreground">Sem URL configurada.</p>
              )}
            </Card>
          );
        }

        if (b.type === 'link') {
          const linkUrl = b?.data?.url || '';
          const linkTitle = b?.data?.title || linkUrl || 'Link';
          return (
            <Card key={b.id} className="p-3 space-y-2">
              <p className="text-sm font-medium">Link Externo</p>
              {linkUrl ? (
                <a
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  href={linkUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {linkTitle}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Sem URL configurada.</p>
              )}
            </Card>
          );
        }

        // Fallback (tipos desconhecidos): exibimos como link se houver URL
        const url = b?.data?.url || '';
        return (
          <Card key={b.id} className="p-3">
            <p className="text-sm font-medium">{b.type}</p>
            <p className="text-sm text-muted-foreground">
              {url ? 'Conteúdo configurado.' : 'Sem URL configurada.'}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

function BlockEditor({ blocks, onChange, aulaId }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const [uploadingBlockId, setUploadingBlockId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const setBlocks = (next) => {
    onChange?.(next);
  };

  /** Upload a file for a pending block (document/video/audio) */
  const handleBlockFileUpload = async (blockId, file, blockType) => {
    if (!file || !aulaId) return;
    setUploadingBlockId(blockId);
    setUploadProgress(0);
    try {
      const { uploadFile, validateFile, ACCEPTED_DOCUMENT_TYPES, ACCEPTED_VIDEO_TYPES, ACCEPTED_AUDIO_TYPES } = await import('@/services/uploadService');
      const validationType = blockType === 'document' ? 'document' : blockType === 'audio' ? 'audio' : 'video';
      const validation = validateFile(file, validationType);
      if (!validation.valid) throw new Error(validation.errors.join('. '));

      const pathPrefix = blockType === 'document' ? 'educacao/documents' : blockType === 'audio' ? 'educacao/audios' : 'educacao/videos';
      const result = await uploadFile(file, `${pathPrefix}/${aulaId}`, (p) => setUploadProgress(p));

      // Update block: set url, clear pendingUpload
      setBlocks(safeBlocks.map(b =>
        b.id === blockId
          ? { ...b, data: { ...b.data, url: result.url, pendingUpload: false, fileName: file.name, fileSize: file.size, fileType: file.type } }
          : b
      ));
      toast({ title: 'Upload concluido', variant: 'success' });
    } catch (err) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingBlockId(null);
      setUploadProgress(0);
    }
  };

  const addBlock = (type) => {
    const id = crypto?.randomUUID?.() || `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const base = { id, type, data: {} };
    if (type === 'text') base.data = { html: '<p></p>' };
    if (type === 'heading') base.data = { text: '' };
    if (type === 'callout') base.data = { text: '' };
    if (type === 'document') base.data = { url: '', mimeType: '' };
    if (['youtube', 'vimeo', 'video', 'audio'].includes(type)) base.data = { url: '' };
    if (type === 'link') base.data = { url: '', title: '' };
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
            <DropdownItem onClick={() => addBlock('link')}>Link Externo</DropdownItem>
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
                <Tooltip content="Remover bloco">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeBlock(b.id)} aria-label="Remover bloco">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Tooltip>
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

              {['youtube', 'vimeo'].includes(b.type) && (
                <Input
                  value={b?.data?.url || ''}
                  onChange={(e) => updateBlock(b.id, { data: { url: e.target.value } })}
                  placeholder="URL da mídia…"
                />
              )}

              {['video', 'audio', 'document'].includes(b.type) && (
                <div className="space-y-2">
                  <Input
                    value={b?.data?.url || ''}
                    onChange={(e) => updateBlock(b.id, { data: { url: e.target.value } })}
                    placeholder={b.type === 'document' ? 'URL do arquivo…' : 'URL da mídia…'}
                  />
                  {uploadingBlockId === b.id ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando… {uploadProgress}%</span>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground cursor-pointer hover:bg-muted transition-colors">
                      <Upload className="w-4 h-4" />
                      {b?.data?.pendingUpload && !b?.data?.url ? 'Enviar arquivo pendente' : 'Enviar arquivo'}
                      <input
                        type="file"
                        className="hidden"
                        accept={b.type === 'document' ? '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.htm' : b.type === 'audio' ? 'audio/*' : 'video/*'}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleBlockFileUpload(b.id, file, b.type);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {b.type === 'link' && (
                <div className="space-y-2">
                  <Input
                    value={b?.data?.url || ''}
                    onChange={(e) => updateBlock(b.id, { data: { url: e.target.value } })}
                    placeholder="URL do link (https://...)"
                  />
                  <Input
                    value={b?.data?.title || ''}
                    onChange={(e) => updateBlock(b.id, { data: { title: e.target.value } })}
                    placeholder="Título do link (opcional)"
                  />
                </div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

/**
 * getCascadeImpact - Calcula itens filhos que serão excluídos (exclusivos) ou preservados (compartilhados)
 */
function getCascadeImpact(node, { trilhaCursosRel, cursoModulosRel, moduloAulasRel, cursos, modulos, aulas }) {
  const exclusive = [];
  const shared = [];

  if (!node?.type || !node?.id) return { exclusive, shared };

  if (node.type === 'trilha') {
    const linkedCursoIds = (trilhaCursosRel || []).filter(r => r.trilhaId === node.id).map(r => r.cursoId);
    for (const cursoId of linkedCursoIds) {
      const otherParents = (trilhaCursosRel || []).filter(r => r.cursoId === cursoId && r.trilhaId !== node.id);
      const curso = (cursos || []).find(c => c.id === cursoId);
      if (!curso) continue;
      if (otherParents.length === 0) {
        exclusive.push({ type: 'curso', id: curso.id, titulo: curso.titulo });
        // Cascade: módulos exclusivos deste curso
        const linkedModuloIds = (cursoModulosRel || []).filter(r => r.cursoId === cursoId).map(r => r.moduloId);
        for (const moduloId of linkedModuloIds) {
          const otherCursoParents = (cursoModulosRel || []).filter(r => r.moduloId === moduloId && r.cursoId !== cursoId);
          const modulo = (modulos || []).find(m => m.id === moduloId);
          if (!modulo) continue;
          if (otherCursoParents.length === 0) {
            exclusive.push({ type: 'modulo', id: modulo.id, titulo: modulo.titulo });
            // Cascade: aulas exclusivas deste módulo
            const linkedAulaIds = (moduloAulasRel || []).filter(r => r.moduloId === moduloId).map(r => r.aulaId);
            for (const aulaId of linkedAulaIds) {
              const otherModuloParents = (moduloAulasRel || []).filter(r => r.aulaId === aulaId && r.moduloId !== moduloId);
              const aula = (aulas || []).find(a => a.id === aulaId);
              if (!aula) continue;
              if (otherModuloParents.length === 0) {
                exclusive.push({ type: 'aula', id: aula.id, titulo: aula.titulo });
              } else {
                shared.push({ type: 'aula', id: aula.id, titulo: aula.titulo, parentCount: otherModuloParents.length });
              }
            }
          } else {
            shared.push({ type: 'modulo', id: modulo.id, titulo: modulo.titulo, parentCount: otherCursoParents.length });
          }
        }
      } else {
        shared.push({ type: 'curso', id: curso.id, titulo: curso.titulo, parentCount: otherParents.length });
      }
    }
  } else if (node.type === 'curso') {
    const linkedModuloIds = (cursoModulosRel || []).filter(r => r.cursoId === node.id).map(r => r.moduloId);
    for (const moduloId of linkedModuloIds) {
      const otherParents = (cursoModulosRel || []).filter(r => r.moduloId === moduloId && r.cursoId !== node.id);
      const modulo = (modulos || []).find(m => m.id === moduloId);
      if (!modulo) continue;
      if (otherParents.length === 0) {
        exclusive.push({ type: 'modulo', id: modulo.id, titulo: modulo.titulo });
        // Cascade: aulas exclusivas deste módulo
        const linkedAulaIds = (moduloAulasRel || []).filter(r => r.moduloId === moduloId).map(r => r.aulaId);
        for (const aulaId of linkedAulaIds) {
          const otherModuloParents = (moduloAulasRel || []).filter(r => r.aulaId === aulaId && r.moduloId !== moduloId);
          const aula = (aulas || []).find(a => a.id === aulaId);
          if (!aula) continue;
          if (otherModuloParents.length === 0) {
            exclusive.push({ type: 'aula', id: aula.id, titulo: aula.titulo });
          } else {
            shared.push({ type: 'aula', id: aula.id, titulo: aula.titulo, parentCount: otherModuloParents.length });
          }
        }
      } else {
        shared.push({ type: 'modulo', id: modulo.id, titulo: modulo.titulo, parentCount: otherParents.length });
      }
    }
  } else if (node.type === 'modulo') {
    const linkedAulaIds = (moduloAulasRel || []).filter(r => r.moduloId === node.id).map(r => r.aulaId);
    for (const aulaId of linkedAulaIds) {
      const otherParents = (moduloAulasRel || []).filter(r => r.aulaId === aulaId && r.moduloId !== node.id);
      const aula = (aulas || []).find(a => a.id === aulaId);
      if (!aula) continue;
      if (otherParents.length === 0) {
        exclusive.push({ type: 'aula', id: aula.id, titulo: aula.titulo });
      } else {
        shared.push({ type: 'aula', id: aula.id, titulo: aula.titulo, parentCount: otherParents.length });
      }
    }
  }

  return { exclusive, shared };
}

/**
 * AdminConteudoPage - Dashboard principal de gestão de conteúdo
 */
export default function AdminConteudoPage({ onNavigate, goBack }) {
  const { toast } = useToast();
  // Hook de dados
  const {
    trilhas,
    cursos,
    modulos,
    aulas,
    contentTree: _contentTree,
    stats: _stats,
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
    reorderCursosInTrilha: _reorderCursosInTrilha,
    reorderModulosInCurso: _reorderModulosInCurso,
    reorderAulasInModulo: _reorderAulasInModulo,
    getModulosByCursoId: _getModulosByCursoId,
    cursoModulosRel,
    moduloAulasRel,
    trilhaCursosRel,
    linkModuloToCurso: _linkModuloToCurso,
    unlinkModuloFromCurso: _unlinkModuloFromCurso,
    linkAulaToModulo: _linkAulaToModulo,
    unlinkAulaFromModulo: _unlinkAulaFromModulo,
    fetchAll: _fetchAll,
    forceRefreshFromFirestore,
  } = useEducacaoData();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | trilha | curso | modulo | aula
  const [selectedNode, setSelectedNode] = useState(null); // { type, id }
  const [editorState, setEditorState] = useState(null); // form buffer do item selecionado
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('estrutura');
  const [quizModalCursoId, setQuizModalCursoId] = useState(null);

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
    const treeBase = Array.isArray(trilhas) ? trilhas : [];
    const cursosById = new Map((cursos || []).map(c => [c.id, c]));
    const modulosById = new Map((modulos || []).map(m => [m.id, m]));
    const aulasById = new Map((aulas || []).map(a => [a.id, a]));

    const result = treeBase.map((t) => {
      // Prefer junction table, fallback to embedded array
      const tcRels = (trilhaCursosRel || [])
        .filter(r => r.trilhaId === t.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const cursoIds = tcRels.length
        ? tcRels.map(r => r.cursoId)
        : (t.cursos || []);
      const childrenCursos = cursoIds
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

    // Seção "Sem vínculo" — itens órfãos (ativos, sem pai)
    const orphanCursos = (cursos || []).filter(c => {
      if (c.ativo === false) return false;
      return !(trilhaCursosRel || []).some(r => r.cursoId === c.id);
    });
    const orphanModulos = (modulos || []).filter(m => {
      if (m.ativo === false) return false;
      return !(cursoModulosRel || []).some(r => r.moduloId === m.id);
    });
    const orphanAulas = (aulas || []).filter(a => {
      if (a.ativo === false) return false;
      return !(moduloAulasRel || []).some(r => r.aulaId === a.id);
    });

    if (orphanCursos.length || orphanModulos.length || orphanAulas.length) {
      result.push({
        type: 'orphans',
        id: '__orphans__',
        titulo: `Sem vínculo (${orphanCursos.length + orphanModulos.length + orphanAulas.length})`,
        ativo: true,
        icon: AlertCircle,
        children: [
          ...orphanCursos.map(c => ({ type: 'curso', id: c.id, titulo: c.titulo, ativo: true, children: [] })),
          ...orphanModulos.map(m => ({ type: 'modulo', id: m.id, titulo: m.titulo, ativo: true, children: [] })),
          ...orphanAulas.map(a => ({ type: 'aula', id: a.id, titulo: a.titulo, ativo: true, children: [] })),
        ],
      });
    }

    return result;
  }, [trilhas, cursos, modulos, aulas, trilhaCursosRel, cursoModulosRel, moduloAulasRel]);

  const filteredNavigatorTree = useMemo(() => {
    const q = safeLower(search).trim();
    const base = (() => {
      if (!q) return navigatorTree;
      const filterNode = (node) => {
        const match = safeLower(node.titulo).includes(q) || safeLower(NODE_LABEL[node.type]).includes(q);
        const children = (node.children || []).map(filterNode).filter(Boolean);
        if (match || children.length) return { ...node, children };
        return null;
      };
      return navigatorTree.map(filterNode).filter(Boolean);
    })();

    if (!typeFilter || typeFilter === 'all') return base;

    const filterByType = (node) => {
      const children = (node.children || []).map(filterByType).filter(Boolean);
      const match = node.type === typeFilter;
      if (match || children.length) return { ...node, children };
      return null;
    };

    return base.map(filterByType).filter(Boolean);
  }, [navigatorTree, search, typeFilter]);

  const treeExpansion = useTreeExpansion(filteredNavigatorTree);

  useEffect(() => {
    // Ao buscar, expande tudo para facilitar encontrar resultados em níveis profundos.
    if (safeLower(search).trim()) {
      treeExpansion.expandAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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

  const _handleNew = useCallback(async (type) => {
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
      toast({ variant: 'error', title: 'Erro ao criar item', description: e?.message });
    }
  }, [addTrilha, addCurso, addModulo, addAula, selectNode, toast]);

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
      toast({ variant: 'success', title: 'Salvo com sucesso' });
    } catch (e) {
      setError(e?.message || 'Erro ao salvar');
      toast({ variant: 'error', title: 'Erro ao salvar', description: e?.message });
    } finally {
      setIsSaving(false);
    }
  }, [selectedNode, editorState, updateTrilha, updateCurso, updateModulo, updateAula, toast]);

  const handlePublish = useCallback(async ({ cascade }) => {
    if (!selectedNode?.id || !selectedNode?.type) return;
    const result = await publishEntity(selectedNode.type, selectedNode.id, { cascade });
    if (result.success) {
      await forceRefreshFromFirestore?.();
      setEditorState(prev => prev ? { ...prev, statusPublicacao: 'published' } : prev);
      setIsDirty(false);
    }
    return result;
  }, [selectedNode, forceRefreshFromFirestore]);

  const handleUnpublish = useCallback(async () => {
    if (!selectedNode?.id || !selectedNode?.type) return;
    const result = await unpublishEntity(selectedNode.type, selectedNode.id);
    if (result.success) {
      await forceRefreshFromFirestore?.();
      setEditorState(prev => prev ? { ...prev, statusPublicacao: 'draft' } : prev);
      setIsDirty(false);
    }
    return result;
  }, [selectedNode, forceRefreshFromFirestore]);

  const updateField = (field, value) => {
    setEditorState((prev) => ({ ...(prev || {}), [field]: value }));
    setIsDirty(true);
  };

  // Debounced version for text inputs to reduce re-renders on every keystroke.
  const debounceTimers = useRef({});
  const updateFieldDebounced = useCallback((field, value) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }
    debounceTimers.current[field] = setTimeout(() => {
      setEditorState((prev) => ({ ...(prev || {}), [field]: value }));
      setIsDirty(true);
      delete debounceTimers.current[field];
    }, 300);
  }, []);

  const cascadeImpact = useMemo(() => {
    if (!selectedNode?.id || !selectedNode?.type) return { exclusive: [], shared: [] };
    return getCascadeImpact(selectedNode, { trilhaCursosRel, cursoModulosRel, moduloAulasRel, cursos, modulos, aulas });
  }, [selectedNode, trilhaCursosRel, cursoModulosRel, moduloAulasRel, cursos, modulos, aulas]);

  const handleCascadeDelete = useCallback(async () => {
    if (!selectedNode?.id || !selectedNode?.type) return;
    setIsDeleting(true);
    try {
      const { type, id } = selectedNode;
      // Deleta o item principal
      if (type === 'trilha') await deleteTrilha(id);
      else if (type === 'curso') await deleteCurso(id);
      else if (type === 'modulo') await deleteModulo(id);
      else if (type === 'aula') await deleteAula(id);

      // Cascade: deletar itens exclusivos
      for (const item of cascadeImpact.exclusive) {
        try {
          if (item.type === 'curso') await deleteCurso(item.id);
          else if (item.type === 'modulo') await deleteModulo(item.id);
          else if (item.type === 'aula') await deleteAula(item.id);
        } catch (e) {
          console.error(`[cascade] Falhou ao excluir ${item.type} ${item.id}:`, e);
        }
      }

      setSelectedNode(null);
      setEditorState(null);
      setIsDirty(false);
      toast({ variant: 'success', title: 'Excluído com sucesso' });
    } catch (e) {
      setError(e?.message || 'Erro ao excluir');
      toast({ variant: 'error', title: 'Erro ao excluir', description: e?.message });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [selectedNode, cascadeImpact, deleteTrilha, deleteCurso, deleteModulo, deleteAula, toast]);

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px]"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>

          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Gestão de Conteúdo
          </h1>

          <div className="min-w-[70px]"></div>
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
          <TabsList className="mb-4 w-full overflow-x-auto">
            <TabsTrigger value="estrutura" className="flex items-center gap-2 whitespace-nowrap">
              <ListTree className="w-4 h-4" />
              Estrutura
            </TabsTrigger>
            <TabsTrigger value="criar" className="flex items-center gap-2 whitespace-nowrap">
              <Sparkles className="w-4 h-4" />
              Criar Conteúdo
            </TabsTrigger>
          </TabsList>

          {/* Aba Estrutura - Layout 3 painéis INALTERADO */}
          <TabsContent value="estrutura">
            <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px] gap-3 lg:gap-4">
              {/* Navigator */}
              <Card className="p-3 sm:p-4 lg:h-[calc(100vh-200px)] lg:overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold">Estrutura</p>
                  <Badge variant="secondary" badgeStyle="subtle">
                    {(trilhas || []).length} trilhas
                  </Badge>
                </div>

                <TreeBreadcrumb items={navigatorTree} selectedNode={selectedNode} onSelect={selectNode} />

                <div className="flex flex-col gap-1.5">
                  <SearchBar
                    placeholder="Buscar trilha, curso, módulo, aula…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-0"
                  />

                  <div className="grid grid-cols-4 gap-1">
                    <DropdownMenu>
                      <DropdownTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-full text-xs px-1"
                          leftIcon={<Filter className="w-3.5 h-3.5" />}
                          title="Filtrar por tipo"
                        >
                          {typeFilter === 'all' ? 'Filtro' : (NODE_LABEL[typeFilter] || 'Filtro')}
                        </Button>
                      </DropdownTrigger>
                      <DropdownContent align="start">
                        <DropdownItem onClick={() => setTypeFilter('all')}>Todos</DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem onClick={() => setTypeFilter('trilha')}>Trilhas</DropdownItem>
                        <DropdownItem onClick={() => setTypeFilter('curso')}>Treinamentos</DropdownItem>
                        <DropdownItem onClick={() => setTypeFilter('modulo')}>Módulos</DropdownItem>
                        <DropdownItem onClick={() => setTypeFilter('aula')}>Aulas</DropdownItem>
                      </DropdownContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs px-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        treeExpansion.expandAll();
                      }}
                    >
                      Expandir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs px-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        treeExpansion.collapseAll();
                      }}
                    >
                      Colapsar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs px-1"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (forceRefreshFromFirestore) {
                          await forceRefreshFromFirestore();
                        }
                      }}
                      title="Atualizar dados do Firestore"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Atualizar
                    </Button>
                  </div>
                </div>

                <div className="mt-2 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                  {filteredNavigatorTree.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">Nenhum item encontrado.</div>
                  ) : (
                    <TreeNavigator
                      key={`tree-${treeExpansion.version || 0}`}
                      items={filteredNavigatorTree}
                      selectedNode={selectedNode}
                      onSelect={selectNode}
                      expansion={treeExpansion}
                    />
                  )}
                </div>
              </Card>

              {/* Editor */}
              <Card className="p-3 sm:p-4 lg:h-[calc(100vh-200px)] lg:overflow-y-auto">
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
                  <div className="space-y-4 lg:space-y-5">
                    {/* Header do editor: info + ações */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EditorIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-semibold break-words">
                          {NODE_LABEL[selectedNode.type]}: {selectedEntity.titulo || '—'}
                        </p>
                        {isDirty && <Badge variant="warning" badgeStyle="subtle">Não salvo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground break-all select-all">
                        ID: <span className="font-mono">{selectedNode.id}</span>
                      </p>
                      <div className="flex items-center gap-2 flex-wrap sticky bottom-0 z-10 bg-card py-3 -mx-3 px-3 sm:-mx-4 sm:px-4 border-t border-border/50 mt-0 [&>*]:flex-1 [&>*]:sm:flex-initial">
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={!isDirty || isSaving}
                          leftIcon={<Save className="w-4 h-4" />}
                        >
                          {isSaving ? 'Salvando…' : 'Salvar'}
                        </Button>
                        <PublishButton
                          entity={editorState}
                          entityType={selectedNode?.type}
                          onPublish={handlePublish}
                          onUnpublish={handleUnpublish}
                          context={{}}
                          disabled={isDirty}
                          size="sm"
                        />
                        <Tooltip content="Excluir item e dependências exclusivas">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            leftIcon={<Trash2 className="w-4 h-4" />}
                            aria-label="Excluir"
                          >
                            Excluir
                          </Button>
                        </Tooltip>
                      </div>
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}

                    <FormField label="Título" required>
                      <Input
                        key={`titulo-${selectedNode.id}`}
                        defaultValue={editorState?.titulo || ''}
                        onChange={(e) => updateFieldDebounced('titulo', e.target.value)}
                        onBlur={(e) => updateField('titulo', e.target.value)}
                      />
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
                      <FormField label="Duração (min)">
                        <Input
                          type="number"
                          value={String(editorState?.duracaoMinutos ?? '')}
                          onChange={(e) => updateField('duracaoMinutos', e.target.value)}
                        />
                      </FormField>
                    )}

                    {selectedNode.type === 'curso' && (
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!!editorState?.avaliacaoObrigatoria}
                          onChange={() => updateField('avaliacaoObrigatoria', !editorState?.avaliacaoObrigatoria)}
                          label="Avaliação obrigatória"
                          compact
                        />
                      </div>
                    )}

                    {selectedNode.type === 'curso' && editorState?.avaliacaoObrigatoria && (
                      <FormField label="Nota mínima (%)">
                        <Input
                          type="number"
                          value={String(editorState?.notaMinimaAprovacao ?? '70')}
                          onChange={(e) => updateField('notaMinimaAprovacao', e.target.value)}
                          min={1}
                          max={100}
                        />
                      </FormField>
                    )}

                    {selectedNode.type === 'curso' && (
                      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-primary" />
                            <span className="text-sm font-semibold text-foreground">Quiz do Curso</span>
                          </div>
                          <Badge variant="secondary" badgeStyle="subtle">
                            {editorState?.avaliacaoObrigatoria ? 'obrigatório' : 'opcional'}
                          </Badge>
                        </div>
                        {editorState?.avaliacaoObrigatoria && (
                          <p className="text-xs text-muted-foreground">
                            Nota mínima: {editorState?.notaMinimaAprovacao || 70}%
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => setQuizModalCursoId(selectedNode.id)}
                        >
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Gerenciar Perguntas
                        </Button>
                      </div>
                    )}

                    {selectedNode.type === 'curso' && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Tipo Crédito">
                          <Select
                            value={editorState?.tipoCreditoEducacao || 'geral'}
                            onChange={(v) => updateField('tipoCreditoEducacao', v)}
                            options={[
                              { value: 'geral', label: 'Geral' },
                              { value: 'CME', label: 'CME' },
                              { value: 'enfermagem', label: 'Enfermagem' },
                              { value: 'tecnico', label: 'Técnico' },
                            ]}
                          />
                        </FormField>
                        <FormField label="Créditos (h)">
                          <Input
                            type="number"
                            value={String(editorState?.creditosHoras ?? '')}
                            onChange={(e) => updateField('creditosHoras', e.target.value)}
                            step="0.5"
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
                          aulaId={selectedNode?.id}
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
              <div className="space-y-4 xl:h-[calc(100vh-200px)] xl:overflow-y-auto hidden lg:block">
                {/* Painel de Status de Sincronização */}
                <SyncStatusPanel
                  trilhas={trilhas}
                  cursos={cursos}
                  modulos={modulos}
                  aulas={aulas}
                  onSyncComplete={forceRefreshFromFirestore}
                />

                {/* Detalhes do Item Selecionado */}
                <Card className="p-3 sm:p-4">
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
                                "w-full text-left p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors min-h-[44px]"
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
            </div>
          </TabsContent>

          {/* Aba Criar Conteúdo - Fluxo Cascata */}
          <TabsContent value="criar">
            <CascadeCreator
              onNavigate={onNavigate}
              onComplete={async (entities) => {
                // Atualizar dados do Firestore
                if (forceRefreshFromFirestore) {
                  await forceRefreshFromFirestore();
                }
                // Mudar para aba Estrutura
                setActiveTab('estrutura');
                // Se criou aula, selecionar ela na árvore
                if (entities?.aula?.id) {
                  setSelectedNode({ type: 'aula', id: entities.aula.id });
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Excluir ${NODE_LABEL[selectedNode?.type] || 'item'}?`}
        description={`"${editorState?.titulo || ''}" será desativado permanentemente.`}
        confirmText={`Excluir${cascadeImpact.exclusive.length > 0 ? ` (${cascadeImpact.exclusive.length + 1} itens)` : ''}`}
        cancelText="Cancelar"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleCascadeDelete}
      >
        {cascadeImpact.exclusive.length > 0 && (
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-destructive">
              Também serão excluídos:
            </p>
            {cascadeImpact.exclusive.map(item => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" badgeStyle="subtle">{NODE_LABEL[item.type]}</Badge>
                <span className="truncate">{item.titulo}</span>
              </div>
            ))}
          </div>
        )}
        {cascadeImpact.shared.length > 0 && (
          <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-2 mt-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Permanecerão em outras trilhas/cursos:
            </p>
            {cascadeImpact.shared.map(item => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" badgeStyle="subtle">{NODE_LABEL[item.type]}</Badge>
                <span className="truncate">{item.titulo}</span>
              </div>
            ))}
          </div>
        )}
      </ConfirmDialog>

      {/* Quiz Form Modal */}
      <QuizFormModal
        open={!!quizModalCursoId}
        onClose={() => setQuizModalCursoId(null)}
        cursoId={quizModalCursoId}
        cursoTitulo={(cursos || []).find(c => c.id === quizModalCursoId)?.titulo}
      />
    </div>
  );
}
