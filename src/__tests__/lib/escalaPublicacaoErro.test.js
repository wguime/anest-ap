/**
 * Erro de publicação em português, sem vazar paciente.
 *
 * Incidente 02/09: o toast trazia `salvarEscalaTurno:rpc: new row for relation
 * "escala_cirurgica_caso" violates check constraint "escala_cirurgica_caso_paciente_iniciais_check"`.
 * Quem confere no centro cirúrgico não tem o que fazer com isso — e o `details` que vem junto
 * do Postgres carrega a LINHA inteira que falhou, com nome de paciente.
 */
import { describe, it, expect } from 'vitest'
import { mensagemErroPublicacao, ehErroDeRede } from '../../lib/escalaPublicacaoErro'

const erroRpc = (message, code = '23514') => Object.assign(new Error(`salvarEscalaTurno:rpc: ${message}`), { code })

describe('mensagemErroPublicacao', () => {
  it('a CHECK das iniciais vira instrução, não texto de banco', () => {
    const msg = mensagemErroPublicacao(erroRpc('new row for relation "escala_cirurgica_caso" violates check constraint "escala_cirurgica_caso_paciente_iniciais_check"'))
    expect(msg).toBe('Algum paciente está com nome em vez de iniciais. Use só as iniciais, até 12 caracteres.')
    expect(msg).not.toMatch(/constraint|relation|new row/i)
  })
  it.each([
    ['escala_cirurgica_caso_termino_previsto_check', /término previsto/i],
    ['escala_cirurgica_caso_tipo_check', /tipo que não existe/i],
    ['escala_cirurgica_caso_gravidade_check', /gravidade/i],
    ['escala_cirurgica_caso_turno_check', /turno inválido/i],
  ])('%s vira frase própria', (constraint, esperado) => {
    expect(mensagemErroPublicacao(erroRpc(`violates check constraint "${constraint}"`))).toMatch(esperado)
  })
  it('CHECK desconhecida ainda diz o que fazer, sem jargão', () => {
    expect(mensagemErroPublicacao(erroRpc('violates check constraint "algo_novo_check"')))
      .toBe('Algum caso está com um campo fora do formato aceito.')
  })
  it('permissão, turno/hospital inválidos e sessão expirada têm frase própria', () => {
    expect(mensagemErroPublicacao(Object.assign(new Error('x'), { code: '42501' }))).toMatch(/permissão/i)
    expect(mensagemErroPublicacao(new Error('salvarEscalaTurno:rpc: turno_invalido'))).toMatch(/Turno inválido/)
    expect(mensagemErroPublicacao(new Error('salvarEscalaTurno:rpc: hospital_invalido'))).toMatch(/Hospital inválido/)
    expect(mensagemErroPublicacao(new Error('salvarEscalaTurno:rpc: nao_autenticado'))).toMatch(/sessão expirou/i)
  })
  it('rede fora diz que NADA foi publicado — é o que decide se republica', () => {
    const rede = Object.assign(new TypeError('Failed to fetch'), {})
    expect(ehErroDeRede(rede)).toBe(true)
    expect(mensagemErroPublicacao(rede)).toMatch(/nada foi publicado/i)
  })
  it('erro sem mapa cai na mensagem crua, sem o prefixo do service', () => {
    expect(mensagemErroPublicacao(new Error('salvarEscalaTurno:rpc: algo inesperado'))).toBe('algo inesperado')
  })
  it('nunca devolve o `details` do Postgres (linha do banco, com paciente)', () => {
    const err = erroRpc('violates check constraint "escala_cirurgica_caso_paciente_iniciais_check"')
    err.details = 'Failing row contains (uuid, CC - Sala 5, 2, 07:30, MARIA DA SILVA, ...)'
    const msg = mensagemErroPublicacao(err)
    expect(msg).not.toMatch(/MARIA|Failing row/)
  })
  it('sem erro nenhum ainda devolve frase', () => {
    expect(mensagemErroPublicacao(null)).toBe('Não foi possível publicar.')
  })
})
