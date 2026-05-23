/**
 * PDFViewerWithWatermark
 *
 * Wrapper do `PDFViewer` (DS) que aplica watermark client-side com a
 * identidade do usuário atual antes de exibir o PDF.
 *
 * Comportamento:
 *  - Se a feature flag `VITE_FEATURE_WATERMARK !== 'true'`, renderiza o
 *    PDFViewer com a `src` original (sem custo extra).
 *  - Caso contrário, faz fetch do PDF, aplica `applyWatermark`, cria um
 *    Blob URL e passa ao PDFViewer; revoga o Blob URL no unmount.
 *  - Se o fetch ou a aplicação falharem, faz fallback para a `src`
 *    original e emite `console.warn` (LGPD: não bloqueia o usuário, mas
 *    sinaliza ao operador que a marca não foi aplicada).
 *
 * IP do leitor: client-side não temos como obter o IP real — usamos
 * `navigator.userAgent` truncado em 30 chars como proxy. O IP real, quando
 * forensemente necessário, é obtido pela edge function `watermark-pdf`
 * (ver `supabase/functions/watermark-pdf/index.ts`).
 */
import { useEffect, useRef, useState } from 'react';
import { PDFViewer } from '@/design-system/components/ui/pdf-viewer-lazy';
import { useUser } from '@/contexts/UserContext';
import { applyWatermark, buildWatermarkLines } from '@/utils/watermark';

const FEATURE_FLAG = import.meta.env.VITE_FEATURE_WATERMARK === 'true';

export function PDFViewerWithWatermark({ url, src, ...rest }) {
  // Aceita tanto `url` (interface da spec) quanto `src` (interface do PDFViewer DS).
  const sourceUrl = url || src;
  const { user } = useUser() || {};
  const [stampedUrl, setStampedUrl] = useState(null);
  const [stamping, setStamping] = useState(FEATURE_FLAG);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!FEATURE_FLAG || !sourceUrl) {
      setStampedUrl(null);
      setStamping(false);
      return undefined;
    }

    let cancelled = false;
    setStamping(true);

    (async () => {
      try {
        const resp = await fetch(sourceUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const bytes = await resp.arrayBuffer();

        // TODO: implementar via edge function `watermark-pdf` que recebe
        // `X-Forwarded-For` para usar o IP real do leitor. Aqui é client-side,
        // então usamos UA truncado como melhor esforço.
        const uaProxy = (navigator.userAgent || '').slice(0, 30);

        const subLines = buildWatermarkLines({
          name: user?.displayName || user?.name,
          email: user?.email,
          ip: uaProxy,
          timestamp: new Date(),
        });

        const stampedBytes = await applyWatermark(bytes, {
          text: 'CÓPIA NÃO CONTROLADA',
          subLines,
        });

        if (cancelled) return;

        const blob = new Blob([stampedBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        // Revoga o Blob URL anterior, se houver.
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = blobUrl;

        setStampedUrl(blobUrl);
        setStamping(false);
      } catch (err) {
        console.warn(
          '[PDFViewerWithWatermark] Falha ao aplicar watermark, exibindo PDF original:',
          err,
        );
        if (!cancelled) {
          setStampedUrl(null);
          setStamping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl, user?.displayName, user?.name, user?.email]);

  // Cleanup final do Blob URL no unmount.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Enquanto carrega o PDF marcado, evita flash do original (sem watermark).
  // Se demora demais ou falha, cai no PDF original via `stampedUrl=null`.
  const effectiveSrc = stampedUrl || (stamping ? null : sourceUrl);

  return <PDFViewer src={effectiveSrc} {...rest} />;
}

export default PDFViewerWithWatermark;
