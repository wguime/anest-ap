/**
 * useAuth Hook
 * Gerencia estado de autenticacao
 */
import { useState, useEffect, useCallback } from 'react';
import {
  signIn,
  signUp,
  logOut,
  resetPassword,
  onAuthChange,
  getUserProfile,
} from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listener de mudancas no estado de autenticacao
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Buscar perfil do usuario no Firestore
        const { profile: userProfile } = await getUserProfile(firebaseUser.uid);
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login
  const login = useCallback(async (email, password) => {
    setError(null);
    setIsLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return { success: false, error: result.error };
    }

    // O listener onAuthChange vai atualizar o estado automaticamente
    return { success: true, error: null };
  }, []);

  // Cadastro
  const register = useCallback(async (email, password, displayName) => {
    setError(null);
    setIsLoading(true);

    const result = await signUp(email, password, displayName);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return { success: false, error: result.error };
    }

    // O listener onAuthChange vai atualizar o estado automaticamente
    return { success: true, error: null };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setError(null);

    const result = await logOut();

    if (result.error) {
      setError(result.error);
      return { success: false, error: result.error };
    }

    return { success: true, error: null };
  }, []);

  // Recuperar senha
  const forgotPassword = useCallback(async (email) => {
    setError(null);

    const result = await resetPassword(email);

    if (result.error) {
      setError(result.error);
      return { success: false, error: result.error };
    }

    return { success: true, error: null };
  }, []);

  // Limpar erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    forgotPassword,
    clearError,
  };
}

export default useAuth;
