/**
 * ContentPreviewInline.jsx
 * Pré-visualização inline do conteúdo da aula (sempre visível).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/design-system';
import { Eye, FileText, FileVideo, FileAudio, AlertCircle, Download, Expand, X } from 'lucide-react';

export function ContentPreviewInline({ formData }) {
  const safe = formData || {};
  const { titulo, descricao, tipo, url, arquivo, conteudo, duracao } = safe;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isYouTubeActive, setIsYouTubeActive] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    // Ao trocar URL/tipo, resetar player para evitar estados quebrados no mobile.
    setIsYouTubeActive(false);
  }, [tipo, url]);

  // Gera URL local para preview (sem setState em effect). Não revogamos aqui para evitar
  // depender de efeito; como o arquivo é transitório (fluxo de criação), o custo é baixo.
  // Se quisermos revogar, faremos via hook utilitário no futuro.
  const localUrl = useMemo(() => {
    if (!arquivo) return '';
    try {
      return URL.createObjectURL(arquivo);
    } catch {
      return '';
    }
  }, [arquivo]);

  const canExpand = useMemo(() => {
    if (tipo === 'youtube' || tipo === 'vimeo') return Boolean(url?.trim());
    if (tipo === 'video' || tipo === 'audio' || tipo === 'document') return Boolean(arquivo);
    return false;
  }, [tipo, url, arquivo]);

  // Nota: evitamos Fullscreen API aqui porque em iOS/PWA ela pode travar a UI
  // (promise que não resolve, ou estado inconsistente). Overlay é mais robusto.
  const openExpanded = () => setIsExpanded(true);

  const closeExpanded = () => setIsExpanded(false);

  const isPdf = useMemo(() => {
    if (!arquivo) return false;
    const type = String(arquivo.type || '').toLowerCase();
    const name = String(arquivo.name || '').toLowerCase();
    return type === 'application/pdf' || name.endsWith('.pdf');
  }, [arquivo]);

  const renderYouTube = ({ expanded = false } = {}) => {
    if (!url?.trim()) return <EmptyState message="Adicione uma URL do YouTube para ver o preview." />;
    const videoId = extractYouTubeId(url);
    if (!videoId) return <ErrorState message="URL do YouTube inválida. Verifique e tente novamente." />;

    const active = expanded ? true : isYouTubeActive;
    const origin =
      typeof window !== 'undefined' && window.location?.origin ? encodeURIComponent(window.location.origin) : '';

    // Quando ativo, já iniciamos com autoplay=1 (o clique no botão é o gesto do usuário).
    const src = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&fs=1&enablejsapi=1${
      origin ? `&origin=${origin}` : ''
    }${active ? '&autoplay=1' : ''}`;

    if (!active) {
      const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      return (
        <button
          type="button"
          onClick={() => setIsYouTubeActive(true)}
          className="relative aspect-video w-full bg-black rounded-lg overflow-hidden pointer-events-auto"
          title="Reproduzir"
        >
          <img src={thumb} alt="Prévia do YouTube" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium border border-white/15">
              Reproduzir
            </div>
          </div>
        </button>
      );
    }

    return (
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden pointer-events-auto">
        <iframe
          className="w-full h-full"
          src={src}
          title={titulo || 'YouTube video'}
          frameBorder="0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  };

  const renderContent = () => {
    switch (tipo) {
      case 'youtube': {
        return renderYouTube();
      }

      case 'vimeo': {
        if (!url?.trim()) return <EmptyState message="Adicione uma URL do Vimeo para ver o preview." />;
        const videoId = extractVimeoId(url);
        if (!videoId) return <ErrorState message="URL do Vimeo inválida. Verifique e tente novamente." />;

        return (
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden pointer-events-auto">
            <iframe
              className="w-full h-full"
              src={`https://player.vimeo.com/video/${videoId}?playsinline=1&title=0&byline=0&portrait=0`}
              title={titulo || 'Vimeo video'}
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }

      case 'text': {
        if (!conteudo || conteudo.trim() === '') {
          return <EmptyState message="Digite o conteúdo de texto para ver o preview." />;
        }

        return (
          <div className="prose prose-sm max-w-none p-6 bg-background rounded-lg border border-border">
            <div className="text-foreground" dangerouslySetInnerHTML={{ __html: conteudo }} />
          </div>
        );
      }

      case 'video': {
        if (!arquivo) return <EmptyState message="Selecione um arquivo de vídeo para ver os detalhes." />;
        return (
          <div className="space-y-4">
            {localUrl ? (
              <div className="space-y-3">
                <div className="aspect-video w-full bg-black rounded-lg overflow-hidden pointer-events-auto">
                  <video
                    className="w-full h-full"
                    controls
                    playsInline
                    webkit-playsinline="true"
                    src={localUrl}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <DownloadLocalButton href={localUrl} fileName={arquivo.name} />
                </div>
              </div>
            ) : (
              <InfoBanner message="Pré-visualização local indisponível no momento." />
            )}
            <FilePreview
              fileName={arquivo.name}
              fileSize={arquivo.size}
              fileType={arquivo.type}
              icon={<FileVideo className="w-12 h-12 text-primary" />}
            />
          </div>
        );
      }

      case 'audio': {
        if (!arquivo) return <EmptyState message="Selecione um arquivo de áudio para ver os detalhes." />;
        return (
          <div className="space-y-4">
            {localUrl ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border border-border bg-background">
                  <audio className="w-full" controls src={localUrl} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <DownloadLocalButton href={localUrl} fileName={arquivo.name} />
                </div>
              </div>
            ) : (
              <InfoBanner message="Pré-visualização local indisponível no momento." />
            )}
            <FilePreview
              fileName={arquivo.name}
              fileSize={arquivo.size}
              fileType={arquivo.type}
              icon={<FileAudio className="w-12 h-12 text-primary" />}
            />
          </div>
        );
      }

      case 'document': {
        if (!arquivo) return <EmptyState message="Selecione um documento para ver os detalhes." />;
        return (
          <div className="space-y-4">
            {localUrl ? (
              isPdf ? (
                <div className="space-y-3">
                  <div className="w-full rounded-lg overflow-hidden border border-border bg-background">
                    {/* PDF preview local (browser-native) */}
                    <iframe
                      title={arquivo.name || 'PDF'}
                      src={localUrl}
                      className="w-full h-[420px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DownloadLocalButton href={localUrl} fileName={arquivo.name} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoBanner message="Preview inline local para DOC/DOCX/PPT/PPTX pode não ser suportado pelo navegador. Use 'Abrir' para revisar no app padrão do dispositivo." />
                  <div className="flex flex-wrap gap-2">
                    <DownloadLocalButton href={localUrl} fileName={arquivo.name} />
                  </div>
                </div>
              )
            ) : (
              <InfoBanner message="Pré-visualização local indisponível no momento." />
            )}
            <FilePreview
              fileName={arquivo.name}
              fileSize={arquivo.size}
              fileType={arquivo.type}
              icon={<FileText className="w-12 h-12 text-primary" />}
            />
          </div>
        );
      }

      default:
        return <EmptyState message="Selecione um tipo de conteúdo para ver o preview." />;
    }
  };

  return (
    <div ref={previewRef} className="border border-border rounded-lg p-4 sm:p-6 bg-muted/30 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground">Pré-visualização</h4>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground truncate">{titulo || 'Sem título'}</p>
            {descricao ? (
              <p className="text-xs text-muted-foreground line-clamp-2">{descricao}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem descrição</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" badgeStyle="subtle">
              {getTipoLabel(tipo)}
            </Badge>
            {duracao ? (
              <Badge variant="secondary" className="text-xs">
                {duracao} minutos
              </Badge>
            ) : null}
          </div>
        </div>

        {canExpand ? (
          <button
            type="button"
            onClick={openExpanded}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors"
            title="Expandir preview"
          >
            <Expand className="w-4 h-4" />
            Expandir
          </button>
        ) : null}
      </div>

      {/* Full-bleed no mobile: o preview ocupa praticamente toda a largura */}
      <div className="-mx-4 sm:mx-0">
        {/* Evita 2 iframes ao mesmo tempo (pode travar no mobile) */}
        {isExpanded ? (
          <div className="aspect-video w-full bg-black/60 rounded-lg flex items-center justify-center">
            <p className="text-sm text-white/80">Preview em tela cheia</p>
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {isExpanded
        ? createPortal(
            <div className="fixed inset-0 z-[9999] bg-black/90">
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeExpanded}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Fechar
                </button>
              </div>

              <div className="w-full h-full flex items-center justify-center p-3 pt-14">
                <div className="w-full max-w-5xl">
                  {/* Renderiza o conteúdo apenas aqui (evita duplicação) */}
                  {tipo === 'youtube' ? renderYouTube({ expanded: true }) : renderContent()}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <Eye className="w-10 h-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

function InfoBanner({ message }) {
  return (
    <div className="p-4 rounded-lg bg-info/10 border border-info/20 text-info">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

function DownloadLocalButton({ href, fileName }) {
  return (
    <a
      href={href}
      download={fileName || 'arquivo'}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors"
    >
      <Download className="w-4 h-4" />
      Baixar
    </a>
  );
}

function FilePreview({ fileName, fileSize, fileType, icon }) {
  return (
    <div className="flex items-center gap-4 p-6 bg-muted/50 rounded-lg border border-border">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{fileName}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-muted-foreground">{formatFileSize(fileSize)}</p>
          {fileType ? (
            <>
              <span className="text-muted-foreground">•</span>
              <p className="text-sm text-muted-foreground">{fileType}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${Math.round(value * 100) / 100} ${sizes[i]}`;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function extractVimeoId(url) {
  if (!url) return null;
  const patterns = [/vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function getTipoLabel(tipo) {
  const labels = {
    text: 'Texto',
    video: 'Vídeo (upload)',
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    audio: 'Áudio',
    document: 'Documento (PDF)',
  };
  return labels[tipo] || 'Tipo';
}

