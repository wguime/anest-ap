import { useState, useEffect, useMemo, useCallback } from 'react'
import { useToast } from '@/design-system'
import { Download, Loader2, Search, X, UserPlus } from 'lucide-react'
import { ROLE_PERMISSION_TEMPLATES, getAllCardIds } from '@/data/rolePermissionTemplates'
import { getRoleName } from '@/utils/userTypes'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { supabase } from '@/config/supabase'
import { useResidencia } from '@/hooks/useResidencia'
import { useDocuments } from '@/hooks/useDocuments'
import { useDocumentsContext } from '@/contexts/DocumentsContext'
import { useIncidents } from '@/contexts/IncidentsContext'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { useUser } from '@/contexts/UserContext'
import { usePdfExport } from '@/hooks/usePdfExport'
import { useCentroGestaoDashboard } from '@/hooks/useCentroGestaoDashboard'
import { useEducacaoAdmin } from '@/hooks/useEducacaoAdmin'

// Import layout and sections
import ManagementLayout from './ManagementLayout'
import UsersTab from './users/UsersTab'
import EmailsTab from './emails/EmailsTab'
import AuditLogTab from './users/AuditLogTab'
import DocumentsLayout from './documents/DocumentsLayout'
import DashboardGestaoTab from './stats/DashboardGestaoTab'
import InfraStatusTab from './infra/InfraStatusTab'
import IncidentsLayout from './incidents/IncidentsLayout'
import ResidencyTab from './residency/ResidencyTab'
import EducacaoTab from './educacao/EducacaoTab'
import StaffTab from './staff/StaffTab'
import ComunicadosMonitorTab from './comunicados/ComunicadosMonitorTab'
import LgpdSolicitacoesTab from './lgpd/LgpdSolicitacoesTab'
import RolesTab from './roles/RolesTab'

// Import document section components
import {
  EticaSection,
  ComitesSection,
  AuditoriasSection,
  RelatoriosSection,
  BibliotecaSection,
  FinanceiroSection,
  MedicamentosSection,
  InfeccoesSection,
  DesastresSection,
} from './documents'

// Import document workflow components (cross-category)
import ApprovalQueue from './documents/ApprovalQueue'
import ReviewCalendar from './documents/ReviewCalendar'
import AuditTrailPage from './documents/AuditTrailPage'
import ComplianceDashboard from './documents/ComplianceDashboard'

// Import standalone pages for embedded rendering
import KpiDashboardOverview from '../kpi/KpiDashboardOverview'
import PlanosAcaoPage from '../planos-acao/PlanosAcaoPage'

// Import reusable components
import { PermissionsModal, NewDocumentModal } from './components'
import PdfExportModal from './components/PdfExportModal'

// Mock incidents e denuncias vêm do IncidentsContext (SSOT)
// Users, emails e responsáveis vêm do UsersManagementContext (SSOT)

/**
 * CentroGestaoPage - Main page component for the Centro de Gestao (Management Center)
 *
 * This is the main entry point that ties all management components together.
 * It manages navigation state between sections and sub-sections, and renders
 * the appropriate content based on the active section.
 *
 * Features:
 * - Uses ManagementLayout as the wrapper
 * - Manages navigation state between sections and sub-sections
 * - Renders the appropriate content based on active section
 * - Handles modals (PermissionsModal, AddEmailModal, etc.)
 * - Provides toast notifications
 *
 * @param {function} onNavigate - Callback for navigation (route, params) => void
 * @param {function} goBack - Callback for back button
 * @param {string} initialSection - Initial section to display (optional)
 * @param {string} initialSubSection - Initial sub-section to display (optional)
 */

/**
 * AddResponsibleModal - Inline modal to add a user as incident responsible.
 * Shows a searchable list of users not currently in incidentResponsibles.
 */
