/**
 * PreviewModal - Student-Safe com Comparação Admin vs Aluno
 * 
 * Features:
 * - USA AS MESMAS QUERIES DO ALUNO (sem junction tables)
 * - Mostra itens ocultos (draft, inativos, sem permissão) com motivo
 * - Preview === Realidade do Aluno
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Modal, 
  ModalHeader, 
  ModalTitle, 
  ModalContent, 
  ModalFooter, 
  Select, 
  Alert, 
  Button, 
  Card,
  CardContent,
  Badge,
  Checkbox,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { TIPOS_USUARIO } from '../../data/mockEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { BookOpen, Info, GitBranch, FolderOpen, Video, ChevronRight, ChevronDown, Loader2, EyeOff, Eye, AlertTriangle } from 'lucide-react';

/**
 * Determina por que um item não é visível para o aluno
 */
function getHiddenReason(entity) {
  const reasons = [];
  
  if (entity.ativo === false) {
    reasons.push('Inativo');
  }
  
  const status = (entity.statusPublicacao || entity.status || '').toLowerCase();
  if (status === 'draft') {
    reasons.push('Rascunho');
  } else if (status === 'scheduled') {
    reasons.push('Agendado');
  }
  
  if (entity.effectiveVisibility === 'RESTRICTED') {
    const types = entity.effectiveAllowedUserTypes || [];
    if (types.length === 0) {
      reasons.push('Sem tipos de usuário');
    }
  }
  
  return reasons;
}

