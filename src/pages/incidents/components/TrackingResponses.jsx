import { MessageSquare, User } from 'lucide-react';
import { formatDate } from '../trackingConfig';

/**
 * Item individual de resposta
 */
function ResponseItem({ resposta, defaultResponder, accentColor }) {
  return (
    <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1F17] border border-[#E5E7EB] dark:border-border">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: accentColor }}
        >
          <User className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-foreground">
          {resposta.responderName || defaultResponder}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(resposta.createdAt, true)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground pl-8">
        {resposta.content}
      </p>
    </div>
  );
}

/**
 * Estado vazio quando não há respostas
 */
function EmptyResponses() {
  return (
    <div className="text-center py-6">
      <MessageSquare className="w-8 h-8 text-muted-foreground dark:text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">
        Nenhuma atualização ainda
      </p>
      <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
        Você será notificado quando houver novidades
      </p>
    </div>
  );
}

/**
 * Seção de respostas/atualizações da equipe
 */
export function TrackingResponses({ respostas, defaultResponder, accentColor }) {
  // Filtrar apenas respostas públicas (não internas)
  const respostasPublicas = respostas?.filter((r) => !r.isInternal) || [];

  return (
    <div className="bg-white dark:bg-muted rounded-2xl p-4 border border-[#E5E7EB] dark:border-border mb-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-semibold text-foreground">
          Atualizações
        </h3>
      </div>
      {respostasPublicas.length === 0 ? (
        <EmptyResponses />
      ) : (
        <div className="space-y-4">
          {respostasPublicas.map((resposta, index) => (
            <ResponseItem
              key={resposta.id || index}
              resposta={resposta}
              defaultResponder={defaultResponder}
              accentColor={accentColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
