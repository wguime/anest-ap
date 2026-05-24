/**
 * ResumeHeroCard — "Continue de onde parou"
 *
 * Hero mobile-first no topo da EducacaoContinuadaPage. Renderiza apenas
 * quando há curso em andamento com aula parcialmente assistida ou próxima
 * aula identificada. Hidden quando progresso === 100% ou sem retomada.
 *
 * Padrão: SCORM cmi.suspend_data adaptado para Firestore.
 * Plano: Wave 1.2 T1.2.3.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, ChevronRight, GraduationCap, Clock } from 'lucide-react';
import { Card, Button, Progress, Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { prefersReducedMotion } from '@/design-system/utils/motion';
import { formatDuracao } from '../data/educacaoUtils';

function formatTempo(segundos) {
  if (!segundos || segundos < 0) return '0:00';
  const s = Math.floor(segundos);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function ResumeHeroCard({
  resume,
  cursos,
  aulas,
  modulos: _modulos,
  cursoModulosRel,
  moduloAulasRel,
  onContinuar,
  className,
}) {
  const curso = useMemo(() => {
    if (!resume?.cursoId) return null;
    return (cursos || []).find(c => c.id === resume.cursoId) || null;
  }, [cursos, resume]);

  // Determinar a aula efetiva para retomada
  const aula = useMemo(() => {
    if (!curso) return null;

    // 1) Se o service identificou uma aula com currentTime > 0, usar.
    if (resume?.aulaId) {
      const found = (aulas || []).find(a => a.id === resume.aulaId);
      if (found) return found;
    }

    // 2) Senão, sugere próxima aula não concluída via cursoModulosRel + moduloAulasRel.
    const moduloIdsOrdered = (cursoModulosRel || [])
      .filter(r => r.cursoId === curso.id)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map(r => r.moduloId);

    for (const moduloId of moduloIdsOrdered) {
      const aulaIdsOrdered = (moduloAulasRel || [])
        .filter(r => r.moduloId === moduloId)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(r => r.aulaId);
      for (const aulaId of aulaIdsOrdered) {
        const a = (aulas || []).find(x => x.id === aulaId);
        if (a && a.ativo !== false) return a;
      }
    }
    return null;
  }, [curso, aulas, cursoModulosRel, moduloAulasRel, resume]);

  // Não renderizar se: sem resume, sem curso, ou curso já 100%
  if (!resume || !curso) return null;
  if ((resume.progressoCurso || 0) >= 100) return null;

  const moduloId = aula?.moduloId
    || (moduloAulasRel || []).find(r => r.aulaId === aula?.id)?.moduloId
    || null;

  const handleClick = () => {
    onContinuar?.({
      cursoId: curso.id,
      moduloId,
      aulaId: aula?.id,
    });
  };

  const titulo = aula?.titulo || 'Próxima aula';
  const hasPosicao = Number(resume.currentTime || 0) > 30;
  const reduced = prefersReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
    >
    <Card
      className={cn(
        'overflow-hidden border-primary/30',
        className,
      )}
    >
      {/* Banner */}
      <div
        className={cn(
          'relative h-32 sm:h-36 p-4 sm:p-5 flex flex-col justify-end',
          !curso.banner && 'bg-gradient-to-br from-primary/80 via-primary to-primary/60',
        )}
        style={{
          backgroundImage: curso.banner ? `url(${curso.banner})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {curso.banner && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
        )}

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-[0.12]">
            <PlayCircle className="w-24 h-24 text-white" />
          </div>
        </div>

        <div className="relative z-10">
          <Badge
            variant="secondary"
            badgeStyle="solid"
            className="mb-2 bg-background/90 text-foreground backdrop-blur-sm"
          >
            Continue de onde parou
          </Badge>
          <h2 className="text-white text-xl sm:text-2xl font-extrabold leading-tight tracking-tight line-clamp-2 drop-shadow-lg">
            {curso.titulo}
          </h2>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <PlayCircle
            className="w-5 h-5 text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground line-clamp-1">
              {titulo}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasPosicao
                ? `Pausou em ${formatTempo(resume.currentTime)}`
                : aula?.duracao
                  ? `${formatDuracao(aula.duracao)} de aula`
                  : 'Próxima aula sugerida'}
            </p>
          </div>
        </div>

        <Progress
          value={resume.progressoCurso || 0}
          size="sm"
          className="h-2"
          aria-label={`Progresso do curso: ${resume.progressoCurso || 0}%`}
        />

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            {resume.progressoCurso || 0}% concluído
          </span>
          {curso.duracaoMinutos ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuracao(curso.duracaoMinutos)}
            </span>
          ) : null}
        </div>

        <Button
          onClick={handleClick}
          variant="default"
          className="w-full min-h-11"
          rightIcon={<ChevronRight className="w-4 h-4" />}
          aria-label={`Continuar curso ${curso.titulo}`}
        >
          {hasPosicao ? 'CONTINUAR' : 'COMEÇAR PRÓXIMA AULA'}
        </Button>
      </div>
    </Card>
    </motion.div>
  );
}

export default ResumeHeroCard;
