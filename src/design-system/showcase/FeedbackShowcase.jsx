import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react"

import { useTheme } from "../hooks/useTheme.jsx"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card } from "../components/ui/card"

import { useToast } from "../components/ui/toast"
import { Modal } from "../components/ui/modal"
import { Alert } from "../components/ui/alert"
import { Progress } from "../components/ui/progress"
import { Spinner } from "../components/ui/spinner"
import {
  EmptyDocuments,
  EmptyList,
  EmptyNotifications,
  EmptySearch,
} from "../components/ui/empty-state"
import { ConfirmDialog } from "../components/ui/confirm-dialog"

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme()
  return (
    <div className="mb-8 md:mb-12 w-full">
      <div className="mb-4">
        <div
          className="text-[18px] font-bold"
          style={{ color: isDark ? "#FFFFFF" : "#000000" }}
        >
          {title}
        </div>
        {description ? (
          <div
            className="mt-1 text-[14px]"
            style={{ color: isDark ? "#A3B8B0" : "#6B7280" }}
          >
            {description}
          </div>
        ) : null}
      </div>
      <div
        className="rounded-xl md:rounded-2xl w-full p-4 md:p-6"
        style={{
          background: isDark ? "#1A2420" : "#E8F5E9",
          border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
          overflow: "visible",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function ToastSection() {
  const { toast, dismissAll } = useToast()

  return (
    <ShowcaseSection
      title="🔔 Toast"
      description="Notificações empilhadas (top-right), com variants, action e duration"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="success"
          onClick={() =>
            toast({
              variant: "success",
              title: "Sucesso",
              description: "Operação concluída com sucesso.",
            })
          }
        >
          Success
        </Button>
        <Button
          variant="warning"
          onClick={() =>
            toast({
              variant: "warning",
              title: "Atenção",
              description: "Verifique os dados antes de prosseguir.",
            })
          }
        >
          Warning
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            toast({
              variant: "error",
              title: "Erro",
              description: "Algo deu errado. Tente novamente.",
            })
          }
        >
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast({
              variant: "info",
              title: "Info",
              description: "Atualização disponível.",
            })
          }
        >
          Info
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              variant: "default",
              title: "Padrão",
              description: "Notificação padrão.",
            })
          }
        >
          Default
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() =>
            toast({
              variant: "info",
              title: "Com ação",
              description: "Clique no botão para executar uma ação.",
              action: { label: "Desfazer", onClick: () => alert("Desfeito!") },
            })
          }
        >
          Toast com action
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast({
              variant: "warning",
              title: "Permanente",
              description: "Este toast não fecha sozinho.",
              duration: 0,
            })
          }
        >
          Duration infinita
        </Button>
        <Button variant="ghost" onClick={dismissAll}>
          Dismiss all
        </Button>
      </div>
    </ShowcaseSection>
  )
}

function ModalSection() {
  const [open, setOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(null)

  const sizes = useMemo(() => ["sm", "md", "lg", "xl"], [])

  return (
    <ShowcaseSection
      title="🪟 Modal"
      description="Dialog com portal, overlay, animação e focus trap"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>Abrir modal simples</Button>
        <Button variant="outline" onClick={() => setFormOpen(true)}>
          Abrir modal com form
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {sizes.map((s) => (
          <Button key={s} variant="secondary" onClick={() => setSizeOpen(s)}>
            Size {s}
          </Button>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Modal simples"
        description="Exemplo com footer e fechamento por overlay/Escape."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => alert("Ação confirmada!")}>Confirmar</Button>
          </>
        }
      >
        <Modal.Body>
          <div className="text-sm text-muted-foreground">
            Conteúdo do modal. Use Tab para ver o focus trap.
          </div>
        </Modal.Body>
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Editar dados"
        description="Exemplo com inputs para validar navegação por teclado."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setFormOpen(false)}>Salvar</Button>
          </>
        }
      >
        <Modal.Body>
          <div className="grid gap-4">
            <Input label="Nome" placeholder="Seu nome" />
            <Input label="Email" type="email" placeholder="nome@exemplo.com" />
          </div>
        </Modal.Body>
      </Modal>

      {sizes.map((s) => (
        <Modal
          key={s}
          open={sizeOpen === s}
          onClose={() => setSizeOpen(null)}
          size={s}
          title={`Modal size ${s}`}
          description="Teste de tamanhos."
          footer={
            <Button variant="outline" onClick={() => setSizeOpen(null)}>
              Fechar
            </Button>
          }
        >
          <Modal.Body>
            <Card className="p-4">
              Conteúdo exemplo para {s}. Lorem ipsum dolor sit amet.
            </Card>
          </Modal.Body>
        </Modal>
      ))}
    </ShowcaseSection>
  )
}

