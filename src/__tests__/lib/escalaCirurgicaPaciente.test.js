/**
 * Paciente só por iniciais, NA FORMA QUE O BANCO ACEITA.
 *
 * Incidente 02/09 (escala de 03/09, matutino): a publicação em lote subiu HRO e
 * Materno e a Unimed caiu com
 *   new row for relation "escala_cirurgica_caso" violates check constraint
 *   "escala_cirurgica_caso_paciente_iniciais_check"
 * — um único paciente com três letras seguidas (a Vision devolve "01 EDA" na
 * coluna do paciente das linhas de EXAMES) derrubou o hospital inteiro. A
 * sanitização agora roda na fronteira do service, e este arquivo trava que o
 * resultado SEMPRE satisfaz o predicado do CHECK.
 */
import { describe, it, expect } from 'vitest'
import { iniciais, iniciaisSeguras, ehIniciaisAceitas, INICIAIS_MAX } from '../../lib/escalaCirurgicaPaciente'

// Espelho do CHECK do banco: char_length <= 12 AND !~ '[[:alpha:]]{3,}'
const passaNoCheck = (s) => s === '' || (s.length <= INICIAIS_MAX && !/\p{L}{3,}/u.test(s))

describe('iniciais — nome completo → iniciais (LGPD)', () => {
  it('reduz nome a iniciais, ignorando partículas e limitando a 4', () => {
    expect(iniciais('Cleidiani de Souza Gelda Drabach')).toBe('C.S.G.D.')
    expect(iniciais('Karoline Matiello')).toBe('K.M.')
    expect(iniciais('Ana Beatriz Carolina Daniela Eduarda')).toBe('A.B.C.D.')
    expect(iniciais('')).toBe('')
  })
})

describe('ehIniciaisAceitas — o mesmo predicado do CHECK', () => {
  it('aceita vazio e iniciais; recusa três letras seguidas ou mais de 12 caracteres', () => {
    expect(ehIniciaisAceitas('')).toBe(true)
    expect(ehIniciaisAceitas('M.C.G.')).toBe(true)
    expect(ehIniciaisAceitas('A B C')).toBe(true)
    expect(ehIniciaisAceitas('01 EDA')).toBe(false)
    expect(ehIniciaisAceitas('MARIA')).toBe(false)
    expect(ehIniciaisAceitas('A.B.C.D.E.F.G.')).toBe(false)
  })
})

describe('iniciaisSeguras — idempotente e sempre aceita pelo banco', () => {
  it('deixa intacto o que já está em iniciais (não destrói "M.C.G.")', () => {
    expect(iniciaisSeguras('M.C.G.')).toBe('M.C.G.')
    expect(iniciaisSeguras('T.L.F.')).toBe('T.L.F.')
    expect(iniciaisSeguras(iniciaisSeguras('Tailise Lecardelli Frozza'))).toBe('T.L.F.')
  })
  it('converte nome completo e nome parcialmente abreviado', () => {
    expect(iniciaisSeguras('TAILISE LECARDELLI FROZZA')).toBe('T.L.F.')
    expect(iniciaisSeguras('Maria Silva')).toBe('M.S.')
    expect(iniciaisSeguras('MARIA C')).toBe('M.C.')
    expect(iniciaisSeguras('M.C.GOMES')).toBe('M.C.G.')
    expect(iniciaisSeguras('Gabriela Souza Leite')).toBe('G.S.L.')
    expect(iniciaisSeguras('MARIA')).toBe('M.')
  })
  it('iniciais COLADAS (um token de 3–4 maiúsculas) são pontuadas, não reduzidas', () => {
    expect(iniciaisSeguras('MCS')).toBe('M.C.S.')
    expect(iniciaisSeguras('MCS.')).toBe('M.C.S.')
    expect(iniciaisSeguras('JCSO')).toBe('J.C.S.O.')
    // primeiro nome curto sozinho cai na mesma regra — sem sobrenome não identifica
    expect(iniciaisSeguras('ANA')).toBe('A.N.A.')
    // com 5+ letras é nome, e nome vira inicial
    expect(iniciaisSeguras('JCSOP')).toBe('J.')
  })
  it('texto que não é nome (linhas de EXAMES/IMAGEM) não vira inicial de dígito', () => {
    expect(iniciaisSeguras('01 EDA')).toBe('E.')
    expect(iniciaisSeguras('02 EDA + 02 COLO (02 PCTES)')).toBe('E.C.P.')
    expect(iniciaisSeguras('04 FACO c/ bloqueio')).toBe('F.C.B.')
  })
  it('null/undefined/vazio → vazio (o RPC grava NULL)', () => {
    expect(iniciaisSeguras(null)).toBe('')
    expect(iniciaisSeguras(undefined)).toBe('')
    expect(iniciaisSeguras('   ')).toBe('')
  })
  it('o resultado passa no CHECK para qualquer entrada', () => {
    const entradas = [
      '', 'M.C.G.', 'MARIA DA SILVA', 'ANA', 'MSC', 'A.B.C.D.E.F.G.', 'ABCDEFGHIJKLMNOP',
      '01 EDA', 'MCS', 'MCS.', 'JCSO', 'José Ângelo Ñandú', 'X', 'A B C D E F G H I J K L M', '03h', 'PROTOCOLO ODONTO – 03h',
    ]
    for (const e of entradas) {
      const out = iniciaisSeguras(e)
      expect(passaNoCheck(out), `entrada ${JSON.stringify(e)} → ${JSON.stringify(out)}`).toBe(true)
      expect(iniciaisSeguras(out), 'idempotência').toBe(out)
    }
  })
})
