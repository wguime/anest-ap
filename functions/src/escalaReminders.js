/**
 * Cloud Function — Lembretes automáticos de escala.
 *
 * Roda diariamente às 18:00 BRT (timeZone: America/Sao_Paulo).
 * Para cada funcionária:
 *   - D-1: avisa sobre plantão de amanhã (sobreaviso e/ou plantão hospitalar).
 *   - D0:  avisa sobre plantão do próprio dia.
 *
 * Idempotência: cada notificação é gravada com `relatedEntityId` determinístico
 * (`reminderKey`). A função consulta a tabela `notifications` no Supabase antes
 * de inserir — se já existe lembrete com aquele `reminderKey`, não duplica.
 *
 * Notificações são gravadas no Supabase via REST endpoint usando service role key.
 *
 * Pré-requisitos de configuração (Plano Blaze obrigatório):
 *   firebase functions:secrets:set SUPABASE_URL
 *   firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const {
  FUNCIONARIAS_SOBREAVISO,
  FUNCIONARIAS_HOSPITAIS,
  SOBREAVISO_MATERNO_2026,
  HOSPITAIS_2026,
  HOSPITAL_FIELD_TO_KEY,
  HOSPITAL_FIELD_TO_TURNO,
} = require('./data/escalasSnapshot');
const { buildSobreavisoReminder, buildHospitalReminder } = require('./templates');

const SUPABASE_URL = defineSecret('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = defineSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowInSaoPaulo() {
  // Cloud Functions runtime tem TZ ajustável via runWith options. Como precisamos
  // de "hoje" em São Paulo, derivamos do timestamp UTC ajustando 3 horas (BRT, sem DST).
  const utc = new Date();
  return new Date(utc.getTime() - 3 * 60 * 60 * 1000);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function nomeToFuncionariaId(nome, lista) {
  if (!nome) return null;
  const f = lista.find((x) => x.nome === nome);
  return f?.id || null;
}

/**
 * Mapeia funcionariaId → firebaseUid via match de email na coleção `users`.
 */
async function loadFuncionariaUidMap() {
  const map = new Map();
  const allFuncionarias = [...FUNCIONARIAS_SOBREAVISO];
  FUNCIONARIAS_HOSPITAIS.forEach((f) => {
    if (!allFuncionarias.find((x) => x.id === f.id)) allFuncionarias.push(f);
  });
  const emailsByFuncId = new Map(allFuncionarias.map((f) => [f.id, (f.email || '').toLowerCase().trim()]));

  const snap = await db.collection('users').get();
  snap.forEach((doc) => {
    const email = (doc.data().email || '').toLowerCase().trim();
    if (!email) return;
    for (const [funcId, expected] of emailsByFuncId.entries()) {
      if (expected && expected === email) {
        map.set(funcId, doc.id);
      }
    }
  });
  return map;
}

/**
 * Lê overrides ativos das duas coleções.
 */
async function loadOverrides() {
  const sobreaviso = {};
  const sobreavisoSnap = await db.collection('sobreavisoMaternoDiario').get();
  sobreavisoSnap.forEach((doc) => {
    const d = doc.data();
    if (d?.funcionariaOverride) sobreaviso[doc.id] = d.funcionariaOverride;
  });

  const hospitais = {};
  const hospSnap = await db.collection('hospitaisDiario').get();
  hospSnap.forEach((doc) => {
    const d = doc.data();
    if (d?.funcionariaOverride) hospitais[doc.id] = d.funcionariaOverride;
  });

  return { sobreaviso, hospitais };
}

/**
 * Resolve a funcionária escalada no sobreaviso de uma data, aplicando override.
 */
function resolveSobreavisoFuncionariaId(dateK, overrides) {
  const baseId = SOBREAVISO_MATERNO_2026[dateK];
  if (!baseId) return null;
  return overrides[dateK] || baseId;
}

/**
 * Lista os slots da funcionária no plantão hospitalar de uma data, aplicando overrides.
 * Retorna [{ hospital, turno }]
 */
function resolveSlotsFuncionariaHospital(dateK, funcId, overrides) {
  const escala = HOSPITAIS_2026[dateK];
  if (!escala) return [];
  const slots = [];
  for (const field of ['hro', 'unimed', 'plantaoPago']) {
    const hospital = HOSPITAL_FIELD_TO_KEY[field];
    const turno = HOSPITAL_FIELD_TO_TURNO[field];
    const overrideKey = `${dateK}_${hospital}_${turno}`;
    let escaladoId = overrides[overrideKey];
    if (!escaladoId) {
      escaladoId = nomeToFuncionariaId(escala[field], FUNCIONARIAS_HOSPITAIS);
    }
    if (escaladoId === funcId) {
      slots.push({ hospital, turno });
    }
  }
  return slots;
}

