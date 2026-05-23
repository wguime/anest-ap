/**
 * ControleEducacaoPage.jsx
 * Controle de Educação Continuada para Acreditação Qmentum
 *
 * Visão integrada "como vai cada conteúdo" + "como vai cada colaborador"
 * — com drill-down até nível de aula individual.
 *
 * 3 abas: Por Treinamento | Por Colaborador | Por Aula
 */

import { useState, useMemo, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronDown, Users, X, BookOpen, CheckCircle, AlertTriangle, Clock, Download, Filter, TrendingUp, ClipboardList, GraduationCap, Search, UserPlus, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select, Badge, Progress, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Tabs, TabsList, TabsTrigger, TabsContent, Avatar, Spinner, SearchBar, SearchToggleButton, Collapsible, CollapsibleContent, Checkbox, Pagination } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { TIPOS_USUARIO, calcularDiasRestantes, formatData, getStatusLabel } from '../data/educacaoUtils';
import { StatusBadge } from '../components/StatusBadge';
import { collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as educacaoService from '@/services/educacaoService';
import { getComplianceSummary } from '@/services/educacaoService';
// xlsx é carregado sob demanda dentro de exportExcel() para reduzir bundle inicial

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserName(user) {
  return (
    user.displayName ||
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.email ||
    user.id
  );
}

function getUserInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
}


function deriveStatus(progresso, atrasado) {
  if (progresso === 100) return 'concluido';
  if (atrasado) return 'atrasado';
  if (progresso > 0) return 'em_andamento';
  return 'nao_iniciado';
}

