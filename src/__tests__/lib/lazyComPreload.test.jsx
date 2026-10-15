/**
 * lazyComPreload (abertura da Escala Cirúrgica, 15/10/2026): página pré-carregada
 * renderiza SEM passar pelo fallback do Suspense — o `lazy` comum mostrava o
 * spinner por ~0,3–0,5 s mesmo com o chunk já baixado.
 */
import { describe, it, expect, vi } from 'vitest'
import { Suspense } from 'react'
import { render, screen, act } from '@testing-library/react'
import { lazyComPreload } from '@/lib/lazyComPreload'

const Pagina = () => <p>conteúdo da página</p>

function montar(Componente) {
  return render(
    <Suspense fallback={<p>carregando…</p>}>
      <Componente />
    </Suspense>,
  )
}

describe('lazyComPreload', () => {
  it('pré-carregada: o primeiro render já é a página (sem fallback)', async () => {
    const Lazy = lazyComPreload(() => Promise.resolve({ default: Pagina }))
    await Lazy.preload()

    montar(Lazy)

    expect(screen.getByText('conteúdo da página')).toBeTruthy()
    expect(screen.queryByText('carregando…')).toBeNull()
  })

  it('sem pré-carga: comporta-se como o lazy comum (fallback e depois a página)', async () => {
    const Lazy = lazyComPreload(() => Promise.resolve({ default: Pagina }))

    montar(Lazy)
    expect(screen.getByText('carregando…')).toBeTruthy()

    expect(await screen.findByText('conteúdo da página')).toBeTruthy()
  })

  it('preload é idempotente: o módulo é pedido uma vez só', async () => {
    const carregar = vi.fn(() => Promise.resolve({ default: Pagina }))
    const Lazy = lazyComPreload(carregar)

    await Promise.all([Lazy.preload(), Lazy.preload()])
    await Lazy.preload()
    montar(Lazy)

    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it('falha de rede na pré-carga não trava: a próxima tentativa busca de novo', async () => {
    const carregar = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: Pagina })
    const Lazy = lazyComPreload(carregar)

    await expect(Lazy.preload()).rejects.toThrow()
    await act(async () => { await Lazy.preload() })
    montar(Lazy)

    expect(screen.getByText('conteúdo da página')).toBeTruthy()
    expect(carregar).toHaveBeenCalledTimes(2)
  })

  it('aceita a fábrica que remapeia export nomeado para default', async () => {
    const Lazy = lazyComPreload(() => Promise.resolve({ Pagina }).then((m) => ({ default: m.Pagina })))
    await Lazy.preload()

    montar(Lazy)

    expect(screen.getByText('conteúdo da página')).toBeTruthy()
  })
})
