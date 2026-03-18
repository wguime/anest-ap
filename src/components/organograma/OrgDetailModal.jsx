/**
 * OrgDetailModal - Modal de detalhes de um cargo do organograma
 * Renderiza como bottom sheet em mobile com layout organizado
 * Suporta múltiplos responsáveis e emails de contato
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  UserCog,
  Users,
  Briefcase,
  MessageSquare,
  Mail,
  User,
  FileText,
  Stethoscope,
  ClipboardList,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/design-system/components/ui/button';
import { Badge } from '@/design-system/components/ui/badge';
import { cn } from '@/design-system/utils/tokens';
import { getNodeHexColors } from './orgNodeColors';

// Mapeamento de icones por tipo
const ICON_MAP = {
  governance: Building2,
  executive: UserCog,
  technical: Stethoscope,
  admin: ClipboardList,
  committee: Users,
  operational: Briefcase,
  advisory: MessageSquare,
};

// Labels dos tipos
const TYPE_LABELS = {
  governance: 'Governanca',
  executive: 'Executivo',
  technical: 'Tecnico',
  admin: 'Administrativo',
  committee: 'Comite',
  operational: 'Operacional',
  advisory: 'Consultivo',
};

// Helper para converter para array
const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

/**
 * Modal de detalhes de um cargo do organograma
 * Comporta-se como bottom sheet em mobile
 *
 * @param {object} node - Dados do no selecionado
 * @param {boolean} open - Se o modal esta aberto
 * @param {function} onClose - Callback para fechar o modal
 */
export function OrgDetailModal({ node, open, onClose }) {
  // Prevenir scroll do body quando modal esta aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Fechar com ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!node) return null;

  const Icon = ICON_MAP[node.tipo] || Briefcase;
  const colors = getNodeHexColors(node.tipo, false);
  const typeLabel = TYPE_LABELS[node.tipo] || 'Cargo';

  // Converter para arrays para suportar múltiplos valores
  const responsaveis = toArray(node.responsavel);
  const contatos = toArray(node.contato);

  // Verifica se tem alguma informacao para mostrar
  const hasInfo = responsaveis.length > 0 || node.descricao || contatos.length > 0;
  const hasAdvisory = node.advisory && node.advisory.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[1100] bg-black/50"
            aria-hidden="true"
          />

          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-detail-title"
            className="
              fixed inset-x-0 bottom-0 z-[1100]
              max-h-[92vh] overflow-hidden
              bg-card
              rounded-t-3xl
              shadow-xl
              flex flex-col
            "
          >
            {/* Handle bar (drag indicator) */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 rounded-full bg-secondary dark:bg-[#3A4A42]" />
            </div>

            {/* Botao fechar no canto */}
            <button
              type="button"
              onClick={onClose}
              className="
                absolute top-4 right-4
                p-2 rounded-xl
                text-muted-foreground
                hover:bg-[#F3F4F6] dark:hover:bg-muted
                transition-colors
                z-10
              "
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content (scrollable) */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {/* Header centralizado com icone grande */}
              <div className="flex flex-col items-center text-center mb-6">
                {/* Icone grande */}
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Icon
                    className="w-10 h-10"
                    style={{ color: colors.accent }}
                  />
                </div>

                {/* Nome do cargo */}
                <h2
                  id="org-detail-title"
                  className="text-xl font-bold text-[#000000] dark:text-white mb-2"
                >
                  {node.cargo}
                </h2>

                {/* Badge do tipo */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.accent,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {typeLabel}
                </div>

                {node.tipo === 'advisory' && (
                  <p className="text-[12px] text-muted-foreground dark:text-muted-foreground mt-2">
                    Comite consultivo (conexao tracejada)
                  </p>
                )}
              </div>

              {/* Secoes de informacao */}
              <div className="space-y-4">
                {/* Card: Responsáveis */}
                {responsaveis.length > 0 && (
                  <div className="bg-[#F9FAFB] dark:bg-muted rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-muted dark:bg-[#1A3D2E] flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {responsaveis.length > 1 ? 'Responsaveis' : 'Responsavel'}
                      </span>
                    </div>
                    <div className="space-y-2 pl-10">
                      {responsaveis.map((resp, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <p className="text-[16px] font-semibold text-[#000000] dark:text-white">
                            {resp}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card: Descricao */}
                {node.descricao && (
                  <div className="bg-[#F9FAFB] dark:bg-muted rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#E3F2FD] dark:bg-[#1A237E] flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[#1565C0] dark:text-[#64B5F6]" />
                      </div>
                      <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Descricao
                      </span>
                    </div>
                    <p className="text-[15px] text-foreground dark:text-[#D1D5DB] pl-10 leading-relaxed">
                      {node.descricao}
                    </p>
                  </div>
                )}

                {/* Card: Contatos */}
                {contatos.length > 0 && (
                  <div className="bg-[#F9FAFB] dark:bg-muted rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FFF3E0] dark:bg-[#E65100]/20 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-warning dark:text-[#FFB74D]" />
                      </div>
                      <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {contatos.length > 1 ? 'Contatos' : 'Contato'}
                      </span>
                    </div>
                    <div className="space-y-3 pl-10">
                      {contatos.map((email, index) => (
                        <div key={index}>
                          <a
                            href={`mailto:${email}`}
                            className="
                              inline-flex items-center gap-2
                              px-4 py-2.5 rounded-xl
                              bg-primary
                              text-white dark:text-[#1A2420]
                              text-[14px] font-medium
                              hover:opacity-90 transition-opacity
                              shadow-sm
                            "
                          >
                            <Mail className="w-4 h-4" />
                            Enviar Email
                            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                          </a>
                          <p className="text-[13px] text-muted-foreground mt-1.5">
                            {email}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card: Comites consultivos vinculados */}
                {hasAdvisory && (
                  <div className="bg-[#F9FAFB] dark:bg-muted rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] dark:bg-[#424242] flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-muted-foreground dark:text-[#BDBDBD]" />
                      </div>
                      <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Comites Consultivos
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-10">
                      {node.advisory.map((adv) => (
                        <span
                          key={adv.id}
                          className="
                            inline-flex items-center gap-1.5
                            px-3 py-1.5 rounded-lg
                            border border-dashed border-[#9E9E9E] dark:border-[#616161]
                            text-[13px] text-[#616161] dark:text-[#BDBDBD]
                            bg-card
                          "
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {adv.cargo}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensagem quando nao ha informacoes */}
                {!hasInfo && !hasAdvisory && (
                  <div className="bg-[#F9FAFB] dark:bg-muted rounded-xl p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#E5E7EB] dark:bg-[#374151] flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-muted-foreground dark:text-muted-foreground" />
                    </div>
                    <p className="text-[14px] text-muted-foreground">
                      Nenhuma informacao adicional disponivel para este cargo.
                    </p>
                    <p className="text-[12px] text-muted-foreground dark:text-[#4B5563] mt-1">
                      Edite o cargo para adicionar detalhes.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E5E7EB] dark:border-border bg-card">
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full h-12 text-[15px]"
              >
                Fechar
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default OrgDetailModal;
