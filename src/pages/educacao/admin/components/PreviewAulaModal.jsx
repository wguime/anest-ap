import * as React from "react"
import { Monitor, Tablet, Smartphone, PlayCircle, Clock, Paperclip, FileText, FileImage, FileVideo, FileAudio, File as FileIcon } from "lucide-react"
import DOMPurify from "dompurify"

import { Modal, Card, CardContent, Badge, Button, EmptyState } from "@/design-system"
import { cn } from "@/design-system/utils/tokens"

/**
 * PreviewAulaModal — T1.5.12
 *
 * Preview "olho de aluno" de UMA aula (não a árvore inteira).
 * Toggle desktop/tablet/mobile simulando viewport via container width.
 *
 * Mostra o que o aluno veria: título, descrição, duração, anexos, vídeo embed.
 * Modo read-only — sem ações (favoritar, anotar, marcar concluído).
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {object} aula  — { titulo, descricao, descricaoHtml, duracao, tipo, url, anexos }
 */
export function PreviewAulaModal({ open, onClose, aula }) {
  const [viewport, setViewport] = React.useState("desktop")

  const widthMap = {
    desktop: "max-w-full",
    tablet: "max-w-[768px]",
    mobile: "max-w-[375px]",
  }

  if (!aula) {
    return (
      <Modal open={open} onClose={onClose} title="Visualizar como aluno" size="lg">
        <EmptyState
          title="Sem aula carregada"
          description="Salve a aula primeiro para pré-visualizar."
        />
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Visualizar como aluno"
      description="Como esta aula aparece para um aluno autenticado."
      size="xl"
    >
      <div className="space-y-3">
        {/* Toggle viewport */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="text-xs text-muted-foreground">Tela</span>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <ViewportButton
              active={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
              icon={Monitor}
              label="Desktop"
            />
            <ViewportButton
              active={viewport === "tablet"}
              onClick={() => setViewport("tablet")}
              icon={Tablet}
              label="Tablet"
            />
            <ViewportButton
              active={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
              icon={Smartphone}
              label="Mobile"
            />
          </div>
        </div>

        {/* Container simulando viewport */}
        <div className="bg-muted/30 rounded-lg p-4">
          <div className={cn("mx-auto bg-background rounded-lg overflow-hidden border border-border", widthMap[viewport])}>
            <AulaContentPreview aula={aula} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ViewportButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium min-h-[36px] transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground"
      )}
      aria-pressed={active}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function AulaContentPreview({ aula }) {
  const html = aula.descricaoHtml || aula.descricao || ""
  const cleanHtml = React.useMemo(() => {
    try {
      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
    } catch {
      return ""
    }
  }, [html])

  const duracaoLabel = (() => {
    const d = Number(aula.duracao || aula.duracaoMinutos)
    if (!d || !Number.isFinite(d)) return null
    if (d >= 60) {
      const h = Math.floor(d / 60)
      const m = d % 60
      return `${h}h${m > 0 ? ` ${m}min` : ""}`
    }
    return `${d} min`
  })()

  return (
    <div className="p-4 space-y-4">
      {/* Title + meta */}
      <div className="space-y-2">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          {aula.titulo || "Aula sem título"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {duracaoLabel && (
            <Badge variant="secondary" badgeStyle="subtle" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duracaoLabel}
            </Badge>
          )}
          {aula.tipo && (
            <Badge variant="default" badgeStyle="subtle">
              {String(aula.tipo).toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Player placeholder */}
      {(aula.tipo === "youtube" || aula.tipo === "video" || aula.url) && (
        <div className="aspect-video bg-greenDark/90 rounded-lg flex items-center justify-center text-white">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <PlayCircle className="w-12 h-12" aria-hidden="true" />
            <p className="text-xs opacity-80 break-all">
              {aula.url || "Vídeo será exibido aqui"}
            </p>
          </div>
        </div>
      )}

      {/* Descrição */}
      {cleanHtml ? (
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Sem descrição definida.
        </p>
      )}

      {/* Anexos */}
      {Array.isArray(aula.anexos) && aula.anexos.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Paperclip className="w-3 h-3" />
              Material complementar
            </p>
            <ul className="space-y-1">
              {aula.anexos.map((anexo, idx) => (
                <li
                  key={anexo.id || idx}
                  className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/40"
                >
                  <AnexoIcon mimeType={anexo.mimeType} className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{anexo.label || anexo.name || "Anexo"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AnexoIcon({ mimeType, className }) {
  const m = (mimeType || "").toLowerCase()
  if (m.startsWith("image/")) return <FileImage className={className} aria-hidden="true" />
  if (m.startsWith("video/")) return <FileVideo className={className} aria-hidden="true" />
  if (m.startsWith("audio/")) return <FileAudio className={className} aria-hidden="true" />
  if (m === "application/pdf" || m.includes("pdf")) return <FileText className={className} aria-hidden="true" />
  return <FileIcon className={className} aria-hidden="true" />
}

/**
 * Botão padrão para abrir o preview a partir do header de form modals.
 * Use como `<PreviewAsStudentButton onClick={() => setPreviewOpen(true)} disabled={!isEditing} />`
 */
export function PreviewAsStudentButton({ onClick, disabled = false, label = "Visualizar como aluno" }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      leftIcon={<PlayCircle className="w-4 h-4" aria-hidden="true" />}
      title={disabled ? "Salve primeiro para pré-visualizar" : label}
    >
      {label}
    </Button>
  )
}
