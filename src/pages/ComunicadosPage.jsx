import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useEventAlerts } from '../contexts/EventAlertsContext';
import { useMessages } from '../contexts/MessagesContext';
import { notifyComunicadoPublicado } from '@/services/notificationService';
import { useComunicados } from '../contexts/ComunicadosContext';
import { uploadFile } from '../services/uploadService';
import { useUsersManagement } from '../contexts/UsersManagementContext';
import { tiposComunicado, formatCardDate, formatFullDate, formatRelativeDate, formatEventDate, getFileIcon, ROLES_DESTINATARIOS, ROP_AREAS, STATUS_COMUNICADO, isPrazoVencido, isExpirado, calcularTotalDestinatarios } from '@/utils/comunicadosHelpers';
import { Card, CardContent, Badge, Button, Input, Tabs, TabsList, TabsTrigger, Avatar, PDFViewer, EmptyState, Switch, Checkbox, Checklist, Progress, Select, DatePicker, SearchToggleButton, SearchBar, Collapsible, CollapsibleContent, BorderBeam } from '@/design-system';
import { PageHeader } from '@/components';
import { cn } from '@/design-system/utils/tokens';
import { useToast } from '@/design-system';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Search, Plus, X, Calendar, Link as LinkIcon, Paperclip, FileText, Image, Table, File, ExternalLink, Archive, ArchiveRestore, Edit, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Upload, AlertCircle, Maximize2, Minimize2, Megaphone, Users, CheckCircle, ClipboardList, Clock, ShieldCheck, Presentation, MailOpen } from 'lucide-react';

// Componente do ícone de arquivo
function FileIcon({ type, className }) {
  const icons = {
    FileText: FileText,
    Image: Image,
    Table: Table,
    Presentation: Presentation,
    File: File,
  };
  const Icon = icons[type] || File;
  return <Icon className={className} />;
}

// Helper para identificar tipo de anexo
const getAnexoType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
};

// Componente wrapper para imagem com pinch-to-zoom e botão de expandir
function ZoomableImage({ src, alt, onExpand }) {
  return (
    <div className="relative group">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full max-h-[400px] object-contain"
        style={{ aspectRatio: 'auto' }}
        draggable={false}
      />
      {onExpand && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand({ src, alt });
          }}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-70 hover:opacity-100 transition-opacity z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          title="Expandir imagem"
          aria-label="Expandir imagem"
        >
          <Maximize2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// Modal fullscreen para imagem expandida
function ExpandedImageModal({ image, onClose }) {
  if (!image) return null;

  const modalContent = (
    <div className="fixed inset-0 z-overlay bg-black">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-50 bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass-surface hover:opacity-90 text-white transition-colors border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Minimize2 className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar imagem expandida"
          className="p-2.5 rounded-full glass-surface hover:opacity-90 text-white transition-colors border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        centerOnInit
        limitToBounds
        wheel={{ step: 0.2 }}
        pinch={{ disabled: false }}
        doubleClick={{ mode: 'reset' }}
        velocityAnimation={{ disabled: true }}
        alignmentAnimation={{ disabled: false }}
        zoomAnimation={{ animationTime: 100, animationType: 'easeOut' }}
      >
        <TransformComponent
          wrapperStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          contentStyle={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 16px 16px',
          }}
        >
          <img
            src={image.src}
            alt={image.alt}
            decoding="async"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </TransformComponent>
      </TransformWrapper>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full glass-surface text-white/90 text-xs">
        Pinça para zoom • Toque duplo para resetar
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Swipe-back detail view — fullscreen slide-in from right like iOS Mail
function ComunicadoDetailView({ comunicado, onClose, onNext, onPrev, hasNext, hasPrev, children }) {
  const x = useMotionValue(0);
  const overlayOpacity = useTransform(x, [0, 300], [0.5, 0]);
  const isDragging = useRef(false);
  const EDGE_ZONE = 30;
  const DISMISS_THRESHOLD = 0.35;

  const handleDragStart = useCallback((_, info) => {
    if (info.point.x <= EDGE_ZONE) {
      isDragging.current = true;
    }
  }, []);

  const handleDrag = useCallback((_, info) => {
    if (!isDragging.current && info.point.x > EDGE_ZONE) {
      x.set(0);
    }
  }, [x]);

  const handleDragEnd = useCallback((_, info) => {
    isDragging.current = false;
    const threshold = window.innerWidth * DISMISS_THRESHOLD;
    if (info.offset.x > threshold || info.velocity.x > 500) {
      animate(x, window.innerWidth, { type: 'spring', damping: 30, stiffness: 300 });
      setTimeout(onClose, 200);
    } else {
      animate(x, 0, { type: 'spring', damping: 30, stiffness: 300 });
    }
  }, [x, onClose]);

  return createPortal(
    <>
      {/* Overlay — opacity driven by drag motion value */}
      <motion.div
        key="detail-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ opacity: overlayOpacity }}
        className="fixed inset-0 z-modal bg-black"
        onClick={onClose}
      />
      <motion.div
        key="detail-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        style={{ x }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.6 }}
        dragDirectionLock
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="fixed inset-0 z-modal bg-background flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — DS pattern */}
        <nav
          className="flex-shrink-0 bg-card border-b border-border shadow-sm"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="px-4 sm:px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-[70px]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium">Voltar</span>
                </button>
              </div>
              <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
                Comunicado
              </h1>
              <div className="min-w-[70px] flex items-center justify-end">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    hasPrev ? "text-primary hover:bg-primary/10" : "text-muted-foreground/30"
                  )}
                  aria-label="Comunicado anterior"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    hasNext ? "text-primary hover:bg-primary/10" : "text-muted-foreground/30"
                  )}
                  aria-label="Próximo comunicado"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </motion.div>
    </>,
    document.body
  );
}

