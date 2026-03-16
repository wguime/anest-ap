import React from 'react';
import { PROBABILIDADE_OPTIONS, GRAVIDADE_OPTIONS, getRiskLevel } from '@/data/rcaConfig';
import { Select } from '@/design-system';

export default function RiskMatrix({ classificacao, onChange }) {
  const probOption = PROBABILIDADE_OPTIONS.find((p) => p.value === classificacao.probabilidade);
  const gravOption = GRAVIDADE_OPTIONS.find((g) => g.value === classificacao.gravidade);

  const handleChange = (field, value) => {
    const updated = { ...classificacao, [field]: value };

    const prob = PROBABILIDADE_OPTIONS.find((p) => p.value === updated.probabilidade);
    const grav = GRAVIDADE_OPTIONS.find((g) => g.value === updated.gravidade);

    if (prob && grav) {
      const risk = getRiskLevel(prob.score, grav.score);
      updated.score = risk.score;
      updated.nivel = risk.level;
    } else {
      updated.score = null;
      updated.nivel = null;
    }

    onChange(updated);
  };

  const riskInfo = probOption && gravOption
    ? getRiskLevel(probOption.score, gravOption.score)
    : null;

  // Matriz visual 5×5
  const matrizCores = [];
  for (let g = 5; g >= 1; g--) {
    const row = [];
    for (let p = 1; p <= 5; p++) {
      const { color } = getRiskLevel(p, g);
      row.push({ p, g, color });
    }
    matrizCores.push(row);
  }

  return (
    <div className="space-y-4">
      {/* Selects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Select
            label="Probabilidade de Recorrência"
            value={classificacao.probabilidade || ''}
            onChange={(val) => handleChange('probabilidade', val)}
            options={PROBABILIDADE_OPTIONS.map((o) => ({ value: o.value, label: `${o.score} - ${o.label}` }))}
            placeholder="Selecione..."
          />
          {probOption && (
            <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178]">
              {probOption.description}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Select
            label="Gravidade do Dano"
            value={classificacao.gravidade || ''}
            onChange={(val) => handleChange('gravidade', val)}
            options={GRAVIDADE_OPTIONS.map((o) => ({ value: o.value, label: `${o.score} - ${o.label}` }))}
            placeholder="Selecione..."
          />
          {gravOption && (
            <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178]">
              {gravOption.description}
            </p>
          )}
        </div>
      </div>

      {/* Matriz visual compacta */}
      <div>
        <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178] mb-1 text-center">
          Matriz de Risco (Probabilidade × Gravidade)
        </p>
        <div className="grid gap-1 max-w-[85%] mr-auto ml-[5%]" style={{ gridTemplateColumns: '24px repeat(5, 1fr)' }}>
          {/* Header row */}
          <div />
          {[1, 2, 3, 4, 5].map((p) => (
            <div
              key={`h-${p}`}
              className="aspect-square flex items-center justify-center text-[9px] font-medium text-[#6B7280] dark:text-[#6B8178]"
            >
              P{p}
            </div>
          ))}

          {/* Matrix rows */}
          {matrizCores.map((row, rowIdx) => (
            <React.Fragment key={`row-${rowIdx}`}>
              <div className="flex items-center justify-center text-[9px] font-medium text-[#6B7280] dark:text-[#6B8178]">
                G{5 - rowIdx}
              </div>
              {row.map((cell) => {
                const isSelected =
                  probOption?.score === cell.p && gravOption?.score === cell.g;
                return (
                  <div
                    key={`${cell.p}-${cell.g}`}
                    className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold text-white transition-all ${
                      isSelected ? 'ring-2 ring-[#111827] dark:ring-white scale-110 z-10' : ''
                    }`}
                    style={{ backgroundColor: cell.color }}
                  >
                    {cell.p * cell.g}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Badge de resultado */}
      {riskInfo && (
        <div className="space-y-3">
          <div
            className="flex items-center justify-center gap-3 p-3 rounded-2xl border"
            style={{ borderColor: riskInfo.color, backgroundColor: `${riskInfo.bgColor}` }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: riskInfo.color }}
            >
              {riskInfo.score}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: riskInfo.color }}>
                Risco {riskInfo.label}
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                {probOption?.label} × {gravOption?.label}
              </p>
            </div>
          </div>

          {/* Legenda explicativa */}
          <div className="p-3 rounded-2xl bg-[#F9FAFB] dark:bg-[#0D1F17] border border-[#C8E6C9] dark:border-[#2A3F36]">
            <p className="text-xs font-semibold text-[#004225] dark:text-[#2ECC71] mb-2">
              O que significa?
            </p>
            <p className="text-xs text-[#374151] dark:text-[#9CA3AF] leading-relaxed mb-2">
              {riskInfo.level === 'baixo' && 'O risco é baixo e aceitável. Monitorar rotineiramente e manter controles existentes. Nenhuma ação adicional imediata necessária.'}
              {riskInfo.level === 'moderado' && 'O risco é moderado e requer atenção. Implementar medidas de mitigação e acompanhar evolução. Prazo recomendado: até 30 dias.'}
              {riskInfo.level === 'alto' && 'O risco é alto e demanda ação prioritária. Requer intervenção imediata com plano de ação documentado. Prazo recomendado: até 7 dias.'}
              {riskInfo.level === 'extremo' && 'O risco é extremo e crítico. Exige ação emergencial imediata com envolvimento da alta gestão. Prazo: ação imediata.'}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[
                { label: 'Baixo', range: '1–4', color: '#22C55E' },
                { label: 'Moderado', range: '5–9', color: '#F59E0B' },
                { label: 'Alto', range: '10–14', color: '#DC2626' },
                { label: 'Extremo', range: '15–25', color: '#7F1D1D' },
              ].map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] dark:text-[#6B8178]">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  {item.label} ({item.range})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
