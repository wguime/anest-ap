import { cn } from '@/design-system/utils/tokens';
import PageHeader from './PageHeader';

/**
 * PageShell — shell canônico de página (Fase 1.6.2 do plano DS).
 *
 * Consolida o boilerplate repetido em ~180 páginas:
 *   <div className="min-h-dvh bg-background pb-24">
 *     <PageHeader title=... onBack=... />
 *     <div className="px-4 sm:px-5 py-4 space-y-4"> {children} </div>
 *   </div>
 *
 * Uso:
 *   <PageShell title="Eventos" onBack={goBack} actions={<Botão/>} contentClassName="py-4 space-y-4">
 *     {conteúdo}
 *   </PageShell>
 *
 * O header é renderizado via <PageHeader> (que já faz createPortal + spacer h-14
 * internamente). Passe `header={false}` para páginas sem header fixo.
 */

// Container horizontal — espelha o uso real das páginas (DNA rule #11/#12).
const containerClasses = {
  default: 'px-4 sm:px-5', //                         maioria das páginas
  lg: 'px-4 sm:px-5 lg:px-6 xl:px-8 max-w-3xl mx-auto', // páginas de conteúdo
  full: 'w-full', //                                  full-bleed (tabelas, mapas)
};

// Background da página (4 níveis de superfície — DNA rule #3).
const bgClasses = {
  background: 'bg-background',
  card: 'bg-card',
  muted: 'bg-muted',
};

// Padding-bottom canônico para o BottomNav (DNA rule #11: pb-24 é o padrão).
const pbClasses = {
  default: 'pb-24',
  tall: 'pb-28', //  HomePage / ComunicadosPage
  extra: 'pb-32', // páginas com FormActionBar fixo
  none: 'pb-0',
};

export default function PageShell({
  // Props do header (repassadas a <PageHeader>)
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  rightContent,
  header = true,
  // Layout do shell
  containerSize = 'default',
  background = 'background',
  pb = 'default',
  contentClassName,
  className,
  children,
}) {
  const showHeader =
    header && (title || subtitle || onBack || actions || rightContent);

  return (
    <div
      className={cn(
        'min-h-dvh',
        bgClasses[background] ?? bgClasses.background,
        pbClasses[pb] ?? pbClasses.default,
        className
      )}
    >
      {showHeader && (
        <PageHeader
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          backLabel={backLabel}
          actions={actions}
          rightContent={rightContent}
        />
      )}

      <div className={cn(containerClasses[containerSize] ?? containerClasses.default, contentClassName)}>
        {children}
      </div>
    </div>
  );
}
