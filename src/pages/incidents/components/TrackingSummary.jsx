import { FileText } from 'lucide-react';

/**
 * Card com resumo/descrição do relato
 * Usa styling inline para consistência com design original
 */
export function TrackingSummary({ title, description, sectionTitle, accentColor }) {
  return (
    <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-4 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-semibold text-[#111827] dark:text-white">
          {sectionTitle}
        </h3>
      </div>
      {title && (
        <h4 className="text-base font-medium text-[#111827] dark:text-white mb-2">
          {title}
        </h4>
      )}
      <p className="text-sm text-[#6B7280] dark:text-[#6B8178] whitespace-pre-wrap">
        {description}
      </p>
    </div>
  );
}
