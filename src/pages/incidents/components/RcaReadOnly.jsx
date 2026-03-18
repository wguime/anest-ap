import { AlertTriangle } from 'lucide-react';
import { FATORES_CONTRIBUINTES_CATEGORIAS, PROBABILIDADE_OPTIONS, GRAVIDADE_OPTIONS, getRiskLevel, RCA_STATUS } from '@/data/rcaConfig';

export default function RcaReadOnly({ rca }) {
  if (!rca) return null;

  const statusInfo = RCA_STATUS[rca.status] || RCA_STATUS.em_andamento;
  const getCatConfig = (value) =>
    FATORES_CONTRIBUINTES_CATEGORIAS.find((c) => c.value === value);

  const probOption = PROBABILIDADE_OPTIONS.find((p) => p.value === rca.classificacaoRisco?.probabilidade);
  const gravOption = GRAVIDADE_OPTIONS.find((g) => g.value === rca.classificacaoRisco?.gravidade);
  const riskInfo = probOption && gravOption
    ? getRiskLevel(probOption.score, gravOption.score)
    : null;

  return (
    <div className="space-y-5">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span
          className="px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
        >
          {statusInfo.label}
        </span>
        {rca.iniciadoEm && (
          <span className="text-[10px] text-muted-foreground">
            Iniciado: {new Date(rca.iniciadoEm).toLocaleDateString('pt-BR')}
          </span>
        )}
        {rca.concluidoEm && (
          <span className="text-[10px] text-muted-foreground">
            Concluído: {new Date(rca.concluidoEm).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {/* Causa Imediata */}
      {rca.causaImediata && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Causa Imediata
          </p>
          <p className="text-sm text-foreground">
            {rca.causaImediata}
          </p>
        </div>
      )}

      {/* 5 Porquês — Timeline */}
      {rca.cincosPorques?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Análise dos 5 Porquês
          </p>
          <div className="space-y-0">
            {rca.cincosPorques.map((pq, index) => (
              <div key={pq.nivel} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#006837] to-[#2ECC71] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">{pq.nivel}</span>
                  </div>
                  {index < rca.cincosPorques.length - 1 && (
                    <div className="w-0.5 flex-1 bg-[#E5E7EB] dark:bg-[#2D4A3E] my-1" />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <p className="text-[10px] text-muted-foreground">
                    {pq.pergunta}
                  </p>
                  {pq.resposta && (
                    <p className="text-sm text-foreground mt-0.5">
                      {pq.resposta}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fatores Contribuintes */}
      {rca.fatoresContribuintes?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Fatores Contribuintes
          </p>
          <div className="flex flex-wrap gap-2">
            {rca.fatoresContribuintes.map((fator, index) => {
              const catConfig = getCatConfig(fator.categoria);
              return (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs"
                  style={{
                    borderColor: `${catConfig?.color}40`,
                    backgroundColor: `${catConfig?.color}10`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: catConfig?.color }}
                  />
                  <span className="text-foreground">
                    <span className="font-medium">{catConfig?.label}:</span> {fator.descricao}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Causa Raiz */}
      {rca.causaRaiz && (
        <div className="p-3 rounded-xl bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-warning/30">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <p className="text-xs font-semibold text-[#92400E] dark:text-warning">
              Causa Raiz Identificada
            </p>
          </div>
          <p className="text-sm text-[#92400E] dark:text-warning">
            {rca.causaRaiz}
          </p>
        </div>
      )}

      {/* Classificação de Risco */}
      {riskInfo && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl border"
          style={{ borderColor: riskInfo.color, backgroundColor: riskInfo.bgColor }}
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
            <p className="text-xs text-muted-foreground">
              {probOption?.label} × {gravOption?.label}
            </p>
          </div>
        </div>
      )}

      {/* Observações */}
      {rca.observacoes && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Observações
          </p>
          <p className="text-sm text-foreground">
            {rca.observacoes}
          </p>
        </div>
      )}
    </div>
  );
}
