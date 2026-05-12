/**
 * DiffViewer — Sprint 16 / F6.3 polish
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
 * Tokens DS: usa `bg-success/10`, `border-success/30`, `text-success`
 * (idem warning/destructive). NUNCA hex hardcoded.
 *
 * @example
 *   <DiffViewer
 *     left={{ titulo: 'Novo', status: 'rascunho' }}
 *     right={{ titulo: 'Antigo', status: 'rascunho', revisao: 2 }}
 *   />
 */
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

function DiffRow({ keyName, state, leftValue, rightValue, hasRight }) {
  const styles = STATE_STYLES[state]
  const rowAriaLabel = `Campo ${keyName}: ${styles.rowAria}`

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
      </div>
    </div>
  )
}

/**
 * @param {Object} props
 * @param {Object} props.left  — payload do usuário (sua versão)
 * @param {Object|null} props.right — server_state (pode ser null para rota legacy)
 * @param {string} [props.leftLabel='Sua versão']
 * @param {string} [props.rightLabel='Servidor']
 * @param {boolean} [props.collapsible=true]
 * @param {string} [props.className]
 */
export default function DiffViewer({
  left,
  right,
  leftLabel = 'Sua versão',
  rightLabel = 'Servidor',
  collapsible = true,
  className,
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

  const rows = allKeys.map((k) => {
    const leftHas = Object.prototype.hasOwnProperty.call(safeLeft, k)
    const rightHas = hasRight && Object.prototype.hasOwnProperty.call(safeRight, k)
    const state = computeState(leftHas, rightHas, safeLeft[k], safeRight[k])
    return (
      <DiffRow
        key={k}
        keyName={k}
        state={state}
        leftValue={safeLeft[k]}
        rightValue={safeRight[k]}
        hasRight={hasRight}
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

  if (!collapsible) return body

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
