/**
 * useStaff Hook
 * Hook to manage staff schedule data (hospitais and consultorio)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getLegacyStaffMedicalLeaves,
  getStaff,
  updateStaff,
  subscribeStaff,
} from '../services/staffService';
import {
  saveStaffWithMedicalLeaves,
  subscribeStaffMedicalLeaves,
} from '../services/staffMedicalLeaveService';
import {
  hasSensitiveStaffFields,
  mergeMedicalLeavesForEditing,
} from '../lib/staffMedicalLeaves';

// Permissao dedicada de RH: gerencia afastamento SEM editar a escala operacional.
// Nao e mais o unico caminho — ver `canManageAbsences`.
function hasPrivateAbsencePermission(user) {
  if (!user) return false
  return user.permissions?.['staff-absence-private'] === true
}

function localDateKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Hook to manage staff schedule data
 * @returns {Object} - Data and functions to manage staff schedules
 */
export function useStaff({ loadPrivateAbsences = false } = {}) {
  const { user, firebaseUser } = useUser();

  // Staff schedule state
  const [staff, setStaff] = useState(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState(null);
  const [legacyMedicalLeaves, setLegacyMedicalLeaves] = useState([]);
  const [medicalLeaves, setMedicalLeaves] = useState([]);
  const [legacyMedicalLeavesLoaded, setLegacyMedicalLeavesLoaded] = useState(false);
  const [medicalLeavesLoaded, setMedicalLeavesLoaded] = useState(false);

  // Connection status tracking ('connected' | 'reconnecting' | 'error')
  const [connectionStatus, setConnectionStatus] = useState('connected');

  // Save state
  const [savingStaff, setSavingStaff] = useState(false);

  // Fetch staff schedule from Firestore
  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);

    try {
      const { staff: data, error } = await getStaff();

      if (error) {
        console.warn('Error fetching staff schedule:', error);
        setStaffError(error);
      } else if (data && (data.hospitais || data.consultorio)) {
        setStaff(data);
      } else {
        // No data in Firestore
        setStaff({ hospitais: {}, consultorio: {} });
      }
    } catch (err) {
      console.error('Error fetching staff schedule:', err);
      setStaffError(err.message);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  // Load data on mount with real-time listener
  useEffect(() => {
    const unsubscribe = subscribeStaff(
      ({ staff: data, error }) => {
        if (error) {
          console.warn('Error in staff listener:', error);
          setStaffError(error);
        } else if (data && (data.hospitais || data.consultorio)) {
          setStaff(data);
        } else {
          setStaff({ hospitais: {}, consultorio: {} });
        }
        setStaffLoading(false);
      },
      {
        onStatusChange: (status) => {
          setConnectionStatus(status);
        },
      }
    );

    return () => unsubscribe();
  }, []);

  // Check edit permission
  const canEdit = useCallback(() => {
    if (!user) return false;

    // Admin has permission
    const roleKey = (user.role || '').toLowerCase();
    if (user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador') {
      return true;
    }

    // Check specific permission
    if (user.permissions && user.permissions['tec-enf-secretaria-edit']) {
      return true;
    }

    return false;
  }, [user]);

  // Atestado acompanha a edicao da escala (dono 01/09): quem edita as escalas de
  // tecnicas/secretarias tambem move alguem para ATESTADO, sem depender do toggle
  // "Gerenciar Atestados — Privado". A permissao dedicada continua valendo sozinha,
  // para o perfil de RH que so cuida de afastamento e nao mexe na escala.
  // O dado segue morando na colecao privada `staffMedicalLeaves`, nunca no doc
  // publico — o que mudou foi quem entra nela, espelhado em `firestore.rules`.
  const canEditOperational = canEdit()
  const canManageAbsences = hasPrivateAbsencePermission(user) || canEditOperational
  const shouldLoadPrivateAbsences = canManageAbsences && loadPrivateAbsences

  useEffect(() => {
    if (!shouldLoadPrivateAbsences) {
      setMedicalLeaves([])
      setLegacyMedicalLeaves([])
      setLegacyMedicalLeavesLoaded(false)
      setMedicalLeavesLoaded(false)
      return undefined
    }

    setLegacyMedicalLeavesLoaded(false)
    setMedicalLeavesLoaded(false)
    let active = true
    getLegacyStaffMedicalLeaves().then(({ leaves, error }) => {
      if (!active) return
      if (error) setStaffError(error)
      else setLegacyMedicalLeaves(leaves)
      setLegacyMedicalLeavesLoaded(true)
    })
    const unsubscribe = subscribeStaffMedicalLeaves(({ leaves, error }) => {
      if (error) {
        setStaffError(error)
      } else {
        setMedicalLeaves(leaves)
      }
      setMedicalLeavesLoaded(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [shouldLoadPrivateAbsences])

  const medicalLeavesLoading = shouldLoadPrivateAbsences && (
    !legacyMedicalLeavesLoaded || !medicalLeavesLoaded
  )
  const privateAbsencesReady = !shouldLoadPrivateAbsences || !medicalLeavesLoading

  const staffForEditing = useMemo(() => {
    if (!shouldLoadPrivateAbsences || !privateAbsencesReady) return staff
    return mergeMedicalLeavesForEditing(staff, medicalLeaves, legacyMedicalLeaves)
  }, [staff, shouldLoadPrivateAbsences, privateAbsencesReady, medicalLeaves, legacyMedicalLeaves])

  // Save staff schedule
  const saveStaff = useCallback(async (newStaffData) => {
    if (!firebaseUser) {
      return { success: false, error: 'User not authenticated' };
    }

    setSavingStaff(true);

    try {
      if (!canManageAbsences && legacyMedicalLeaves.length > 0) {
        return {
          success: false,
          error: 'Há atestados legados aguardando migração por um administrador ou RH autorizado.',
        }
      }

      const result = canManageAbsences && (
        hasSensitiveStaffFields(newStaffData) || medicalLeaves.length > 0 || legacyMedicalLeaves.length > 0
      )
        ? await saveStaffWithMedicalLeaves({
            staffData: newStaffData,
            currentPublicStaff: staff,
            existingLeaves: medicalLeaves,
            userId: firebaseUser.uid,
            dateKey: localDateKey(),
            // Quem também edita a escala grava a parte operacional no mesmo
            // batch, preservando `indisponivel`; perfis só-RH gravam apenas o privado.
            updatePublic: canEditOperational,
          })
        : await updateStaff(newStaffData, firebaseUser.uid);
      const { success, error } = result;

      if (success) {
        setStaff(result.staff || newStaffData);
        setLegacyMedicalLeaves([])
        return { success: true, error: null };
      } else {
        return { success: false, error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSavingStaff(false);
    }
  }, [firebaseUser, staff, canManageAbsences, canEditOperational, legacyMedicalLeaves, medicalLeaves]);

  // Get hospital staff by location (hro, unimed, ferias)
  const getHospitalStaffByLocation = useCallback((location) => {
    if (!staff || !staff.hospitais) return [];
    const normalizedLocation = location.toLowerCase();
    return staff.hospitais[normalizedLocation] || [];
  }, [staff]);

  // Get consultorio staff by function/role
  const getConsultorioByRole = useCallback((role) => {
    if (!staff || !staff.consultorio) return [];
    return staff.consultorio[role] || [];
  }, [staff]);

  // Get all hospital staff (all locations combined)
  const getAllHospitalStaff = useCallback(() => {
    if (!staff || !staff.hospitais) return [];
    return Object.values(staff.hospitais).flat();
  }, [staff]);

  // Get all consultorio staff (all roles combined)
  const getAllConsultorioStaff = useCallback(() => {
    if (!staff || !staff.consultorio) return [];
    return Object.values(staff.consultorio).flat();
  }, [staff]);

  // Get all staff names (unique list)
  const getAllStaffNames = useCallback(() => {
    if (!staff) return [];
    const names = new Set();

    // Collect from hospitais
    if (staff.hospitais) {
      Object.values(staff.hospitais).forEach(locationStaff => {
        locationStaff.forEach(entry => {
          if (entry.nome) names.add(entry.nome);
        });
      });
    }

    // Collect from consultorio
    if (staff.consultorio) {
      Object.values(staff.consultorio).forEach(roleStaff => {
        roleStaff.forEach(entry => {
          if (entry.nome) names.add(entry.nome);
        });
      });
    }

    return Array.from(names).sort();
  }, [staff]);

  return {
    // Staff data
    staff,
    staffForEditing,
    staffLoading,
    staffError,
    medicalLeaves,
    medicalLeavesLoading,
    privateAbsencesReady,

    // Functions
    fetchStaff,
    saveStaff,
    savingStaff,

    // Permissions
    canEdit: canEditOperational || canManageAbsences,
    canEditOperational,
    canManageAbsences,

    // Helper queries
    getHospitalStaffByLocation,
    getConsultorioByRole,
    getAllHospitalStaff,
    getAllConsultorioStaff,
    getAllStaffNames,

    // Connection status ('connected' | 'reconnecting' | 'error')
    connectionStatus,

    // Loading status
    loading: staffLoading || medicalLeavesLoading,
  };
}

export default useStaff;
