import { Heart } from 'lucide-react';
import { formatData } from '../data/educacaoUtils';

export function PontosItem({ item }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate">
          {item.cursoTitulo}
        </h4>
        {item.dataConclusao && (
          <span className="text-xs text-muted-foreground">
            Concluido em {formatData(item.dataConclusao)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
        <Heart className="w-4 h-4 text-success" fill="currentColor" />
        <span className="text-base font-bold text-success">
          {item.pontos.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
