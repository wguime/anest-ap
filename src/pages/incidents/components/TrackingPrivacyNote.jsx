import { Lock } from 'lucide-react';

/**
 * Nota de privacidade/LGPD
 * Texto do rodapé sempre em cinza (não usar cor do tema)
 */
export function TrackingPrivacyNote({ isAnonymous, footerContact }) {
  return (
    <div className="space-y-4">
      {/* Nota de privacidade */}
      <div className="p-4 rounded-xl bg-[#F3F4F6] dark:bg-[#0D1F17]">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Sua privacidade está protegida
            </p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
              Todas as informações são tratadas com sigilo absoluto conforme a LGPD.
              {isAnonymous && ' Sua identidade permanece anônima.'}
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé informativo - SEMPRE cinza */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
          {footerContact}
        </p>
      </div>
    </div>
  );
}
