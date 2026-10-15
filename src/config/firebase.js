/**
 * Firebase Configuration
 * Projeto: anest-ap (mesmo do app legado)
 */
import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, indexedDBLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDhFmRaMrLxKAlylqEZqXQtp3737ggJsGw",
  authDomain: "anest-ap.firebaseapp.com",
  projectId: "anest-ap",
  storageBucket: "anest-ap.firebasestorage.app",
  messagingSenderId: "899341881349",
  appId: "1:899341881349:web:33f38263f2c4b29f204c6c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth SEM o resolvedor de popup/redirect (abertura do app, 15/10/2026). O
// `getAuth()` traz o `browserPopupRedirectResolver`, que na inicialização baixa
// o gapi (apis.google.com) e monta o iframe /__/auth/iframe ANTES de restaurar a
// sessão — ~250 ms de rede e CPU no caminho de toda abertura, medidos em
// produção. O app só entra por e-mail/senha (nenhum signInWithPopup/Redirect).
//
// Persistência: localStorage primeiro, porque é onde a sessão de todo mundo já
// está (o `setPersistence(browserLocalPersistence)` antigo migrava a cada boot);
// o IndexedDB fica atrás só para quem ainda tiver sessão gravada lá — o SDK a
// encontra e migra para o primeiro da lista, sem pedir login de novo. A sessão
// da aba vem por último (como no `getAuth()` padrão): é onde fica o login feito
// SEM "Manter conectado" (LoginPage), que assim sobrevive a um recarregamento e
// continua não sendo migrado para o disco.
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, indexedDBLocalPersistence, browserSessionPersistence],
});

/**
 * Resolve quando o Firebase termina de restaurar a sessão (inclusive a ida à
 * rede que confirma o token). Quem lê `auth.currentUser` logo na abertura
 * precisa esperar por isto: com a sessão otimista do UserContext o app já está
 * na tela antes de o Firebase confirmar quem é o usuário.
 */
export const authPronto = () => auth.authStateReady();

// Sprint 14d: Firestore com persistência local (IndexedDB) habilitada.
// Permite que writes/reads funcionem offline e sincronizem ao reconectar.
// `persistentMultipleTabManager` coordena várias abas do mesmo browser.
// `initializeFirestore` precisa ser chamado UMA ÚNICA VEZ antes de qualquer
// outro acesso ao Firestore — daí o try/catch idempotente com fallback para
// getFirestore quando o cache não pode ser inicializado.
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (error) {
  // `failed-precondition`: multi-tab sem suporte / já inicializado em outra parte
  // `unimplemented`: browser sem IndexedDB (Safari private, etc.)
  // Em qualquer caso, degradamos para o Firestore in-memory padrão.
  console.warn(
    '[firebase] persistência local indisponível, usando cache in-memory:',
    error?.code || error?.message || error
  );
  firestoreInstance = getFirestore(app);
}
export const db = firestoreInstance;
export const storage = getStorage(app);

// Cloud Functions sob demanda: só o import de questões da Educação chama, e o
// SDK saía em todo boot por causa do `getFunctions` aqui no topo.
let _functions = null;
export async function obterFunctions() {
  if (!_functions) {
    const { getFunctions } = await import('firebase/functions');
    _functions = getFunctions(app, 'us-central1');
  }
  return _functions;
}

export default app;
