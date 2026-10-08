/**
 * Férias do Pega Plantão para as telas de consulta da escala numérica.
 *
 * O dono foi explícito em 03/09: "sempre há mudanças de última hora". Então a consulta é
 * SEMPRE na hora — ao abrir a tela o cache de 30min do `getFeriasDoAno` é invalidado antes
 * do fetch, há um botão de recarregar no cabeçalho e, com a tela aberta, a consulta se refaz
 * quando o app volta do fundo (dono 08/10). A varredura traz o ANO inteiro (12
 * chamadas), então trocar a data na tela NÃO refaz o fetch: a edição vigente da numérica e
 * os feriados moram todos no mesmo ano.
 *
 * Nada aqui grava; nada aqui exclui ninguém. Quem marca a lista é `anotarFerias` na lib.
 */
import { useState, useEffect, useCallback } from 'react'
import { getFeriasDoAno, getLicencasDoAno, invalidarFeriasDoAno } from '@/services/pegaPlantaoApi'
import { normalizarRegistrosFerias } from '@/lib/extratoFerias'

/**
 * Licenças ("LICENÇA SAÚDE"…) → [{ nome, data }], no mesmo formato das férias para
 * `feriasNaData` servir às duas. A tela mostra só "ausente": o motivo é dado de saúde (LGPD).
 */
function normalizarLicencas(raw = []) {
  const vistos = new Set()
  return raw.flatMap((p) => {
    const nome = String(p?.ProfDePlantao || p?.ProfFixo || '').trim().toUpperCase()
    const data = String(p?.Inicio || '').slice(0, 10)
    if (!nome || !/^\d{4}-\d{2}-\d{2}$/.test(data) || vistos.has(`${nome}|${data}`)) return []
    vistos.add(`${nome}|${data}`)
    return [{ nome, data }]
  })
}

/**
 * Nomes de quem está de férias numa data (dedup). `null` quando o Pega Plantão não
 * respondeu — é o mesmo "não conferido" que `anotarFerias` entende e deixa a lista intacta.
 */
export function feriasNaData(registros, dataISO) {
  if (!Array.isArray(registros)) return null
  return [...new Set(registros.filter((r) => r.data === dataISO).map((r) => r.nome))]
}

const RECONSULTA_AO_VOLTAR_MS = 2 * 60 * 1000

export function useFeriasDoAno(ano) {
  const [registros, setRegistros] = useState(null)
  const [licencas, setLicencas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [conferidoEm, setConferidoEm] = useState(null)

  const recarregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      // invalidar ANTES do fetch é o que garante o "na hora" — sem isso a tela poderia
      // mostrar o agregado que o Extrato de Férias deixou no cache há 29 minutos
      invalidarFeriasDoAno(ano)
      const raw = await getFeriasDoAno(ano)
      // depois das férias: lê os mesmos 12 meses do cache, sem chamada a mais (dono 07/10)
      const rawLicencas = await getLicencasDoAno(ano)
      setRegistros(normalizarRegistrosFerias(raw))
      setLicencas(normalizarLicencas(rawLicencas))
      setConferidoEm(new Date())
    } catch (e) {
      // lista sem férias conferidas é melhor que lista errada: some a marca e a tela avisa
      setErro(e?.message || 'Não foi possível consultar o Pega Plantão')
      setRegistros(null)
      setLicencas(null)
    } finally {
      setLoading(false)
    }
  }, [ano])

  useEffect(() => { recarregar() }, [recarregar])

  // tela aberta e app no fundo: ao voltar, consulta de novo (dono 08/10: "sempre atualize essa
  // informação" — férias são marcadas a qualquer momento). Só depois de 2 min, para trocar de
  // app e voltar não refazer as 12 chamadas a cada vez
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible' || loading) return
      if (!conferidoEm || Date.now() - conferidoEm.getTime() >= RECONSULTA_AO_VOLTAR_MS) recarregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [recarregar, conferidoEm, loading])

  return { registros, licencas, loading, erro, conferidoEm, recarregar }
}
