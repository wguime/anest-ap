import { Search } from 'lucide-react';
import { RCA_STATUS } from '@/data/rcaConfig';
import { Select, Textarea, Button, Badge } from '@/design-system';
import FiveWhysForm from './FiveWhysForm';
import FatoresContribuintes from './FatoresContribuintes';
import RiskMatrix from './RiskMatrix';

function SectionDivider({ number, title }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="w-6 h-6 rounded-full bg-[#006837] dark:bg-[#2ECC71] flex items-center justify-center flex-shrink-0">
        <span className="text-white dark:text-[#111916] text-[10px] font-bold">{number}</span>
      </div>
      <span className="text-sm font-semibold text-[#004225] dark:text-[#2ECC71]">{title}</span>
      <div className="flex-1 h-px bg-[#C8E6C9] dark:bg-[#2A3F36]" />
    </div>
  );
}

export default function RcaSection({ rca, onChange, onInitialize }) {
  if (!rca) {
    return (
      <div className="flex flex-col items-center py-6">
        <div className="w-12 h-12 rounded-full bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center mb-3">
          <Search className="w-6 h-6 text-[#006837] dark:text-[#2ECC71]" />
        </div>
        <p className="text-sm text-[#6B7280] dark:text-[#6B8178] mb-3 text-center">
          Nenhuma análise de causa raiz iniciada para este incidente.
        </p>
        <Button onClick={onInitialize}>
          Iniciar Análise de Causa Raiz
        </Button>
      </div>
    );
  }

  const statusInfo = RCA_STATUS[rca.status] || RCA_STATUS.em_andamento;

  const updateField = (field, value) => {
    onChange({ ...rca, [field]: value });
  };

  const handleStatusChange = (newStatus) => {
    const updated = { ...rca, status: newStatus };
    if (newStatus === 'concluida' && !rca.concluidoEm) {
      updated.concluidoEm = new Date().toISOString();
    }
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-2 sm:col-span-1">
          <Badge variant={statusInfo.value === 'concluida' ? 'success' : statusInfo.value === 'em_andamento' ? 'info' : 'secondary'}>
            {statusInfo.label}
          </Badge>
          {rca.iniciadoEm && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#6B8178]">
              Iniciado: {new Date(rca.iniciadoEm).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        <Select
          label="Alterar Status"
          value={rca.status}
          onChange={(val) => handleStatusChange(val)}
          options={Object.values(RCA_STATUS).map((s) => ({ value: s.value, label: s.label }))}
          size="sm"
        />
      </div>

      {/* 1. Causa Imediata */}
      <SectionDivider number="1" title="Causa Imediata" />
      <Textarea
        label="Descrição do evento imediato"
        value={rca.causaImediata || ''}
        onChange={(val) => updateField('causaImediata', val)}
        placeholder="O que aconteceu diretamente? Descreva o evento imediato..."
        rows={3}
      />

      {/* 2. 5 Porquês */}
      <SectionDivider number="2" title="Análise dos 5 Porquês" />
      <FiveWhysForm
        porques={rca.cincosPorques}
        onChange={(porques) => updateField('cincosPorques', porques)}
      />

      {/* 3. Fatores Contribuintes */}
      <SectionDivider number="3" title="Fatores Contribuintes (Ishikawa)" />
      <FatoresContribuintes
        fatores={rca.fatoresContribuintes}
        onChange={(fatores) => updateField('fatoresContribuintes', fatores)}
      />

      {/* 4. Causa Raiz */}
      <SectionDivider number="4" title="Causa Raiz Identificada" />
      <Textarea
        label="Conclusão da análise"
        value={rca.causaRaiz || ''}
        onChange={(val) => updateField('causaRaiz', val)}
        placeholder="Com base na análise acima, qual é a causa raiz? Resuma a conclusão..."
        rows={3}
      />

      {/* 5. Classificação de Risco */}
      <SectionDivider number="5" title="Classificação de Risco" />
      <RiskMatrix
        classificacao={rca.classificacaoRisco}
        onChange={(classificacao) => updateField('classificacaoRisco', classificacao)}
      />

      {/* 6. Observações */}
      <SectionDivider number="6" title="Observações" />
      <Textarea
        label="Observações adicionais"
        value={rca.observacoes || ''}
        onChange={(val) => updateField('observacoes', val)}
        placeholder="Observações adicionais sobre a análise..."
        rows={3}
      />
    </div>
  );
}
