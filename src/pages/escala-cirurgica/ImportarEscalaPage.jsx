/**
 * ImportarEscalaPage — confecção da escala pela secretária.
 * Fonte: Excel (Unimed) · Imagem/Vision (HRO/Materno) · Manual → base cirúrgica SEM
 * anestesista. A secretária ATRIBUI o anestesista de cada sala selecionando do roster
 * (login), o que resolve a identidade na origem (sem match por nome). Ao atribuir, o
 * apelido importado é aprendido no dicionário (apelido→login) p/ a próxima escala.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, Trash2, Sparkles, Loader2, Check, Users, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components'
import { Button, FileUpload, Input, Select, useToast } from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { parseExcelEscala } from '@/lib/excelEscala'
import SegmentedSelector from './SegmentedSelector'
import { normNome, agruparPorSala, compararSalas, aplicarAtribuicoes, detectarConflitos } from './utils'

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

export default function ImportarEscalaPage({ hospital, data, onClose }) {
  const { toast } = useToast()
  const { salvarEscala } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { options: rosterOpcoes, rosterByUid, resolver, upsertAlias } = useRosterAnestesistas()

  const [fonte, setFonte] = useState(hospital === 'unimed' ? 'excel' : 'imagem')
  const [casos, setCasos] = useState([])
  const [atribuicoes, setAtribuicoes] = useState({}) // sala -> uid
  const [ordemTexto, setOrdemTexto] = useState('')
  const [ajudaTexto, setAjudaTexto] = useState('') // nomes em AZUL (ajuda de outro hospital)
  const [carregando, setCarregando] = useState(false)
  const [publicando, setPublicando] = useState(false)

  const canEdit = !!(user?.isAdmin || ['anestesiologista', 'medico-residente', 'secretaria'].includes((user?.role || '').toLowerCase()))

  const fonteOpcoes = [
    { value: 'excel', label: 'Excel' },
    { value: 'imagem', label: 'Imagem' },
    { value: 'manual', label: 'Manual' },
  ]

  // Salas distintas (ordenadas) + texto de anestesista importado por sala.
  const salas = useMemo(() => [...agruparPorSala(casos).keys()].sort(compararSalas(hospital)), [casos, hospital])
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
  const importarExcel = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      const { casos: rows, headerScore } = await parseExcelEscala(file)
      if (!rows.length) {
        toast({ variant: 'error', title: 'Não consegui ler a planilha', description: 'Confira o arquivo ou use entrada manual.' })
        setCasos([linhaVazia()])
      } else {
        setCasos(rows)
        toast({ variant: 'success', title: `${rows.length} casos lidos`, description: `Atribua o anestesista de cada sala. (colunas reconhecidas: ${headerScore})` })
      }
    } catch {
      toast({ variant: 'error', title: 'Falha ao ler Excel', description: 'Preencha manualmente.' })
      setCasos([linhaVazia()])
    } finally { setCarregando(false) }
  }

  const importarImagem = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      const imageBase64 = await fileToBase64(file)
      const res = await svc.parseEscalaImagem({ imageBase64, mimeType: file.type, hospital })
      setCasos((res.casos || []).map((c) => ({ ...linhaVazia(), ...c })))
      if (res.ordemLiberacao?.length) setOrdemTexto(res.ordemLiberacao.join(', '))
      if (res.ajudaExterna?.length) setAjudaTexto(res.ajudaExterna.join(', '))
      toast({ variant: 'success', title: `${res.casos?.length || 0} casos extraídos`, description: 'Confira e atribua o anestesista de cada sala.' })
    } catch {
      toast({ variant: 'error', title: 'Falha na extração', description: 'Preencha manualmente.' })
      if (!casos.length) setCasos([linhaVazia()])
    } finally { setCarregando(false) }
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
        { data, hospital, casos: casosOut, ordemLiberacao, ajudaExterna, status: 'publicada' },
        { userId, userName: user?.displayName }
      )
      toast({ variant: 'success', title: 'Escala publicada', description: 'Anestesistas atribuídos serão notificados.' })
      onClose?.()
    } catch {
      /* toast no context */
    } finally { setPublicando(false) }
  }

  const temBase = casos.length > 0

  return (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto">
      <PageHeader title={`Confeccionar · ${HOSPITAL_LABEL[hospital]}`} subtitle={data} onBack={onClose} backLabel="Cancelar" />
      <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para confeccionar escalas.</p>
        )}

        {/* Fonte */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fonte da escala</label>
          <SegmentedSelector options={fonteOpcoes} value={fonte} onChange={setFonte} />
        </div>

        {fonte === 'excel' && (
          <FileUpload accept=".xlsx,.xls,.csv" maxSize={15 * 1024 * 1024} variant="dropzone"
            label="Planilha da Unimed" description="Excel exportado do hospital — a base cirúrgica (sem anestesista)."
            onChange={(f) => importarExcel(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />
        )}
        {fonte === 'imagem' && (
          <FileUpload accept="image/*" maxSize={10 * 1024 * 1024} variant="dropzone"
            label="Foto da escala" description="Print do WhatsApp — a IA extrai os casos (paciente só por iniciais)."
            onChange={(f) => importarImagem(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />
        )}
        {fonte === 'manual' && !temBase && canEdit && (
          <Button variant="outline" onClick={addLinha} className="w-full"><Plus className="w-4 h-4" /> Adicionar casos manualmente</Button>
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
            <div className="space-y-3">
              {casos.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <button type="button" onClick={() => removeLinha(i)} aria-label="Remover" className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Sala" value={c.sala} onChange={(e) => setCampo(i, 'sala', e.target.value)} />
                    <Input placeholder="Hora" value={c.hora} onChange={(e) => setCampo(i, 'hora', e.target.value)} />
                    <Input placeholder="Cirurgião" value={c.cirurgiao} onChange={(e) => setCampo(i, 'cirurgiao', e.target.value)} />
                    <Input placeholder="Paciente (iniciais)" value={c.pacienteIniciais} onChange={(e) => setCampo(i, 'pacienteIniciais', e.target.value)} />
                  </div>
                  <Input placeholder="Procedimento" value={c.procedimento} onChange={(e) => setCampo(i, 'procedimento', e.target.value)} />
                </div>
              ))}
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
