/**
 * Conferência da escala cirúrgica SEM a tela (dono 08/09/2026: "quero que a skill faça
 * todas as conferências conforme definido para publicação da escala").
 *
 * É a MESMA conferência de `ImportarEscalaPage` + o cruzamento do lote de
 * `ImportarEscalasPage`, na mesma ordem, chamando as mesmas funções puras. O que aqui
 * está "inline" é cópia literal do que na tela é `useMemo` sem função própria (cauda,
 * suspeitos, blocos repetidos, seções ausentes, cruzamento, travessias). Divergir da
 * tela num destes seria publicar pela foto com menos regra do que pela tela — o oposto
 * do que a skill promete.
 *
 * Puro: quem busca os dados (dicionário, escalas publicadas, férias, numérica) é o
 * chamador (`scripts/escala-publicar-turno.mjs`). Nada aqui grava.
 *
 * Saída por hospital: `bloqueios` (a tela recusa publicar), `avisos` (publica assim
 * mesmo), `decisoes` (o que a tela perguntaria), e o `payload` pronto para a RPC —
 * casos atribuídos do turno, ordem, ajuda, `linhaOverrides` e `preservar`, montados
 * pelas mesmas funções da publicação.
 */
import {
  prepararCasosImportados, gruposAnestesista, preAtribuicoesDoDicionario, aplicarAtribuicoes,
  selecionarCasosDoTurno, candidatosPrimeiroNome, resumirRodape, detectarConflitos,
  casosQuePassamParaOTurno, presencaDoTurno, estaPresente, azuisEmprestados, rodapeDoTurno,
  turnoDeHora, normNome, linhaVazia,
} from '@/pages/escala-cirurgica/utils'
import { ehHoraSequencialEscala } from '@/lib/escalaCirurgicaRegras'
import { validarCasosParaPublicacao, textoBloqueio } from '@/lib/escalaCirurgicaValidacao'
import { detectarItensDuplicados, aplicarHoraPadraoPosicoes } from '@/lib/escalaCirurgicaItens'
import { detectarDuplicidadesEscala, carimbarDecisao, localizarDecisao } from '@/lib/escalaCirurgicaDuplicidades'
import { montarLinhaOverrides, montarPreservacao, decisoesPublicadas } from '@/lib/escalaPublicacaoDecisoes'
import { montarOrdem, compararComRodape } from '@/lib/escalaNumerica'

export const HOSPITAL_LABEL = { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' }
const COM_RODAPE = new Set(['hro', 'unimed'])
const rotulo = (h) => HOSPITAL_LABEL[h] || h
const texto = (v) => String(v ?? '').trim()
const primeiroNomeUpper = (nome) => normNome(String(nome || '').split(/\s+/)[0] || '')

/** Cópia de `normApelido` do service de apelidos (o service puxa o cliente Supabase). */
export const normApelido = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^\s*ped\s+/i, '').trim().toUpperCase()

/**
 * O MESMO roster/resolver de `useRosterAnestesistas`, a partir de dados crus:
 * `perfis` = [{ id, nome, role, contaDuplicadaDe, email }], `aliases` = [{ apelido, userId }].
 * Quem tem apelido responde por casos mesmo sem o cargo (fix 30/07, Daniela).
 */
