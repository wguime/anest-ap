/**
 * PreviewModal - Student-Safe
 * 
 * USA AS MESMAS QUERIES DO ALUNO (sem junction tables)
 * Preview === Realidade do Aluno
 */

import { useState, useEffect } from 'react';
import { 
  Modal, 
  ModalHeader, 
  ModalTitle, 
  ModalContent, 
  ModalFooter, 
  Select, 
  Alert, 
  AlertDescription,
  Button, 
  EmptyState,
  Card,
  CardContent,
  Badge,
  Spinner,
} from '@/design-system';
import { TIPOS_USUARIO } from '../../data/mockEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { BookOpen, Info, GitBranch, FolderOpen, Video, ChevronRight, ChevronDown } from 'lucide-react';

export function PreviewModal({ open, onClose }) {
  const [selectedUserType, setSelectedUserType] = useState('medico');
  const [trilhas, setTrilhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <ModalHeader>
        <ModalTitle>Preview - Visão do Aluno</ModalTitle>
      </ModalHeader>

      <ModalContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 w-full">
            <Select
              value={selectedUserType}
              onChange={setSelectedUserType}
              options={Object.entries(TIPOS_USUARIO).map(([key, { label }]) => ({
                value: key,
                label,
              }))}
              label="Tipo de Usuário"
            />
          </div>

          <Alert variant="info" className="flex-1">
            <Info className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Mostrando apenas PUBLISHED + visível para {TIPOS_USUARIO[selectedUserType]?.label}
            </AlertDescription>
          </Alert>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Erro: {error}</AlertDescription>
          </Alert>
        )}

        <div className="border border-border rounded-lg p-4 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Spinner className="w-8 h-8" />
              <p className="text-sm text-muted-foreground">Carregando preview...</p>
            </div>
          ) : trilhas.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-12 h-12" />}
              title="Nenhum conteúdo disponível"
              description={`Não há trilhas visíveis para ${TIPOS_USUARIO[selectedUserType]?.label}`}
            />
          ) : (
            <StudentTreeView 
              trilhas={trilhas} 
              userType={selectedUserType}
            />
          )}
        </div>

        <Alert variant="default" className="text-xs">
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>Preview Student-Safe:</strong> Usa as mesmas queries do aluno 
            (sem junction tables). publishedCursoIds, publishedModuloIds, publishedAulaIds.
          </AlertDescription>
        </Alert>
      </ModalContent>

      <ModalFooter>
        <Button onClick={onClose}>Fechar</Button>
      </ModalFooter>
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
              <p className="text-sm text-muted-foreground truncate">{trilha.descricao}</p>
              
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success" badgeStyle="subtle" className="text-xs">
                  PUBLISHED
                </Badge>
                <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
                  {cursosCount} {cursosCount === 1 ? 'curso' : 'cursos'}
                </Badge>
                {trilha.effectiveVisibility === 'RESTRICTED' && (
                  <Badge variant="secondary" badgeStyle="subtle" className="text-xs">
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
              <Spinner className="w-4 h-4" />
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
              <Spinner className="w-3 h-3" />
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
              <Spinner className="w-3 h-3" />
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
