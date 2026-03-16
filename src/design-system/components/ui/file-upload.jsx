// ANEST Design System - FileUpload Component
// Upload de arquivos com dropzone e variante button

import * as React from "react"
import { Upload, X, File, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formata o tamanho do arquivo para exibição
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Valida se o arquivo está dentro do tamanho máximo
 */
function isFileSizeValid(file, maxSize) {
  if (!maxSize) return true
  return file.size <= maxSize
}

// ============================================================================
// FILE PREVIEW COMPONENT
// ============================================================================

function FilePreview({ file, onRemove, disabled }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl w-full min-w-0",
        "bg-secondary",
        "border border-border"
      )}
    >
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
          "bg-accent"
        )}
      >
        <File size={20} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "shrink-0 p-1.5 rounded-lg transition-colors",
            "text-muted-foreground hover:text-destructive",
            "hover:bg-destructive/10"
          )}
          aria-label={`Remover ${file.name}`}
        >
          <X size={16} />
        </button>
      )}
    </motion.div>
  )
}

// ============================================================================
// FILE UPLOAD COMPONENT
// ============================================================================

const FileUpload = React.forwardRef(
  (
    {
      value,
      onChange,
      accept,
      multiple = false,
      maxSize,
      label,
      description,
      error,
      disabled = false,
      variant = "dropzone",
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [isDragOver, setIsDragOver] = React.useState(false)
    const [sizeError, setSizeError] = React.useState(null)
    const inputRef = React.useRef(null)

    const autoId = React.useId()
    const uploadId = id ?? autoId
    const errorId = error || sizeError ? `${uploadId}-error` : undefined
    const descId = description ? `${uploadId}-desc` : undefined

    const hasError = (typeof error === "string" && error.trim().length > 0) || sizeError

    // Normalize value to array
    const files = React.useMemo(() => {
      if (!value) return []
      return Array.isArray(value) ? value : [value]
    }, [value])

    // Handle file selection
    const handleFiles = (newFiles) => {
      if (disabled) return
      setSizeError(null)

      const fileList = Array.from(newFiles)

      // Validate file sizes
      if (maxSize) {
        const invalidFiles = fileList.filter((f) => !isFileSizeValid(f, maxSize))
        if (invalidFiles.length > 0) {
          setSizeError(
            `Arquivo(s) excede(m) o limite de ${formatFileSize(maxSize)}`
          )
          return
        }
      }

      if (multiple) {
        onChange?.([...files, ...fileList])
      } else {
        onChange?.(fileList[0] || null)
      }
    }

    const handleInputChange = (e) => {
      handleFiles(e.target.files)
      // Reset input value to allow selecting same file again
      e.target.value = ""
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      if (!disabled) setIsDragOver(true)
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      setIsDragOver(false)
    }

    const handleDrop = (e) => {
      e.preventDefault()
      setIsDragOver(false)
      if (disabled) return

      const droppedFiles = e.dataTransfer?.files
      if (droppedFiles?.length) {
        handleFiles(droppedFiles)
      }
    }

    const handleClick = () => {
      if (!disabled) {
        inputRef.current?.click()
      }
    }

    const handleRemoveFile = (index) => {
      if (multiple) {
        const newFiles = files.filter((_, i) => i !== index)
        onChange?.(newFiles.length > 0 ? newFiles : null)
      } else {
        onChange?.(null)
      }
      setSizeError(null)
    }

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    }

    // Format accepted files for display
    const acceptedText = React.useMemo(() => {
      if (!accept) return ""
      return accept
        .split(",")
        .map((a) => a.trim().toUpperCase().replace(".", "").replace("/*", ""))
        .join(", ")
    }, [accept])

    const displayError = error || sizeError

    // Dropzone variant
    if (variant === "dropzone") {
      return (
        <div
          data-slot="file-upload-field"
          className={cn("grid gap-2 min-w-0", className)}
        >
          {/* Label */}
          {label && (
            <label
              data-slot="file-upload-label"
              htmlFor={uploadId}
              className="text-sm font-semibold text-primary"
            >
              {label}
            </label>
          )}

          {/* Dropzone */}
          <div
            ref={ref}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-describedby={[descId, errorId].filter(Boolean).join(" ") || undefined}
            className={cn(
              "relative flex flex-col items-center justify-center min-w-0 overflow-hidden",
              "px-4 py-5 rounded-[16px] border-2 border-dashed",
              "transition-all duration-200 cursor-pointer",
              "bg-card",
              // Default state
              !isDragOver && !hasError && "border-border",
              // Hover state
              !disabled && !hasError && "hover:border-primary hover:bg-secondary",
              // Drag over state
              isDragOver && !hasError && "border-primary bg-accent border-solid",
              // Error state
              hasError && "border-destructive",
              // Focus
              "focus:outline-none focus:ring-2",
              !hasError && "focus:ring-ring/30",
              hasError && "focus:ring-destructive/30",
              // Disabled
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Hidden file input */}
            <input
              ref={inputRef}
              type="file"
              id={uploadId}
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              onChange={handleInputChange}
              className="sr-only"
              {...props}
            />

            {/* Upload icon */}
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center mb-3",
                isDragOver
                  ? "bg-primary"
                  : "bg-accent"
              )}
            >
              <Upload
                size={20}
                className={cn(
                  isDragOver
                    ? "text-primary-foreground"
                    : "text-primary"
                )}
              />
            </div>

            {/* Text */}
            <p className="w-full text-sm font-medium text-foreground mb-1 text-center break-words">
              {isDragOver
                ? "Solte o arquivo aqui"
                : "Arraste arquivos ou clique para selecionar"}
            </p>
            {description && (
              <p
                id={descId}
                className="w-full text-xs text-muted-foreground text-center break-words"
              >
                {description}
              </p>
            )}
            {acceptedText && !description && (
              <p className="w-full text-xs text-muted-foreground text-center">
                {acceptedText}
                {maxSize && ` até ${formatFileSize(maxSize)}`}
              </p>
            )}
          </div>

          {/* File Previews */}
          <AnimatePresence>
            {files.length > 0 && (
              <div className="grid gap-2 mt-2 min-w-0">
                {files.map((file, index) => (
                  <FilePreview
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={() => handleRemoveFile(index)}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {displayError && (
            <p
              id={errorId}
              data-slot="file-upload-error"
              className="flex items-center gap-1.5 text-sm text-destructive"
            >
              <AlertCircle size={14} />
              {displayError}
            </p>
          )}
        </div>
      )
    }

    // Button variant
    return (
      <div
        data-slot="file-upload-field"
        className={cn("grid gap-2 min-w-0", className)}
      >
        {/* Label */}
        {label && (
          <label
            data-slot="file-upload-label"
            htmlFor={uploadId}
            className="text-sm font-semibold text-primary"
          >
            {label}
          </label>
        )}

        <div className="flex items-center gap-3 min-w-0">
          {/* Button */}
          <button
            ref={ref}
            type="button"
            onClick={handleClick}
            disabled={disabled}
            aria-describedby={[descId, errorId].filter(Boolean).join(" ") || undefined}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl",
              "text-sm font-semibold transition-all duration-200",
              "bg-primary text-primary-foreground",
              "hover:bg-primary-hover",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "focus:ring-ring",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Upload size={16} />
            Selecionar arquivo
          </button>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            id={uploadId}
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            onChange={handleInputChange}
            className="sr-only"
            {...props}
          />

          {/* Selected file name */}
          {files.length > 0 && (
            <span className="text-sm text-foreground truncate flex-1 min-w-0">
              {files.length === 1
                ? files[0].name
                : `${files.length} arquivos selecionados`}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p
            id={descId}
            className="text-xs text-muted-foreground"
          >
            {description}
          </p>
        )}

        {/* File Previews (for button variant, show in list below) */}
        <AnimatePresence>
          {files.length > 0 && (
            <div className="grid gap-2 mt-1 min-w-0">
              {files.map((file, index) => (
                <FilePreview
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => handleRemoveFile(index)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {displayError && (
          <p
            id={errorId}
            data-slot="file-upload-error"
            className="flex items-center gap-1.5 text-sm text-destructive"
          >
            <AlertCircle size={14} />
            {displayError}
          </p>
        )}
      </div>
    )
  }
)

FileUpload.displayName = "FileUpload"

export { FileUpload }
