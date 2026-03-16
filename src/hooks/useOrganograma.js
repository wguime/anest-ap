/**
 * Hook para gerenciar o organograma no Firebase
 *
 * Armazena a estrutura do organograma no Firestore:
 * - Collection: configuracoes
 * - Document: organograma
 * - Campos: estrutura (JSON), ultimaAtualizacao, atualizadoPor
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  ORGANOGRAMA_DATA_DEFAULT,
  deepCloneOrganograma,
  addChildNode,
  addAdvisoryNode,
  updateNode,
  removeNode,
  moveNode,
  generateNodeId,
} from '@/data/organogramaData';

// Constantes
const COLLECTION = 'configuracoes';
const DOC_ID = 'organograma';

/**
 * Hook para gerenciar o estado e persistência do organograma
 *
 * @returns {object} Estado e funções do organograma
 */
export function useOrganograma() {
  const [data, setData] = useState(ORGANOGRAMA_DATA_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Carregar dados do Firebase (com listener em tempo real)
  useEffect(() => {
    const docRef = doc(db, COLLECTION, DOC_ID);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          try {
            const docData = docSnap.data();
            const estrutura = JSON.parse(docData.estrutura);
            setData(estrutura);
            setLastUpdate(docData.ultimaAtualizacao?.toDate() || null);
          } catch (parseError) {
            console.error('Erro ao parsear organograma:', parseError);
            setData(ORGANOGRAMA_DATA_DEFAULT);
          }
        } else {
          // Documento não existe, usar dados default
          setData(ORGANOGRAMA_DATA_DEFAULT);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar organograma:', err);
        setError(err.message);
        setData(ORGANOGRAMA_DATA_DEFAULT);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Salvar dados no Firebase
  const saveToFirebase = useCallback(async (newData, userId) => {
    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, COLLECTION, DOC_ID);
      await setDoc(docRef, {
        estrutura: JSON.stringify(newData),
        ultimaAtualizacao: serverTimestamp(),
        atualizadoPor: userId || 'unknown',
      });
      // O listener já vai atualizar o estado local
      return true;
    } catch (err) {
      console.error('Erro ao salvar organograma:', err);
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Adicionar um nó filho
  const addChild = useCallback(async (parentId, newNodeData, userId) => {
    const newNode = {
      id: generateNodeId(),
      cargo: newNodeData.cargo || 'Novo Cargo',
      tipo: newNodeData.tipo || 'operational',
      responsavel: newNodeData.responsavel || null,
      descricao: newNodeData.descricao || null,
      contato: newNodeData.contato || null,
      children: [],
    };

    const newData = addChildNode(data, parentId, newNode);
    setData(newData);

    const success = await saveToFirebase(newData, userId);
    if (!success) {
      // Reverter em caso de erro
      setData(data);
    }
    return success ? newNode.id : null;
  }, [data, saveToFirebase]);

  // Adicionar um nó advisory
  const addAdvisory = useCallback(async (parentId, newNodeData, userId) => {
    const newNode = {
      id: generateNodeId(),
      cargo: newNodeData.cargo || 'Novo Comitê Consultivo',
      tipo: 'advisory',
      responsavel: newNodeData.responsavel || null,
      descricao: newNodeData.descricao || null,
      contato: newNodeData.contato || null,
    };

    const newData = addAdvisoryNode(data, parentId, newNode);
    setData(newData);

    const success = await saveToFirebase(newData, userId);
    if (!success) {
      setData(data);
    }
    return success ? newNode.id : null;
  }, [data, saveToFirebase]);

  // Atualizar um nó existente
  const update = useCallback(async (nodeId, updates, userId) => {
    const newData = updateNode(data, nodeId, updates);
    setData(newData);

    const success = await saveToFirebase(newData, userId);
    if (!success) {
      setData(data);
    }
    return success;
  }, [data, saveToFirebase]);

  // Remover um nó
  const remove = useCallback(async (nodeId, userId) => {
    const newData = removeNode(data, nodeId);
    setData(newData);

    const success = await saveToFirebase(newData, userId);
    if (!success) {
      setData(data);
    }
    return success;
  }, [data, saveToFirebase]);

  // Mover um nó para outro pai
  const move = useCallback(async (nodeId, newParentId, asAdvisory, userId) => {
    const newData = moveNode(data, nodeId, newParentId, asAdvisory);
    setData(newData);

    const success = await saveToFirebase(newData, userId);
    if (!success) {
      setData(data);
    }
    return success;
  }, [data, saveToFirebase]);

  // Resetar para dados default
  const resetToDefault = useCallback(async (userId) => {
    const defaultData = deepCloneOrganograma(ORGANOGRAMA_DATA_DEFAULT);
    setData(defaultData);

    const success = await saveToFirebase(defaultData, userId);
    if (!success) {
      setData(data);
    }
    return success;
  }, [data, saveToFirebase]);

  // Atualizar dados localmente (sem salvar no Firebase)
  const updateLocal = useCallback((newData) => {
    setData(newData);
  }, []);

  // Salvar dados atuais
  const save = useCallback(async (userId) => {
    return saveToFirebase(data, userId);
  }, [data, saveToFirebase]);

  return {
    // Estado
    data,
    loading,
    error,
    saving,
    lastUpdate,

    // Ações
    addChild,
    addAdvisory,
    update,
    remove,
    move,
    resetToDefault,
    updateLocal,
    save,

    // Utilitários
    setError,
  };
}

export default useOrganograma;
