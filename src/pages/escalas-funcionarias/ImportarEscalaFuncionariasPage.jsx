/**
 * ImportarEscalaFuncionariasPage — importação in-app do docx da escala mensal
 * das funcionárias (sobreaviso materno + hospitais UNIMED/HRO/Plantão Pago).
 *
 * Fluxo (molde do ImportarEscalaPage da escala cirúrgica): anexar docx →
 * parse determinístico no browser (escalaFuncionariasDocx) → conferência
 * editável (issues bloqueiam publicar; avisos não — fuzzy tem botão de
 * aplicar) → publica o MÊS INTEIRO em escalasFuncionarias/{YYYY-MM}.
 * Sem deploy: todos os consumidores leem a base dinâmica na hora.
 *
 * Overlay renderizado pelo EscalasFuncionariasHubPage (não é rota própria).
 */
import { useState, useMemo } from 'react';
import { ChevronLeft, Check, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Button, ConfirmDialog, FileUpload, Select, useToast } from '@/design-system';
import { useUser } from '@/contexts/UserContext';
import { useSobreavisoMaterno } from '@/hooks/useSobreavisoMaterno';
import { parseEscalaFuncionariasDocx, validarEscalaFuncionarias } from '@/lib/escalaFuncionariasDocx';
import { getEscalaMes, publicarEscalaMes } from '@/services/escalasFuncionariasService';
import { FUNCIONARIAS_SOBREAVISO } from '@/data/sobreavisoMaterno2026';
import { FUNCIONARIAS_HOSPITAIS } from '@/data/hospitaisTecnicas2026';
import { FERIADO_LABELS } from '@/data/plantao2026';

const DIAS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const OPCOES_SOBREAVISO = FUNCIONARIAS_SOBREAVISO.map((f) => ({ value: f.id, label: f.nome }));
const OPCOES_HOSPITAL = [{ value: '', label: '—' }, ...FUNCIONARIAS_HOSPITAIS.map((f) => ({ value: f.nome, label: f.nome }))];

const diasNoMes = (mes) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const weekdayDe = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};
const fmtDia = (dateKey) => {
  const [, m, d] = dateKey.split('-');
  return `${d}/${m} · ${DIAS_PT[weekdayDe(dateKey)]}`;
};
const nomeMes = (mes) => {
  const [y, m] = mes.split('-').map(Number);
  return `${MES_PT[m - 1]}/${y}`;
};

