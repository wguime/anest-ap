import { useEffect } from 'react';
import { aplicarPoliticaOrientacao } from '@/lib/orientacaoTela';

/**
 * Instala a trava de retrato do app (chamada uma vez, no App).
 *
 * A regra e as duas camadas de enforcement estão em `src/lib/orientacaoTela.js`.
 * Aqui só se aplica o estado inicial — as exceções (documento/vídeo) entram por
 * `useLandscapePermitido`, e este hook NÃO as atropela: a política respeita
 * concessões já ativas.
 */
export function useLockPortraitOrientation() {
  useEffect(() => {
    aplicarPoliticaOrientacao();
  }, []);
}
