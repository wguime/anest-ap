import { useLockPortraitOrientation } from '@/hooks/useLockPortraitOrientation';

/**
 * Bloqueio do modo paisagem (dono 25/08) — o ANEST é um app de RETRATO.
 *
 * Duas responsabilidades, juntas de propósito: instala a trava (`useLock...`,
 * que é o lock nativo do Android/PWA) e desenha o aviso que segura o iPhone,
 * onde o lock não existe. Uma coisa sem a outra deixa metade dos aparelhos de
 * fora.
 *
 * Fica em `main.jsx`, ACIMA do portão de autenticação: a tela de login e o
 * spinner de boot também são o app. Fora do alcance de propósito: as rotas
 * públicas `/verificar/*`, que são leitura de documento por quem não é da
 * equipe.
 *
 * Quem mostra/esconde é o CSS (`.landscape-block-overlay` em index.css), a
 * partir da classe `landscape-liberado` no `<html>` — a exceção de documento e
 * vídeo entra por `useLandscapePermitido`, nunca por uma condição aqui.
 */
export function LandscapeBlockOverlay() {
  useLockPortraitOrientation();

  return (
    <div className="landscape-block-overlay" role="alert">
      <div className="w-16 h-16 mb-4 text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Gire seu dispositivo
      </h2>
      <p className="text-sm text-muted-foreground">
        O ANEST funciona em modo retrato.
        <br />
        A tela deitada vale para ler documentos e assistir vídeos.
      </p>
    </div>
  );
}

export default LandscapeBlockOverlay;
