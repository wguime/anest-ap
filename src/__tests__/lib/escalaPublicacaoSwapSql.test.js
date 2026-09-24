import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, existsSync } from 'node:fs'

const antiga = readFileSync('supabase/migrations/20260923160000_escala_republicar_preserva_andamento.sql', 'utf8')
const nova = 'supabase/migrations/20260923200000_escala_republicacao_swap.sql'
let db
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create function public.firebase_uid() returns text language sql as $$ select 'secretaria-teste'::text $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql as $$ select true $$;
    create table public.profiles (id text, nome text);
    create table public.escala_anestesista_alias (user_id text, apelido text);
    create table public.escala_cirurgica (
      id uuid primary key default gen_random_uuid(), data date, hospital text, status text,
      created_by text, created_at timestamptz, updated_at timestamptz,
      ordem_liberacao jsonb, ajuda_externa jsonb, liberacoes jsonb, linha_overrides jsonb,
      publicacao_turnos jsonb, fds_meta jsonb, source_image_path text,
      published_at timestamptz, published_by text, published_by_name text,
      unique(data,hospital));
    create table public.escala_cirurgica_caso (
      id uuid primary key default gen_random_uuid(), escala_id uuid, sala text, ordem int,
      hora text, tempo_estimado text, termino_previsto text, paciente_iniciais text,
      idade text, procedimento text, convenio text, cirurgiao text, cirurgiao_display text,
      anestesista text, anestesista_user_id text, residente text, residente_user_id text,
      bloco text, is_continuacao boolean, sem_anestesista boolean, tipo text, gravidade text,
      turno text, status_cirurgia text default 'agendada', status_extra text,
      status_atualizado_em timestamptz, status_atualizado_por text,
      origem text not null default 'importacao', created_at timestamptz not null default now(),
      updated_at timestamptz not null default now());
  `)
  const inicio = antiga.indexOf('create or replace function public.rpc_publicar_escala_turno(')
  await db.exec(antiga.slice(inicio, antiga.indexOf('\n$$;', inicio) + 4))
  // Sem a migration, este mesmo teste reproduz o defeito no corpo anterior.
  if (existsSync(nova)) await db.exec(readFileSync(nova, 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => { await db.exec('truncate escala_cirurgica, escala_cirurgica_caso') })

const caso = (uid, sala, turno = 'matutino') => ({
  sala, anestesista: uid?.toUpperCase() || 'A + B', anestesista_user_id: uid,
  paciente_iniciais: 'X.Y.', procedimento: 'procedimento teste', turno,
})
const publicar = async (casos, preservar = null, turno = 'matutino') => {
  const { rows } = await db.query(`select public.rpc_publicar_escala_turno(
    '2099-01-01','unimed',$1,$2::jsonb,$3::jsonb,null,$4::jsonb) as r`,
  [turno, JSON.stringify({ ordem_liberacao: ['A','B','C'] }), JSON.stringify(casos), JSON.stringify(preservar)])
  return rows[0].r
}
const preparar = async (pares) => {
  await publicar([caso('tarde', 'T1')], null, 'vespertino')
  await publicar([caso('a', 'S1'), caso('b', 'S2')])
  const overrides = Object.fromEntries(pares.map(([de, uid]) => [`matutino:${de}`, {
    assumidaPor: { uid, nome: uid.toUpperCase(), de: { uid: de }, casoIds: ['id-obsoleto'] },
    observacao: 'preservar',
  }]))
  overrides['vespertino:a'] = { observacao: 'outro turno' }
  await db.query(`update escala_cirurgica set linha_overrides=$1::jsonb,
    liberacoes='{"matutino:a":{"liberadoEm":"2099-01-01"},"vespertino:a":{"liberadoEm":"2099-01-01"}}'`, [JSON.stringify(overrides)])
  return { campos: ['assumidaPor','observacao'], linhas: pares.map(([de]) => ({ chave: de })) }
}

describe('republicação preserva os dois lados da troca', () => {
  it.each([
    [['a','b'], ['b','a']],
    [['a','b'], ['b','c'], ['c','a']],
    [['a','c']],
  ])('transfere cada caso uma vez, pelo dono original: %j', async (...pares) => {
    const preservar = await preparar(pares)
    const entradas = [caso('a','S1'), caso('b','S2'), caso('c','S3'), caso(null,'Dupla')]
    const r = await publicar(entradas, preservar)
    const destino = new Map(pares)
    for (const c of entradas) {
      const salvo = r.casos.find((x) => x.sala === c.sala)
      expect(salvo.anestesista_user_id).toBe(destino.get(c.anestesista_user_id) || c.anestesista_user_id)
    }
    const recibos = pares.map(([de]) => r.header.linha_overrides[`matutino:${de}`].assumidaPor.casoIds)
    expect(new Set(recibos.flat()).size).toBe(recibos.flat().length)
    for (const [i, [de]] of pares.entries()) {
      const sala = entradas.find((c) => c.anestesista_user_id === de).sala
      expect(recibos[i]).toEqual([r.casos.find((c) => c.sala === sala).id])
    }
    expect(r.casos.find((c) => c.sala === 'T1').anestesista_user_id).toBe('tarde')
    expect(r.header.liberacoes['matutino:a']).toBeUndefined()
    expect(r.header.liberacoes['vespertino:a']).toBeDefined()
    expect(r.header.linha_overrides['vespertino:a'].observacao).toBe('outro turno')
    expect(r.header.ordem_liberacao.matutino).toEqual(['A','B','C'])
  })

  it('limpa IDs antigos do recibo quando a foto não contém caso do dono original', async () => {
    const preservar = await preparar([['a','b']])
    const r = await publicar([caso('c','S3')], preservar)
    expect(r.header.linha_overrides['matutino:a'].assumidaPor.casoIds).toEqual([])
  })

  it('urgência manual fica com quem atende numa troca A↔B', async () => {
    const preservar = await preparar([['a','b'], ['b','a']])
    const { rows: [{ id }] } = await db.query('select id from escala_cirurgica')
    await db.query(`insert into escala_cirurgica_caso (escala_id, sala, anestesista, anestesista_user_id, turno, origem)
      values ($1, 'Urgência', 'B', 'b', 'matutino', 'manual')`, [id])
    const r = await publicar([caso('a','S1'), caso('b','S2')], preservar)
    expect(r.casos.find((c) => c.sala === 'Urgência').anestesista_user_id).toBe('b')
    expect(r.casos.find((c) => c.sala === 'S1').anestesista_user_id).toBe('b')
    expect(r.casos.find((c) => c.sala === 'S2').anestesista_user_id).toBe('a')
  })

  it('migration pode ser reaplicada sem alterar a definição', async () => {
    if (!existsSync(nova)) return
    const sql = readFileSync(nova, 'utf8')
    const def = () => db.query("select pg_get_functiondef('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure) as f")
    const antes = await def()
    await db.exec(sql)
    expect(await def()).toEqual(antes)
  })
})