/**
 * Insere notificação no Supabase, com checagem de idempotência por reminderKey.
 */
async function insertNotificationIfNew(supabaseUrl, serviceKey, recipientUid, reminderKey, payload) {
  // 1) Checa se já existe
  const checkUrl = `${supabaseUrl}/rest/v1/notifications?recipient_id=eq.${encodeURIComponent(recipientUid)}&related_entity_id=eq.${encodeURIComponent(reminderKey)}&select=id&limit=1`;
  const checkResp = await fetch(checkUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!checkResp.ok) {
    console.error('Erro ao consultar notificação existente:', await checkResp.text());
    return { inserted: false, reason: 'check-failed' };
  }
  const existing = await checkResp.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return { inserted: false, reason: 'already-exists' };
  }

  // 2) Insere
  const insertUrl = `${supabaseUrl}/rest/v1/notifications`;
  const row = {
    recipient_id: recipientUid,
    category: 'lembrete-escala',
    subject: payload.subject,
    content: payload.content,
    sender_name: 'Sistema ANEST',
    priority: 'normal',
    action_url: payload.actionUrl || null,
    action_label: payload.actionLabel || 'Ver Escala',
    dismissable: true,
    related_entity_type: 'lembrete-escala',
    related_entity_id: reminderKey,
  };
  const insertResp = await fetch(insertUrl, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!insertResp.ok) {
    console.error('Erro ao inserir notificação:', await insertResp.text());
    return { inserted: false, reason: 'insert-failed' };
  }
  return { inserted: true };
}

async function processDailyReminders(supabaseUrl, serviceKey) {
  const today = nowInSaoPaulo();
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));

  const [funcUidMap, overrides] = await Promise.all([
    loadFuncionariaUidMap(),
    loadOverrides(),
  ]);

  if (funcUidMap.size === 0) {
    console.warn('Nenhuma funcionária mapeada — verificar emails em Firestore users.');
    return { processed: 0, inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (const [funcId, uid] of funcUidMap.entries()) {
    for (const horizon of ['d-1', 'd0']) {
      const targetKey = horizon === 'd-1' ? tomorrowKey : todayKey;

      // Sobreaviso
      const sobrId = resolveSobreavisoFuncionariaId(targetKey, overrides.sobreaviso);
      if (sobrId === funcId) {
        const reminderKey = `lembrete_sobreaviso_${targetKey}_${funcId}_${horizon}`;
        const payload = {
          ...buildSobreavisoReminder(horizon, targetKey),
          actionUrl: 'consultaSobreaviso',
          actionLabel: 'Ver Sobreaviso',
        };
        const r = await insertNotificationIfNew(supabaseUrl, serviceKey, uid, reminderKey, payload);
        if (r.inserted) inserted++; else skipped++;
      }

      // Plantões hospitalares
      const slots = resolveSlotsFuncionariaHospital(targetKey, funcId, overrides.hospitais);
      for (const slot of slots) {
        const reminderKey = `lembrete_hospital_${targetKey}_${funcId}_${slot.hospital}_${slot.turno}_${horizon}`;
        const payload = {
          ...buildHospitalReminder(horizon, targetKey, slot.hospital, slot.turno),
          actionUrl: 'escalasFuncionarias',
          actionLabel: 'Ver Escala',
        };
        const r = await insertNotificationIfNew(supabaseUrl, serviceKey, uid, reminderKey, payload);
        if (r.inserted) inserted++; else skipped++;
      }
    }
  }

  console.log(`Lembretes processados: inserted=${inserted}, skipped=${skipped}, funcionarias=${funcUidMap.size}`);
  return { processed: funcUidMap.size, inserted, skipped };
}

exports.enviarLembretesEscala = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'America/Sao_Paulo',
    secrets: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY],
    region: 'us-central1',
    retryCount: 1,
  },
  async () => {
    const supabaseUrl = SUPABASE_URL.value();
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY.value();
    if (!supabaseUrl || !serviceKey) {
      console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
      return;
    }
    await processDailyReminders(supabaseUrl, serviceKey);
  }
);

// Versão HTTP para teste manual (mesma lógica)
const { onRequest } = require('firebase-functions/v2/https');
exports.enviarLembretesEscalaManual = onRequest(
  {
    secrets: [SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY],
    region: 'us-central1',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Use POST');
      return;
    }
    const supabaseUrl = SUPABASE_URL.value();
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY.value();
    try {
      const result = await processDailyReminders(supabaseUrl, serviceKey);
      res.json(result);
    } catch (err) {
      console.error('Erro ao executar lembretes manualmente:', err);
      res.status(500).json({ error: err.message });
    }
  }
);
