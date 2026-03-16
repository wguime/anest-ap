import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as educacaoService from '@/services/educacaoService';

export function useStudentContent() {
  const { user, profile } = useAuth();
  const [trilhas, setTrilhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userType = useMemo(() => {
    return profile?.role || profile?.tipoUsuario || 'colaborador';
  }, [profile]);

  const fetchTrilhas = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await educacaoService.getTrilhasForStudent(userType);
      setTrilhas(result || []);
    } catch (err) {
      console.error('useStudentContent error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, userType]);

  useEffect(() => { fetchTrilhas(); }, [fetchTrilhas]);

  const getCursos = useCallback(
    (trilhaId) => educacaoService.getCursosForStudent(trilhaId),
    []
  );
  const getModulos = useCallback(
    (cursoId) => educacaoService.getModulosForStudent(cursoId),
    []
  );
  const getAulas = useCallback(
    (moduloId) => educacaoService.getAulasForStudent(moduloId),
    []
  );

  return { trilhas, loading, error, refetch: fetchTrilhas, getCursos, getModulos, getAulas, userType };
}
