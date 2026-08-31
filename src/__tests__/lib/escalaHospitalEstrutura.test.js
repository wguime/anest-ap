/**
 * De quem é o documento, pelo que ele TRAZ (dono 2026-08-30: "tentei anexar as
 * escalas de amanhã de manhã, mas não está reconhecendo a escala do HRO").
 *
 * Duas coisas diferentes estão travadas aqui: (1) marca exclusiva CLASSIFICA um
 * anexo que a leitura de layout deixou vazio; (2) a assimetria — uma marca
 * preenche, duas contradizem, e contradição PERGUNTA em vez de escolher.
 */
import { describe, it, expect } from 'vitest'
import { hospitalPelaEstrutura, decidirHospital } from '@/lib/escalaHospitalEstrutura'

describe('marca exclusiva diz o hospital', () => {
  it('IOSC só existe na escala do HRO', () => {
    const r = hospitalPelaEstrutura({ casos: [{ sala: 'IOSC', bloco: 'iosc' }, { sala: 'Sala 3', bloco: 'normal' }] })
    expect(r.hospital).toBe('hro')
  })

  it('Bloco M, Bloco A e a Emergência também são do HRO', () => {
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'Bloco M - Sala 2' }] }).hospital).toBe('hro')
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'EMERGENCIA' }] }).hospital).toBe('hro')
  })

  it('Accurata e Umanitá são da Unimed; "CC -" e "CESAREA" também', () => {
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'C.O - CESÁREA' }] }).hospital).toBe('unimed')
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'Umanitá', bloco: 'umanita' }] }).hospital).toBe('unimed')
  })

  it('"Sala 2 HC" é do Materno', () => {
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'Sala 2 HC' }] }).hospital).toBe('materno')
  })

  it('⚠️ Hemodinâmica, SRPA e o bloco `materno` NÃO classificam — MEDIDO', () => {
    // 30/08, 1.000 casos publicados em 60 dias: Hemodinâmica 9 no HRO / 11 na
    // Unimed; SRPA 3 / 18; bloco `materno` 6 no Materno / 3 na Unimed (onde é o
    // C.O da própria casa). Marca que existe nos dois não classifica nada — e
    // classificar por ela mandaria a escala para a aba errada, que é o defeito
    // que este arquivo inteiro existe para evitar.
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'Hemodinâmica', bloco: 'hemodinamica' }] }).hospital).toBe('')
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'SRPA', bloco: 'srpa' }] }).hospital).toBe('')
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'C.O', bloco: 'materno' }] }).hospital).toBe('')
  })

  it('"Sala 6" pelado não é de ninguém — o da Unimed vem assim às vezes', () => {
    // dono 25/08: "na escala Unimed não está saindo com a Sala, está aparecendo
    // apenas um número". Foi assim que vieram os 31 casos do feriado.
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'Sala 6' }, { sala: 'Sala 3' }] }).hospital).toBe('')
  })

  it('Exames, Imagem e Consultório NÃO classificam — os dois hospitais têm', () => {
    const r = hospitalPelaEstrutura({
      casos: [{ sala: 'Exames', bloco: 'exames' }, { sala: 'Imagem', bloco: 'imagem' }, { sala: 'Consultório', bloco: 'consultorio' }],
    })
    expect(r.hospital).toBe('')
  })

  it('documento com marca dos dois não decide nada', () => {
    const r = hospitalPelaEstrutura({ casos: [{ sala: 'IOSC', bloco: 'iosc' }, { sala: 'Umanitá', bloco: 'umanita' }] })
    expect(r.hospital).toBe('')
  })

  it('a MESMA linha em dois campos vale UMA evidência, não duas', () => {
    // bloco `iosc` + sala "IOSC" é o mesmo fato visto duas vezes: se contasse 2,
    // uma linha solta já derrubaria a leitura de layout
    expect(hospitalPelaEstrutura({ casos: [{ sala: 'IOSC', bloco: 'iosc' }] }).forca).toBe(1)
  })
})

describe('planilha — o cabeçalho diz de quem é', () => {
  it('coluna LEITO é do mapa do HRO', () => {
    const r = hospitalPelaEstrutura({ headers: ['Hora', 'Leito', 'Paciente', 'Cirurgião', 'ANEST', 'Sala'] })
    expect(r.hospital).toBe('hro')
  })

  it('IDADE e TEMPO são do export da Unimed', () => {
    const r = hospitalPelaEstrutura({
      headers: ['SALA', 'PACIENTE', 'IDADE', 'PROCEDIMENTO', 'TEMPO', 'CIRURGIÃO', 'CONVÊNIO', 'ANEST'],
    })
    expect(r.hospital).toBe('unimed')
  })
})

describe('leitura de layout × conteúdo', () => {
  it('layout vazio: uma marca já preenche', () => {
    expect(decidirHospital('', { hospital: 'hro', forca: 1 })).toEqual({ hospital: 'hro', origem: 'estrutura', conflito: '' })
  })

  it('uma marca NÃO derruba o que o layout afirmou', () => {
    // a leitura erra um `bloco` de vez em quando; trocar o hospital do arquivo
    // por causa de uma linha sairia mais caro do que a leitura errada
    expect(decidirHospital('materno', { hospital: 'hro', forca: 1 }).hospital).toBe('materno')
  })

  it('duas marcas contra o layout PERGUNTAM — não escolhem', () => {
    const d = decidirHospital('materno', { hospital: 'hro', forca: 2 })
    expect(d.hospital).toBe('')
    expect(d.conflito).toBe('hro')
  })

  it('layout e conteúdo de acordo seguem pelo layout', () => {
    expect(decidirHospital('hro', { hospital: 'hro', forca: 3 })).toEqual({ hospital: 'hro', origem: 'layout', conflito: '' })
  })

  it('nada de nada continua sem hospital', () => {
    expect(decidirHospital('', { hospital: '', forca: 0 }).hospital).toBe('')
  })
})
