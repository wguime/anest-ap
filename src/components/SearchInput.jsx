import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

/**
 * SearchInput - Campo de busca com debounce
 * @param {string} value - Valor atual da busca
 * @param {function} onChange - Callback quando o valor muda (com debounce)
 * @param {string} placeholder - Texto placeholder
 * @param {number} debounceMs - Tempo de debounce em ms (default: 300)
 */
export default function SearchInput({
  value = '',
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
}) {
  const [inputValue, setInputValue] = useState(value);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onChange) {
        onChange(inputValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputValue, debounceMs, onChange]);

  // Sync with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleClear = () => {
    setInputValue('');
    if (onChange) {
      onChange('');
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="w-5 h-5 text-[#6B7280] dark:text-[#6B8178]" />
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="w-full py-3 pl-10 pr-10 text-[15px] bg-white dark:bg-[#1A2420] border border-gray-200 dark:border-[#2A3F36] rounded-xl text-black dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#6B8178] focus:outline-none focus:ring-2 focus:ring-[#006837]/20 dark:focus:ring-[#2ECC71]/20 focus:border-[#006837] dark:focus:border-[#2ECC71] transition-colors"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#6B7280] dark:text-[#6B8178] hover:text-[#374151] dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
