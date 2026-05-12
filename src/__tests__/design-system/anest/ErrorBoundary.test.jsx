/**
 * ErrorBoundary.test.jsx
 * Tests for the ErrorBoundary anest DS component.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'

vi.mock('@/design-system/utils/tokens', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}))

import { ErrorBoundary } from '@/design-system/components/anest/ErrorBoundary'

// Component that throws on render when shouldThrow=true
function Bomb({ shouldThrow = true, message = 'Boom!' }) {
  if (shouldThrow) {
    throw new Error(message)
  }
  return <div data-testid="bomb-ok">OK</div>
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy

  beforeEach(() => {
    // Suppress React's noisy error logs from intentional throws
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws (default UI)', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recarregar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument()
    // children should not render
    expect(screen.queryByTestId('bomb-ok')).not.toBeInTheDocument()
  })

  it('"Tentar de novo" resets and recovers when child no longer throws', () => {
    // Controlled wrapper so we can flip the throw flag and re-render through the boundary
    function Wrapper() {
      const [shouldThrow, setShouldThrow] = React.useState(true)
      return (
        <div>
          <button data-testid="fix" onClick={() => setShouldThrow(false)}>
            fix
          </button>
          <ErrorBoundary>
            <Bomb shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </div>
      )
    }

    render(<Wrapper />)
    // initial: fallback visible
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // flip the bomb to be safe
    fireEvent.click(screen.getByTestId('fix'))

    // user clicks "Tentar de novo" — boundary resets, children re-render OK
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/i }))
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Tentar de novo" keeps fallback if child still throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/i }))
    // Bomb still throws → fallback persists
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('calls onError prop with (error, errorInfo)', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <Bomb message="kaboom" />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    const [errArg, infoArg] = onError.mock.calls[0]
    expect(errArg).toBeInstanceOf(Error)
    expect(errArg.message).toBe('kaboom')
    expect(infoArg).toBeTruthy()
    expect(typeof infoArg.componentStack).toBe('string')
  })

  it('renders custom fallback function when provided', () => {
    const fallback = vi.fn((error, retry) => (
      <div data-testid="custom-fb">
        custom: {error.message}
        <button onClick={retry}>retry</button>
      </div>
    ))
    render(
      <ErrorBoundary fallback={fallback}>
        <Bomb message="explode" />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('custom-fb')).toBeInTheDocument()
    expect(screen.getByText(/custom: explode/)).toBeInTheDocument()
    // default UI must NOT render
    expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument()
    expect(fallback).toHaveBeenCalled()
    // fallback receives (error, retry) — retry is the bound handleReset
    const [errArg, retryArg] = fallback.mock.calls[0]
    expect(errArg).toBeInstanceOf(Error)
    expect(typeof retryArg).toBe('function')
  })

  it('logs error to console.error with [ErrorBoundary] tag', () => {
    render(
      <ErrorBoundary>
        <Bomb message="logged-err" />
      </ErrorBoundary>
    )
    const matched = consoleErrorSpy.mock.calls.some(
      (args) => args[0] === '[ErrorBoundary]'
    )
    expect(matched).toBe(true)
  })
})
