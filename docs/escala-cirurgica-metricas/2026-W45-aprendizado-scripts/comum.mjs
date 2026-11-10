import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
// DADOS = pasta com casos.json, escalas.json, eventos.json, captura.json e alias.json (fora do repo: têm nomes).
// Como exportar: ver 2026-W45-aprendizado-queries.sql (bloco EXPORT).
export const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const DADOS = process.env.DADOS
if (!DADOS) { console.error('Defina DADOS=<pasta com os JSON exportados>'); process.exit(1) }
export const ler = (n) => JSON.parse(fs.readFileSync(`${DADOS}/${n}.json`, 'utf8'))
export const { nomeCurtoProcedimento } = await import(`${R}/src/lib/escalaProcedimentoCurto.js`)
export const sa = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
export const min = (hm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || '').trim()); return m ? +m[1] * 60 + +m[2] : null }
export const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) / 2; return (s[Math.floor(k)] + s[Math.ceil(k)]) / 2 }
export const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * p; const f = Math.floor(k); return s[f] + (s[Math.ceil(k)] - s[f]) * (k - f) }
export const r1 = (x) => x == null ? null : Math.round(x * 10) / 10
export const familia = (p) => sa(nomeCurtoProcedimento(p)).replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim()
const GEN = /^(|CONSULTORIO|CONTINUACAO|PROCEDIMENTOS?|EMERGENCIA|URGENCIA|MATERNO|DIA TODO|CENTRO OBSTETRICO|ORTOPEDIA|ANESTESIA REALIZADA|SRPA|EXAMES?|AMBULATORIO)$/
export const generica = (f) => GEN.test(f)
// cirurgião: tokens >=3 letras sem DR/DRA; chave = 1º + último token
const STOPC = new Set(['DRA', 'DAS', 'DOS', 'DEL', 'EQUIPE'])
export const tokCir = (s) => sa(s).replace(/\bDRA?\b\.?/g, ' ').replace(/[^A-Z/+ ]+/g, ' ').split(/[/+]/)[0].trim().split(' ').filter((t) => t.length >= 3 && !STOPC.has(t))
export const cirBruto = (s) => sa(s).replace(/^(DRA?\.?\s+)/, '') || null
export const dow = (d) => new Date(d + 'T12:00:00').getDay()
export const util = (d) => { const x = dow(d); return x >= 1 && x <= 5 }
export const teMin = (t) => { t = String(t || '').trim(); let m = /^(\d{1,2}):(\d{2})$/.exec(t); if (m) return +m[1] * 60 + +m[2]; m = /(\d{1,2})\s*h\s*(\d{1,2})?/i.exec(t); if (m) return +m[1] * 60 + (+m[2] || 0); m = /^(\d{1,3})\s*min/i.exec(t); if (m) return +m[1]; return null }
// lote por eventos: mesma pessoa, mesmo status, <=60s
export function lotes(eventos) {
  const ev = eventos.filter((e) => e.tipo === 'status' && e.de !== e.para && (e.para === 'iniciada' || e.para === 'terminada')).map((e) => ({ ...e, t: Date.parse(e.em) }))
  const g = new Map()
  for (const e of ev) { const k = e.por + '|' + e.para; if (!g.has(k)) g.set(k, []); g.get(k).push(e) }
  for (const arr of g.values()) { arr.sort((a, b) => a.t - b.t); let i = 0; while (i < arr.length) { let j = i; while (j + 1 < arr.length && arr[j + 1].t - arr[j].t <= 60000) j++; for (let k = i; k <= j; k++) arr[k].tam = j - i + 1; i = j + 1 } }
  return ev
}
export const hmBRT = (iso) => { const d = new Date(Date.parse(iso) - 3 * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') }

// Tudo o que os scripts IMPRIMEM sai com código no lugar do nome (A01, C001…) — a saída vira relatório versionado.
// NOMES=1 mostra os nomes (leitura do dono, nunca para colar em arquivo do repositório).
if (process.env.NOMES !== '1') { const { codificarTexto, lerTabela } = await import('./codigos.mjs'); if (lerTabela().geradoEm) { const orig = console.log.bind(console); console.log = (...a) => orig(...a.map((x) => typeof x === 'string' ? codificarTexto(x) : x)) } }
