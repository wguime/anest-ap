/**
 * UserContext
 * Gerencia estado do usuario e autenticacao Firebase.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, updateDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, authPronto, db } from '../config/firebase';
import { signIn, signUp, logOut, resetPassword, onAuthChange } from '../services/authService';
import supabaseUsersService from '../services/supabaseUsersService';
import { supabase } from '../config/supabase';
import { createReliableSubscription } from '../services/supabaseSubscriptionHelper';
import { uploadToSupabase, deleteAnyStorageObject, STORAGE_BUCKETS } from '../lib/storage';
import { lerSessaoSalva, gravarSessao, limparSessao } from '../lib/sessaoSalva';
import { usuarioFirebaseNoAparelho } from '../lib/tokenPersistido';

const UserContext = createContext(null);

// UIDs de administradores — lidos de variavel de ambiente para nao vazar no codigo-fonte
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').filter(Boolean);

/**
 * Campos que SÓ admin escreve em userProfiles — espelha privilegedUserFields()
 * de firestore.rules. Manter os dois lados iguais: a regra é a que vale, esta
 * lista só evita disparar uma escrita que o servidor vai recusar.
 */
const CAMPOS_PRIVILEGIADOS = new Set([
  'isAdmin', 'isCoordenador', 'role', 'tipoUsuario',
  'permissions', 'customPermissions', 'cardPermissions',
  'documentCategoryPermissions', 'documentIndividualPermissions',
  'documentWritePermissions',
]);

/** Campos que a reconciliação com o Supabase decide (ver reconcileFromSupabase). */
const CAMPOS_RECONCILIADOS = ['role', 'isAdmin', 'isCoordenador', 'customPermissions', 'rankingOptIn', 'permissions'];

const camposReconciliados = (perfil) =>
  Object.fromEntries(CAMPOS_RECONCILIADOS.map((k) => [k, perfil?.[k]]));

/**
 * Garante que usuarios com UIDs de admin tenham as flags corretas,
 * independente do que esta no Firestore.
 */
function ensureAdminFlags(profile) {
  if (!profile) return profile;
  const uid = profile.uid || profile.id;
  if (ADMIN_UIDS.includes(uid)) {
    return {
      ...profile,
      isAdmin: true,
      role: profile.role === 'colaborador' ? 'administrador' : profile.role,
    };
  }
  return profile;
}

/**
 * Redimensiona imagem para maxDim mantendo proporcao. Retorna Blob JPEG.
 */
