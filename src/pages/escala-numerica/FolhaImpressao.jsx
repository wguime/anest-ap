/**
 * Folha IMPRESSA da escala numérica (dono 25/09: "imprimir a lista referente ao turno ou ao dia").
 *
 * Só existe enquanto a impressão está aberta e só aparece no papel: na tela fica escondida, e
 * na impressão ela é a única coisa do <body> que sai (o app inteiro, header em portal incluso,
 * some). Desenho escolhido pelo dono em 07/10 no protótipo
 * `.tmp/escala-numerica-marcas-impressao.html`:
 * - **colorida sempre**, com a marca da tela (linha pintada + selo escrito). O selo é texto de
 *   propósito: numa impressora preto e branco a cor vira cinza, e "férias" continua legível;
 * - **um turno**: A4 em pé, HRO e Unimed lado a lado em colunas largas, Materno e Consultório
 *   em blocos com título embaixo;
 * - **o dia inteiro**: A4 DEITADA, manhã à esquerda e tarde à direita, cada uma com os mesmos
 *   blocos (Materno e Consultório com título — dono 07/10).
 * Abaixo do HRO e da Unimed vai quantos trabalham no turno (lista − férias − pós-plantão).
 *
 * Cor fixa, fora dos tokens (em `folhaImpressao.css`): papel não tem tema escuro — os hex
 * espelham os tokens CLAROS da tela.
 */
import { createPortal } from 'react-dom'
import { LABEL_HOSPITAL } from '@/lib/escalaNumerica'
import { nomeExibicao } from './nomeExibicao'
import { situacao, rotuloSituacao, contarTrabalhando } from './situacao'
import './folhaImpressao.css'

const CLASSE = { ferias: 'fn-ferias', pos: 'fn-pos-plantao', noite: 'fn-noite' }

function Linha({ p, curto, semPosicao }) {
  const s = situacao(p)
  const selo = rotuloSituacao(p, { curto })
  return (
    <div className={`fn-linha ${s ? CLASSE[s] : ''}`}>
      <span className="fn-posicao">{semPosicao ? '·' : p.posicao}</span>
      <span className="fn-numero">{p.numero || ''}</span>
      <span className="fn-nome">{nomeExibicao(p.nome)}</span>
      {selo && <span className="fn-selo">{selo}</span>}
      {p.trocado && <span className="fn-selo fn-troca">troca</span>}
    </div>
  )
}

/** Só o número: o total já está no cabeçalho da coluna e a conta, na legenda do rodapé. */
function Trabalhando({ lista, turno }) {
  return (
    <p className="fn-trabalhando">
      Trabalhando {turno === 'vespertino' ? 'à tarde' : 'de manhã'}: <b>{contarTrabalhando(lista).trabalhando}</b>
    </p>
  )
}

/** O <h4> começa pelo título (o teste lê o 1º nó): o Consultório sai SÓ com ele (dono 25/09). */
function Coluna({ titulo, meta, lista, curto, semPosicao, turno }) {
  return (
    <section className="fn-coluna">
      <h4>{titulo}{meta != null && <span>{meta}</span>}</h4>
      {lista.map((p, i) => (
        <Linha key={`${p.numero || ''}-${p.nome}-${i}`} p={p} curto={curto} semPosicao={semPosicao} />
      ))}
      {turno && <Trabalhando lista={lista} turno={turno} />}
    </section>
  )
}

/** Quem está fora do turno (e, de manhã, quem veio da noite), num quadro antes das listas. */
function Resumo({ vista }) {
  const todos = vista.tipo === 'feriado'
    ? vista.lista.map((p) => ({ p, h: null }))
    : [
      ...vista.blocos.flatMap((b) => b.lista.map((p) => ({ p, h: b.hospital }))),
      ...(vista.consultorio || []).map((p) => ({ p, h: 'consultorio' })),
    ]
  const grupos = [
    { s: 'ferias', rotulo: 'férias', nome: ({ p }) => nomeExibicao(p.nome) },
    { s: 'pos', rotulo: 'pós-plantão', nome: ({ p }) => `${nomeExibicao(p.nome)}${p.postoPlantao ? ` (${p.postoPlantao})` : ''}` },
    { s: 'noite', rotulo: 'plantão da noite', nome: ({ p, h }) => `${nomeExibicao(p.nome)} → ${p.posicao}ª ${LABEL_HOSPITAL[h] || ''}`.trim() },
  ]
    .map((g) => ({ ...g, quem: todos.filter(({ p }) => situacao(p) === g.s) }))
    .filter((g) => g.quem.length)
  return (
    <div className="fn-resumo">
      {grupos.length ? grupos.map((g) => (
        <div key={g.s} className="fn-resumo-linha">
          <span className={`fn-selo ${CLASSE[g.s]}`}>{g.rotulo} · {g.quem.length}</span>
          <span>{g.quem.map(g.nome).join(' · ')}</span>
        </div>
      )) : <div className="fn-resumo-linha fn-ninguem">Ninguém de férias nem de pós-plantão neste turno.</div>}
    </div>
  )
}

