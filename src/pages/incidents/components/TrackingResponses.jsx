import { MessageSquare, User } from 'lucide-react';
import { formatDate } from '../trackingConfig';

/**
 * Item individual de resposta
 */
function ResponseItem({ resposta, defaultResponder, accentColor }) {
  return (
    <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1F17] border border-[#E5E7EB] dark:border-[#2D4A3E]">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: accentColor }}
        >
          <User className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-[#111827] dark:text-white">
          {resposta.responderName || defaultResponder}
        </span>
        <span className="text-xs text-[#6B7280] dark:text-[#6B8178]">
          {formatDate(resposta.createdAt, true)}
        </span>
      </div>
      <p className="text-sm text-[#6B7280] dark:text-[#6B8178] pl-8">
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
      <MessageSquare className="w-8 h-8 text-[#9CA3AF] dark:text-[#4B5E55] mx-auto mb-2" />
      <p className="text-sm text-[#6B7280] dark:text-[#6B8178]">
        Nenhuma atualização ainda
      </p>
      <p className="text-xs text-[#9CA3AF] dark:text-[#4B5E55] mt-1">
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
    <div className="bg-white dark:bg-[#1A2F23] rounded-2xl p-4 border border-[#E5E7EB] dark:border-[#2D4A3E] mb-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-semibold text-[#111827] dark:text-white">
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
