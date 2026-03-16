import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Modal, Input, Checkbox, RadioGroup, Button } from '@/design-system';

export function CursoFiltros({ show, filtros, categorias, statusCounts, onClose, onAplicar }) {
  const [localFiltros, setLocalFiltros] = useState(filtros);

  useEffect(() => {
    if (show) {
      setLocalFiltros(filtros);
    }
  }, [show, filtros]);

  const statusOptions = [
    { value: 'nao_iniciado', label: 'Nao iniciados', count: statusCounts?.nao_iniciado || 0 },
    { value: 'em_andamento', label: 'Em andamento', count: statusCounts?.em_andamento || 0 },
    { value: 'aprovado', label: 'Aprovados', count: statusCounts?.aprovado || 0 },
    { value: 'reprovado', label: 'Reprovados', count: statusCounts?.reprovado || 0 },
    { value: 'expirado', label: 'Expirados', count: statusCounts?.expirado || 0 },
    { value: 'concluido', label: 'Concluidos', count: statusCounts?.concluido || 0 },
  ];

  const agruparOptions = [
    { value: 'categoria', label: 'Categoria' },
    { value: 'status', label: 'Status' },
  ];

  const todasCategoriasSelecionadas = categorias?.length > 0 &&
    categorias.every(cat => localFiltros.categorias.includes(cat.id));

  const toggleTodasCategorias = () => {
    if (todasCategoriasSelecionadas) {
      setLocalFiltros(prev => ({ ...prev, categorias: [] }));
    } else {
      setLocalFiltros(prev => ({ ...prev, categorias: categorias.map(cat => cat.id) }));
    }
  };

  const toggleStatus = (value) => {
    setLocalFiltros(prev => ({
      ...prev,
      status: prev.status.includes(value)
        ? prev.status.filter(s => s !== value)
        : [...prev.status, value]
    }));
  };

  const toggleCategoria = (id) => {
    setLocalFiltros(prev => ({
      ...prev,
      categorias: prev.categorias.includes(id)
        ? prev.categorias.filter(c => c !== id)
        : [...prev.categorias, id]
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
      title="Filtrar Cursos"
      size="md"
      footer={footer}
    >
      <div className="overflow-auto max-h-[60vh] space-y-6">
          {/* Busca */}
          <Input
            variant="search"
            placeholder="Nome do Curso"
            value={localFiltros.busca}
            onChange={(e) => setLocalFiltros(prev => ({ ...prev, busca: e.target.value }))}
          />

          {/* Agrupar Por */}
          <RadioGroup
            label="Agrupar Por"
            options={agruparOptions}
            value={localFiltros.agruparPor}
            onChange={(value) => setLocalFiltros(prev => ({ ...prev, agruparPor: value }))}
          />

          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Categoria
              </span>
              <button
                type="button"
                onClick={toggleTodasCategorias}
                className="text-xs text-primary font-medium hover:underline"
              >
                {todasCategoriasSelecionadas ? 'Desmarcar' : 'Marcar'} todos
              </button>
            </div>
            <div className="space-y-1">
              {categorias?.map(cat => (
                <Checkbox
                  key={cat.id}
                  checked={localFiltros.categorias.includes(cat.id)}
                  onChange={() => toggleCategoria(cat.id)}
                  label={`${cat.nome} (${cat.quantidade})`}
                  size="sm"
                />
              ))}
            </div>
          </div>

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
                  label={`${option.label} (${option.count})`}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Opcoes */}
          <div>
            <span className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Opcoes
            </span>
            <Checkbox
              checked={localFiltros.apenasObrigatorios}
              onChange={(checked) => setLocalFiltros(prev => ({ ...prev, apenasObrigatorios: checked }))}
              label="Apenas obrigatorios"
              size="sm"
            />
          </div>
      </div>
    </Modal>
  );
}
