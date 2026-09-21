/**
 * Plantão do MATERNO pela escala numérica (dono 21/09/2026: "quero que confira também sempre
 * quem é o plantão do turno no materno infantil, confira pela escala numérica").
 *
 * O Materno não tem rodapé — a conferência da numérica (passo 8) nunca rodava lá. Agora, sem
 * rodapé, o hospital 'materno' compara quem a numérica escala no turno (azul) com quem assina
 * caso no mapa: igual não avisa; nome da numérica sem caso avisa; nome no mapa fora da
 * numérica avisa. Ordem não importa (não há fila) e o "?" do mapa nunca é preenchido.
 */
import { describe, it, expect } from 'vitest'
import dadosNumerica from '@/data/escalaNumerica.json'
import { montarOrdem } from '@/lib/escalaNumerica'
import { conferirLote, montarRoster } from '@/lib/escalaConferenciaHeadless'

const DATA = '2026-09-22'
const plantao = (turno) => montarOrdem(dadosNumerica, { data: DATA, hospital: 'materno', turno, ferias: null }).lista.map((p) => p.nome)

const perfis = [
  { id: 'uid-thayna', nome: 'THAYNÁ REGINA SANTOS', role: 'anestesiologista' },
  { id: 'uid-matheus', nome: 'MATHEUS PEREIRA', role: 'anestesiologista' },
  { id: 'uid-cury', nome: 'GUSTAVO CURY', role: 'anestesiologista' },
]
const aliases = [
  { apelido: 'THAYNA', userId: 'uid-thayna' }, { apelido: 'MATHEUS', userId: 'uid-matheus' }, { apelido: 'CURY', userId: 'uid-cury' },
]
const identidade = montarRoster({ perfis, aliases })

const caso = (sala, anestesista, hora) => ({
  sala, hora, anestesista, procedimento: 'AMIGDALECTOMIA', cirurgiao: 'Vanessa Bau',
  pacienteIniciais: 'A.B.', convenio: 'SUS', bloco: 'normal', tipo: 'eletiva',
})
const conferir = (rows, turno = 'matutino', extra = {}) => conferirLote({
  data: DATA, turno, ...identidade, dadosNumerica, hospitais: { materno: { rows, ordem: [], ajuda: [] } }, ...extra,
}).hospitais.materno
const avisoPlantao = (r) => r.avisos.find((a) => a.codigo === 'plantão materno')

describe('plantão do Materno pela numérica', () => {
  it('a numérica escala duas pessoas no Materno em 22/09 (o dataset é a fonte do teste)', () => {
    expect(plantao('matutino')).toHaveLength(2)
    expect(plantao('matutino')).toEqual(expect.arrayContaining(['THAYNA', 'MATHEUS']))
  })

  it('mapa com os dois nomes da numérica: confere, sem aviso, ordem indiferente', () => {
    const [a, b] = plantao('matutino')
    const r = conferir([caso('Sala 2 HC', b, '07:30'), caso('Sala 3 HC', a, '07:30'), caso('Sala 3 HC', '//', '08:30')])
    expect(avisoPlantao(r)).toBeUndefined()
    expect(r.numerica).toMatchObject({ plantao: true, iguais: true })
    expect(r.numerica.noMapa).toHaveLength(2)
  })

  it('só um dos dois assina caso: avisa quem a numérica escala e ficou sem caso, sem preencher o "?"', () => {
    const [a, b] = plantao('matutino')
    const r = conferir([caso('Sala 2 HC', a, '07:30'), caso('Sala 3 HC', '?', '07:30')])
    expect(avisoPlantao(r).texto).toContain(`sem caso no mapa: ${b}`)
    expect(avisoPlantao(r).texto).toContain(a)
    expect(r.payload.casos.find((c) => c.sala === 'Sala 3 HC').anestesista).toBe('?')
    expect(r.bloqueios).toHaveLength(0)
  })

  it('nome no mapa que a numérica não escala no Materno: avisa "fora da numérica" (troca ou leitura errada)', () => {
    const [a] = plantao('matutino')
    const r = conferir([caso('Sala 2 HC', a, '07:30'), caso('Sala 3 HC', 'CURY', '07:30')])
    expect(avisoPlantao(r).texto).toContain('no mapa e fora da numérica: CURY')
  })

  it('a tarde confere contra a tarde; caso da manhã no lote do Materno não entra', () => {
    const [a, b] = plantao('vespertino')
    const r = conferir([caso('Sala 3 HC', 'CURY', '07:30'), caso('Sala 3 HC', a, '14:00'), caso('Sala 3 HC', b, '15:00')], 'vespertino')
    expect(avisoPlantao(r)).toBeUndefined()
    expect(r.numerica.noMapa).not.toContain('CURY')
  })

  it('férias do dia saem da lista esperada antes de comparar', () => {
    const [a, b] = plantao('matutino')
    const semFerias = montarOrdem(dadosNumerica, { data: DATA, hospital: 'materno', turno: 'matutino', ferias: ['THAYNÁ REGINA SANTOS'] }).lista.map((p) => p.nome)
    expect(semFerias).not.toContain('THAYNA')
    const outro = a === 'THAYNA' ? b : a
    const r = conferir([caso('Sala 2 HC', outro, '07:30'), caso('Sala 3 HC', 'CURY', '07:30')], 'matutino', { ferias: ['THAYNÁ REGINA SANTOS'] })
    expect(avisoPlantao(r).texto).not.toContain('sem caso no mapa: THAYNA')
    expect(avisoPlantao(r).texto).toContain('no mapa e fora da numérica: CURY')
    expect(r.numerica.feriasConferidas).toBe(true)
  })
})
