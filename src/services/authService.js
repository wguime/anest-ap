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
 * Cadastro de novo usuario
 */
export async function signUp(email, password, displayName) {
  try {
    // Criar usuario no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Atualizar displayName
    await updateProfile(user, { displayName });

    // Criar perfil no Firestore
    await createUserProfile(user, displayName);

    return { user, error: null };
  } catch (error) {
    return { user: null, error: getErrorMessage(error.code) };
  }
}

/**
 * Criar perfil do usuario no Firestore
 */
async function createUserProfile(user, displayName) {
  const nameParts = displayName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  const userProfile = {
    uid: user.uid,
    email: user.email,
    firstName,
    lastName,
    displayName,
    role: 'colaborador', // Cargo principal padrão para novos usuários
    isAdmin: false,
    isCoordenador: false,
    crm: '',
    especialidade: '',
    avatar: null,
    permissions: {
      // Permissões mínimas iniciais (ajuste fino via Centro de Gestão)
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
