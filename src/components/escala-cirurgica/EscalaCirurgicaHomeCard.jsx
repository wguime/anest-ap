/**
 * EscalaCirurgicaHomeCard — plantonista do turno atual na Home (pedido do dono
 * 2026-07-22: a informação mais consultada do dia, visível já na landing).
 *
 * Mesma família visual do card "Biblioteca de Documentos" da aba Gestão
 * (ComunicadosCard modo legado): mesmas classes de container/header/badge.
 *
 * Dados: EscalaCirurgicaContext (Tier 2 — monta ~2s após o login; o hook devolve
 * fallback seguro até lá → skeleton). Se o context estiver noutra data (usuário
 * navegou no DatePicker da página), busca HOJE direto no service — leve, e o
 * client Supabase já aguarda _authReady internamente. Hospital sem escala
 * publicada hoje não gera linha; nenhum hospital → "Sem escala publicada hoje".
 * Plantonista = 1º nome do rodapé (ordemLiberacao[0]).
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/design-system'
import { useEscalaCirurgica, hojeISO, HOSPITAIS, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import svc from '@/services/supabaseEscalaCirurgicaService'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { nomeCirurgiaoCurto, titleCaseNome, ordemDerivadaDosCasos } from '@/lib/colunaLiberacao'
import { turnoAtual, rodapeDoTurno, filtrarPorTurno } from '@/pages/escala-cirurgica/utils'
import { ehDataFilaUnica, FDS_HOSPITAL, faixaFdsAtual, plantonistasFaixaFds } from '@/lib/escalaFds'
import { formatDate } from '@/utils/formatters'
import useAgoraMinuto from '@/pages/escala-cirurgica/useAgoraMinuto'

const TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino' }
const FAIXA_LABEL = { '7-13': '7–13h', '13-19': '13–19h', '19-07': '19–07h' }

export function EscalaCirurgicaHomeCard({ onNavigate }) {
  const { escalas, data, loading } = useEscalaCirurgica()
  const hoje = hojeISO()
  const contextEhHoje = data === hoje

  // ── FIM DE SEMANA (dono 15/08): com a fila única publicada, o card mostra os
  // plantões FÍSICOS da faixa atual da grade (Unimed/HRO) — no FDS o "1º do
  // rodapé" não é o plantonista de um hospital, é quem sai por último da fila.
  // Madrugada <7h pertence à faixa 19-07 iniciada na VÉSPERA (precedente
  // chavePlantaoDoDia do Pega Plantão) — a grade consultada é a de ontem.
  // `useAgoraMinuto`, não `new Date()`: o relógio cru não tinha tick (só reavaliava
  // quando o card re-renderizava por outro motivo) e furava o devClock — congelar
  // `?agora=` para conferir a madrugada não valia aqui. Store única desde 21/08.
  const agoraMin = useAgoraMinuto()
  const madrugada = agoraMin < 7 * 60
  const diaFdsRef = useMemo(() => {
    if (!madrugada) return hoje
    const d = new Date(`${hoje}T12:00:00`)
    d.setDate(d.getDate() - 1)
    return hojeISO(d)
  }, [madrugada, hoje])
  const fdsAtivo = ehDataFilaUnica(diaFdsRef)
  // Linha 'fds' vem do context quando ele já está no dia certo; só a madrugada
  // (grade da véspera) ou o context noutra data exigem fetch próprio.
  const precisaFetchFds = fdsAtivo && !(contextEhHoje && diaFdsRef === hoje)
  const [fdsFetch, setFdsFetch] = useState(null)
  useEffect(() => {
    if (!precisaFetchFds) return
    let vivo = true
    svc.fetchEscala(diaFdsRef, FDS_HOSPITAL)
      .then((r) => { if (vivo) setFdsFetch(r) })
      .catch(() => {}) // sem a linha fds o card cai no comportamento por hospital
    return () => { vivo = false }
  }, [precisaFetchFds, diaFdsRef])
  const fdsRow = !fdsAtivo ? null : precisaFetchFds ? fdsFetch : (escalas.fds || null)

  // Context noutra data → fetch leve de hoje (erro em um hospital só omite a linha)
  const [fallback, setFallback] = useState(null)
  useEffect(() => {
    if (contextEhHoje) { setFallback(null); return }
    let vivo = true
    Promise.all(HOSPITAIS.map((h) => svc.fetchEscala(hoje, h).catch(() => null)))
      .then((rs) => { if (vivo) setFallback(Object.fromEntries(HOSPITAIS.map((h, i) => [h, rs[i]]))) })
    return () => { vivo = false }
  }, [contextEhHoje, hoje])

  const fonte = contextEhHoje ? escalas : fallback
  // NOME DO CADASTRO no card (pedido do dono 31/07): o rodapé traz apelido/1º
  // nome ("ADRIANO", "DIDO") — o card mostra "nome + último sobrenome" do
  // cadastro via dicionário de apelidos, como a aba Liberações.
  const { resolver, rosterByUid, pronto: rosterPronto } = useRosterAnestesistas()

  // SEM PISCAR (dono 13/08): mostrar o apelido e trocar pelo nome completo
  // segundos depois era o flicker relatado — enquanto o roster não tem como
  // resolver (nem cache, nem cadastro carregado), o card fica no skeleton.
  // Escape de 8s: se o cadastro nunca chegar (falha de rede), apelido é
  // melhor que skeleton eterno.
  const [esperaRosterEsgotada, setEsperaRosterEsgotada] = useState(false)
  useEffect(() => {
    if (rosterPronto) return
    const t = setTimeout(() => setEsperaRosterEsgotada(true), 8000)
    return () => clearTimeout(t)
  }, [rosterPronto])
  const aguardandoRoster = !rosterPronto && !esperaRosterEsgotada

  // Linhas do modo FDS: quem está fisicamente em Unimed/HRO na faixa atual da
  // grade. null = sem fila única publicada → cai nas linhas por hospital.
  const linhasFds = useMemo(() => {
    if (!fdsAtivo || fdsRow?.status !== 'publicada' || !fdsRow?.fdsMeta?.grade) return null
    const faixa = faixaFdsAtual(agoraMin)
    if (!faixa) return null
    const { unimed, hro } = plantonistasFaixaFds(fdsRow.fdsMeta.grade, faixa)
    const nomeDe = (n) => {
      const cadastro = rosterByUid.get(resolver(n) || '')?.nome
      return cadastro ? nomeCirurgiaoCurto(cadastro) : titleCaseNome(n)
    }
    const out = [
      ...(unimed ? [{ hospital: HOSPITAL_LABEL.unimed, nome: nomeDe(unimed) }] : []),
      ...(hro ? [{ hospital: HOSPITAL_LABEL.hro, nome: nomeDe(hro) }] : []),
    ]
    return out.length ? { faixa, linhas: out } : null
  }, [fdsAtivo, fdsRow, agoraMin, resolver, rosterByUid])

  const linhas = useMemo(() => HOSPITAIS.flatMap((h) => {
    const e = fonte?.[h]
    // plantonista do TURNO atual (rodapé por-turno; array legado = o dia todo).
    // Sem rodapé (o mapa do Materno não traz a lista vermelha), deriva dos casos
    // pela MESMA regra da aba Liberações — antes o Materno nunca tinha plantonista.
    const turno = turnoAtual()
    const plantonista = e?.status === 'publicada'
      ? (rodapeDoTurno(e.ordemLiberacao, turno)[0]
         || ordemDerivadaDosCasos(filtrarPorTurno(e.casos || [], turno))[0]
         || null)
      : null
    if (!plantonista) return []
    const cadastro = rosterByUid.get(resolver(plantonista) || '')?.nome
    return [{ hospital: HOSPITAL_LABEL[h], nome: cadastro ? nomeCirurgiaoCurto(cadastro) : titleCaseNome(plantonista) }]
  }), [fonte, resolver, rosterByUid])

  const fonteCarregando = contextEhHoje ? loading : fallback == null
  const carregando = (linhas.length === 0 && fonteCarregando) || (linhas.length > 0 && aguardandoRoster)
  const abrir = () => onNavigate?.('escalaCirurgica')

  return (
    <motion.div
      data-slot="anest-escala-cirurgica-home-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      whileTap={{ scale: 0.99 }}
      onClick={abrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') abrir()
        if (e.key === ' ') { e.preventDefault(); abrir() }
      }}
      className={[
        'rounded-[20px] p-4 md:p-5',
        'bg-accent dark:bg-card dark:border dark:border-border',
        'shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none',
        'select-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      ].join(' ')}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[18px] md:text-[20px] font-bold leading-tight text-foreground">
            Escala Cirúrgica
          </h2>
          {/* data explícita (pedido do dono): deixa claro a que dia o turno se refere */}
          <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">
            {formatDate(new Date(`${hoje}T12:00:00`), 'medium')}
          </p>
        </div>
        {/* pill sólido "Acessar" (pedido do dono) — card inteiro segue clicável */}
        <span
          className={[
            'inline-flex shrink-0 items-center justify-center rounded-[12px] px-[14px] py-[7px] text-[12px] font-semibold leading-none',
            'bg-primary text-white',
            'dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)] dark:text-foreground dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]',
          ].join(' ')}
        >
          Acessar
        </span>
      </header>

      {carregando ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (linhasFds || linhas.length > 0) ? (
        <>
          {/* turno vira rótulo da lista (desceu do topo — pedido do dono);
              no FDS o rótulo é a FAIXA da grade (7–13/13–19/19–07) */}
          <div className="mt-4 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.5px] text-primary">
            <span>{linhasFds ? `Plantão · ${FAIXA_LABEL[linhasFds.faixa]}` : `Plantonista · ${TURNO_LABEL[turnoAtual()]}`}</span>
            <span className="h-px flex-1 bg-primary/10" aria-hidden="true" />
          </div>
          <ul className="mt-3 grid gap-[11px]">
            {(linhasFds ? linhasFds.linhas : linhas).map((l) => (
              <li key={l.hospital} className="flex items-center gap-3">
                {/* hospital em chip tonal de largura fixa (Opção B) — peso equilibrado com o nome */}
                <span className="w-[5.25rem] shrink-0 rounded-[8px] bg-primary/10 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-primary">
                  {l.hospital}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-foreground">
                  {l.nome}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-[14px] font-medium text-muted-foreground">
          Sem escala publicada hoje
        </p>
      )}
    </motion.div>
  )
}
