/**
 * Regras de férias do grupo — texto de consulta (fonte: REGRAS ESCALAS.pdf,
 * seções FÉRIAS, FERIADOS, PRAZOS e os trechos de LICENÇA SAÚDE que mexem
 * na cota).
 *
 * Organizado por TEMA porque é assim que a dúvida aparece na hora de
 * marcar ("quantos dias eu tenho?", "posso desmarcar?"). O que o app
 * verifica sozinho está marcado com `verificada: true` — quem lê sabe o
 * que o extrato cobre e o que continua sendo responsabilidade da pessoa.
 */

export const REGRAS_FERIAS = [
  {
    id: 'cota',
    titulo: 'Quantos dias você tem',
    itens: [
      { texto: 'A cota cresce com o tempo de grupo: 5 dias no 1º ano; 20 dias no 2º e 3º; 30 dias a partir do 4º ano.', verificada: true },
      { texto: 'Depois de 25 anos de grupo, +1 dia por ano até o limite de 35 dias úteis.', verificada: true },
      { texto: 'Só contam DIAS ÚTEIS, e eles precisam ser usados no ano corrente — não acumulam para o ano seguinte.', verificada: true },
      { texto: 'Licença-saúde desconta férias: em média 1 dia de férias a cada 8 dias de licença (proporcional à cota).' },
      { texto: 'Licença-maternidade: 120 dias corridos e a cota do ano vigente cai para 20 dias úteis.' },
      { texto: 'Adiantar dias do ano seguinte é possível com aprovação do coordenador de escalas — descontam no ano correspondente e, nesse ano, não cabe novo adiantamento.' },
    ],
  },
  {
    id: 'vagas',
    titulo: 'Vagas por dia',
    itens: [
      { texto: 'São 6 vagas de férias por dia.', verificada: true },
      { texto: 'Em extrema necessidade a 7ª vaga pode ser usada, mas conta como 3 dias de férias.', verificada: true },
      { texto: 'A 7ª vaga NÃO é permitida na semana anterior nem na posterior ao recesso de fim de ano (nesse período, só licença-saúde).' },
    ],
  },
  {
    id: 'distribuicao',
    titulo: 'Como distribuir no ano',
    itens: [
      { texto: 'Metade dos dias precisa ser usada até o fim de junho — ou até o fim de julho para quem tem filhos em idade escolar. O que sobrar dessas datas é perdido.', verificada: true },
      { texto: 'Dias não usufruídos em cada semestre são perdidos, salvo decisão em assembleia. Adiantar dias de um semestre para o anterior é permitido.' },
      { texto: 'Com 30 dias de cota: pelo menos 4 semanas inteiras; 2 semanas podem ser fracionadas em dias avulsos. Com 20 dias: 2 semanas inteiras e 2 fracionáveis. Quem tem 1 semana (1º ano) usa no semestre que quiser.', verificada: true },
      { texto: 'No máximo 2 sextas e 2 segundas isoladas por semestre. Para marcar mais desses dias avulsos, só na semana vigente e avisando o coordenador.', verificada: true },
    ],
  },
  {
    id: 'nobres',
    titulo: 'Períodos nobres e congressos',
    itens: [
      { texto: '1ª metade de janeiro, 2ª metade de dezembro e julho exigem marcação em semanas cheias. A 3 meses da data, se sobrarem dias livres, pode marcar avulso.', verificada: true },
      { texto: 'Em julho e janeiro a prioridade é de quem tem filhos em idade escolar (fundamental e médio), e não se marca mais de 1 semana em julho. Esses colegas precisam marcar com no mínimo 3 meses de antecedência, senão as vagas abrem para os demais.' },
      { texto: 'Em períodos de congresso (COPA e CBA, com data divulgada), não se marca férias — exceto se sobrarem vagas até 3 meses antes ou por acerto com o coordenador.' },
      { texto: 'Cada colega tem direito a 2 dias extras livres para congresso ou curso (não vale no 1º ano de grupo).' },
      { texto: 'Quem marca congresso e desiste com menos de 3 meses: os dias contam como férias do mesmo jeito.' },
      { texto: 'Quem já usou os períodos nobres entra na análise de distribuição — havendo interesse concomitante, a preferência vai para quem ainda não usou.' },
    ],
  },
  {
    id: 'feriados',
    titulo: 'Feriados',
    itens: [
      { texto: 'Feriado no meio da semana só NÃO conta como dia de férias se você pegar a semana cheia (anterior ou posterior, incorporando o feriado).', verificada: true },
      { texto: 'Períodos menores que uma semana que contenham o feriado: o feriado conta como dia de férias.', verificada: true },
      { texto: 'A duas semanas da data, se sobrarem vagas, libera-se marcar de qualquer forma, sem pagar o feriado e sem consumir "vaga de feriado".' },
      { texto: 'No recesso de fim de ano o grupo se divide: metade folga nos dias peri-natal, metade nos dias peri-réveillon.' },
    ],
  },
  {
    id: 'prazos',
    titulo: 'Prazos e desmarcação',
    itens: [
      { texto: 'Férias marcadas não podem ser desmarcadas depois que a escala do dia sai — ou seja, a partir da véspera à noite.', verificada: true },
      { texto: 'Desistir de semanas em meses nobres (jan, jul, dez) ou de semanas de feriado exige 1 mês de antecedência; fora do prazo, os dias contam igual.' },
      { texto: 'Marcar férias em meses nobres e em congressos: 3 meses de antecedência, senão as vagas abrem para os outros.' },
      { texto: 'Desmarcar dias de congresso: 3 meses de antecedência, senão contam como férias.' },
      { texto: 'Sair da escala em situação emergencial conta como um dia de férias (salvo o que se enquadrar em licença-saúde) e precisa ser avisado ao coordenador do turno.' },
      { texto: 'Não conseguir trabalhar por não ter chegado à cidade (voo atrasado, aeroporto fechado) conta como férias: 1 dia se houver vaga, 2 dias se não houver.' },
    ],
  },
  {
    id: 'penalidades',
    titulo: 'Penalidades',
    itens: [
      { texto: 'Descumprir as regras custa dias de férias: cada dia de férias irregular vira um dia a menos no total (pode ser cobrado no ano seguinte se for notado depois que a cota do ano acabou).' },
      { texto: 'Sanções do grupo (sobrecarregar colegas, negligência, ausência não justificada) chegam a perda de 2 a 5 dias de férias no 4º evento, conforme decisão do Comitê de Ética.' },
    ],
  },
]