export function montarRoster({ perfis = [], aliases = [] } = {}) {
  const uidsComAlias = new Set(aliases.map((a) => a.userId))
  const byUid = new Map()
  const duplicadas = new Map()
  for (const u of perfis) {
    if (!u?.id || !u?.nome) continue
    if (/\+e2e/i.test(String(u.email || ''))) continue
    if (String(u.role || '') !== 'anestesiologista' && !uidsComAlias.has(u.id)) continue
    if (u.contaDuplicadaDe) { duplicadas.set(u.id, u.contaDuplicadaDe); continue }
    byUid.set(u.id, { uid: u.id, nome: u.nome, apelidos: [] })
  }
  for (const a of aliases) {
    const r = byUid.get(duplicadas.get(a.userId) || a.userId)
    if (r && !r.apelidos.includes(a.apelido)) r.apelidos.push(a.apelido)
  }
  const roster = [...byUid.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const rosterByUid = new Map(roster.map((r) => [r.uid, r]))
  for (const [dup, principal] of duplicadas) if (rosterByUid.has(principal)) rosterByUid.set(dup, rosterByUid.get(principal))
  const mapa = new Map(aliases.map((a) => [normApelido(a.apelido), a.userId]))
  const canonicalUid = (uid) => (uid && duplicadas.get(uid)) || uid || null
  const resolver = (nome) => canonicalUid(mapa.get(normApelido(nome)) || null)
  return { roster, rosterByUid, resolver, canonicalUid }
}

/**
 * Os casos como a aba os carrega (`carregarLoteImportado` da tela): defaults de linha,
 * preparação por hospital, hora padrão da SRPA (09:00 só de manhã) e o carimbo de turno —
 * e só os do TURNO entram na conferência, como na tela (o lote do Materno traz o dia
 * inteiro; a manhã não pode render aviso na tarde).
 */
export function carregarSelecionados(rows, hospital, posicoes, turno) {
  const lote = aplicarHoraPadraoPosicoes(
    prepararCasosImportados((rows || []).map((c) => ({ ...linhaVazia(), ...c })), hospital, posicoes || []),
    hospital, turno,
  ).map((c) => ({ ...c, turno: turnoDeHora(c.hora) || turno }))
  return lote.filter((c) => c.turno === turno)
}

/** Cópia de `validarHorarioImportacao` da tela (mora num .jsx, fora do alcance daqui). */
export function validarHorario(itens, periodo) {
  const invalidos = []
  const incompativeis = []
  let semHora = 0
  for (const item of itens || []) {
    const hora = texto(item?.hora)
    if (!hora) { semHora += 1; continue }
    if (ehHoraSequencialEscala(hora)) { semHora += 1; continue }
    const turnoHora = turnoDeHora(hora)
    if (!turnoHora) { invalidos.push(item); continue }
    if (turnoHora !== periodo) incompativeis.push({ ...item, turnoHora })
  }
  return { invalidos, incompativeis, semHora }
}

/**
 * Azul de EMPRESTADO realocado (dono 01/09, caso Eduardo): quem está no rodapé DAQUI
 * em azul mas trabalha em OUTRO hospital não é ajuda daqui — sai da ajuda daqui e, se
 * tem caso lá, entra na ajuda de lá. Na tela é um efeito one-shot por aba; aqui é uma
 * passada sobre o lote inteiro antes de qualquer outra conta.
 */
export function realocarAzuisEmprestados(hospitais, turno, resolver) {
  const nomes = Object.keys(hospitais)
  const irmas = (h) => nomes.filter((o) => o !== h).map((o) => ({
    hospital: o, casos: hospitais[o].casos, ordemLiberacao: hospitais[o].ordem, ajudaExterna: hospitais[o].ajuda,
  }))
  const realocados = []
  for (const h of nomes) {
    const dados = hospitais[h]
    if (!dados.ajuda.length || !dados.ordem.length) continue
    const emprestados = azuisEmprestados({
      azuis: dados.ajuda, ordem: dados.ordem, casos: dados.casos, outrasEscalas: irmas(h),
      turno, resolver, hospitalLabelFor: rotulo,
    })
    if (!emprestados.length) continue
    const fora = new Set(emprestados.map((e) => normNome(e.nome)))
    dados.ajuda = dados.ajuda.filter((a) => !fora.has(normNome(a)))
    for (const e of emprestados) {
      const destino = nomes.find((o) => rotulo(o) === e.hospital || o === e.hospital)
      realocados.push({ nome: e.nome, de: h, para: destino || e.hospital })
      if (!destino) continue
      const temCasoLa = hospitais[destino].casos.some((c) => normNome(c.anestesista) === normNome(e.nome))
      const jaLa = hospitais[destino].ajuda.some((a) => normNome(a) === normNome(e.nome))
      if (temCasoLa && !jaLa) hospitais[destino].ajuda.push(e.nome)
    }
  }
  return realocados
}

/**
 * Confere e monta a publicação de UM hospital, exatamente como a aba faz.
 * `entrada` = { rows, posicoes, ordem, ajuda, dataDetectada }
 * `contexto` = { data, turno, roster, resolver, rosterByUid, existente (escala publicada
 *   deste hospital, camelCase, ou null), outrasEscalas (irmãs do lote + publicadas dos
 *   demais), dadosNumerica, ferias (nomes completos de férias no dia, ou null),
 *   decisoes ({ NOME: { tipo: 'intencional' } | { tipo: 'troca', parceiro } }),
 *   conferidos (nomes "está certo, fica Livre"), republicar, carimbo }
 */
export function conferirHospital(hospital, entrada, contexto) {
  const {
    data, turno, roster = [], resolver, rosterByUid = new Map(), existente = null, outrasEscalas = [],
    dadosNumerica = null, ferias = null, decisoes = {}, conferidos = [], republicar = false, carimbo = null,
  } = contexto
  const bloqueios = []
  const avisos = []
  const bloq = (codigo, txt) => bloqueios.push({ codigo, texto: txt })
  const aviso = (codigo, txt) => avisos.push({ codigo, texto: txt })
  const ordem = (entrada.ordem || []).map(texto).filter(Boolean)
  const ajuda = (entrada.ajuda || []).map(texto).filter(Boolean)

  // 1. casos como a tela os recebe da leitura — só os do turno
  const casos = carregarSelecionados(entrada.rows, hospital, entrada.posicoes, turno)
  const grupos = gruposAnestesista(casos, hospital)
  const atribuicoes = preAtribuicoesDoDicionario(grupos, {}, resolver)
  const nomePorChave = Object.fromEntries(grupos.map((g) => [g.chave, g.nome]))
  const apelidoExibicao = (chave, uid) => {
    const r = rosterByUid.get(uid)
    if (r) return r.apelidos[0] || primeiroNomeUpper(r.nome)
    const t = nomePorChave[chave]
    return t ? normNome(t) : ''
  }
  const casosAtribuidos = aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao, resolver)
  const casosNovos = selecionarCasosDoTurno(casosAtribuidos, turno)

  if (entrada.dataDetectada && entrada.dataDetectada !== data) {
    aviso('data', `a foto diz ${entrada.dataDetectada} e a publicação é de ${data}`)
  }
  if (!casosNovos.length) bloq('sem casos', `nenhum caso do turno ${turno}`)

  // 2. o que a tela RECUSA
  const horario = validarHorario(casosNovos, turno)
  if (horario.invalidos.length) {
    bloq('hora inválida', `${horario.invalidos.length} item(ns) com hora inválida: ${horario.invalidos.map((c) => `${c.sala} "${c.hora}"`).join(', ')}`)
  }
  if (horario.incompativeis.length) {
    aviso('hora de outro turno', `${horario.incompativeis.length} item(ns) com hora do outro turno ficam de fora: ${horario.incompativeis.map((c) => `${c.sala} ${c.hora}`).join(', ')}`)
  }
  const gruposAmbiguos = roster.length
    ? grupos
      .filter((g) => !atribuicoes[g.chave] && !g.indices.every((i) => casos[i]?.semAnestesista))
      .map((g) => ({ grupo: g, candidatos: candidatosPrimeiroNome(g.nome, roster) }))
      .filter(({ candidatos }) => candidatos.length > 1)
    : []
  for (const { grupo, candidatos } of gruposAmbiguos) {
    bloq('nome ambíguo', `"${grupo.nome}" (${grupo.sala || grupo.chave}) pode ser ${candidatos.map((c) => c.nome).join(' ou ')} — escreva o nome completo no lote`)
  }
  const bloqueiosCampo = validarCasosParaPublicacao(casosNovos, { horaValida: (h) => ehHoraSequencialEscala(h) || !!turnoDeHora(h) })
  for (const b of bloqueiosCampo) bloq('campo inválido', textoBloqueio(b))
  if (COM_RODAPE.has(hospital) && !ordem.length) bloq('rodapé vazio', 'ordem de liberação vazia — a fila nasceria sem ninguém')

  // 3. cruzamento com as outras escalas (irmãs do lote vencem as publicadas)
  const naAjuda = new Set(ajuda.map(normNome))
  const aqui = new Map()
  for (const c of casos) {
    const bruto = texto(c.anestesista)
    if (!bruto || bruto === '//' || /^\?+$/.test(bruto)) continue
    const chave = c.anestesistaUserId || resolver(bruto) || normNome(bruto)
    if (!aqui.has(chave)) aqui.set(chave, bruto)
  }
  const cruzamento = { ajudaProvavel: [], conflitos: [] }
  for (const outra of outrasEscalas) {
    const label = rotulo(outra.hospital)
    const noRodape = new Set()
    for (const n of rodapeDoTurno(outra.ordemLiberacao, turno)) noRodape.add(resolver(n) || normNome(n))
    const comCasos = new Map()
    for (const c of outra.casos || []) {
      if ((c.turno || turno) !== turno) continue
      const bruto = texto(c.anestesista)
      if (!bruto || bruto === '//') continue
      const chave = c.anestesistaUserId || resolver(bruto) || normNome(bruto)
      comCasos.set(chave, (comCasos.get(chave) || 0) + 1)
    }
    for (const [chave, nome] of aqui) {
      if (naAjuda.has(normNome(nome))) continue
      if (comCasos.has(chave)) cruzamento.conflitos.push({ nome, hospital: label, casos: comCasos.get(chave) })
      else if (noRodape.has(chave)) cruzamento.ajudaProvavel.push({ nome, hospital: label })
    }
  }

  // 4. duplicidade entre hospitais — a tela BLOQUEIA até a decisão
  const duplicidades = detectarDuplicidadesEscala({
    casos, hospitalAtual: hospital, hospitalAtualLabel: rotulo(hospital), ordemAtual: ordem, periodo: turno,
    outrasEscalas,
    ajudas: [
      { hospitalLabel: rotulo(hospital), nomes: ajuda },
      ...outrasEscalas.map((o) => ({ hospitalLabel: rotulo(o?.hospital), nomes: rodapeDoTurno(o?.ajudaExterna, turno) })),
    ],
    resolver, normalizar: normNome, hospitalLabelFor: rotulo,
  })
  const jaPublicadas = new Map(decisoesPublicadas(existente?.linhaOverrides, turno).map((it) => [it.chave, it]))
  const publicadaPara = (key, nome) => {
    const n = texto(nome)
    for (const k of [key, n ? resolver(n) : null, n ? normNome(n) : null]) if (k && jaPublicadas.has(k)) return jaPublicadas.get(k)
    return null
  }
  // decisões do lote, carimbadas como a folha carimba (uid + nome de quando foi respondida)
  const decisoesCarimbadas = {}
  for (const d of duplicidades) {
    const resposta = decisoes[d.nome] || decisoes[normNome(d.nome)] || decisoes[d.key]
    if (!resposta) continue
    let decisao
    if (resposta.tipo === 'intencional') decisao = { tipo: 'intencional' }
    else if (resposta.tipo === 'troca' && resposta.parceiro) {
      decisao = {
        tipo: 'troca', parceiroNome: texto(resposta.parceiro), parceiroUid: resolver(resposta.parceiro) || null,
        ...(resposta.hospitalVaga ? { hospitalVaga: resposta.hospitalVaga } : {}),
        ...(resposta.apenasRegistro ? { apenasRegistro: true } : {}),
      }
    } else continue
    decisoesCarimbadas[d.key] = carimbarDecisao(decisao, d, { resolver, normalizar: normNome })
  }
  // Troca DECLARADA no lote fora de uma duplicidade (a escala já saiu trocada e falta só o
  // rastro, ou o parceiro está no consultório e não aparece em escala nenhuma): entra pela
  // pessoa presente aqui — `montarLinhaOverrides` descarta quem não está nesta escala.
  for (const [nome, resposta] of Object.entries(decisoes || {})) {
    if (!resposta || resposta.tipo !== 'troca' || !resposta.parceiro) continue
    const key = resolver(nome) || normNome(nome)
    if (!key || decisoesCarimbadas[key]) continue
    const decisao = {
      tipo: 'troca', parceiroNome: texto(resposta.parceiro), parceiroUid: resolver(resposta.parceiro) || null,
      ...(resposta.hospitalVaga ? { hospitalVaga: resposta.hospitalVaga } : {}),
      ...(resposta.apenasRegistro ? { apenasRegistro: true } : {}),
      ...(resposta.local ? { local: texto(resposta.local) } : {}),
    }
    decisoesCarimbadas[key] = carimbarDecisao(decisao, { key, nome }, { resolver, normalizar: normNome })
  }
  const decisaoDe = (d) => {
    const local = localizarDecisao(decisoesCarimbadas, d, { resolver, normalizar: normNome })
    if (local) return local
    const pub = publicadaPara(d.key, d.nome)
    return pub?.duplicidade === 'intencional' ? { chave: d.key, decisao: { tipo: 'intencional', publicada: true } } : null
  }
  const duplicidadesPendentes = duplicidades.filter((d) => !d.ajudaDeclarada && !decisaoDe(d))
  for (const d of duplicidadesPendentes) {
    const onde = d.ocorrencias.map((o) => `${o.hospitalLabel}: ${o.casos.length} caso(s)${o.noRodape ? ', no rodapé' : ''}`).join(' · ')
    bloq('duplicidade', `${d.nome} está em dois hospitais (${onde}) — responda no lote: decisoes["${d.nome}"] = {"tipo":"intencional"} ou {"tipo":"troca","parceiro":"NOME"}`)
  }
  const chaveDup = (nome) => resolver(nome) || normNome(nome)
  const ajudaProvavelSemDup = cruzamento.ajudaProvavel.filter((a) => !duplicidades.some((d) => d.key === chaveDup(a.nome)))
  for (const a of ajudaProvavelSemDup) aviso('ajuda provável', `${a.nome} tem caso aqui e está no rodapé de ${a.hospital} — se veio ajudar, marque em ajudaExterna`)
  for (const c of cruzamento.conflitos) aviso('em dois hospitais', `${c.nome} tem caso aqui e ${c.casos} caso(s) em ${c.hospital} no mesmo turno`)

  // 5. avisos da aba, na ordem da tela
  const conflitos = casos.length ? detectarConflitos(casosAtribuidos) : []
  for (const c of conflitos) aviso('conflito de horário', `${c.nome || 'mesmo login'} em ${c.sala1} (${c.hora1}) e ${c.sala2} (${c.hora2}) ao mesmo tempo`)
  const MULTI = new Set(['exames', 'umanita', 'iosc'])
  const porSala = new Map()
  for (const c of casos) {
    if (!MULTI.has(String(c.bloco || ''))) continue
    const t = texto(c.anestesista)
    if (!t || t === '//') continue
    if (!porSala.has(c.sala)) porSala.set(c.sala, [])
    porSala.get(c.sala).push(t)
  }
  for (const [sala, nomes] of porSala) {
    if (nomes.length >= 2 && new Set(nomes.map(normNome)).size === 1) aviso('bloco repetido', `${sala}: ${nomes.length} linhas todas com ${nomes[0]} — costuma ser propagação indevida`)
  }
  for (const g of detectarItensDuplicados(casos)) aviso('item repetido', `${g.item.sala} ${g.item.hora || ''} ${g.item.procedimento || ''} aparece ${g.quantidade}×`)
  if (hospital === 'hro' && casos.length) {
    const alvo = { Exames: /^EXAMES?$/, Imagem: /^IMAGEM$/, 'Hemodinâmica': /^HEMO/ }
    const presentes = new Set(casos.map((c) => normNome(c.sala)))
    const ausentes = Object.entries(alvo).filter(([, re]) => ![...presentes].some((s) => re.test(s))).map(([n]) => n)
    if (ausentes.length) aviso('seção ausente', `sem ${ausentes.join(', ')} na leitura — confira o mapa`)
  }
  const gruposSemAnestesista = grupos.filter((g) => !atribuicoes[g.chave] && g.indices.some((i) => !casos[i]?.semAnestesista))
  for (const g of gruposSemAnestesista) aviso('sem vínculo', `"${g.nome || '?'}" (${g.sala || g.chave}) não está no dicionário — publica como texto, sem login`)

  // 6. rodapé: numerado, suspeitos, cauda, casos fora do rodapé
  const ordemNumerada = resumirRodape(ordem, casos, resolver, ajuda)
  let rodapeSuspeitos = []
  if (ordem.length >= 2) {
    const uids = new Set(Object.values(atribuicoes).filter(Boolean))
    const nomesEscalados = new Set()
    for (const c of casos) {
      const n = normNome(c.anestesista)
      if (n && n !== '//') nomesEscalados.add(n)
      const uid = c.anestesistaUserId || (n && n !== '//' ? resolver(c.anestesista) : null)
      if (uid) uids.add(uid)
    }
    const temCaso = (nome) => { const uid = resolver(nome); return (uid && uids.has(uid)) || nomesEscalados.has(normNome(nome)) }
    const flags = ordem.map(temCaso)
    rodapeSuspeitos = ordem.filter((n, i) => !flags[i] && (flags[i - 1] || flags[i + 1]))
  }
  let ultimo = -1
  for (let i = ordemNumerada.length - 1; i >= 0; i--) if (ordemNumerada[i].casos > 0 || ordemNumerada[i].ajuda) { ultimo = i; break }
  const caudaLiberada = ultimo < 0 ? [] : ordemNumerada.slice(ultimo + 1).filter((p) => p.casos === 0 && !p.ajuda)
  const nomesCauda = new Set(caudaLiberada.map((p) => p.nome))
  const suspeitosExtracao = rodapeSuspeitos.filter((n) => !nomesCauda.has(n))
  const ehAjuda = (nome) => ajuda.some((n) => normNome(n) === normNome(nome))
  const naDuplicidade = new Set(duplicidades.map((d) => d.key))
  const conferidosSet = new Set((conferidos || []).map(normNome))
  const respondida = (nome) => {
    if (conferidosSet.has(normNome(nome))) return true
    const key = resolver(nome) || normNome(nome)
    return !!publicadaPara(key, nome)?.conferido
  }
  const semCirurgia = [...suspeitosExtracao, ...caudaLiberada.map((p) => p.nome)]
    .filter((nome) => !ehAjuda(nome))
    .filter((nome) => !naDuplicidade.has(resolver(nome) || normNome(nome)))
  for (const nome of semCirurgia) {
    if (respondida(nome)) continue
    if (nomesCauda.has(nome)) aviso('cauda', `${nome} fecha a ordem sem cirurgia — nasce LIBERADO (vermelho); se é erro de leitura, corrija o lote; se está certo, ponha em conferidos`)
    else aviso('na ordem sem caso', `${nome} está na ordem sem nenhum caso (entre nomes com caso) — a linha dele pode ter saído para outra pessoa`)
  }
  // casos fora do rodapé (o que o cruzamento já explica não repete)
  if (ordem.length) {
    const uidsRodape = new Set([...ordem, ...ajuda].map((n) => resolver(n)).filter(Boolean))
    const nomesRodape = new Set([...ordem, ...ajuda].map(normNome).filter(Boolean))
    const explicados = new Set([...cruzamento.ajudaProvavel.map((a) => normNome(a.nome)), ...cruzamento.conflitos.map((c) => normNome(c.nome))])
    const fora = new Map()
    for (const c of casos) {
      const bruto = texto(c.anestesista)
      if (!bruto || bruto === '//' || /^\?+$/.test(bruto)) continue
      const n = normNome(bruto)
      const uid = c.anestesistaUserId || resolver(bruto)
      if ((uid && uidsRodape.has(uid)) || nomesRodape.has(n) || explicados.has(n)) continue
      fora.set(bruto, (fora.get(bruto) || 0) + 1)
    }
    for (const [nome, n] of fora) aviso('fora da ordem', `${nome} tem ${n} caso(s) e não está no rodapé nem na ajuda — azul não lido? marque em ajudaExterna ou acrescente à ordem`)
  }

  // 7. cirurgia da manhã que atravessa sem dono presente (só à tarde)
  if (turno === 'vespertino' && existente) {
    const atravessam = casosQuePassamParaOTurno(existente.casos || [], 'vespertino')
    if (atravessam.length) {
      const presentes = presencaDoTurno(ordem, casosNovos, resolver)
      for (const c of atravessam.filter((x) => !estaPresente(presentes, x, resolver))) {
        aviso('travessia órfã', `${c.sala} ${c.hora || ''} (${c.anestesista || '?'}) passa para a tarde e o anestesista não está nesta escala — reatribua na Completa ou desmarque`)
      }
    }
  }

  // 8. escala numérica + férias (aviso, nunca bloqueio)
  let numerica = null
  if (ordem.length && dadosNumerica?.dias?.[data]) {
    const esperada = montarOrdem(dadosNumerica, { data, hospital, turno, ferias })
    if (esperada.ok && esperada.lista.length) {
      const c = compararComRodape(esperada.lista, ordem)
      numerica = { ...c, feriasConferidas: esperada.feriasConferidas, feriado: !!esperada.filaUnica, esperada: esperada.lista.map((p) => p.nome) }
      if (!c.iguais) {
        const partes = []
        if (c.faltamNoRodape.length) partes.push(`faltam no rodapé: ${c.faltamNoRodape.join(', ')}`)
        if (c.sobramNoRodape.length) partes.push(`a mais no rodapé: ${c.sobramNoRodape.join(', ')}`)
        if (c.foraDeOrdem.length) partes.push(`fora de ordem: ${c.foraDeOrdem.join(', ')}`)
        aviso('escala numérica', `rodapé difere da escala numérica${ferias ? ' (férias conferidas)' : ' (férias NÃO conferidas)'}: ${partes.join(' · ')}`)
      }
    }
  }

  // 9. guardrail anti-perda: publicar com menos casos apaga os anteriores
  const publicadosAntes = (existente?.casos || []).filter((c) => (c.turno || 'matutino') === turno).length
  if (existente?.publicacaoTurnos?.[turno] && !republicar) {
    bloq('já publicado', `o turno ${turno} já está publicado (${publicadosAntes} casos) — republicar zera status e liberações; use --republicar se for isso mesmo`)
  } else if (publicadosAntes >= 3 && publicadosAntes > casosNovos.length) {
    aviso('encolhe', `a escala publicada tem ${publicadosAntes} casos e a nova tem ${casosNovos.length} — publicar apaga os anteriores`)
  }

  // 10. payload da RPC, pelas mesmas funções da tela
  const conferidosMapa = Object.fromEntries((conferidos || []).map((n) => [resolver(n) || normNome(n), { uid: resolver(n) || null, nomeNorm: normNome(n) }]))
  const linhaOverrides = montarLinhaOverrides({
    decisoes: decisoesCarimbadas, conferidos: conferidosMapa, hospital, ordem, ajuda, casos: casosNovos,
    resolver, normalizar: normNome, carimbo,
  })
  const preservar = existente
    ? montarPreservacao({ existente, turno, ordem, ajuda, casos: casosNovos, resolver, normalizar: normNome })
    : null

  return {
    hospital, bloqueios, avisos,
    duplicidades, duplicidadesPendentes, numerica, ordemNumerada, cauda: caudaLiberada, suspeitos: suspeitosExtracao,
    casos: casosAtribuidos,
    payload: { casos: casosNovos, ordemLiberacao: ordem, ajudaExterna: ajuda, linhaOverrides, preservar },
  }
}

