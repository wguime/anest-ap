import React, { useState, useMemo } from 'react';
import { Card, CardContent, Button, SearchBar } from '@/design-system';
import { useToast } from '@/design-system';
import { Mail, Plus, Trash2, Copy } from 'lucide-react';

/**
 * EmailsTab - Manages the list of authorized emails that can create accounts.
 *
 * @param {Object} props
 * @param {Array<{ email: string, addedAt: string, addedBy: string }>} props.authorizedEmails - List of authorized emails
 * @param {(email: string) => void} props.onRemoveEmail - Callback when removing an email
 * @param {() => void} props.onAddEmail - Callback when adding a new email
 */
function EmailsTab({ authorizedEmails = [], onRemoveEmail, onAddEmail, searchQuery = '', onSearchChange, connectionStatus }) {
  const [emailToRemove, setEmailToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(null);
  const { toast } = useToast();

  const filtered = useMemo(() =>
    authorizedEmails.filter(e => !searchQuery || e.email?.toLowerCase().includes(searchQuery.toLowerCase())),
    [authorizedEmails, searchQuery]
  );

  // Handle copy to clipboard
  const handleCopyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
    }
  };

  // Handle confirm removal
  const handleConfirmRemove = async () => {
    if (!emailToRemove || !onRemoveEmail) return;
    setIsRemoving(true);
    try {
      await onRemoveEmail(emailToRemove);
    } catch (error) {
      console.error('Failed to remove email:', error);
      toast({ title: 'Erro ao remover email', variant: 'destructive' });
    } finally {
      setIsRemoving(false);
      setEmailToRemove(null);
    }
  };

  // Handle cancel removal
  const handleCancelRemove = () => {
    setEmailToRemove(null);
  };

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Connection status badge */}
      {connectionStatus && connectionStatus !== 'connected' && (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#FEF3C7] dark:bg-[#422006] text-[#92400E] dark:text-[#FCD34D] w-fit">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionStatus === 'reconnecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          {connectionStatus === 'reconnecting' ? 'Reconectando...' : 'Desconectado'}
        </div>
      )}
      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#D1FAE5] dark:bg-[#064E3B] text-[#065F46] dark:text-[#6EE7B7] w-fit">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Conectado
        </div>
      )}

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChange={(val) => onSearchChange?.(typeof val === 'string' ? val : val?.target?.value || '')}
        placeholder="Buscar email..."
      />

      {/* Header with counter */}
      <p className="text-sm text-[#6B7280] dark:text-[#A3B8B0] mb-4">
        {filtered.length === authorizedEmails.length
          ? `Emails autorizados a criar conta (${authorizedEmails.length})`
          : `${filtered.length} de ${authorizedEmails.length} emails autorizados`}
      </p>

      {/* Email list */}
      <div className="space-y-3 mb-5">
        {filtered.length === 0 ? (
          <Card variant="default" className="border-[#C8E6C9] dark:border-[#2A3F36]">
            <CardContent className="p-6 text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 text-[#9CA3AF] dark:text-[#6B8178]" />
              <p className="text-[#6B7280] dark:text-[#A3B8B0]">
                Nenhum email autorizado cadastrado.
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={`${item.email}-${idx}`}
              className="rounded-xl border border-[#C8E6C9] dark:border-[#2A3F36] bg-white dark:bg-[#1A2420] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Email info */}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-black dark:text-white text-sm mb-1">
                    {item.email}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[#9CA3AF] dark:text-[#6B8178]">
                      Adicionado em {item.addedAt} por {item.addedBy}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyEmail(item.email)}
                      className="p-1 rounded hover:bg-[#E8F5E9] dark:hover:bg-[#2A3F36] transition-colors"
                      title="Copiar email"
                      aria-label={`Copiar email ${item.email}`}
                    >
                      <Copy
                        className={`w-3.5 h-3.5 ${
                          copiedEmail === item.email
                            ? 'text-[#2ECC71]'
                            : 'text-[#9CA3AF] dark:text-[#6B8178]'
                        }`}
                      />
                    </button>
                    {copiedEmail === item.email && (
                      <span className="text-xs text-[#2ECC71]">Copiado!</span>
                    )}
                  </div>
                </div>

                {/* Remove button */}
                <Button
                  size="sm"
                  variant="destructive"
                  className="shrink-0"
                  onClick={() => setEmailToRemove(item.email)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Email button */}
      <Button
        variant="default"
        className="w-full bg-[#006837] hover:bg-[#005530]"
        onClick={onAddEmail}
      >
        <Mail className="w-4 h-4 mr-1" />
        Adicionar Email
      </Button>

      {/* Confirmation Modal for removal */}
      {emailToRemove && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4 border-[#C8E6C9] dark:border-[#2A3F36]">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                Confirmar Remocao
              </h3>
              <p className="text-[#6B7280] dark:text-[#A3B8B0] mb-4">
                Tem certeza que deseja remover o email{' '}
                <span className="font-medium text-black dark:text-white">
                  {emailToRemove}
                </span>{' '}
                da lista de emails autorizados?
              </p>
              <p className="text-xs text-[#DC2626] mb-4">
                Esta acao nao podera ser desfeita.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={handleCancelRemove}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmRemove}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default EmailsTab;
