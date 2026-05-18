import * as React from 'react';
import { cn } from '@/design-system/utils/tokens';

const RichEditorCore = React.lazy(() => import('./rich-editor-core.jsx'));

function EditorSkeleton({ className }) {
  return (
    <div
      data-slot="rich-editor-skeleton"
      aria-hidden="true"
      className={cn(
        'rounded-[16px] border border-border bg-card animate-pulse',
        'min-h-[160px] px-3 py-3',
        className
      )}
    />
  );
}

const RichEditor = React.forwardRef(function RichEditor(
  { value, onChange, placeholder, disabled = false, label, error, ariaLabel, className, id },
  _ref
) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const hasError = typeof error === 'string' && error.trim().length > 0;
  const errorId = hasError ? `${fieldId}-error` : undefined;

  return (
    <div data-slot="rich-editor-field" className="grid gap-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          data-slot="rich-editor-label"
          className="text-sm font-semibold text-primary"
        >
          {label}
        </label>
      )}
      <div
        id={fieldId}
        aria-describedby={errorId}
        aria-invalid={hasError || undefined}
      >
        <React.Suspense fallback={<EditorSkeleton className={className} />}>
          <RichEditorCore
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            ariaLabel={ariaLabel || label}
            className={className}
          />
        </React.Suspense>
      </div>
      {hasError && (
        <p id={errorId} data-slot="rich-editor-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

export { RichEditor };
export default RichEditor;
