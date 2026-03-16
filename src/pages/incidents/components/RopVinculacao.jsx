import { useState, useMemo } from 'react';
import { Plus, X, Sparkles, ChevronDown } from 'lucide-react';
import { getSuggestedRops, getAllRops } from '@/data/ropIncidentMapping';
import { Select, Button } from '@/design-system';

export default function RopVinculacao({ ropsVinculados, incidenteTipo, onChange, isDenuncia = false }) {
  const [showSelector, setShowSelector] = useState(false);
  const [filtroArea, setFiltroArea] = useState('');

  // Sugestões automáticas
  const sugestoes = useMemo(() => getSuggestedRops(incidenteTipo, isDenuncia), [incidenteTipo, isDenuncia]);

  // Todos os ROPs disponíveis
  const todosRops = useMemo(() => getAllRops(), []);

  // ROPs agrupados por área para o seletor
  const ropsAgrupados = useMemo(() => {
    const groups = {};
    todosRops.forEach((rop) => {
      if (!groups[rop.ropArea]) {
        groups[rop.ropArea] = {
          areaTitle: rop.areaTitle,
          areaColor: rop.areaColor,
          rops: [],
        };
      }
      groups[rop.ropArea].rops.push(rop);
    });
    return groups;
  }, [todosRops]);

  // IDs já vinculados
  const vinculadosIds = new Set(ropsVinculados.map((r) => r.ropId));

  const handleAddRop = (rop) => {
    if (vinculadosIds.has(rop.ropId)) return;
    onChange([
      ...ropsVinculados,
      {
        ...rop,
        autoSugerido: rop.autoSugerido || false,
        adicionadoEm: new Date().toISOString(),
      },
    ]);
  };

  const handleRemoveRop = (ropId) => {
    onChange(ropsVinculados.filter((r) => r.ropId !== ropId));
  };

  const handleAddAllSugeridos = () => {
    const novos = sugestoes.filter((s) => !vinculadosIds.has(s.ropId));
    if (novos.length === 0) return;
    onChange([
      ...ropsVinculados,
      ...novos.map((s) => ({
        ...s,
        adicionadoEm: new Date().toISOString(),
      })),
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Sugestões automáticas */}
      {sugestoes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-sm font-semibold text-[#004225] dark:text-[#2ECC71]">
                Sugestões
              </span>
              <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                para "{incidenteTipo}"
              </span>
            </div>
            {sugestoes.some((s) => !vinculadosIds.has(s.ropId)) && (
              <button
                type="button"
                onClick={handleAddAllSugeridos}
                className="text-xs font-medium text-[#006837] dark:text-[#2ECC71] hover:underline"
              >
                Adicionar todos
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {sugestoes.map((sug) => {
              const isAdded = vinculadosIds.has(sug.ropId);
              return (
                <button
                  key={sug.ropId}
                  type="button"
                  onClick={() => !isAdded && handleAddRop({ ...sug, autoSugerido: true })}
                  disabled={isAdded}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs border text-left transition-all ${
                    isAdded
                      ? 'border-[#22C55E]/40 bg-[#DCFCE7] dark:bg-[#166534]/20 text-[#166534] dark:text-[#86EFAC] cursor-default'
                      : 'border-[#C8E6C9] dark:border-[#2A3F36] hover:border-[#006837] hover:bg-[#E8F5E9] dark:hover:bg-[#243530] text-[#111827] dark:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sug.areaColor }}
                  />
                  <span className="flex-1">{sug.ropTitle}</span>
                  {isAdded && <span className="text-[10px] flex-shrink-0">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ROPs vinculados */}
      {ropsVinculados.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#004225] dark:text-[#2ECC71]">
            ROPs Vinculados ({ropsVinculados.length})
          </p>
          {ropsVinculados.map((rop) => (
            <div
              key={rop.ropId}
              className="flex items-start gap-2 p-3 rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420]"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: rop.areaColor }}
              />
              <div className="flex-1">
                <p className="text-sm text-[#111827] dark:text-white">
                  {rop.ropTitle}
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mt-0.5">
                  {rop.areaTitle}
                  {rop.autoSugerido && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#E8F5E9] dark:bg-[#243530] text-[#006837] dark:text-[#2ECC71] text-[10px] font-medium">
                      Sugerido
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRop(rop.ropId)}
                className="flex-shrink-0 p-1 text-[#6B7280] dark:text-[#6B8178] hover:text-[#EF4444] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botão adicionar manual */}
      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          rightIcon={<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSelector ? 'rotate-180' : ''}`} />}
          onClick={() => setShowSelector(!showSelector)}
        >
          Adicionar ROP Manualmente
        </Button>

        {showSelector && (
          <div className="mt-2 rounded-2xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420] shadow-lg max-h-64 overflow-y-auto">
            {/* Filtro por área */}
            <div className="sticky top-0 p-2 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36]">
              <Select
                value={filtroArea}
                onChange={(val) => setFiltroArea(val)}
                options={[
                  { value: '', label: 'Todas as áreas' },
                  ...Object.entries(ropsAgrupados).map(([key, group]) => ({ value: key, label: group.areaTitle })),
                ]}
                placeholder="Filtrar por área"
                size="sm"
              />
            </div>

            {/* Lista de ROPs */}
            <div className="p-1">
              {Object.entries(ropsAgrupados)
                .filter(([key]) => !filtroArea || key === filtroArea)
                .map(([key, group]) => (
                  <div key={key}>
                    <p className="px-2 py-1 text-[10px] font-semibold text-[#6B7280] dark:text-[#6B8178] uppercase tracking-wider">
                      {group.areaTitle}
                    </p>
                    {group.rops.map((rop) => {
                      const isAdded = vinculadosIds.has(rop.ropId);
                      return (
                        <button
                          key={rop.ropId}
                          type="button"
                          onClick={() => { handleAddRop(rop); setShowSelector(false); }}
                          disabled={isAdded}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            isAdded
                              ? 'text-[#9CA3AF] dark:text-[#4B5E55] cursor-default'
                              : 'text-[#111827] dark:text-white hover:bg-[#E8F5E9] dark:hover:bg-[#243530]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: group.areaColor }}
                            />
                            {rop.ropTitle}
                            {isAdded && <span className="text-[10px] text-[#22C55E]">✓</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
