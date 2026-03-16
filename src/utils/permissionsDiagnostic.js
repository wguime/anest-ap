/**
 * Permissions Diagnostic Utility
 *
 * Paste this into browser DevTools console to verify permissions enforcement.
 * Or import at runtime for automated testing.
 *
 * Usage (console):
 *   1. Open the app in browser
 *   2. Open DevTools > Console
 *   3. Paste the contents of this file
 *   4. Run: window.__diagPermissions()
 */

// All card IDs from NAV_STRUCTURE (rolePermissionTemplates.js)
const ALL_CARD_IDS = [
  // Home
  'comunicados', 'pendencias', 'perfil', 'atalhos', 'plantao', 'ferias',
  'estagios_residencia', 'plantao_residencia', 'escala_funcionarios', 'inbox',
  // Gestao
  'incidentes', 'relatar_notificacao', 'fazer_denuncia', 'meus_relatos',
  'notificacao_unimed', 'qrcode_generator', 'biblioteca', 'qualidade',
  'painel_gestao', 'planos_acao', 'auditorias', 'auditorias_interativas',
  'autoavaliacao', 'relatorios', 'organograma', 'etica_bioetica', 'comites',
  'desastres', 'gestao_documental', 'faturamento', 'escalas', 'reunioes',
  // Dashboard
  'dashboard_executivo',
  // Educacao
  'educacao_continuada', 'rops_desafio', 'residencia',
  // Menu
  'calculadoras', 'manutencao',
];

/**
 * Run comprehensive permissions diagnostic.
 * Call from browser console: window.__diagPermissions()
 */
function diagPermissions() {
  console.group('%c=== PERMISSIONS DIAGNOSTIC ===', 'color: #006837; font-size: 14px; font-weight: bold');

  // 1. Get current user from React fiber
  const user = getUserFromReact();
  if (!user) {
    console.error('Could not find user in React state. Are you logged in?');
    console.groupEnd();
    return;
  }

  console.log('%c[1] User Info', 'color: #2563eb; font-weight: bold');
  console.table({
    id: user.id || user.uid,
    email: user.email,
    role: user.role,
    isAdmin: !!user.isAdmin,
    isCoordenador: !!user.isCoordenador,
    bypassAll: !!(user.isAdmin || user.isCoordenador),
  });

  // 2. Check permissions object
  console.log('%c[2] Permissions Object', 'color: #2563eb; font-weight: bold');
  const perms = user.permissions;
  if (!perms || typeof perms !== 'object') {
    console.warn('No permissions object found. All cards will be VISIBLE (retrocompat mode).');
    console.log('permissions value:', perms);
  } else {
    const totalKeys = Object.keys(perms).length;
    const enabled = Object.entries(perms).filter(([, v]) => v === true);
    const disabled = Object.entries(perms).filter(([, v]) => v === false);
    const other = Object.entries(perms).filter(([, v]) => v !== true && v !== false);

    console.log(`Total keys: ${totalKeys}`);
    console.log(`Enabled (true): ${enabled.length}`, enabled.map(([k]) => k));
    console.log(`%cDisabled (false): ${disabled.length}`, 'color: red; font-weight: bold', disabled.map(([k]) => k));
    if (other.length > 0) {
      console.warn('Unexpected values:', other);
    }
  }

  // 3. Simulate canAccessCard for ALL card IDs
  console.log('%c[3] Card Access Simulation', 'color: #2563eb; font-weight: bold');
  const results = {};
  ALL_CARD_IDS.forEach(cardId => {
    let access;
    let reason;
    if (user.isAdmin || user.isCoordenador) {
      access = true;
      reason = 'admin/coord bypass';
    } else if (!perms || typeof perms !== 'object') {
      access = true;
      reason = 'no permissions object (retrocompat)';
    } else if (perms[cardId] === undefined) {
      access = true;
      reason = 'cardId not in permissions (undefined = allow)';
    } else if (perms[cardId] === true) {
      access = true;
      reason = 'explicitly allowed';
    } else if (perms[cardId] === false) {
      access = false;
      reason = 'BLOCKED';
    } else {
      access = true;
      reason = `unexpected value: ${perms[cardId]}`;
    }
    results[cardId] = { access, reason };
  });

  const blocked = Object.entries(results).filter(([, r]) => !r.access);
  const allowed = Object.entries(results).filter(([, r]) => r.access);

  console.log(`%cBLOCKED cards (${blocked.length}):`, 'color: red; font-weight: bold');
  if (blocked.length > 0) {
    console.table(Object.fromEntries(blocked));
  } else {
    console.log('  (none — all cards accessible)');
  }

  console.log(`Allowed cards: ${allowed.length}/${ALL_CARD_IDS.length}`);

  // 4. Check missing card IDs (in permissions but not in NAV_STRUCTURE)
  if (perms && typeof perms === 'object') {
    const extraKeys = Object.keys(perms).filter(k => !ALL_CARD_IDS.includes(k));
    if (extraKeys.length > 0) {
      console.warn('Keys in permissions not in NAV_STRUCTURE:', extraKeys);
    }
    const missingKeys = ALL_CARD_IDS.filter(k => perms[k] === undefined);
    if (missingKeys.length > 0) {
      console.log('Card IDs NOT in permissions (will default to allowed):', missingKeys);
    }
  }

  // 5. Summary
  console.log('%c[4] Summary', 'color: #2563eb; font-weight: bold');
  if (user.isAdmin || user.isCoordenador) {
    console.log('%cThis user BYPASSES all permission checks (admin/coord).', 'color: #16a085; font-weight: bold');
    console.log('To test permissions, log in as a regular user.');
  } else if (blocked.length === 0) {
    console.log('%cAll cards are accessible. Either permissions are all true or not set.', 'color: #f59e0b; font-weight: bold');
  } else {
    console.log(`%c${blocked.length} cards are BLOCKED. These features should be hidden.`, 'color: red; font-weight: bold');
  }

  console.groupEnd();
  return { user: { id: user.id, role: user.role, isAdmin: user.isAdmin, isCoordenador: user.isCoordenador }, blocked, allowed, permissions: perms };
}

