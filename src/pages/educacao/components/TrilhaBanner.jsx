/**
 * TrilhaBanner.jsx
 * Componente para exibir o banner da trilha de forma persistente
 * Aparece em: Trilha, Treinamento, Módulo e Aula
 */

import { cn } from '@/design-system/utils/tokens';

/**
 * Temas de cores predefinidos para o banner
 */
const BANNER_THEMES = {
  primary: {
    gradient: 'from-primary/20 via-primary/10 to-transparent',
    textColor: 'text-primary-foreground',
    accentColor: 'text-primary',
  },
  secondary: {
    gradient: 'from-secondary/20 via-secondary/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-secondary',
  },
  success: {
    gradient: 'from-success/20 via-success/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-success',
  },
  warning: {
    gradient: 'from-warning/20 via-warning/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-warning',
  },
  info: {
    gradient: 'from-info/20 via-info/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-info',
  },
  purple: {
    gradient: 'from-purple-500/20 via-purple-500/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-purple-600 dark:text-purple-400',
  },
  blue: {
    gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    gradient: 'from-green-500/20 via-green-500/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-green-600 dark:text-green-400',
  },
  amber: {
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    textColor: 'text-foreground',
    accentColor: 'text-amber-600 dark:text-amber-400',
  },
};

/**
 * TrilhaBanner - Exibe banner da trilha com imagem/gradiente, título e subtítulo
 * 
 * @param {Object} props
 * @param {Object} props.trilha - Objeto da trilha com campo banner
 * @param {Object} props.banner - Banner direto (alternativa a trilha.banner)
 * @param {string} props.className - Classes adicionais
 * @param {boolean} props.compact - Modo compacto (menor altura)
 * @param {boolean} props.showBreadcrumb - Mostrar breadcrumb de navegação
 * @param {Array} props.breadcrumb - Array de { label, onClick } para breadcrumb
 */
export function TrilhaBanner({
  trilha,
  banner: bannerProp,
  className,
  compact = false,
  showBreadcrumb = false,
  breadcrumb = [],
}) {
  // Usar banner da prop ou do objeto trilha
  const banner = bannerProp || trilha?.banner;
  
  // Se não há banner definido, não renderizar
  if (!banner && !trilha?.titulo) {
    return null;
  }

  // Extrair configurações do banner
  const {
    asset,
    title,
    subtitle,
    theme = 'primary',
    gradient: customGradient,
  } = banner || {};

  // Usar título da trilha como fallback
  const displayTitle = title || trilha?.titulo;
  const displaySubtitle = subtitle || trilha?.descricao;

  // Obter configuração do tema
  const themeConfig = BANNER_THEMES[theme] || BANNER_THEMES.primary;

  // Determinar gradiente a usar
  const gradientClass = customGradient || themeConfig.gradient;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        compact ? "py-4 px-5" : "py-6 px-6",
        className
      )}
    >
      {/* Background: imagem ou gradiente */}
      {asset ? (
        <>
          <img
            src={asset}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </>
      ) : (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r",
          gradientClass
        )} />
      )}

      {/* Conteúdo */}
      <div className="relative z-10">
        {/* Breadcrumb */}
        {showBreadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            {breadcrumb.map((item, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && <span className="opacity-50">/</span>}
                {item.onClick ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="hover:text-foreground hover:underline transition-colors"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className={index === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Título e subtítulo */}
        <div className={cn(
          "flex flex-col gap-1",
          asset && "text-white"
        )}>
          {displayTitle && (
            <h1 className={cn(
              compact ? "text-lg font-semibold" : "text-xl sm:text-2xl font-bold",
              !asset && themeConfig.accentColor
            )}>
              {displayTitle}
            </h1>
          )}
          {displaySubtitle && (
            <p className={cn(
              "text-sm line-clamp-2",
              asset ? "text-white/80" : "text-muted-foreground"
            )}>
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * TrilhaBannerCompact - Versão compacta do banner para páginas internas
 */
export function TrilhaBannerCompact(props) {
  return <TrilhaBanner {...props} compact />;
}

export default TrilhaBanner;
