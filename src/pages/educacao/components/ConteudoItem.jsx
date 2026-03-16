import { ChevronRight, Play, FileText, CheckCircle, Headphones, BookOpen, ExternalLink } from 'lucide-react';
import { Card, Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';

const tipoIcons = {
  video: Play,
  youtube: Play,
  vimeo: Play,
  audio: Headphones,
  document: FileText,
  documento: FileText,
  text: BookOpen,
  leitura: BookOpen,
  link: ExternalLink,
  quiz: CheckCircle,
  conteudo: FileText,
};

export function ConteudoItem({ modulo, isCompleto, progresso, onClick }) {
  const Icon = tipoIcons[modulo.tipo] || FileText;

  return (
    <button
      onClick={() => onClick?.(modulo)}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-xl border transition-all",
        isCompleto
          ? "bg-[#E8F5E9] dark:bg-[#145A32] border-success"
          : "bg-card border-border hover:border-primary"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        isCompleto
          ? "bg-success/20 text-success"
          : "bg-muted text-muted-foreground"
      )}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <h4 className="text-sm font-medium text-foreground truncate">
          {modulo.titulo}
        </h4>
        {modulo.duracao && (
          <span className="text-xs text-muted-foreground">
            {modulo.duracao} min
          </span>
        )}
      </div>

      {isCompleto ? (
        <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
      ) : (
        <Badge variant="secondary" badgeStyle="subtle">
          {progresso}%
        </Badge>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
