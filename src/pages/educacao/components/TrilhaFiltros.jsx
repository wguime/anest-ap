import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Modal, Input, Checkbox, Button } from '@/design-system';

export function TrilhaFiltros({ show, filtros, onClose, onAplicar }) {
  const [localFiltros, setLocalFiltros] = useState(filtros);

  useEffect(() => {
    if (show) {
      setLocalFiltros(filtros);
    }
  }, [show, filtros]);

  const statusOptions = [
    { value: 'em_andamento', label: 'Trilhas em andamento' },
    { value: 'nao_iniciada', label: 'Trilhas não iniciadas' },
    { value: 'encerrada', label: 'Trilhas encerradas' },
    { value: 'expirada', label: 'Trilhas expiradas' },
  ];

  const toggleStatus = (value) => {
    setLocalFiltros(prev => ({
      ...prev,
      status: prev.status.includes(value)
        ? prev.status.filter(s => s !== value)
        : [...prev.status, value]
    }));
  };

  const handleAplicar = () => {
    onAplicar(localFiltros);
  };

  const footer = (
    <Button onClick={handleAplicar} leftIcon={<Check className="w-4 h-4" />}>
      Aplicar Filtros
    </Button>
  );

  return (
    <Modal
      open={show}
      onClose={onClose}
      title="Filtrar Trilhas"
      size="md"
      footer={footer}
    >
      <div className="overflow-auto max-h-[60vh] space-y-6">
        {/* Busca */}
        <Input
          variant="search"
          placeholder="Nome da Trilha"
          value={localFiltros.busca}
          onChange={(e) => setLocalFiltros(prev => ({ ...prev, busca: e.target.value }))}
        />

        {/* Status */}
        <div>
          <span className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Status
          </span>
          <div className="space-y-1">
            {statusOptions.map(option => (
              <Checkbox
                key={option.value}
                checked={localFiltros.status.includes(option.value)}
                onChange={() => toggleStatus(option.value)}
                label={option.label}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Opcoes */}
        <div>
          <span className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Opções
          </span>
          <div className="space-y-1">
            <Checkbox
              checked={localFiltros.comNovoConteudo}
              onChange={(checked) => setLocalFiltros(prev => ({ ...prev, comNovoConteudo: checked }))}
              label="Com novo conteúdo"
              size="sm"
            />
            <Checkbox
              checked={localFiltros.apenasObrigatorias}
              onChange={(checked) => setLocalFiltros(prev => ({ ...prev, apenasObrigatorias: checked }))}
              label="Trilha obrigatória"
              size="sm"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
