/**
 * useFuncionariaShiftReminders
 * Hook que cria notificações na inbox para a funcionária logada quando ela tem
 * sobreaviso materno OU plantão hospitalar (FDS/feriado) em D-1 (amanhã) ou D0 (hoje).
 *
 * Mesma estratégia de useShiftReminders (anestesistas), adaptada para funcionárias:
 *   - Roda 1x por sessão (dedup por dia)
 *   - Idempotência via `related_entity_id` no Supabase
 *   - Aplica overrides de trocas aceitas (sobreavisoMaternoDiario + hospitaisDiario)
 *
 * Identificação da funcionária: por email (ver utils/funcionariaResolver).
 */
import { useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../contexts/UserContext';
import { useMessages } from '../contexts/MessagesContext';
import {
  notifySobreavisoFuncionariaReminder,
  notifyHospitalFuncionariaReminder,
} from '../services/notificationService';
import { supabase } from '../config/supabase';
import { resolveFuncionariaId } from '../utils/funcionariaResolver';
import { FUNCIONARIAS_SOBREAVISO, SOBREAVISO_MATERNO_2026 } from '../data/sobreavisoMaterno2026';
import { FUNCIONARIAS_HOSPITAIS, HOSPITAIS_2026 } from '../data/hospitaisTecnicas2026';

const processedSessions = new Set();

const HOSPITAL_FIELD_TO_KEY = { hro: 'hro', unimed: 'unimed', plantaoPago: 'plantao_pago' };
const HOSPITAL_FIELD_TO_TURNO = { hro: 'manha', unimed: 'manha', plantaoPago: 'tarde' };

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(dateKey) {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

function nomeToFuncionariaId(nome) {
  if (!nome) return null;
  const f = FUNCIONARIAS_HOSPITAIS.find((x) => x.nome === nome);
  return f?.id || null;
}

async function loadOverrides() {
  const sobreaviso = {};
  const hospitais = {};
  try {
    const [sobrSnap, hospSnap] = await Promise.all([
      getDocs(collection(db, 'sobreavisoMaternoDiario')),
      getDocs(collection(db, 'hospitaisDiario')),
    ]);
    sobrSnap.forEach((doc) => {
      const data = doc.data();
      if (data?.funcionariaOverride) sobreaviso[doc.id] = data.funcionariaOverride;
    });
    hospSnap.forEach((doc) => {
      const data = doc.data();
      if (data?.funcionariaOverride) hospitais[doc.id] = data.funcionariaOverride;
    });
  } catch (err) {
    console.warn('[FuncionariaShiftReminders] Erro ao ler overrides:', err);
  }
  return { sobreaviso, hospitais };
}

function resolveSobreavisoFuncionariaId(dateKey, overrides) {
  return overrides[dateKey] || SOBREAVISO_MATERNO_2026[dateKey] || null;
}

function slotsHospitalDaFuncionaria(dateKey, funcId, overrides) {
  const escala = HOSPITAIS_2026[dateKey];
  if (!escala) return [];
  const slots = [];
  for (const field of ['hro', 'unimed', 'plantaoPago']) {
    const hospital = HOSPITAL_FIELD_TO_KEY[field];
    const turno = HOSPITAL_FIELD_TO_TURNO[field];
    const overrideKey = `${dateKey}_${hospital}_${turno}`;
    const escaladoId = overrides[overrideKey] || nomeToFuncionariaId(escala[field]);
    if (escaladoId === funcId) {
      slots.push({ hospital, turno });
    }
  }
  return slots;
}

async function checkExistingNotifications(entityIds) {
  if (entityIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('notifications')
    .select('related_entity_id')
    .in('related_entity_id', entityIds);
  if (error) {
    console.error('[FuncionariaShiftReminders] Erro ao checar duplicatas:', error);
    return new Set();
  }
  return new Set((data || []).map((r) => r.related_entity_id));
}

export function useFuncionariaShiftReminders() {
  const { user, firebaseUser } = useUser();
  const { createSystemNotification } = useMessages();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user || !firebaseUser) return;
    if (hasRun.current) return;

    // Resolve por email em qualquer das duas listas
    const sobrId = resolveFuncionariaId(user, FUNCIONARIAS_SOBREAVISO);
    const hospId = resolveFuncionariaId(user, FUNCIONARIAS_HOSPITAIS);
    if (!sobrId && !hospId) return; // não é funcionária

    const today = new Date();
    const todayKey = formatDateKey(today);
    const sessionKey = `funcionaria_shift_reminders_${firebaseUser.uid}_${todayKey}`;
    if (processedSessions.has(sessionKey)) return;

    hasRun.current = true;
    processedSessions.add(sessionKey);

    processReminders().catch((err) => {
      console.error('[FuncionariaShiftReminders] Erro:', err);
      hasRun.current = false;
      processedSessions.delete(sessionKey);
    });

    async function processReminders() {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = formatDateKey(tomorrow);

      const overrides = await loadOverrides();
      const pending = [];

      for (const horizonte of ['1day', '1day-d0']) {
        const targetKey = horizonte === '1day' ? tomorrowKey : todayKey;
        const reminderType = horizonte === '1day' ? '1day' : '1day-d0';

        // Sobreaviso materno
        if (sobrId) {
          const escaladoId = resolveSobreavisoFuncionariaId(targetKey, overrides.sobreaviso);
          if (escaladoId === sobrId) {
            const entityId = `lembrete_sobreaviso_${targetKey}_${sobrId}_${reminderType}`;
            pending.push({
              type: 'sobreaviso',
              entityId,
              data: {
                dataPlantao: formatDisplay(targetKey),
                tipoLembrete: horizonte === '1day' ? '1day' : '1hour',
                recipientId: firebaseUser.uid,
                relatedEntityId: entityId,
              },
            });
          }
        }

        // Plantões hospitalares (FDS/feriados)
        if (hospId) {
          const slots = slotsHospitalDaFuncionaria(targetKey, hospId, overrides.hospitais);
          for (const slot of slots) {
            const entityId = `lembrete_hospital_${targetKey}_${hospId}_${slot.hospital}_${slot.turno}_${reminderType}`;
            pending.push({
              type: 'hospital',
              entityId,
              data: {
                dataPlantao: formatDisplay(targetKey),
                hospital: slot.hospital,
                turno: slot.turno,
                tipoLembrete: horizonte === '1day' ? '1day' : '1hour',
                recipientId: firebaseUser.uid,
                relatedEntityId: entityId,
              },
            });
          }
        }
      }

      if (pending.length === 0) {
        console.log('[FuncionariaShiftReminders] Nenhum plantão hoje ou amanhã para esta funcionária');
        return;
      }

      const allEntityIds = pending.map((p) => p.entityId);
      const existing = await checkExistingNotifications(allEntityIds);
      const toCreate = pending.filter((p) => !existing.has(p.entityId));

      if (toCreate.length === 0) {
        console.log(`[FuncionariaShiftReminders] 0 criados (${existing.size} já existiam)`);
        return;
      }

      let created = 0;
      for (const item of toCreate) {
        try {
          if (item.type === 'sobreaviso') {
            notifySobreavisoFuncionariaReminder(createSystemNotification, item.data);
          } else {
            notifyHospitalFuncionariaReminder(createSystemNotification, item.data);
          }
          created++;
        } catch (err) {
          console.error(`[FuncionariaShiftReminders] Falhou para ${item.entityId}:`, err);
        }
      }
      console.log(`[FuncionariaShiftReminders] ${created} criados (${existing.size} já existiam)`);
    }
  }, [user, firebaseUser, createSystemNotification]);
}

export default useFuncionariaShiftReminders;
