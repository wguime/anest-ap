/**
 * "SEU PREENCHIMENTO" A PARTIR DE 27/10, A DATA DA CAIXA (Humberto, 29/10: "apesar de
 * preencherem de forma adequada o percentual está diminuindo") — a migration 20261029120000
 * rodando num Postgres em memória (PGlite) sobre os corpos que estão no ar.
 *
 * O que trava aqui: a falta de antes do corte da caixa "Cirurgias sem horário"
 * (CORTE_PENDENCIAS_MINHAS) não pesa no número — ninguém consegue preenchê-la pela caixa —, a
 * data da migration é a mesma da caixa, e o rollback volta a janela desde 05/10.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { CORTE_PENDENCIAS_MINHAS } from '@/lib/escalaHorarioPendente'

const ler = (f) => readFileSync(f, 'utf8')
const NO_AR_16 = ler('supabase/migrations/20261016150000_escala_consultorio_sem_horario.sql')
const NO_AR_27 = ler('supabase/migrations/20261027220000_escala_continuacao_herda_termino.sql')
const NO_AR_28 = ler('supabase/migrations/20261028130000_escala_preenchimento_mesma_regra.sql')
const MIGRATION = ler('supabase/migrations/20261029120000_escala_preenchimento_desde_corte_caixa.sql')
const ROLLBACK = ler('scripts/rollback-20261029120000-preenchimento-desde-corte-caixa.sql')

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// ontem (dia encerrado em qualquer hora da suíte, sempre depois do corte) e o dia antes do corte
const ONTEM = iso(new Date(Date.now() - 86400000))
const ANTES_DO_CORTE = '2026-10-26'

let db
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.firebase_uid() returns text language sql as $$ select 'u-hum' $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql as $$ select true $$;
    create table public.profiles (id text primary key, active boolean default true, email text, conta_duplicada_de text);
    create table public.escala_anestesista_alias (user_id text not null, apelido text not null unique);
    create table public.escala_cirurgica (id uuid primary key, data date, hospital text, status text);
    create table public.escala_cirurgica_caso (
      id uuid primary key, escala_id uuid, sala text, ordem int, hora text, procedimento text, cirurgiao text,
      anestesista text, anestesista_user_id text, is_continuacao boolean, sem_anestesista boolean,
      turno text, status_cirurgia text not null default 'agendada', status_extra text,
      inicio_real text, termino_real text);
    insert into public.profiles (id) values ('u-hum');
  `)
  await db.query(`insert into public.escala_cirurgica values
    ('00000000-0000-0000-0000-0000000000a1', $1, 'hro', 'publicada'),
    ('00000000-0000-0000-0000-0000000000a2', $2, 'unimed', 'publicada')`, [ANTES_DO_CORTE, ONTEM])
  // 26/10: a linfadenectomia sem horário, que a caixa não mostra; ontem: uma completa
  await db.exec(`insert into public.escala_cirurgica_caso
    (id, escala_id, sala, ordem, hora, procedimento, anestesista, anestesista_user_id, turno, status_cirurgia, inicio_real, termino_real) values
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Sala 9', 3, 'AS', 'LINFADENECTOMIA', 'HUMBERTO', 'u-hum', 'matutino', 'terminada', null, null),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'CC - Sala 5', 1, '07:30', 'TIREOIDECTOMIA', 'HUMBERTO', 'u-hum', 'matutino', 'terminada', '07:40', '09:50')`)
  await db.exec(NO_AR_16)
  await db.exec(NO_AR_27)
  await db.exec(NO_AR_28)
}, 60000)
afterAll(async () => { await db?.close() })

const meu = async () => {
  const { rows } = await db.query('select public.escala_meu_preenchimento(6) as r')
  return rows[0].r
}

describe('"Seu preenchimento" a partir do corte da caixa (Humberto, 29/10)', () => {
  it('a data da migration é a da caixa da aba Minhas', () => {
    expect(MIGRATION).toContain(`date '${CORTE_PENDENCIAS_MINHAS}'`)
  })

  it('DEPOIS: a falta de antes do corte não pesa; a janela nunca começa antes dele', async () => {
    await db.exec(MIGRATION)
    const r = await meu()
    expect([r.casos, r.completos]).toEqual([1, 1])
    expect(r.desde >= CORTE_PENDENCIAS_MINHAS).toBe(true)
  })

  it('o rollback volta a janela desde 05/10', async () => {
    await db.exec(ROLLBACK)
    const { rows } = await db.query("select pg_get_functiondef('public.escala_meu_preenchimento'::regproc) as f")
    expect(rows[0].f).toContain("date '2026-10-05'")
    expect(rows[0].f).not.toContain("date '2026-10-27'")
  })
})
