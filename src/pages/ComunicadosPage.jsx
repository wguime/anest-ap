import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useEventAlerts } from '../contexts/EventAlertsContext';
import { useMessages } from '../contexts/MessagesContext';
import { notifyComunicadoPublicado, notifyAcaoRequerida } from '@/services/notificationService';
import { useComunicados } from '../contexts/ComunicadosContext';
import { uploadFile } from '../services/uploadService';
import { useUsersManagement } from '../contexts/UsersManagementContext';
import {
  tiposComunicado,
  getTipoColor,
  formatCardDate,
  formatFullDate,
  formatRelativeDate,
  formatEventDate,
  getFileIcon,
  ROLES_DESTINATARIOS,
  ROP_AREAS,
  STATUS_COMUNICADO,
  isPrazoVencido,
  isExpirado,
  calcularTotalDestinatarios,
} from '@/utils/comunicadosHelpers';
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  Avatar,
  PDFViewer,
  EmptyState,
  Switch,
  Checkbox,
  Checklist,
  Progress,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { useToast } from '@/design-system';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {
  Search,
  Plus,
  X,
  Calendar,
  Link as LinkIcon,
  Paperclip,
  FileText,
  Image,
  Table,
  File,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Edit,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Upload,
  AlertCircle,
  Maximize2,
  Minimize2,
  Megaphone,
  Users,
  CheckCircle,
  ClipboardList,
  Clock,
  ShieldCheck,
} from 'lucide-react';

