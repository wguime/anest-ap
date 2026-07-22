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
import { titleCaseNome } from '@/lib/colunaLiberacao'
import { turnoAtual } from '@/pages/escala-cirurgica/utils'

const TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino' }

export function EscalaCirurgicaHomeCard({ onNavigate }) {
  const { escalas, data, loading } = useEscalaCirurgica()
  const hoje = hojeISO()
  const contextEhHoje = data === hoje

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
  const linhas = useMemo(() => HOSPITAIS.flatMap((h) => {
    const e = fonte?.[h]
    const plantonista = e?.status === 'publicada' ? (e.ordemLiberacao || [])[0] : null
    return plantonista ? [{ hospital: HOSPITAL_LABEL[h], nome: titleCaseNome(plantonista) }] : []
  }), [fonte])

  const carregando = linhas.length === 0 && (contextEhHoje ? loading : fallback == null)
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
          <div className="text-[12px] font-medium uppercase tracking-[0.5px] text-primary">
            Plantonista · {TURNO_LABEL[turnoAtual()]}
          </div>
          <h2 className="mt-0.5 text-[18px] md:text-[20px] font-bold leading-tight text-foreground">
            Escala Cirúrgica
          </h2>
        </div>
        <span
          className={[
            'inline-flex shrink-0 items-center justify-center rounded-[10px] px-[10px] py-[5px] text-[11px] font-semibold leading-none',
            'bg-primary text-white',
            'dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)] dark:text-foreground dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]',
          ].join(' ')}
        >
          Abrir
        </span>
      </header>

      {carregando ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : linhas.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {linhas.map((l) => (
            <li key={l.hospital} className="flex items-center gap-3">
              <span className="w-[4.75rem] shrink-0 text-[13px] font-bold uppercase tracking-wide text-primary">
                {l.hospital}
              </span>
              <span className="min-w-0 truncate text-[17px] font-bold text-foreground">
                {l.nome}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[14px] font-medium text-muted-foreground">
          Sem escala publicada hoje
        </p>
      )}
    </motion.div>
  )
}
