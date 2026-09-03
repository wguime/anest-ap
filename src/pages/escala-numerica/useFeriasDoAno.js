/**
 * Férias do Pega Plantão para as telas de consulta da escala numérica.
 *
 * O dono foi explícito em 03/09: "sempre há mudanças de última hora". Então a consulta é
 * SEMPRE na hora — ao abrir a tela o cache de 30min do `getFeriasDoAno` é invalidado antes
 * do fetch, e há um botão de recarregar no cabeçalho. A varredura traz o ANO inteiro (12
 * chamadas), então trocar a data na tela NÃO refaz o fetch: a edição vigente da numérica e
 * os feriados moram todos no mesmo ano.
 *
 * Nada aqui grava; nada aqui exclui ninguém. Quem marca a lista é `anotarFerias` na lib.
 */
import { useState, useEffect, useCallback } from 'react'
import { getFeriasDoAno, invalidarFeriasDoAno } from '@/services/pegaPlantaoApi'
import { normalizarRegistrosFerias } from '@/lib/extratoFerias'

/**
 * Nomes de quem está de férias numa data (dedup). `null` quando o Pega Plantão não
 * respondeu — é o mesmo "não conferido" que `anotarFerias` entende e deixa a lista intacta.
 */
export function feriasNaData(registros, dataISO) {
  if (!Array.isArray(registros)) return null
  return [...new Set(registros.filter((r) => r.data === dataISO).map((r) => r.nome))]
}

export function useFeriasDoAno(ano) {
  const [registros, setRegistros] = useState(null)
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
      setRegistros(normalizarRegistrosFerias(raw))
      setConferidoEm(new Date())
    } catch (e) {
      // lista sem férias conferidas é melhor que lista errada: some a marca e a tela avisa
      setErro(e?.message || 'Não foi possível consultar o Pega Plantão')
      setRegistros(null)
    } finally {
      setLoading(false)
    }
  }, [ano])

  useEffect(() => { recarregar() }, [recarregar])

  return { registros, loading, erro, conferidoEm, recarregar }
}