// Componente do ícone de arquivo
function FileIcon({ type, className }) {
  const icons = {
    FileText: FileText,
    Image: Image,
    Table: Table,
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
        className="w-full max-h-[400px] object-contain"
        draggable={false}
      />
      {onExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand({ src, alt });
          }}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-70 hover:opacity-100 transition-opacity z-10"
          title="Expandir imagem"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Modal fullscreen para imagem expandida
function ExpandedImageModal({ image, onClose }) {
  if (!image) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-50 bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass-surface hover:opacity-90 text-white transition-colors border border-white/20"
        >
          <Minimize2 className="w-5 h-5" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full glass-surface hover:opacity-90 text-white transition-colors border border-white/20"
        >
          <X className="w-6 h-6" />
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

export default function ComunicadosPage({ onNavigate, params }) {
  const { user } = useUser();
  const { scheduleEventAlerts } = useEventAlerts();
  const { createSystemNotification } = useMessages();
  const { toast } = useToast();
  const {
    comunicados,
    publicados,
    loading: contextLoading,
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

  // Admin mode: load all comunicados (any status)
  useEffect(() => {
    if (isAdmin) enableAdminMode();
  }, [isAdmin, enableAdminMode]);

  const [activeTab, setActiveTab] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Auto-abrir comunicado vindo de notificação
  useEffect(() => {
    if (params?.comunicadoId) {
      const target = comunicados.find((c) => c.id === params.comunicadoId);
      if (target) {
        abrirComunicado(target);
      }
    }
  }, [params?.comunicadoId]);

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
        if (!asDraft && isAdmin) {
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
          let recipientIds;
          if (todosProfissionais) {
            recipientIds = contextUsers.map(u => u.id);
          } else {
            const destinatarios = formData.destinatarios || [];
            if (destinatarios.length > 0 && contextUsers.length > 0) {
              recipientIds = contextUsers
                .filter(u => destinatarios.includes(u.role))
                .map(u => u.id);
            }
          }
          notifyComunicadoPublicado(createSystemNotification, {
            titulo: formData.titulo,
            tipo: formData.tipo,
            recipientIds: recipientIds && recipientIds.length > 0 ? recipientIds : undefined,
          });

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
    if (destinatarios.length > 0 && contextUsers.length > 0) {
      const recipientIds = contextUsers
        .filter(u => destinatarios.includes(u.role))
        .map(u => u.id);
      if (recipientIds.length > 0) {
        notifyComunicadoPublicado(createSystemNotification, {
          titulo: comunicado.titulo,
          tipo: comunicado.tipo,
          recipientIds,
        });
      }
    } else {
      const allIds = contextUsers.map(u => u.id);
      notifyComunicadoPublicado(createSystemNotification, {
        titulo: comunicado.titulo,
        tipo: comunicado.tipo,
        recipientIds: allIds.length > 0 ? allIds : undefined,
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

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Comunicados
          </h1>
          <div className="min-w-[70px] flex justify-end">
            {isAdmin && (
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
        </div>
      </div>
    </nav>
  );

  // Upload de arquivos
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024;

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        toast({ title: `Arquivo "${file.name}" muito grande (máx 10MB)`, variant: 'destructive' });
        return false;
      }
      return true;
    });

    setArquivosSelecionados((prev) => [...prev, ...validFiles]);
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
    <div className="min-h-screen bg-background pb-28">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="relative mb-3"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar comunicados..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-card border border-border text-[15px] text-foreground placeholder-muted-foreground shadow-[0_2px_8px_rgba(0,66,37,0.04)] dark:shadow-none focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </motion.div>

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

        {/* Lista de Comunicados */}
        <div className="space-y-3 mb-20">
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
                className="space-y-3"
              >
                {filteredComunicados.map((comunicado, index) => {
                  const tipoBadgeVariant = {
                    'Urgente': 'destructive',
                    'Importante': 'warning',
                    'Informativo': 'info',
                    'Evento': 'secondary',
                    'Geral': 'default',
                  }[comunicado.tipo] || 'default';

                  const ropInfo = getRopInfo(comunicado.ropArea);
                  const expirado = isExpirado(comunicado);
                  const prazoVencido = isPrazoVencido(comunicado);
                  const confirmado = userConfirmou(comunicado);
                  const needsConfirmation = comunicado.leituraObrigatoria && !confirmado;
                  const isUnread = !isRead(comunicado, user?.id) || needsConfirmation;

                  return (
                    <motion.div
                      key={comunicado.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.04 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        onClick={() => abrirComunicado(comunicado)}
                        className={`rounded-[20px] overflow-hidden cursor-pointer transition-all
                          ${isUnread ? 'bg-[hsl(var(--card-highlight))]' : 'bg-card'}
                          ${expirado ? 'opacity-60' : ''}
                          border border-[hsl(var(--border-strong))]
                          shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]
                          hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)]
                        `}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            abrirComunicado(comunicado);
                          }
                        }}
                      >
                        <div className="p-4">
                          {/* Header: tipo badge + status */}
                          <div className="flex items-center justify-between mb-2.5">
                            <Badge
                              variant={tipoBadgeVariant}
                              badgeStyle="solid"
                              className="text-[10px] font-bold uppercase tracking-wider"
                            >
                              {comunicado.tipo}
                            </Badge>
                            <div className="flex items-center gap-1.5">
                              {/* Feature 5: Rascunho badge (admin) */}
                              {isAdmin && comunicado.status === 'rascunho' && (
                                <Badge variant="default" badgeStyle="outline" className="text-[10px]">
                                  Rascunho
                                </Badge>
                              )}
                              {/* Feature 7: Expirado badge */}
                              {expirado && (
                                <Badge variant="default" badgeStyle="outline" className="text-[10px]">
                                  Expirado
                                </Badge>
                              )}
                              {/* Feature 2: Confirmação status */}
                              {comunicado.leituraObrigatoria && (
                                confirmado ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Confirmado
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${prazoVencido ? 'text-destructive' : 'text-warning'}`}>
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {prazoVencido ? 'Atrasado' : 'Pendente'}
                                  </span>
                                )
                              )}
                              {/* Novo indicator */}
                              {isUnread && !comunicado.leituraObrigatoria && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.3)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
                                  Novo
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Título */}
                          <h3 className="text-[15px] font-semibold text-card-foreground mb-1 line-clamp-2 leading-snug">
                            {comunicado.titulo}
                          </h3>

                          {/* Conteúdo preview */}
                          <p className="text-[13px] leading-relaxed line-clamp-2 text-muted-foreground mb-3">
                            {comunicado.conteudo}
                          </p>

                          {/* Footer: metadata */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              {/* Feature 3: ROP */}
                              {comunicado.ropArea && comunicado.ropArea !== 'geral' && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                                  <ShieldCheck className="w-3 h-3" />
                                  {ropInfo.label.split(' – ')[0]}
                                </span>
                              )}
                              {/* Feature 1: Destinatários */}
                              {comunicado.destinatarios?.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Users className="w-3 h-3" />
                                  {comunicado.destinatarios.length} cargo{comunicado.destinatarios.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {/* Feature 4: Ações */}
                              {comunicado.acoesRequeridas?.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <ClipboardList className="w-3 h-3" />
                                  {comunicado.acoesRequeridas.length} {comunicado.acoesRequeridas.length > 1 ? 'ações' : 'ação'}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground/60 font-medium">
                              {formatCardDate(comunicado.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Modal: Ver Comunicado */}
      {selectedComunicado && (() => {
        const tipoColor = getTipoColor(selectedComunicado.tipo);
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

        // Feature 8: Métricas (dados reais via users context)
        const totalEsperado = calcularTotalDestinatarios(selectedComunicado, contextUsers);
        const confirmados = selectedComunicado.confirmacoes?.length || 0;
        const porcentagem = totalEsperado > 0 ? Math.round((confirmados / totalEsperado) * 100) : 0;

        return (
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center px-4 pt-16 pb-20 bg-black/50"
            onClick={() => setSelectedComunicado(null)}
          >
            <div
              className="bg-background rounded-2xl w-full max-w-2xl max-h-full overflow-hidden shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4">
                {/* 1. Badge tipo + Título + Fechar */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge
                      variant={tipoBadgeVariant}
                      badgeStyle="solid"
                      className="text-[10px] font-bold uppercase tracking-wider mt-0.5 shrink-0"
                    >
                      {selectedComunicado.tipo}
                    </Badge>
                    <button
                      onClick={() => setSelectedComunicado(null)}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors shrink-0"
                    >
                      <X className="w-4 h-4 text-foreground" />
                    </button>
                  </div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">
                    {selectedComunicado.titulo}
                  </h2>
                </div>

                {/* 2. Feature 3: Card Categoria ROP */}
                {selectedComunicado.ropArea && selectedComunicado.ropArea !== 'geral' && (
                  <Card variant="default" className="border-2 border-primary bg-muted">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                            Categoria Qmentum
                          </p>
                          <p className="text-sm font-bold text-foreground">
                            {ropInfo.label}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 3. Card: Autor */}
                <Card variant="default" className="bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                        style={{ backgroundColor: tipoColor }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-[15px]">
                          {selectedComunicado.autorNome}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {formatFullDate(selectedComunicado.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] text-muted-foreground/60">
                          {formatRelativeDate(selectedComunicado.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Feature 1: Card Destinatários */}
                {selectedComunicado.destinatarios?.length > 0 && (
                  <Card variant="default" className="bg-card border border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground text-sm">Destinado a</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedComunicado.destinatarios.map((role) => (
                          <Badge key={role} variant="secondary" badgeStyle="subtle" className="text-xs">
                            {getRoleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 5. Card: Conteúdo */}
                <Card variant="default" className="bg-card border border-border">
                  <CardContent className="p-4">
                    <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-line text-justify">
                      {selectedComunicado.conteudo}
                    </p>
                  </CardContent>
                </Card>

                {/* 6. Feature 2: Card Confirmação de Leitura */}
                {selectedComunicado.leituraObrigatoria && (
                  <Card
                    variant="default"
                    className={`border-2 ${
                      confirmado
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                        : prazoVencido
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
                    }`}
                  >
                    <CardContent className="p-4">
                      {confirmado ? (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-success shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                              Leitura confirmada
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {formatFullDate(
                                selectedComunicado.confirmacoes.find((c) => c.userId === user?.id)?.confirmedAt
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className={`w-5 h-5 shrink-0 ${prazoVencido ? 'text-destructive' : 'text-warning'}`} />
                            <p className={`text-sm font-semibold ${prazoVencido ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                              Confirmação de leitura obrigatória
                            </p>
                          </div>
                          {selectedComunicado.prazoConfirmacao && (
                            <p className={`text-xs mb-3 ${prazoVencido ? 'text-destructive font-semibold' : 'text-warning'}`}>
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

                {/* 7. Feature 2 (admin): Lista de confirmações */}
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

                {/* 8. Feature 8: Card Métricas (admin) */}
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

                {/* 9. Feature 4: Checklist de ações requeridas (com tracking individual) */}
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

                {/* 10. Card: Data do Evento */}
                {selectedComunicado.dataEvento && (
                  <Card variant="default" className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        <div>
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold uppercase">
                            Data do Evento
                          </p>
                          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                            {formatEventDate(selectedComunicado.dataEvento)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 11. Feature 7: Card Validade */}
                {selectedComunicado.dataValidade && (
                  <Card
                    variant="default"
                    className={`border-2 ${
                      expirado
                        ? 'bg-red-50 dark:bg-red-900/20 border-destructive'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Calendar className={`w-5 h-5 ${expirado ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'}`} />
                        <div>
                          <p className={`text-xs font-semibold uppercase ${expirado ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'}`}>
                            {expirado ? 'Expirado em' : 'Válido até'}
                          </p>
                          <p className={`text-sm font-bold ${expirado ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>
                            {formatFullDate(selectedComunicado.dataValidade)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 12. Card: Link */}
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

                {/* 13. Card: Anexos */}
                {selectedComunicado.anexos?.length > 0 && (
                  <Card variant="default" className="bg-card border border-border">
                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        Anexos ({selectedComunicado.anexos.length})
                      </h3>
                      <div className="space-y-4">
                        {selectedComunicado.anexos.map((anexo, index) => {
                          const tipo = getAnexoType(anexo.nome);
                          return (
                            <div
                              key={index}
                              className="rounded-xl border border-border overflow-hidden"
                            >
                              <div className="flex items-center gap-2 p-3 bg-muted">
                                <FileIcon
                                  type={getFileIcon(anexo.nome)}
                                  className="w-5 h-5 text-primary"
                                />
                                <span className="font-medium text-foreground text-sm truncate flex-1">
                                  {anexo.nome}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {(anexo.tamanho / 1024).toFixed(1)} KB
                                </span>
                              </div>

                              {tipo === 'image' && anexo.url && anexo.url !== '#' && (
                                <div className="overflow-hidden bg-card">
                                  <ZoomableImage
                                    src={anexo.url}
                                    alt={anexo.nome}
                                    onExpand={setExpandedImage}
                                  />
                                </div>
                              )}

                              {tipo === 'image' && (!anexo.url || anexo.url === '#') && (
                                <div className="p-8 text-center text-muted-foreground bg-card">
                                  Imagem não disponível
                                </div>
                              )}

                              {tipo === 'pdf' && anexo.url && anexo.url !== '#' && (
                                <PDFViewer src={anexo.url} title={anexo.nome} height="400px" />
                              )}

                              {tipo === 'pdf' && (!anexo.url || anexo.url === '#') && (
                                <div className="p-8 text-center text-muted-foreground bg-card">
                                  PDF não disponível
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 14. Feature 5: Card Aprovação (rascunho + admin) */}
                {isAdmin && selectedComunicado.status === 'rascunho' && (
                  <Card variant="default" className="bg-amber-50 dark:bg-amber-900/20 border-2 border-warning">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-5 h-5 text-warning" />
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
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

                {/* 15. Botões do usuário */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      await arquivarComunicado(selectedComunicado.id, !selectedComunicado.arquivado);
                      setSelectedComunicado(null);
                    }}
                  >
                    {selectedComunicado.arquivado ? (
                      <>
                        <ArchiveRestore className="w-4 h-4 mr-1" />
                        Desarquivar
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4 mr-1" />
                        Arquivar
                      </>
                    )}
                  </Button>
                </div>

                {/* 16. Botões admin */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedComunicado(null);
                        abrirEdicao(selectedComunicado);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => excluirComunicado(selectedComunicado.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Criar/Editar Comunicado */}
      {isEditing && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                {editingComunicado ? 'Editar Comunicado' : 'Novo Comunicado'}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* Formulário */}
            <div className="p-4 overflow-y-auto overscroll-contain max-h-[60vh] space-y-4">
              {/* 1. Tipo */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Tipo *
                </label>
                <div className="relative">
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground appearance-none cursor-pointer border border-border focus:ring-2 focus:ring-primary/30"
                  >
                    {tiposComunicado.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 2. Feature 3: Área ROP */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Área ROP
                </label>
                <div className="relative">
                  <select
                    value={formData.ropArea}
                    onChange={(e) => setFormData({ ...formData, ropArea: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground appearance-none cursor-pointer border border-border focus:ring-2 focus:ring-primary/30"
                  >
                    {ROP_AREAS.map((rop) => (
                      <option key={rop.key} value={rop.key}>{rop.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 2b. ROPs Relacionadas (multi-select) */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  ROPs Relacionadas (opcional)
                </label>
                <p className="text-xs text-muted-foreground/70 mb-2">
                  Selecione as ROPs adicionais relacionadas a este comunicado
                </p>
                <div className="flex flex-wrap gap-2">
                  {ROP_AREAS.filter((rop) => rop.key !== 'geral').map((rop) => {
                    const isSelected = formData.ropRelacionada.includes(rop.key);
                    return (
                      <button
                        key={rop.key}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            ropRelacionada: isSelected
                              ? prev.ropRelacionada.filter((k) => k !== rop.key)
                              : [...prev.ropRelacionada, rop.key],
                          }));
                        }}
                        className={cn(
                          'h-8 px-3 rounded-full text-[11px] font-medium border transition-colors',
                          isSelected
                            ? 'text-white border-transparent'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                        )}
                        style={isSelected ? { backgroundColor: rop.color, borderColor: rop.color } : undefined}
                      >
                        {rop.label.split(' – ')[0]} – {rop.label.split(' – ')[1] || ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Feature 1: Público-alvo */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Público-alvo
                </label>
                <div className="mb-2">
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
                              : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                          )}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Título */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  maxLength={100}
                  placeholder="Ex: Nova Política de Segurança"
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* 5. Data do Evento */}
              {formData.tipo === 'Evento' && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Data do Evento *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dataEvento}
                    onChange={(e) => setFormData({ ...formData, dataEvento: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground border border-border focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* 6. Feature 7: Válido até */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Válido até (opcional)
                </label>
                <input
                  type="date"
                  value={formData.dataValidade ? formData.dataValidade.split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, dataValidade: e.target.value ? `${e.target.value}T23:59:00` : '' })}
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground border border-border focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* 7. Conteúdo */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Conteúdo *
                </label>
                <textarea
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  rows={6}
                  placeholder="Descreva o comunicado..."
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* 8. Feature 2: Exigir confirmação de leitura */}
              <Switch
                checked={formData.leituraObrigatoria}
                onChange={(checked) =>
                  setFormData({ ...formData, leituraObrigatoria: checked, prazoConfirmacao: checked ? formData.prazoConfirmacao : '' })
                }
                label="Exigir confirmação de leitura"
                size="sm"
              />

              {/* 9. Feature 6: Prazo */}
              {formData.leituraObrigatoria && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Prazo para confirmação (opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.prazoConfirmacao}
                    onChange={(e) => setFormData({ ...formData, prazoConfirmacao: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground border border-border focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* 10. Link */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Link (opcional)
                </label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://exemplo.com"
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* 11. Feature 4: Ações requeridas */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Ações requeridas (opcional)
                </label>
                <div className="space-y-2">
                  {formData.acoesRequeridas.map((acao, index) => (
                    <div key={acao.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={acao.texto}
                        onChange={(e) => atualizarAcao(index, e.target.value)}
                        placeholder={`Ação ${index + 1}`}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground placeholder-muted-foreground border border-border focus:ring-2 focus:ring-primary/30 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removerAcao(index)}
                        className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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

              {/* 12. Upload de Anexos */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Anexos (opcional)
                </label>
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="fileUpload"
                  className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Clique para selecionar arquivos
                  </span>
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    PDF e Imagens (máx 10MB)
                  </span>
                </label>

                {/* Anexos existentes */}
                {formData.anexos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Anexos existentes:
                    </p>
                    {formData.anexos.map((anexo, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border"
                      >
                        <FileIcon
                          type={getFileIcon(anexo.nome)}
                          className="w-5 h-5 text-primary"
                        />
                        <span className="flex-1 text-sm truncate text-foreground">
                          {anexo.nome}
                        </span>
                        <button
                          type="button"
                          onClick={() => removerAnexoExistente(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Arquivos selecionados */}
                {arquivosSelecionados.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Novos arquivos:
                    </p>
                    {arquivosSelecionados.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-accent rounded-lg border border-border"
                      >
                        <FileIcon
                          type={getFileIcon(file.name)}
                          className="w-5 h-5 text-primary"
                        />
                        <span className="flex-1 text-sm truncate text-foreground">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removerArquivo(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer com Salvar Rascunho / Publicar */}
            <div className="p-4 border-t border-border flex gap-2">
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