/**
 * Extract user object from React internal state.
 */
function getUserFromReact() {
  // Method 1: Try to find UserContext value via React fiber tree
  const rootEl = document.getElementById('root');
  if (!rootEl || !rootEl._reactRootContainer && !rootEl.__reactFiber) {
    // Try React 18 approach
    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber'));
    if (fiberKey) {
      return findUserInFiber(rootEl[fiberKey]);
    }
    return null;
  }
  // React 17
  if (rootEl._reactRootContainer) {
    const fiber = rootEl._reactRootContainer._internalRoot?.current;
    if (fiber) return findUserInFiber(fiber);
  }
  return null;
}

function findUserInFiber(fiber, depth = 0) {
  if (depth > 50) return null;
  if (!fiber) return null;

  // Check memoizedState for context values
  let state = fiber.memoizedState;
  while (state) {
    if (state.queue?.lastRenderedState?.user?.permissions !== undefined) {
      return state.queue.lastRenderedState.user;
    }
    // Check for context value shape
    const val = state.memoizedState;
    if (val && typeof val === 'object' && val.user && (val.isAuthenticated !== undefined || val.login)) {
      return val.user;
    }
    state = state.next;
  }

  // Check pendingProps for context value
  if (fiber.memoizedProps?.value?.user && fiber.memoizedProps?.value?.isAuthenticated !== undefined) {
    return fiber.memoizedProps.value.user;
  }

  // Traverse child and sibling
  let result = findUserInFiber(fiber.child, depth + 1);
  if (result) return result;
  result = findUserInFiber(fiber.sibling, depth + 1);
  return result;
}

// Expose globally for console usage
if (typeof window !== 'undefined') {
  window.__diagPermissions = diagPermissions;
  console.info('[PermissionsDiagnostic] Loaded. Run window.__diagPermissions() to check permissions.');
}

export { diagPermissions, ALL_CARD_IDS };
