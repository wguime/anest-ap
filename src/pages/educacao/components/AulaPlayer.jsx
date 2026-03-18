/**
 * AulaPlayer.jsx
 * Player unificado para aulas (vídeo/áudio) com tracking integrado
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { VideoPlayer, AudioPlayer, PDFViewer } from '@/design-system';
import { ExternalLink, Loader2 } from 'lucide-react';
import { trackingService } from '@/services/trackingService';
import { useUser } from '@/contexts/UserContext';
import { extractYouTubeId, extractVimeoId } from '../data/educacaoUtils';
import * as educacaoService from '@/services/educacaoService';

/**
 * HtmlContentViewer - Renders HTML from a remote URL (e.g. Firebase Storage).
 * Strategy: try fetch → blob URL first (bypasses X-Frame-Options);
 * if CORS blocks fetch, falls back to direct iframe src.
 */
export function HtmlContentViewer({ src, title, height = '520px', className }) {
  const [iframeSrc, setIframeSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!src) { setLoading(false); setFailed(true); return; }
    setLoading(true);
    setFailed(false);

    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const htmlBlob = new Blob([blob], { type: 'text/html' });
        const url = URL.createObjectURL(htmlBlob);
        blobRef.current = url;
        setIframeSrc(url);
        setLoading(false);
      })
      .catch(() => {
        // CORS or network error — fall back to direct iframe
        setIframeSrc(src);
        setLoading(false);
      });

    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, [src]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center gap-2 bg-white dark:bg-card rounded-lg border border-border ${className || ''}`}
        style={{ height }}
      >
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando conteudo...</span>
      </div>
    );
  }

  if (failed || !iframeSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-muted rounded-lg border border-border ${className || ''}`}
        style={{ height: '120px' }}
      >
        <ExternalLink className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Arquivo HTML nao disponivel — upload pendente.</span>
      </div>
    );
  }

  return (
    <iframe
      src={iframeSrc}
      title={title || 'HTML'}
      sandbox="allow-scripts allow-same-origin"
      className={`w-full rounded-lg border border-border bg-white dark:bg-card ${className || ''}`}
      style={{ height }}
    />
  );
}

/**
 * AulaPlayer - Player unificado com tracking
 *
 * @param {Object} aula - Dados da aula
 * @param {string} aula.id - ID da aula
 * @param {string} aula.titulo - Título da aula
 * @param {string} aula.descricao - Descrição
 * @param {string} aula.tipo - 'youtube' | 'vimeo' | 'video' | 'audio' | 'document'
 * @param {string} aula.url - URL do vídeo/áudio
 * @param {number} aula.duracao - Duração em minutos
 * @param {string} aula.thumbnail - URL da thumbnail (opcional)
 * @param {string} cursoId - ID do curso
 * @param {function} onProgress - Callback de progresso
 * @param {function} onComplete - Callback de conclusão
 */