export default function ImportarEscalaFuncionariasPage({ onClose }) {
  const { toast } = useToast();
  const { firebaseUser } = useUser();
  const { canEdit } = useSobreavisoMaterno();

  const [arquivoNome, setArquivoNome] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [mes, setMes] = useState(null);
  const [sobreaviso, setSobreaviso] = useState({});
  const [hospitais, setHospitais] = useState({});
  const [avisosFuzzy, setAvisosFuzzy] = useState([]); // do parse; somem ao aplicar/editar
  const [erroParse, setErroParse] = useState(null);
  const [substituir, setSubstituir] = useState(null); // { totais } do mês já publicado

  const temBase = Boolean(mes);

  // Revalida o estado EDITADO — a mesma régua do parser, sempre atual
  const validacao = useMemo(
    () => (temBase ? validarEscalaFuncionarias(sobreaviso, hospitais, mes) : { issues: [], avisos: [] }),
    [temBase, sobreaviso, hospitais, mes]
  );

  // Dias exibidos na seção Hospitais: FDS + feriados conhecidos + dias com entry
  const diasHospital = useMemo(() => {
    if (!mes) return [];
    const dias = new Set(Object.keys(hospitais));
    for (let d = 1; d <= diasNoMes(mes); d++) {
      const key = `${mes}-${String(d).padStart(2, '0')}`;
      const wd = weekdayDe(key);
      if (wd === 0 || wd === 6 || key in FERIADO_LABELS) dias.add(key);
    }
    return [...dias].sort();
  }, [mes, hospitais]);

  const issuesPorDia = useMemo(() => {
    const map = {};
    for (const i of validacao.issues) {
      if (i.dateKey) (map[i.dateKey] ||= []).push(i);
    }
    return map;
  }, [validacao.issues]);

  async function importarArquivo(file) {
    if (!file) return;
    setCarregando(true);
    setErroParse(null);
    try {
      const r = await parseEscalaFuncionariasDocx(file);
      if (!r.mes && r.meses.length !== 1) {
        setErroParse(
          r.meses.length === 0
            ? 'Nenhuma linha com data encontrada — o arquivo é o docx da escala mensal?'
            : `O arquivo abrange ${r.meses.length} meses (${r.meses.join(', ')}) — importe um mês por vez.`
        );
        return;
      }
      setMes(r.mes);
      setSobreaviso(r.sobreaviso);
      setHospitais(r.hospitais);
      setAvisosFuzzy(r.avisos.filter((a) => a.tipo === 'nome-fuzzy'));
      setArquivoNome(file.name || null);
    } catch (e) {
      console.error('Erro ao ler docx da escala:', e);
      setErroParse(e.message || 'Não foi possível ler o arquivo.');
    } finally {
      setCarregando(false);
    }
  }

  function setSobreavisoDia(dateKey, id) {
    setSobreaviso((s) => ({ ...s, [dateKey]: id }));
    setAvisosFuzzy((a) => a.filter((x) => !(x.dateKey === dateKey && x.campo === 'sobreaviso')));
  }

  function setHospitalDia(dateKey, campo, nome) {
    setHospitais((h) => {
      const atual = h[dateKey] || { unimed: null, hro: null, plantaoPago: null, label: FERIADO_LABELS[dateKey] || null };
      return { ...h, [dateKey]: { ...atual, [campo]: nome || null } };
    });
    setAvisosFuzzy((a) => a.filter((x) => !(x.dateKey === dateKey && x.campo === campo)));
  }

  function aplicarSugestao(aviso) {
    const f = FUNCIONARIAS_SOBREAVISO.find((x) => x.id === aviso.sugestaoId);
    if (!f) return;
    if (aviso.campo === 'sobreaviso') setSobreavisoDia(aviso.dateKey, f.id);
    else setHospitalDia(aviso.dateKey, aviso.campo, f.nome);
  }

  async function publicar(confirmado = false) {
    if (!mes || validacao.issues.length > 0 || publicando) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast({ title: 'Sem conexão', description: 'A publicação precisa de internet — tente de novo quando estiver online.', variant: 'destructive' });
      return;
    }
    setPublicando(true);
    try {
      if (!confirmado) {
        const { data: existente } = await getEscalaMes(mes);
        if (existente) {
          setSubstituir({ totais: existente.totais || null });
          return;
        }
      }
      const { success, error } = await publicarEscalaMes(mes, { sobreaviso, hospitais, arquivoNome }, firebaseUser?.uid);
      if (success) {
        toast({ title: `Escala de ${nomeMes(mes)} publicada`, description: `${Object.keys(sobreaviso).length} dias de sobreaviso · ${Object.keys(hospitais).length} dias de hospitais. Vale para todos, sem precisar de atualização.` });
        onClose?.();
      } else {
        toast({ title: 'Não foi possível publicar', description: error || 'Tente novamente.', variant: 'destructive' });
      }
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto">
      {/* Header sticky (mesma razão do ImportarEscalaPage: PageHeader fixo cobria o corpo no PWA) */}
      <div className="sticky top-0 z-10 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Cancelar"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">
            Importar escala do mês
          </h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para publicar a escala das funcionárias.</p>
        )}

        <FileUpload
          accept=".docx"
          maxSize={10 * 1024 * 1024}
          variant="dropzone"
          label="Docx da escala preenchida"
          description="O docx mensal preenchido (sobreaviso + hospitais). A leitura é automática e a conferência aparece abaixo."
          onChange={(f) => importarArquivo(Array.isArray(f) ? f[0] : f)}
          disabled={carregando || !canEdit}
        />

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lendo…</p>
        )}

        {erroParse && (
          <p className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">{erroParse}</p>
        )}

        {temBase && (
          <>
            {/* Issues — bloqueiam a publicação */}
            {validacao.issues.length > 0 && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-1.5">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {validacao.issues.length === 1 ? '1 pendência impede a publicação' : `${validacao.issues.length} pendências impedem a publicação`}
                </p>
                <ul className="space-y-0.5">
                  {validacao.issues.slice(0, 8).map((i, idx) => (
                    <li key={idx} className="text-xs text-destructive">{i.dateKey ? `${fmtDia(i.dateKey)} — ` : ''}{i.msg}</li>
                  ))}
                  {validacao.issues.length > 8 && (
                    <li className="text-xs text-destructive">…e mais {validacao.issues.length - 8}. Corrija nos campos abaixo.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Avisos fuzzy — nome parecido, aplicar é um toque, nunca automático */}
            {avisosFuzzy.map((a, idx) => (
              <div key={idx} className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <p className="text-xs text-warning flex-1">{fmtDia(a.dateKey)} — {a.msg}</p>
                <Button size="sm" variant="outline" onClick={() => aplicarSugestao(a)}>
                  Usar {FUNCIONARIAS_SOBREAVISO.find((f) => f.id === a.sugestaoId)?.nome}
                </Button>
              </div>
            ))}

            {/* Demais avisos da revalidação (não bloqueiam) */}
            {validacao.avisos.map((a, idx) => (
              <div key={`v${idx}`} className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-warning shrink-0" />
                <p className="text-xs text-warning flex-1">{fmtDia(a.dateKey)} — {a.msg}</p>
              </div>
            ))}

            {/* Conferência: Sobreaviso (1 linha por dia) */}
            <section className="rounded-2xl bg-card border border-border-strong p-4 space-y-2">
              <h2 className="text-sm font-bold text-foreground">Sobreaviso materno — {nomeMes(mes)}</h2>
              <p className="text-xs text-muted-foreground">19h → 07h, uma funcionária por dia.</p>
              <div className="space-y-1.5">
                {Array.from({ length: diasNoMes(mes) }, (_, i) => {
                  const key = `${mes}-${String(i + 1).padStart(2, '0')}`;
                  const comIssue = (issuesPorDia[key] || []).some((x) => x.tipo === 'sobreaviso-vazio');
                  return (
                    <div key={key} className={`flex items-center gap-2 rounded-lg p-1.5 ${comIssue ? 'bg-destructive/10' : ''}`}>
                      <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{fmtDia(key)}</span>
                      <div className="flex-1 min-w-0">
                        <Select
                          value={sobreaviso[key] || ''}
                          onChange={(v) => setSobreavisoDia(key, v)}
                          options={OPCOES_SOBREAVISO}
                          placeholder="—"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Conferência: Hospitais (FDS + feriados) */}
            <section className="rounded-2xl bg-card border border-border-strong p-4 space-y-3">
              <h2 className="text-sm font-bold text-foreground">Hospitais — FDS e feriados</h2>
              <p className="text-xs text-muted-foreground">UNIMED só sábado/feriado · HRO e Plantão Pago em todo FDS/feriado.</p>
              {diasHospital.map((key) => {
                const entry = hospitais[key] || {};
                const isDom = weekdayDe(key) === 0;
                const label = entry.label || FERIADO_LABELS[key] || null;
                const comIssue = (issuesPorDia[key] || []).some((x) => x.tipo !== 'sobreaviso-vazio');
                return (
                  <div key={key} className={`rounded-lg p-2 space-y-1.5 ${comIssue ? 'bg-destructive/10' : 'bg-muted/40'}`}>
                    <p className="text-xs font-semibold text-foreground">
                      {fmtDia(key)}{label ? <span className="ml-1.5 font-normal text-muted-foreground">· {label}</span> : null}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {[['unimed', 'UNIMED'], ['hro', 'HRO'], ['plantaoPago', 'Plantão Pago']].map(([campo, rotulo]) => (
                        <div key={campo}>
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{rotulo}{campo === 'unimed' && isDom ? ' (dom. não tem)' : ''}</span>
                          <Select
                            value={entry[campo] || ''}
                            onChange={(v) => setHospitalDia(key, campo, v)}
                            options={OPCOES_HOSPITAL}
                            placeholder="—"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>

      {temBase && canEdit && (
        <div className="fixed bottom-0 inset-x-0 z-modal border-t border-border bg-card p-3 flex gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => publicar()} disabled={publicando || validacao.issues.length > 0} className="flex-1">
            {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Publicar {nomeMes(mes)}
          </Button>
        </div>
      )}

      {substituir && (
        <ConfirmDialog
          open
          variant="danger"
          onClose={() => { setSubstituir(null); setPublicando(false); }}
          onConfirm={() => { setSubstituir(null); publicar(true); }}
          title={`Substituir a escala de ${nomeMes(mes)}?`}
          description={`Este mês já foi publicado${substituir.totais ? ` (${substituir.totais.sobreaviso} dias de sobreaviso · ${substituir.totais.hospitais} de hospitais)` : ''}. Publicar de novo SUBSTITUI o mês inteiro pelo que está na tela — trocas já aceitas continuam valendo (são gravadas por dia, à parte).`}
          confirmText="Substituir mês"
          cancelText="Cancelar"
        />
      )}
    </div>
  );
}