/**
 * O lote inteiro: realoca azuis emprestados, monta as irmãs de cada hospital (irmã em
 * conferência vence a publicada do mesmo hospital; os demais vêm do banco) e confere
 * um a um. `hospitais` = { [h]: { rows, posicoes, ordem, ajuda, dataDetectada } }.
 */
export function conferirLote({
  data, turno, hospitais, publicadas = {}, roster, resolver, rosterByUid, dadosNumerica = null, ferias = null,
  decisoes = {}, conferidos = [], republicar = false, carimbo = null,
}) {
  const nomes = Object.keys(hospitais)
  // pré-passada: casos atribuídos de cada aba, para o cruzamento e a realocação do azul
  const abas = {}
  for (const h of nomes) {
    const e = hospitais[h]
    const casos = carregarSelecionados(e.rows, h, e.posicoes, turno)
    const grupos = gruposAnestesista(casos, h)
    const atrib = preAtribuicoesDoDicionario(grupos, {}, resolver)
    const nomePorChave = Object.fromEntries(grupos.map((g) => [g.chave, g.nome]))
    const apelidoExibicao = (chave, uid) => {
      const r = rosterByUid.get(uid)
      if (r) return r.apelidos[0] || primeiroNomeUpper(r.nome)
      const t = nomePorChave[chave]
      return t ? normNome(t) : ''
    }
    abas[h] = {
      casos: selecionarCasosDoTurno(aplicarAtribuicoes(casos, atrib, apelidoExibicao, resolver), turno),
      ordem: (e.ordem || []).map(texto).filter(Boolean),
      ajuda: (e.ajuda || []).map(texto).filter(Boolean),
    }
  }
  const realocados = realocarAzuisEmprestados(abas, turno, resolver)
  const resultado = { data, turno, realocados, hospitais: {} }
  for (const h of nomes) {
    const irmas = nomes.filter((o) => o !== h).map((o) => ({ hospital: o, casos: abas[o].casos, ordemLiberacao: abas[o].ordem, ajudaExterna: abas[o].ajuda }))
    const cobertos = new Set(irmas.map((i) => i.hospital))
    const doBanco = Object.values(publicadas).filter((p) => p?.hospital && p.hospital !== h && !cobertos.has(p.hospital))
    resultado.hospitais[h] = conferirHospital(h, { ...hospitais[h], ordem: abas[h].ordem, ajuda: abas[h].ajuda }, {
      data, turno, roster, resolver, rosterByUid, existente: publicadas[h] || null,
      outrasEscalas: [...irmas, ...doBanco], dadosNumerica, ferias,
      decisoes: decisoes[h] || decisoes, conferidos, republicar, carimbo,
    })
  }
  return resultado
}
