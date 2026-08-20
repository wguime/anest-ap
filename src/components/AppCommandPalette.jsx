// AppCommandPalette.jsx
// Onda G — CommandPalette ⌘K (Fase 2.1): atalho de teclado para navegação
// rápida. Acionada por ⌘K/Ctrl-K (sem UI visível própria; as lupas das páginas
// permanecem inline).
//
// Indexa:
//   - Páginas navegáveis (rótulos pt-BR), filtradas por permissão (canAccessPage).
//   - Calculadoras clínicas ativas (getSectionsWithCalculators), abrindo a calc
//     direto via onNavigate('calculadoras', { calcId }).
//
// Documentos da Biblioteca NÃO são indexados aqui: a busca de documentos é
// assíncrona via Supabase (hook useSearch), sem cache client-side síncrono.
// Follow-up: indexar documentos quando houver fonte client-side confiável.
import { useMemo } from 'react'
import { Calculator } from 'lucide-react'

import { CommandPalette } from '@/design-system'
import { getSectionsWithCalculators } from '@/design-system/data/calculator-definitions'

// Índice curado de páginas navegáveis → rótulo pt-BR + palavras-chave de busca.
// `page` é o nome usado por handleNavigate/renderAppPage (App.jsx).
// A permissão é resolvida em runtime por canAccessPage (= checkPageAccess do App),
// que cobre PAGE_TO_CARD + bypass admin/coordenador.
const NAV_INDEX = [
  // Início
  { page: 'home', label: 'Início', keywords: ['home', 'inicio', 'principal'] },
  { page: 'comunicados', label: 'Comunicados', keywords: ['avisos', 'mural'] },
  { page: 'pendencias', label: 'Pendências', keywords: ['tarefas', 'alertas'] },
  { page: 'inbox', label: 'Inbox / Mensagens', keywords: ['mensagens', 'notificacoes'] },
  { page: 'profile', label: 'Perfil', keywords: ['conta', 'meus dados'] },
  { page: 'noticias', label: 'Notícias', keywords: ['publicacoes', 'feed'] },
  // Gestão
  { page: 'gestao', label: 'Gestão', keywords: ['qualidade', 'shield'] },
  { page: 'incidentes', label: 'Notificações e Denúncias', keywords: ['incidente', 'notificacao', 'notificar', 'denuncia', 'denunciar', 'evento adverso', 'near miss', 'relato', 'relatar', 'assedio', 'seguranca do paciente'] },
  { page: 'novoIncidente', label: 'Relatar Notificação', keywords: ['novo incidente', 'reportar'] },
  { page: 'novaDenuncia', label: 'Fazer Denúncia', keywords: ['denuncia', 'ouvidoria'] },
  { page: 'meusRelatos', label: 'Meus Relatos', keywords: ['acompanhar', 'historico'] },
  { page: 'biblioteca', label: 'Biblioteca de Documentos', keywords: ['documentos', 'pop', 'protocolos'] },
  { page: 'gestaoDocumental', label: 'Gestão Documental', keywords: ['documentos', 'versionamento'] },
  { page: 'qualidade', label: 'Qualidade', keywords: ['indicadores'] },
  { page: 'painelGestao', label: 'Painel de Gestão', keywords: ['kpi', 'dashboard'] },
  { page: 'planosAcao', label: 'Planos de Ação', keywords: ['pdca', 'acao'] },
  { page: 'auditorias', label: 'Auditorias', keywords: ['auditoria'] },
  { page: 'auditoriasInterativas', label: 'Auditorias Interativas', keywords: ['checklist'] },
  { page: 'autoavaliacao', label: 'Autoavaliação Qmentum', keywords: ['rop', 'acreditacao'] },
  { page: 'relatorios', label: 'Relatórios', keywords: ['relatorio', 'trimestral'] },
  { page: 'organograma', label: 'Organograma', keywords: ['equipe', 'estrutura'] },
  { page: 'eticaBioetica', label: 'Ética e Bioética', keywords: ['etica', 'comite', 'parecer'] },
  { page: 'comites', label: 'Comitês', keywords: ['comite', 'reunioes'] },
  { page: 'desastres', label: 'Planos de Desastres', keywords: ['emergencia', 'contingencia'] },
  { page: 'faturamento', label: 'Faturamento', keywords: ['financeiro', 'notas', 'convenios'] },
  { page: 'escalas', label: 'Escalas', keywords: ['plantao', 'agenda'] },
  { page: 'reunioes', label: 'Reuniões', keywords: ['atas', 'pauta'] },
  // Educação
  { page: 'educacao', label: 'Educação', keywords: ['ensino', 'aprendizado'] },
  { page: 'educacaoContinuada', label: 'Educação Continuada', keywords: ['trilhas', 'cursos', 'aulas'] },
  { page: 'certificados', label: 'Certificados', keywords: ['certificado', 'diploma'] },
  { page: 'pontos', label: 'Pontos', keywords: ['gamificacao', 'ranking'] },
  // Menu / Ferramentas
  { page: 'menuPage', label: 'Menu', keywords: ['ferramentas', 'mais'] },
  { page: 'calculadoras', label: 'Calculadoras', keywords: ['calculo', 'clinica'] },
  { page: 'criteriosUti', label: 'Critérios UTI', keywords: ['triagem', 'pos-operatorio'] },
  { page: 'cateteresPeridural', label: 'Cateter Peridural', keywords: ['epidural', 'analgesia'] },
  { page: 'escalasFuncionarias', label: 'Escalas Funcionárias', keywords: ['sobreaviso', 'trocas'] },
]

/**
 * AppCommandPalette — paleta ⌘K global (busca unificada do app).
 *
 * @param {boolean} open
 * @param {(open:boolean)=>void} onOpenChange
 * @param {(page:string, params?:object)=>void} onNavigate
 * @param {(page:string)=>boolean} canAccessPage  Predicado de permissão (checkPageAccess do App).
 */
export function AppCommandPalette({ open, onOpenChange, onNavigate, canAccessPage }) {
  const groups = useMemo(() => {
    const can = typeof canAccessPage === 'function' ? canAccessPage : () => true

    // Grupo 1 — Navegação (páginas permitidas)
    const navItems = NAV_INDEX.filter((it) => can(it.page)).map((it) => ({
      id: `nav-${it.page}`,
      label: it.label,
      keywords: it.keywords,
      onSelect: () => onNavigate(it.page),
    }))

    const result = []
    if (navItems.length) {
      result.push({ heading: 'Navegação', items: navItems })
    }

    // Grupo 2 — Calculadoras ativas (só se a página de calculadoras é acessível)
    if (can('calculadoras')) {
      const calcItems = []
      for (const section of getSectionsWithCalculators()) {
        for (const calc of section.calculators) {
          if (calc.status !== 'active') continue
          calcItems.push({
            id: `calc-${calc.id}`,
            label: calc.title,
            icon: <Calculator className="w-4 h-4" />,
            keywords: [calc.subtitle, section.title].filter(Boolean),
            onSelect: () => onNavigate('calculadoras', { calcId: calc.id }),
          })
        }
      }
      if (calcItems.length) {
        result.push({ heading: 'Calculadoras', items: calcItems })
      }
    }

    return result
  }, [canAccessPage, onNavigate])

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      groups={groups}
      placeholder="Buscar páginas e calculadoras..."
      emptyText="Nenhum resultado."
    />
  )
}

export default AppCommandPalette
