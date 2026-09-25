/**
 * Folha IMPRESSA da escala numérica (dono 25/09: "imprimir a lista referente ao turno ou ao dia").
 *
 * Só existe enquanto a impressão está aberta e só aparece no papel: na tela fica escondida, e
 * na impressão ela é a única coisa do <body> que sai (o app inteiro, header em portal incluso,
 * some). Modelo escolhido pelo dono no protótipo `.tmp/escala-numerica-imprimir.html`: A4 em
 * pé, HRO · Unimed · Materno + Consultório em três colunas, e o dia inteiro (manhã em cima,
 * tarde embaixo) cabendo em UMA página.
 *
 * Cor fixa preto/branco de propósito, fora dos tokens (em `folhaImpressao.css`): papel não tem
 * tema escuro, e a impressão costuma ser monocromática — por isso as marcas saem por extenso.
 */
import { createPortal } from 'react-dom'
import { LABEL_HOSPITAL } from '@/lib/escalaNumerica'
import './folhaImpressao.css'

function marcas(p) {
  const m = []
  if (p.ferias?.length) m.push('férias')
  else if (p.posPlantao) m.push(`pós plantão${p.postoPlantao ? ` ${p.postoPlantao}` : ''}`)
  if (p.movidoPorPlantao && p.postoPlantao) m.push(p.postoPlantao)
  if (p.trocado) m.push('troca')
  return m.length ? <em> ({m.join(' · ')})</em> : null
}

function Coluna({ titulo, meta, lista, semPosicao = false }) {
  return (
    <section>
      <h4>{titulo} <span>{meta}</span></h4>
      <table>
        <tbody>
          {lista.map((p, i) => (
            <tr key={`${p.numero || ''}-${p.nome}-${i}`} className={p.ferias?.length || p.posPlantao ? 'fn-apagado' : undefined}>
              <td className="fn-pos">{semPosicao ? '·' : p.posicao}</td>
              <td className="fn-num">{p.numero || ''}</td>
              <td>{p.nome}{marcas(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Turno({ rotulo, vista }) {
  if (vista.tipo === 'feriado') {
    return (
      <div className="fn-turno">
        <h3>{rotulo}</h3>
        <div className="fn-grade">
          <div className="fn-col">
            <Coluna titulo={vista.feriado} meta={`fila única · ${vista.lista.length}`} lista={vista.lista} />
          </div>
        </div>
      </div>
    )
  }
  const bloco = (h) => vista.blocos.find((b) => b.hospital === h)
  const col = (h) => bloco(h) && (
    <Coluna titulo={LABEL_HOSPITAL[h]} meta={bloco(h).lista.length} lista={bloco(h).lista} />
  )
  return (
    <div className="fn-turno">
      <h3>{rotulo}</h3>
      <div className="fn-grade">
        <div className="fn-col">{col('hro')}</div>
        <div className="fn-col">{col('unimed')}</div>
        <div className="fn-col">
          {col('materno')}
          {vista.consultorio?.length > 0 && (
            <Coluna titulo="Consultório" meta="fora da fila" lista={vista.consultorio} semPosicao />
          )}
        </div>
      </div>
    </div>
  )
}

/** `turnos`: [{ rotulo, vista }] — um (o turno da tela) ou dois (o dia inteiro). */
export default function FolhaImpressao({ dia, turnos, notaFerias }) {
  if (typeof document === 'undefined') return null
  const agora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return createPortal(
    <div className="folha-numerica">
      <div className="fn-cab">
        <div>
          <b>Escala Numérica — ordem de liberação</b>
          {dia}
        </div>
        <small>Impresso em {agora}<br />{notaFerias}</small>
      </div>
      {turnos.map((t) => <Turno key={t.rotulo} {...t} />)}
      <p className="fn-rodape">
        1ª posição = primeiro a ser liberado. Quem está de férias ou em pós-plantão fica na posição, marcado. Consultório não entra na fila.
      </p>
    </div>,
    document.body
  )
}
