import { Sparkles } from 'lucide-react';

export default function RopVinculacaoReadOnly({ ropsVinculados }) {
  if (!ropsVinculados || ropsVinculados.length === 0) return null;

  return (
    <div className="space-y-2">
      {ropsVinculados.map((rop) => (
        <div
          key={rop.ropId}
          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted"
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: rop.areaColor || '#6B7280' }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {rop.ropTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {rop.areaTitle}
            </p>
          </div>
          {rop.autoSugerido && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 dark:bg-warning/20 text-[10px] font-medium text-warning flex-shrink-0">
              <Sparkles className="w-3 h-3" />
              Sugerido
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
