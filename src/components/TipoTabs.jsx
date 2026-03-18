import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

// Configuracao de tipos de documento
const TIPOS_CONFIG = {
  protocolo: { label: 'Protocolos', ordem: 1, color: 'bg-success' },
  formulario: { label: 'Formularios', ordem: 2, color: 'bg-warning' },
  politica: { label: 'Politicas', ordem: 3, color: 'bg-[#6366F1]' },
  manual: { label: 'Manuais', ordem: 4, color: 'bg-[#EC4899]' },
  relatorio: { label: 'Relatorios', ordem: 5, color: 'bg-[#3B82F6]' },
  processo: { label: 'Processos', ordem: 6, color: 'bg-[#8B5CF6]' },
  termo: { label: 'Termos', ordem: 7, color: 'bg-[#14B8A6]' },
  risco: { label: 'Riscos', ordem: 8, color: 'bg-destructive' },
  plano: { label: 'Planos', ordem: 9, color: 'bg-[#0891B2]' },
};

// Tipos primarios (mostrados diretamente) e secundarios (no dropdown +)
const TIPOS_PRIMARIOS = ['protocolo', 'formulario', 'politica', 'manual', 'relatorio'];
const TIPOS_SECUNDARIOS = ['processo', 'termo', 'risco', 'plano'];

/**
 * TipoTabs - Tabs para filtro por tipo de documento
 */
export default function TipoTabs({ selectedTipo, onSelect, contagens = {} }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tipos primarios com documentos
  const tiposPrimarios = useMemo(() => {
    return TIPOS_PRIMARIOS
      .filter((tipo) => contagens[tipo] > 0)
      .map((tipo) => ({ tipo, ...TIPOS_CONFIG[tipo], count: contagens[tipo] }));
  }, [contagens]);

  // Tipos secundarios com documentos
  const tiposSecundarios = useMemo(() => {
    return TIPOS_SECUNDARIOS
      .filter((tipo) => contagens[tipo] > 0)
      .map((tipo) => ({ tipo, ...TIPOS_CONFIG[tipo], count: contagens[tipo] }));
  }, [contagens]);

  // Verificar se o tipo selecionado e secundario
  const selectedIsSecundario = TIPOS_SECUNDARIOS.includes(selectedTipo);
  const selectedConfig = selectedTipo ? TIPOS_CONFIG[selectedTipo] : null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {/* Tab "Todos" */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            selectedTipo === null
              ? 'bg-primary text-white dark:text-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Todos
        </button>

        {/* Tabs primarias com nome completo */}
        {tiposPrimarios.map(({ tipo, label, color }) => (
          <button
            key={tipo}
            type="button"
            onClick={() => onSelect(tipo)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedTipo === tipo
                ? `${color} text-white`
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}

        {/* Dropdown para tipos secundarios */}
        {tiposSecundarios.length > 0 && (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedIsSecundario
                  ? `${selectedConfig?.color} text-white`
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {selectedIsSecundario ? selectedConfig?.label : 'Mais'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border overflow-hidden z-50 min-w-[140px]">
                {tiposSecundarios.map(({ tipo, label, color }) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      onSelect(tipo);
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                      selectedTipo === tipo
                        ? 'bg-gray-50 dark:bg-muted'
                        : 'hover:bg-gray-50 dark:hover:bg-muted'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chip de filtro ativo (para qualquer tipo selecionado) */}
      {selectedTipo && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${selectedConfig?.color} text-white`}
          >
            {selectedConfig?.label}
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
