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

describe('gerarColunaLiberacao — salas, plantonista e casos descobertos (F1)', () => {
  it('cada linha carrega as salas onde o anestesista está escalado', () => {
    const casos = [
      caso('SALA 1', 0, 'EDUARDO', 'Rodrigo Souza'),
      caso('SALA 5', 0, 'EDUARDO', 'Benito Bodanese'),
      caso('SALA 2', 0, 'STAUB', 'Dirceu Valentini'),
    ]
    const r = gerarColunaLiberacao(casos, ['EDUARDO', 'STAUB'])
    expect(r.linhas[0].salas).toEqual(['SALA 1', 'SALA 5'])
    expect(r.linhas[1].salas).toEqual(['SALA 2'])
  })
  it('o 1º nome do rodapé é o plantonista (badge) e o retorno expõe o nome', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'LEONARDO', 'Liana W')], ['LEONARDO', 'MARILIO'])
    expect(r.plantonista).toBe('Leonardo')
    expect(r.linhas.map((l) => l.isPlantonista)).toEqual([true, false])
  })
  it('rodapé vazio → plantonista null e nenhuma linha marcada', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'EXTRA', 'Pedro Barros')], [])
    expect(r.plantonista).toBeNull()
    expect(r.linhas[0].isPlantonista).toBe(false)
  })
  it('caso com anestesista vazio (não-"?") NÃO some: vira sala descoberta (?)', () => {
    const r = gerarColunaLiberacao([caso('S9', 0, '', 'Pedro Barros', { hora: '14:00' })], [])
    expect(r.linhas).toHaveLength(0)
    expect(r.semAnestesista).toHaveLength(1)
    expect(r.semAnestesista[0].cirurgiao).toBe('Pedro B')
  })
  it('"//" no PRIMEIRO caso da sala não vira linha literal — vira sala descoberta', () => {
    const r = gerarColunaLiberacao([caso('S9', 0, '//', 'Pedro Barros')], [])
    expect(r.linhas.find((l) => l.anestesista.includes('/'))).toBeUndefined()
    expect(r.semAnestesista).toHaveLength(1)
  })
})

describe('troca de sala refletida na coluna (F1.5)', () => {
  it('após o swap dos casos, cada linha mostra cirurgiões/sala novos e a ORDEM do rodapé não muda', () => {
    // antes: ANA na S1 (Cir Um), BETO na S2 (Cir Dois) → swap aplicado nos casos:
    const depois = [
      caso('S1', 0, 'BETO', 'Cirillo Umberto'),
      caso('S2', 0, 'ANA', 'Cirilo Doisberg'),
    ]
    const r = gerarColunaLiberacao(depois, ['ANA', 'BETO'])
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Ana', 'Beto']) // ordem intacta
    expect(r.linhas[0].salas).toEqual(['S2'])                          // Ana agora na S2
    expect(r.linhas[0].cirurgioes).toEqual(['Cirilo D'])
    expect(r.linhas[1].salas).toEqual(['S1'])
    expect(r.linhas[1].cirurgioes).toEqual(['Cirillo U'])
  })
})

describe('nomes em AZUL — ajuda de outro hospital (F1.8)', () => {
  it('azuis vão ao FIM da lista (primeiros a serem liberados), com isAjuda', () => {
    const casos = [
      caso('S1', 0, 'LEONARDO', 'Liana Winkelmann'),
      caso('S2', 0, 'DIEGO', 'Taciana Alflen'),
      caso('S3', 0, 'CURY', 'Farret Gomes'),
    ]
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'DIEGO', 'CURY'], { ajudaExterna: ['DIEGO'] })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Cury', 'Diego'])
    expect(r.linhas[2].isAjuda).toBe(true)
    expect(r.linhas[0].isPlantonista).toBe(true)
    expect(r.plantonista).toBe('Leonardo')
  })
  it('azul como 1º do rodapé NÃO vira plantonista (plantonista = 1º não-azul)', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'DIEGO', 'Xavier Yves')], ['DIEGO', 'LEONARDO'], { ajudaExterna: ['DIEGO'] })
    expect(r.plantonista).toBe('Leonardo')
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Diego'])
  })
  it('azul listado só em ajudaExterna (fora do rodapé) também entra ao fim', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'CURY', 'Farret Gomes')], ['LEONARDO'], { ajudaExterna: ['CURY'] })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Cury'])
    expect(r.linhas[1].isAjuda).toBe(true)
  })
  it('sem ajudaExterna nada muda (retrocompat golden)', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'LEONARDO', 'Liana W')], ['LEONARDO', 'MARILIO'])
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio'])
    expect(r.linhas.every((l) => !l.isAjuda)).toBe(true)
  })
})