function AlertSection() {
  const [showDismiss, setShowDismiss] = useState(true)
  return (
    <ShowcaseSection
      title="📣 Alert"
      description="Alert inline com variants, dismiss e action"
    >
      <div className="grid gap-3">
        <Alert variant="success" title="Sucesso">
          Tudo certo!
        </Alert>
        <Alert variant="warning" title="Atenção">
          Verifique este ponto antes de seguir.
        </Alert>
        <Alert variant="error" title="Erro">
          Não foi possível concluir a operação.
        </Alert>
        <Alert variant="info" title="Informação">
          Uma atualização está disponível.
        </Alert>
        <Alert variant="default" title="Padrão">
          Mensagem padrão do sistema.
        </Alert>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {showDismiss ? (
          <Alert
            variant="warning"
            title="Dismissible"
            dismissible
            onDismiss={() => setShowDismiss(false)}
            action={{ label: "Entendi", onClick: () => setShowDismiss(false) }}
          >
            Você pode fechar este alerta ou executar uma ação.
          </Alert>
        ) : (
          <Alert variant="success" title="Fechado">
            O alerta foi dismissado.
          </Alert>
        )}

        <Alert
          variant="info"
          title="Com ícone custom"
          icon={<Info className="h-6 w-6" aria-hidden="true" />}
          action={{ label: "Saiba mais", onClick: () => alert("Mais info!") }}
        >
          Exemplo sobrescrevendo o ícone padrão.
        </Alert>
      </div>
    </ShowcaseSection>
  )
}

function ProgressSection() {
  const [value, setValue] = useState(45)
  return (
    <ShowcaseSection
      title="📈 Progress"
      description="Barra de progresso com variants, sizes e stripes"
    >
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full max-w-[260px]"
        />
        <div className="text-sm text-muted-foreground">{value}%</div>
      </div>

      <div className="mt-6 grid gap-4">
        <Progress label="Default" value={value} showValue />
        <Progress label="Success" variant="success" value={value} showValue />
        <Progress label="Warning" variant="warning" value={value} showValue />
        <Progress label="Error" variant="error" value={value} showValue />
        <Progress
          label="Striped (animated)"
          variant="info"
          value={value}
          striped
          animated
          showValue
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Progress label="SM" size="sm" value={value} />
          <Progress label="MD" size="md" value={value} />
          <Progress label="LG" size="lg" value={value} />
        </div>
      </div>
    </ShowcaseSection>
  )
}

function SpinnerSection() {
  const sizes = ["xs", "sm", "md", "lg", "xl"]
  return (
    <ShowcaseSection
      title="⏳ Spinner"
      description="Spinner ring + dots, com label e tamanhos"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-wrap items-center gap-4">
          {sizes.map((s) => (
            <Spinner key={s} size={s} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {sizes.map((s) => (
            <Spinner key={s} size={s} type="dots" />
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6">
        <Spinner size="md" label="Carregando" />
        <Spinner size="md" type="dots" label="Buscando" />
        <div className="inline-flex items-center gap-2 rounded-xl bg-[#004225] p-3 dark:bg-[#145A32]">
          <Spinner size="md" variant="white" label="White" />
        </div>
      </div>
    </ShowcaseSection>
  )
}

function EmptyStateSection() {
  return (
    <ShowcaseSection
      title="🫙 Empty State"
      description="Estados vazios com presets e ações"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <EmptySearch
            description="Tente ajustar os filtros ou alterar o termo de busca."
            action={{ label: "Limpar filtros", onClick: () => alert("OK") }}
            secondaryAction={{
              label: "Ajuda",
              onClick: () => alert("Ajuda"),
            }}
            size="sm"
          />
        </Card>
        <Card className="p-4">
          <EmptyList
            description="Crie seu primeiro item para começar."
            action={{ label: "Criar item", onClick: () => alert("Criar") }}
          />
        </Card>
        <Card className="p-4">
          <EmptyNotifications description="Você está em dia por aqui." />
        </Card>
        <Card className="p-4">
          <EmptyDocuments
            description="Nenhum documento foi encontrado nesta seção."
            action={{ label: "Adicionar", onClick: () => alert("Adicionar") }}
            size="lg"
          />
        </Card>
      </div>
    </ShowcaseSection>
  )
}

function ConfirmDialogSection() {
  const [open, setOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  return (
    <ShowcaseSection
      title="✅ Confirmation Dialog"
      description="Modal especializado para confirmação (default/danger)"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>Abrir confirmação</Button>
        <Button variant="destructive" onClick={() => setDangerOpen(true)}>
          Abrir danger
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          alert("Confirmado!")
          setOpen(false)
        }}
        title="Confirmar ação?"
        description="Esta ação pode ser desfeita."
        icon={<CheckCircle className="h-10 w-10" aria-hidden="true" />}
      />

      <ConfirmDialog
        open={dangerOpen}
        onClose={() => (loading ? null : setDangerOpen(false))}
        onConfirm={() => {
          setLoading(true)
          setTimeout(() => {
            setLoading(false)
            setDangerOpen(false)
            alert("Excluído!")
          }, 900)
        }}
        title="Excluir item?"
        description="Esta ação não pode ser desfeita."
        variant="danger"
        loading={loading}
        icon={<AlertTriangle className="h-10 w-10" aria-hidden="true" />}
        confirmText="Excluir"
      />
    </ShowcaseSection>
  )
}

export function FeedbackShowcase() {
  const { isDark } = useTheme()
  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: isDark ? "#111916" : "#F0FFF4",
        minHeight: "100vh",
        color: isDark ? "#FFFFFF" : "#000000",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
        💬 Feedback
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: isDark ? "#A3B8B0" : "#6B7280",
          marginBottom: "32px",
        }}
      >
        {isDark ? "Dark Mode" : "Light Mode"} - Componentes de feedback
      </p>

      <ToastSection />
      <ModalSection />
      <AlertSection />
      <ProgressSection />
      <SpinnerSection />
      <EmptyStateSection />
      <ConfirmDialogSection />
    </div>
  )
}

export default FeedbackShowcase


