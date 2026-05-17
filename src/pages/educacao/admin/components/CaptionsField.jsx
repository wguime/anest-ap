/**
 * CaptionsField.jsx — Sprint 1 Wave 1.7 T1.1.13
 *
 * Editor de legendas (captions) para uma aula no admin.
 * Suporta 3 fontes:
 *   1. YouTube auto-captions (tipo=youtube): botão "Puxar legendas PT do YouTube"
 *      chama Edge Function fetch-yt-captions que salva VTT + atualiza aulas_captions
 *   2. Upload manual VTT/SRT (qualquer tipo): admin sobe arquivo → bucket
 *      educacao-captions → upsert_aula_track RPC
 *   3. Whisper (futuro Sprint 5): caption_jobs queue + worker (não nesta UI ainda)
 *
 * Lista tracks existentes (1 por idioma) com remoção.
 *
 * Compatível com VideoPlayer.tracks prop (T1.1.10) — formato:
 *   [{ url, lang, label, default, source }]
 */

import { useState, useEffect, useId } from 'react';
import { Upload, X, Youtube, Loader2, Languages, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Button,
  Badge,
  FormField,
  Select,
  useToast,
  Spinner,
} from '@/design-system';
import { supabase } from '@/config/supabase';
import { cn } from '@/design-system/utils/tokens';

const LANG_OPTIONS = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const SOURCE_BADGE = {
  youtube_auto: { label: 'YouTube auto', variant: 'info' },
  manual_upload: { label: 'Upload manual', variant: 'secondary' },
  whisper: { label: 'IA (Whisper)', variant: 'warning' },
  vimeo_native: { label: 'Vimeo nativo', variant: 'info' },
};

