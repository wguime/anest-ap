#!/usr/bin/env node
/**
 * Dry-run da projeção de ATESTADO — rode ANTES de deployar as Cloud Functions.
 *
 * `projetarIndisponibilidadeStaff` reescreve `staff/schedule.hospitais` e
 * `.consultorio` INTEIROS a partir de `staffMedicalLeaves`. Se a coleção tiver
 * afastamento antigo que ninguém cancelou, o primeiro run tira essa pessoa da
 * escala. Este script mostra o que a função faria, sem escrever nada.
 *
 *   node scripts/diag-staff-atestados.mjs
 *   node scripts/diag-staff-atestados.mjs --data 2026-09-10
 *
 * Credenciais: GOOGLE_APPLICATION_CREDENTIALS apontando para a service account,
 * ou `gcloud auth application-default login`.
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const require = createRequire(import.meta.url)
const { dateKeyInSaoPaulo, isActiveOn, projectScope } =
  require('../functions/src/staffProjectionCore.js')

const argIndex = process.argv.indexOf('--data')
const dataAlvo = argIndex >= 0 ? process.argv[argIndex + 1] : null
if (dataAlvo && !/^\d{4}-\d{2}-\d{2}$/.test(dataAlvo)) {
  throw new Error('--data espera AAAA-MM-DD')
}

if (!getApps().length) {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credentialsPath && existsSync(credentialsPath)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(credentialsPath, 'utf8'))) })
  } else {
    initializeApp({ credential: applicationDefault(), projectId: 'anest-ap' })
  }
}

const db = getFirestore()
const hoje = dataAlvo || dateKeyInSaoPaulo()

const scheduleSnap = await db.doc('staff/schedule').get()
if (!scheduleSnap.exists) throw new Error('staff/schedule não existe.')
const schedule = scheduleSnap.data()

const leavesSnap = await db.collection('staffMedicalLeaves').where('status', '==', 'active').get()
const leavesByScope = { hospitais: [], consultorio: [] }
leavesSnap.forEach((snap) => {
  const leave = snap.data()
  if (leave.scope in leavesByScope) leavesByScope[leave.scope].push({ id: snap.id, ...leave })
})

const iso = (t) => (t?.toDate ? dateKeyInSaoPaulo(t.toDate()) : '—')

console.log(`\nProjeção para ${hoje}${dataAlvo ? ' (data forçada)' : ''}`)
console.log(`Afastamentos com status "active": ${leavesSnap.size}\n`)

for (const [id, leave] of leavesSnap.docs.map((d) => [d.id, d.data()])) {
  const vigente = isActiveOn(leave, hoje)
  console.log(
    `  ${vigente ? 'VIGENTE ' : 'fora    '} ${leave.employeeName} · ${leave.scope} · ` +
    `${iso(leave.startsAt)} → ${iso(leave.endsAt)}` +
    (leave.previousAssignment ? ` · volta p/ ${leave.previousAssignment.sectionKey}` : ' · SEM previousAssignment') +
    `  [${id}]`
  )
}

const nomesDe = (grupo) => Object.entries(grupo || {})
  .filter(([, v]) => Array.isArray(v))
  .flatMap(([secao, entries]) => entries.map((e) => `${secao}:${e?.nome}`))
  .sort()

let mudancas = 0
for (const scope of ['hospitais', 'consultorio']) {
  const antes = nomesDe(schedule[scope])
  const depois = nomesDe(projectScope(schedule[scope], leavesByScope[scope], hoje, scope))
  const saem = antes.filter((n) => !depois.includes(n))
  const entram = depois.filter((n) => !antes.includes(n))

  console.log(`\n=== ${scope} ===`)
  if (!saem.length && !entram.length) {
    console.log('  sem mudança')
    continue
  }
  mudancas += saem.length + entram.length
  saem.forEach((n) => console.log(`  - SAI    ${n}`))
  entram.forEach((n) => console.log(`  + ENTRA  ${n}`))
}

console.log(
  mudancas === 0
    ? '\nO deploy não muda a escala de hoje.\n'
    : `\n⚠️  O primeiro run vai alterar ${mudancas} posição(ões). Confira acima antes de deployar.\n`
)
