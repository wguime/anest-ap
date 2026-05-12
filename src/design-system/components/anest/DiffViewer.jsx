/**
 * DiffViewer — Sprint 16 / F6.3 polish (Wave 2: 3-way merge interativo)
 *
 * Componente puro para comparar 2 objetos JS chave-a-chave. Renderiza grid
 * 2 colunas no desktop (sua versão | servidor) e accordion mobile (1 coluna,
 * cada linha empilha as células).
 *
 * Estados por chave (computados na união de keys):
 *  - 'only-left'  → chave existe em `left`, ausente/undefined em `right`
 *                   (soft success bg, texto success)
 *  - 'only-right' → chave em `right` apenas
 *                   (soft destructive bg, texto destructive)
 *  - 'diff'       → ambas presentes mas valores diferentes
 *                   (soft warning bg, texto warning)
 *  - 'same'       → valores iguais
 *                   (sem destaque, superfície neutra)
 *
 * Casos especiais:
 *  - `right === null` (rota legacy sem snapshot do servidor): renderiza
 *    apenas a coluna left com header "Servidor não disponível" e todas as
 *    chaves marcadas como `only-left`.
 *  - `collapsible=true` (default): envolve em <details> nativo (a11y
 *    built-in), fechado por padrão.
 *
 * Modo interativo (Wave 2 / Sprint 16):
 *  - `interactive=true` adiciona radio group por linha não-igual:
 *    "Minha versão" / "Versão servidor" / "Manter ambos" (último apenas
 *    para arrays). Default por linha: "Minha versão".
 *  - `onChange(mergedPayload)` é chamado em toda mudança com o payload
 *    resolvido aplicando as seleções atuais.
 *  - Linhas com state `same` não recebem radio (não há decisão a tomar).
 *  - Em modo interativo, `collapsible` é ignorado (sempre expandido) para
 *    forçar o admin a ver/escolher antes de submeter.
 *
 * Tokens DS: usa `bg-success/10`, `border-success/30`, `text-success`
 * (idem warning/destructive). NUNCA hex hardcoded.
 *
 * @example
 *   <DiffViewer
 *     left={{ titulo: 'Novo', status: 'rascunho' }}
 *     right={{ titulo: 'Antigo', status: 'rascunho', revisao: 2 }}
 *   />
 *
 * @example interactive
 *   <DiffViewer
 *     left={payload}
 *     right={serverState}
 *     interactive
 *     onChange={(merged) => setMergedPayload(merged)}
 *   />
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/design-system/utils/tokens'

const STATE_STYLES = {
  'only-left': {
    cellBg: 'bg-success/10 border-success/30',
    label: 'text-success',
    badge: 'bg-success/20 text-success',
    badgeLabel: 'só na sua versão',
    rowAria: 'presente apenas na sua versão',
  },
  'only-right': {
    cellBg: 'bg-destructive/10 border-destructive/30',
    label: 'text-destructive',
    badge: 'bg-destructive/20 text-destructive',
    badgeLabel: 'só no servidor',
    rowAria: 'presente apenas no servidor',
  },
  diff: {
    cellBg: 'bg-warning/10 border-warning/30',
    label: 'text-warning',
    badge: 'bg-warning/20 text-warning',
    badgeLabel: 'divergente',
    rowAria: 'valor divergente entre versões',
  },
  same: {
    cellBg: 'bg-card border-border',
    label: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
    badgeLabel: 'igual',
    rowAria: 'valores iguais',
  },
}

function formatValue(v) {
  if (v === undefined) return '—'
  if (v === null) return 'null'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return false
}

function computeState(leftHas, rightHas, leftVal, rightVal) {
  if (leftHas && !rightHas) return 'only-left'
  if (!leftHas && rightHas) return 'only-right'
  if (deepEqual(leftVal, rightVal)) return 'same'
  return 'diff'
}

// ----------------------------------------------------------------------------
// Modo interativo (Wave 2 / Sprint 16)
// ----------------------------------------------------------------------------

const CHOICE_LEFT = 'left'
const CHOICE_RIGHT = 'right'
const CHOICE_BOTH = 'both'

const CHOICE_OPTIONS = [
  { value: CHOICE_LEFT, label: 'Minha versão' },
  { value: CHOICE_RIGHT, label: 'Versão servidor' },
  { value: CHOICE_BOTH, label: 'Manter ambos' },
]

/**
 * Concatena arrays mantendo a ordem `left` primeiro e depois itens novos
 * do `right`. Comparação por JSON.stringify (deep). Não-array fallback:
 * retorna o valor `left` (defensivo — UI só oferece 'both' para arrays).
 */
function mergeBoth(leftVal, rightVal) {
  const leftArr = Array.isArray(leftVal) ? leftVal : []
  const rightArr = Array.isArray(rightVal) ? rightVal : []
  const out = [...leftArr]
  for (const item of rightArr) {
    const key = JSON.stringify(item)
    if (!out.some((existing) => JSON.stringify(existing) === key)) {
      out.push(item)
    }
  }
  return out
}

