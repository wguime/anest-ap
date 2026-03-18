import { FileText } from 'lucide-react';

/**
 * Card com resumo/descrição do relato
 * Usa styling inline para consistência com design original
 */
export function TrackingSummary({ title, description, sectionTitle, accentColor }) {
  return (
    <div className="bg-white dark:bg-muted rounded-2xl p-4 border border-[#E5E7EB] dark:border-border mb-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-semibold text-foreground">
          {sectionTitle}
        </h3>
      </div>
      {title && (
        <h4 className="text-base font-medium text-foreground mb-2">
          {title}
        </h4>
      )}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {description}
      </p>
    </div>
  );
}
