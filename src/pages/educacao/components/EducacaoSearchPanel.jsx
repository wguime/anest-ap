import * as React from "react"
import Fuse from "fuse.js"
import { GitBranch, BookOpen, Layers, PlayCircle, ChevronRight } from "lucide-react"

import { Card, CardContent, Badge } from "@/design-system"
import { cn } from "@/design-system/utils/tokens"

/**
 * EducacaoSearchPanel — T1.5.8
 *
 * Busca client-side com fuse.js sobre 4 índices em memória:
 * trilhas / cursos / módulos / aulas. Resultados agrupados, cada item navegável.
 *
 * Decisão arquitetural: educação vive em Firestore, dados já carregados via
 * useEducacaoData. Postgres tsvector inviável sem replicar — fuse.js zero infra.
 */

const FUSE_OPTIONS = {
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
  keys: [
    { name: "titulo", weight: 0.7 },
    { name: "descricao", weight: 0.2 },
    { name: "tags", weight: 0.1 },
  ],
}

const MAX_PER_GROUP = 5

function isEntityVisivel(entity) {
  if (!entity) return false
  if (entity.ativo === false) return false
  const statusPub = entity.statusPublicacao?.toLowerCase()
  if (statusPub === "draft") return false
  if (statusPub === "scheduled" && entity.releaseAt) {
    const release = entity.releaseAt?.toDate?.() || new Date(entity.releaseAt)
    if (Date.now() < release.getTime()) return false
  }
  return true
}

export function EducacaoSearchPanel({
  query,
  trilhas = [],
  cursos = [],
  modulos = [],
  aulas = [],
  onNavigate,
  onClose,
}) {
  const trilhasFuse = React.useMemo(
    () => new Fuse(trilhas.filter(isEntityVisivel), FUSE_OPTIONS),
    [trilhas]
  )
  const cursosFuse = React.useMemo(
    () => new Fuse(cursos.filter(isEntityVisivel), FUSE_OPTIONS),
    [cursos]
  )
  const modulosFuse = React.useMemo(
    () => new Fuse(modulos.filter(isEntityVisivel), FUSE_OPTIONS),
    [modulos]
  )
  const aulasFuse = React.useMemo(
    () => new Fuse(aulas.filter(isEntityVisivel), FUSE_OPTIONS),
    [aulas]
  )

  const trimmed = (query || "").trim()
  const resultados = React.useMemo(() => {
    if (trimmed.length < 2) return null
    return {
      trilhas: trilhasFuse.search(trimmed).slice(0, MAX_PER_GROUP).map((r) => r.item),
      cursos: cursosFuse.search(trimmed).slice(0, MAX_PER_GROUP).map((r) => r.item),
      modulos: modulosFuse.search(trimmed).slice(0, MAX_PER_GROUP).map((r) => r.item),
      aulas: aulasFuse.search(trimmed).slice(0, MAX_PER_GROUP).map((r) => r.item),
    }
  }, [trimmed, trilhasFuse, cursosFuse, modulosFuse, aulasFuse])

  if (!resultados) return null

  const total =
    resultados.trilhas.length +
    resultados.cursos.length +
    resultados.modulos.length +
    resultados.aulas.length

  const handleClick = (page, props) => {
    onNavigate?.(page, props)
    onClose?.()
  }

  if (total === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum resultado para <strong className="text-foreground">"{trimmed}"</strong>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Tente termos mais curtos ou verifique a grafia.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
          {total} {total === 1 ? "resultado" : "resultados"}
        </p>

        <Group
          title="Trilhas"
          icon={GitBranch}
          items={resultados.trilhas}
          onItemClick={(t) => handleClick("trilha-detalhe", { trilhaId: t.id })}
        />
        <Group
          title="Cursos"
          icon={BookOpen}
          items={resultados.cursos}
          onItemClick={(c) => handleClick("cursoDetalhe", { cursoId: c.id })}
        />
        <Group
          title="Módulos"
          icon={Layers}
          items={resultados.modulos}
          onItemClick={(m) =>
            handleClick("aula-player", {
              cursoId: m.cursoId,
              moduloId: m.id,
            })
          }
        />
        <Group
          title="Aulas"
          icon={PlayCircle}
          items={resultados.aulas}
          onItemClick={(a) =>
            handleClick("aula-player", {
              cursoId: a.cursoId,
              moduloId: a.moduloId,
              aulaId: a.id,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

function Group({ title, icon: Icon, items, onItemClick }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onItemClick(item)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left min-h-[44px]",
                "hover:bg-muted/60 active:bg-muted transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.titulo}
                </p>
                {item.descricao && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.descricao}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
