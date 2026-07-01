import { describe, it, expect } from 'vitest'
import {
  gerarColunaLiberacao,
  nomeCirurgiaoCurto,
  resolverAnestesistas,
  titleCaseNome,
} from '../../lib/colunaLiberacao'

// ============================================================================
// Helpers de fixture — espelham o que a extração Vision + conferência entrega
// (cada caso já com cirurgião/anestesista nas posições corretas).
// ============================================================================
const caso = (sala, ordem, anestesista, cirurgiao, extra = {}) => ({
  sala,
  ordem,
  anestesista,
  cirurgiao,
  bloco: 'normal',
  isContinuacao: false,
  semAnestesista: false,
  ...extra,
})

describe('nomeCirurgiaoCurto — regra 3 (primeiro nome + inicial do último sobrenome)', () => {
  it('reduz nomes compostos preservando acento (regra 17)', () => {
    expect(nomeCirurgiaoCurto('João Rafael de Oliveira Dias')).toBe('João D')
    expect(nomeCirurgiaoCurto('Eduardo Francisco')).toBe('Eduardo F')
    expect(nomeCirurgiaoCurto('Cassiano Branco Dal Piva')).toBe('Cassiano P')
  })
  it('nome único fica só com o primeiro nome', () => {
    expect(nomeCirurgiaoCurto('Rafael')).toBe('Rafael')
  })
  it('caixa alta vira capitalizado', () => {
    expect(nomeCirurgiaoCurto('ACHYLLES NETO')).toBe('Achylles N')
  })
})

describe('titleCaseNome — regra 17 (sem caixa alta, primeira maiúscula)', () => {
  it('capitaliza cada palavra do nome do anestesista', () => {
    expect(titleCaseNome('JOAO HENRIQUE')).toBe('Joao Henrique')
    expect(titleCaseNome('GUILHERME MELO')).toBe('Guilherme Melo')
  })
})

describe('resolverAnestesistas — regra 2 ("//" herda da linha acima)', () => {
  it('propaga o anestesista pelas linhas seguintes da mesma sala', () => {
    const r = resolverAnestesistas([
      caso('S1', 1, 'EDUARDO', 'Rodrigo Souza'),
      caso('S1', 2, '//', 'Benito Bodanese'),
      caso('S1', 3, '', 'Benito Bodanese'),
    ])
    expect(r.map((c) => c.anestesista)).toEqual(['EDUARDO', 'EDUARDO', 'EDUARDO'])
  })
  it('remove o prefixo PED (regra 9) ao resolver', () => {
    const r = resolverAnestesistas([caso('S1', 1, 'PED EDUARDO', 'Benito Bodanese')])
    expect(r[0].anestesista).toBe('EDUARDO')
  })
})

