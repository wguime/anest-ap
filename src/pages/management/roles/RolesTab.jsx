/**
 * RolesTab Component
 *
 * Manages role permission templates in the Centro de Gestao.
 * Admin can define default permissions per role; saving propagates to all users with that role.
 * Uses the same accordion dropdown system as PermissionsModal for section/card toggles.
 *
 * @module management/roles/RolesTab
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Button,
  Switch,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/design-system';
import { Save, Users, Briefcase } from 'lucide-react';
import { ROLES } from '@/utils/userTypes';
import { NAV_STRUCTURE } from '@/data/rolePermissionTemplates';

/**
 * PermissionCard — identical style to PermissionsModal's PermissionCard
 */
function PermissionCard({ card, enabled, onToggle }) {
  const Icon = card.icon;
  return (
    <div
      className={`rounded-xl border transition-colors ${
        enabled
          ? 'bg-background dark:bg-muted border-primary/30'
          : 'bg-[#F3F4F6] dark:bg-[#1A1F1C] border-[#E5E7EB] dark:border-border'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              enabled
                ? 'bg-primary/10 dark:bg-primary/20'
                : 'bg-[#9CA3AF]/10 dark:bg-[#6B8178]/20'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                enabled
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            />
          </div>
          <span
            className={`text-sm font-medium ${
              enabled
                ? 'text-black dark:text-white'
                : 'text-muted-foreground'
            }`}
          >
            {card.label}
          </span>
        </div>
        <Switch checked={enabled} onChange={onToggle} size="sm" />
      </div>
    </div>
  );
}

/**
 * RolesTab
 *
 * @param {Object} props
 * @param {Object} props.roleTemplates - Current templates { [roleId]: { [cardId]: boolean } }
 * @param {Array} props.users - All users array (to count per role)
 * @param {Function} props.onSaveRoleTemplate - (roleId, cardPermissions) => Promise
 */
function RolesTab({ roleTemplates = {}, users = [], onSaveRoleTemplate }) {
  // Local edits per role — tracks unsaved changes
  const [localEdits, setLocalEdits] = useState({});
  const [savingRole, setSavingRole] = useState(null);

  // Count users per role
  const userCountByRole = useMemo(() => {
    const counts = {};
    ROLES.forEach((r) => { counts[r.id] = 0; });
    users.forEach((u) => {
      const role = u.role;
      if (counts[role] !== undefined) {
        counts[role]++;
      }
    });
    return counts;
  }, [users]);

  // Get effective permissions for a role (local edits override saved templates)
  const getEffectivePermissions = useCallback((roleId) => {
    if (localEdits[roleId]) return localEdits[roleId];
    if (roleTemplates[roleId]) return { ...roleTemplates[roleId] };
    // Fallback: all enabled
    const all = {};
    Object.values(NAV_STRUCTURE).forEach((section) => {
      section.cards.forEach((card) => { all[card.id] = true; });
    });
    return all;
  }, [localEdits, roleTemplates]);

  // Toggle a card for a specific role
  const handleCardToggle = useCallback((roleId, cardId, enabled) => {
    setLocalEdits((prev) => {
      const current = prev[roleId] || { ...(roleTemplates[roleId] || {}) };
      return {
        ...prev,
        [roleId]: { ...current, [cardId]: enabled },
      };
    });
  }, [roleTemplates]);

  // Save role template
  const handleSave = useCallback(async (roleId) => {
    const perms = getEffectivePermissions(roleId);
    setSavingRole(roleId);
    try {
      await onSaveRoleTemplate?.(roleId, perms);
      // Clear local edits after successful save
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[roleId];
        return next;
      });
    } finally {
      setSavingRole(null);
    }
  }, [getEffectivePermissions, onSaveRoleTemplate]);

  // Check if a role has unsaved changes
  const hasUnsavedChanges = useCallback((roleId) => {
    return !!localEdits[roleId];
  }, [localEdits]);

  // Count enabled cards for a role (per-section counts)
  const getSectionEnabledCount = useCallback((roleId, sectionCards) => {
    const perms = getEffectivePermissions(roleId);
    const total = sectionCards.length;
    const enabled = sectionCards.filter((c) => perms[c.id]).length;
    return { enabled, total };
  }, [getEffectivePermissions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">
              Cargos e Permissoes
            </h2>
            <p className="text-sm text-muted-foreground">
              Defina as permissoes padrao de cada cargo
            </p>
          </div>
        </div>
      </div>

      {/* Roles Accordion */}
      <Accordion type="single" collapsible className="space-y-3">
        {ROLES.map((role) => {
          const rolePerms = getEffectivePermissions(role.id);
          const count = userCountByRole[role.id] || 0;
          const unsaved = hasUnsavedChanges(role.id);
          const isSaving = savingRole === role.id;

          return (
            <AccordionItem
              key={role.id}
              value={role.id}
              className="border border-[#E5E7EB] dark:border-border rounded-xl overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline bg-card">
                <div className="flex items-center justify-between flex-1 mr-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: role.color }}
                    >
                      {role.name}
                    </span>
                    {unsaved && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        Nao salvo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-xs">
                      {count} usuario{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="bg-card">
                <div className="px-4 pb-4 space-y-4">
                  {/* Section header */}
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Permissoes por Secao
                  </h4>

                  {/* Nested accordion — same style as PermissionsModal */}
                  <Accordion type="multiple" className="space-y-3">
                    {Object.entries(NAV_STRUCTURE).map(([sectionKey, section]) => {
                      const SectionIcon = section.icon;
                      const sectionHasPermissions = section.cards.some(
                        (card) => rolePerms[card.id]
                      );
                      const { enabled, total } = getSectionEnabledCount(role.id, section.cards);

                      return (
                        <AccordionItem
                          key={sectionKey}
                          value={sectionKey}
                          className="border border-[#E5E7EB] dark:border-border rounded-xl overflow-hidden"
                        >
                          <AccordionTrigger
                            className={`px-4 py-3 hover:no-underline ${
                              sectionHasPermissions
                                ? 'bg-background dark:bg-muted'
                                : 'bg-[#F3F4F6] dark:bg-[#1A1F1C]'
                            }`}
                          >
                            <div className="flex items-center justify-between flex-1 mr-2">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    sectionHasPermissions
                                      ? 'bg-primary/10 dark:bg-primary/20'
                                      : 'bg-[#9CA3AF]/10 dark:bg-[#6B8178]/20'
                                  }`}
                                >
                                  <SectionIcon
                                    className={`w-4 h-4 ${
                                      sectionHasPermissions
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                    }`}
                                  />
                                </div>
                                <span
                                  className={`font-medium ${
                                    sectionHasPermissions
                                      ? 'text-black dark:text-white'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {section.label}
                                </span>
                              </div>
                              {sectionHasPermissions ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 dark:bg-primary/20 text-primary">
                                  {enabled === total ? 'Ativo' : `${enabled}/${total}`}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#9CA3AF]/10 dark:bg-[#6B8178]/20 text-muted-foreground">
                                  Inativo
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-3 bg-card">
                            <div className="space-y-2">
                              {section.cards.map((card) => (
                                <PermissionCard
                                  key={card.id}
                                  card={card}
                                  enabled={rolePerms[card.id] ?? true}
                                  onToggle={(v) => handleCardToggle(role.id, card.id, v)}
                                />
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>

                  {/* Save button */}
                  <div className="pt-3 border-t border-[#E5E7EB] dark:border-border">
                    <Button
                      onClick={() => handleSave(role.id)}
                      disabled={isSaving}
                      className="w-full sm:w-auto bg-primary hover:bg-primary dark:hover:bg-[#27AE60] dark:text-foreground text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving
                        ? 'Salvando...'
                        : `Salvar permissoes de ${role.name}`}
                    </Button>
                    {unsaved && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Alteracoes nao salvas. Ao salvar, {count} usuario{count !== 1 ? 's' : ''} serao atualizados.
                      </p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export default RolesTab;
