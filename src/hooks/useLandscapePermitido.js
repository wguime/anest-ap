import { useEffect } from 'react';
import { permitirLandscape } from '@/lib/orientacaoTela';

/**
 * Libera a rotação da tela enquanto o componente estiver montado (ou enquanto
 * `ativo` for verdadeiro). É a porta de entrada da exceção descrita em
 * `src/lib/orientacaoTela.js`: documento e vídeo giram, o resto do app não.
 *
 * @param {boolean} [ativo=true] — permite condicionar (ex.: só com o PDF aberto)
 */
export function useLandscapePermitido(ativo = true) {
  useEffect(() => {
    if (!ativo) return undefined;
    return permitirLandscape();
  }, [ativo]);
}
