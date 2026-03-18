import { useState } from 'react';
import { X, User, ClipboardList, Wrench, Building2, MessageCircle, Landmark } from 'lucide-react';
import { FATORES_CONTRIBUINTES_CATEGORIAS } from '@/data/rcaConfig';
import { Textarea, Button } from '@/design-system';

const ICONS = {
  User,
  ClipboardList,
  Wrench,
  Building2,
  MessageCircle,
  Landmark,
};

export default function FatoresContribuintes({ fatores, onChange }) {
  const [categoriaAberta, setCategoriaAberta] = useState(null);
  const [descricao, setDescricao] = useState('');

  const handleAddFator = () => {
    if (!categoriaAberta || !descricao.trim()) return;

    const novoFator = {
      categoria: categoriaAberta,
      descricao: descricao.trim(),
      adicionadoEm: new Date().toISOString(),
    };

    onChange([...fatores, novoFator]);
    setDescricao('');
    setCategoriaAberta(null);
  };

  const handleRemoveFator = (index) => {
    onChange(fatores.filter((_, i) => i !== index));
  };

  const getCategoriaConfig = (value) =>
    FATORES_CONTRIBUINTES_CATEGORIAS.find((c) => c.value === value);

  return (
    <div className="space-y-4">
      {/* Grid de categorias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FATORES_CONTRIBUINTES_CATEGORIAS.map((cat) => {
          const Icon = ICONS[cat.icon] || User;
          const isActive = categoriaAberta === cat.value;

          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => {
                setCategoriaAberta(isActive ? null : cat.value);
                setDescricao('');
              }}
              className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'border-current shadow-sm'
                  : 'border-border hover:border-primary dark:hover:border-primary'
              }`}
              style={isActive ? { borderColor: cat.color, backgroundColor: `${cat.color}10` } : {}}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Input de descrição quando categoria aberta */}
      {categoriaAberta && (
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <Textarea
            label={getCategoriaConfig(categoriaAberta)?.label}
            value={descricao}
            onChange={(val) => setDescricao(val)}
            placeholder={`Ex.: ${getCategoriaConfig(categoriaAberta)?.exemplos?.[0] || 'Descreva o fator...'}`}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCategoriaAberta(null); setDescricao(''); }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!descricao.trim()}
              onClick={handleAddFator}
            >
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Fatores adicionados */}
      {fatores.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">
            Fatores Identificados ({fatores.length})
          </p>
          {fatores.map((fator, index) => {
            const catConfig = getCategoriaConfig(fator.categoria);
            const Icon = ICONS[catConfig?.icon] || User;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-2xl border border-border bg-card"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${catConfig?.color}20` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: catConfig?.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: catConfig?.color }}>
                    {catConfig?.label}
                  </p>
                  <p className="text-sm text-foreground mt-0.5">
                    {fator.descricao}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFator(index)}
                  className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