export function PreviewModal({ open, onClose, allTrilhas = [], allCursos = [] }) {
  const [selectedUserType, setSelectedUserType] = useState('medico');
  const [trilhas, setTrilhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHiddenItems, setShowHiddenItems] = useState(false);

  useEffect(() => {
    if (!open || !selectedUserType) return;

    async function fetchPreview() {
      setLoading(true);
      setError(null);
      
      try {
        // [OK] USAR QUERIES STUDENT-SAFE (sem junction tables)
        const trilhasData = await educacaoService.getTrilhasForStudent(selectedUserType);
        setTrilhas(trilhasData);
      } catch (err) {
        console.error('Erro ao buscar preview:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [open, selectedUserType]);

  // Calcular itens ocultos (admin tem, aluno não vê)
  const hiddenStats = useMemo(() => {
    const visibleIds = new Set(trilhas.map(t => t.id));
    const hiddenTrilhas = (allTrilhas || []).filter(t => 
      t.ativo !== false && !visibleIds.has(t.id)
    );
    
    return {
      trilhas: hiddenTrilhas.length,
      total: hiddenTrilhas.length,
    };
  }, [trilhas, allTrilhas]);

  // Trilhas ocultas com motivo
  const hiddenTrilhas = useMemo(() => {
    if (!showHiddenItems) return [];
    const visibleIds = new Set(trilhas.map(t => t.id));
    return (allTrilhas || [])
      .filter(t => t.ativo !== false && !visibleIds.has(t.id))
      .map(t => ({
        ...t,
        hiddenReasons: getHiddenReason(t),
      }));
  }, [showHiddenItems, trilhas, allTrilhas]);

  if (!open) return null;

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <ModalHeader>
          <ModalTitle>Preview - Visão do Aluno</ModalTitle>
        </ModalHeader>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium mb-2">
                Tipo de Usuário
              </label>
              <Select
                value={selectedUserType}
                onValueChange={setSelectedUserType}
              >
                {Object.entries(TIPOS_USUARIO).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <Alert variant="info" className="flex-1">
              Mostrando apenas PUBLISHED + visível para {TIPOS_USUARIO[selectedUserType]?.label}
            </Alert>
          </div>

          {/* Toggle para mostrar itens ocultos */}
          {hiddenStats.total > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>{hiddenStats.total}</strong> item(s) oculto(s) para este tipo de usuário
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-hidden"
                  checked={showHiddenItems}
                  onChange={setShowHiddenItems}
                />
                <label htmlFor="show-hidden" className="text-sm cursor-pointer">
                  Mostrar ocultos
                </label>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="error" title="Erro">
              {error}
            </Alert>
          )}

          <div className="border border-border rounded-lg p-4 min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando preview...</p>
              </div>
            ) : trilhas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Nenhum conteúdo disponível</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há trilhas visíveis para {TIPOS_USUARIO[selectedUserType]?.label}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <StudentTreeView 
                  trilhas={trilhas} 
                  userType={selectedUserType}
                />
                
                {/* Itens ocultos */}
                {showHiddenItems && hiddenTrilhas.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-dashed border-border">
                    <div className="flex items-center gap-2 mb-4">
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Itens não visíveis para {TIPOS_USUARIO[selectedUserType]?.label}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {hiddenTrilhas.map(trilha => (
                        <HiddenItemCard 
                          key={trilha.id}
                          item={trilha}
                          type="trilha"
                          reasons={trilha.hiddenReasons}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <Alert variant="default" title="Preview Student-Safe" className="text-xs">
            Usa getTrilhasForStudent() e queries reais do aluno (publishedCursoIds, publishedModuloIds, publishedAulaIds). NÃO usa junction tables.
          </Alert>
        </div>

        <ModalFooter>
          <Button onClick={onClose}>Fechar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function StudentTreeView({ trilhas, userType }) {
  return (
    <div className="space-y-4">
      {trilhas.map(trilha => (
        <TrilhaPreviewCard 
          key={trilha.id} 
          trilha={trilha} 
          userType={userType}
        />
      ))}
    </div>
  );
}

/**
 * HiddenItemCard - Mostra item oculto com motivos
 */
function HiddenItemCard({ item, type, reasons = [] }) {
  const icons = {
    trilha: GitBranch,
    curso: BookOpen,
    modulo: FolderOpen,
    aula: Video,
  };
  const Icon = icons[type] || BookOpen;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg",
      "bg-muted/30 border border-dashed border-muted-foreground/30",
      "opacity-60"
    )}>
      <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground truncate">
          {item.titulo}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {reasons.map((reason, i) => (
          <Badge 
            key={i} 
            variant="secondary" 
            badgeStyle="subtle"
            className="text-[10px]"
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            {reason}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TrilhaPreviewCard({ trilha, userType }) {
  const [expanded, setExpanded] = useState(false);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      // [OK] Buscar cursos usando publishedCursoIds (NÃO junction table)
      const cursosData = await educacaoService.getCursosForStudent(trilha.id, userType);
      setCursos(cursosData);
      setExpanded(true);
    } catch (err) {
      console.error('Erro ao buscar cursos:', err);
    } finally {
      setLoading(false);
    }
  }

  const cursosCount = trilha.publishedCursoIds?.length || 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <GitBranch className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-medium truncate">{trilha.titulo}</h4>
              {trilha.descricao && (
                <p className="text-sm text-muted-foreground truncate">{trilha.descricao}</p>
              )}
              
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" className="text-xs">
                  PUBLISHED
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {cursosCount} {cursosCount === 1 ? 'curso' : 'cursos'}
                </Badge>
                {trilha.effectiveVisibility === 'RESTRICTED' && (
                  <Badge variant="secondary" className="text-xs">
                    RESTRICTED
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
            disabled={loading || cursosCount === 0}
            className="flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : expanded ? (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4 mr-1" />
                Ver cursos
              </>
            )}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 pl-8 space-y-2 border-l-2 border-border">
            {cursos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum curso disponível
              </p>
            ) : (
              cursos.map(curso => (
                <CursoPreviewItem 
                  key={curso.id} 
                  curso={curso} 
                  userType={userType}
                />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CursoPreviewItem({ curso, userType }) {
  const [expanded, setExpanded] = useState(false);
  const [modulos, setModulos] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      // [OK] Buscar módulos usando publishedModuloIds (NÃO junction table)
      const modulosData = await educacaoService.getModulosForStudent(curso.id, userType);
      setModulos(modulosData);
      setExpanded(true);
    } catch (err) {
      console.error('Erro ao buscar módulos:', err);
    } finally {
      setLoading(false);
    }
  }

  const modulosCount = curso.publishedModuloIds?.length || 0;

  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{curso.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {modulosCount} {modulosCount === 1 ? 'módulo' : 'módulos'}
            </p>
          </div>
        </div>

        {modulosCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
            disabled={loading}
            className="flex-shrink-0 h-7 text-xs"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 pl-6 space-y-1 border-l border-border">
          {modulos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Nenhum módulo disponível
            </p>
          ) : (
            modulos.map(modulo => (
              <ModuloPreviewItem 
                key={modulo.id} 
                modulo={modulo} 
                userType={userType}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ModuloPreviewItem({ modulo, userType }) {
  const [expanded, setExpanded] = useState(false);
  const [aulas, setAulas] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      // [OK] Buscar aulas usando publishedAulaIds (NÃO junction table)
      const aulasData = await educacaoService.getAulasForStudent(modulo.id, userType);
      setAulas(aulasData);
      setExpanded(true);
    } catch (err) {
      console.error('Erro ao buscar aulas:', err);
    } finally {
      setLoading(false);
    }
  }

  const aulasCount = modulo.publishedAulaIds?.length || 0;

  return (
    <div className="p-2 bg-background rounded">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{modulo.titulo}</p>
            <p className="text-[10px] text-muted-foreground">
              {aulasCount} {aulasCount === 1 ? 'aula' : 'aulas'}
            </p>
          </div>
        </div>

        {aulasCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpand}
            disabled={loading}
            className="flex-shrink-0 h-6 w-6 p-0"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-1">
          {aulas.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">
              Nenhuma aula disponível
            </p>
          ) : (
            aulas.map(aula => (
              <div 
                key={aula.id}
                className="flex items-center gap-2 p-1.5 rounded bg-muted/30"
              >
                <Video className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs truncate">{aula.titulo}</span>
                {aula.duracao && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {aula.duracao}min
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
