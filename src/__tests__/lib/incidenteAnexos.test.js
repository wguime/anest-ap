import { describe, it, expect } from 'vitest'
import {
  ANEXO_MAX_MB,
  ANEXO_MAX_COUNT,
  pastaAnexo,
  anexoExtensao,
  anexoNomePersistido,
  buildAnexoPath,
  validarAnexos,
  sanitizeAttachments,
  anexoNome,
  formatAnexoSize,
  resolveContentType,
} from '@/lib/incidenteAnexos'

const MB = 1024 * 1024

describe('pastaAnexo', () => {
  it('separa denúncia/incidente e anonimato (pasta decide o scrub de owner no banco)', () => {
    expect(pastaAnexo('denuncia', false)).toBe('denuncias')
    expect(pastaAnexo('denuncia', true)).toBe('denuncias-anon')
    expect(pastaAnexo('incidente', false)).toBe('incidentes')
    expect(pastaAnexo('incidente', true)).toBe('incidentes-anon')
  })
})

describe('anexoExtensao', () => {
  it('normaliza extensões comuns', () => {
    expect(anexoExtensao('evidencia.PDF')).toBe('pdf')
    expect(anexoExtensao('foto.jpeg')).toBe('jpeg')
  })

  it('cai em bin para nomes sem extensão segura', () => {
    expect(anexoExtensao('sem-extensao')).toBe('bin')
    expect(anexoExtensao('duplo..')).toBe('bin')
    expect(anexoExtensao('a.' + 'x'.repeat(11))).toBe('bin')
    expect(anexoExtensao('estranho.p df')).toBe('bin')
    expect(anexoExtensao(null)).toBe('bin')
  })
})

describe('anexoNomePersistido (LGPD B1)', () => {
  it('anônimo NUNCA persiste o nome original — vira evidencia-N.ext', () => {
    expect(anexoNomePersistido('Digitalização de Fulano.pdf', true, 0)).toBe('evidencia-1.pdf')
    expect(anexoNomePersistido('WhatsApp Image João.jpeg', true, 1)).toBe('evidencia-2.jpeg')
    expect(anexoNomePersistido('sem-extensao', true, 2)).toBe('evidencia-3.bin')
  })

  it('identificado mantém o nome original', () => {
    expect(anexoNomePersistido('contrato.pdf', false, 0)).toBe('contrato.pdf')
  })
})

describe('buildAnexoPath', () => {
  it('monta pasta/protocolo/uuid.ext sem caracteres fora do allowlist', () => {
    expect(buildAnexoPath('denuncias', 'DEN-20260730-1234', 'uuid-1', 'pdf'))
      .toBe('denuncias/DEN-20260730-1234/uuid-1.pdf')
  })

  it('sanitiza protocolo hostil e tolera ausência', () => {
    expect(buildAnexoPath('denuncias', '../x/../{y}', 'u', 'pdf')).toBe('denuncias/xy/u.pdf')
    expect(buildAnexoPath('incidentes', '', 'u', 'bin')).toBe('incidentes/sem-protocolo/u.bin')
  })
})

describe('validarAnexos', () => {
  const f = (name, size) => ({ name, size })

  it('aceita seleção dentro dos limites', () => {
    expect(validarAnexos([f('a.pdf', MB)], []).ok).toBe(true)
  })

  it('rejeita acima do teto de quantidade (contando os já escolhidos)', () => {
    const existentes = Array.from({ length: ANEXO_MAX_COUNT }, (_, i) => f(`e${i}`, MB))
    const res = validarAnexos([f('novo.pdf', MB)], existentes)
    expect(res.ok).toBe(false)
    expect(res.erro).toContain(`${ANEXO_MAX_COUNT}`)
  })

  it('rejeita arquivo acima do teto de tamanho, no limite passa', () => {
    // .jpg, não .mov: desde 06/09/2026 vídeo é recusado por TIPO, e o caso aqui
    // é o teto de TAMANHO — com .mov o teste passaria pelo motivo errado.
    expect(validarAnexos([f('grande.jpg', ANEXO_MAX_MB * MB + 1)], []).ok).toBe(false)
    expect(validarAnexos([f('no-limite.jpg', ANEXO_MAX_MB * MB)], []).ok).toBe(true)
  })

  it('recusa tipo fora da lista do balde — senão o upload falha e leva o relato junto', () => {
    // Decisão do dono 05/09/2026: imagens e PDF. Como `allowed_mime_types` é do
    // balde inteiro, o app segue a mesma regra; e como falha de upload bloqueia
    // o envio (30/07/2026), barrar aqui é o que evita perder o relato.
    for (const nome of ['clipe.mov', 'video.mp4', 'audio.mp3', 'planilha.xlsx', 'malware.exe']) {
      const res = validarAnexos([f(nome, 1024)], [])
      expect(res.ok, nome).toBe(false)
      expect(res.erro).toContain('imagem (JPG, PNG, HEIC) ou PDF')
    }
  })

  it('aceita HEIC do iPhone mesmo sem o navegador informar o tipo', () => {
    expect(resolveContentType(f('IMG_0001.HEIC', 1024))).toBe('image/heic')
    expect(validarAnexos([f('IMG_0001.HEIC', 1024)], []).ok).toBe(true)
  })

  it('rejeita arquivo vazio (0 bytes)', () => {
    const res = validarAnexos([f('vazio.pdf', 0)], [])
    expect(res.ok).toBe(false)
    expect(res.erro).toContain('vazio')
  })
})

describe('sanitizeAttachments', () => {
  it('persiste só os 4 campos conhecidos de objetos com path', () => {
    const out = sanitizeAttachments([
      { name: 'a.pdf', path: 'denuncias/DEN-1/u.pdf', size: 10, type: 'application/pdf', extra: 'x' },
    ])
    expect(out).toEqual([
      { name: 'a.pdf', path: 'denuncias/DEN-1/u.pdf', size: 10, type: 'application/pdf' },
    ])
  })

  it('descarta objetos sem path (File cru, null) e não-arrays', () => {
    expect(sanitizeAttachments([{ name: 'so-nome-sem-upload' }, null, 42])).toEqual([])
    expect(sanitizeAttachments('nada')).toEqual([])
    expect(sanitizeAttachments(undefined)).toEqual([])
  })

  it('preserva string legada como { name } (registro antigo não some)', () => {
    expect(sanitizeAttachments(['legado.pdf', '  '])).toEqual([{ name: 'legado.pdf' }])
  })

  it('deriva name do path quando ausente e aplica o teto de quantidade', () => {
    const muitos = Array.from({ length: ANEXO_MAX_COUNT + 2 }, (_, i) => ({ path: `denuncias/p/u${i}.pdf` }))
    const out = sanitizeAttachments(muitos)
    expect(out).toHaveLength(ANEXO_MAX_COUNT)
    expect(out[0].name).toBe('u0.pdf')
  })
})

describe('anexoNome / formatAnexoSize', () => {
  it('tolera legado string e objeto novo', () => {
    expect(anexoNome('legado.pdf')).toBe('legado.pdf')
    expect(anexoNome({ name: 'novo.pdf' })).toBe('novo.pdf')
    expect(anexoNome(null)).toBe('')
  })

  it('formata KB/MB e some quando desconhecido', () => {
    expect(formatAnexoSize(0)).toBe('')
    expect(formatAnexoSize(undefined)).toBe('')
    expect(formatAnexoSize(500)).toBe('1 KB')
    expect(formatAnexoSize(512 * 1024)).toBe('512 KB')
    expect(formatAnexoSize(1.5 * MB)).toBe('1,5 MB')
  })
})
