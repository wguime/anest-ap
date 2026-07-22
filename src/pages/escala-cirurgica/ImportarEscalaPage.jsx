/**
 * ImportarEscalaPage — confecção da escala pela secretária.
 * Fonte: Excel (Unimed) · Imagem/Vision (HRO/Materno) · Manual → base cirúrgica SEM
 * anestesista. A secretária ATRIBUI o anestesista de cada sala selecionando do roster
 * (login), o que resolve a identidade na origem (sem match por nome). Ao atribuir, o
 * apelido importado é aprendido no dicionário (apelido→login) p/ a próxima escala.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, Plus, Trash2, Sparkles, Loader2, Check, Users, AlertTriangle } from 'lucide-react'
import { Button, DatePicker, FileUpload, Input, Select, useToast } from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { parseExcelEscala } from '@/lib/excelEscala'
import SegmentedSelector from './SegmentedSelector'
import { normNome, agruparPorSala, compararSalas, aplicarAtribuicoes, detectarConflitos, normalizarSalaUnimed, normalizarSalaHro, blocoDaSalaUnimed, turnoAtual } from './utils'

const HOSPITAL_OPCOES = Object.entries(HOSPITAL_LABEL).map(([value, label]) => ({ value, label }))
const PERIODO_OPCOES = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
]
const dataToISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const linhaVazia = (sala = '') => ({
  sala, hora: '', pacienteIniciais: '', procedimento: '',
  cirurgiao: '', anestesista: '', bloco: 'normal', tipo: 'eletiva',
})

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

const primeiroNomeUpper = (nome) => normNome(String(nome || '').split(/\s+/)[0] || '')

// Normalização de salas na importação (pedidos 2026-07-21):
// Unimed — "CENTRO CIRÚRGICO - SALA 1" → "CC - Sala 1" + bloco pela seção;
// HRO — "CO" → "Sala 7 - CO", "HO" → "Hospital de Olhos".
const normalizarCasosImportados = (rows, hosp) => {
  if (hosp === 'unimed') {
    return rows.map((c) => {
      const sala = normalizarSalaUnimed(c.sala)
      return { ...c, sala, bloco: c.bloco && c.bloco !== 'normal' ? c.bloco : blocoDaSalaUnimed(sala) }
    })
  }
  if (hosp === 'hro') return rows.map((c) => ({ ...c, sala: normalizarSalaHro(c.sala) }))
  return rows
}

export default function ImportarEscalaPage({ hospital, data, onClose }) {
  const { toast } = useToast()
  const { salvarEscala } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { options: rosterOpcoes, rosterByUid, resolver, upsertAlias } = useRosterAnestesistas()

  const [casos, setCasos] = useState([])
  const [atribuicoes, setAtribuicoes] = useState({}) // sala -> uid
  const [ordemTexto, setOrdemTexto] = useState('')
  const [ajudaTexto, setAjudaTexto] = useState('') // nomes em AZUL (ajuda de outro hospital)
  const [carregando, setCarregando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  // Hospital da escala é escolhido AQUI (pedido do dono 2026-07-21) — entra
  // pré-selecionado com o hospital da página, mas a escala pode ser de outro.
  const [hosp, setHosp] = useState(hospital || 'unimed')
  // Data + período NO CORPO (pedido 2026-07-22 — a data era fixa no header)
  const [dataEscolhida, setDataEscolhida] = useState(data)
  const [periodo, setPeriodo] = useState(() => turnoAtual())
  // Sugestão de hospital pelo layout do anexo (Vision/Excel) — confirmar, nunca trocar sozinho.
  const [sugestaoHosp, setSugestaoHosp] = useState(null) // { hospital, origem: 'vision'|'excel' }
  const [ultimoArquivo, setUltimoArquivo] = useState(null) // p/ reler a imagem com o hint certo

  const canEdit = !!(user?.isAdmin || ['anestesiologista', 'medico-residente', 'secretaria'].includes((user?.role || '').toLowerCase()))


  // Salas distintas (ordenadas) + texto de anestesista importado por sala.
  const salas = useMemo(() => [...agruparPorSala(casos).keys()].sort(compararSalas(hosp)), [casos, hosp])
  const textoSala = useMemo(() => {
    const m = {}
    for (const c of casos) {
      const t = String(c.anestesista || '').trim()
      if (t && t !== '//' && !m[c.sala]) m[c.sala] = t
    }
    return m
  }, [casos])

  // Pré-atribui pela resolução do apelido importado (dicionário), sem sobrescrever escolha.
  useEffect(() => {
    setAtribuicoes((prev) => {
      let changed = false
      const next = { ...prev }
      for (const sala of salas) {
        if (next[sala] !== undefined) continue
        const uid = resolver(textoSala[sala] || '')
        if (uid) { next[sala] = uid; changed = true }
      }
      return changed ? next : prev
    })
  }, [salas, textoSala, resolver])

  const apelidoExibicao = useCallback((sala, uid) => {
    const txt = textoSala[sala]
    if (txt) return normNome(txt)
    const r = rosterByUid.get(uid)
    return r ? (r.apelidos[0] || primeiroNomeUpper(r.nome)) : ''
  }, [textoSala, rosterByUid])

  // Conflito: mesmo login em 2 salas com horário sobreposto (avisa, não bloqueia).
  const conflitos = useMemo(
    () => (casos.length ? detectarConflitos(aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao)) : []),
    [casos, atribuicoes, apelidoExibicao]
  )

  // ── Importação ─────────────────────────────────────────────────────────────
  // Roteia pelo tipo do arquivo: planilha → parser local; imagem → Vision.
  const importarArquivo = (file) => {
    if (!file) return
    setUltimoArquivo(file)
    setSugestaoHosp(null)
    if (/\.(xlsx?|csv)$/i.test(file.name || '')) {
      // Excel/CSV é o export padrão da Unimed — sugere se o hospital escolhido for outro
      if (hosp !== 'unimed') setSugestaoHosp({ hospital: 'unimed', origem: 'excel' })
      return importarExcel(file)
    }
    if (String(file.type || '').startsWith('image/')) return importarImagem(file)
    toast({ variant: 'error', title: 'Formato não suportado', description: 'Envie Excel (.xlsx/.xls/.csv) ou uma imagem da escala.' })
  }

  const importarExcel = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      const { casos: rows, headerScore } = await parseExcelEscala(file)
      if (!rows.length) {
        toast({ variant: 'error', title: 'Não consegui ler a planilha', description: 'Confira o arquivo ou use entrada manual.' })
        setCasos([linhaVazia()])
      } else {
        setCasos(normalizarCasosImportados(rows, hosp))
        toast({ variant: 'success', title: `${rows.length} casos lidos`, description: `Atribua o anestesista de cada sala. (colunas reconhecidas: ${headerScore})` })
      }
    } catch {
      toast({ variant: 'error', title: 'Falha ao ler Excel', description: 'Preencha manualmente.' })
      setCasos([linhaVazia()])
    } finally { setCarregando(false) }
  }

  const importarImagem = async (file, hospParam = hosp) => {
    if (!file) return
    setCarregando(true)
    try {
      const imageBase64 = await fileToBase64(file)
      const res = await svc.parseEscalaImagem({ imageBase64, mimeType: file.type, hospital: hospParam })
      setCasos(normalizarCasosImportados((res.casos || []).map((c) => ({ ...linhaVazia(), ...c })), hospParam))
      if (res.ordemLiberacao?.length) setOrdemTexto(res.ordemLiberacao.join(', '))
      if (res.ajudaExterna?.length) setAjudaTexto(res.ajudaExterna.join(', '))
      // Layout de outro hospital? Sugere (o dono confirma — nunca troca sozinho).
      const det = String(res.hospitalDetectado || '')
      setSugestaoHosp(det && det !== hospParam ? { hospital: det, origem: 'vision' } : null)
      toast({ variant: 'success', title: `${res.casos?.length || 0} casos extraídos`, description: 'Confira e atribua o anestesista de cada sala.' })
    } catch {
      toast({ variant: 'error', title: 'Falha na extração', description: 'Preencha manualmente.' })
      if (!casos.length) setCasos([linhaVazia()])
    } finally { setCarregando(false) }
  }

  // Aceita a sugestão: troca o hospital e, se veio da Vision, RELÊ a imagem com o
  // hint certo (o prompt por formato extrai melhor com o hospital correto).
  const aplicarSugestaoHosp = () => {
    if (!sugestaoHosp) return
    const d = sugestaoHosp.hospital
    setHosp(d)
    const relerImagem = sugestaoHosp.origem === 'vision' && ultimoArquivo
    setSugestaoHosp(null)
    if (relerImagem) importarImagem(ultimoArquivo, d)
  }

  // ── Edição da base ───────────────────────────────────────────────────────────
  const setCampo = (i, campo, valor) => setCasos((cs) => cs.map((c, k) => (k === i ? { ...c, [campo]: valor } : c)))
  const addLinha = () => setCasos((cs) => [...cs, linhaVazia()])
  const removeLinha = (i) => setCasos((cs) => cs.filter((_, k) => k !== i))

  const preencherRodape = () => {
    const nomes = salas.map((s) => apelidoExibicao(s, atribuicoes[s])).filter(Boolean)
    setOrdemTexto([...new Set(nomes)].join(', '))
  }

  const salasSemAnestesista = salas.filter((s) => !atribuicoes[s]).length

  // ── Publicação ───────────────────────────────────────────────────────────────
  const publicar = async () => {
    setPublicando(true)
    try {
      const userId = user?.uid || user?.id
      // Aprende apelido→login: quando a sala tinha apelido importado e recebeu um login.
      await Promise.all(salas.map(async (sala) => {
        const uid = atribuicoes[sala]
        const txt = textoSala[sala]
        if (uid && txt && resolver(txt) !== uid) {
          try { await upsertAlias({ apelido: txt, userId: uid, createdBy: userId }) } catch { /* segue */ }
        }
      }))

      const casosOut = aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao)
      const ordemLiberacao = ordemTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
      const ajudaExterna = ajudaTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)

      await salvarEscala(
        { data: dataEscolhida, hospital: hosp, casos: casosOut, ordemLiberacao, ajudaExterna, status: 'publicada' },
        { userId, userName: user?.displayName }
      )
      toast({ variant: 'success', title: 'Escala publicada', description: 'Anestesistas atribuídos serão notificados.' })
      // devolve onde publicou → a página aterrissa na escala certa (data/hospital/período)
      onClose?.({ data: dataEscolhida, hospital: hosp, turno: periodo })
    } catch {
      /* toast no context */
    } finally { setPublicando(false) }
  }

  const temBase = casos.length > 0

  return (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto">
      {/* Header STICKY próprio (2026-07-22): o PageHeader é position:fixed com spacer
          de altura fixa — no PWA (safe-area do iPhone) ele cobria os seletores.
          Sticky dimensiona pelo conteúdo, respeita o notch e nunca sobrepõe. */}
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
            Confeccionar · {HOSPITAL_LABEL[hosp]}
          </h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para confeccionar escalas.</p>
        )}

        {/* Data + período da escala NO CORPO (pedido 2026-07-22 — antes era fixo no header) */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Data e período da escala</label>
          <div className="flex items-stretch gap-2">
            <DatePicker
              className="flex-1 min-w-0"
              value={(() => { const [y, m, d] = String(dataEscolhida || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
              onChange={(d) => d && setDataEscolhida(dataToISO(d))}
              placeholder="Data da escala"
            />
            <SegmentedSelector className="flex-1" options={PERIODO_OPCOES} value={periodo} onChange={setPeriodo} />
          </div>
        </div>

        {/* Hospital da escala (pedido do dono 2026-07-21): editável aqui — a escala
            pode ser de outro hospital que não o selecionado na página. */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital desta escala</label>
          <SegmentedSelector options={HOSPITAL_OPCOES} value={hosp} onChange={(v) => { setHosp(v); setSugestaoHosp(null) }} />
        </div>

        {/* Sugestão pelo layout do anexo — confirmar, nunca trocar sozinho */}
        {sugestaoHosp && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning flex-1">
              O anexo parece ser do <strong>{HOSPITAL_LABEL[sugestaoHosp.hospital]}</strong>
              {sugestaoHosp.origem === 'excel' ? ' (Excel é o export padrão da Unimed)' : ' (pelo layout da imagem)'}.
            </p>
            <Button size="sm" variant="outline" onClick={aplicarSugestaoHosp}>
              Usar {HOSPITAL_LABEL[sugestaoHosp.hospital]}{sugestaoHosp.origem === 'vision' ? ' e reler' : ''}
            </Button>
          </div>
        )}

        {/* Anexo ÚNICO multi-formato (pedido do dono 2026-07-21): Excel/CSV → parser
            local; imagem → Vision. Roteia pelo tipo do arquivo — sem seletor de fonte. */}
        <FileUpload accept=".xlsx,.xls,.csv,image/*" maxSize={15 * 1024 * 1024} variant="dropzone"
          label="Arquivo da escala"
          description="Excel/CSV do hospital ou foto/print da escala — a leitura é automática (paciente só por iniciais)."
          onChange={(f) => importarArquivo(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />
        {!temBase && canEdit && (
          <Button variant="outline" onClick={addLinha} className="w-full"><Plus className="w-4 h-4" /> Ou preencher manualmente</Button>
        )}

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lendo…</p>
        )}

        {/* Atribuição por sala (coração da ferramenta) */}
        {temBase && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" /> Atribuir anestesista por sala
            </h2>
            <p className="text-xs text-muted-foreground">Selecione o login de cada sala. A vinculação fica aprendida para as próximas escalas.</p>
            {salas.map((sala) => (
              <div key={sala} className="grid grid-cols-[1fr_1.3fr] items-center gap-2">
                <span className="text-sm font-medium truncate" title={sala}>
                  {sala}{textoSala[sala] ? <span className="text-muted-foreground"> · {textoSala[sala]}</span> : null}
                </span>
                <Select options={rosterOpcoes} value={atribuicoes[sala] || ''}
                  onChange={(v) => setAtribuicoes((p) => ({ ...p, [sala]: v }))}
                  placeholder="Selecionar anestesista…" searchable />
              </div>
            ))}
            {salasSemAnestesista > 0 && (
              <p className="text-xs text-warning">{salasSemAnestesista} sala(s) sem anestesista atribuído.</p>
            )}
          </div>
        )}

        {/* Conflitos de horário (aviso, não bloqueia) */}
        {conflitos.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-1.5">
            <p className="text-sm font-semibold text-warning flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {conflitos.length === 1 ? '1 conflito de horário' : `${conflitos.length} conflitos de horário`}
            </p>
            <p className="text-xs text-muted-foreground">Mesmo anestesista em 2 salas no mesmo horário. Pode publicar mesmo assim — revise se foi intencional.</p>
            <ul className="space-y-0.5">
              {conflitos.map((c, i) => (
                <li key={i} className="text-xs text-warning">{c.nome || 'Anestesista'} — {c.sala1} ({c.hora1}) e {c.sala2} ({c.hora2})</li>
              ))}
            </ul>
          </div>
        )}

        {/* Conferência da base */}
        {temBase && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> Conferir {casos.length} casos</h2>
              <Button size="sm" variant="ghost" onClick={addLinha}><Plus className="w-4 h-4" /> Linha</Button>
            </div>
            {/* Compacto p/ conferir no mobile (pedido 2026-07-21): cabeçalho com
                sala + ANESTESISTA responsável; inputs adensados. */}
            <div className="space-y-2">
              {casos.map((c, i) => {
                const anest = (atribuicoes[c.sala] && apelidoExibicao(c.sala, atribuicoes[c.sala])) || textoSala[c.sala] || ''
                return (
                  <div key={i} className="rounded-xl border border-border bg-card p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-foreground" title={c.sala}>
                        #{i + 1} · {c.sala || 'sem sala'}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {anest && <span className="max-w-[9rem] truncate font-semibold text-primary" title={anest}>{anest}</span>}
                        <button type="button" onClick={() => removeLinha(i)} aria-label="Remover" className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
                      <Input placeholder="Sala" value={c.sala} onChange={(e) => setCampo(i, 'sala', e.target.value)} />
                      <Input placeholder="Hora" value={c.hora} onChange={(e) => setCampo(i, 'hora', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input placeholder="Cirurgião" value={c.cirurgiao} onChange={(e) => setCampo(i, 'cirurgiao', e.target.value)} />
                      <Input placeholder="Paciente (iniciais)" value={c.pacienteIniciais} onChange={(e) => setCampo(i, 'pacienteIniciais', e.target.value)} />
                    </div>
                    <Input placeholder="Procedimento" value={c.procedimento} onChange={(e) => setCampo(i, 'procedimento', e.target.value)} />
                  </div>
                )
              })}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Ordem de liberação (rodapé)</label>
                <Button size="sm" variant="ghost" onClick={preencherRodape}>Preencher da atribuição</Button>
              </div>
              <Input placeholder="Leonardo, Marilio, Diego, …" value={ordemTexto} onChange={(e) => setOrdemTexto(e.target.value)} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Ajuda de outro hospital (nomes em AZUL no rodapé)
              </label>
              <Input placeholder="ex.: Diego, Cury — vão ao fim da liberação (primeiros a sair)"
                value={ajudaTexto} onChange={(e) => setAjudaTexto(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {temBase && canEdit && (
        <div className="fixed bottom-0 inset-x-0 z-modal border-t border-border bg-card p-3 flex gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={publicar} disabled={publicando} className="flex-1">
            {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Publicar
          </Button>
        </div>
      )}
    </div>
  )
}
