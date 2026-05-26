import { useState, useRef, useCallback } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/design-system'
import reunioesService from '@/services/reunioesService'

/**
 * CheckinCodeInput — Participant view with 4 individual digit inputs.
 * Auto-submits when all 4 digits are entered.
 */
export default function CheckinCodeInput({ reuniaoId, userId, onSuccess }) {
  const { toast } = useToast()
  const [digits, setDigits] = useState(['', '', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef([])

  const handleChange = useCallback(
    (index, value) => {
      // Only accept single digits
      const digit = value.replace(/\D/g, '').slice(-1)
      setError('')

      setDigits((prev) => {
        const next = [...prev]
        next[index] = digit
        return next
      })

      // Auto-advance to next input
      if (digit && index < 3) {
        inputRefs.current[index + 1]?.focus()
      }

      // Auto-submit when 4th digit entered — calculado fora do setter
      if (digit && index === 3) {
        const code = [...digits.slice(0, 3), digit].join('')
        if (code.length === 4) {
          submitCode(code)
        }
      }
    },
    [digits, reuniaoId, userId]
  )

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [digits])

  const handlePaste = useCallback((e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!pasted) return
    const next = ['', '', '', '']
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setDigits(next)
    if (pasted.length === 4) {
      submitCode(pasted)
    } else {
      inputRefs.current[pasted.length]?.focus()
    }
  }, [reuniaoId, userId])

  const submitCode = async (code) => {
    setSubmitting(true)
    setError('')
    try {
      await reunioesService.selfCheckin(reuniaoId, userId, code)
      setSuccess(true)
      toast({ variant: 'success', title: 'Presenca confirmada!' })
      onSuccess?.()
    } catch (err) {
      const msg = err.message || 'Codigo invalido'
      setError(msg)
      toast({ variant: 'destructive', title: 'Erro no check-in', description: msg })
      setDigits(['', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <CheckCircle className="w-10 h-10 text-success" />
        <p className="text-sm font-medium text-success">
          Presenca confirmada!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm text-muted-foreground text-center">
        Digite o codigo de 4 digitos exibido pelo organizador
      </p>

      <div className="flex gap-3" role="group" aria-label="Código de check-in">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={submitting}
            autoFocus={i === 0}
            aria-label={`Dígito ${i + 1} do código de check-in`}
            className="w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 border-border bg-card text-foreground
              focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
              disabled:opacity-50 transition-colors tabular-nums"
          />
        ))}
      </div>

      {submitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verificando...
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
