// Executa o sanitizador da edge sem iniciar Deno.serve nem chamar serviços.
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { describe, it, expect } from 'vitest'
import { aplicarCorNosCasos, lerRodape, derivarRodape, blanquearForaDoRodape } from '../../../supabase/functions/_shared/escala-cor.ts'
import { resolverRoster } from '../../../supabase/functions/_shared/escala-roster.ts'
import { normalizarCasos } from '../../../supabase/functions/_shared/escala-normalizacao.ts'

const fonte = readFileSync('supabase/functions/parse-escala-cirurgica/index.ts', 'utf8')
const inicio = fonte.indexOf('const BLOCOS =')
const fim = fonte.indexOf('function sanitizePosicoes(', inicio)
if (inicio < 0 || fim < inicio) throw new Error('Sanitizador da edge não encontrado')
const code = stripTypeScriptTypes(fonte.slice(inicio, fim))
const sanitizeCasos = runInNewContext(`${code}; sanitizeCasos`)

function ler(casos) {
  const sanitizados = aplicarCorNosCasos(sanitizeCasos(casos))
  const roster = resolverRoster(sanitizados, ['ANA', 'BETO'])
  const normalizados = normalizarCasos(roster.casos)
  const rodape = derivarRodape(lerRodape({ rodape: [{ nome: 'ANA', cor: 'vermelho' }] }), normalizados.casos)
  return { ...rodape, ...blanquearForaDoRodape(normalizados.casos, rodape.ordemLiberacao, rodape.ajudaExterna) }
}

const caso = { sala: 'Exames', hora: '08:00', pacienteIniciais: 'A.B.', procedimento: 'EDA', anestesista: 'BETO' }

describe('metadados atravessam o sanitizador real da edge', () => {
  it('azul no corpo mantém o responsável fora do rodapé e o inclui na ajuda', () => {
    const r = ler([{ ...caso, cor: 'azul' }])
    expect(r.casos[0].anestesista).toBe('BETO')
    expect(r.ajudaExterna).toEqual(['BETO'])
    expect(r.apagados).toBe(0)
  })

  it('amarelo chega à conferência como informação da imagem', () => {
    expect(ler([{ ...caso, anestesista: 'ANA', cor: 'amarelo' }]).casos[0].cor).toBe('amarelo')
  })

  it('o contrato legado com repeticao continua representando //', () => {
    expect(ler([{ ...caso, anestesista: '', repeticao: true }]).casos[0].anestesista).toBe('//')
  })

  it('continua apagando nome sem apoio no rodapé e sem azul', () => {
    const r = ler([{ ...caso, cor: '' }])
    expect(r.casos[0]).toMatchObject({ anestesista: '', semAnestesista: true })
    expect(r.ajudaExterna).toEqual([])
  })
})