function Turno({ rotulo, turno, vista, curto }) {
  if (vista.tipo === 'feriado') {
    // fila única: as 20 posições descem a 1ª coluna e continuam na 2ª, como na tela
    const linhas = Math.ceil(vista.lista.length / 2)
    return (
      <div className="fn-turno">
        <h3>{rotulo}</h3>
        <Resumo vista={vista} />
        <section className="fn-coluna">
          <h4>{vista.feriado}<span>fila única · {vista.lista.length}</span></h4>
          <div className="fn-feriado" style={{ gridTemplateRows: `repeat(${linhas}, auto)` }}>
            {vista.lista.map((p, i) => <Linha key={`${p.numero || ''}-${p.nome}-${i}`} p={p} curto={curto} />)}
          </div>
        </section>
      </div>
    )
  }
  const bloco = (h) => vista.blocos.find((b) => b.hospital === h)
  const hospital = (h) => bloco(h) && (
    <Coluna titulo={LABEL_HOSPITAL[h]} meta={`${bloco(h).lista.length} nomes`} lista={bloco(h).lista} curto={curto} turno={turno} />
  )
  return (
    <div className="fn-turno">
      <h3>{rotulo}</h3>
      <Resumo vista={vista} />
      <div className="fn-grade">
        {hospital('hro')}
        {hospital('unimed')}
      </div>
      <div className="fn-grade fn-baixo">
        {bloco('materno') && (
          <Coluna titulo={LABEL_HOSPITAL.materno} meta={`${bloco('materno').lista.length} nomes`} lista={bloco('materno').lista} curto={curto} />
        )}
        {vista.consultorio?.length > 0 && (
          <Coluna titulo={LABEL_HOSPITAL.consultorio} lista={vista.consultorio} curto={curto} semPosicao />
        )}
      </div>
    </div>
  )
}

/**
 * `turnos`: [{ rotulo, turno, vista }] — um (o turno da tela) ou dois (o dia inteiro).
 * `dia`: "quarta, 07/10/2026".
 */
export default function FolhaImpressao({ dia, diaInteiro = false, turnos, notaFerias }) {
  if (typeof document === 'undefined') return null
  const agora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return createPortal(
    <div className={`folha-numerica ${diaInteiro ? 'fn-dia' : 'fn-um-turno'}`}>
      {/* o @page mora AQUI e não no CSS global: a folha só existe enquanto imprime, então a
          orientação dela não alcança outra impressão do app. Dentro de `@media print` porque o
          jsdom (testes) quebra no getComputedStyle com um @page solto, e só lê @media screen */}
      <style>{`@media print { @page { size: A4 ${diaInteiro ? 'landscape' : 'portrait'}; margin: ${diaInteiro ? '8mm' : '10mm'}; } }`}</style>
      <div className="fn-cab">
        <div>
          <span className="fn-kicker">Escala Numérica · ordem de liberação</span>
          <b>{diaInteiro ? 'Dia inteiro' : turnos[0]?.rotulo} · {dia}</b>
        </div>
        <small>Impresso em {agora}<br />{notaFerias}</small>
      </div>
      <div className="fn-turnos">
        {turnos.map((t) => <Turno key={t.rotulo} {...t} curto={diaInteiro} />)}
      </div>
      <div className="fn-legenda">
        <span><i className="fn-amostra fn-ferias" />Férias: mantém a posição, não trabalha</span>
        <span><i className="fn-amostra fn-pos-plantao" />Pós-plantão: fez a noite (P1 HRO · P2 Unimed), não trabalha à tarde</span>
        <span><i className="fn-amostra fn-noite" />Plantão da noite: de manhã sobe para a 2ª do hospital do plantão</span>
        <span>1ª posição = primeira a ser liberada · Trabalhando = lista − férias − pós-plantão · Consultório não entra na fila</span>
      </div>
    </div>,
    document.body
  )
}
