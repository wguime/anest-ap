/**
 * ImportarEscalaFdsPage — conferência do documento "ESCALA DE FINAL DE SEMANA"
 * (fila de liberação ÚNICA do sáb/dom, dono 15/08).
 *
 * Página IRMÃ da ImportarEscalaPage (fluxo e documento diferentes — não estende
 * as 1600 linhas de lá). A foto vai à edge em modo 'fds' e volta como
 * { dias, ignorados }; a secretária confere POR DIA: grade P1–P4 (3 faixas ×
 * 4 colunas), mapeamento Pn→pessoa (com Select de login — o login escolhido
 * VENCE o texto, regra da conferência normal) e a ordem de liberação POR TURNO,
 * exibida NA DIREÇÃO DO DOCUMENTO ("1º→último a ser liberado" — a conferência é
 * a transcrição da foto). A INVERSÃO para a convenção do rodapé acontece uma
 * única vez, no publicar (rodapeDeOrdemDoc).
 *
 * Turno sem a linha explícita no doc (ex.: domingo) nasce com a SUGESTÃO
 * (inverso da escalação, plantões Unimed/HRO por último) marcada "Sugerida —
 * ajuste antes de publicar" (decisão do dono 15/08).
 *
 * Funcionárias (bloco PLANTÃO MATERNO com datas) NUNCA viram posição — a edge
 * as devolve em `ignorados` e aqui viram só um informativo.
 *
 * Publicar = até 4 chamadas rpc_publicar_escala_turno em hospital='fds'
 * (sáb-mat, sáb-vesp, dom-mat, dom-vesp), casos SEMPRE [] (a fila deriva dos
 * casos por hospital, importados no fluxo normal). Republicar é idempotente.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronLeft, Loader2, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, DatePicker, FileUpload, Input, Select, useToast } from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { prepararImagemParaVision } from '@/lib/imagemVision'
import { isPermissionError } from '@/services/supabaseEscalaAnestesistaService'
import {
  FDS_HOSPITAL, FAIXAS_FDS, normalizarPn, normalizarParseFds, sugerirRodapeFds,
  rodapeDeOrdemDoc, sabadoDoFimDeSemana,
} from '@/lib/escalaFds'
import { normNome, candidatosPrimeiroNome, formatData } from './utils'
import { podeEditarEscalaCirurgica } from './gate'

// Turnos PUBLICADOS como linha da fila única (a noite não é turno de caso no
// banco — a fila dela viaja no fds_meta.ordemNoite do mesmo payload).
const TURNOS = ['matutino', 'vespertino']
// Ordem de liberação conferida/editada: os dois turnos publicados MAIS a noite
// (dono 16/08: a fila noturna tem gente da lista numerada além da grade 19-07 —
// sáb P2,P1,P4,P3,P11,P8,P7 · dom P3,P4,P1,P2,P11,P6,P5).
const TURNOS_ORDEM = [...TURNOS, 'noturno']
const TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino', noturno: 'Noturno' }
const FAIXA_LABEL = { '7-13': '7–13h', '13-19': '13–19h', '19-07': '19–07h' }
const COLUNAS = [
  { key: 'unimed', label: 'Unimed' },
  { key: 'hro', label: 'HRO' },
  { key: 'ret1', label: '3ª (retaguarda)' },
  { key: 'ret2', label: '4ª (retaguarda)' },
]

const primeiroNomeUpper = (nome) => normNome(String(nome || '').split(/\s+/)[0] || '')
const ordenarPn = (a, b) => Number(a.slice(1)) - Number(b.slice(1))
const proximoDia = (iso) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

export default function ImportarEscalaFdsPage({ data, onClose }) {
  const { toast } = useToast()
  const { salvarEscalaTurno } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { roster, options: rosterOpcoes, rosterByUid, resolver, upsertAlias } = useRosterAnestesistas()
  const canEdit = podeEditarEscalaCirurgica(user)

  const [sabadoISO, setSabadoISO] = useState(() => sabadoDoFimDeSemana(data) || data)
  const domingoISO = useMemo(() => proximoDia(sabadoISO), [sabadoISO])

  const [dias, setDias] = useState({})       // { [iso]: { grade, posicoes, escalacao, ordem, ordemFonte } }
  const [logins, setLogins] = useState({})   // `${iso}|${pn}` → uid escolhido
  const [ignorados, setIgnorados] = useState([])
  const [avisos, setAvisos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [addSel, setAddSel] = useState({})   // `${iso}|${turno}` → uid do "acrescentar"

  const diasAlvo = [sabadoISO, domingoISO].filter((iso) => dias[iso])

  const importarImagem = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      // mesma redução/normalização do fluxo normal (HEIC do iPhone, POST gigante)
      const img = await prepararImagemParaVision(file)
      const res = await svc.parseEscalaImagem({
        imageBase64: img.base64, mimeType: img.mimeType,
        modo: 'fds', refSabado: sabadoISO, refDomingo: domingoISO,
      })
      if (res?.error === 'extracao_truncada' || res?.error === 'json_invalido') {
        toast({
          variant: 'error', duration: 12000,
          title: 'O documento não coube em uma leitura',
          description: 'Tente um print mais fechado (um dia por vez) — o app aceita reimportar por cima.',
        })
        return
      }
      const norm = normalizarParseFds(res)
      const porData = {}
      const fora = []
      for (const d of norm.dias) {
        if (d.data !== sabadoISO && d.data !== domingoISO) { fora.push(d.data); continue }
        const ordem = {}
        const ordemFonte = {}
        for (const turno of TURNOS_ORDEM) {
          if (d.ordemDoc[turno]?.length) {
            ordem[turno] = d.ordemDoc[turno]
            ordemFonte[turno] = 'documento'
          } else {
            // SUGESTÃO (decisão 2 do dono): inverso da escalação, exibido na
            // direção do documento — reverse(rodapé sugerido)
            ordem[turno] = [...sugerirRodapeFds(d, turno)].reverse()
            ordemFonte[turno] = 'sugerida'
          }
        }
        porData[d.data] = { grade: d.grade, posicoes: d.posicoes, escalacao: d.escalacao, ordem, ordemFonte }
      }
      setDias(porData)
      setLogins({})
      setIgnorados(norm.ignorados)
      setAvisos([
        ...norm.avisos,
        ...fora.map((f) => `${formatData(f)} não é o fim de semana selecionado — dia descartado`),
        ...(res?.truncado ? ['Leitura cortada no fim — confira o domingo antes de publicar'] : []),
      ])
      const n = Object.keys(porData).length
      if (!n) {
        toast({ variant: 'error', title: 'Nenhum dia do FDS reconhecido', description: 'Confira se a foto é do documento de fim de semana e se o sábado selecionado está certo.' })
      } else {
        toast({ variant: 'success', title: `${n} dia${n > 1 ? 's' : ''} lido${n > 1 ? 's' : ''} — confira e publique` })
      }
    } catch (err) {
      console.error('[ImportarEscalaFds] falha na leitura:', err)
      toast({ variant: 'error', title: 'Falha ao ler a imagem', description: 'Tente outra foto/print do documento.' })
    } finally { setCarregando(false) }
  }

  // ── edição ────────────────────────────────────────────────────────────────
  const mudarDia = (iso, mut) => setDias((prev) => ({ ...prev, [iso]: mut(prev[iso]) }))
  const setCelula = (iso, faixa, col, valor) => mudarDia(iso, (d) => ({
    ...d, grade: { ...d.grade, [faixa]: { ...d.grade[faixa], [col]: valor } },
  }))
  const setPosicao = (iso, pn, nome) => mudarDia(iso, (d) => ({
    ...d, posicoes: { ...d.posicoes, [pn]: nome },
  }))
  const moverOrdem = (iso, turno, i, delta) => mudarDia(iso, (d) => {
    const arr = [...d.ordem[turno]]
    const j = i + delta
    if (j < 0 || j >= arr.length) return d
    arr.splice(j, 0, ...arr.splice(i, 1))
    return { ...d, ordem: { ...d.ordem, [turno]: arr } }
  })
  const removerOrdem = (iso, turno, i) => mudarDia(iso, (d) => {
    const arr = d.ordem[turno].filter((_, k) => k !== i)
    return { ...d, ordem: { ...d.ordem, [turno]: arr } }
  })
  // Acrescentar é por LOGIN (regra 11/08 da conferência normal: texto livre
  // criava a mesma pessoa 2× na fila) — insere o apelido do dicionário.
  const acrescentarOrdem = (iso, turno) => {
    const uid = addSel[`${iso}|${turno}`]
    const r = uid ? rosterByUid.get(uid) : null
    if (!r) return
    const texto = r.apelidos?.[0] || primeiroNomeUpper(r.nome)
    mudarDia(iso, (d) => (
      d.ordem[turno].some((t) => normNome(nomeDoToken(dias[iso], t)) === normNome(texto))
        ? d
        : { ...d, ordem: { ...d.ordem, [turno]: [...d.ordem[turno], texto] } }
    ))
    setAddSel((p) => ({ ...p, [`${iso}|${turno}`]: '' }))
  }

  // ── resolução/validação ───────────────────────────────────────────────────
  const nomeDoToken = (dia, token) => {
    const pn = normalizarPn(token)
    return pn ? (dia?.posicoes?.[pn] || null) : String(token || '').trim()
  }
  // nome PUBLICADO da posição: o login escolhido vence o texto do documento
  const posicoesEfetivas = (iso) => {
    const dia = dias[iso]
    const out = {}
    for (const [pn, nome] of Object.entries(dia?.posicoes || {})) {
      const r = rosterByUid.get(logins[`${iso}|${pn}`] || '')
      out[pn] = r ? (r.apelidos?.[0] || primeiroNomeUpper(r.nome)) : nome
    }
    return out
  }
  // token de NOME que corresponde a uma posição vira o código Pn (para o login
  // escolhido valer também no caminho da sugestão, que é escrita por nomes)
  const tokenParaPn = (dia, token) => {
    if (normalizarPn(token)) return token
    const alvo = normNome(token)
    const hit = Object.entries(dia?.posicoes || {}).find(([, n]) => normNome(n) === alvo)
    return hit ? hit[0] : token
  }
  const ordemPublicacao = (iso, turno) => {
    const dia = dias[iso]
    const tokens = (dia?.ordem?.[turno] || []).map((t) => tokenParaPn(dia, t))
    return rodapeDeOrdemDoc(tokens, posicoesEfetivas(iso))
  }
  /** Bloqueios de publicação por dia+turno (regra da casa: nunca chutar identidade). */
  const bloqueiosDe = (iso, turno) => {
    const dia = dias[iso]
    const out = []
    const tokens = dia?.ordem?.[turno] || []
    if (!tokens.length) {
      // NOITE sem ordem não trava a publicação: a fila cai na linha 19-07 da
      // grade, que é o comportamento de sempre. Manhã e tarde não têm essa
      // rede — sem rodapé a fila seria inventada dos casos.
      if (turno !== 'noturno') out.push('Ordem de liberação vazia — sem ela a fila seria inventada dos casos.')
      return out
    }
    const { semDono } = ordemPublicacao(iso, turno)
    if (semDono.length) out.push(`Posição sem pessoa no mapeamento: ${semDono.join(', ')} — complete acima.`)
    // primeiro nome com 2+ candidatos no cadastro e sem login escolhido:
    // publicar chutaria a identidade (incidente "JOAO" 11/08)
    for (const token of tokens) {
      const pn = normalizarPn(tokenParaPn(dia, token))
      const nome = nomeDoToken(dia, token)
      if (!nome) continue
      const uidEscolhido = pn ? logins[`${iso}|${pn}`] : null
      if (uidEscolhido || resolver(nome)) continue
      if (candidatosPrimeiroNome(nome, roster).length >= 2) {
        out.push(`"${nome}" tem mais de um candidato no cadastro — escolha o login na lista de posições.`)
      }
    }
    return [...new Set(out)]
  }
  const todosBloqueios = diasAlvo.flatMap((iso) => TURNOS_ORDEM.flatMap((t) =>
    bloqueiosDe(iso, t).map((b) => `${formatData(iso)} · ${TURNO_LABEL[t]}: ${b}`)))

  // ── publicação ────────────────────────────────────────────────────────────
  const publicar = async () => {
    if (publicando || !diasAlvo.length || todosBloqueios.length) return
    setPublicando(true)
    const publicados = []
    const falhas = []
    try {
      // aprendizado de alias: SÓ apelido DESCONHECIDO (regra 23/07 — reatribuição
      // não ensina A→B); falha de RLS não trava a publicação
      for (const iso of diasAlvo) {
        for (const [pn, nome] of Object.entries(dias[iso].posicoes)) {
          const uid = logins[`${iso}|${pn}`]
          const txt = String(nome || '').trim()
          if (uid && txt && resolver(txt) == null) {
            try { await upsertAlias({ apelido: txt, userId: uid, createdBy: user?.uid || user?.id }) }
            catch (err) { if (!isPermissionError(err)) console.warn('[ImportarEscalaFds] alias não aprendido:', err) }
          }
        }
      }
      for (const iso of diasAlvo) {
        const dia = dias[iso]
        for (const turno of TURNOS) {
          const { rodape } = ordemPublicacao(iso, turno)
          try {
            await salvarEscalaTurno({
              data: iso, hospital: FDS_HOSPITAL, turno,
              casos: [], // a fila deriva dos casos POR HOSPITAL (importação normal)
              ordemLiberacao: rodape,
              ajudaExterna: [],
              // convenção: o meta COMPLETO vai em toda publicação (a RPC preserva
              // quando ausente; não existe "limpar" via RPC)
              fdsMeta: {
                grade: dia.grade,
                posicoes: posicoesEfetivas(iso),
                escalacao: dia.escalacao,
                ordemFonte: dia.ordemFonte,
                // fila da NOITE (nomes, convenção do rodapé): vai no meta porque
                // 'noturno' não é turno de publicação no banco. Republicar sem
                // este campo apagaria a ordem ditada em silêncio.
                ordemNoite: ordemPublicacao(iso, 'noturno').rodape,
              },
              status: 'publicada',
            }, { userName: user?.displayName })
            publicados.push(`${formatData(iso)} ${TURNO_LABEL[turno]}`)
          } catch (err) {
            falhas.push(`${formatData(iso)} ${TURNO_LABEL[turno]}: ${err.message}`)
          }
        }
      }
      if (falhas.length) {
        toast({
          variant: 'warning', duration: 12000,
          title: `Publicado parcialmente (${publicados.length}/${publicados.length + falhas.length})`,
          description: `Republicar é seguro (substitui o turno). Falhou: ${falhas.join(' · ')}`,
        })
      } else {
        toast({ variant: 'success', title: 'Fim de semana publicado', description: `${publicados.length} turno(s) na fila única.` })
      }
      if (publicados.length) onClose?.({ data: sabadoISO })
    } finally { setPublicando(false) }
  }

  return (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button type="button" onClick={() => onClose?.()} aria-label="Cancelar"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">
            Fim de semana · fila única
          </h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para confeccionar escalas.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Documento "ESCALA DE FINAL DE SEMANA": grade P1–P4, numeração das posições e a ordem de
          liberação de cada turno — uma fila só para todos os hospitais. As listas de procedimentos
          continuam sendo importadas por hospital, no fluxo normal.
        </p>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Sábado do fim de semana</label>
          <div className="flex items-center gap-2">
            <DatePicker
              className="flex-1 min-w-0"
              value={(() => { const [y, m, d] = String(sabadoISO || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
              onChange={(d) => {
                if (!d) return
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                setSabadoISO(sabadoDoFimDeSemana(iso) || iso)
              }}
              placeholder="Sábado"
            />
            <span className="shrink-0 text-xs text-muted-foreground">+ domingo {formatData(domingoISO)}</span>
          </div>
        </div>

        <FileUpload accept="image/*" maxSize={15 * 1024 * 1024} variant="dropzone"
          label="Foto do documento de fim de semana"
          description="Print/foto da ESCALA DE FINAL DE SEMANA (sábado e domingo juntos). Sem dado de paciente."
          onChange={(f) => importarImagem(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Lendo o documento…
          </p>
        )}

        {ignorados.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80 mb-1">Fora da escala (funcionárias têm escala própria):</p>
            {ignorados.map((l, i) => <p key={i}>· {l}</p>)}
          </div>
        )}
        {avisos.map((a, i) => (
          <p key={i} className="flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
          </p>
        ))}

        {diasAlvo.map((iso) => {
          const dia = dias[iso]
          const pns = Object.keys(dia.posicoes).filter((k) => normalizarPn(k)).sort(ordenarPn)
          return (
            <section key={iso} className="rounded-2xl border border-border-strong bg-card p-3 space-y-4">
              <h2 className="text-sm font-bold text-foreground">{formatData(iso)}</h2>

              {/* grade P1–P4: 3 faixas × 4 células (cols 1–2 fixas nos hospitais) */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plantões (grade)</p>
                {FAIXAS_FDS.map((faixa) => (
                  <div key={faixa}>
                    <p className="mb-1 text-xs font-semibold text-foreground/80">{FAIXA_LABEL[faixa]}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COLUNAS.map((c) => (
                        <div key={c.key}>
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</label>
                          <Input value={dia.grade[faixa]?.[c.key] || ''}
                            onChange={(e) => setCelula(iso, faixa, c.key, e.target.value)} placeholder="—" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pn → pessoa (login vence o texto; domingo herda o sábado) */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posições (Pn → pessoa)</p>
                {pns.map((pn) => {
                  const nome = dia.posicoes[pn]
                  const uid = logins[`${iso}|${pn}`] || ''
                  const ambiguo = !uid && !resolver(nome) && candidatosPrimeiroNomeMemo(nome, roster)
                  return (
                    <div key={pn} className="flex flex-wrap items-center gap-1.5">
                      <Badge className="shrink-0 border-transparent bg-primary text-primary-foreground">{pn}</Badge>
                      <Input className="min-w-0 flex-1" value={nome}
                        onChange={(e) => setPosicao(iso, pn, e.target.value)} />
                      <Select
                        className={`w-40 shrink-0 ${ambiguo ? 'ring-1 ring-destructive rounded-lg' : ''}`}
                        searchable
                        options={[{ value: '', label: '— login —' }, ...rosterOpcoes]}
                        value={uid}
                        onChange={(v) => setLogins((p) => ({ ...p, [`${iso}|${pn}`]: v }))}
                        placeholder="Login"
                      />
                    </div>
                  )
                })}
                {!pns.length && <p className="text-xs text-muted-foreground">Nenhuma posição lida — reimporte ou preencha a ordem por login abaixo.</p>}
              </div>

              {/* ordem de liberação POR TURNO, na direção do DOCUMENTO */}
              {TURNOS_ORDEM.map((turno) => {
                const tokens = dia.ordem[turno] || []
                const bloqueios = bloqueiosDe(iso, turno)
                return (
                  <div key={turno} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Ordem de liberação · {TURNO_LABEL[turno]}
                      </p>
                      {dia.ordemFonte[turno] === 'sugerida' && (
                        <Badge variant="warning" badgeStyle="subtle" className="shrink-0">Sugerida — ajuste antes de publicar</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Do primeiro ao último a ser liberado (como no documento).</p>
                    {tokens.map((token, i) => {
                      const pn = normalizarPn(tokenParaPn(dia, token))
                      const nome = nomeDoToken(dia, token)
                      return (
                        <div key={`${token}-${i}`} className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1">
                          <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">{i + 1}º</span>
                          {pn && <Badge className="shrink-0 border-transparent bg-primary/80 text-primary-foreground">{pn}</Badge>}
                          <span className={`min-w-0 flex-1 truncate text-sm font-medium ${nome ? '' : 'text-destructive'}`}>
                            {nome || `${token} — sem pessoa`}
                          </span>
                          <button type="button" aria-label={`Subir ${nome || token}`} disabled={i === 0}
                            onClick={() => moverOrdem(iso, turno, i, -1)}
                            className="flex h-8 w-7 items-center justify-center text-primary disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Descer ${nome || token}`} disabled={i === tokens.length - 1}
                            onClick={() => moverOrdem(iso, turno, i, +1)}
                            className="flex h-8 w-7 items-center justify-center text-primary disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label={`Remover ${nome || token}`}
                            onClick={() => removerOrdem(iso, turno, i)}
                            className="flex h-8 w-7 items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-1.5">
                      <Select className="min-w-0 flex-1" searchable options={rosterOpcoes}
                        value={addSel[`${iso}|${turno}`] || ''}
                        onChange={(v) => setAddSel((p) => ({ ...p, [`${iso}|${turno}`]: v }))}
                        placeholder="Acrescentar por login (entra no fim)" />
                      <Button size="sm" variant="outline" disabled={!addSel[`${iso}|${turno}`]}
                        onClick={() => acrescentarOrdem(iso, turno)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {bloqueios.map((b, i) => (
                      <p key={i} className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {b}
                      </p>
                    ))}
                  </div>
                )
              })}
            </section>
          )
        })}

        {diasAlvo.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Publicar substitui os turnos da fila única e zera as marcações deles (a escala
              recém-postada é a válida). A ordem publicada é imutável — mudar = republicar aqui.
            </p>
            <Button className="w-full" disabled={!canEdit || publicando || !!todosBloqueios.length} onClick={publicar}>
              {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Publicar fim de semana ({diasAlvo.length * TURNOS.length} turnos)
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// memo leve fora do render de linha: 12 posições × render — suficiente sem cache
function candidatosPrimeiroNomeMemo(nome, roster) {
  return candidatosPrimeiroNome(nome, roster).length >= 2
}
