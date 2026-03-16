/**
 * RelatoriosEducacaoPage.jsx
 * Dashboard de relatórios de educação continuada
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronDown,
  Users,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Clock,
  Download,
  Filter,
  Eye,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Select,
  Badge,
  Progress,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Avatar,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  TIPOS_USUARIO,
  calcularDiasRestantes,
  formatData,
} from '../data/mockEducacaoData';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as educacaoService from '@/services/educacaoService';

/**
 * RelatoriosEducacaoPage - Dashboard de relatórios
 */
export default function RelatoriosEducacaoPage({ onNavigate, goBack }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [trilhas, setTrilhas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [progressosPorUsuario, setProgressosPorUsuario] = useState({}); // { [userId]: progressos[] }

  // Filtros
  const [filtros, setFiltros] = useState({
    trilhaId: '',
    tipoUsuario: '',
    periodo: '30',
  });

  const fetchRelatorioData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [{ trilhas: trilhasData, error: trilhasErr }, { cursos: cursosData, error: cursosErr }] =
        await Promise.all([educacaoService.getTrilhas(), educacaoService.getCursos()]);
      if (trilhasErr) throw new Error(trilhasErr);
      if (cursosErr) throw new Error(cursosErr);

      // Usuários (userProfiles)
      const usersSnap = await getDocs(collection(db, 'userProfiles'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Progresso por usuário (subcollection educacao_progresso/{userId}/cursos)
      const progressosEntries = await Promise.all(
        users.map(async (u) => {
          const { progressos, error } = await educacaoService.getProgressoUsuario(u.id);
          if (error) {
            // não falhar todo relatório por um usuário; apenas registra
            return [u.id, []];
          }
          return [u.id, progressos || []];
        })
      );
      const progressosMap = Object.fromEntries(progressosEntries);

      setTrilhas(trilhasData || []);
      setCursos(cursosData || []);
      setUsuarios(users || []);
      setProgressosPorUsuario(progressosMap);
    } catch (err) {
      console.error('Erro ao carregar relatórios (Firestore):', err);
      setLoadError(err.message || 'Erro ao carregar relatórios');
      // fallback: mantém arrays vazios (UI já lida com empty state)
      setTrilhas([]);
      setCursos([]);
      setUsuarios([]);
      setProgressosPorUsuario({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelatorioData();
  }, [fetchRelatorioData]);

  // Opções de filtro
  const trilhaOptions = useMemo(() => [
    { value: '', label: 'Todas as trilhas' },
    ...trilhas.map(t => ({ value: t.id, label: t.titulo })),
  ], [trilhas]);

  const tipoUsuarioOptions = useMemo(() => {
    const seen = new Set();
    const unique = Object.entries(TIPOS_USUARIO).filter(([, { label }]) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return [
      { value: '', label: 'Todos os tipos' },
      ...unique.map(([value, { label }]) => ({ value, label })),
    ];
  }, []);

  const periodoOptions = [
    { value: '7', label: 'Últimos 7 dias' },
    { value: '30', label: 'Últimos 30 dias' },
    { value: '90', label: 'Últimos 90 dias' },
    { value: 'all', label: 'Todo o período' },
  ];

  const calcularProgressoTrilhaFirestore = useCallback((trilha, userId) => {
    const cursoIds = trilha?.cursos || [];
    if (cursoIds.length === 0) return 0;
    const progressos = progressosPorUsuario[userId] || [];
    const byCurso = new Map(progressos.map(p => [p.cursoId || p.id, p]));
    const soma = cursoIds.reduce((acc, cursoId) => {
      const p = byCurso.get(cursoId);
      return acc + (p?.progresso || 0);
    }, 0);
    return Math.round(soma / cursoIds.length);
  }, [progressosPorUsuario]);

  // Calcular métricas resumidas
  const metricas = useMemo(() => {
    if (loading) {
      return {
        totalUsuarios: 0,
        taxaConclusao: 0,
        totalAtrasados: 0,
        totalEmAndamento: 0,
        totalConcluidos: 0,
      };
    }

    let usuariosFiltrados = usuarios;
    let trilhasFiltradas = trilhas;

    // Filtrar por período
    // Para Firestore, filtramos por último update do progresso do curso (se existir)
    const dias = filtros.periodo && filtros.periodo !== 'all' ? parseInt(filtros.periodo) : null;
    const dataLimite = dias ? (() => {
      const d = new Date();
      d.setDate(d.getDate() - dias);
      return d;
    })() : null;

    // Filtrar por tipo de usuário (match by label to handle aliases)
    if (filtros.tipoUsuario) {
      const tipoLabel = TIPOS_USUARIO[filtros.tipoUsuario]?.label;
      usuariosFiltrados = usuariosFiltrados.filter(u =>
        u.tipoUsuario === filtros.tipoUsuario ||
        (tipoLabel && TIPOS_USUARIO[u.tipoUsuario]?.label === tipoLabel)
      );
      trilhasFiltradas = trilhasFiltradas.filter(t =>
        (t.tiposUsuario || []).some(tipo =>
          tipo === filtros.tipoUsuario ||
          (tipoLabel && TIPOS_USUARIO[tipo]?.label === tipoLabel)
        )
      );
    }

    // Filtrar por trilha
    if (filtros.trilhaId) {
      trilhasFiltradas = trilhasFiltradas.filter(t => t.id === filtros.trilhaId);
    }

    // Total de usuários ativos
    const totalUsuarios = usuariosFiltrados.length;

    // Calcular progresso de cada usuário em cada trilha
    let totalConcluidos = 0;
    let totalEmAndamento = 0;
    let totalAtrasados = 0;

    usuariosFiltrados.forEach(usuario => {
      trilhasFiltradas.forEach(trilha => {
        // quando tipoUsuario existe na trilha, respeitar; se não existir, considerar aplicável
        if (trilha.tiposUsuario?.length && usuario.tipoUsuario && !trilha.tiposUsuario.includes(usuario.tipoUsuario)) return;

        // Se houver filtro de período, checar se o usuário teve atividade recente em algum curso da trilha
        if (dataLimite) {
          const progressos = progressosPorUsuario[usuario.id] || [];
          const cursoIds = trilha.cursos || [];
          const temAtividade = progressos.some(p => {
            const updated = p.updatedAt?.toDate ? p.updatedAt.toDate() : (p.updatedAt ? new Date(p.updatedAt) : null);
            const cursoMatch = cursoIds.includes(p.cursoId || p.id);
            return cursoMatch && updated && updated >= dataLimite;
          });
          if (!temAtividade) return;
        }

        const progresso = calcularProgressoTrilhaFirestore(trilha, usuario.id);

        if (progresso === 100) {
          totalConcluidos++;
        } else if (progresso > 0) {
          totalEmAndamento++;
          // Verificar se está atrasado
          if (trilha.obrigatoria && trilha.prazoConclusao) {
            const diasRestantes = calcularDiasRestantes(trilha.createdAt, trilha.prazoConclusao);
            if (diasRestantes !== null && diasRestantes < 0) {
              totalAtrasados++;
            }
          }
        }
      });
    });

    // Taxa de conclusão
    const totalAssignments = usuariosFiltrados.reduce((sum, u) => {
      const aplicaveis = trilhasFiltradas.filter(t => (t.tiposUsuario?.length ? t.tiposUsuario.includes(u.tipoUsuario) : true));
      return sum + aplicaveis.length;
    }, 0);

    const taxaConclusao = totalAssignments > 0
      ? Math.round((totalConcluidos / totalAssignments) * 100)
      : 0;

    return {
      totalUsuarios,
      taxaConclusao,
      totalAtrasados,
      totalEmAndamento,
      totalConcluidos,
    };
  }, [filtros, loading, usuarios, trilhas, progressosPorUsuario, calcularProgressoTrilhaFirestore]);

  // Dados detalhados por usuário
  const dadosUsuarios = useMemo(() => {
    if (loading) return [];

    let usuariosFiltrados = usuarios;
    let trilhasFiltradas = trilhas;

    if (filtros.tipoUsuario) {
      const tipoLabel = TIPOS_USUARIO[filtros.tipoUsuario]?.label;
      usuariosFiltrados = usuariosFiltrados.filter(u =>
        u.tipoUsuario === filtros.tipoUsuario ||
        (tipoLabel && TIPOS_USUARIO[u.tipoUsuario]?.label === tipoLabel)
      );
    }

    if (filtros.trilhaId) {
      trilhasFiltradas = trilhasFiltradas.filter(t => t.id === filtros.trilhaId);
    }

    return usuariosFiltrados.map(usuario => {
      const nome = usuario.displayName || `${usuario.firstName || ''} ${usuario.lastName || ''}`.trim() || usuario.email || usuario.id;
      // Encontrar trilhas aplicáveis
      const trilhasAplicaveis = trilhasFiltradas.filter(t =>
        t.tiposUsuario?.length ? t.tiposUsuario.includes(usuario.tipoUsuario) : true
      );

      // Calcular progresso total
      let progressoTotal = 0;
      let trilhasConcluidas = 0;

      trilhasAplicaveis.forEach(trilha => {
        const progresso = calcularProgressoTrilhaFirestore(trilha, usuario.id);
        progressoTotal += progresso;
        if (progresso === 100) trilhasConcluidas++;
      });

      const progressoMedio = trilhasAplicaveis.length > 0
        ? Math.round(progressoTotal / trilhasAplicaveis.length)
        : 0;

      // Verificar se está atrasado
      let atrasado = false;
      trilhasAplicaveis.forEach(trilha => {
        if (trilha.obrigatoria && trilha.prazoConclusao) {
          const diasRestantes = calcularDiasRestantes(trilha.createdAt, trilha.prazoConclusao);
          const progresso = calcularProgressoTrilhaFirestore(trilha, usuario.id);
          if (diasRestantes !== null && diasRestantes < 0 && progresso < 100) {
            atrasado = true;
          }
        }
      });

      return {
        ...usuario,
        nome,
        trilhasAplicaveis: trilhasAplicaveis.length,
        trilhasConcluidas,
        progressoMedio,
        atrasado,
        status: progressoMedio === 100 ? 'concluido' :
                atrasado ? 'atrasado' :
                progressoMedio > 0 ? 'em_andamento' : 'nao_iniciado',
      };
    }).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, [filtros, loading, usuarios, trilhas, calcularProgressoTrilhaFirestore]);

  // Agrupar usuários por tipo
  const usuariosAgrupados = useMemo(() => {
    const grupos = {};

    dadosUsuarios.forEach(usuario => {
      const tipo = usuario.tipoUsuario;
      if (!grupos[tipo]) {
        grupos[tipo] = {
          label: TIPOS_USUARIO[tipo]?.label || tipo,
          cor: TIPOS_USUARIO[tipo]?.cor || '#666',
          usuarios: []
        };
      }
      grupos[tipo].usuarios.push(usuario);
    });

    return grupos;
  }, [dadosUsuarios]);

  // View mode state
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'table'

  // Exportar CSV
  const handleExportCSV = () => {
    const headers = ['Nome', 'Email', 'Tipo', 'Trilhas', 'Concluídas', 'Progresso', 'Status'];
    const rows = dadosUsuarios.map(u => [
      u.nome || '',
      u.email,
      TIPOS_USUARIO[u.tipoUsuario]?.label || u.tipoUsuario,
      u.trilhasAplicaveis,
      u.trilhasConcluidas,
      `${u.progressoMedio}%`,
      u.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-educacao-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'concluido':
        return (
          <Badge variant="success" badgeStyle="subtle">
            <CheckCircle className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'atrasado':
        return (
          <Badge variant="destructive" badgeStyle="subtle">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Atrasado
          </Badge>
        );
      case 'em_andamento':
        return (
          <Badge variant="info" badgeStyle="subtle">
            <Clock className="w-3 h-3 mr-1" />
            Em Andamento
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" badgeStyle="subtle">
            Não Iniciado
          </Badge>
        );
    }
  };

  // Header
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>

          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Relatórios
          </h1>

          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-6 py-4 space-y-6">
        {loadError && (
          <Card className="border-destructive/30">
            <CardContent className="p-4 text-sm text-destructive">
              Erro ao carregar relatórios do Firestore: {loadError}
            </CardContent>
          </Card>
        )}

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {metricas.totalUsuarios}
                  </p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {metricas.taxaConclusao}%
                  </p>
                  <p className="text-xs text-muted-foreground">Conclusão</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {metricas.totalAtrasados}
                  </p>
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {metricas.totalEmAndamento}
                  </p>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                value={filtros.trilhaId}
                onChange={(v) => setFiltros(prev => ({ ...prev, trilhaId: v }))}
                options={trilhaOptions}
              />
              <Select
                value={filtros.tipoUsuario}
                onChange={(v) => setFiltros(prev => ({ ...prev, tipoUsuario: v }))}
                options={tipoUsuarioOptions}
              />
              <Select
                value={filtros.periodo}
                onChange={(v) => setFiltros(prev => ({ ...prev, periodo: v }))}
                options={periodoOptions}
              />
            </div>
          </CardContent>
        </Card>

        {/* Progresso por Usuário */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Progresso por Usuário</CardTitle>
            <div className="flex items-center gap-2">
              {/* Toggle View Mode */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === 'grouped'
                      ? "bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted"
                  )}
                >
                  Por Tipo
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === 'table'
                      ? "bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted"
                  )}
                >
                  Lista
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Exportar CSV
              </Button>
            </div>
          </CardHeader>

          {/* Grouped View */}
          {viewMode === 'grouped' ? (
            <CardContent className="pt-0">
              <div className="space-y-4">
                {Object.entries(usuariosAgrupados).map(([tipo, grupo]) => (
                  <Collapsible key={tipo} defaultOpen>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                        <Badge
                          style={{ backgroundColor: grupo.cor }}
                          className="text-white"
                        >
                          {grupo.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {grupo.usuarios.length} {grupo.usuarios.length === 1 ? 'usuário' : 'usuários'}
                        </span>
                        <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-2 pl-2">
                        {grupo.usuarios.map(usuario => (
                          <div
                            key={usuario.id}
                            className="w-full flex items-center gap-2 p-3 bg-card rounded-lg border"
                          >
                            <Avatar
                              size="sm"
                              initials={usuario.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            />
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium truncate">{usuario.nome}</p>
                              <p className="text-xs text-muted-foreground truncate">{usuario.email}</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 min-w-[80px]">
                              <Progress
                                value={usuario.progressoMedio}
                                size="sm"
                                className={cn(
                                  'flex-1 h-2',
                                  usuario.status === 'concluido' && "[&>div]:bg-success",
                                  usuario.status === 'atrasado' && "[&>div]:bg-destructive"
                                )}
                              />
                              <span className="text-xs font-medium w-10 text-right">
                                {usuario.progressoMedio}%
                              </span>
                            </div>
                            <div className="shrink-0">
                              {getStatusBadge(usuario.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                {Object.keys(usuariosAgrupados).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </div>
                )}
              </div>
            </CardContent>
          ) : (
            /* Table View */
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Trilhas</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosUsuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {usuario.nome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {usuario.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" badgeStyle="subtle">
                          {TIPOS_USUARIO[usuario.tipoUsuario]?.label || usuario.tipoUsuario}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {usuario.trilhasConcluidas}/{usuario.trilhasAplicaveis}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress
                            value={usuario.progressoMedio}
                            size="sm"
                            className={cn(
                              "flex-1 h-2",
                              usuario.status === 'concluido' && "[&>div]:bg-success",
                              usuario.status === 'atrasado' && "[&>div]:bg-destructive"
                          )}
                        />
                        <span className="text-xs text-muted-foreground w-10">
                          {usuario.progressoMedio}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(usuario.status)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
