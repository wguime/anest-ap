/**
 * O cliente conhece as regras que o banco recusa (dono 03/09, depois do incidente de 02/09).
 *
 * Cada caso aqui é uma CHECK real de migration: se a regra mudar no banco e não mudar na lib,
 * este arquivo continua verde e a publicação volta a quebrar em produção, no meio do lote —
 * por isso os valores esperados citam a migration na descrição.
 */
import { describe, it, expect } from 'vitest'
import {
  validarCasoParaPublicacao, validarCasosParaPublicacao, resumirBloqueiosDeCampo, textoBloqueio, rotuloDoCaso,
} from '../../lib/escalaCirurgicaValidacao'
import { turnoDeHora } from '../../pages/escala-cirurgica/utils'
import { ehHoraSequencialEscala } from '../../lib/escalaCirurgicaRegras'

// mesma regra de `validarHorarioImportacao`: "AS"/"A seguir" é hora sequencial, não hora inválida
const horaValida = (h) => ehHoraSequencialEscala(h) || !!turnoDeHora(h)
const caso = (extra = {}) => ({ sala: 'CC - Sala 1', hora: '07:30', pacienteIniciais: 'A.B.', ...extra })

describe('validarCasoParaPublicacao — espelho das CHECKs', () => {
  it('caso limpo não tem bloqueio', () => {
    expect(validarCasoParaPublicacao(caso(), { horaValida })).toEqual([])
  })
  it('paciente com nome (3+ letras seguidas) é bloqueio — a CHECK de 20260628200000', () => {
    const [b] = validarCasoParaPublicacao(caso({ pacienteIniciais: 'MARIA DA SILVA' }), { horaValida })
    expect(b).toMatchObject({ campo: 'pacienteIniciais', motivo: 'paciente com nome em vez de iniciais' })
  })
  it('paciente com mais de 12 caracteres tem motivo próprio', () => {
    const [b] = validarCasoParaPublicacao(caso({ pacienteIniciais: 'A.B.C.D.E.F.G.' }), { horaValida })
    expect(b.motivo).toMatch(/mais de 12/)
  })
  it('iniciais válidas passam, inclusive sem ponto e com espaço', () => {
    for (const v of ['', 'M.C.G.', 'A B C', 'MC']) {
      expect(validarCasoParaPublicacao(caso({ pacienteIniciais: v }), { horaValida })).toEqual([])
    }
  })
  it('término previsto fora de HH:MM é bloqueio — CHECK de 20260729210000', () => {
    expect(validarCasoParaPublicacao(caso({ terminoPrevisto: '9:30' }), { horaValida })[0].campo).toBe('terminoPrevisto')
    expect(validarCasoParaPublicacao(caso({ terminoPrevisto: '25:00' }), { horaValida })[0].campo).toBe('terminoPrevisto')
    expect(validarCasoParaPublicacao(caso({ terminoPrevisto: '09:30' }), { horaValida })).toEqual([])
    expect(validarCasoParaPublicacao(caso({ terminoPrevisto: '' }), { horaValida })).toEqual([])
  })
  it('tipo e gravidade fora do enum são bloqueio; vazios passam', () => {
    expect(validarCasoParaPublicacao(caso({ tipo: 'urgentissima' }), { horaValida })[0].campo).toBe('tipo')
    expect(validarCasoParaPublicacao(caso({ gravidade: 'muito' }), { horaValida })[0].campo).toBe('gravidade')
    expect(validarCasoParaPublicacao(caso({ tipo: 'urgencia', gravidade: 'imediata' }), { horaValida })).toEqual([])
    expect(validarCasoParaPublicacao(caso({ tipo: '', gravidade: '' }), { horaValida })).toEqual([])
  })
  it('hora que não é horário é bloqueio; "AS" e vazio não são', () => {
    expect(validarCasoParaPublicacao(caso({ hora: '25:70' }), { horaValida })[0].campo).toBe('hora')
    expect(validarCasoParaPublicacao(caso({ hora: 'AS' }), { horaValida })).toEqual([])
    expect(validarCasoParaPublicacao(caso({ hora: '' }), { horaValida })).toEqual([])
  })
})

describe('validarCasosParaPublicacao — o bloqueio traz o ENDEREÇO do caso', () => {
  it('numera o caso dentro da sala, que é como a secretária acha a linha', () => {
    const bloqueios = validarCasosParaPublicacao([
      caso({ sala: 'CC - Sala 5' }),
      caso({ sala: 'CC - Sala 5', pacienteIniciais: 'JOAO PEDRO' }),
      caso({ sala: 'EXAMES', pacienteIniciais: '01 EDA' }),
    ], { horaValida })
    expect(bloqueios).toHaveLength(2)
    expect(textoBloqueio(bloqueios[0])).toBe('CC - Sala 5 · 2º caso: paciente com nome em vez de iniciais')
    expect(textoBloqueio(bloqueios[1])).toBe('EXAMES: paciente com nome em vez de iniciais')
  })
  it('o primeiro caso da sala não ganha número; do segundo em diante, sim', () => {
    expect(rotuloDoCaso({ sala: 'S1' }, 0)).toBe('S1')
    expect(rotuloDoCaso({ sala: 'S1' }, 2)).toBe('S1 · 3º caso')
    expect(rotuloDoCaso({ sala: '' }, 0)).toBe('sem sala')
  })
  it('lista limpa não gera bloqueio', () => {
    expect(validarCasosParaPublicacao([caso(), caso({ sala: 'S2' })], { horaValida })).toEqual([])
    expect(validarCasosParaPublicacao([], { horaValida })).toEqual([])
  })
})

describe('resumirBloqueiosDeCampo — o que o placar da aba mostra', () => {
  it('sem bloqueio, nada', () => {
    expect(resumirBloqueiosDeCampo([])).toEqual({ total: 0, texto: '' })
  })
  it('com um, a frase inteira; com vários, a primeira + quantos faltam', () => {
    const bs = validarCasosParaPublicacao([
      caso({ sala: 'S1', pacienteIniciais: 'ANA MARIA' }),
      caso({ sala: 'S2', pacienteIniciais: 'JOSE LUIS' }),
    ], { horaValida })
    expect(resumirBloqueiosDeCampo([bs[0]]).texto).toBe('S1: paciente com nome em vez de iniciais')
    expect(resumirBloqueiosDeCampo(bs)).toMatchObject({ total: 2, texto: 'S1: paciente com nome em vez de iniciais (e mais 1)' })
  })
})
