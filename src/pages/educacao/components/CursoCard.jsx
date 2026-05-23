import { memo } from 'react';
import { ChevronRight, GraduationCap, Clock } from 'lucide-react';
import { Card, CardContent, Button, Progress, Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { formatDuracao, formatData } from '../data/educacaoUtils';

/**
 * CursoCard — card de curso na listagem.
 *
 * Wave 1.7 T1.7.10: este componente NÃO consome `mockCategorias` diretamente
 * (a categoria do curso já vem embutida em `curso.categoria` via
 * `EducacaoContinuadaPage` → `useEducacao`). Quando o parent migrar para
 * `useCategorias()`, o shape de `curso.categoria` permanece o mesmo (string).
 */
export const CursoCard = memo(function CursoCard({ curso, onClick }) {
  const buttonText = (() => {
    switch (curso.status) {
      case 'nao_iniciado':
        return 'INICIAR';
      case 'em_andamento':
        return 'CONTINUAR';
      case 'concluido':
      case 'aprovado':
        return 'VER CERTIFICADO';
      default:
        return 'VER DETALHES';
    }
  })();

  // Calculate completed modules
  const completedModulos = curso.modulosCompletos?.length || 0;

  return (
    <Card className="overflow-hidden">
      {/* Banner with gradient background */}
      <div
        className={cn(
          "relative h-36 p-5 flex flex-col justify-end",
          !curso.banner && "bg-gradient-to-br from-greenDark via-greenMedium to-greenBright"
        )}
        style={{
          backgroundImage: curso.banner ? `url(${curso.banner})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Overlay escuro para legibilidade quando tem banner */}
        {curso.banner && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        )}

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]">
            <GraduationCap className="w-32 h-32 text-white" />
          </div>
        </div>

        {/* Bottom gradient for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Course Title */}
        <h3
          className="relative z-10 text-white text-2xl font-extrabold leading-tight tracking-tight line-clamp-2 drop-shadow-lg"
        >
          {curso.titulo}
        </h3>
        {curso.descricao ? (
          <p className="relative z-10 text-white/90 text-sm mt-1 line-clamp-1 font-medium drop-shadow-md">
            {curso.descricao}
          </p>
        ) : null}
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-3">
        {/* Action Button */}
        <Button
          onClick={onClick}
          variant="default"
          className="w-full"
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          {buttonText}
        </Button>

        {/* Progress info */}
        <p className="text-sm text-muted-foreground">
          Você completou <span className="font-bold text-foreground">{completedModulos} aulas</span>.
        </p>

        {/* Progress Bar */}
        <Progress
          value={curso.progresso}
          size="sm"
          className="h-2"
        />

        {/* Meta info inline */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="default"
            badgeStyle="solid"
            className="flex items-center gap-1"
          >
            <GraduationCap className="w-3 h-3" />
            META: {curso.metaPorcentagem || 100}%
          </Badge>
          <Badge
            variant="secondary"
            badgeStyle="solid"
            className="flex items-center gap-1"
          >
            <Clock className="w-3 h-3" />
            {(() => {
              // T1.5.4 — tempo restante
              const total = curso.duracaoMinutos;
              const status = curso.status;
              const progresso = Number(curso.progresso) || 0;
              if (!total) return formatDuracao(total);
              if (status === 'concluido' || status === 'aprovado') return 'Concluído';
              if (status === 'em_andamento' && progresso > 0 && progresso < 100) {
                const restante = Math.max(1, Math.round(total * (1 - progresso / 100)));
                return `~${formatDuracao(restante)} restantes`;
              }
              return formatDuracao(total);
            })()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Liberado em {formatData(curso.dataLiberacao)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
