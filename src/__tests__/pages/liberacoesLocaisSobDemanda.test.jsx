/**
 * Locais aprendidos sob demanda (09/11/2026): a busca de ~180 KB (60 dias de
 * salas e ajustes) saía a cada entrada na aba Liberações e a cada troca de
 * hospital, para um seletor que só existe dentro do editor da linha. Trava: a
 * aba montada NÃO busca; e o arquivo-fonte só chama a busca no efeito que
 * depende do editor aberto.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fetchLocaisHospital = vi.fn(async () => [])
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: new Proxy({}, {
    get: (_t, k) => (k === 'fetchLocaisHospital' ? fetchLocaisHospital : vi.fn(async () => [])),
  }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({ roster: [], rosterByUid: new Map(), aliases: [], resolver: () => null, canonicalUid: (u) => u, options: [], pronto: true, loading: false }),
}))

import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

describe('Liberações — locais aprendidos sob demanda', () => {
  it('montar a aba não busca o histórico de locais', async () => {
    const escala = { id: 'e1', data: '2026-11-09', hospital: 'hro', casos: [], ordemLiberacao: [], liberacoes: {}, linhaOverrides: {}, ajudaExterna: [] }
    render(<LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" canEdit turno="manha" plantoes={[]} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(fetchLocaisHospital).not.toHaveBeenCalled()
  })

  it('a única chamada no arquivo está no efeito condicionado ao editor aberto', () => {
    const fonte = readFileSync(resolve(process.cwd(), 'src/pages/escala-cirurgica/LiberacoesView.jsx'), 'utf8')
    expect(fonte.match(/svc\.fetchLocaisHospital\(/g)).toHaveLength(1)
    const efeito = fonte.slice(fonte.indexOf('const editorAberto = editor != null'), fonte.indexOf('const locaisHospital = useMemo'))
    expect(efeito).toContain('if (!editorAberto || valido) return undefined')
    expect(efeito).toContain('svc.fetchLocaisHospital(')
    expect(efeito).toContain('[hospitalLabel, editorAberto]')
  })
})