function resizeImage(file, maxDim = 512, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Erro ao processar imagem'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Erro ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

export function UserProvider({ children, forceMock = false }) {
  const useMock = forceMock;
  const useMockRef = useRef(useMock);
  useMockRef.current = useMock;

  // Última decisão da reconciliação Supabase→Firestore para campos que só admin
  // persiste. Sobrevive entre snapshots do mesmo login; zerada a cada troca de
  // usuário no onAuthChange.
  const reconciliadoRef = useRef(null);

  // SESSÃO OTIMISTA (abertura instantânea, 15/10/2026). Com o perfil do último
  // login confirmado no aparelho, o app nasce autenticado e desenha a Home na
  // hora; o Firebase confirma em segundo plano. Antes, toda abertura esperava
  // o Firebase validar o token na rede (1,2–1,9 s medidos; 30–60 s com a rede
  // do hospital pendurada) atrás de um spinner, com a Home já pronta em cache.
  // Dado de negócio não vem daqui: o Firestore espera a confirmação; o Supabase
  // pode ler antes só com o token que o Firebase já guardou (mesmo uid, válido —
  // ver src/lib/tokenPersistido.js), e a RLS vale pelo uid. `firebaseUser`
  // continua null até a confirmação — é o sinal de "confirmado".
  // Só vale se o Firebase também guardou no aparelho o login do MESMO uid: app
  // fechado à força entre o login de outra conta e a chegada do perfil dela (ou
  // no meio de um logout) deixaria a cópia de quem saiu na tela de quem entrou.
  const [sessaoInicial] = useState(() => {
    if (useMock) return null;
    const salva = lerSessaoSalva();
    if (!salva) return null;
    const doFirebase = usuarioFirebaseNoAparelho({
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      apiKey: auth.app?.options?.apiKey,
      appName: auth.app?.name,
      uid: salva.uid,
    });
    return doFirebase ? salva : null;
  });
  // uid exibido sem confirmação; zera quando o Firebase confirma ou desmente
  const uidOtimistaRef = useRef(sessaoInicial?.uid || null);
  // Papel/permissões da sessão salva valem até a 1ª reconciliação desta abertura
  // (ver o snapshot abaixo): o doc do Firestore pode estar atrás do Supabase.
  const segurarReconciliadosRef = useRef(!!sessaoInicial);
  const tetoReconciliacaoRef = useRef(null);

  const [user, setUser] = useState(() => (sessaoInicial ? ensureAdminFlags(sessaoInicial.perfil) : null));
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoading, setIsLoading] = useState(!useMock && !sessaoInicial);
  const [isAuthenticated, setIsAuthenticated] = useState(useMock || !!sessaoInicial);
  const [error, setError] = useState(null);

  // Listener de mudancas no estado de autenticacao Firebase
  useEffect(() => {
    if (useMock) return;
    let unsubProfile = null;
    let cleanupIncidentSettingsSub = null;

    const unsubAuth = onAuthChange(async (fbUser) => {
      // Limpar listener anterior do perfil
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (cleanupIncidentSettingsSub) { cleanupIncidentSettingsSub(); cleanupIncidentSettingsSub = null; }
      // Outro login = outra reconciliação; não carregar o papel de quem saiu.
      reconciliadoRef.current = null;

      if (fbUser) {
        // A sessão salva era de OUTRA conta: o perfil dela não fica na tela nem
        // um instante a mais — volta ao spinner até o perfil desta chegar.
        if (uidOtimistaRef.current && uidOtimistaRef.current !== fbUser.uid) {
          limparSessao();
          segurarReconciliadosRef.current = false;
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(true);
        }
        uidOtimistaRef.current = null;
        setFirebaseUser(fbUser);

        // Listener em tempo real do perfil no Firestore.
        // Error handler garante que o gate de auth (em main.jsx) nunca fica
        // preso em spinner se o Firestore falhar (RLS, network, perfil
        // ausente). Sem isso, isLoading fica true para sempre e o usuário
        // não chega na home nem no LoginPage.
        const profileRef = doc(db, 'userProfiles', fbUser.uid);
        unsubProfile = onSnapshot(profileRef, async (snap) => {
          if (snap.exists()) {
            const rawProfile = { id: snap.id, ...snap.data() };
            // O doc do Firestore pode estar atrás do Supabase em campo que só
            // admin grava. Sem reaplicar a última reconciliação, QUALQUER escrita
            // no doc (token de push, consentimento LGPD) reentrega o papel velho
            // e o gate da escala pisca até a reconciliação seguinte resolver.
            const perfilBase = ensureAdminFlags(rawProfile);
            const enrichedProfile = reconciliadoRef.current
              ? ensureAdminFlags({ ...rawProfile, ...reconciliadoRef.current })
              : perfilBase;
            // Mesmo usuário já na tela (sessão salva ou snapshot anterior):
            //  - `incidentSettings` não vem do Firestore — fica até o fetch abaixo
            //    trocar, em vez de sumir e voltar (o acesso ao Centro de Gestão piscava);
            //  - com a sessão salva, o papel/permissões dela ficam até a 1ª
            //    reconciliação desta abertura: o doc pode trazer o papel velho e o
            //    card da escala piscaria ao abrir (o laço de 27/08, pela outra porta).
            setUser((prev) => {
              if (!prev || (prev.uid || prev.id) !== rawProfile.id) return enrichedProfile;
              const mantidos = segurarReconciliadosRef.current ? camposReconciliados(prev) : {};
              return ensureAdminFlags({ ...enrichedProfile, ...mantidos, incidentSettings: prev.incidentSettings });
            });

            // Buscar settings de notificação de incidentes do usuário (para acesso ao Centro de Gestão)
            // Falha da leitura = sem acesso (padrão seguro): o valor que veio da
            // sessão salva não pode valer a sessão inteira — um "responsável"
            // revogado pelo admin seguiria entrando na gestão de denúncias.
            supabaseUsersService.fetchMyIncidentSettings(fbUser.uid)
              .then((settings) => {
                setUser(prev => prev ? { ...prev, incidentSettings: settings } : prev);
              })
              .catch((err) => {
                console.warn('[UserContext] fetchMyIncidentSettings failed:', err);
                setUser(prev => prev
                  ? { ...prev, incidentSettings: { isResponsible: false, receberIncidentes: false, receberDenuncias: false } }
                  : prev);
              });

            // Realtime: revogação imediata quando admin altera receber_incidentes/denuncias.
            // Sem isso, o user-alvo só perderia acesso no próximo login.
            // Setup uma única vez por sessão (após resolver fbUser.uid).
            if (!cleanupIncidentSettingsSub) {
              const { cleanup } = createReliableSubscription({
                channelName: `incident-settings-self-${fbUser.uid}`,
                table: 'incident_notification_settings',
                filter: `user_id=eq.${fbUser.uid}`,
                callback: ({ eventType, new: newRow }) => {
                  if (eventType === 'DELETE') {
                    setUser(prev => prev
                      ? { ...prev, incidentSettings: { isResponsible: false, receberIncidentes: false, receberDenuncias: false } }
                      : prev
                    );
                    return;
                  }
                  if (!newRow) return;
                  const settings = {
                    isResponsible: !!(newRow.receber_incidentes || newRow.receber_denuncias),
                    receberIncidentes: !!newRow.receber_incidentes,
                    receberDenuncias: !!newRow.receber_denuncias,
                  };
                  setUser(prev => prev ? { ...prev, incidentSettings: settings } : prev);
                },
                onRefetch: async () => {
                  try {
                    const settings = await supabaseUsersService.fetchMyIncidentSettings(fbUser.uid);
                    setUser(prev => prev ? { ...prev, incidentSettings: settings } : prev);
                  } catch (err) {
                    console.warn('[UserContext] incidentSettings refetch failed:', err);
                  }
                },
              });
              cleanupIncidentSettingsSub = cleanup;
            }

            // Sincronizar flags de admin de volta ao Firestore se ensureAdminFlags mudou algo
            // (o writeback dispara onSnapshot de novo, mas na segunda vez os valores já batem
            //  e a condição é false — sem loop infinito)
            //
            // `isAdmin`/`role` são campos de privilégio: firestore.rules só aceita
            // de quem JÁ é admin no doc. Sem o guarda, quem está em VITE_ADMIN_UIDS
            // mas com isAdmin=false no Firestore dispara uma escrita recusada, e o
            // rollback do SDK reentrega o snapshot velho — o mesmo laço que fazia o
            // papel piscar. Comparar com perfilBase (e não com enrichedProfile, que
            // já carrega a reconciliação do Supabase) mantém este writeback restrito
            // ao que ensureAdminFlags mudou.
            if (rawProfile.isAdmin === true
              && (perfilBase.isAdmin !== rawProfile.isAdmin || perfilBase.role !== rawProfile.role)) {
              updateDoc(profileRef, {
                isAdmin: perfilBase.isAdmin,
                role: perfilBase.role,
                updatedAt: new Date(),
              }).catch((err) => console.warn('Falha ao sincronizar admin flags:', err));
            }

            // Reconciliar Supabase → Firestore (background, com retry).
            // Supabase é source of truth. Se o Centro de Gestão salvou permissões no
            // Supabase mas o sync para Firestore falhou, esta reconciliação corrige.
            // Retry: JWT do Supabase pode não estar pronto no primeiro onSnapshot.
            // Reconciliação que não conseguiu responder (3 tentativas): a cópia do
            // disco não pode valer a sessão inteira — um acesso revogado seguiria na
            // tela. Volta ao doc do Firestore, como era antes da sessão salva.
            const soltarSemReconciliar = () => {
              if (!segurarReconciliadosRef.current) return;
              segurarReconciliadosRef.current = false;
              const doFirestore = camposReconciliados(rawProfile);
              setUser(prev => prev ? ensureAdminFlags({ ...prev, ...doFirestore }) : prev);
            };
            // Consulta pendurada também solta (o supabase-js não tem timeout):
            // no máximo 15 s de papel vindo da cópia do disco.
            if (segurarReconciliadosRef.current && !tetoReconciliacaoRef.current) {
              tetoReconciliacaoRef.current = setTimeout(soltarSemReconciliar, 15000);
            }
            const reconcileFromSupabase = (attempt = 1) => {
              supabase
                .from('profiles')
                .select('role, is_admin, is_coordenador, permissions, custom_permissions, ranking_opt_in')
                .eq('id', fbUser.uid)
                .maybeSingle()
                .then(({ data: row, error: sbErr }) => {
                  if (sbErr) {
                    console.warn(`[UserContext] Reconciliation query failed (attempt ${attempt}):`, sbErr.message);
                    if (attempt < 3) setTimeout(() => reconcileFromSupabase(attempt + 1), 2000 * attempt);
                    else soltarSemReconciliar();
                    return;
                  }
                  if (!row) {
                    // Perfil não existe no Supabase. Pode ser JWT expirado (query
                    // retorna 0 rows com RLS), ou perfil realmente não existe.
                    // Retry para cobrir o caso de JWT não pronto.
                    if (attempt < 3) {
                      console.debug(`[UserContext] Reconciliation: no row returned (attempt ${attempt}), retrying...`);
                      setTimeout(() => reconcileFromSupabase(attempt + 1), 2000 * attempt);
                    } else {
                      soltarSemReconciliar();
                      console.warn('[UserContext] Reconciliation: no Supabase profile after 3 attempts — creating via RPC');
                      supabase.rpc('rpc_create_profile', {
                        p_id: fbUser.uid,
                        p_nome: enrichedProfile.displayName || enrichedProfile.firstName || fbUser.displayName || fbUser.email,
                        p_email: (enrichedProfile.email || fbUser.email).toLowerCase(),
                        p_role: enrichedProfile.role || 'colaborador',
                      }).then(({ error: rpcErr }) => {
                        if (rpcErr) {
                          console.warn('[UserContext] rpc_create_profile failed:', rpcErr.message);
                          // Mensagem do RPC: 'Email not authorized: <email>' — sinaliza que admin
                          // ainda nao autorizou esse email. Dispatch evento para App mostrar toast.
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('auth-not-authorized', {
                              detail: { reason: rpcErr.message, email: fbUser.email },
                            }));
                          }
                        } else {
                          console.info('[UserContext] Supabase profile created via safety net');
                        }
                      }).catch(e => console.warn('[UserContext] rpc_create_profile exception:', e));
                    }
                    return;
                  }
                  const syncFields = {};
                  // Compare against rawProfile.role to avoid loop with ensureAdminFlags
                  // (which promotes 'colaborador' → 'administrador' in memory for admin UIDs)
                  if (row.role && row.role !== rawProfile.role) {
                    syncFields.role = row.role;
                  }
                  if (row.is_admin === true && enrichedProfile.isAdmin !== true) {
                    syncFields.isAdmin = true;
                  }
                  if (row.is_coordenador === true && enrichedProfile.isCoordenador !== true) {
                    syncFields.isCoordenador = true;
                  }
                  // Sempre sincronizar customPermissions se Supabase tem valor
                  if (row.custom_permissions != null && enrichedProfile.customPermissions !== row.custom_permissions) {
                    syncFields.customPermissions = row.custom_permissions;
                  }
                  // T1.6.12 LGPD: ranking_opt_in (boolean) — opt-in explícito p/ leaderboard ROPs
                  if (row.ranking_opt_in != null && enrichedProfile.rankingOptIn !== row.ranking_opt_in) {
                    syncFields.rankingOptIn = row.ranking_opt_in;
                  }
                  // Reconciliar permissions: Supabase prevalece se diferir
                  if (row.permissions && typeof row.permissions === 'object' && Object.keys(row.permissions).length > 0) {
                    const sbKeys = Object.keys(row.permissions).sort();
                    const fsKeys = Object.keys(enrichedProfile.permissions || {}).sort();
                    const sbStr = JSON.stringify(row.permissions, sbKeys);
                    const fsStr = JSON.stringify(enrichedProfile.permissions || {}, fsKeys);
                    if (sbStr !== fsStr) {
                      syncFields.permissions = row.permissions;
                    }
                  }
                  // 1ª reconciliação depois da sessão salva: a verdade de AGORA
                  // (Firestore + Supabase) substitui o que estava segurado — inclusive
                  // campo que deixou de divergir, para nada ficar preso no valor velho.
                  if (segurarReconciliadosRef.current) {
                    segurarReconciliadosRef.current = false;
                    const verdade = { ...camposReconciliados(rawProfile), ...syncFields };
                    setUser(prev => prev ? ensureAdminFlags({ ...prev, ...verdade }) : prev);
                  }
                  // Repetição do que já foi reconciliado nesta sessão: o doc do
                  // Firestore continua velho (só admin persiste), então syncFields
                  // sai idêntico a cada snapshot. Re-aplicar só geraria render e log.
                  const jaAplicado = reconciliadoRef.current
                    && JSON.stringify(syncFields) === JSON.stringify(reconciliadoRef.current);
                  if (Object.keys(syncFields).length > 0 && !jaAplicado) {
                    const disabledCards = syncFields.permissions
                      ? Object.entries(syncFields.permissions).filter(([, v]) => v === false).map(([k]) => k)
                      : [];
                    console.info('[UserContext] Reconciliando Supabase→Firestore:', {
                      fields: Object.keys(syncFields),
                      disabledCards,
                      customPermissions: syncFields.customPermissions,
                    });
                    // Atualizar state IMEDIATAMENTE (sem esperar round-trip Firestore)
                    setUser(prev => prev ? ensureAdminFlags({ ...prev, ...syncFields }) : prev);
                    // Guardar o que o Supabase decidiu: o próximo onSnapshot traz o
                    // doc do Firestore ainda desatualizado e, sem isto, o papel volta
                    // ao valor velho até esta reconciliação rodar de novo — piscando.
                    reconciliadoRef.current = syncFields;

                    // Persistir no Firestore para futuras sessões. Campo de
                    // privilégio SÓ vai se o perfil já for admin: firestore.rules
                    // recusa `role`/`permissions` escritos pelo próprio dono do
                    // perfil (anti escalada). A escrita otimista do SDK entra no
                    // cache local, o servidor recusa e o ROLLBACK dispara onSnapshot
                    // de novo com o valor velho — que realimenta esta reconciliação.
                    // Resultado: o papel piscava a sessão inteira e o card da Escala
                    // Cirúrgica aparecia e sumia (caso Oscar Morais, 2026-08-27).
                    // Sem privilégio a verdade do Supabase vale em memória; persistir
                    // é tarefa do Centro de Gestão (admin) ou de
                    // scripts/sync-papel-firestore.mjs.
                    const podeGravarPrivilegio = rawProfile.isAdmin === true;
                    const writeback = podeGravarPrivilegio
                      ? syncFields
                      : Object.fromEntries(
                          Object.entries(syncFields).filter(([k]) => !CAMPOS_PRIVILEGIADOS.has(k)),
                        );
                    if (Object.keys(writeback).length > 0) {
                      updateDoc(profileRef, { ...writeback, updatedAt: new Date() })
                        .catch((err) => console.warn('[UserContext] Firestore writeback failed:', err));
                    }
                  } else {
                    console.debug('[UserContext] Reconciliation: Supabase and Firestore in sync');
                  }
                })
                .catch((err) => {
                  console.warn(`[UserContext] Reconciliation error (attempt ${attempt}):`, err);
                  if (attempt < 3) setTimeout(() => reconcileFromSupabase(attempt + 1), 2000 * attempt);
                  else soltarSemReconciliar();
                });
            };
            reconcileFromSupabase();
          } else {
            // Criar perfil se nao existir (primeira vez)
            const newProfile = {
              uid: fbUser.uid,
              email: fbUser.email,
              firstName: fbUser.displayName?.split(' ')[0] || '',
              lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
              displayName: fbUser.displayName || fbUser.email,
              role: 'colaborador',
              isAdmin: false,
              isCoordenador: false,
              crm: '',
              especialidade: '',
              permissions: { 'doc-protocolos': true },
              lgpdConsentAt: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            // Verificar se Supabase ja tem flags de admin
            // (caso usuario tenha sido promovido via Centro de Gestao antes do primeiro login)
            try {
              const { data: sbRow, error: sbErr } = await supabase
                .from('profiles')
                .select('is_admin, is_coordenador')
                .eq('id', fbUser.uid)
                .maybeSingle();
              if (!sbErr && sbRow) {
                if (sbRow.is_admin === true) newProfile.isAdmin = true;
                if (sbRow.is_coordenador === true) newProfile.isCoordenador = true;
              }
            } catch (e) {
              console.warn('[UserContext] Supabase check for new profile failed:', e);
            }

            // Para novos perfis de admin, aplicar flags antes de salvar no Firestore
            const enrichedNew = ensureAdminFlags({ id: fbUser.uid, ...newProfile });
            try {
              await setDoc(profileRef, {
                ...newProfile,
                isAdmin: enrichedNew.isAdmin,
                role: enrichedNew.role,
              });
            } catch (e) {
              console.error('Erro ao criar perfil:', e);
            }
            setUser(enrichedNew);
          }
          setIsAuthenticated(true);
          setIsLoading(false);
        }, (err) => {
          // Firestore falhou (RLS, permissão, network, etc). Firebase Auth
          // ainda considera o usuário logado, mas sem perfil não há sessão
          // utilizável. Liberar o gate (isLoading=false) para que o app
          // mostre LoginPage em vez de spinner infinito, e propagar o erro.
          console.error('[UserContext] onSnapshot profile error:', err);
          // sem perfil não há sessão utilizável: a próxima abertura não deve
          // desenhar a Home de cache para cair aqui de novo
          limparSessao();
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          setError(err?.message || 'Erro ao carregar perfil');
        });

        // Record access in Supabase (fire-and-forget)
        supabaseUsersService.recordAccess(fbUser.uid).catch(console.warn);
      } else {
        // Sem sessão no Firebase (logout, conta desativada, token revogado): a
        // sessão salva sai junto e a tela vai para o login.
        uidOtimistaRef.current = null;
        segurarReconciliadosRef.current = false;
        limparSessao();
        setFirebaseUser(null);
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (cleanupIncidentSettingsSub) cleanupIncidentSettingsSub();
      clearTimeout(tetoReconciliacaoRef.current);
      tetoReconciliacaoRef.current = null;
    };
  }, [useMock]);

  // Guarda o perfil CONFIRMADO (com a reconciliação do Supabase e os settings de
  // incidente já aplicados — é o que os gates leem; guardar o doc cru do
  // Firestore faria o papel piscar na próxima abertura). Nunca grava antes da
  // confirmação: `firebaseUser` só existe depois dela.
  // E só com "Manter conectado": sem ele o Firebase guarda o login apenas na aba,
  // e o perfil no disco sobreviveria ao fechamento (tablet compartilhado).
  useEffect(() => {
    if (useMock || !firebaseUser || !user) return;
    if ((user.uid || user.id) !== firebaseUser.uid) return;
    const persiste = usuarioFirebaseNoAparelho({
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
      apiKey: auth.app?.options?.apiKey,
      appName: auth.app?.name,
      uid: firebaseUser.uid,
    });
    if (persiste) gravarSessao(firebaseUser.uid, user);
    else limparSessao();
  }, [useMock, firebaseUser, user]);

  /**
   * uid para as escritas do perfil. Na sessão otimista o perfil já está na tela
   * antes de o Firebase confirmar: a escrita espera a confirmação em vez de
   * responder "não autenticado".
   */
  const uidConfirmado = useCallback(async () => {
    // a escrita é do perfil que está NA TELA: se o Firebase confirmar outra
    // conta, não grava (o perfil dela chega e a tela troca)
    const uidTela = user?.uid || user?.id || null;
    if (firebaseUser) return !uidTela || firebaseUser.uid === uidTela ? firebaseUser.uid : null;
    try { await authPronto(); } catch { /* decide pelo estado atual */ }
    const uid = auth.currentUser?.uid || null;
    return uid && (!uidTela || uid === uidTela) ? uid : null;
  }, [firebaseUser, user?.uid, user?.id]);

  // Login
  const login = useCallback(async (email, password) => {
    if (useMockRef.current) {
      setIsAuthenticated(true);
      return { success: true };
    }

    setError(null);
    setIsLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return { success: false, error: result.error };
    }

    // O listener onAuthChange vai atualizar o estado automaticamente
    return { success: true };
  }, []);

  // Cadastro
  const register = useCallback(async (email, password, displayName) => {
    if (useMockRef.current) {
      setIsAuthenticated(true);
      return { success: true };
    }

    setError(null);
    setIsLoading(true);

    const result = await signUp(email, password, displayName);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return { success: false, error: result.error };
    }

    return { success: true };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    if (useMockRef.current) {
      setIsAuthenticated(false);
      return { success: true };
    }

    // antes do signOut: se ele falhar no meio, a próxima abertura pede login
    limparSessao();
    const result = await logOut();

    if (result.error) {
      setError(result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  }, []);

  // Recuperar senha
  const forgotPassword = useCallback(async (email) => {
    const result = await resetPassword(email);
    return result;
  }, []);

  // Atualizar dados do usuario
  const updateUser = useCallback(async (updates) => {
    if (useMockRef.current) {
      setUser(prev => ({ ...prev, ...updates }));
      return { success: true };
    }

    const uid = await uidConfirmado();
    if (!uid) return { success: false, error: 'Usuario nao autenticado' };

    try {
      const userRef = doc(db, 'userProfiles', uid);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: new Date(),
      });
      setUser(prev => ({ ...prev, ...updates }));

      if (updates.firstName || updates.lastName) {
        const first = (updates.firstName || user?.firstName || '').trim();
        const last = (updates.lastName || user?.lastName || '').trim();
        const fullName = `${first} ${last}`.trim().toUpperCase();
        if (fullName) {
          supabase
            .from('profiles')
            .update({ nome: fullName, updated_at: new Date().toISOString() })
            .eq('id', uid)
            .then(({ error: spErr }) => {
              if (spErr) console.warn('[UserContext] Supabase nome sync failed:', spErr.message);
            });
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [uidConfirmado, user?.firstName, user?.lastName]);

  // Atualizar avatar — recebe File ou null (para remover)
  const updateAvatar = useCallback(async (fileOrNull) => {
    if (useMockRef.current) {
      if (!fileOrNull) {
        setUser(prev => ({ ...prev, avatar: null }));
        return { success: true };
      }
      // Mock: usar base64 para preview
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setUser(prev => ({ ...prev, avatar: e.target.result }));
          resolve({ success: true });
        };
        reader.readAsDataURL(fileOrNull);
      });
    }

    const uid = await uidConfirmado();
    if (!uid) return { success: false, error: 'Usuario nao autenticado' };

    try {
      const currentAvatarUrl = user?.avatar || null;
      const supabasePath = `${uid}/avatar.jpg`;

      if (!fileOrNull) {
        // Remover avatar — detecta provider via URL atual; fallback delete em ambos paths.
        if (currentAvatarUrl) {
          try {
            await deleteAnyStorageObject(currentAvatarUrl, {
              firebasePath: `avatars/${uid}`,
              supabaseBucket: STORAGE_BUCKETS.PROFILE_PHOTOS,
              supabasePath,
            });
          } catch (_) { /* já pode não existir */ }
        }
        await updateDoc(doc(db, 'userProfiles', uid), {
          avatar: null,
          storage_provider: null,
          updatedAt: new Date(),
        });
        setUser(prev => ({ ...prev, avatar: null }));
        return { success: true };
      }

      // Redimensionar imagem antes de enviar (max 512px, qualidade 0.8)
      const resized = await resizeImage(fileOrNull, 512, 0.8);

      // Upload em Supabase Storage profile-photos bucket. Path: {uid}/avatar.jpg
      // RLS exige (storage.foldername(name))[1] = public.firebase_uid().
      const { url } = await uploadToSupabase(
        STORAGE_BUCKETS.PROFILE_PHOTOS,
        supabasePath,
        resized,
        { upsert: true, cacheControl: '3600', contentType: resized.type || 'image/jpeg' }
      );

      // Best-effort cleanup do arquivo legacy Firebase, sem bloquear caminho feliz.
      if (currentAvatarUrl && currentAvatarUrl.includes('firebasestorage')) {
        deleteAnyStorageObject(currentAvatarUrl, { firebasePath: `avatars/${uid}` })
          .catch(() => { /* não regredir UX se o legacy não existir */ });
      }

      await updateDoc(doc(db, 'userProfiles', uid), {
        avatar: url,
        storage_provider: 'supabase',
        updatedAt: new Date(),
      });
      setUser(prev => ({ ...prev, avatar: url }));
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar avatar:', err);
      return { success: false, error: err.message };
    }
  }, [uidConfirmado, user?.avatar]);

  // Limpar erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // LGPD: aceitar politica de privacidade
  const acceptLgpd = useCallback(async () => {
    if (useMockRef.current) {
      setUser(prev => ({ ...prev, lgpdConsentAt: new Date().toISOString() }));
      return { success: true };
    }
    const uid = await uidConfirmado();
    if (!uid) return { success: false, error: 'Usuario nao autenticado' };
    try {
      const timestamp = new Date().toISOString();
      const userRef = doc(db, 'userProfiles', uid);
      await updateDoc(userRef, {
        lgpdConsentAt: timestamp,
        updatedAt: serverTimestamp(),
      });
      setUser(prev => ({ ...prev, lgpdConsentAt: timestamp }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [uidConfirmado]);

  const needsLgpdConsent = isAuthenticated && user && !user.lgpdConsentAt;

  const value = useMemo(() => ({
    user,
    firebaseUser,
    isMock: useMockRef.current,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    forgotPassword,
    updateUser,
    updateAvatar,
    clearError,
    acceptLgpd,
    needsLgpdConsent,
  }), [
    user,
    firebaseUser,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    forgotPassword,
    updateUser,
    updateAvatar,
    clearError,
    acceptLgpd,
    needsLgpdConsent,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