// ============================================================================
// GOLDEN — escala Unimed 26/06/2026 (cobre //, PED, SRPA, Exames invertido,
// Imagem "?", continuação-com-cirurgião, nomes do rodapé sem casos).
// ============================================================================
describe('gerarColunaLiberacao — golden Unimed 26/06/2026', () => {
  const casos = [
    // C.O - CESAREA → DIEGO
    caso('C.O - CESAREA', 1, 'DIEGO', 'Taciana Lidineia Alflen', { hora: '13:30' }),
    caso('C.O - CESAREA', 2, '//', 'Fernanda Regina Becker', { hora: '15:00' }),
    caso('C.O - CESAREA', 3, '//', 'Fernanda Regina Becker', { hora: '16:30' }),
    caso('C.O - CESAREA', 4, '//', 'Fernanda Regina Becker', { hora: '18:00' }),
    // C.O - SALA 3 → JOAO HENRIQUE
    caso('C.O - SALA 3', 1, 'JOAO HENRIQUE', 'Achylles Neto', { hora: '13:30' }),
    caso('C.O - SALA 3', 2, '//', 'Eduardo Jose Prochazka Frigeri', { hora: '16:30' }),
    // SALA 1 → EDUARDO / PED EDUARDO
    caso('SALA 1', 1, 'EDUARDO', 'Rodrigo Souza', { hora: '13:30' }),
    caso('SALA 1', 2, 'PED EDUARDO', 'Benito Bodanese', { hora: '16:00' }),
    caso('SALA 1', 3, '//', 'Benito Bodanese', { hora: '17:15' }),
    caso('SALA 1', 4, '//', 'Benito Bodanese', { hora: '18:00' }),
    // SALA 2 → STAUB
    caso('SALA 2', 1, 'STAUB', 'Dirceu Felipe Valentini Junior', { hora: '13:30' }),
    caso('SALA 2', 2, '//', 'Dirceu Felipe Valentini Junior', { hora: '14:45' }),
    caso('SALA 2', 3, '//', 'Dirceu Felipe Valentini Junior', { hora: '16:00' }),
    // SALA 3 → MARILIO (1ª linha CONTINUAÇÃO mas com cirurgião informado → usa cirurgião)
    caso('SALA 3', 1, 'MARILIO', 'Leandro Trevizan', { hora: '13:30', isContinuacao: true }),
    caso('SALA 3', 2, '//', 'Eduardo Menegat', { hora: '14:30' }),
    // SALA 4 → LEONARDO
    caso('SALA 4', 1, 'LEONARDO', 'Liana Ortiz Ruas Winkelmann', { hora: '13:30' }),
    // SALA 6 → RODNEI
    caso('SALA 6', 1, 'RODNEI', 'Venilton Vieira', { hora: '13:30' }),
    caso('SALA 6', 2, '//', 'Juliano Esbissigo', { hora: '15:00' }),
    caso('SALA 6', 3, '//', 'Juliano Esbissigo', { hora: '16:15' }),
    caso('SALA 6', 4, '//', 'Ariane Fransozi', { hora: '18:00' }),
    // SALA 7 → OSCAR
    caso('SALA 7', 1, 'OSCAR', 'Pedro Barros', { hora: '13:30' }),
    caso('SALA 7', 2, '//', 'Pedro Barros', { hora: '14:45' }),
    caso('SALA 7', 3, '//', 'Pedro Barros', { hora: '16:00' }),
    // SRPA → GARIM
    caso('SRPA', 1, 'GARIM', '', { bloco: 'srpa', hora: '13:30' }),
    // EXAMES (lógica invertida → cirurgião à esquerda, anestesista à direita)
    caso('EXAMES', 1, 'ADRIANO', 'Elton', { bloco: 'exames', hora: '13:30' }),
    caso('EXAMES', 2, 'CURY', 'Farret', { bloco: 'exames', hora: '13:30' }),
    caso('EXAMES', 3, 'GUILHERME MELO', 'Claudia', { bloco: 'exames', hora: '13:30' }),
    // IMAGEM → "?" (sem anestesista)
    caso('IMAGEM', 1, '', 'Ana', { bloco: 'imagem', semAnestesista: true, hora: '16:00' }),
    // CONSULTORIO → TIAGO (sem cirurgião)
    caso('CONSULTORIO', 1, 'TIAGO', '', { bloco: 'consultorio', hora: '13:30' }),
  ]

  const rodape = [
    'LEONARDO', 'MARILIO', 'DIEGO', 'GARIM', 'RODNEI', 'OSCAR', 'CURY', 'ADRIANO',
    'EDUARDO', 'STAUB', 'JOAO HENRIQUE', 'TIAGO', 'GUILHERME MELO', 'JOAO RICARDO',
    'CRISTINA', 'RAQUEL',
  ]

  const r = gerarColunaLiberacao(casos, rodape, { hospital: 'Unimed' })

  it('produz uma linha por anestesista do rodapé, na ordem do rodapé (regra 1)', () => {
    expect(r.linhas.map((l) => l.texto)).toEqual([
      'Leonardo — Liana W',
      'Marilio — Leandro T/Eduardo M',
      'Diego — Taciana A/Fernanda B',
      'Garim — SRPA',
      'Rodnei — Venilton V/Juliano E/Ariane F',
      'Oscar — Pedro B',
      'Cury — Farret (Exames)',
      'Adriano — Elton (Exames)',
      'Eduardo — Rodrigo S/Benito B',
      'Staub — Dirceu J',
      'Joao Henrique — Achylles N/Eduardo F',
      'Tiago — Consultorio',
      'Guilherme Melo — Claudia (Exames)',
      'Joao Ricardo — …',
      'Cristina — …',
      'Raquel — …',
    ])
  })

  it('coloca os casos "?" no fim, com contexto (bloco + hora) (regra 10)', () => {
    expect(r.semAnestesista.map((i) => i.texto)).toEqual(['Ana — (Imagem 16:00) ?'])
  })

  it('o texto final separa o bloco "?" por uma linha em branco (regra 16)', () => {
    expect(r.texto.endsWith('Raquel — …\n\nAna — (Imagem 16:00) ?')).toBe(true)
  })

  it('remove cirurgiões duplicados para o mesmo anestesista (regra 15)', () => {
    const diego = r.linhas.find((l) => l.anestesista === 'Diego')
    expect(diego.cirurgioes).toEqual(['Taciana A', 'Fernanda B'])
  })
})

