/**
 * useUnsavedChangesGuard
 * --------------------
 * Hook custom para proteger formulários/modais contra perda acidental de
 * alterações não salvas. Cobre dois canais de "fechamento":
 *
 *  1) Sair da aba/janela (refresh, fechar tab) → registra `beforeunload`.
 *  2) Fechar internamente o modal/formulário → expõe `requestClose(closeFn)`
 *     que dispara um ConfirmDialog antes de chamar `closeFn`.
 *
 * Uso:
 *   const guard = useUnsavedChangesGuard(isDirty);
 *
 *   // No header/X do modal e ao clicar no overlay:
 *   onClose={() => guard.requestClose(actuallyCloseModal)}
 *
 *   // Renderizar ConfirmDialog em algum ponto do componente:
 *   <ConfirmDialog
 *     open={guard.confirmOpen}
 *     onClose={guard.cancelClose}
 *     onConfirm={guard.confirmClose}
 *     title="Descartar alterações?"
 *     description="Você tem alterações não salvas que serão perdidas."
 *     confirmText="Descartar"
 *     cancelText="Continuar editando"
 *     variant="danger"
 *   />
 *
 * Wave 2 / W2-2 — DocumentoDetalhePage A11y residual.
 *
 * @module hooks/useUnsavedChangesGuard
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {boolean} isDirty   - true quando o formulário tem alterações pendentes
 * @returns {{
 *   confirmOpen: boolean,
 *   requestClose: (closeFn?: () => void) => void,
 *   confirmClose: () => void,
 *   cancelClose: () => void,
 * }}
 */
export function useUnsavedChangesGuard(isDirty) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Guarda a função de close que devemos chamar APÓS o usuário confirmar.
  const pendingCloseRef = useRef(null);

  // 1) beforeunload — refresh / fechar tab
  useEffect(() => {
    if (!isDirty) return undefined;

    const handler = (event) => {
      // Spec moderna requer preventDefault + returnValue para exibir o prompt.
      event.preventDefault();
      // Chrome legado lê returnValue; mensagem custom é ignorada hoje em dia.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // 2) requestClose — chamar no lugar de close direto.
  // Se NÃO está dirty, fecha imediatamente. Se está dirty, abre ConfirmDialog.
  const requestClose = useCallback(
    (closeFn) => {
      if (typeof closeFn !== 'function') {
        // Sem callback: apenas sinaliza intenção (fluxo simples).
        if (isDirty) {
          setConfirmOpen(true);
        }
        return;
      }

      if (!isDirty) {
        closeFn();
        return;
      }
      pendingCloseRef.current = closeFn;
      setConfirmOpen(true);
    },
    [isDirty]
  );

  const confirmClose = useCallback(() => {
    setConfirmOpen(false);
    const fn = pendingCloseRef.current;
    pendingCloseRef.current = null;
    if (typeof fn === 'function') fn();
  }, []);

  const cancelClose = useCallback(() => {
    setConfirmOpen(false);
    pendingCloseRef.current = null;
  }, []);

  return {
    confirmOpen,
    requestClose,
    confirmClose,
    cancelClose,
  };
}

export default useUnsavedChangesGuard;
