/**
 * useStaff Hook
 * Hook to manage staff schedule data (hospitais and consultorio)
 */
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getStaff,
  updateStaff,
  subscribeStaff,
} from '../services/staffService';

/**
 * Hook to manage staff schedule data
 * @returns {Object} - Data and functions to manage staff schedules
 */
export function useStaff() {
  const { user, firebaseUser } = useUser();

  // Staff schedule state
  const [staff, setStaff] = useState(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState(null);

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

  // Save staff schedule
  const saveStaff = useCallback(async (newStaffData) => {
    if (!firebaseUser) {
      return { success: false, error: 'User not authenticated' };
    }

    setSavingStaff(true);

    try {
      const { success, error } = await updateStaff(newStaffData, firebaseUser.uid);

      if (success) {
        setStaff(newStaffData);
        return { success: true, error: null };
      } else {
        return { success: false, error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSavingStaff(false);
    }
  }, [firebaseUser]);

  // Check edit permission
  const canEdit = useCallback(() => {
    if (!user) return false;

    // Admin has permission
    const roleKey = (user.role || '').toLowerCase();
    if (user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador') {
      return true;
    }

    // Check specific permission
    if (user.permissions && user.permissions['staff-edit']) {
      return true;
    }

    return false;
  }, [user]);

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
    staffLoading,
    staffError,

    // Functions
    fetchStaff,
    saveStaff,
    savingStaff,

    // Permissions
    canEdit: canEdit(),

    // Helper queries
    getHospitalStaffByLocation,
    getConsultorioByRole,
    getAllHospitalStaff,
    getAllConsultorioStaff,
    getAllStaffNames,

    // Connection status ('connected' | 'reconnecting' | 'error')
    connectionStatus,

    // Loading status
    loading: staffLoading,
  };
}

export default useStaff;
