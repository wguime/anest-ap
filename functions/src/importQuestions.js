/**
 * Cloud Functions — Bulk import de questões de quiz (T1.5.14, Wave 1.5)
 *
 * Decisão arquitetural: quiz_questions vivem em Firestore como array `perguntas`
 * no doc do curso (`educacao_cursos/{cursoId}`). Edge Function Supabase precisaria
 * de service account JSON + nunca foi feito no projeto — Cloud Function Firebase
 * usa firebase-admin já instalado, mesmo padrão de enviarLembretesEscala.
 *
 * Funções:
 *  - importQuestionsJsonl(cursoId, perguntas[], dryRun)
 *  - rollbackImportQuestions(importId) — restaura snapshot até 24h
 *
 * Auditoria + rollback via `educacao_import_history/{importId}` (snapshot completo
 * do array `perguntas` antes do import).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MAX_PER_IMPORT = 500;
const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function validatePerguntaShape(p, idx) {
  if (!p || typeof p !== 'object') {
    return `linha ${idx + 1}: não é objeto`;
  }
  if (!p.pergunta || typeof p.pergunta !== 'string' || !p.pergunta.trim()) {
    return `linha ${idx + 1}: campo "pergunta" obrigatório (string não-vazia)`;
  }
  if (!Array.isArray(p.opcoes) || p.opcoes.length < 2) {
    return `linha ${idx + 1}: "opcoes" deve ser array com pelo menos 2 itens`;
  }
  if (!p.opcoes.every((o) => typeof o === 'string' && o.trim())) {
    return `linha ${idx + 1}: todas as opções devem ser strings não-vazias`;
  }
  if (
    typeof p.respostaCorreta !== 'number' ||
    !Number.isInteger(p.respostaCorreta) ||
    p.respostaCorreta < 0 ||
    p.respostaCorreta >= p.opcoes.length
  ) {
    return `linha ${idx + 1}: "respostaCorreta" deve ser índice válido (0..${p.opcoes.length - 1})`;
  }
  if (p.explicacao !== undefined && typeof p.explicacao !== 'string') {
    return `linha ${idx + 1}: "explicacao" deve ser string (se presente)`;
  }
  return null;
}

exports.importQuestionsJsonl = onCall(async (request) => {
  const { cursoId, perguntas, dryRun = false } = request.data || {};
  const uid = request.auth?.uid;

  if (!uid) throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
  if (!cursoId || typeof cursoId !== 'string') {
    throw new HttpsError('invalid-argument', 'cursoId obrigatório');
  }
  if (!Array.isArray(perguntas) || perguntas.length === 0) {
    throw new HttpsError('invalid-argument', 'perguntas deve ser array não-vazio');
  }
  if (perguntas.length > MAX_PER_IMPORT) {
    throw new HttpsError(
      'invalid-argument',
      `Máximo ${MAX_PER_IMPORT} perguntas por import (recebido: ${perguntas.length})`
    );
  }

  // Validação server-side (defesa em profundidade — client já validou com Zod)
  for (let i = 0; i < perguntas.length; i++) {
    const err = validatePerguntaShape(perguntas[i], i);
    if (err) throw new HttpsError('invalid-argument', err);
  }

  const cursoRef = db.collection('educacao_cursos').doc(cursoId);
  const cursoSnap = await cursoRef.get();
  if (!cursoSnap.exists) throw new HttpsError('not-found', 'Curso não encontrado');
  const prev = cursoSnap.data().perguntas || [];

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      importId: null,
      questionsBefore: prev.length,
      questionsToAdd: perguntas.length,
      questionsAfter: prev.length + perguntas.length,
    };
  }

  const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const importedAtIso = new Date().toISOString();
  const tagged = perguntas.map((p) => ({
    ...p,
    _importId: importId,
    _importedAt: importedAtIso,
  }));
  const merged = [...prev, ...tagged];

  const importRef = db.collection('educacao_import_history').doc(importId);

  await db.runTransaction(async (tx) => {
    tx.set(importRef, {
      type: 'questions',
      cursoId,
      importId,
      userId: uid,
      perguntasAntes: prev, // SNAPSHOT para rollback (sob limite 1MB/doc)
      perguntasAdicionadas: tagged.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      rollbackable: true,
      rollbackExpiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + ROLLBACK_WINDOW_MS)
      ),
    });
    tx.update(cursoRef, {
      perguntas: merged,
      perguntasUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      perguntasUpdatedBy: uid,
    });
  });

  return {
    success: true,
    importId,
    questionsImported: tagged.length,
    questionsTotal: merged.length,
  };
});

exports.rollbackImportQuestions = onCall(async (request) => {
  const { importId } = request.data || {};
  const uid = request.auth?.uid;

  if (!uid) throw new HttpsError('unauthenticated', 'Autenticação obrigatória');
  if (!importId || typeof importId !== 'string') {
    throw new HttpsError('invalid-argument', 'importId obrigatório');
  }

  const importRef = db.collection('educacao_import_history').doc(importId);
  const importSnap = await importRef.get();
  if (!importSnap.exists) throw new HttpsError('not-found', 'Import não encontrado');

  const data = importSnap.data();
  if (!data.rollbackable) {
    throw new HttpsError(
      'failed-precondition',
      'Import já foi rollbacked ou marcado como não-rollbackable'
    );
  }

  const createdMs = data.createdAt?.toMillis?.() ?? 0;
  if (Date.now() - createdMs > ROLLBACK_WINDOW_MS) {
    throw new HttpsError(
      'failed-precondition',
      'Janela de rollback expirou (24h)'
    );
  }

  const cursoRef = db.collection('educacao_cursos').doc(data.cursoId);

  await db.runTransaction(async (tx) => {
    tx.update(cursoRef, {
      perguntas: data.perguntasAntes,
      perguntasUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      perguntasUpdatedBy: uid,
    });
    tx.update(importRef, {
      rollbackable: false,
      rollbackedAt: admin.firestore.FieldValue.serverTimestamp(),
      rollbackedBy: uid,
    });
  });

  return { success: true, questionsRestored: (data.perguntasAntes || []).length };
});