function AddResponsibleModal({ users, incidentResponsibles, onAdd, onClose }) {
  const [search, setSearch] = useState('')

  const responsibleIds = useMemo(
    () => new Set((incidentResponsibles || []).map((r) => r.id)),
    [incidentResponsibles]
  )

  const filteredUsers = useMemo(() => {
    if (!users) return []
    const available = users.filter((u) => !responsibleIds.has(u.id))
    if (!search.trim()) return available
    const q = search.toLowerCase()
    return available.filter(
      (u) =>
        (u.nome && u.nome.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    )
  }, [users, responsibleIds, search])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#1A2420] rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#C8E6C9] dark:border-[#2A3F36]">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            Adicionar Responsavel
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-gray-100 dark:hover:bg-[#2A3F36] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#C8E6C9] dark:border-[#2A3F36]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F3F4F6] dark:bg-[#243530] text-sm text-black dark:text-white placeholder-[#6B7280] border-none outline-none focus:ring-2 focus:ring-[#006837] dark:focus:ring-[#2ECC71]"
              autoFocus
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6B7280] dark:text-[#6B8178]">
              {search.trim()
                ? 'Nenhum usuario encontrado.'
                : 'Todos os usuarios ja sao responsaveis.'}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const initials = user.nome
                ? (() => {
                    const parts = user.nome.split(' ')
                    return parts.length >= 2
                      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
                      : parts[0].substring(0, 2).toUpperCase()
                  })()
                : '??'

              return (
                <button
                  key={user.id}
                  onClick={() => onAdd(user)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-[#243530] transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#006837] dark:bg-[#2ECC71] text-white dark:text-[#1A2420] text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black dark:text-white truncate">
                      {user.nome || 'Sem nome'}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#6B8178] truncate">
                      {user.email}
                    </p>
                  </div>
                  <UserPlus className="w-4 h-4 text-[#006837] dark:text-[#2ECC71] flex-shrink-0" />
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#C8E6C9] dark:border-[#2A3F36]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-gray-100 dark:hover:bg-[#2A3F36] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function CentroGestaoPage({
  onNavigate,
  goBack,
  initialSection = 'usuarios',
  initialSubSection = null,
}) {
  const { toast } = useToast()

  // PDF export
  const { exportPdf, exporting } = usePdfExport()
  const dashboardData = useCentroGestaoDashboard()

  // Documents hook (Single Source of Truth)
  const { documents: documentsByCategory, isLoading: documentsLoading } = useDocuments()
  const { archiveDocument } = useDocumentsContext()

  // Incidents hook (Single Source of Truth)
  const { incidentes: contextIncidentes, denuncias: contextDenuncias } = useIncidents()

  // Residency hook
  const {
    residentes,
    plantao,
    estagiosLoading,
    plantaoLoading,
    saveEstagios,
    savePlantao,
    canEdit: canEditResidency,
    connectionStatus: residenciaConnectionStatus,
  } = useResidencia()

  // ==========================================================================
  // NAVIGATION STATE
  // ==========================================================================

  // Main section state
  const [activeSection, setActiveSection] = useState(initialSection)

  // Educacao admin hook (lazy: only fetches when educacao tab is active)
  const educacaoAdminData = useEducacaoAdmin({ enabled: activeSection === 'educacao' })

  // Documents sub-navigation
  const [activeDocCategory, setActiveDocCategory] = useState('etica')
  const [activeDocSubTab, setActiveDocSubTab] = useState('documentos')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(null)

  // PDF export
  const [showPdfModal, setShowPdfModal] = useState(false)

  // Incidents sub-navigation
  const [activeIncidentsSubTab, setActiveIncidentsSubTab] = useState('responsaveis')
  const [incidentViewMode, setIncidentViewMode] = useState('incidentes')
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('todos')
  const [showAddResponsibleModal, setShowAddResponsibleModal] = useState(false)

  // ==========================================================================
  // DATA STATE (from UsersManagementContext SSOT)
  // ==========================================================================

  const {
    users,
    authorizedEmails,
    incidentResponsibles,
    roles,
    loading: usersLoading,
    addUser: contextAddUser,
    updateUser: contextUpdateUser,
    addAuthorizedEmail: contextAddEmail,
    removeAuthorizedEmail: contextRemoveEmail,
    emailsConnectionStatus,
    toggleResponsibleSetting: contextToggleResponsible,
    updateIncidentResponsible: contextUpdateIncidentResponsible,
    deleteUser: contextDeleteUser,
  } = useUsersManagement()

  const { firebaseUser } = useUser()

  // Role permission templates state — starts from static defaults,
  // then overridden by actual user data once loaded
  const [roleTemplates, setRoleTemplates] = useState(ROLE_PERMISSION_TEMPLATES)

  // Derive role templates from actual user data (not static all-true defaults)
  useEffect(() => {
    if (!users || users.length === 0) return
    const allTrue = getAllCardIds(true)
    const derived = {}
    const roleIds = Object.keys(ROLE_PERMISSION_TEMPLATES)

    for (const roleId of roleIds) {
      // Find a user with this role who follows the template (customPermissions !== true)
      const templateUser = users.find(
        u => u.role === roleId && !u.customPermissions &&
          u.permissions && typeof u.permissions === 'object' &&
          Object.keys(u.permissions).length > 1
      )
      if (templateUser) {
        // Base from all-true (so new cards default to enabled), overlay stored values
        derived[roleId] = { ...allTrue, ...templateUser.permissions }
      } else {
        // No template-following user found — keep static defaults
        derived[roleId] = { ...allTrue }
      }
    }

    console.debug('[CentroGestaoPage] Role templates derived from user data:', Object.fromEntries(
      Object.entries(derived).map(([role, perms]) => [
        role,
        Object.values(perms).filter(v => v === false).length + ' disabled',
      ])
    ))
    setRoleTemplates(derived)
  }, [users])

  const [editingUser, setEditingUser] = useState(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userFilterRole, setUserFilterRole] = useState('')
  const [emailSearchQuery, setEmailSearchQuery] = useState('')
  const [showAddEmailModal, setShowAddEmailModal] = useState(false)

  // Incidents and denuncias data - agora vem do IncidentsContext (SSOT)
  // Transformar dados do contexto para o formato esperado pelo IncidentsLayout
  // Mapeamento completo de status inglês → português para IncidentsLayout
  const mapStatusToPortugues = (status) => {
    const map = {
      'pending': 'pendente',
      'in_review': 'em_analise',
      'investigating': 'em_analise',
      'action_required': 'pendente',
      'resolved': 'resolvido',
      'closed': 'resolvido',
    };
    return map[status] || 'pendente';
  };

  const incidents = useMemo(() => {
    return contextIncidentes.map((inc) => ({
      id: inc.id,
      protocolo: inc.protocolo || '',
      titulo: inc.incidenteData?.descricao?.substring(0, 50) || 'Sem título',
      tipo: inc.incidenteData?.tipo || 'outro',
      status: mapStatusToPortugues(inc.status),
      statusOriginal: inc.status,
      data: inc.createdAt?.split('T')[0] || inc.incidenteData?.dataOcorrencia,
      createdAt: inc.createdAt,
      rca: inc.adminData?.rca || null,
      historicoStatus: inc.adminData?.historicoStatus || [],
    }))
  }, [contextIncidentes])

  const denuncias = useMemo(() => {
    return contextDenuncias.map((den) => ({
      id: den.id,
      protocolo: den.protocolo || den.trackingCode || '',
      titulo: den.denunciaData?.titulo || 'Sem título',
      tipo: den.denunciaData?.tipo || 'conduta',
      status: mapStatusToPortugues(den.status),
      statusOriginal: den.status,
      data: den.createdAt?.split('T')[0] || den.denunciaData?.dataOcorrencia,
      createdAt: den.createdAt,
      rca: den.adminData?.rca || null,
      historicoStatus: den.adminData?.historicoStatus || [],
    }))
  }, [contextDenuncias])

  // Documents data - now comes from DocumentsContext (SSOT)
  // The documentsByCategory is provided by useDocuments() hook above

  // ==========================================================================
  // MODAL STATE
  // ==========================================================================

  const [showPermissionsModal, setShowPermissionsModal] = useState(false)

  // New document modal state
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [newDocCategory, setNewDocCategory] = useState(null)

  // ==========================================================================
  // NAVIGATION HANDLERS
  // ==========================================================================

  /**
   * Handle section change from ManagementLayout
   * @param {string} section - Section ID
   * @param {string|null} subSection - Sub-section ID (for docs)
   */
  const handleSectionChange = useCallback((section, subSection = null) => {
    setActiveSection(section)

    // Handle sub-section based on section type
    if (section === 'documentos' && subSection) {
      setActiveDocCategory(subSection)
      setActiveDocSubTab('documentos')
    } else if (section === 'incidentes') {
      setActiveIncidentsSubTab('responsaveis')
    }
  }, [onNavigate])

  /**
   * Handle back button
   */
  const handleBack = useCallback(() => {
    if (goBack) {
      goBack()
    } else if (onNavigate) {
      onNavigate('home')
    }
  }, [goBack, onNavigate])

  // ==========================================================================
  // USER HANDLERS
  // ==========================================================================

  /**
   * Handle editing a user
   * @param {object} user - User to edit
   */
  const handleEditUser = useCallback((user) => {
    setEditingUser(user)
    setShowPermissionsModal(true)
  }, [])

  /**
   * Handle adding a new user
   */
  const handleAddUser = useCallback(() => {
    setEditingUser(null)
    setShowPermissionsModal(true)
  }, [])

  /**
   * Save user permissions
   * @param {object} userData - Updated user data
   */
  const handleSaveUserPermissions = useCallback(
    async (userData) => {
      try {
        if (editingUser) {
          const disabledCards = userData.permissions
            ? Object.entries(userData.permissions).filter(([, v]) => v === false).map(([k]) => k)
            : []
          // 0. PRE-CHECK: Verify admin has write access (RLS admin_users check)
          const { data: adminCheck, error: adminErr } = await supabase
            .from('admin_users')
            .select('firebase_uid')
            .limit(1)
          if (adminErr) {
            toast({
              title: 'Erro de autenticacao',
              description: 'Nao foi possivel verificar permissoes de admin. Token JWT pode estar expirado — faca logout e login novamente.',
              variant: 'error',
            })
            return
          }

          // 1. Save to Supabase (source of truth)
          const result = await contextUpdateUser(editingUser.id, userData)

          // 2. VERIFY: Read back from Supabase to confirm persistence
          try {
            const { data: verifyRow, error: verifyErr } = await supabase
              .from('profiles')
              .select('permissions, custom_permissions')
              .eq('id', editingUser.id)
              .single()
            if (verifyErr) {
              console.error('[CentroGestaoPage] VERIFY read-back failed:', verifyErr)
            } else {
              const verifyDisabled = verifyRow?.permissions
                ? Object.entries(verifyRow.permissions).filter(([, v]) => v === false).map(([k]) => k)
                : []
              // Check if the data matches what we sent
              if (disabledCards.length > 0 && verifyDisabled.length === 0) {
                toast({
                  title: 'Erro: permissoes nao persistiram',
                  description: 'O servidor aceitou a requisicao mas os dados nao foram salvos. Verifique a conexao e tente novamente.',
                  variant: 'error',
                })
                return // don't close modal
              }
            }
          } catch (verifyEx) {
            console.warn('[CentroGestaoPage] VERIFY exception:', verifyEx)
          }

          // 3. Sync to Firestore so UserContext picks it up in real-time
          try {
            const firestoreRef = doc(db, 'userProfiles', editingUser.id)
            await setDoc(firestoreRef, {
              role: userData.role,
              isAdmin: userData.isAdmin || false,
              isCoordenador: userData.isCoordenador || false,
              permissions: userData.permissions,
              customPermissions: userData.customPermissions,
              updatedAt: new Date(),
            }, { merge: true })
          } catch (firestoreErr) {
            toast({
              title: 'Aviso: sincronizacao parcial',
              description: 'Permissoes salvas no servidor, mas a sincronizacao em tempo real falhou. O usuario vera as mudancas no proximo login.',
              variant: 'warning',
            })
          }

          toast({
            title: 'Permissoes atualizadas',
            description: disabledCards.length > 0
              ? `${editingUser.nome}: ${disabledCards.length} card(s) desabilitado(s).`
              : `Permissoes de ${editingUser.nome} foram salvas.`,
            variant: 'success',
          })
        } else {
          await contextAddUser(userData)
          toast({
            title: 'Usuario adicionado',
            variant: 'success',
          })
        }
        setShowPermissionsModal(false)
        setEditingUser(null)
      } catch (err) {
        toast({
          title: 'Erro ao salvar permissoes',
          description: err.message,
          variant: 'error',
        })
        // Modal permanece ABERTO para o usuario ver o erro
      }
    },
    [editingUser, toast, contextUpdateUser, contextAddUser]
  )

  /**
   * Handle deleting a user (from PermissionsModal)
   */
  const handleDeleteUser = useCallback(async (userId) => {
    if (firebaseUser?.uid === userId) {
      toast({
        title: 'Acao nao permitida',
        description: 'Voce nao pode excluir sua propria conta.',
        variant: 'error',
      })
      throw new Error('Cannot delete own account')
    }

    // Delete from Supabase (source of truth)
    await contextDeleteUser(userId)

    // Delete from Firestore (non-critical)
    try {
      await deleteDoc(doc(db, 'userProfiles', userId))
    } catch (err) {
      console.warn('[CentroGestaoPage] Firestore profile delete failed (non-critical):', err.message)
    }

    toast({
      title: 'Usuario excluido',
      description: 'O usuario foi removido do sistema.',
      variant: 'success',
    })

    setShowPermissionsModal(false)
    setEditingUser(null)
  }, [firebaseUser, contextDeleteUser, toast])

  // ==========================================================================
  // ROLE TEMPLATE HANDLERS
  // ==========================================================================

  /**
   * Save a role's permission template and bulk-update all users with that role
   * @param {string} roleId - Role identifier
   * @param {Object} cardPermissions - { [cardId]: boolean }
   */
  const handleSaveRoleTemplate = useCallback(async (roleId, cardPermissions) => {
    const disabledCards = Object.entries(cardPermissions).filter(([, v]) => v === false).map(([k]) => k)
    // 0. PRE-CHECK: Verify admin has write access
    const { error: adminErr } = await supabase
      .from('admin_users')
      .select('firebase_uid')
      .limit(1)
    if (adminErr) {
      toast({
        title: 'Erro de autenticacao',
        description: 'Token JWT expirado — faca logout e login novamente.',
        variant: 'error',
      })
      return
    }

    // 1. Update template locally
    setRoleTemplates(prev => ({ ...prev, [roleId]: cardPermissions }));

    // 2. Bulk update: update ALL users with this role
    const usersWithRole = users.filter(u => u.role === roleId);
    if (usersWithRole.length === 0) {
      toast({
        title: `Template de ${getRoleName(roleId)} salvo`,
        description: 'Nenhum usuario com este cargo para atualizar.',
        variant: 'success',
      });
      return;
    }

    const promises = usersWithRole.map(u =>
      contextUpdateUser(u.id, {
        permissions: {
          ...cardPermissions,
          'residencia-edit': u.permissions?.['residencia-edit'] || false,
          'tec-enf-secretaria-edit': u.permissions?.['tec-enf-secretaria-edit'] || false,
        },
        customPermissions: false, // reset custom flag — now follows template
      })
    );
    const results = await Promise.allSettled(promises);

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    const successes = results.filter(r => r.status === 'fulfilled');
    if (failures.length > 0) {
      console.error('[CentroGestaoPage] Role template update failures:', failures.map(f => f.reason?.message));
    }
    // 3. Sync Firestore for each user
    const firestoreResults = await Promise.allSettled(
      usersWithRole.map(u => {
        const firestoreRef = doc(db, 'userProfiles', u.id);
        return setDoc(firestoreRef, {
          permissions: {
            ...cardPermissions,
            'residencia-edit': u.permissions?.['residencia-edit'] || false,
            'tec-enf-secretaria-edit': u.permissions?.['tec-enf-secretaria-edit'] || false,
          },
          customPermissions: false,
          updatedAt: new Date(),
        }, { merge: true });
      })
    );
    const firestoreFailures = firestoreResults.filter(r => r.status === 'rejected');
    if (firestoreFailures.length > 0) {
      console.error('[CentroGestaoPage] Firestore sync failures:', firestoreFailures.map(f => f.reason?.message));
    }

    // 4. VERIFY: Read back one user from Supabase to confirm persistence
    if (successes.length > 0) {
      try {
        const firstUser = usersWithRole[0]
        const { data: verifyRow, error: verifyErr } = await supabase
          .from('profiles')
          .select('permissions, custom_permissions')
          .eq('id', firstUser.id)
          .single()
        if (verifyErr) {
          console.error('[CentroGestaoPage] VERIFY role template read-back failed:', verifyErr)
        }
      } catch (verifyEx) {
        console.warn('[CentroGestaoPage] VERIFY exception:', verifyEx)
      }
    }

    // Show appropriate feedback
    const supabaseOk = failures.length === 0;
    const firestoreOk = firestoreFailures.length === 0;

    if (supabaseOk && firestoreOk) {
      toast({
        title: `Permissoes de ${getRoleName(roleId)} atualizadas`,
        description: disabledCards.length > 0
          ? `${usersWithRole.length} usuario(s) atualizado(s). ${disabledCards.length} card(s) desabilitado(s).`
          : `${usersWithRole.length} usuario${usersWithRole.length !== 1 ? 's' : ''} atualizado${usersWithRole.length !== 1 ? 's' : ''}.`,
        variant: 'success',
      });
    } else if (supabaseOk && !firestoreOk) {
      toast({
        title: 'Aviso: sincronizacao parcial',
        description: `Permissoes salvas no servidor, mas ${firestoreFailures.length} sincronizacao(oes) em tempo real falharam. Usuarios verao as mudancas no proximo login.`,
        variant: 'warning',
      });
    } else {
      toast({
        title: 'Erro ao salvar permissoes',
        description: `${failures.length} de ${usersWithRole.length} atualizacoes falharam. Tente novamente.`,
        variant: 'error',
      });
    }
  }, [users, contextUpdateUser, toast]);

  // ==========================================================================
  // EMAIL HANDLERS
  // ==========================================================================

  /**
   * Handle adding an authorized email
   * @param {string} email - Email to authorize
   */
  const handleAddEmail = useCallback(
    async (email) => {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        toast({ title: 'Formato de email invalido', variant: 'destructive' })
        return
      }
      try {
        await contextAddEmail(email, 'Admin')
        setShowAddEmailModal(false)
        toast({
          title: 'Email autorizado',
          description: `${email} foi adicionado a lista de emails autorizados.`,
          variant: 'success',
        })
      } catch (err) {
        toast({ title: 'Erro', description: 'Nao foi possivel adicionar o email.', variant: 'error' })
      }
    },
    [toast, contextAddEmail]
  )

  /**
   * Handle removing an authorized email
   * @param {string} email - Email to remove
   */
  const handleRemoveEmail = useCallback(
    async (email) => {
      try {
        await contextRemoveEmail(email)
        toast({
          title: 'Email removido',
          description: `${email} foi removido da lista de emails autorizados.`,
          variant: 'default',
        })
      } catch (err) {
        console.error('[CentroGestaoPage] handleRemoveEmail:', err)
      }
    },
    [toast, contextRemoveEmail]
  )

  // ==========================================================================
  // INCIDENT HANDLERS
  // ==========================================================================

  /**
   * Toggle a setting for an incident responsible
   * @param {string} responsibleId - Responsible ID
   * @param {string} setting - Setting to toggle
   */
  const handleToggleResponsibleSetting = useCallback((responsibleId, setting) => {
    contextToggleResponsible(responsibleId, setting)
  }, [contextToggleResponsible])

  /**
   * Atualiza ou adiciona/remove usuário da lista de responsáveis por incidentes
   * Sincroniza configurações do modal de permissões com a lista de responsáveis
   */
  const handleUpdateIncidentResponsible = useCallback(
    (userId, settings) => {
      contextUpdateIncidentResponsible(userId, settings)
    },
    [contextUpdateIncidentResponsible]
  )

  // ==========================================================================
  // DOCUMENTS HANDLERS
  // ==========================================================================

  /**
   * Handle document category change
   * @param {string} category - Category ID
   */
  const handleDocCategoryChange = useCallback((category) => {
    setActiveDocCategory(category)
    setActiveDocSubTab('documentos')
    setActiveCategoryFilter(null)
  }, [])

  /**
   * Handle category click from CategoryCard inside section components.
   * Switches to 'documentos' sub-tab and applies type filter.
   */
  const handleCategoryClick = useCallback((sectionId, categoryId) => {
    setActiveDocSubTab('documentos')
    setActiveCategoryFilter(categoryId)
  }, [])

  /**
   * Handle PDF export with selected sections
   */
  const handleExportPdf = useCallback((selectedSections, dateRange) => {
    setShowPdfModal(false)
    exportPdf('centroGestaoReport', {
      ...dashboardData,
      ...(educacaoAdminData.loading ? {} : {
        totalCursos: educacaoAdminData.totalCursos,
        totalUsuariosEducacao: educacaoAdminData.totalUsuarios,
        taxaConclusaoEducacao: educacaoAdminData.taxaConclusao,
        taxaConformidadeEducacao: educacaoAdminData.taxaConformidade,
        totalAtrasadosEducacao: educacaoAdminData.totalAtrasados,
        totalConcluidos: educacaoAdminData.totalConcluidos,
        totalAssignments: educacaoAdminData.totalAssignments,
        progressoPorTipoEducacao: educacaoAdminData.progressoPorTipo,
      }),
      cursosCompliancePdf: educacaoAdminData.cursosCompliance || [],
      colaboradoresAgrupadosPdf: educacaoAdminData.colaboradoresAgrupados || {},
      selectedSections,
      dateRange,
      geradoPor: 'Administrador',
    })
  }, [exportPdf, dashboardData, educacaoAdminData])

  /**
   * Handle document sub-tab change
   * @param {string} subTab - Sub-tab ID
   */
  const handleDocSubTabChange = useCallback((subTab) => {
    setActiveDocSubTab(subTab)
  }, [])

  // ==========================================================================
  // RESIDENCY HANDLERS
  // ==========================================================================

  /**
   * Handle saving residency stages
   * @param {array} newResidentes - Updated residentes data
   */
  const handleSaveEstagios = useCallback(
    async (newResidentes) => {
      const result = await saveEstagios(newResidentes)
      if (result.success) {
        toast({
          title: 'Estagios salvos',
          description: 'Os estagios foram atualizados com sucesso.',
          variant: 'success',
        })
      } else {
        toast({
          title: 'Erro ao salvar',
          description: result.error || 'Ocorreu um erro ao salvar os estagios.',
          variant: 'error',
        })
      }
      return result
    },
    [saveEstagios, toast]
  )

  /**
   * Handle saving residency plantao
   * @param {object} newPlantao - Updated plantao data
   */
  const handleSavePlantao = useCallback(
    async (newPlantao) => {
      const result = await savePlantao(newPlantao)
      if (result.success) {
        toast({
          title: 'Plantao salvo',
          description: 'O plantao foi atualizado com sucesso.',
          variant: 'success',
        })
      } else {
        toast({
          title: 'Erro ao salvar',
          description: result.error || 'Ocorreu um erro ao salvar o plantao.',
          variant: 'error',
        })
      }
      return result
    },
    [savePlantao, toast]
  )

  // ==========================================================================
  // RENDER CONTENT
  // ==========================================================================

  /**
   * Render content based on active section
   */
  const renderContent = useCallback(() => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardGestaoTab />

      case 'infraestrutura':
        return <InfraStatusTab />

      case 'usuarios':
        return (
          <UsersTab
            users={users}
            loading={usersLoading}
            roles={roles}
            searchQuery={userSearchQuery}
            onSearchChange={setUserSearchQuery}
            filterRole={userFilterRole}
            onFilterChange={setUserFilterRole}
            onEditUser={handleEditUser}
            onAddUser={handleAddUser}
          />
        )

      case 'cargos':
        return (
          <RolesTab
            roleTemplates={roleTemplates}
            users={users}
            onSaveRoleTemplate={handleSaveRoleTemplate}
          />
        )

      case 'emails':
        return (
          <EmailsTab
            authorizedEmails={authorizedEmails}
            searchQuery={emailSearchQuery}
            onSearchChange={setEmailSearchQuery}
            onAddEmail={() => setShowAddEmailModal(true)}
            onRemoveEmail={handleRemoveEmail}
            connectionStatus={emailsConnectionStatus}
          />
        )

      case 'auditLog':
        return <AuditLogTab />

      case 'documentos': {
        // Map category to section component
        const sectionComponents = {
          etica: EticaSection,
          comites: ComitesSection,
          auditorias: AuditoriasSection,
          relatorios: RelatoriosSection,
          biblioteca: BibliotecaSection,
          financeiro: FinanceiroSection,
          medicamentos: MedicamentosSection,
          infeccoes: InfeccoesSection,
          desastres: DesastresSection,
        }

        // Cross-category sub-tabs render workflow components instead of section
        const crossTabComponents = {
          'aprovacoes': ApprovalQueue,
          'calendario-revisoes': ReviewCalendar,
          'trilha-auditoria': AuditTrailPage,
        }

        const CrossTabComponent = crossTabComponents[activeDocSubTab]
        const SectionComponent = sectionComponents[activeDocCategory]
        const docsForCategory = documentsByCategory?.[activeDocCategory] || []

        return (
          <DocumentsLayout
            activeCategory={activeDocCategory}
            activeSubTab={activeDocSubTab}
            onCategoryChange={handleDocCategoryChange}
            onSubTabChange={handleDocSubTabChange}
          >
            {CrossTabComponent ? (
              <CrossTabComponent onNavigate={onNavigate} goBack={() => handleDocSubTabChange('documentos')} embedded />
            ) : (
              <>
                {activeDocSubTab === 'stats' && <ComplianceDashboard />}
                {SectionComponent && (
                  <SectionComponent
                    activeSubTab={activeDocSubTab}
                    docs={docsForCategory}
                    onCategoryClick={handleCategoryClick}
                    activeCategoryFilter={activeCategoryFilter}
                    onDocAction={async (action, doc) => {
                      if (action === 'view' && doc) {
                        // Navigate to document detail page
                        onNavigate?.('documento-detalhe', {
                          documentoId: doc.id,
                          returnTo: 'centro-gestao',
                        })
                      }

                      // Handle 'edit' action - navigate to document detail with edit mode
                      if (action === 'edit' && doc) {
                        onNavigate?.('documento-detalhe', {
                          documentoId: doc.id,
                          returnTo: 'centro-gestao',
                          editMode: true,
                        })
                      }

                      // Handle 'add' action - open new document modal
                      if (action === 'add' && doc?.section) {
                        setNewDocCategory(doc.section)
                        setShowNewDocModal(true)
                      }

                      // Handle 'archive' action
                      if (action === 'archive' && doc) {
                        try {
                          await archiveDocument(activeDocCategory, doc.id)
                          toast({ title: 'Documento arquivado', variant: 'success' })
                        } catch (err) {
                          toast({ title: 'Erro ao arquivar', description: err.message, variant: 'error' })
                        }
                      }
                    }}
                    onNavigate={onNavigate}
                  />
                )}
              </>
            )}
          </DocumentsLayout>
        )
      }

      case 'comunicados':
        return <ComunicadosMonitorTab />

      case 'incidentes':
        return (
          <IncidentsLayout
            activeSubTab={activeIncidentsSubTab}
            onSubTabChange={setActiveIncidentsSubTab}
            incidentResponsibles={incidentResponsibles}
            onToggleResponsibleSetting={handleToggleResponsibleSetting}
            onAddResponsible={() => setShowAddResponsibleModal(true)}
            incidents={incidents}
            denuncias={denuncias}
            incidentStatusFilter={incidentStatusFilter}
            onStatusFilterChange={setIncidentStatusFilter}
            incidentViewMode={incidentViewMode}
            onViewModeChange={setIncidentViewMode}
            onNavigate={onNavigate}
          />
        )

      case 'residencia':
        return (
          <ResidencyTab
            residentes={residentes}
            plantao={plantao}
            loading={estagiosLoading || plantaoLoading}
            onSaveResidentes={handleSaveEstagios}
            onSavePlantao={handleSavePlantao}
            canEdit={canEditResidency}
            connectionStatus={residenciaConnectionStatus}
          />
        )

      case 'educacao':
        return (
          <EducacaoTab
            totalUsuarios={educacaoAdminData.totalUsuarios}
            totalCursos={educacaoAdminData.totalCursos}
            taxaConclusao={educacaoAdminData.taxaConclusao}
            taxaConformidade={educacaoAdminData.taxaConformidade}
            totalAtrasados={educacaoAdminData.totalAtrasados}
            totalConcluidos={educacaoAdminData.totalConcluidos}
            totalAssignments={educacaoAdminData.totalAssignments}
            totalEmAndamento={educacaoAdminData.totalEmAndamento}
            progressoPorTipo={educacaoAdminData.progressoPorTipo}
            topCursos={educacaoAdminData.topCursos}
            statusDistribution={educacaoAdminData.statusDistribution}
            cursosCompliance={educacaoAdminData.cursosCompliance}
            colaboradoresAgrupados={educacaoAdminData.colaboradoresAgrupados}
            loading={educacaoAdminData.loading}
            error={educacaoAdminData.error}
          />
        )

      case 'funcionarios':
        return <StaffTab />

      case 'indicadores':
        return <KpiDashboardOverview onNavigate={onNavigate} embedded />

      case 'planosAcao':
        return <PlanosAcaoPage onNavigate={onNavigate} embedded />

      case 'lgpd':
        return <LgpdSolicitacoesTab />

      default:
        return (
          <div className="text-center py-16">
            <p className="text-[#6B7280] dark:text-[#6B8178]">
              Secao nao encontrada: {activeSection}
            </p>
          </div>
        )
    }
  }, [
    activeSection,
    users,
    roles,
    userSearchQuery,
    userFilterRole,
    handleEditUser,
    handleAddUser,
    authorizedEmails,
    emailSearchQuery,
    emailsConnectionStatus,
    handleRemoveEmail,
    activeDocCategory,
    activeDocSubTab,
    documentsByCategory,
    handleDocCategoryChange,
    handleDocSubTabChange,
    archiveDocument,
    toast,
    incidents,
    denuncias,
    onNavigate,
    activeIncidentsSubTab,
    incidentResponsibles,
    handleToggleResponsibleSetting,
    incidentStatusFilter,
    incidentViewMode,
    residentes,
    plantao,
    estagiosLoading,
    plantaoLoading,
    canEditResidency,
    residenciaConnectionStatus,
    handleSaveEstagios,
    handleSavePlantao,
    educacaoAdminData,
    roleTemplates,
    handleSaveRoleTemplate,
  ])

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <ManagementLayout
      activeSection={activeSection}
      activeSubSection={activeSection === 'documentos' ? activeDocCategory : null}
      onSectionChange={handleSectionChange}
      onBack={handleBack}
      headerRight={
        <button
          type="button"
          onClick={() => setShowPdfModal(true)}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#006837] text-white text-xs font-medium active:scale-95 transition-all disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? 'Gerando...' : 'PDF'}
        </button>
      }
    >
      {renderContent()}

      {/* PermissionsModal for editing user permissions */}
      {showPermissionsModal && (
        <PermissionsModal
          user={editingUser}
          roleTemplates={roleTemplates}
          incidentConfig={
            editingUser ? (incidentResponsibles.find((r) => r.id === editingUser.id) || {}) : {}
          }
          onDelete={editingUser ? handleDeleteUser : undefined}
          onSave={async (role, perms, incidentSettings, extra) => {
            const cardPerms = perms?.cardPermissions || {}
            await handleSaveUserPermissions({
              role,
              isAdmin: perms?.isAdmin || false,
              customPermissions: Object.values(cardPerms).some(v => !v),
              permissions: {
                ...cardPerms,
                'residencia-edit': extra?.canEditResidencia || false,
                'tec-enf-secretaria-edit': extra?.canEditTecEnfSecretaria || false,
              },
              isCoordenador: extra?.isCoordenador || false,
            })
            if (incidentSettings && editingUser?.id) {
              handleUpdateIncidentResponsible(editingUser.id, incidentSettings)
            }
          }}
          onClose={() => {
            setShowPermissionsModal(false)
            setEditingUser(null)
          }}
        />
      )}

      {/* Modal de Adicionar Email */}
      {showAddEmailModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#1A2420] rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
              Adicionar Email Autorizado
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const input = e.target.elements.email
                if (input.value && input.value.includes('@')) {
                  handleAddEmail(input.value)
                }
              }}
            >
              <input
                name="email"
                type="email"
                required
                placeholder="email@exemplo.com"
                className="w-full px-4 py-3 border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl bg-white dark:bg-[#243530] text-black dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-[#006837] dark:focus:ring-[#2ECC71]"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddEmailModal(false)}
                  className="px-4 py-2 rounded-lg text-[#6B7280] hover:bg-gray-100 dark:hover:bg-[#2A3F36] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#006837] hover:bg-[#005530] text-white rounded-lg transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AddResponsibleModal - select a user to add as incident responsible */}
      {showAddResponsibleModal && (
        <AddResponsibleModal
          users={users}
          incidentResponsibles={incidentResponsibles}
          onAdd={async (user) => {
            try {
              await contextUpdateIncidentResponsible(user.id, {
                receberIncidentes: true,
                receberDenuncias: false,
                notificarApp: true,
              })
              setShowAddResponsibleModal(false)
              toast({ title: `${user.nome || user.email} adicionado como responsavel`, variant: 'success' })
            } catch (err) {
              toast({ title: 'Erro ao adicionar responsavel', variant: 'error' })
            }
          }}
          onClose={() => setShowAddResponsibleModal(false)}
        />
      )}

      {/* NewDocumentModal for creating documents in any category */}
      {showNewDocModal && (
        <NewDocumentModal
          open={showNewDocModal}
          onClose={() => {
            setShowNewDocModal(false)
            setNewDocCategory(null)
          }}
          category={newDocCategory}
        />
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        onExport={handleExportPdf}
        exporting={exporting}
      />
    </ManagementLayout>
  )
}

export default CentroGestaoPage
