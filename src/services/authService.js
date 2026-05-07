/**
 * Auth Service
 * Funcoes de autenticacao Firebase
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { supabase } from '../config/supabase';

/**
 * Login com email e senha
 */
export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: getErrorMessage(error.code) };
  }
}

/**
 * Cadastro de novo usuario.
 * Bloqueia ANTES de criar conta Firebase se email nao estiver autorizado.
 * Cria profile Supabase de forma sincrona via rpc_create_profile, que aplica
 * o role pre-selecionado em authorized_emails.role.
 */
export async function signUp(email, password, displayName) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    // Pre-check: email precisa estar autorizado em authorized_emails (via RPC anon-friendly)
    const authorization = await fetchAuthorization(normalizedEmail);
    if (!authorization.found) {
      return {
        user: null,
        error: 'Email nao autorizado. Solicite ao administrador para cadastrar seu email antes de criar a conta.',
      };
    }

    // Criar usuario no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;

    // Atualizar displayName
    await updateProfile(user, { displayName });

    // Criar perfil Supabase via RPC ANTES do Firestore para obter role pre-selecionado.
    // RPC e SECURITY DEFINER (GRANT to anon), valida allowlist e aplica
    // authorized_emails.role > p_role > 'colaborador'. Retorna o profile completo.
    let resolvedRole = null;
    const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_create_profile', {
      p_id: user.uid,
      p_nome: displayName,
      p_email: normalizedEmail,
      p_role: 'colaborador',
    });
    if (rpcErr) {
      console.warn('[authService] rpc_create_profile failed durante signUp:', rpcErr.message);
      // UserContext.reconcileFromSupabase tentara novamente e mostra toast se persistir.
    } else if (rpcData?.role) {
      resolvedRole = rpcData.role;
    }

    // Criar perfil no Firestore com role definitivo (de rpc_create_profile)
    await createUserProfile(user, displayName, resolvedRole);

    return { user, error: null };
  } catch (error) {
    return { user: null, error: getErrorMessage(error.code) };
  }
}

/**
 * Verifica se email esta autorizado em authorized_emails.
 * Usa RPC SECURITY DEFINER (rpc_is_email_authorized) para funcionar com anon
 * antes do user ser autenticado no Supabase (RLS bloqueia SELECT direto para anon).
 * O role pre-selecionado e aplicado server-side por rpc_create_profile depois.
 */
async function fetchAuthorization(email) {
  const { data, error } = await supabase.rpc('rpc_is_email_authorized', {
    p_email: email,
  });
  if (error) {
    console.warn('[authService] fetchAuthorization error:', error.message);
    // Em caso de erro de rede, falha conservadora: bloqueia (caller mostra mensagem).
    return { found: false };
  }
  return { found: data === true };
}

/**
 * Criar perfil do usuario no Firestore
 */
async function createUserProfile(user, displayName, authorizedRole = null) {
  const nameParts = displayName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  const userProfile = {
    uid: user.uid,
    email: user.email,
    firstName,
    lastName,
    displayName,
    role: authorizedRole || 'colaborador',
    isAdmin: false,
    isCoordenador: false,
    crm: '',
    especialidade: '',
    avatar: null,
    permissions: {
      'doc-protocolos': true,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'userProfiles', user.uid), userProfile);
  return userProfile;
}

/**
 * Logout
 */
export async function logOut() {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: getErrorMessage(error.code) };
  }
}

/**
 * Enviar email de recuperacao de senha
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
}

/**
 * Buscar perfil do usuario no Firestore
 */
export async function getUserProfile(userId) {
  try {
    const docRef = doc(db, 'userProfiles', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { profile: { id: docSnap.id, ...docSnap.data() }, error: null };
    } else {
      return { profile: null, error: 'Perfil nao encontrado' };
    }
  } catch (error) {
    return { profile: null, error: error.message };
  }
}

/**
 * Observer de mudancas no estado de autenticacao
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Obter usuario atual
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Converter codigos de erro do Firebase para mensagens em portugues
 */
function getErrorMessage(errorCode) {
  const errorMessages = {
    'auth/email-already-in-use': 'Este e-mail ja esta cadastrado',
    'auth/invalid-email': 'E-mail invalido',
    'auth/operation-not-allowed': 'Operacao nao permitida',
    'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres',
    'auth/user-disabled': 'Esta conta foi desativada',
    'auth/user-not-found': 'Usuario nao encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/invalid-credential': 'E-mail ou senha incorretos',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
    'auth/network-request-failed': 'Erro de conexao. Verifique sua internet',
    'auth/popup-closed-by-user': 'Login cancelado',
    'auth/requires-recent-login': 'Por favor, faca login novamente',
  };

  return errorMessages[errorCode] || 'Erro ao processar sua solicitacao';
}