/** Dúvidas que aparecem na hora de marcar — resposta curta e direta. */
export const FAQ_FERIAS = [
  {
    p: 'Quantos dias eu tenho neste ano?',
    r: 'Depende do tempo de grupo: 5 no 1º ano, 20 no 2º e 3º, 30 do 4º em diante, e +1 por ano depois dos 25 anos (teto de 35). O extrato já mostra a sua cota e o saldo na aba Individual.',
  },
  {
    p: 'O dia que eu quero já tem 6 pessoas. Posso marcar mesmo assim?',
    r: 'Pode, mas custa caro: a 7ª vaga conta 3 dias de férias em vez de 1. O app avisa antes de confirmar e registra quem foi o último a marcar naquele dia — é quem paga.',
  },
  {
    p: 'Marquei e me arrependi. Consigo desmarcar?',
    r: 'Sim, desde que a escala do dia ainda não tenha saído — na prática, até dois dias antes. A partir da véspera o app bloqueia, porque a escala já foi publicada.',
  },
  {
    p: 'Feriado na semana conta como dia de férias?',
    r: 'Só se você não pegar a semana cheia. Pegando a semana inteira que contém o feriado, ele não é descontado. Períodos menores que a semana pagam o feriado.',
  },
  {
    p: 'Posso deixar tudo para o segundo semestre?',
    r: 'Não. Metade dos dias precisa ser usufruída até o fim de junho (ou julho, para quem tem filhos em idade escolar). O que sobra dessas datas é perdido.',
  },
  {
    p: 'Posso marcar tudo em dias soltos?',
    r: 'Não. Com cota de 30 dias, pelo menos 4 semanas precisam ser inteiras — só 2 semanas podem virar dias avulsos. Além disso, no máximo 2 segundas e 2 sextas isoladas por semestre.',
  },
  {
    p: 'Quero férias em julho ou no fim de dezembro. Muda alguma coisa?',
    r: 'Sim: são períodos nobres e exigem semanas cheias, com 3 meses de antecedência. Em julho, no máximo 1 semana. A prioridade é de quem tem filhos em idade escolar, e as vagas não reservadas nesse prazo abrem para os demais.',
  },
  {
    p: 'Sobrou dia de férias no fim do ano. Passa para o ano que vem?',
    r: 'Não. Os dias são do ano corrente e não acumulam. Adiantar dias do ano seguinte é possível, mas só com aprovação do coordenador de escalas.',
  },
  {
    p: 'Tirei licença-saúde. Perco férias?',
    r: 'Em média, 1 dia de férias a cada 8 dias de licença, proporcional à sua cota. Licença-maternidade reduz a cota do ano para 20 dias úteis.',
  },
  {
    p: 'Precisei sair da escala de emergência. Como fica?',
    r: 'Conta como um dia de férias e precisa ser avisado ao coordenador do turno — a não ser que o motivo se enquadre em licença-saúde.',
  },
]