// ============================================================================
// HRO — blocos especiais Hemodinâmica/IOSC + emergência
// ============================================================================
describe('gerarColunaLiberacao — HRO (Hemodinâmica, IOSC, emergência)', () => {
  const casos = [
    caso('Sala 5', 1, 'DANIELA', 'Mateus Baptistella', { tipo: 'emergencia', hora: '13:00' }),
    // HEMO → ROSE (continuação sem cirurgião + angiografia com cirurgião, // herda)
    caso('HEMO', 1, 'ROSE', '', { bloco: 'hemodinamica', isContinuacao: true, hora: '13:00' }),
    caso('HEMO', 2, '//', 'Alexandre Medeiros', { bloco: 'hemodinamica', hora: '15:00' }),
    // IOSC → ROBERTA / MAURICIO (cirurgião informado)
    caso('IOSC-2', 1, 'ROBERTA', 'Rafael', { bloco: 'iosc', isContinuacao: true, hora: '13:00' }),
    caso('IOSC-3', 1, 'MAURICIO', 'Marco Antonio', { bloco: 'iosc', isContinuacao: true, hora: '13:00' }),
  ]
  const rodape = ['DANIELA', 'MAURICIO', 'ROSE', 'ROBERTA']
  const r = gerarColunaLiberacao(casos, rodape, { hospital: 'HRO' })

  it('emergência entra como caso normal (sem sufixo de bloco)', () => {
    expect(r.linhas.find((l) => l.anestesista === 'Daniela').texto).toBe('Daniela — Mateus B')
  })
  it('acrescenta (Hemodinamica) ao cirurgião e à continuação (regras 4/8)', () => {
    expect(r.linhas.find((l) => l.anestesista === 'Rose').texto).toBe(
      'Rose — Continuação (Hemodinamica)/Alexandre M (Hemodinamica)'
    )
  })
  it('acrescenta (IOSC) aos blocos IOSC (regra 6)', () => {
    expect(r.linhas.find((l) => l.anestesista === 'Roberta').texto).toBe('Roberta — Rafael (IOSC)')
    expect(r.linhas.find((l) => l.anestesista === 'Mauricio').texto).toBe('Mauricio — Marco A (IOSC)')
  })
})

// ============================================================================
// Materno/HC — formato pediátrico simples (um anestesista, vários cirurgiões)
// ============================================================================
describe('gerarColunaLiberacao — Materno/HC (pediátrico)', () => {
  const casos = [
    caso('Sala 3 HC', 1, 'ROMULO', 'Larissa Vendrame de Marchi', { hora: '07:30' }),
    caso('Sala 3 HC', 2, '//', 'Vanessa Bau', { hora: '13:30' }),
    caso('Sala 3 HC', 3, '//', 'Vanessa Bau', { hora: '14:30' }),
  ]
  const r = gerarColunaLiberacao(casos, ['ROMULO'], { hospital: 'Materno' })

  it('agrupa todos os cirurgiões do anestesista, dedup, na ordem', () => {
    expect(r.linhas[0].texto).toBe('Romulo — Larissa M/Vanessa B')
  })
})

describe('gerarColunaLiberacao — robustez', () => {
  it('lista vazia não quebra', () => {
    expect(gerarColunaLiberacao([], []).texto).toBe('')
  })
  it('anestesista do caso ausente do rodapé é anexado ao final', () => {
    const r = gerarColunaLiberacao([caso('S1', 1, 'EXTRA', 'Pedro Barros')], ['FULANO'])
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Fulano', 'Extra'])
  })
})
