import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, Card, CardContent, Button } from '@/design-system';
import { Check, ChevronLeft } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  ATALHOS_DISPONIVEIS,
  CATEGORIAS,
  ATALHOS_PADRAO,
  MAX_ATALHOS,
  getAtalhosByCategoria,
  carregarAtalhosSalvos,
  salvarAtalhos,
} from '../data/atalhosConfig';

// Componente de ícone do atalho (mesmo estilo do AppIcon)
function AtalhoIcon({ icon, label, selected, onClick, disabled }) {
  const IconComponent = LucideIcons[icon];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`flex flex-col items-center transition-all duration-150 ${
        disabled && !selected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {/* Container relativo para o badge ficar fora do círculo */}
      <div className="relative">
        <div
          className={`
            w-[54px] h-[54px] rounded-full
            flex items-center justify-center
            transition-all duration-150
            ${selected
              ? `bg-gradient-to-br from-greenMedium to-greenDark
                 border-2 border-greenLight
                 text-white
                 shadow-[0_6px_16px_rgba(0,66,37,0.4)]
                 dark:bg-gradient-to-br dark:from-greenBright dark:to-greenMedium
                 dark:border-0
                 dark:text-primary-foreground
                 dark:shadow-[0_6px_16px_rgba(46,204,113,0.4)]
                 scale-100`
              : `bg-muted
                 border-2 border-transparent
                 text-muted-foreground
                 opacity-60
                 hover:opacity-80
                 scale-95`
            }
            active:scale-90
          `}
        >
          {IconComponent && <IconComponent className="w-6 h-6" />}
        </div>

        {/* Check badge - fora do círculo */}
        {selected && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-greenLight dark:bg-primary flex items-center justify-center shadow-md border-2 border-white dark:border-background">
            <Check className="w-3 h-3 text-white dark:text-primary-foreground" strokeWidth={3} />
          </div>
        )}
      </div>

      <span
        className={`
          mt-2 text-[10px] font-medium text-center max-w-[70px] truncate
          ${selected
            ? 'text-foreground'
            : 'text-muted-foreground'
          }
        `}
      >
        {label}
      </span>
    </button>
  );
}

// Componente de preview dos atalhos selecionados
function PreviewAtalhos({ selectedIds }) {
  return (
    <Card variant="highlight" className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Seus Atalhos
          </h3>
          <span className="text-xs font-medium text-primary">
            {selectedIds.length}/{MAX_ATALHOS}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {selectedIds.map((id) => {
            const atalho = ATALHOS_DISPONIVEIS.find((a) => a.id === id);
            if (!atalho) return null;
            const IconComponent = LucideIcons[atalho.icon];

            return (
              <div key={id} className="flex flex-col items-center">
                <div
                  className={`
                    w-[54px] h-[54px] rounded-full overflow-hidden
                    flex items-center justify-center
                    bg-gradient-to-br from-greenMedium to-greenDark
                    border-2 border-greenLight
                    text-white
                    shadow-[0_6px_16px_rgba(0,66,37,0.4)]
                    dark:bg-gradient-to-br dark:from-greenBright dark:to-greenMedium
                    dark:border-0
                    dark:text-primary-foreground
                    dark:shadow-[0_6px_16px_rgba(46,204,113,0.4)]
                  `}
                >
                  {IconComponent && <IconComponent className="w-6 h-6" />}
                </div>
                <span className="mt-2 text-[10px] font-medium text-muted-foreground text-center max-w-[70px] truncate">
                  {atalho.label}
                </span>
              </div>
            );
          })}

          {/* Slots vazios */}
          {Array.from({ length: MAX_ATALHOS - selectedIds.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex flex-col items-center">
              <div className="w-[54px] h-[54px] rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <span className="text-border text-2xl">+</span>
              </div>
              <span className="mt-2 text-[10px] font-medium text-border">
                Vazio
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de categoria
function CategoriaSection({ categoria, selectedIds, onToggle, maxReached }) {
  const atalhos = getAtalhosByCategoria(categoria.id);
  const CategoriaIcon = LucideIcons[categoria.icon];

  return (
    <Card variant="default" className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          {CategoriaIcon && (
            <CategoriaIcon className="w-5 h-5 text-primary" />
          )}
          <h3 className="text-sm font-semibold text-foreground">
            {categoria.label}
          </h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {atalhos.map((atalho) => (
            <AtalhoIcon
              key={atalho.id}
              icon={atalho.icon}
              label={atalho.label}
              selected={selectedIds.includes(atalho.id)}
              onClick={() => onToggle(atalho.id)}
              disabled={maxReached}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonalizarAtalhosPage({ onNavigate }) {
  const { _isDark } = useTheme();
  const [selectedIds, setSelectedIds] = useState(() => carregarAtalhosSalvos());
  const [_hasChanges, setHasChanges] = useState(false);
  const [originalIds] = useState(() => carregarAtalhosSalvos());

  const maxReached = selectedIds.length >= MAX_ATALHOS;

  // Detectar mudanças
  useEffect(() => {
    const changed = JSON.stringify(selectedIds) !== JSON.stringify(originalIds);
    setHasChanges(changed);
  }, [selectedIds, originalIds]);

  // Toggle atalho
  const handleToggle = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        // Remover
        return prev.filter((i) => i !== id);
      } else if (prev.length < MAX_ATALHOS) {
        // Adicionar
        return [...prev, id];
      } else {
        // Max atingido - substituir o primeiro (FIFO)
        return [...prev.slice(1), id];
      }
    });
  };

  // Salvar
  const handleSave = () => {
    if (selectedIds.length === MAX_ATALHOS) {
      salvarAtalhos(selectedIds);
      onNavigate('home');
    }
  };

  // Resetar para padrão
  const handleReset = () => {
    setSelectedIds(ATALHOS_PADRAO);
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Personalizar Atalhos
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-background pb-32">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Instrução */}
        <p className="text-sm text-muted-foreground mb-4">
          Escolha {MAX_ATALHOS} atalhos para exibir no seu painel inicial.
        </p>

        {/* Preview */}
        <PreviewAtalhos selectedIds={selectedIds} />

        {/* Categorias */}
        {CATEGORIAS.map((categoria) => (
          <CategoriaSection
            key={categoria.id}
            categoria={categoria}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            maxReached={maxReached}
          />
        ))}

        {/* Aviso se não tem 4 selecionados */}
        {selectedIds.length < MAX_ATALHOS && (
          <div className="mb-4 p-3 rounded-xl bg-warning/10 dark:bg-warning/20 border border-warning/30">
            <p className="text-sm text-warning">
              Selecione mais {MAX_ATALHOS - selectedIds.length} atalho{MAX_ATALHOS - selectedIds.length > 1 ? 's' : ''} para salvar.
            </p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleReset}
          >
            Restaurar Padrão
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={handleSave}
            disabled={selectedIds.length !== MAX_ATALHOS}
          >
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
