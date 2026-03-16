import * as React from "react"
import { Plus, Trash2, Pencil, Upload, Settings, UserPlus } from "lucide-react"
import { Button } from "@/design-system/components/ui/button"
import { cn } from "@/design-system/utils/tokens"
import {
  AdminOnly,
  CanCreate,
  CanEdit,
  CanDelete,
  isAdministrator,
} from "./admin-only"

/**
 * Admin Buttons - Botões especializados para ações administrativas
 *
 * Migrado do legado: painel-qualidade.js, documento-manager.js
 *
 * Cada botão já inclui verificação de permissão integrada.
 * Se o usuário não tiver permissão, o botão não é renderizado.
 *
 * @example
 * // Botão de adicionar documento (só aparece se user puder criar)
 * <AddDocumentButton user={currentUser} category="protocolos" onClick={handleAdd}>
 *   Novo Protocolo
 * </AddDocumentButton>
 *
 * // Botão de deletar (só aparece para admins)
 * <DeleteButton user={currentUser} onClick={handleDelete} />
 *
 * // Botão de editar com categoria específica
 * <EditButton user={currentUser} category="comunicados" onClick={handleEdit} />
 */

/**
 * AddButton - Botão genérico de adicionar (apenas admins)
 */
function AddButton({
  user,
  onClick,
  children,
  className,
  size = "default",
  disabled,
  loading,
  ...props
}) {
  return (
    <AdminOnly user={user}>
      <Button
        variant="default"
        size={size}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        leftIcon={<Plus className="h-4 w-4" />}
        className={cn(
          // Design System: green.medium (light) / green.primary (dark)
          "bg-[#006837] hover:bg-[#004225]",
          "dark:bg-[#2ECC71] dark:hover:bg-[#1E8449]",
          className
        )}
        {...props}
      >
        {children || "Adicionar"}
      </Button>
    </AdminOnly>
  )
}

/**
 * AddDocumentButton - Botão de adicionar documento com verificação de permissão
 */
function AddDocumentButton({
  user,
  category,
  onClick,
  children,
  className,
  size = "default",
  disabled,
  loading,
  ...props
}) {
  return (
    <CanCreate user={user} category={category}>
      <Button
        variant="default"
        size={size}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        leftIcon={<Plus className="h-4 w-4" />}
        className={cn(
          // Design System: green.medium (light) / green.primary (dark)
          "bg-[#006837] hover:bg-[#004225]",
          "dark:bg-[#2ECC71] dark:hover:bg-[#1E8449]",
          className
        )}
        {...props}
      >
        {children || "Novo Documento"}
      </Button>
    </CanCreate>
  )
}

/**
 * EditButton - Botão de editar com verificação de permissão
 */
function EditButton({
  user,
  category,
  onClick,
  children,
  className,
  size = "default",
  iconOnly = false,
  disabled,
  loading,
  ...props
}) {
  const content = iconOnly ? null : children || "Editar"

  return (
    <CanEdit user={user} category={category}>
      <Button
        variant="secondary"
        size={iconOnly ? "icon" : size}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        leftIcon={iconOnly ? null : <Pencil className="h-4 w-4" />}
        className={cn(
          // Design System: status.info (light) / status.info (dark)
          "border-[#007AFF] text-[#007AFF] hover:bg-[#007AFF]/10",
          "dark:border-[#3498DB] dark:text-[#3498DB] dark:hover:bg-[#3498DB]/15",
          className
        )}
        aria-label={iconOnly ? "Editar" : undefined}
        {...props}
      >
        {iconOnly ? <Pencil className="h-4 w-4" /> : content}
      </Button>
    </CanEdit>
  )
}

/**
 * DeleteButton - Botão de deletar com verificação de permissão
 */
function DeleteButton({
  user,
  category,
  onClick,
  children,
  className,
  size = "default",
  iconOnly = false,
  disabled,
  loading,
  confirmMessage = "Tem certeza que deseja excluir?",
  ...props
}) {
  const handleClick = React.useCallback(
    (e) => {
      if (confirmMessage && !window.confirm(confirmMessage)) {
        e.preventDefault()
        return
      }
      onClick?.(e)
    },
    [onClick, confirmMessage]
  )

  const content = iconOnly ? null : children || "Excluir"

  return (
    <CanDelete user={user} category={category}>
      <Button
        variant="destructive"
        size={iconOnly ? "icon" : size}
        onClick={handleClick}
        disabled={disabled}
        loading={loading}
        leftIcon={iconOnly ? null : <Trash2 className="h-4 w-4" />}
        className={className}
        aria-label={iconOnly ? "Excluir" : undefined}
        {...props}
      >
        {iconOnly ? <Trash2 className="h-4 w-4" /> : content}
      </Button>
    </CanDelete>
  )
}