function DiffRow({
  keyName,
  state,
  leftValue,
  rightValue,
  hasRight,
  interactive = false,
  choice = CHOICE_LEFT,
  canKeepBoth = false,
  onChoiceChange,
}) {
  const styles = STATE_STYLES[state]
  const rowAriaLabel = `Campo ${keyName}: ${styles.rowAria}`
  // Linhas iguais não precisam de decisão (não exibe radio).
  const showRadios = interactive && state !== 'same' && hasRight
  const radioOptions = canKeepBoth
    ? CHOICE_OPTIONS
    : CHOICE_OPTIONS.filter((o) => o.value !== CHOICE_BOTH)

  return (
    <div
      role="group"
      aria-label={rowAriaLabel}
      data-diff-state={state}
      className="contents"
    >
      {/* Mobile: chave em cima, células empilhadas */}
      <div className="md:hidden mb-2 last:mb-0 rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between gap-2">
          <span className={cn('text-xs font-semibold font-mono truncate', styles.label)}>
            {keyName}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
              styles.badge
            )}
          >
            {styles.badgeLabel}
          </span>
        </div>
        <div className={cn('px-3 py-2 text-xs font-mono border-b border-border break-all', styles.cellBg)}>
          <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
            Sua versão
          </span>
          {formatValue(leftValue)}
        </div>
        {hasRight ? (
          <div className={cn('px-3 py-2 text-xs font-mono break-all', styles.cellBg)}>
            <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
              Servidor
            </span>
            {formatValue(rightValue)}
          </div>
        ) : null}
        {showRadios ? (
          <div
            role="radiogroup"
            aria-label={`Escolha para campo ${keyName}`}
            className="px-3 py-2 border-t border-border bg-muted/30 flex flex-wrap gap-x-3 gap-y-1.5"
          >
            {radioOptions.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer min-h-[28px]"
              >
                <input
                  type="radio"
                  name={`merge-choice-${keyName}`}
                  value={opt.value}
                  checked={choice === opt.value}
                  onChange={() => onChoiceChange?.(opt.value)}
                  className="w-4 h-4 accent-primary"
                  aria-label={`${opt.label} para campo ${keyName}`}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {/* Desktop: grid 3 colunas (key | left | right) */}
      <div
        className={cn(
          'hidden md:contents',
        )}
      >
        <div
          className={cn(
            'px-3 py-2 border border-border rounded-l-lg flex items-center gap-2 bg-card',
            'border-r-0'
          )}
        >
          <span className={cn('text-xs font-semibold font-mono truncate', styles.label)}>
            {keyName}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
              styles.badge
            )}
          >
            {styles.badgeLabel}
          </span>
        </div>
        <div
          className={cn(
            'px-3 py-2 text-xs font-mono border-y border-border break-all',
            styles.cellBg,
            !hasRight && 'rounded-r-lg border-r border-border'
          )}
        >
          {formatValue(leftValue)}
        </div>
        {hasRight ? (
          <div
            className={cn(
              'px-3 py-2 text-xs font-mono border border-border rounded-r-lg break-all',
              styles.cellBg,
              'border-l-0'
            )}
          >
            {formatValue(rightValue)}
          </div>
        ) : null}
        {showRadios ? (
          <div
            role="radiogroup"
            aria-label={`Escolha para campo ${keyName}`}
            className="md:col-span-3 px-3 py-2 mt-[-2px] mb-2 border border-border border-t-0 rounded-b-lg bg-muted/30 flex flex-wrap gap-x-4 gap-y-1.5"
          >
            {radioOptions.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer min-h-[28px]"
              >
                <input
                  type="radio"
                  name={`merge-choice-desktop-${keyName}`}
                  value={opt.value}
                  checked={choice === opt.value}
                  onChange={() => onChoiceChange?.(opt.value)}
                  className="w-4 h-4 accent-primary"
                  aria-label={`${opt.label} para campo ${keyName}`}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Reduz o estado de seleções num payload merged final.
 * - same:        usa leftVal (são iguais; left preserva ordem das chaves)
 * - only-left:   usa leftVal se choice=left/both; omite se choice=right
 * - only-right:  usa rightVal se choice=right/both; omite se choice=left
 * - diff:        leftVal se choice=left, rightVal se choice=right,
 *                mergeBoth(left,right) se choice=both (apenas arrays)
 */
function buildMergedPayload(allKeys, safeLeft, safeRight, hasRight, choices, states) {
  const out = {}
  for (const k of allKeys) {
    const state = states[k]
    const choice = choices[k] || CHOICE_LEFT
    const leftHas = Object.prototype.hasOwnProperty.call(safeLeft, k)
    const rightHas = hasRight && Object.prototype.hasOwnProperty.call(safeRight, k)

    if (state === 'same') {
      out[k] = safeLeft[k]
      continue
    }
    if (state === 'only-left') {
      if (choice === CHOICE_RIGHT) continue // descartar — usuário escolheu lado vazio
      out[k] = safeLeft[k]
      continue
    }
    if (state === 'only-right') {
      if (choice === CHOICE_LEFT) continue // não traz o campo
      out[k] = safeRight[k]
      continue
    }
    // state === 'diff'
    if (choice === CHOICE_LEFT) out[k] = safeLeft[k]
    else if (choice === CHOICE_RIGHT) out[k] = safeRight[k]
    else if (choice === CHOICE_BOTH) {
      // 'both' só é exposto quando ambos são arrays
      out[k] =
        Array.isArray(safeLeft[k]) && Array.isArray(safeRight[k])
          ? mergeBoth(safeLeft[k], safeRight[k])
          : safeLeft[k]
    } else {
      out[k] = leftHas ? safeLeft[k] : safeRight[k]
    }
    // Silenciar warning de var não-usada (rightHas) — defensivo p/ leitura.
    void rightHas
  }
  return out
}

/**
 * @param {Object} props
 * @param {Object} props.left  — payload do usuário (sua versão)
 * @param {Object|null} props.right — server_state (pode ser null para rota legacy)
 * @param {string} [props.leftLabel='Sua versão']
 * @param {string} [props.rightLabel='Servidor']
 * @param {boolean} [props.collapsible=true]
 * @param {string} [props.className]
 * @param {boolean} [props.interactive=false] — Wave 2: radio por campo + onChange merged
 * @param {(mergedPayload: Object) => void} [props.onChange] — chamado em toda escolha
 */
export default function DiffViewer({
  left,
  right,
  leftLabel = 'Sua versão',
  rightLabel = 'Servidor',
  collapsible = true,
  className,
  interactive = false,
  onChange,
}) {
  const safeLeft = left && typeof left === 'object' ? left : {}
  const hasRight = right !== null && right !== undefined
  const safeRight = hasRight && typeof right === 'object' ? right : {}

  // União das chaves preservando a ordem: left primeiro, depois novas do right.
  const leftKeys = Object.keys(safeLeft)
  const rightKeys = Object.keys(safeRight)
  const allKeys = [...leftKeys]
  for (const k of rightKeys) {
    if (!allKeys.includes(k)) allKeys.push(k)
  }

  const rightHeaderLabel = hasRight ? rightLabel : 'Servidor não disponível'

  // Pré-computa estado por chave (memo para evitar recompute em re-render).
  const states = useMemo(() => {
    const out = {}
    for (const k of allKeys) {
      const leftHas = Object.prototype.hasOwnProperty.call(safeLeft, k)
      const rightHas = hasRight && Object.prototype.hasOwnProperty.call(safeRight, k)
      out[k] = computeState(leftHas, rightHas, safeLeft[k], safeRight[k])
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(safeLeft), JSON.stringify(safeRight), hasRight])

  // Default por chave: 'left'. Estado só usado em modo interativo.
  const [choices, setChoices] = useState(() => {
    const init = {}
    for (const k of allKeys) init[k] = CHOICE_LEFT
    return init
  })

  // Dispara onChange inicial em modo interativo (admin pode submeter sem
  // tocar em nada → payload = default left/diff/only-left).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!interactive) return
    const merged = buildMergedPayload(
      allKeys,
      safeLeft,
      safeRight,
      hasRight,
      choices,
      states
    )
    onChangeRef.current?.(merged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, JSON.stringify(choices), JSON.stringify(states)])

  const handleChoiceChange = (keyName, value) => {
    setChoices((prev) => ({ ...prev, [keyName]: value }))
  }

  const rows = allKeys.map((k) => {
    const state = states[k]
    const leftVal = safeLeft[k]
    const rightVal = safeRight[k]
    // 'both' só faz sentido para arrays (concatenação determinística).
    const canKeepBoth = Array.isArray(leftVal) && Array.isArray(rightVal)
    return (
      <DiffRow
        key={k}
        keyName={k}
        state={state}
        leftValue={leftVal}
        rightValue={rightVal}
        hasRight={hasRight}
        interactive={interactive}
        choice={choices[k] || CHOICE_LEFT}
        canKeepBoth={canKeepBoth}
        onChoiceChange={(val) => handleChoiceChange(k, val)}
      />
    )
  })

  const body = (
    <div
      role="region"
      aria-label="Comparação entre sua versão e versão do servidor"
      className={cn('w-full', className)}
    >
      {/* Header das colunas (desktop) */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-x-0 gap-y-2 mb-2">
        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Campo
        </div>
        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {leftLabel}
        </div>
        {hasRight ? (
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {rightHeaderLabel}
          </div>
        ) : null}
      </div>

      {/* Mobile header — single column */}
      <div className="md:hidden mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {hasRight ? `${leftLabel} vs ${rightLabel}` : rightHeaderLabel}
      </div>

      {/* Rows */}
      {allKeys.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted-foreground italic text-center border border-dashed border-border rounded-lg">
          Sem campos para comparar.
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] md:gap-x-0 md:gap-y-2">
          {rows}
        </div>
      )}
    </div>
  )

  // Interactive ignora collapsible — admin precisa ver e escolher.
  if (!collapsible || interactive) return body

  return (
    <details className={cn('group', className)}>
      <summary className="cursor-pointer select-none min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-90">
          ▶
        </span>
        Ver diff (sua versão vs servidor)
      </summary>
      <div className="mt-2">{body}</div>
    </details>
  )
}

export { DiffViewer }
