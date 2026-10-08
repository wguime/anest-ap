/**
 * OBSERVAÇÕES DA ESCALA NUMÉRICA (dono 08/10/2026) — migration
 * 20261008150000_escala_numerica_observacao.sql, rodada num Postgres em memória.
 *
 * Travas:
 *  - o autor é SEMPRE o do JWT (trigger), nunca o que o cliente manda — nem no ramo DO UPDATE;
 *  - uma linha por (data, turno, hospital): o upsert troca o texto e o autor;
 *  - escreve quem opera a escala (`can_write_escala_cirurgica`); lê todo autenticado;
 *  - apagar é gravar vazio — DELETE não existe para o app;
 *  - 300 caracteres no máximo, contados DEPOIS de tirar os espaços das pontas;
 *  - retenção de 90 dias pela data da escala (dono 08/10): a purga apaga só o que passou.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATION = 'supabase/migrations/20261008150000_escala_numerica_observacao.sql'
let db

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create function public.firebase_uid() returns text language sql
      as $$ select coalesce(current_setting('teste.uid', true), '') $$;
    create function public.can_write_escala_cirurgica() returns boolean language sql
      as $$ select coalesce(current_setting('teste.escreve', true), '1') = '1' $$;
    create table public.profiles (id text primary key, nome text);
    insert into public.profiles values ('uid-gui', 'GUILHERME MELO'), ('uid-dani', 'DANIELA REIS');
  `)
  await db.exec(readFileSync(MIGRATION, 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec(`reset role; truncate escala_numerica_observacao;
    select set_config('teste.uid', '', false), set_config('teste.escreve', '1', false);`)
})

/** Age como o app: papel `authenticated`, com o uid do JWT. */
async function comoUsuario(uid, { escreve = true } = {}) {
  await db.exec(`reset role;
    select set_config('teste.uid', '${uid}', false), set_config('teste.escreve', '${escreve ? '1' : '0'}', false);
    set role authenticated;`)
}
const upsert = (texto, extra = {}) => db.query(
  `insert into escala_numerica_observacao (data, turno, hospital, texto, autor_id, autor_nome)
   values ($1, $2, $3, $4, $5, $6)
   on conflict (data, turno, hospital) do update set texto = excluded.texto, autor_nome = excluded.autor_nome`,
  [extra.data ?? '2026-10-08', extra.turno ?? 'matutino', extra.hospital ?? 'hro', texto,
    extra.autorId ?? 'forjado', extra.autorNome ?? 'Fulano'])
const linhas = async () => (await db.query('select * from escala_numerica_observacao order by turno, hospital')).rows

describe('autor server-side', () => {
  it('grava o uid e o nome do JWT, não o que o cliente mandou', async () => {
    await comoUsuario('uid-gui')
    await upsert('  Sala 5 bloqueada até as 10h.  ')
    const [l] = await linhas()
    expect(l).toMatchObject({ autor_id: 'uid-gui', autor_nome: 'GUILHERME MELO', texto: 'Sala 5 bloqueada até as 10h.' })
  })

  it('no upsert de outra pessoa, o autor vira ela (uid e nome do MESMO usuário)', async () => {
    await comoUsuario('uid-gui')
    await upsert('primeira')
    await comoUsuario('uid-dani')
    await upsert('segunda', { autorNome: 'GUILHERME MELO' })
    const todas = await linhas()
    expect(todas).toHaveLength(1)
    expect(todas[0]).toMatchObject({ texto: 'segunda', autor_id: 'uid-dani', autor_nome: 'DANIELA REIS' })
  })

  it('perfil sem nome (ou sem perfil): o nome fica vazio — nunca o do cliente nem o do autor anterior', async () => {
    await comoUsuario('uid-gui')
    await upsert('primeira')
    await comoUsuario('uid-sem-perfil')
    await upsert('segunda', { autorNome: 'NOME FORJADO' })
    const [l] = await linhas()
    expect(l).toMatchObject({ texto: 'segunda', autor_id: 'uid-sem-perfil', autor_nome: null })
  })

  it('manhã e tarde, e cada hospital, são linhas separadas', async () => {
    await comoUsuario('uid-gui')
    await upsert('manhã HRO')
    await upsert('tarde HRO', { turno: 'vespertino' })
    await upsert('manhã consultório', { hospital: 'consultorio' })
    expect((await linhas()).map((l) => `${l.turno}:${l.hospital}`))
      .toEqual(['matutino:consultorio', 'matutino:hro', 'vespertino:hro'])
  })
})

describe('quem escreve e quem lê', () => {
  it('quem não opera a escala NÃO grava, mas lê', async () => {
    await comoUsuario('uid-gui')
    await upsert('do coordenador')
    await comoUsuario('uid-outro', { escreve: false })
    await expect(upsert('intruso', { hospital: 'unimed' })).rejects.toThrow(/row-level security/)
    await expect(upsert('por cima')).rejects.toThrow(/row-level security/)
    expect((await linhas()).map((l) => l.texto)).toEqual(['do coordenador'])
  })

  it('apagar é gravar vazio: DELETE é recusado', async () => {
    await comoUsuario('uid-gui')
    await upsert('vai sumir')
    await expect(db.query('delete from escala_numerica_observacao')).rejects.toThrow(/permission denied/)
    await upsert('   ')
    const [l] = await linhas()
    expect(l).toMatchObject({ texto: '', autor_id: 'uid-gui' })
  })

  it('anon não lê nem grava', async () => {
    await db.exec('reset role; set role anon;')
    await expect(db.query('select * from escala_numerica_observacao')).rejects.toThrow(/permission denied/)
  })
})

describe('limites', () => {
  it('300 caracteres passam (os espaços das pontas não contam); 301 não', async () => {
    await comoUsuario('uid-gui')
    await upsert(`   ${'a'.repeat(300)}   `)
    await expect(upsert('b'.repeat(301), { hospital: 'unimed' })).rejects.toThrow(/check constraint/)
  })

  it('turno e hospital fora da lista são recusados', async () => {
    await comoUsuario('uid-gui')
    await expect(upsert('x', { turno: 'noturno' })).rejects.toThrow(/check constraint/)
    await expect(upsert('x', { hospital: 'feriado' })).rejects.toThrow(/check constraint/)
    await upsert('grafia', { hospital: ' HRO ' })
    expect((await linhas())[0].hospital).toBe('hro')
  })
})

describe('retenção de 90 dias (dono 08/10)', () => {
  it('a purga apaga as observações de datas com mais de 90 dias e mantém o resto', async () => {
    await comoUsuario('uid-gui')
    const dia = async (dias) => (await db.query(`select (current_date - ${dias})::text d`)).rows[0].d
    await upsert('velha', { data: await dia(91) })
    await upsert('no limite', { data: await dia(90), hospital: 'unimed' })
    await upsert('de hoje', { data: await dia(0), hospital: 'materno' })
    await db.exec('reset role')
    const { rows } = await db.query('select public.escala_numerica_observacao_purge() n')
    expect(rows[0].n).toBe(1)
    expect((await linhas()).map((l) => l.texto).sort()).toEqual(['de hoje', 'no limite'])
  })

  it('o app não chama a purga', async () => {
    await comoUsuario('uid-gui')
    await expect(db.query('select public.escala_numerica_observacao_purge()')).rejects.toThrow(/permission denied/)
  })
})