/**
 * UploadButton - Botão de upload de documento
 */
function UploadButton({
  user,
  category,
  onClick,
  children,
  className,
  size = "default",
  accept,
  multiple = false,
  disabled,
  loading,
  onFileSelect,
  ...props
}) {
  const inputRef = React.useRef(null)

  const handleClick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileChange = React.useCallback(
    (e) => {
      const files = e.target.files
      if (files && files.length > 0) {
        onFileSelect?.(multiple ? Array.from(files) : files[0])
      }
      // Reset input para permitir selecionar o mesmo arquivo novamente
      e.target.value = ""
    },
    [onFileSelect, multiple]
  )

  return (
    <CanCreate user={user} category={category}>
      <Button
        variant="secondary"
        size={size}
        onClick={onClick || handleClick}
        disabled={disabled}
        loading={loading}
        leftIcon={<Upload className="h-4 w-4" />}
        className={cn(
          // Design System: green.medium (light) / green.primary (dark)
          "border-[#006837] text-[#006837] hover:bg-[#006837]/10",
          "dark:border-[#2ECC71] dark:text-[#2ECC71] dark:hover:bg-[#2ECC71]/15",
          className
        )}
        {...props}
      >
        {children || "Upload"}
      </Button>
      {onFileSelect && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      )}
    </CanCreate>
  )
}

/**
 * SettingsButton - Botão de configurações (apenas admins)
 */
function SettingsButton({
  user,
  onClick,
  children,
  className,
  size = "default",
  iconOnly = false,
  disabled,
  loading,
  ...props
}) {
  const content = iconOnly ? null : children || "Configurações"

  return (
    <AdminOnly user={user}>
      <Button
        variant="ghost"
        size={iconOnly ? "icon" : size}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        leftIcon={iconOnly ? null : <Settings className="h-4 w-4" />}
        className={cn(
          "text-muted-foreground hover:text-foreground",
          className
        )}
        aria-label={iconOnly ? "Configurações" : undefined}
        {...props}
      >
        {iconOnly ? <Settings className="h-4 w-4" /> : content}
      </Button>
    </AdminOnly>
  )
}

/**
 * AddUserButton - Botão de adicionar usuário (apenas admins)
 */
function AddUserButton({
  user,
  onClick,
  children,
  className,
  size = "default",
  disabled,
  loading,
  ...props
}) {
  return (
    <AdminOnly user={user}>
      <Button
        variant="default"
        size={size}
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        leftIcon={<UserPlus className="h-4 w-4" />}
        className={cn(
          // Design System: status.info (light) / status.info (dark)
          "bg-[#007AFF] hover:bg-[#0056B3]",
          "dark:bg-[#3498DB] dark:hover:bg-[#2980B9]",
          className
        )}
        {...props}
      >
        {children || "Novo Usuário"}
      </Button>
    </AdminOnly>
  )
}

/**
 * AdminActionBar - Barra de ações administrativas
 * Mostra conjunto de botões admin em uma barra organizada
 */
function AdminActionBar({
  user,
  onAdd,
  onEdit,
  onDelete,
  category,
  children,
  className,
  addLabel,
  editLabel,
  deleteLabel,
  showAdd = true,
  showEdit = true,
  showDelete = true,
}) {
  // Se não for admin, não mostra nada
  if (!isAdministrator(user)) {
    return null
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg",
        className
      )}
    >
      {showAdd && onAdd && (
        <AddDocumentButton
          user={user}
          category={category}
          onClick={onAdd}
          size="sm"
        >
          {addLabel}
        </AddDocumentButton>
      )}

      {showEdit && onEdit && (
        <EditButton user={user} category={category} onClick={onEdit} size="sm">
          {editLabel}
        </EditButton>
      )}

      {showDelete && onDelete && (
        <DeleteButton
          user={user}
          category={category}
          onClick={onDelete}
          size="sm"
        >
          {deleteLabel}
        </DeleteButton>
      )}

      {children}
    </div>
  )
}

export {
  AddButton,
  AddDocumentButton,
  EditButton,
  DeleteButton,
  UploadButton,
  SettingsButton,
  AddUserButton,
  AdminActionBar,
}
