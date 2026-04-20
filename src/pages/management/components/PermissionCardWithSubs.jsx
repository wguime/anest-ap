/**
 * PermissionCardWithSubs
 *
 * Shared component used by PermissionsModal (per-user) and RolesTab (per-role
 * templates) to render an icon (Level 2) that may contain sub-icons (Level 3).
 *
 * Behavior:
 * - Header row acts as parent toggle with expand/collapse chevron.
 * - Sub-icons appear indented with a left connector line.
 * - When parent OFF, the sub-area is visually cascaded (opacity-40, inert)
 *   and a "Bloqueado pelo icone pai" badge is shown.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/design-system';
import { ChevronRight, Lock } from 'lucide-react';

/**
 * @param {Object}   props
 * @param {Object}   props.card           — { id, label, icon, subCards: [{id, label}] }
 * @param {boolean}  props.enabled        — parent state
 * @param {Object}   props.permissions    — dictionary { [id]: boolean|undefined }
 * @param {Function} props.onToggle       — (value) => void (parent)
 * @param {Function} props.onSubToggle    — (subId, value) => void
 * @param {boolean}  [props.defaultOpen]  — expand by default
 */
export default function PermissionCardWithSubs({
  card,
  enabled,
  permissions,
  onToggle,
  onSubToggle,
  defaultOpen = false,
}) {
  const Icon = card.icon;
  const [expanded, setExpanded] = useState(defaultOpen);
  const activeSubCount = card.subCards.filter((s) => permissions[s.id] !== false).length;
  const totalSubs = card.subCards.length;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        enabled
          ? 'bg-background dark:bg-muted border-primary/30'
          : 'bg-[#F3F4F6] dark:bg-[#1A1F1C] border-[#E5E7EB] dark:border-border'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Recolher' : 'Expandir'} sub-itens de ${card.label}`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              enabled
                ? 'bg-primary/10 dark:bg-primary/20'
                : 'bg-[#9CA3AF]/10 dark:bg-[#6B8178]/20'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                enabled ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className={`block text-sm font-medium truncate ${
                enabled ? 'text-black dark:text-white' : 'text-muted-foreground'
              }`}
            >
              {card.label}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {activeSubCount}/{totalSubs} sub-itens ativos
            </span>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </button>
        <Switch checked={enabled} onChange={onToggle} size="sm" />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className={`relative pl-6 pr-2 pb-3 pt-1 ${
                !enabled ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <div
                aria-hidden="true"
                className="absolute left-[18px] top-0 bottom-2 w-[2px] bg-primary/30 rounded-full"
              />
              {!enabled && (
                <div className="mb-2 ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  Bloqueado pelo ícone pai
                </div>
              )}
              <ul className="space-y-1.5">
                {card.subCards.map((sub, i) => {
                  const subEnabled = permissions[sub.id] !== false;
                  return (
                    <motion.li
                      key={sub.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: i * 0.03 }}
                      className={`flex items-center justify-between gap-2 pl-3 pr-2 py-1.5 rounded-lg border-l-2 ml-1 ${
                        subEnabled
                          ? 'bg-muted/50 border-primary/40'
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            subEnabled ? 'bg-primary' : 'bg-muted-foreground/40'
                          }`}
                        />
                        <span
                          className={`text-[13px] truncate ${
                            subEnabled
                              ? 'text-black dark:text-white'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {sub.label}
                        </span>
                      </div>
                      <Switch
                        checked={subEnabled}
                        onChange={(v) => onSubToggle(sub.id, v)}
                        size="sm"
                      />
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