export function CaptionsField({ aulaId, tipo, videoUrl, disabled = false }) {
  const { toast } = useToast();
  const fileInputId = useId();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingYt, setFetchingYt] = useState(false);
  const [selectedLang, setSelectedLang] = useState('pt-BR');

  // Carrega tracks existentes quando aulaId está disponível (edit mode)
  useEffect(() => {
    let cancelled = false;
    if (!aulaId) {
      setTracks([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('aulas_captions')
          .select('tracks')
          .eq('aula_id', aulaId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setTracks(Array.isArray(data?.tracks) ? data.tracks : []);
      } catch (err) {
        if (!cancelled) {
          console.warn('[CaptionsField] load tracks error:', err.message);
          setTracks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [aulaId]);

  /**
   * Upload manual VTT/SRT — admin escolhe arquivo + idioma
   */
  const handleVttUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // reset input
    if (!file || !aulaId) return;

    // Validação tamanho 5MB (mesmo limite do bucket)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo de legenda muito grande (máx 5MB)');
      return;
    }

    // Validação extensão
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['vtt', 'srt'].includes(ext)) {
      toast.error('Formato inválido — use .vtt ou .srt');
      return;
    }

    setUploading(true);
    try {
      
      const storagePath = `manual/${aulaId}/${selectedLang}.${ext}`;
      const contentType = ext === 'vtt' ? 'text/vtt' : 'application/x-subrip';

      // 1. Upload para bucket
      const { error: uploadErr } = await supabase
        .storage
        .from('educacao-captions')
        .upload(storagePath, file, { upsert: true, contentType });
      if (uploadErr) throw uploadErr;

      // 2. Construir URL pública (bucket é privado mas SELECT é authenticated)
      const { data: { publicUrl } } = supabase.storage
        .from('educacao-captions')
        .getPublicUrl(storagePath);

      // 3. RPC upsert_aula_track
      const langLabel = LANG_OPTIONS.find(l => l.value === selectedLang)?.label || selectedLang;
      const { data: updatedTracks, error: rpcErr } = await supabase.rpc('upsert_aula_track', {
        p_aula_id: aulaId,
        p_lang: selectedLang,
        p_url: publicUrl,
        p_label: langLabel,
        p_default: tracks.length === 0, // primeiro track vira default
        p_source: 'manual_upload',
      });
      if (rpcErr) throw rpcErr;

      setTracks(Array.isArray(updatedTracks) ? updatedTracks : []);
      toast.success(`Legenda ${langLabel} adicionada`);
    } catch (err) {
      console.error('[CaptionsField] upload error:', err);
      toast.error(`Erro ao subir legenda: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Puxar captions YouTube via Edge Function fetch-yt-captions
   */
  const handleFetchYouTube = async () => {
    if (!aulaId || !videoUrl) return;

    setFetchingYt(true);
    try {
      
      const { data, error } = await supabase.functions.invoke('fetch-yt-captions', {
        body: { videoUrl, aulaId, lang: selectedLang },
      });
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.detail || data?.reason || 'Falha desconhecida');
      }

      // Recarrega tracks
      const { data: refreshed } = await supabase
        .from('aulas_captions')
        .select('tracks')
        .eq('aula_id', aulaId)
        .maybeSingle();
      setTracks(Array.isArray(refreshed?.tracks) ? refreshed.tracks : []);
      toast.success(`Legendas YouTube ${data.source === 'cache' ? '(cache)' : 'baixadas'}: ${data.lang}`);
    } catch (err) {
      console.error('[CaptionsField] YouTube fetch error:', err);
      const msg = err.message || String(err);
      if (msg.includes('youtube_blocked')) {
        toast.warning('YouTube bloqueou o acesso. Use upload manual da legenda VTT/SRT.');
      } else if (msg.includes('no_captions_available')) {
        toast.warning('Este vídeo não tem legendas YouTube disponíveis.');
      } else {
        toast.error(`Erro ao puxar legendas: ${msg}`);
      }
    } finally {
      setFetchingYt(false);
    }
  };

  /**
   * Remover track por idioma
   */
  const handleRemoveTrack = async (lang) => {
    if (!aulaId) return;
    if (!window.confirm(`Remover legenda em ${lang}?`)) return;

    try {
      
      const { data: updatedTracks, error } = await supabase.rpc('delete_aula_track', {
        p_aula_id: aulaId,
        p_lang: lang,
      });
      if (error) throw error;
      setTracks(Array.isArray(updatedTracks) ? updatedTracks : []);
      toast.success('Legenda removida');
    } catch (err) {
      console.error('[CaptionsField] delete error:', err);
      toast.error(`Erro ao remover: ${err.message}`);
    }
  };

  // Sem aulaId (criando aula nova): mostra mensagem dizendo "salve primeiro"
  if (!aulaId) {
    return (
      <FormField label="Legendas (captions)">
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Salve a aula primeiro para adicionar legendas.</span>
        </div>
      </FormField>
    );
  }

  const canFetchYt = tipo === 'youtube' && videoUrl;

  return (
    <FormField label="Legendas (captions)">
      <div className="space-y-3">
        {/* Lista de tracks existentes */}
        {loading ? (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            <Spinner size="sm" /> Carregando legendas…
          </div>
        ) : tracks.length > 0 ? (
          <div className="space-y-2">
            {tracks.map((t) => {
              const sourceBadge = SOURCE_BADGE[t.source] || SOURCE_BADGE.manual_upload;
              return (
                <div
                  key={t.lang}
                  className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg"
                >
                  <Languages className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {t.label || t.lang}
                      </span>
                      {t.default && (
                        <Badge variant="success" badgeStyle="subtle" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" /> Padrão
                        </Badge>
                      )}
                      <Badge variant={sourceBadge.variant} badgeStyle="subtle" className="text-xs">
                        {sourceBadge.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.url}</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => handleRemoveTrack(t.lang)}
                    disabled={disabled}
                    aria-label={`Remover legenda ${t.label || t.lang}`}
                    className="min-h-[44px] min-w-[44px] shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma legenda configurada. Adicione abaixo.
          </p>
        )}

        {/* Controles de adicionar — mobile-first: coluna; sm+: linha */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
            <Select
              value={selectedLang}
              onChange={setSelectedLang}
              options={LANG_OPTIONS}
              disabled={disabled || uploading || fetchingYt}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              {canFetchYt && (
                <Button
                  variant="outline"
                  onClick={handleFetchYouTube}
                  disabled={disabled || fetchingYt || uploading}
                  leftIcon={fetchingYt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                  className="flex-1 min-h-[44px]"
                >
                  {fetchingYt ? 'Puxando…' : 'Puxar do YouTube'}
                </Button>
              )}
              <label
                htmlFor={fileInputId}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] text-sm rounded-md border border-border bg-card cursor-pointer hover:bg-muted transition-colors",
                  (disabled || uploading) && "opacity-50 cursor-not-allowed"
                )}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{uploading ? 'Subindo…' : 'Upload VTT/SRT'}</span>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".vtt,.srt,text/vtt,application/x-subrip"
                  onChange={handleVttUpload}
                  disabled={disabled || uploading}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {canFetchYt
              ? 'YouTube tem captions PT auto-geradas (~85-95% acurácia). Ou faça upload manual de .vtt/.srt.'
              : 'Faça upload de um arquivo .vtt ou .srt (máx 5MB).'}
          </p>
        </div>
      </div>
    </FormField>
  );
}

export default CaptionsField;