function exportCSV(filename, headers, rows) {
  const BOM = '\uFEFF';
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csvContent =
    BOM +
    [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

async function exportExcel(filename, sheets) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, headers, rows }) => {
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Auto-dimensionar colunas baseado no conteudo
    const colWidths = headers.map((h, i) => {
      let max = String(h).length;
      rows.forEach((r) => {
        const len = String(r[i] ?? '').length;
        if (len > max) max = len;
      });
      return { wch: Math.min(max + 2, 50) };
    });
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // sheet name max 31 chars
  });
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ControleEducacaoPage({ _onNavigate, goBack }) {
  // ----- State: data -----
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [trilhas, setTrilhas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [progressosPorUsuario, setProgressosPorUsuario] = useState({});

  // ----- State: pagination -----
  const PAGE_SIZE = 50;
  const [lastUserDoc, setLastUserDoc] = useState(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ----- State: aulas (lazy) -----
  const [modulosPorCurso, setModulosPorCurso] = useState({});
  const [aulasPorModulo, setAulasPorModulo] = useState({});
  const [loadingAulas, setLoadingAulas] = useState(false);
  const [aulasLoaded, setAulasLoaded] = useState(false);

  // ----- State: export -----
  const [exporting, setExporting] = useState(false);

  // ----- State: UI -----
  const [activeTab, setActiveTab] = useState('treinamento');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchPanelId = useId();

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-slot="anest-search-bar-input"]');
      el?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeSearch(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [closedGrupos, setClosedGrupos] = useState(new Set());
  const toggleItem = (id) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleGrupo = (tipo) => {
    setClosedGrupos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };
  const [colabViewMode, setColabViewMode] = useState('grouped');
  const [colabPage, setColabPage] = useState(1);
  const COLAB_PER_PAGE = 20;
  const [filtros, setFiltros] = useState({
    trilhaId: '',
    cursoId: '',
    tipoUsuario: '',
    periodo: 'all',
    apenasOrientacao: false,
  });

  // ----- Data Fetching (paginated users) -----
  const fetchProgressosForUsers = useCallback(async (users) => {
    const entries = await Promise.all(
      users.map(async (u) => {
        const { progressos, error } = await educacaoService.getProgressoUsuario(u.id);
        if (error) return [u.id, []];
        return [u.id, progressos || []];
      }),
    );
    return Object.fromEntries(entries);
  }, []);

  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        { trilhas: trilhasData, error: trilhasErr },
        { cursos: cursosData, error: cursosErr },
      ] = await Promise.all([
        educacaoService.getTrilhas(),
        educacaoService.getCursos(),
      ]);
      if (trilhasErr) throw new Error(trilhasErr);
      if (cursosErr) throw new Error(cursosErr);

      // Paginated user loading: first page
      const usersQuery = query(
        collection(db, 'userProfiles'),
        orderBy('__name__'),
        limit(PAGE_SIZE),
      );
      const usersSnap = await getDocs(usersQuery);
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const lastDoc = usersSnap.docs.length > 0 ? usersSnap.docs[usersSnap.docs.length - 1] : null;

      const progressos = await fetchProgressosForUsers(users);

      setTrilhas(trilhasData || []);
      setCursos(cursosData || []);
      setUsuarios(users);
      setProgressosPorUsuario(progressos);
      setLastUserDoc(lastDoc);
      setHasMoreUsers(usersSnap.docs.length === PAGE_SIZE);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao carregar dados de controle (Firestore):', err);
      setLoadError(err.message || 'Erro ao carregar dados');
      setTrilhas([]);
      setCursos([]);
      setUsuarios([]);
      setProgressosPorUsuario({});
      setHasMoreUsers(false);
    } finally {
      setLoading(false);
    }
  }, [fetchProgressosForUsers]);

  const loadMoreUsers = useCallback(async () => {
    if (!lastUserDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextQuery = query(
        collection(db, 'userProfiles'),
        orderBy('__name__'),
        startAfter(lastUserDoc),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(nextQuery);
      const newUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

      const newProgressos = await fetchProgressosForUsers(newUsers);

      setUsuarios((prev) => [...prev, ...newUsers]);
      setProgressosPorUsuario((prev) => ({ ...prev, ...newProgressos }));
      setLastUserDoc(newLastDoc);
      setHasMoreUsers(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao carregar mais usuários:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [lastUserDoc, loadingMore, fetchProgressosForUsers]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  // ----- Lazy: load aulas structure when "Por Aula" tab is activated -----
  // Returns { modMap, aulaMap } so callers can use the data immediately (before next render)
  const fetchAulasStructure = useCallback(async () => {
    if (aulasLoaded || loadingAulas || cursos.length === 0) return null;
    setLoadingAulas(true);
    try {
      const modEntries = await Promise.all(
        cursos.map(async (c) => {
          const { modulos, error } = await educacaoService.getModulosByCurso(c.id);
          if (error) return [c.id, []];
          return [c.id, modulos || []];
        }),
      );
      const modMap = Object.fromEntries(modEntries);
      setModulosPorCurso(modMap);

      const allModulos = Object.values(modMap).flat();
      const aulaEntries = await Promise.all(
        allModulos.map(async (m) => {
          const { aulas, error } = await educacaoService.getAulasByModulo(m.id);
          if (error) return [m.id, []];
          return [m.id, aulas || []];
        }),
      );
      const aulaMap = Object.fromEntries(aulaEntries);
      setAulasPorModulo(aulaMap);
      setAulasLoaded(true);
      return { modMap, aulaMap };
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao carregar estrutura de aulas:', err);
      return null;
    } finally {
      setLoadingAulas(false);
    }
  }, [cursos, aulasLoaded, loadingAulas]);

  useEffect(() => {
    if (activeTab === 'aula' && !aulasLoaded && !loading) {
      fetchAulasStructure();
    }
  }, [activeTab, aulasLoaded, loading, fetchAulasStructure]);

  // ----- Filter options -----
  const trilhaOptions = useMemo(
    () => [
      { value: '', label: 'Todas as trilhas' },
      ...trilhas.map((t) => ({ value: t.id, label: t.titulo })),
    ],
    [trilhas],
  );

  const cursoOptions = useMemo(() => {
    let lista = cursos;
    if (filtros.trilhaId) {
      const trilha = trilhas.find((t) => t.id === filtros.trilhaId);
      if (trilha?.cursos?.length) {
        const ids = new Set(trilha.cursos);
        lista = lista.filter((c) => ids.has(c.id));
      }
    }
    return [
      { value: '', label: 'Todos os cursos' },
      ...lista.map((c) => ({ value: c.id, label: c.titulo })),
    ];
  }, [cursos, trilhas, filtros.trilhaId]);

  // Auto-reset cursoId when trilhaId changes and selected curso is not in the new trilha
  useEffect(() => {
    if (filtros.trilhaId && filtros.cursoId) {
      const trilha = trilhas.find((t) => t.id === filtros.trilhaId);
      if (trilha?.cursos?.length && !trilha.cursos.includes(filtros.cursoId)) {
        setFiltros((prev) => ({ ...prev, cursoId: '' }));
      }
    }
  }, [filtros.trilhaId]);

  // Reset pagination when filters change
  useEffect(() => {
    setColabPage(1);
  }, [filtros, searchQuery]);

  const tipoUsuarioOptions = useMemo(() => {
    // Collect tipos configured across all trilhas (synced with course creation)
    const tiposConfigurados = new Set();
    trilhas.forEach((t) => {
      (t.tiposUsuario || []).forEach((tipo) => tiposConfigurados.add(tipo));
    });
    // If no trilhas have tiposUsuario, fallback to all TIPOS_USUARIO
    const entries = tiposConfigurados.size > 0
      ? Object.entries(TIPOS_USUARIO).filter(([key]) => tiposConfigurados.has(key))
      : Object.entries(TIPOS_USUARIO);
    const seen = new Set();
    const unique = entries.filter(([, { label }]) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return [
      { value: '', label: 'Todos os tipos' },
      ...unique.map(([value, { label }]) => ({ value, label })),
    ];
  }, [trilhas]);

  const periodoOptions = [
    { value: 'all', label: 'Todo o período' },
    { value: '7', label: 'Liberados nos últimos 7 dias' },
    { value: '30', label: 'Liberados nos últimos 30 dias' },
    { value: '90', label: 'Liberados nos últimos 90 dias' },
  ];

  // ----- Derived: usuarios with progresso per curso -----
  const usuariosEnriquecidos = useMemo(() => {
    if (loading) return [];
    return usuarios.map((u) => {
      const nome = getUserName(u);
      const progressos = progressosPorUsuario[u.id] || [];
      const byCurso = new Map(progressos.map((p) => [p.cursoId || p.id, p]));
      // Derive tipoUsuario from role field (userProfiles store 'role', not 'tipoUsuario')
      const tipoUsuario = u.tipoUsuario || u.role || '';
      return { ...u, nome, tipoUsuario, progressos, byCurso };
    });
  }, [loading, usuarios, progressosPorUsuario]);

  // ----- Derived: filtered usuarios -----
  const usuariosFiltrados = useMemo(() => {
    let result = usuariosEnriquecidos;
    if (filtros.tipoUsuario) {
      const tipoLabel = TIPOS_USUARIO[filtros.tipoUsuario]?.label;
      result = result.filter((u) =>
        u.tipoUsuario === filtros.tipoUsuario ||
        (tipoLabel && TIPOS_USUARIO[u.tipoUsuario]?.label === tipoLabel)
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.nome.toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [usuariosEnriquecidos, filtros.tipoUsuario, searchQuery]);

  // ----- Derived: filtered cursos -----
  const cursosFiltrados = useMemo(() => {
    let result = cursos;
    if (filtros.cursoId) {
      result = result.filter((c) => c.id === filtros.cursoId);
    }
    if (filtros.trilhaId) {
      const trilha = trilhas.find((t) => t.id === filtros.trilhaId);
      if (trilha?.cursos?.length) {
        const cursoIds = new Set(trilha.cursos);
        result = result.filter((c) => cursoIds.has(c.id));
      }
    }
    if (filtros.apenasOrientacao) {
      const orientacaoTrilhas = trilhas.filter((t) => t.isOrientacao);
      const cursoIdsOrientacao = new Set();
      orientacaoTrilhas.forEach((t) => (t.cursos || []).forEach((id) => cursoIdsOrientacao.add(id)));
      result = result.filter((c) => cursoIdsOrientacao.has(c.id));
    }
    if (filtros.periodo && filtros.periodo !== 'all') {
      const dias = parseInt(filtros.periodo, 10);
      const corte = new Date();
      corte.setDate(corte.getDate() - dias);
      result = result.filter((c) => {
        const raw = c.dataLiberacao || c.createdAt;
        const dt = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
        return dt && dt >= corte;
      });
    }
    return result;
  }, [cursos, trilhas, filtros.trilhaId, filtros.cursoId, filtros.apenasOrientacao, filtros.periodo]);

  // ----- Derived: per-curso compliance data (Aba 1 — "Por Treinamento") -----
  const cursosCompliance = useMemo(() => {
    return cursosFiltrados.map((curso) => {
      // Find which trilhas include this curso
      const trilhasComCurso = trilhas.filter((t) => (t.cursos || []).includes(curso.id));
      // Determine applicable tipos (union of all trilhas' tiposUsuario that include this curso)
      const tiposAplicaveis = new Set();
      trilhasComCurso.forEach((t) => {
        (t.tiposUsuario || []).forEach((tipo) => tiposAplicaveis.add(tipo));
      });

      // Determine if any parent trilha is mandatory or orientation
      const obrigatoria = trilhasComCurso.some((t) => t.obrigatoria);
      const isOrientacao = trilhasComCurso.some((t) => t.isOrientacao);
      const prazoConclusao = trilhasComCurso.reduce((min, t) => {
        if (t.prazoConclusao && (min === null || t.prazoConclusao < min)) return t.prazoConclusao;
        return min;
      }, null);
      const createdAt = trilhasComCurso[0]?.createdAt || null;

      // Filter usuarios applicable to this curso
      const usersApplicable = usuariosFiltrados.filter((u) => {
        if (tiposAplicaveis.size === 0) return true; // No restriction
        return tiposAplicaveis.has(u.tipoUsuario);
      });

      const usersWithStatus = usersApplicable.map((u) => {
        const p = u.byCurso.get(curso.id);
        const progresso = p?.progresso || 0;
        const dataConclusao = p?.completedAt || p?.updatedAt || null;
        let atrasado = false;
        if (obrigatoria && prazoConclusao && createdAt && progresso < 100) {
          const dias = calcularDiasRestantes(createdAt, prazoConclusao);
          if (dias !== null && dias < 0) atrasado = true;
        }
        const status = deriveStatus(progresso, atrasado);
        return { ...u, progresso, status, dataConclusao };
      });

      const concluidos = usersWithStatus.filter((u) => u.status === 'concluido').length;
      const emAndamento = usersWithStatus.filter((u) => u.status === 'em_andamento').length;
      const naoIniciados = usersWithStatus.filter((u) => u.status === 'nao_iniciado').length;
      const atrasados = usersWithStatus.filter((u) => u.status === 'atrasado').length;
      const total = usersWithStatus.length;
      const conforme = total > 0 && concluidos === total;

      return {
        ...curso,
        usersWithStatus,
        concluidos,
        emAndamento,
        naoIniciados,
        atrasados,
        total,
        conforme,
        obrigatoria,
        isOrientacao,
      };
    });
  }, [cursosFiltrados, trilhas, usuariosFiltrados]);

  // ----- Derived: per-colaborador data (Aba 2) -----
  const colaboradoresData = useMemo(() => {
    return usuariosFiltrados
      .map((u) => {
        let totalProg = 0;
        let totalCursos = 0;
        let cursosConc = 0;
        let atrasado = false;

        const cursosInfo = cursosFiltrados.map((curso) => {
          const p = u.byCurso.get(curso.id);
          const progresso = p?.progresso || 0;
          totalProg += progresso;
          totalCursos++;
          if (progresso === 100) cursosConc++;

          // Check atrasado via parent trilhas
          const trilhasComCurso = trilhas.filter((t) => (t.cursos || []).includes(curso.id));
          let cursoAtrasado = false;
          trilhasComCurso.forEach((t) => {
            if (t.obrigatoria && t.prazoConclusao && t.createdAt && progresso < 100) {
              const dias = calcularDiasRestantes(t.createdAt, t.prazoConclusao);
              if (dias !== null && dias < 0) {
                cursoAtrasado = true;
                atrasado = true;
              }
            }
          });

          return {
            ...curso,
            progresso,
            status: deriveStatus(progresso, cursoAtrasado),
          };
        });

        const progressoMedio = totalCursos > 0 ? Math.round(totalProg / totalCursos) : 0;
        const status = deriveStatus(progressoMedio, atrasado);

        return { ...u, cursosInfo, progressoMedio, cursosConc, totalCursos, status, atrasado };
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, [usuariosFiltrados, cursosFiltrados, trilhas]);

  // Group by tipoUsuario
  const colaboradoresAgrupados = useMemo(() => {
    const grupos = {};
    colaboradoresData.forEach((u) => {
      const tipo = u.tipoUsuario || 'outro';
      if (!grupos[tipo]) {
        grupos[tipo] = {
          label: TIPOS_USUARIO[tipo]?.label || tipo,
          cor: TIPOS_USUARIO[tipo]?.cor || '#666',
          usuarios: [],
        };
      }
      grupos[tipo].usuarios.push(u);
    });
    return grupos;
  }, [colaboradoresData]);

  // ----- Derived: summary metrics -----
  const metricas = useMemo(() => {
    const totalTreinamentos = cursosFiltrados.length;
    const totalConformes = cursosCompliance.filter((c) => c.conforme).length;
    const taxaConformidade =
      totalTreinamentos > 0 ? Math.round((totalConformes / totalTreinamentos) * 100) : 0;
    const totalAtrasados = cursosCompliance.reduce((s, c) => s + c.atrasados, 0);
    const totalConcluidos = cursosCompliance.reduce((s, c) => s + c.concluidos, 0);
    const totalAssignments = cursosCompliance.reduce((s, c) => s + c.total, 0);

    return {
      totalTreinamentos,
      taxaConformidade,
      totalAtrasados,
      concluidos: totalConcluidos,
      totalAssignments,
    };
  }, [cursosFiltrados, cursosCompliance]);

  // ----- Derived: Qmentum compliance summary (Q3) -----
  const complianceSummary = useMemo(() => {
    return getComplianceSummary(usuariosFiltrados, trilhas, progressosPorUsuario);
  }, [usuariosFiltrados, trilhas, progressosPorUsuario]);

  // ----- CSV Exports -----
  const _handleExportCSV = () => {
    try {
    if (activeTab === 'treinamento') {
      const headers = ['Curso', 'Tipo Crédito', 'Créditos (h)', 'Usuário', 'Email', 'Tipo', 'Progresso', 'Status', 'Data Conclusão'];
      const rows = [];
      cursosCompliance.forEach((c) => {
        c.usersWithStatus.forEach((u) => {
          rows.push([
            c.titulo,
            c.tipoCreditoEducacao || 'geral',
            c.creditosHoras || '-',
            u.nome,
            u.email || '',
            TIPOS_USUARIO[u.tipoUsuario]?.label || u.tipoUsuario || '',
            `${u.progresso}%`,
            getStatusLabel(u.status),
            u.dataConclusao ? formatData(u.dataConclusao?.toDate ? u.dataConclusao.toDate() : u.dataConclusao) : '-',
          ]);
        });
      });
      exportCSV('controle-por-treinamento', headers, rows);
    } else if (activeTab === 'colaborador') {
      const headers = ['Colaborador', 'Email', 'Tipo', 'Cursos Concluídos', 'Total Cursos', 'Progresso', 'Status'];
      const rows = colaboradoresData.map((u) => [
        u.nome,
        u.email || '',
        TIPOS_USUARIO[u.tipoUsuario]?.label || u.tipoUsuario || '',
        u.cursosConc,
        u.totalCursos,
        `${u.progressoMedio}%`,
        getStatusLabel(u.status),
      ]);
      exportCSV('controle-por-colaborador', headers, rows);
    } else if (activeTab === 'aula') {
      const headers = ['Curso', 'Módulo', 'Aula', 'Assistiram', 'Faltam', 'Taxa Conclusão'];
      const rows = [];
      cursosFiltrados.forEach((curso) => {
        const modulos = modulosPorCurso[curso.id] || [];
        modulos.forEach((mod) => {
          const aulas = aulasPorModulo[mod.id] || [];
          aulas.forEach((aula) => {
            const assistiu = usuariosFiltrados.filter((u) => {
              const p = u.byCurso.get(curso.id);
              return (p?.aulasAssistidas || []).includes(aula.id);
            }).length;
            const total = usuariosFiltrados.length;
            rows.push([
              curso.titulo,
              mod.titulo,
              aula.titulo,
              assistiu,
              total - assistiu,
              total > 0 ? `${Math.round((assistiu / total) * 100)}%` : '0%',
            ]);
          });
        });
      });
      exportCSV('controle-por-aula', headers, rows);
    }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao exportar CSV:', err);
    }
  };

  // ----- Excel Export (all 4 sheets) -----
  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

      // --- Sheet 1: Por Treinamento ---
      const sheet1Headers = ['Curso', 'Tipo Crédito', 'Créditos (h)', 'Colaborador', 'Email', 'Tipo', 'Progresso', 'Status', 'Data Conclusão'];
      const sheet1Rows = [];
      [...cursosCompliance]
        .sort((a, b) => collator.compare(a.titulo || '', b.titulo || ''))
        .forEach((c) => {
          [...c.usersWithStatus]
            .sort((a, b) => collator.compare(a.nome || '', b.nome || ''))
            .forEach((u) => {
              sheet1Rows.push([
                c.titulo,
                c.tipoCreditoEducacao || 'geral',
                c.creditosHoras || '-',
                u.nome,
                u.email || '',
                TIPOS_USUARIO[u.tipoUsuario]?.label || u.tipoUsuario || '',
                `${u.progresso}%`,
                getStatusLabel(u.status),
                u.dataConclusao
                  ? formatData(u.dataConclusao?.toDate ? u.dataConclusao.toDate() : u.dataConclusao)
                  : '-',
              ]);
            });
        });

      // --- Sheet 2: Por Colaborador ---
      const sheet2Headers = ['Colaborador', 'Email', 'Tipo', 'Cursos Concluídos', 'Total Cursos', 'Progresso', 'Status'];
      const sheet2Rows = colaboradoresData.map((u) => [
        u.nome,
        u.email || '',
        TIPOS_USUARIO[u.tipoUsuario]?.label || u.tipoUsuario || '',
        u.cursosConc,
        u.totalCursos,
        `${u.progressoMedio}%`,
        getStatusLabel(u.status),
      ]);

      // --- Sheet 3: Por Tipo de Usuário ---
      const sheet3Headers = ['Tipo', 'Colaborador', 'Email', 'Cursos Concluídos', 'Total Cursos', 'Progresso', 'Status'];
      const sheet3Rows = [];
      Object.entries(colaboradoresAgrupados)
        .sort((a, b) => collator.compare(a[1].label || '', b[1].label || ''))
        .forEach(([, grupo]) => {
          [...grupo.usuarios]
            .sort((a, b) => collator.compare(a.nome || '', b.nome || ''))
            .forEach((u) => {
              sheet3Rows.push([
                grupo.label,
                u.nome,
                u.email || '',
                u.cursosConc,
                u.totalCursos,
                `${u.progressoMedio}%`,
                getStatusLabel(u.status),
              ]);
            });
        });

      // --- Sheet 4: Por Aula (lazy load if needed) ---
      const sheets = [
        { name: 'Por Treinamento', headers: sheet1Headers, rows: sheet1Rows },
        { name: 'Por Colaborador', headers: sheet2Headers, rows: sheet2Rows },
        { name: 'Por Tipo de Usuário', headers: sheet3Headers, rows: sheet3Rows },
      ];

      // Use state data if already loaded, otherwise fetch and use returned data
      let effectiveModulos = modulosPorCurso;
      let effectiveAulas = aulasPorModulo;
      let aulasReady = aulasLoaded;

      if (!aulasReady) {
        try {
          const result = await fetchAulasStructure();
          if (result) {
            effectiveModulos = result.modMap;
            effectiveAulas = result.aulaMap;
            aulasReady = true;
          }
        } catch {
          if (import.meta.env.DEV) console.warn('Não foi possível carregar dados de aulas para o export. Sheet "Por Aula" será omitida.');
        }
      }

      if (aulasReady) {
        const sheet4Headers = ['Curso', 'Módulo', 'Aula', 'Assistiram', 'Faltam', 'Taxa Conclusão'];
        const sheet4Rows = [];
        cursosFiltrados.forEach((curso) => {
          const modulos = effectiveModulos[curso.id] || [];
          modulos.forEach((mod) => {
            const aulas = effectiveAulas[mod.id] || [];
            aulas.forEach((aula) => {
              const assistiu = usuariosFiltrados.filter((u) => {
                const p = u.byCurso.get(curso.id);
                return (p?.aulasAssistidas || []).includes(aula.id);
              }).length;
              const total = usuariosFiltrados.length;
              sheet4Rows.push([
                curso.titulo,
                mod.titulo,
                aula.titulo,
                assistiu,
                total - assistiu,
                total > 0 ? `${Math.round((assistiu / total) * 100)}%` : '0%',
              ]);
            });
          });
        });
        sheets.push({ name: 'Por Aula', headers: sheet4Headers, rows: sheet4Rows });
      }

      await exportExcel('controle-educacao', sheets);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao exportar Excel:', err);
    } finally {
      setExporting(false);
    }
  };

  // ----- Render: Header -----
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px]"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Controle de Educação
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  // ----- Render: Loading / Error -----
  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  // ----- Render: Main -----
  return (
    <div className="min-h-dvh bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-6 py-4 space-y-4">
        {/* Error */}
        {loadError && (
          <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Erro ao carregar dados: {loadError}
          </div>
        )}

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="w-10 h-10 rounded-xl bg-category-teal-bg flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-category-teal-fg" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Educacao</p>
            <h1 className="text-[18px] font-bold text-foreground">Controle de Educacao</h1>
          </div>
        </motion.div>

        {/* Summary Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: 'easeOut' }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-3"
        >
          <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center mx-auto mb-1">
              <Users className="w-4 h-4 text-info" />
            </div>
            <p className="text-[18px] font-bold text-foreground">{usuariosFiltrados.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Colaboradores</p>
          </div>

          <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[18px] font-bold text-foreground">{metricas.totalTreinamentos}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Treinamentos</p>
          </div>

          <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mx-auto mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-[18px] font-bold text-foreground">{metricas.taxaConformidade}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conformidade</p>
          </div>

          <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-[18px] font-bold text-foreground">{metricas.totalAtrasados}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atrasados</p>
          </div>

          <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center col-span-2 sm:col-span-1">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mx-auto mb-1">
              <CheckCircle className="w-4 h-4 text-success" />
            </div>
            <p className="text-[18px] font-bold text-foreground">
              {metricas.concluidos}/{metricas.totalAssignments}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Concluidos</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
          className="rounded-[20px] bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] p-4"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Filtros</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl min-h-[44px]"
              onClick={handleExportExcel}
              disabled={exporting}
              leftIcon={exporting ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            >
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              size="sm"
              label="Trilha"
              value={filtros.trilhaId}
              onChange={(v) => setFiltros((prev) => ({ ...prev, trilhaId: v }))}
              options={trilhaOptions}
            />
            <Select
              size="sm"
              label="Curso"
              value={filtros.cursoId}
              onChange={(v) => setFiltros((prev) => ({ ...prev, cursoId: v }))}
              options={cursoOptions}
            />
            <Select
              size="sm"
              label="Tipo de Colaborador"
              value={filtros.tipoUsuario}
              onChange={(v) => setFiltros((prev) => ({ ...prev, tipoUsuario: v }))}
              options={tipoUsuarioOptions}
            />
            <Select
              size="sm"
              label="Periodo"
              value={filtros.periodo}
              onChange={(v) => setFiltros((prev) => ({ ...prev, periodo: v }))}
              options={periodoOptions}
            />
            <div className="sm:col-span-2">
              <div className="flex items-center justify-end">
                <SearchToggleButton
                  size="md"
                  active={searchOpen}
                  onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}
                  controlsId={searchPanelId}
                />
              </div>
              <Collapsible open={searchOpen} onOpenChange={(v) => v ? setSearchOpen(true) : closeSearch()}>
                <CollapsibleContent>
                  <div id={searchPanelId}>
                    <SearchBar
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(typeof e === 'string' ? e : e.target.value)}
                      placeholder="Buscar colaborador por nome ou email..."
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 min-h-[44px]">
              <Checkbox
                checked={filtros.apenasOrientacao}
                onChange={(checked) => setFiltros((prev) => ({ ...prev, apenasOrientacao: checked }))}
                compact
              />
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setFiltros((prev) => ({ ...prev, apenasOrientacao: !prev.apenasOrientacao }))}>
                <UserPlus className="w-4 h-4 text-info" />
                <span className="text-sm text-foreground">Apenas trilhas de Orientacao (Onboarding)</span>
              </div>
            </div>
            {(filtros.trilhaId || filtros.cursoId || filtros.tipoUsuario || filtros.periodo !== 'all' || filtros.apenasOrientacao || searchQuery) && (
              <div className="sm:col-span-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => {
                    setFiltros({ trilhaId: '', cursoId: '', tipoUsuario: '', periodo: 'all', apenasOrientacao: false });
                    setSearchQuery('');
                  }}
                  leftIcon={<X className="w-3.5 h-3.5" />}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15, ease: 'easeOut' }}
        >
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline">
          <TabsList className="mb-4 grid w-full grid-cols-3 border-b border-border bg-transparent p-0">
            <TabsTrigger value="treinamento" className="px-2 justify-center min-h-[44px] text-[13px] font-medium">Treinamento</TabsTrigger>
            <TabsTrigger value="colaborador" className="px-2 justify-center min-h-[44px] text-[13px] font-medium">Colaborador</TabsTrigger>
            <TabsTrigger value="aula" className="px-2 justify-center min-h-[44px] text-[13px] font-medium">Aula</TabsTrigger>
          </TabsList>

          {/* ============================================================= */}
          {/* TAB 1: Por Treinamento                                        */}
          {/* ============================================================= */}
          <TabsContent value="treinamento">
            <div className="space-y-4">
              {/* Qmentum Q3: Compliance Summary Dashboard */}
              <div className="rounded-[20px] bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Conformidade Qmentum</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mx-auto mb-1">
                      <CheckCircle className="w-4 h-4 text-success" />
                    </div>
                    <p className="text-[18px] font-bold text-foreground">{complianceSummary.emConformidade}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Em Conformidade</p>
                  </div>
                  <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
                    <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center mx-auto mb-1">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    </div>
                    <p className="text-[18px] font-bold text-foreground">{complianceSummary.parcialmenteConformes}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Parcialmente</p>
                  </div>
                  <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-1">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <p className="text-[18px] font-bold text-foreground">{complianceSummary.naoConformes}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nao Conformes</p>
                  </div>
                  <div className="rounded-[16px] p-3 bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] text-center">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-[18px] font-bold text-foreground">{complianceSummary.porcentagemConformidade}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa Geral</p>
                  </div>
                </div>

                <Progress
                  value={complianceSummary.porcentagemConformidade}
                  size="sm"
                  className={cn(
                    'rounded-full h-3',
                    complianceSummary.porcentagemConformidade >= 80 && "[&>div]:bg-success",
                    complianceSummary.porcentagemConformidade >= 50 && complianceSummary.porcentagemConformidade < 80 && "[&>div]:bg-warning",
                    complianceSummary.porcentagemConformidade < 50 && "[&>div]:bg-destructive",
                  )}
                />

                {/* Treinamentos vencidos */}
                {complianceSummary.treinamentosVencidos.length > 0 && (
                  <div className="mt-4 rounded-[20px] border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Treinamentos vencidos ({complianceSummary.treinamentosVencidos.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {complianceSummary.treinamentosVencidos.slice(0, 10).map((item, idx) => (
                        <div key={`v-${item.userId}-${item.trilhaId}-${idx}`} className="flex items-center justify-between text-xs p-2 rounded-xl bg-card/60 min-h-[48px]">
                          <span className="truncate flex-1 font-medium text-foreground">{item.userName}</span>
                          <Badge variant="destructive" badgeStyle="subtle" className="text-[10px] shrink-0 ml-2">
                            {item.trilhaTitulo} ({item.venceuEm}d)
                          </Badge>
                        </div>
                      ))}
                      {complianceSummary.treinamentosVencidos.length > 10 && (
                        <p className="text-[10px] text-muted-foreground text-center pt-1">
                          +{complianceSummary.treinamentosVencidos.length - 10} mais
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Treinamentos vencendo */}
                {complianceSummary.treinamentosVencendo.length > 0 && (
                  <div className="mt-3 rounded-[20px] border border-warning/20 bg-warning/5 p-3">
                    <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Vencendo em breve ({complianceSummary.treinamentosVencendo.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {complianceSummary.treinamentosVencendo.slice(0, 10).map((item, idx) => (
                        <div key={`e-${item.userId}-${item.trilhaId}-${idx}`} className="flex items-center justify-between text-xs p-2 rounded-xl bg-card/60 min-h-[48px]">
                          <span className="truncate flex-1 font-medium text-foreground">{item.userName}</span>
                          <Badge variant="warning" badgeStyle="subtle" className="text-[10px] shrink-0 ml-2">
                            {item.trilhaTitulo} ({item.diasRestantes}d)
                          </Badge>
                        </div>
                      ))}
                      {complianceSummary.treinamentosVencendo.length > 10 && (
                        <p className="text-[10px] text-muted-foreground text-center pt-1">
                          +{complianceSummary.treinamentosVencendo.length - 10} mais
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {cursosCompliance.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="w-8 h-8" />}
                  title="Nenhum treinamento encontrado"
                  description="Ajuste os filtros ou adicione cursos ao sistema."
                />
              ) : (
                cursosCompliance.map((curso, cursoIdx) => {
                  const isOpen = expandedItems.has(`curso-${curso.id}`);
                  const cursoProgress = curso.total > 0 ? Math.round((curso.concluidos / curso.total) * 100) : 0;
                  return (
                    <motion.div
                      key={curso.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(cursoIdx * 0.03, 0.3), ease: 'easeOut' }}
                    >
                      <div
                        className="w-full rounded-[20px] bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] hover:shadow-[0_4px_16px_rgba(0,66,37,0.08)] transition-shadow cursor-pointer p-4"
                        onClick={() => toggleItem(`curso-${curso.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(`curso-${curso.id}`); } }}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-category-teal-bg flex items-center justify-center shrink-0">
                            <GraduationCap className="w-5 h-5 text-category-teal-fg" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {curso.titulo}
                              </p>
                              {curso.isOrientacao && (
                                <Badge variant="info" badgeStyle="subtle" className="text-[10px] shrink-0">
                                  Orientacao
                                </Badge>
                              )}
                              {curso.obrigatoria && (
                                <Badge variant="warning" badgeStyle="subtle" className="text-[10px] shrink-0">
                                  Obrigatorio
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={cursoProgress}
                                size="sm"
                                className={cn(
                                  'flex-1 rounded-full h-3 max-w-[200px]',
                                  curso.conforme && "[&>div]:bg-success",
                                  curso.atrasados > 0 && "[&>div]:bg-destructive",
                                )}
                              />
                              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                                {curso.concluidos}/{curso.total} concluidos
                              </span>
                            </div>
                          </div>
                          <Badge variant={curso.conforme ? 'success' : 'secondary'} badgeStyle="subtle" className="shrink-0 hidden sm:inline-flex">
                            {curso.conforme ? 'Conforme' : 'Pendente'}
                          </Badge>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
                        </div>
                      </div>
                      {isOpen && (
                        <div className="mt-2 rounded-[20px] border border-border overflow-hidden divide-y divide-border">
                          {curso.usersWithStatus.length === 0 ? (
                            <p className="text-center text-muted-foreground py-6 text-sm">
                              Nenhum colaborador vinculado
                            </p>
                          ) : (
                            [...curso.usersWithStatus]
                              .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
                              .map((u) => (
                                <div
                                  key={u.id}
                                  className={cn(
                                    "flex items-center gap-2 p-3 min-h-[52px]",
                                    u.status === 'concluido' && 'bg-success/5',
                                    u.status === 'atrasado' && 'bg-destructive/5',
                                  )}
                                >
                                  <Avatar size="sm" initials={getUserInitials(u.nome)} className="shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium break-words">{u.nome}</p>
                                    <p className="text-xs text-muted-foreground break-words">{u.email}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Progress
                                      value={u.progresso}
                                      size="sm"
                                      className={cn(
                                        'w-16 rounded-full h-2',
                                        u.status === 'concluido' && "[&>div]:bg-success",
                                        u.status === 'atrasado' && "[&>div]:bg-destructive",
                                      )}
                                    />
                                    <span className="text-xs font-medium w-9 text-right">{u.progresso}%</span>
                                  </div>
                                  <div className="shrink-0">
                                    <StatusBadge status={u.status} />
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* ============================================================= */}
          {/* TAB 2: Por Colaborador                                         */}
          {/* ============================================================= */}
          <TabsContent value="colaborador">
            <div className="space-y-4">
              {/* View mode toggle -- chip pattern */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 py-1">
                <button
                  type="button"
                  className={cn(
                    "shrink-0 px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[44px]",
                    colabViewMode === 'grouped'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  onClick={() => setColabViewMode('grouped')}
                >
                  Por Tipo
                </button>
                <button
                  type="button"
                  className={cn(
                    "shrink-0 px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[44px]",
                    colabViewMode === 'table'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  onClick={() => setColabViewMode('table')}
                >
                  Lista
                </button>
              </div>

              {colabViewMode === 'table' ? (
                colaboradoresData.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-8 h-8" />}
                    title="Nenhum colaborador encontrado"
                    description="Ajuste os filtros ou cadastre colaboradores."
                  />
                ) : (
                  <div className="rounded-[20px] border border-border overflow-hidden bg-card shadow-[0_2px_8px_rgba(0,66,37,0.04)]">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-accent">
                            <TableHead>Colaborador</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Cursos</TableHead>
                            <TableHead>Progresso</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                          {colaboradoresData
                            .slice((colabPage - 1) * COLAB_PER_PAGE, colabPage * COLAB_PER_PAGE)
                            .map((u) => (
                            <TableRow key={u.id} className="min-h-[52px]">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar size="sm" initials={getUserInitials(u.nome)} className="shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium">{u.nome}</p>
                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  style={{ backgroundColor: TIPOS_USUARIO[u.tipoUsuario]?.cor || '#666' }}
                                  className="text-white text-[10px]"
                                >
                                  {TIPOS_USUARIO[u.tipoUsuario]?.label || u.tipoUsuario || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium whitespace-nowrap">{u.cursosConc}/{u.totalCursos}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 min-w-[100px]">
                                  <Progress
                                    value={u.progressoMedio}
                                    size="sm"
                                    className={cn(
                                      'flex-1 rounded-full h-2',
                                      u.status === 'concluido' && "[&>div]:bg-success",
                                      u.status === 'atrasado' && "[&>div]:bg-destructive",
                                    )}
                                  />
                                  <span className="text-xs font-medium w-9 text-right">{u.progressoMedio}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={u.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {Math.ceil(colaboradoresData.length / COLAB_PER_PAGE) > 1 && (
                      <div className="flex justify-center p-3 border-t border-border">
                        <Pagination
                          currentPage={colabPage}
                          totalPages={Math.ceil(colaboradoresData.length / COLAB_PER_PAGE)}
                          onPageChange={setColabPage}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                )
              ) : Object.keys(colaboradoresAgrupados).length === 0 ? (
                <EmptyState
                  icon={<Users className="w-8 h-8" />}
                  title="Nenhum colaborador encontrado"
                  description="Ajuste os filtros ou cadastre colaboradores."
                />
              ) : (
                Object.entries(colaboradoresAgrupados).map(([tipo, grupo], grupoIdx) => {
                  const grupoOpen = !closedGrupos.has(tipo);
                  return (
                    <motion.div
                      key={tipo}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(grupoIdx * 0.04, 0.3), ease: 'easeOut' }}
                    >
                      <div
                        className="w-full flex items-center gap-3 p-3 rounded-[16px] bg-muted hover:bg-muted/80 transition-colors cursor-pointer min-h-[52px]"
                        onClick={() => toggleGrupo(tipo)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGrupo(tipo); } }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${grupo.cor}20` }}>
                          <Users className="w-5 h-5" style={{ color: grupo.cor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{grupo.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {grupo.usuarios.length}{' '}
                            {grupo.usuarios.length === 1 ? 'colaborador' : 'colaboradores'}
                          </p>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", grupoOpen && "rotate-180")} />
                      </div>
                      {grupoOpen && (
                        <div className="space-y-2 mt-2">
                          {grupo.usuarios.map((u) => {
                            const userOpen = expandedItems.has(`user-${u.id}`);
                            return (
                              <div key={u.id}>
                                <div
                                  className="w-full flex items-center gap-2 p-3 rounded-[20px] bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] hover:shadow-[0_4px_16px_rgba(0,66,37,0.08)] transition-shadow cursor-pointer min-h-[52px]"
                                  onClick={() => toggleItem(`user-${u.id}`)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(`user-${u.id}`); } }}
                                >
                                  <Avatar size="sm" initials={getUserInitials(u.nome)} className="shrink-0" />
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium break-words">{u.nome}</p>
                                    <p className="text-xs text-muted-foreground break-words">{u.email}</p>
                                  </div>
                                  <div className="hidden sm:flex items-center gap-2 min-w-[80px]">
                                    <Progress
                                      value={u.progressoMedio}
                                      size="sm"
                                      className={cn(
                                        'flex-1 rounded-full h-2',
                                        u.status === 'concluido' && "[&>div]:bg-success",
                                        u.status === 'atrasado' && "[&>div]:bg-destructive",
                                      )}
                                    />
                                    <span className="text-xs font-medium w-10 text-right">
                                      {u.progressoMedio}%
                                    </span>
                                  </div>
                                  <div className="shrink-0">
                                    <StatusBadge status={u.status} />
                                  </div>
                                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", userOpen && "rotate-180")} />
                                </div>
                                {userOpen && (
                                  <div className="mt-1.5 space-y-1.5 pl-2">
                                    {u.cursosInfo.map((c) => (
                                      <div
                                        key={c.id}
                                        className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50 overflow-hidden min-h-[44px]"
                                      >
                                        <GraduationCap className="w-3.5 h-3.5 text-category-teal-fg shrink-0" />
                                        <span className="text-xs flex-1 truncate font-medium">{c.titulo}</span>
                                        <Progress
                                          value={c.progresso}
                                          size="sm"
                                          className={cn(
                                            'w-16 rounded-full h-1.5',
                                            c.status === 'concluido' && "[&>div]:bg-success",
                                            c.status === 'atrasado' && "[&>div]:bg-destructive",
                                          )}
                                        />
                                        <span className="text-[10px] text-muted-foreground w-8 text-right">
                                          {c.progresso}%
                                        </span>
                                        <div className="shrink-0">
                                          <StatusBadge status={c.status} />
                                        </div>
                                      </div>
                                    ))}
                                    {u.cursosInfo.length === 0 && (
                                      <p className="text-xs text-muted-foreground py-2">Nenhum curso atribuido</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Pagination: Carregar mais usuarios */}
          {hasMoreUsers && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl min-h-[44px]"
                onClick={loadMoreUsers}
                disabled={loadingMore}
                leftIcon={loadingMore ? <Spinner size="sm" /> : <Users className="w-4 h-4" />}
              >
                {loadingMore ? 'Carregando...' : `Carregar mais colaboradores (${usuarios.length} carregados)`}
              </Button>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3: Por Aula                                                */}
          {/* ============================================================= */}
          <TabsContent value="aula">
            {loadingAulas ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : cursosFiltrados.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8" />}
                title="Nenhum curso encontrado"
                description="Ajuste os filtros para ver aulas."
              />
            ) : (
              <div className="space-y-4">
                {cursosFiltrados.map((curso, cIdx) => {
                  const modulos = modulosPorCurso[curso.id] || [];
                  const cursoAulaOpen = expandedItems.has(`aula-curso-${curso.id}`);
                  return (
                    <motion.div
                      key={curso.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(cIdx * 0.03, 0.3), ease: 'easeOut' }}
                    >
                      <div
                        className="rounded-[20px] bg-card border border-border shadow-[0_2px_8px_rgba(0,66,37,0.04)] hover:shadow-[0_4px_16px_rgba(0,66,37,0.08)] transition-shadow cursor-pointer p-4"
                        onClick={() => toggleItem(`aula-curso-${curso.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(`aula-curso-${curso.id}`); } }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-category-teal-bg flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-category-teal-fg" />
                          </div>
                          <span className="text-sm font-semibold text-foreground flex-1 truncate">{curso.titulo}</span>
                          <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] shrink-0">
                            {modulos.length} {modulos.length === 1 ? 'modulo' : 'modulos'}
                          </Badge>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", cursoAulaOpen && "rotate-180")} />
                        </div>
                      </div>
                      {cursoAulaOpen && (
                        <div className="mt-2 space-y-3 pl-2">
                          {modulos.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">
                              Nenhum modulo cadastrado
                            </p>
                          ) : (
                            modulos.map((mod) => {
                              const aulas = aulasPorModulo[mod.id] || [];
                              const modOpen = expandedItems.has(`mod-${mod.id}`);
                              return (
                                <div key={mod.id}>
                                  <div
                                    className="w-full flex items-center gap-2 p-3 rounded-[16px] bg-muted hover:bg-muted/80 transition-colors cursor-pointer min-h-[48px]"
                                    onClick={() => toggleItem(`mod-${mod.id}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(`mod-${mod.id}`); } }}
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-category-blue-bg flex items-center justify-center shrink-0">
                                      <ClipboardList className="w-4 h-4 text-category-blue-fg" />
                                    </div>
                                    <span className="text-xs font-semibold flex-1 text-left truncate">
                                      {mod.titulo}
                                    </span>
                                    <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
                                      {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'}
                                    </Badge>
                                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", modOpen && "rotate-180")} />
                                  </div>
                                  {modOpen && (
                                    aulas.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2 pl-2">
                                        Nenhuma aula cadastrada
                                      </p>
                                    ) : (
                                      <div className="space-y-2 mt-2 pl-2">
                                        {aulas.map((aula) => {
                                          const assistiu = usuariosFiltrados.filter((u) => {
                                            const p = u.byCurso.get(curso.id);
                                            return (p?.aulasAssistidas || []).includes(aula.id);
                                          }).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
                                          const falta = usuariosFiltrados.filter((u) => {
                                            const p = u.byCurso.get(curso.id);
                                            return !(p?.aulasAssistidas || []).includes(aula.id);
                                          }).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
                                          const total = usuariosFiltrados.length;
                                          const taxa = total > 0 ? Math.round((assistiu.length / total) * 100) : 0;
                                          const aulaOpen = expandedItems.has(`aula-${aula.id}`);

                                          return (
                                            <div key={aula.id}>
                                              <div
                                                className="w-full flex items-center gap-2 p-3 rounded-xl bg-card border border-border hover:shadow-sm transition-shadow cursor-pointer min-h-[48px]"
                                                onClick={() => toggleItem(`aula-${aula.id}`)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(`aula-${aula.id}`); } }}
                                              >
                                                <span className="text-xs font-medium flex-1 text-left truncate">
                                                  {aula.titulo}
                                                </span>
                                                <Progress
                                                  value={taxa}
                                                  size="sm"
                                                  className={cn(
                                                    'w-14 rounded-full h-2',
                                                    taxa === 100 && "[&>div]:bg-success",
                                                    taxa > 0 && taxa < 100 && "[&>div]:bg-info",
                                                  )}
                                                />
                                                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                                  {assistiu.length}/{total}
                                                </span>
                                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", aulaOpen && "rotate-180")} />
                                              </div>
                                              {aulaOpen && (
                                                <div className="mt-1.5 space-y-1.5 pl-2">
                                                  {assistiu.length > 0 && (
                                                    <div>
                                                      <p className="text-[10px] font-semibold text-success mb-1 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Assistiu ({assistiu.length})
                                                      </p>
                                                      <div className="flex flex-wrap gap-1">
                                                        {assistiu.map((u) => (
                                                          <Badge
                                                            key={u.id}
                                                            variant="success"
                                                            badgeStyle="subtle"
                                                            className="text-[10px]"
                                                          >
                                                            {u.nome}
                                                          </Badge>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {falta.length > 0 && (
                                                    <div>
                                                      <p className="text-[10px] font-semibold text-destructive mb-1 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Falta assistir ({falta.length})
                                                      </p>
                                                      <div className="flex flex-wrap gap-1">
                                                        {falta.map((u) => (
                                                          <Badge
                                                            key={u.id}
                                                            variant="destructive"
                                                            badgeStyle="subtle"
                                                            className="text-[10px]"
                                                          >
                                                            {u.nome}
                                                          </Badge>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
      </div>
    </div>
  );
}
