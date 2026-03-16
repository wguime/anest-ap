import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const VARIANTS = {
  green: {
    iconBg: 'bg-[#E8F5E9] dark:bg-[#243530]',
    iconColor: 'text-[#006837] dark:text-[#2ECC71]',
  },
  purple: {
    iconBg: 'bg-[#EDE9FE] dark:bg-[#5B21B6]/30',
    iconColor: 'text-[#7C3AED] dark:text-[#A78BFA]',
  },
};

export default function ExpandableSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
  warning = false,
  variant = 'green',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = VARIANTS[variant] || VARIANTS.green;

  const warningBorder = 'border-[#F59E0B]/50';
  const normalBorder = 'border-[#E5E7EB] dark:border-[#2D4A3E]';

  return (
    <div
      className={`bg-white dark:bg-[#1A2F23] rounded-2xl border overflow-hidden ${
        warning ? warningBorder : normalBorder
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
          warning
            ? 'hover:bg-[#FEF3C7]/50 dark:hover:bg-[#78350F]/20'
            : 'hover:bg-[#F9FAFB] dark:hover:bg-[#243530]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              warning ? 'bg-[#F59E0B]/20' : colors.iconBg
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                warning ? 'text-[#F59E0B]' : colors.iconColor
              }`}
            />
          </div>
          <span
            className={`font-semibold ${
              warning
                ? 'text-[#92400E] dark:text-[#FBBF24]'
                : 'text-[#111827] dark:text-white'
            }`}
          >
            {title}
          </span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F]/30 dark:text-[#FCD34D]">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[#6B7280] dark:text-[#6B8178]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[#6B7280] dark:text-[#6B8178]" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-[#E5E7EB] dark:border-[#2D4A3E] pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