export default function ComunicadosPage({ onNavigate, params }) {
  const { user } = useUser();
  const { scheduleEventAlerts } = useEventAlerts();
  const { createSystemNotification } = useMessages();
  const { toast } = useToast();
  const {
    comunicados,
    _publicados,
    loading: _contextLoading,
    enableAdminMode,
    confirmLeitura: contextConfirmLeitura,
    completarAcao: contextCompletarAcao,
    desfazerAcao: contextDesfazerAcao,
    addComunicado: contextAddComunicado,
    updateComunicado: contextUpdateComunicado,
    deleteComunicado: contextDeleteComunicado,
    approveComunicado: contextApproveComunicado,
    publishComunicado: contextPublishComunicado,
    archiveComunicado: contextArchiveComunicado,
    isRead,
  } = useComunicados();
  const { users: contextUsers } = useUsersManagement();
  const roleKey = (user?.role || '').toLowerCase();
  const isAdmin = !!(user?.isAdmin || user?.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador');
  // Anestesiologistas podem enviar comunicados (sem ter permissoes de admin).
  const canSendComunicado = isAdmin || roleKey === 'anestesiologista';

  // Admin mode: load all comunicados (any status)
  useEffect(() => {
    if (isAdmin) enableAdminMode();
  }, [isAdmin, enableAdminMode]);

  const [activeTab, setActiveTab] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedComunicado, setSelectedComunicado] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingComunicado, setEditingComunicado] = useState(null);

  // Estado do formulário (com campos Qmentum)
  const [formData, setFormData] = useState({
    tipo: 'Geral',
    titulo: '',
    conteudo: '',
    link: '',
    dataEvento: '',
    anexos: [],
    destinatarios: [],
    leituraObrigatoria: false,
    ropArea: 'geral',
    ropRelacionada: [],
    acoesRequeridas: [],
    prazoConfirmacao: '',
    dataValidade: '',
  });
  const [arquivosSelecionados, setArquivosSelecionados] = useState([]);
  const [todosProfissionais, setTodosProfissionais] = useState(true);

  // Estado para imagem expandida
  const [expandedImage, setExpandedImage] = useState(null);

  // Auto-abrir comunicado vindo de notificação (reage ao load do context)
  useEffect(() => {
    if (!params?.comunicadoId || !comunicados?.length) return;
    if (selectedComunicado?.id === params.comunicadoId) return;
    const target = comunicados.find((c) => c.id === params.comunicadoId);
    if (target) {
      abrirComunicado(target);
    }
  }, [params?.comunicadoId, comunicados]);

  // Sync selectedComunicado com estado atualizado
  useEffect(() => {
    if (selectedComunicado) {
      const updated = comunicados.find((c) => c.id === selectedComunicado.id);
      if (updated && updated !== selectedComunicado) {
        setSelectedComunicado(updated);
      }
    }
  }, [comunicados]);

  // Helper: user já confirmou leitura
  const userConfirmou = (comunicado) => {
    return comunicado.confirmacoes?.some((c) => c.userId === user?.id);
  };

  // Helper: ROP info
  const getRopInfo = (ropKey) => ROP_AREAS.find((r) => r.key === ropKey) || ROP_AREAS[0];

  // Helper: label de role
  const getRoleLabel = (roleKey) => {
    const role = ROLES_DESTINATARIOS.find((r) => r.key === roleKey);
    return role?.label || roleKey;
  };

  // Filtrar comunicados
  const filteredComunicados = comunicados
    .filter((c) => {
      // Feature 5: Não-admins só veem publicados
      if (!isAdmin && c.status !== 'publicado') return false;

      // Feature 1: Filtro por destinatários (não-admin)
      if (!isAdmin && c.destinatarios?.length > 0) {
        const userRoleKey = (user?.role || '').toLowerCase();
        if (!c.destinatarios.includes(userRoleKey)) return false;
      }

      // Feature 7: Expirados vão para arquivados
      const expirado = isExpirado(c);

      // Filtro por tab
      if (activeTab === 'nao-lidos') {
        if (c.arquivado || expirado) return false;
        if (c.leituraObrigatoria && !userConfirmou(c)) return true;
        return !isRead(c, user?.id);
      }
      if (activeTab === 'arquivados') return c.arquivado || expirado;
      if (activeTab === 'todos') {
        if (c.arquivado) return false;
        if (expirado) return false;
      }

      // Filtro por busca
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          c.titulo.toLowerCase().includes(query) ||
          c.conteudo.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Contadores
  const totalComunicados = comunicados.filter((c) => {
    if (!isAdmin && c.status !== 'publicado') return false;
    if (!isAdmin && c.destinatarios?.length > 0) {
      const userRoleKey = (user?.role || '').toLowerCase();
      if (!c.destinatarios.includes(userRoleKey)) return false;
    }
    return !c.arquivado && !isExpirado(c);
  }).length;

  const naoLidos = comunicados.filter((c) => {
    if (!isAdmin && c.status !== 'publicado') return false;
    if (!isAdmin && c.destinatarios?.length > 0) {
      const userRoleKey = (user?.role || '').toLowerCase();
      if (!c.destinatarios.includes(userRoleKey)) return false;
    }
    if (c.arquivado || isExpirado(c)) return false;
    if (c.leituraObrigatoria && !userConfirmou(c)) return true;
    return !isRead(c, user?.id);
  }).length;

  // Ações — all persist via context → Supabase
  const arquivarComunicado = async (id, arquivar = true) => {
    try {
      if (arquivar) {
        await contextArchiveComunicado(id);
      } else {
        await contextUpdateComunicado(id, { arquivado: false });
      }
    } catch (err) {
      console.error('Failed to archive/unarchive:', err);
    }
  };

  const confirmarLeitura = async (id) => {
    const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    await contextConfirmLeitura(id, user?.id, userName);
    toast({ title: 'Leitura confirmada' });
  };

  const completarAcao = async (comunicadoId, acaoId) => {
    const acoesCompletadas = comunicados.find((c) => c.id === comunicadoId)?.acoesCompletadas || [];
    const jaCompletou = acoesCompletadas.some(
      (a) => a.acaoId === acaoId && a.userId === user?.id
    );
    const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    try {
      if (jaCompletou) {
        await contextDesfazerAcao(comunicadoId, acaoId, user?.id);
      } else {
        await contextCompletarAcao(comunicadoId, acaoId, user?.id, userName);
      }
    } catch (err) {
      console.error('Failed to toggle acao:', err);
    }
  };

  // Abrir comunicado — auto-confirm read for non-mandatory ones
  const abrirComunicado = async (comunicado) => {
    setSelectedComunicado(comunicado);
    if (!comunicado.leituraObrigatoria && !isRead(comunicado, user?.id)) {
      try {
        const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        await contextConfirmLeitura(comunicado.id, user?.id, userName);
      } catch (err) {
        console.error('Failed to auto-confirm:', err);
      }
    }
  };

  // Admin: Abrir modal de edição
  const abrirEdicao = (comunicado = null) => {
    if (comunicado) {
      setEditingComunicado(comunicado);
      const hasDest = comunicado.destinatarios?.length > 0;
      setTodosProfissionais(!hasDest);
      setFormData({
        tipo: comunicado.tipo,
        titulo: comunicado.titulo,
        conteudo: comunicado.conteudo,
        link: comunicado.link || '',
        dataEvento: comunicado.dataEvento || '',
        anexos: comunicado.anexos || [],
        destinatarios: comunicado.destinatarios || [],
        leituraObrigatoria: comunicado.leituraObrigatoria || false,
        ropArea: comunicado.ropArea || 'geral',
        ropRelacionada: comunicado.ropRelacionada || [],
        acoesRequeridas: comunicado.acoesRequeridas || [],
        prazoConfirmacao: comunicado.prazoConfirmacao || '',
        dataValidade: comunicado.dataValidade || '',
      });
    } else {
      setEditingComunicado(null);
      setTodosProfissionais(true);
      setFormData({
        tipo: 'Geral',
        titulo: '',
        conteudo: '',
        link: '',
        dataEvento: '',
        anexos: [],
        destinatarios: [],
        leituraObrigatoria: false,
        ropArea: 'geral',
        ropRelacionada: [],
        acoesRequeridas: [],
        prazoConfirmacao: '',
        dataValidade: '',
      });
    }
    setArquivosSelecionados([]);
    setIsEditing(true);
  };

  // Admin: Salvar comunicado — persists via context → Supabase
  const salvarComunicado = async (asDraft = false) => {
    if (!formData.titulo.trim() || !formData.conteudo.trim()) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (formData.tipo === 'Evento' && !formData.dataEvento) {
      toast({ title: 'Informe a data do evento', variant: 'destructive' });
      return;
    }

    const status = asDraft ? 'rascunho' : 'publicado';

    try {
      // Upload files to Firebase Storage and get permanent URLs
      const novosAnexos = await Promise.all(
        arquivosSelecionados.map(async (file) => {
          try {
            const result = await uploadFile(file, 'Comunicados');
            return {
              nome: file.name,
              url: result.url,
              path: result.path,
              tamanho: file.size,
              tipo: file.type,
            };
          } catch (uploadErr) {
            console.error(`Erro ao enviar ${file.name}:`, uploadErr);
            toast({ title: `Erro ao enviar "${file.name}"`, variant: 'destructive' });
            return null;
          }
        })
      );
      const anexosValidos = novosAnexos.filter(Boolean);
      if (editingComunicado) {
        const updates = {
          ...formData,
          destinatarios: todosProfissionais ? [] : formData.destinatarios,
          anexos: [...formData.anexos, ...anexosValidos],
          status,
        };
        if (!asDraft && canSendComunicado) {
          updates.aprovadoPor = {
            userId: user?.id,
            userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            approvedAt: new Date().toISOString(),
          };
        }
        await contextUpdateComunicado(editingComunicado.id, updates);
      } else {
        const comunicadoData = {
          ...formData,
          destinatarios: todosProfissionais ? [] : formData.destinatarios,
          anexos: anexosValidos,
          status,
        };
        const userInfo = {
          userId: user?.id,
          userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        };
        const result = await contextAddComunicado(comunicadoData, userInfo);

        if (!asDraft) {
          const destinatariosSelecionados = formData.destinatarios || [];
          let recipientIds = [];
          if (contextUsers.length > 0) {
            if (todosProfissionais || destinatariosSelecionados.length === 0) {
              recipientIds = contextUsers.map(u => u.id).filter(Boolean);
            } else {
              recipientIds = contextUsers
                .filter(u => destinatariosSelecionados.includes(u.role))
                .map(u => u.id)
                .filter(Boolean);
            }
          }

          if (recipientIds.length === 0) {
            console.warn('[ComunicadosPage] notificação do comunicado não enviada: lista de destinatários vazia', {
              comunicadoId: result?.id,
              todosProfissionais,
              destinatariosSelecionados,
              contextUsersLoaded: contextUsers.length,
            });
          } else {
            notifyComunicadoPublicado(createSystemNotification, {
              titulo: formData.titulo,
              tipo: formData.tipo,
              recipientIds,
              comunicadoId: result?.id,
            });
          }

          if (formData.tipo === 'Evento' && formData.dataEvento && result?.id) {
            scheduleEventAlerts(result.id, formData.titulo, formData.dataEvento);
          }
        }
      }
      setArquivosSelecionados([]);
      toast({ title: editingComunicado ? 'Comunicado atualizado' : (asDraft ? 'Rascunho salvo' : 'Comunicado publicado') });
    } catch (err) {
      console.error('Failed to save comunicado:', err);
    }

    setIsEditing(false);
    setEditingComunicado(null);
  };

  // Feature 5: Aprovar e publicar rascunho — persists via context → Supabase
  const aprovarEPublicar = async (id) => {
    const comunicado = comunicados.find(c => c.id === id);
    const userInfo = {
      userId: user?.id,
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    };

    try {
      await contextApproveComunicado(id, userInfo);
      await contextPublishComunicado(id);
    } catch (err) {
      console.error('Failed to approve/publish:', err);
      return;
    }

    // Notify the author that their comunicado was approved
    if (comunicado?.autorId && comunicado.autorId !== user?.id) {
      createSystemNotification({
        category: 'comunicado',
        subject: `Comunicado aprovado: ${comunicado.titulo}`,
        content: `Seu comunicado "${comunicado.titulo}" foi aprovado e publicado por ${userInfo.userName}`,
        senderName: userInfo.userName || 'Administrador',
        priority: 'normal',
        actionUrl: 'comunicados',
        actionLabel: 'Ver Comunicado',
        actionParams: { comunicadoId: id },
        recipientId: comunicado.autorId,
      });
    }

    // Notify target recipients based on roles
    const destinatarios = comunicado?.destinatarios || [];
    let recipientIds = [];
    if (contextUsers.length > 0) {
      if (destinatarios.length > 0) {
        recipientIds = contextUsers
          .filter(u => destinatarios.includes(u.role))
          .map(u => u.id)
          .filter(Boolean);
      } else {
        recipientIds = contextUsers.map(u => u.id).filter(Boolean);
      }
    }

    if (recipientIds.length === 0) {
      console.warn('[ComunicadosPage] notificação de aprovação não enviada: lista de destinatários vazia', {
        comunicadoId: id,
        destinatarios,
        contextUsersLoaded: contextUsers.length,
      });
    } else {
      notifyComunicadoPublicado(createSystemNotification, {
        titulo: comunicado.titulo,
        tipo: comunicado.tipo,
        recipientIds,
        comunicadoId: id,
      });
    }
  };

  // Admin: Excluir comunicado — persists via context → Supabase
  const excluirComunicado = async (id) => {
    if (confirm('Tem certeza que deseja excluir este comunicado?')) {
      try {
        await contextDeleteComunicado(id);
        setSelectedComunicado(null);
      } catch (err) {
        console.error('Failed to delete comunicado:', err);
      }
    }
  };

  const header = (
    <PageHeader
      title="Comunicados"
      onBack={() => onNavigate('home')}
      actions={
        <div className="flex items-center gap-2">
          <SearchToggleButton
            active={searchOpen}
            onClick={() => setSearchOpen((o) => { if (o) setSearchQuery(''); return !o; })}
          />
          {canSendComunicado && (
            <Button
              size="sm"
              variant="default"
              className="h-7 min-h-0 px-2.5 text-xs"
              onClick={() => abrirEdicao()}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Novo
            </Button>
          )}
        </div>
      }
    />
  );

  // Upload de arquivos
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 20 * 1024 * 1024;

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        toast({ title: `Arquivo "${file.name}" muito grande (máx 20MB)`, variant: 'destructive' });
        return false;
      }
      return true;
    });

    setArquivosSelecionados((prev) => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removerArquivo = (index) => {
    setArquivosSelecionados((prev) => prev.filter((_, i) => i !== index));
  };

  const removerAnexoExistente = (index) => {
    setFormData((prev) => ({
      ...prev,
      anexos: prev.anexos.filter((_, i) => i !== index),
    }));
  };

  // Feature 4: Gerenciar ações requeridas
  const adicionarAcao = () => {
    setFormData((prev) => ({
      ...prev,
      acoesRequeridas: [
        ...prev.acoesRequeridas,
        { id: `acao-${Date.now()}`, texto: '' },
      ],
    }));
  };

  const atualizarAcao = (index, texto) => {
    setFormData((prev) => ({
      ...prev,
      acoesRequeridas: prev.acoesRequeridas.map((a, i) =>
        i === index ? { ...a, texto } : a
      ),
    }));
  };

  const removerAcao = (index) => {
    setFormData((prev) => ({
      ...prev,
      acoesRequeridas: prev.acoesRequeridas.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="min-h-dvh bg-background pb-28">
      {header}

      <div className="px-4 sm:px-5 pt-2">
        {/* Search (toggle via lupa no header — padrão de listagens) */}
        <Collapsible open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) setSearchQuery(''); }}>
          <CollapsibleContent>
            <div className="mb-3">
              <SearchBar
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar comunicados..."
                autoFocus
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline" className="mb-4">
            <TabsList className="w-full">
              <TabsTrigger value="todos" className="flex-1 justify-center" badge={totalComunicados}>
                Todos
              </TabsTrigger>
              <TabsTrigger value="nao-lidos" className="flex-1 justify-center" badge={naoLidos > 0 ? naoLidos : undefined}>
                Não lidos
              </TabsTrigger>
              <TabsTrigger value="arquivados" className="flex-1 justify-center">
                Arquivados
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Lista iOS Mail */}
        <div className="mb-20">
          <AnimatePresence mode="wait">
            {filteredComunicados.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <EmptyState
                  size="sm"
                  icon={
                    searchQuery ? (
                      <Search className="h-full w-full text-muted-foreground" />
                    ) : activeTab === 'arquivados' ? (
                      <Archive className="h-full w-full text-muted-foreground" />
                    ) : (
                      <Megaphone className="h-full w-full text-muted-foreground" />
                    )
                  }
                  title={
                    searchQuery
                      ? 'Nenhum resultado encontrado'
                      : activeTab === 'nao-lidos'
                        ? 'Tudo em dia!'
                        : activeTab === 'arquivados'
                          ? 'Nenhum comunicado arquivado'
                          : 'Nenhum comunicado ainda'
                  }
                  description={
                    searchQuery
                      ? 'Tente buscar com outros termos'
                      : activeTab === 'nao-lidos'
                        ? 'Você leu todos os comunicados'
                        : undefined
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "rounded-2xl overflow-hidden bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
                  !searchQuery && "ds-stagger-in"
                )}
              >
                {filteredComunicados.map((comunicado, index) => {
                  const expirado = isExpirado(comunicado);
                  const prazoVencido = isPrazoVencido(comunicado);
                  const confirmado = userConfirmou(comunicado);
                  const needsConfirmation = comunicado.leituraObrigatoria && !confirmado;
                  const isUnread = !isRead(comunicado, user?.id) || needsConfirmation;
                  const isUrgente = comunicado.tipo === 'Urgente' && !expirado;
                  const initials = comunicado.autorNome
                    .split(' ')
                    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();

                  return (
                    <div key={comunicado.id}>
                      {index > 0 && (
                        <div className="ml-[72px] border-t border-border/50" />
                      )}
                      <div
                        onClick={() => abrirComunicado(comunicado)}
                        className={cn(
                          "relative flex items-start gap-[10px] pr-4 py-[11px] cursor-pointer transition-colors",
                          "hover:bg-primary/5 dark:hover:bg-primary/10",
                          "active:bg-primary/10",
                          "focus-visible:outline-none focus-visible:bg-primary/5",
                          isUnread ? "pl-[6px]" : "pl-[18px]",
                          expirado && "opacity-60",
                          isUrgente && "overflow-hidden rounded-xl"
                        )}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            abrirComunicado(comunicado);
                          }
                        }}
                      >
                        {isUrgente && <BorderBeam duration={6} borderWidth={2} />}
                        {isUnread && (
                          <span className="shrink-0 self-center w-[10px] h-[10px] rounded-full bg-info dark:shadow-[0_0_6px_hsl(var(--info))]" aria-label="Não lido" />
                        )}

                        <Avatar size="md" initials={initials} className="shrink-0" />

                        <div className="flex-1 min-w-0">
                          {/* Row 1: título (bold) + timestamp + chevron */}
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={cn(
                              "text-[15px] truncate text-foreground flex-1 leading-tight",
                              isUnread ? "font-bold" : "font-semibold"
                            )}>
                              {comunicado.titulo}
                            </p>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <span className="text-[13px] text-muted-foreground">
                                {formatRelativeDate(comunicado.createdAt)}
                              </span>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                            </div>
                          </div>

                          {/* Row 2: sender + badges */}
                          <div className="flex items-center gap-1.5 mt-[1px]">
                            <span className={cn(
                              "text-[13px] truncate text-muted-foreground flex-1",
                              isUnread && "text-foreground/70"
                            )}>
                              {comunicado.autorNome}
                            </span>
                            {comunicado.tipo !== 'Geral' && (
                              <Badge
                                variant={{
                                  Urgente: 'destructive',
                                  Importante: 'warning',
                                  Informativo: 'info',
                                  Evento: 'secondary',
                                }[comunicado.tipo] || 'default'}
                                badgeStyle="subtle"
                                className="shrink-0 text-[10px] px-1.5 py-0.5"
                              >
                                {comunicado.tipo}
                              </Badge>
                            )}
                            {isAdmin && comunicado.status === 'rascunho' && (
                              <Badge variant="default" badgeStyle="outline" className="shrink-0 text-[10px] px-1.5 py-0.5">
                                Rascunho
                              </Badge>
                            )}
                            {comunicado.leituraObrigatoria && (
                              confirmado ? (
                                <CheckCircle className="w-3.5 h-3.5 shrink-0 text-success" />
                              ) : (
                                <AlertCircle className={cn("w-3.5 h-3.5 shrink-0", prazoVencido ? "text-destructive" : "text-warning")} />
                              )
                            )}
                          </div>

                          {/* Row 3-4: preview */}
                          <div className="flex items-start gap-2 mt-[2px]">
                            <p className="text-[13px] text-muted-foreground leading-snug flex-1"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {comunicado.conteudo}
                            </p>
                            {comunicado.anexos?.length > 0 && (
                              <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50 mt-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Detail View — iOS Mail fullscreen slide-in */}
      {selectedComunicado && (() => {
        const tipoBadgeVariant = {
          'Urgente': 'destructive',
          'Importante': 'warning',
          'Informativo': 'info',
          'Evento': 'secondary',
          'Geral': 'default',
        }[selectedComunicado.tipo] || 'default';
        const initials = selectedComunicado.autorNome
          .split(' ')
          .filter((_, i, arr) => i === 0 || i === arr.length - 1)
          .map((n) => n[0])
          .join('')
          .toUpperCase();

        const ropInfo = getRopInfo(selectedComunicado.ropArea);
        const expirado = isExpirado(selectedComunicado);
        const prazoVencido = isPrazoVencido(selectedComunicado);
        const confirmado = userConfirmou(selectedComunicado);

        const totalEsperado = calcularTotalDestinatarios(selectedComunicado, contextUsers);
        const confirmados = selectedComunicado.confirmacoes?.length || 0;
        const porcentagem = totalEsperado > 0 ? Math.round((confirmados / totalEsperado) * 100) : 0;

        const currentIdx = filteredComunicados.findIndex(c => c.id === selectedComunicado.id);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < filteredComunicados.length - 1;
        const goToPrev = () => { if (hasPrev) abrirComunicado(filteredComunicados[currentIdx - 1]); };
        const goToNext = () => { if (hasNext) abrirComunicado(filteredComunicados[currentIdx + 1]); };

        return (
          <ComunicadoDetailView
            comunicado={selectedComunicado}
            onClose={() => setSelectedComunicado(null)}
            onPrev={goToPrev}
            onNext={goToNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
          >
            <div className="px-4 sm:px-5 pb-28">
              {/* Subject — iOS Mail: first element, prominent */}
              <div className="pt-4 pb-2">
                <div className="flex items-start gap-2 mb-1">
                  <h2 className="text-xl font-bold text-foreground leading-tight flex-1">
                    {selectedComunicado.titulo}
                  </h2>
                  <Badge
                    variant={tipoBadgeVariant}
                    badgeStyle="subtle"
                    className="text-[10px] px-2 py-0.5 shrink-0 mt-1"
                  >
                    {selectedComunicado.tipo}
                  </Badge>
                </div>

                {/* ROP Category — subtle tag below subject */}
                {selectedComunicado.ropArea && selectedComunicado.ropArea !== 'geral' && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {ropInfo.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Sender row — avatar + name + date */}
              <div className="flex items-center gap-3 py-3 border-t border-border">
                <Avatar size="md" initials={initials} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-[15px] truncate">
                    {selectedComunicado.autorNome}
                  </p>
                  {selectedComunicado.destinatarios?.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      <span className="text-[13px] text-muted-foreground">para</span>
                      {selectedComunicado.destinatarios.slice(0, 3).map((role) => (
                        <span key={role} className="text-[13px] text-muted-foreground">
                          {getRoleLabel(role)}{selectedComunicado.destinatarios.indexOf(role) < Math.min(selectedComunicado.destinatarios.length, 3) - 1 ? ',' : ''}
                        </span>
                      ))}
                      {selectedComunicado.destinatarios.length > 3 && (
                        <span className="text-[13px] text-muted-foreground">
                          +{selectedComunicado.destinatarios.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">para todos</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] text-muted-foreground">
                    {formatRelativeDate(selectedComunicado.createdAt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    {formatFullDate(selectedComunicado.createdAt)}
                  </p>
                </div>
              </div>

              {/* Body — iOS Mail: plain text, no card wrapping */}
              <div className="py-4 border-t border-border">
                <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-line">
                  {selectedComunicado.conteudo}
                </p>
              </div>

              {/* Metadata & actions section */}
              <div className="space-y-3 pt-1">

              {/* Confirmação de Leitura */}
              {selectedComunicado.leituraObrigatoria && (
                <Card
                  variant="default"
                  className={cn("border-2", confirmado
                    ? 'bg-success/10 border-success'
                    : prazoVencido
                      ? 'bg-destructive/10 border-destructive'
                      : 'bg-warning/10 border-warning'
                  )}
                >
                  <CardContent className="p-4">
                    {confirmado ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-success shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-success">
                            Leitura confirmada
                          </p>
                          <p className="text-xs text-success">
                            {formatFullDate(
                              selectedComunicado.confirmacoes.find((c) => c.userId === user?.id)?.confirmedAt
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className={cn("w-5 h-5 shrink-0", prazoVencido ? 'text-destructive' : 'text-warning')} />
                          <p className={cn("text-sm font-semibold", prazoVencido ? 'text-destructive' : 'text-warning')}>
                            Confirmação de leitura obrigatória
                          </p>
                        </div>
                        {selectedComunicado.prazoConfirmacao && (
                          <p className={cn("text-xs mb-3", prazoVencido ? 'text-destructive font-semibold' : 'text-warning')}>
                            <Clock className="w-3 h-3 inline mr-1" />
                            Prazo: {formatFullDate(selectedComunicado.prazoConfirmacao)}
                            {prazoVencido && ' (vencido)'}
                          </p>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => confirmarLeitura(selectedComunicado.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Li e compreendi
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Confirmações list (admin) */}
              {isAdmin && selectedComunicado.leituraObrigatoria && selectedComunicado.confirmacoes?.length > 0 && (
                <Card variant="default" className="bg-card border border-border">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      Confirmações ({selectedComunicado.confirmacoes.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedComunicado.confirmacoes.map((conf, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium">{conf.userName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCardDate(conf.confirmedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Métricas (admin) */}
              {isAdmin && selectedComunicado.leituraObrigatoria && (
                <Card variant="default" className="bg-card border border-border">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Métricas de Conformidade
                    </h3>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{confirmados} de {totalEsperado} confirmaram</span>
                        <span className="font-bold">{porcentagem}%</span>
                      </div>
                      <Progress
                        value={porcentagem}
                        variant={porcentagem >= 80 ? 'success' : porcentagem >= 50 ? 'warning' : 'error'}
                        size="md"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ações Requeridas */}
              {selectedComunicado.acoesRequeridas?.length > 0 && (() => {
                const acoesCompletadas = selectedComunicado.acoesCompletadas || [];
                const totalDestinatarios = calcularTotalDestinatarios(selectedComunicado, contextUsers);
                return (
                  <Card variant="default" className="bg-card border border-border">
                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        Ações Requeridas ({selectedComunicado.acoesRequeridas.length})
                      </h3>
                      <Checklist
                        items={selectedComunicado.acoesRequeridas.map((a) => {
                          const completaramEsta = acoesCompletadas.filter((ac) => ac.acaoId === a.id);
                          const userCompletou = completaramEsta.some((ac) => ac.userId === user?.id);
                          return {
                            id: a.id,
                            label: isAdmin
                              ? `${a.texto} (${completaramEsta.length}/${totalDestinatarios})`
                              : a.texto,
                            checked: userCompletou,
                          };
                        })}
                        onToggle={(id) => completarAcao(selectedComunicado.id, id)}
                      />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Data do Evento */}
              {selectedComunicado.dataEvento && (
                <Card variant="default" className="bg-category-purple-bg border-2 border-category-purple">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-6 h-6 text-category-purple-fg" />
                      <div>
                        <p className="text-xs text-category-purple-fg font-semibold uppercase">
                          Data do Evento
                        </p>
                        <p className="text-lg font-bold text-category-purple-fg">
                          {formatEventDate(selectedComunicado.dataEvento)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Validade */}
              {selectedComunicado.dataValidade && (
                <Card
                  variant="default"
                  className={cn("border-2", expirado
                    ? 'bg-destructive/10 border-destructive'
                    : 'bg-info/10 border-info'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className={cn("w-5 h-5", expirado ? 'text-destructive' : 'text-info')} />
                      <div>
                        <p className={cn("text-xs font-semibold uppercase", expirado ? 'text-destructive' : 'text-info')}>
                          {expirado ? 'Expirado em' : 'Válido até'}
                        </p>
                        <p className={cn("text-sm font-bold", expirado ? 'text-destructive' : 'text-info')}>
                          {formatFullDate(selectedComunicado.dataValidade)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Link */}
              {selectedComunicado.link && (
                <Card variant="default" className="bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-foreground text-sm">Link</span>
                    </div>
                    <a
                      href={selectedComunicado.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all flex items-center gap-1 text-sm"
                    >
                      {selectedComunicado.link}
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Anexos — inline no corpo, sem caixa */}
              {selectedComunicado.anexos?.length > 0 &&
                selectedComunicado.anexos.map((anexo, index) => {
                  const tipo = getAnexoType(anexo.nome);
                  return (
                    <div key={index} className="-mx-4 sm:-mx-5">
                      {tipo === 'image' && anexo.url && anexo.url !== '#' && (
                        <ZoomableImage
                          src={anexo.url}
                          alt={anexo.nome}
                          onExpand={setExpandedImage}
                        />
                      )}

                      {tipo === 'pdf' && anexo.url && anexo.url !== '#' && (
                        <PDFViewer src={anexo.url} title={anexo.nome} height="calc(100vh - 200px)" showTitle={false} showToolbar={false} className="!border-0 !rounded-none !shadow-none" />
                      )}

                      {tipo === 'other' && anexo.url && anexo.url !== '#' && (
                        <iframe
                          src={`https://docs.google.com/gview?url=${encodeURIComponent(anexo.url)}&embedded=true`}
                          title={anexo.nome}
                          className="w-full"
                          style={{ height: '500px', border: 'none' }}
                          allow="fullscreen"
                        />
                      )}

                      {(!anexo.url || anexo.url === '#') && (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <FileIcon type={getFileIcon(anexo.nome)} className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground truncate">{anexo.nome}</span>
                          <span className="text-xs text-muted-foreground/60 ml-auto">indisponível</span>
                        </div>
                      )}
                    </div>
                  );
                })
              }

              {/* Aprovação (rascunho + admin) */}
              {isAdmin && selectedComunicado.status === 'rascunho' && (
                <Card variant="default" className="bg-warning/10 border-2 border-warning">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-5 h-5 text-warning" />
                      <p className="text-sm font-semibold text-warning">
                        Este comunicado é um rascunho
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      onClick={() => aprovarEPublicar(selectedComunicado.id)}
                    >
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Aprovar e Publicar
                    </Button>
                  </CardContent>
                </Card>
              )}
              </div>
            </div>

            {/* Bottom action toolbar — DS pattern */}
            <div
              className="fixed bottom-0 left-0 right-0 z-submodal bg-card border-t border-border shadow-sm"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <div className="flex items-center justify-around px-2 py-1">
                <button
                  type="button"
                  onClick={async () => {
                    await arquivarComunicado(selectedComunicado.id, !selectedComunicado.arquivado);
                    setSelectedComunicado(null);
                  }}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] text-primary hover:bg-primary/10 rounded-xl transition-colors"
                  aria-label={selectedComunicado.arquivado ? 'Desarquivar' : 'Arquivar'}
                >
                  {selectedComunicado.arquivado
                    ? <ArchiveRestore className="w-5 h-5" />
                    : <Archive className="w-5 h-5" />
                  }
                  <span className="text-[10px] font-medium">
                    {selectedComunicado.arquivado ? 'Restaurar' : 'Arquivar'}
                  </span>
                </button>

                {!isRead(selectedComunicado, user?.id) && !selectedComunicado.leituraObrigatoria && (
                  <button
                    type="button"
                    onClick={() => confirmarLeitura(selectedComunicado.id)}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] text-primary hover:bg-primary/10 rounded-xl transition-colors"
                    aria-label="Marcar como lido"
                  >
                    <MailOpen className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Lido</span>
                  </button>
                )}

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedComunicado(null);
                        abrirEdicao(selectedComunicado);
                      }}
                      className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] text-primary hover:bg-primary/10 rounded-xl transition-colors"
                      aria-label="Editar"
                    >
                      <Edit className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirComunicado(selectedComunicado.id)}
                      className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Excluir</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </ComunicadoDetailView>
        );
      })()}

      {/* Modal: Criar/Editar Comunicado (fullscreen) */}
      {isEditing && (
        <div className="fixed inset-0 z-modal bg-background flex flex-col">
          {/* Header fixo — padrão do app */}
          <nav
            className="flex-shrink-0 bg-card border-b border-border shadow-sm"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="px-4 sm:px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-[70px]">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Voltar</span>
                  </button>
                </div>
                <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
                  {editingComunicado ? 'Editar Comunicado' : 'Novo Comunicado'}
                </h1>
                <div className="min-w-[70px]" aria-hidden="true" />
              </div>
            </div>
          </nav>

          {/* Formulário scrollável */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">

              {/* ── Seção: Essencial ── */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="divide-y divide-border/50">
                  {/* Tipo */}
                  <div className="p-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                      Tipo *
                    </label>
                    <Select
                      value={formData.tipo}
                      onChange={(val) => setFormData({ ...formData, tipo: val })}
                      options={tiposComunicado.map((t) => ({ value: t.value, label: t.label }))}
                      placeholder="Selecione o tipo"
                      size="sm"
                    />
                  </div>
                  {/* Título */}
                  <div className="p-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      maxLength={100}
                      placeholder="Ex: Nova Política de Segurança"
                      className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {/* Conteúdo */}
                  <div className="p-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                      Conteúdo *
                    </label>
                    <textarea
                      value={formData.conteudo}
                      onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                      rows={5}
                      placeholder="Descreva o comunicado..."
                      className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* ── Seção: Público-alvo ── */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Público-alvo</span>
                  </div>
                  <Switch
                    checked={todosProfissionais}
                    onChange={(checked) => {
                      setTodosProfissionais(checked);
                      if (checked) setFormData({ ...formData, destinatarios: [] });
                    }}
                    label="Todos os profissionais"
                    size="sm"
                  />
                </div>
                {!todosProfissionais && (
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES_DESTINATARIOS.map((role) => {
                        const isSelected = formData.destinatarios.includes(role.key);
                        return (
                          <button
                            key={role.key}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                destinatarios: isSelected
                                  ? prev.destinatarios.filter((r) => r !== role.key)
                                  : [...prev.destinatarios, role.key],
                              }));
                            }}
                            className={cn(
                              'h-9 px-3 rounded-full text-xs font-medium border transition-colors text-center',
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                            )}
                          >
                            {role.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Seção: Datas & Validade ── */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="divide-y divide-border/50">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Datas</span>
                    </div>
                    <DatePicker
                      label="Válido até (opcional)"
                      value={formData.dataValidade ? new Date(formData.dataValidade) : null}
                      onChange={(date) =>
                        setFormData({
                          ...formData,
                          dataValidade: date
                            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T23:59:00`
                            : '',
                        })
                      }
                      placeholder="Selecione a data de validade"
                    />
                  </div>
                  {formData.tipo === 'Evento' && (
                    <div className="p-4">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                        Data do Evento *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.dataEvento}
                        onChange={(e) => setFormData({ ...formData, dataEvento: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-muted text-foreground border border-border outline-none focus:ring-2 focus:ring-primary/30 [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Seção: Compliance ── */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="divide-y divide-border/50">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Compliance</span>
                    </div>
                    <Switch
                      checked={formData.leituraObrigatoria}
                      onChange={(checked) =>
                        setFormData({ ...formData, leituraObrigatoria: checked, prazoConfirmacao: checked ? formData.prazoConfirmacao : '' })
                      }
                      label="Exigir confirmação de leitura"
                      size="sm"
                    />
                  </div>
                  {formData.leituraObrigatoria && (
                    <div className="p-4">
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                        Prazo para confirmação
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.prazoConfirmacao}
                        onChange={(e) => setFormData({ ...formData, prazoConfirmacao: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-muted text-foreground border border-border outline-none focus:ring-2 focus:ring-primary/30 [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                      Áreas ROP
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ROP_AREAS.filter((rop) => rop.key !== 'geral').map((rop) => {
                        const isSelected = formData.ropRelacionada.includes(rop.key);
                        return (
                          <button
                            key={rop.key}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => {
                                const nextRelacionada = isSelected
                                  ? prev.ropRelacionada.filter((k) => k !== rop.key)
                                  : [...prev.ropRelacionada, rop.key];
                                return {
                                  ...prev,
                                  ropRelacionada: nextRelacionada,
                                  ropArea: nextRelacionada[0] || 'geral',
                                };
                              });
                            }}
                            className={cn(
                              'h-8 px-3 rounded-full text-[11px] font-medium border transition-colors',
                              isSelected
                                ? 'text-white border-transparent'
                                : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                            )}
                            style={isSelected ? { backgroundColor: rop.color, borderColor: rop.color } : undefined}
                          >
                            {rop.label.split(' – ')[0]} – {rop.label.split(' – ')[1] || ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Seção: Extras ── */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="divide-y divide-border/50">
                  {/* Link */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-primary" />
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-primary">Link</label>
                    </div>
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      placeholder="https://exemplo.com"
                      className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {/* Ações requeridas */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardList className="w-4 h-4 text-primary" />
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-primary">Ações requeridas</label>
                    </div>
                    <div className="space-y-2">
                      {formData.acoesRequeridas.map((acao, index) => (
                        <div key={acao.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={acao.texto}
                            onChange={(e) => atualizarAcao(index, e.target.value)}
                            placeholder={`Ação ${index + 1}`}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removerAcao(index)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={adicionarAcao}
                        className="flex items-center gap-1.5 text-sm text-primary hover:opacity-70 transition-opacity font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar ação
                      </button>
                    </div>
                  </div>
                  {/* Anexos */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="w-4 h-4 text-primary" />
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-primary">Anexos</label>
                    </div>
                    <input
                      type="file"
                      id="fileUpload"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="fileUpload"
                      className="flex flex-col items-center justify-center w-full p-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                    >
                      <Upload className="w-7 h-7 text-primary mb-1.5" />
                      <span className="text-sm text-muted-foreground">Selecionar arquivos</span>
                      <span className="text-[11px] text-muted-foreground/60 mt-0.5">PDF, Office, Imagens — máx 20MB</span>
                    </label>

                    {/* Anexos existentes */}
                    <AnimatePresence initial={false}>
                      {formData.anexos.length > 0 && (
                        <motion.div
                          key="anexos-existentes"
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="mt-3 space-y-2 overflow-hidden"
                        >
                          <AnimatePresence initial={false}>
                            {formData.anexos.map((anexo, index) => (
                              <motion.div
                                key={`${anexo.path || anexo.nome}-${index}`}
                                layout
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border overflow-hidden"
                              >
                                <FileIcon type={getFileIcon(anexo.nome)} className="w-5 h-5 text-primary flex-shrink-0" />
                                <span className="flex-1 text-sm truncate text-foreground">{anexo.nome}</span>
                                <button
                                  type="button"
                                  onClick={() => removerAnexoExistente(index)}
                                  className="text-destructive flex-shrink-0"
                                  aria-label={`Remover ${anexo.nome}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Novos arquivos */}
                    <AnimatePresence initial={false}>
                      {arquivosSelecionados.length > 0 && (
                        <motion.div
                          key="novos-arquivos"
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="mt-3 space-y-2 overflow-hidden"
                        >
                          <AnimatePresence initial={false}>
                            {arquivosSelecionados.map((file, index) => (
                              <motion.div
                                key={`${file.name}-${file.size}-${index}`}
                                layout
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-2 p-2 bg-accent rounded-lg border border-border overflow-hidden"
                              >
                                <FileIcon type={getFileIcon(file.name)} className="w-5 h-5 text-primary flex-shrink-0" />
                                <span className="flex-1 text-sm truncate text-foreground">{file.name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                                <button
                                  type="button"
                                  onClick={() => removerArquivo(index)}
                                  className="text-destructive flex-shrink-0"
                                  aria-label={`Remover ${file.name}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer fixo */}
          <div
            className="flex-shrink-0 p-4 border-t border-border bg-card flex gap-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => salvarComunicado(true)}
            >
              Salvar Rascunho
            </Button>
            <Button variant="default" size="sm" className="flex-1" onClick={() => salvarComunicado(false)}>
              {editingComunicado ? 'Salvar' : 'Publicar'}
            </Button>
          </div>
        </div>
      )}

      {/* Modal: Imagem Expandida */}
      <ExpandedImageModal
        image={expandedImage}
        onClose={() => setExpandedImage(null)}
      />
    </div>
  );
}