export function AulaPlayer({
  aula,
  cursoId,
  initialTime,
  preventFastForward = false,
  onProgress,
  onComplete,
  onProgressUpdate,
  className,
  ...props
}) {
  const { user } = useUser();
  const [isTracking, setIsTracking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saveError, setSaveError] = useState(null);
  const lastSavedTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const currentPercentRef = useRef(0);
  const isTrackingRef = useRef(false);
  const realDurationRef = useRef(0);
  const userId = user?.uid || user?.id || null;

  // Keep isTrackingRef in sync with state
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Iniciar tracking ao montar
  useEffect(() => {
    if (user && aula && !isTrackingRef.current) {
      trackingService.startSession(user.id || user.uid, aula.id, cursoId, aula.duracao);
      setIsTracking(true);
    }

    // Cleanup ao desmontar — uses ref to avoid stale closure
    return () => {
      if (isTrackingRef.current) {
        trackingService.endSession();
      }
      // Salvar posição no unmount com error handling
      if (userId && cursoId && aula?.id && currentTimeRef.current > 0) {
        educacaoService.salvarProgressoAula(
          userId, cursoId, aula.id,
          currentTimeRef.current, currentPercentRef.current
        ).catch(err => {
          console.error('[AulaPlayer] Erro ao salvar progresso no unmount:', err);
        });
      }
    };
  }, [user, aula, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handler: receive real video duration from player
  const handleDurationChange = useCallback((duration) => {
    if (duration && duration > 0) {
      realDurationRef.current = duration;
    }
  }, []);

  // Handler de progresso
  const handleTimeUpdate = useCallback((currentTime) => {
    if (!aula || !isTrackingRef.current) return;

    // Use real duration from player if available, else fallback to aula.duracao
    const duration = realDurationRef.current > 0
      ? realDurationRef.current
      : aula.duracao * 60;
    const result = trackingService.updateProgress(currentTime, duration);

    currentTimeRef.current = currentTime;

    if (result) {
      setProgress(result.progressoPorcentagem);
      currentPercentRef.current = result.progressoPorcentagem;
      onProgress?.(result);

      // Atualizar progresso no pai a cada timeUpdate (tempo real)
      onProgressUpdate?.(aula.id, {
        currentTime,
        percentual: result.progressoPorcentagem,
      });

      if (result.isCompleted) {
        onComplete?.(aula);
      }
    }

    // Salvar posição no Firestore a cada ~5s de playback
    if (userId && cursoId && Math.abs(currentTime - lastSavedTimeRef.current) >= 5) {
      lastSavedTimeRef.current = currentTime;
      const percentual = result?.progressoPorcentagem ?? 0;
      educacaoService.salvarProgressoAula(
        userId, cursoId, aula.id,
        currentTime, percentual
      ).catch(err => {
        console.error('[AulaPlayer] Erro ao salvar progresso periódico:', err);
        setSaveError('Erro ao salvar progresso. Tentando novamente...');
        setTimeout(() => setSaveError(null), 3000);
      });
    }
  }, [aula, onProgress, onComplete, onProgressUpdate, userId, cursoId]);

  // Handler de play
  const handlePlay = useCallback(() => {
    trackingService.resume();
  }, []);

  // Handler de pause — salvar posição imediatamente
  const handlePause = useCallback(() => {
    trackingService.pause();
    if (userId && cursoId && aula?.id && currentTimeRef.current > 0) {
      educacaoService.salvarProgressoAula(
        userId, cursoId, aula.id,
        currentTimeRef.current, currentPercentRef.current
      ).catch(err => console.error('[AulaPlayer] Erro ao salvar no pause:', err));
    }
  }, [userId, cursoId, aula]);

  // Handler de conclusão — uses real duration instead of forcing 100%
  const handleEnded = useCallback(() => {
    if (!aula) return;

    // Use real duration to calculate final progress accurately
    const duration = realDurationRef.current > 0
      ? realDurationRef.current
      : aula.duracao * 60;
    trackingService.updateProgress(duration, duration);

    const session = trackingService.endSession();
    setIsTracking(false);

    if (session && session.status === 'concluido') {
      onComplete?.(aula);
    }
  }, [aula, onComplete]);

  if (!aula) {
    return null;
  }

  // Resolver tipo e url: prioriza campos flat; fallback para blocks (AdminConteudoPage)
  const mediaBlock = (!aula.tipo || !aula.url) && Array.isArray(aula.blocks)
    ? aula.blocks.find(b => ['youtube', 'vimeo', 'video', 'audio', 'document', 'text', 'link'].includes(b.type))
    : null;
  const resolvedTipo = aula.tipo || mediaBlock?.type || 'video';
  // URL: campo flat da aula tem prioridade; fallback para qualquer block com URL
  const resolvedUrl = aula.url
    || mediaBlock?.data?.url
    || (Array.isArray(aula.blocks) ? (aula.blocks.find(b => b?.data?.url)?.data?.url || '') : '');
  const resolvedMimeType = aula.mimeType
    || mediaBlock?.data?.mimeType
    || mediaBlock?.data?.fileType
    || (Array.isArray(aula.blocks) ? (aula.blocks.find(b => b?.data?.fileType)?.data?.fileType || '') : '');

  // Renderizar player baseado no tipo (usa resolved* que lê blocks como fallback)
  const renderPlayer = () => {
    switch (resolvedTipo) {
      case 'youtube':
        return (
          <VideoPlayer
            type="youtube"
            videoId={extractYouTubeId(resolvedUrl) || resolvedUrl}
            title={aula.titulo}
            poster={aula.thumbnail}
            initialTime={initialTime}
            preventFastForward={preventFastForward}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            className={className}
            {...props}
          />
        );

      case 'vimeo':
        return (
          <VideoPlayer
            type="vimeo"
            videoId={extractVimeoId(resolvedUrl)}
            title={aula.titulo}
            poster={aula.thumbnail}
            initialTime={initialTime}
            preventFastForward={preventFastForward}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            className={className}
            {...props}
          />
        );

      case 'video':
        return (
          <VideoPlayer
            type="video"
            src={resolvedUrl}
            title={aula.titulo}
            poster={aula.thumbnail}
            initialTime={initialTime}
            preventFastForward={preventFastForward}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            className={className}
            {...props}
          />
        );

      case 'audio':
        return (
          <AudioPlayer
            src={resolvedUrl}
            title={aula.titulo}
            initialTime={initialTime}
            showSkipButtons
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            className={className}
            {...props}
          />
        );

      case 'document': {
        const urlLower = String(resolvedUrl).toLowerCase();
        const mimeLower = String(resolvedMimeType).toLowerCase();
        const isPdf = mimeLower.includes('pdf') || urlLower.includes('.pdf');
        const isHtml = mimeLower.includes('html') || /\.html?(?:[?#]|$)/i.test(urlLower);

        if (isPdf) {
          return (
            <div className={className}>
              <PDFViewer src={resolvedUrl} title={aula.titulo} height="520px" />
            </div>
          );
        }

        if (isHtml) {
          return (
            <div className={className}>
              <HtmlContentViewer src={resolvedUrl} title={aula.titulo} height="520px" />
            </div>
          );
        }

        return (
          <div className="p-4 bg-muted rounded-xl text-center text-muted-foreground">
            <p className="text-sm">Arquivo anexado</p>
            <a
              className="text-sm text-primary hover:underline"
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir em nova aba
            </a>
          </div>
        );
      }

      case 'text': {
        // Resolver conteúdo: prioriza blocks com HTML, fallback para descricao
        const textBlock = Array.isArray(aula.blocks)
          ? aula.blocks.find(b => b.type === 'text')
          : null;
        const htmlContent = textBlock?.data?.html || aula.descricao || '';
        return (
          <div className="p-6 bg-background rounded-xl">
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
            />
          </div>
        );
      }

      case 'link': {
        const linkUrl = resolvedUrl || aula.url || '';
        const linkBlock = Array.isArray(aula.blocks)
          ? aula.blocks.find(b => b.type === 'link')
          : null;
        const linkTitle = linkBlock?.data?.title || aula.titulo || linkUrl;
        return (
          <div className="p-6 bg-background rounded-xl text-center space-y-3">
            <ExternalLink className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Link externo</p>
            <a
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="w-4 h-4" />
              {linkTitle}
            </a>
          </div>
        );
      }

      default:
        return (
          <div className="p-4 bg-muted rounded-xl text-center text-muted-foreground">
            Tipo de mídia não suportado: {resolvedTipo}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      {renderPlayer()}

      {/* Barra de progresso de tracking */}
      {isTracking && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div
            className="flex-1 h-1 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do video"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{progress}% assistido</span>
        </div>
      )}

      {/* Error feedback for save failures */}
      {saveError && (
        <div className="text-xs text-destructive">{saveError}</div>
      )}
    </div>
  );
}

/**
 * AulaPreview - Preview simplificado para admin
 */
export function AulaPreview({
  tipo,
  url,
  titulo,
  className,
}) {
  if (!url) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
        Insira uma URL para visualizar
      </div>
    );
  }

  switch (tipo) {
    case 'youtube':
      return (
        <VideoPlayer
          type="youtube"
          videoId={extractYouTubeId(url)}
          title={titulo}
          controls={false}
          className={className}
        />
      );

    case 'vimeo':
      return (
        <VideoPlayer
          type="vimeo"
          videoId={extractVimeoId(url)}
          title={titulo}
          controls={false}
          className={className}
        />
      );

    case 'video':
      return (
        <VideoPlayer
          type="video"
          src={url}
          title={titulo}
          className={className}
        />
      );

    case 'audio':
      return (
        <AudioPlayer
          src={url}
          title={titulo}
          variant="card"
          className={className}
        />
      );

    case 'document': {
      const docUrl = String(url || '').toLowerCase();
      const isPdf = docUrl.includes('.pdf');
      const isHtml = /\.html?(?:[?#]|$)/i.test(docUrl);
      if (isPdf) {
        return (
          <div className={className}>
            <PDFViewer src={url} title={titulo} height="420px" />
          </div>
        );
      }
      if (isHtml) {
        return (
          <div className={className}>
            <HtmlContentViewer src={url} title={titulo} height="420px" />
          </div>
        );
      }
      return (
        <div className="p-4 bg-muted rounded-xl text-center text-muted-foreground">
          <a className="text-primary hover:underline" href={url} target="_blank" rel="noreferrer">
            Abrir arquivo
          </a>
        </div>
      );
    }

    case 'text':
      return (
        <div className="p-4 bg-background rounded-xl text-sm text-foreground">
          Conteúdo de texto (preview)
        </div>
      );

    case 'link':
      return (
        <div className="p-4 bg-background rounded-xl text-center">
          <a
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="w-4 h-4" />
            {titulo || url || 'Link externo'}
          </a>
        </div>
      );

    default:
      return (
        <div className="aspect-video bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
          Tipo não suportado
        </div>
      );
  }
}

export default AulaPlayer;
