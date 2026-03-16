import { useCallback, useRef } from 'react';
import { useUser } from '../contexts/UserContext';

export function useCardPermissions() {
  const { user } = useUser();
  const loggedRef = useRef(false);

  // Log permissions summary once per user change (avoid spam)
  if (user && !loggedRef.current) {
    loggedRef.current = true;
    const perms = user.permissions;
    const permKeys = perms && typeof perms === 'object' ? Object.keys(perms).length : 0;
    const disabled = perms && typeof perms === 'object'
      ? Object.entries(perms).filter(([, v]) => v === false).map(([k]) => k)
      : [];
    console.info('[useCardPermissions] User permissions loaded:', {
      userId: user.id,
      isAdmin: user.isAdmin,
      isCoordenador: user.isCoordenador,
      customPermissions: user.customPermissions,
      permissionKeys: permKeys,
      disabledCards: disabled,
      bypassAll: !!(user.isAdmin || user.isCoordenador),
    });
  }
  // Reset log flag when user changes
  if (!user) loggedRef.current = false;

  const canAccessCard = useCallback((cardId) => {
    // Admins/coordenadores veem tudo
    if (user?.isAdmin || user?.isCoordenador) return true;
    // Sem permissions definidas = acesso total (retrocompat)
    if (!user?.permissions || typeof user.permissions !== 'object') return true;
    // Valor explicito: respeitar
    if (user.permissions[cardId] !== undefined) {
      const allowed = user.permissions[cardId] === true;
      if (!allowed) {
        console.debug(`[Permissions] Card "${cardId}" BLOQUEADO para user ${user.id}`);
      }
      return allowed;
    }
    // cardId NAO esta nas permissions:
    // Se o admin definiu permissoes customizadas (customPermissions === true)
    // e o objeto permissions tem muitas keys (> 5), entao o cardId foi
    // intencionalmente omitido ou o dado esta stale → bloquear por seguranca.
    // Caso contrario, permitir (retrocompat: usuario sem customizacao).
    if (user.customPermissions === true) {
      const keyCount = Object.keys(user.permissions).length;
      if (keyCount > 5) {
        // Permissions object esta completo mas nao tem este cardId → card novo, permitir
        return true;
      }
      // Permissions object tem poucas keys = dados stale (Firestore nao sincronizou)
      // Bloquear ate reconciliacao completar
      console.debug(`[Permissions] Card "${cardId}" BLOQUEADO (stale data, customPermissions=true, only ${keyCount} keys)`);
      return false;
    }
    // Sem customPermissions: usuario nunca teve permissoes editadas → permitir tudo
    return true;
  }, [user]);

  return { canAccessCard };
}
