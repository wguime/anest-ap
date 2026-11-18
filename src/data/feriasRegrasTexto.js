/**
 * Regras de férias do grupo — texto de consulta. Fonte: "Regras de Escalação
 * – versão estruturada" (comitê de escalas, 12/11/2026), seção 7, V-01 a
 * V-33, com as respostas do comitê de 16/11. Valem desde 18/11/2026 (dono).
 *
 * Organizado por TEMA porque é assim que a dúvida aparece na hora de
 * marcar ("quantos dias eu tenho?", "posso desmarcar?"). Cada item cita o
 * código da regra (o documento pede que tudo cite o código). `verificada:
 * true` = o app confere sozinho (trava a marcação ou alerta no extrato); o
 * resto é decisão do comitê de escalas ou orientação.
 */

export const REGRAS_FERIAS = [
  {
    id: 'cota',
    titulo: 'Quantos dias você tem',
    itens: [
      { texto: 'V-02 · A cota de cada sócio é informada pelo comitê de escalas: 5 dias no 1º ano de grupo, 20 no 2º e 3º, 30 a partir do 4º e, depois de 25 anos de grupo, +1 dia por ano até 35.', verificada: true },
      { texto: 'V-01 · Contam só dias úteis. Até dezembro de 2026 a marcação é no Pega Plantão; a partir de janeiro de 2027, só no app. As marcações de 2027 já feitas no Pega Plantão são importadas e conferidas, e quem estiver fora da regra ajusta sem penalidade até 31/01/2027.' },
      { texto: 'V-04 · Não há acúmulo de dias entre anos.', verificada: true },
      { texto: 'V-05 · Adiantamento de dias (do ano seguinte ou de um semestre para o outro) só com aprovação do comitê de escalas. O app trava os dias acima da cota até a aprovação. No ano que cedeu os dias não há novo adiantamento.', verificada: true },
      { texto: 'V-31 · Licença saúde não desconta férias nem ocupa vaga: o sócio registra com o atestado e o comitê valida.' },
      { texto: 'L-04 · Licença-maternidade: 120 dias corridos, e a cota do ano cai para 20 dias úteis (entra na cota informada).' },
      { texto: 'L-03 · Licença-paternidade: o dia do nascimento mais 1 dia. Nascimento em sábado, domingo ou feriado: só o próximo dia útil.' },
    ],
  },
  {
    id: 'vagas',
    titulo: 'Vagas por dia',
    itens: [
      { texto: 'V-09 · São 6 vagas por dia, contando férias e congresso. Licença saúde não ocupa vaga.', verificada: true },
      { texto: 'V-10 · Não existe 7ª vaga: quem marca num dia com as 6 vagas ocupadas entra como candidato, e o comitê de escalas é avisado e decide. Fora dos períodos nobres, a candidatura é só para extrema necessidade, e quem ficar com a vaga perde 3 dias. Quem não ficar ou abrir mão não paga nada.', verificada: true },
      { texto: 'V-33 · Na 2ª quinzena de dezembro e na 1ª quinzena de janeiro, qualquer sócio pode se candidatar acima das 6 vagas, sem limite de candidatos e sem perder dias. O comitê decide por sorteio ou pelo histórico.', verificada: true },
      { texto: 'V-11 · Ninguém marca férias no dia do feriado: o feriado não tem vaga.', verificada: true },
    ],
  },
  {
    id: 'distribuicao',
    titulo: 'Como distribuir no ano',
    itens: [
      { texto: 'V-02 · A cota é dividida meio a meio: cada semestre aceita até a metade, arredondada para cima (31 dias = 16 + 15 ou 15 + 16). O app não deixa marcar além desse teto.', verificada: true },
      { texto: 'V-03 · Os dias do 1º semestre são usados até 30/06 e os do 2º até 31/12, com o mesmo prazo para todos. Dia não usado no semestre é perdido.', verificada: true },
      { texto: 'V-06 · Semanas cheias por semestre: com 15 a 18 dias no semestre, 2 semanas cheias e o resto avulso; com 10 dias, 1 semana e 5 avulsos; com 5 dias, tudo em semana cheia. São mínimos. Semana com feriado conta como cheia mesmo tendo 4 dias.', verificada: true },
      { texto: 'V-06 · No 1º ano (ano civil em que entrou no grupo), os 5 dias são uma semana de segunda a sexta sem feriado, no semestre que você escolher. Semana com feriado só com aprovação do comitê.', verificada: true },
      { texto: 'V-07 · No máximo 2 sextas e 2 segundas isoladas por semestre. Sexta seguida da segunda seguinte conta como bloco. A 3ª só na semana em andamento, se houver vaga, e o comitê é avisado.', verificada: true },
      { texto: 'V-08 · Em semana com feriado, segunda ou sexta sozinha não vale: com feriado na quinta, a sexta sozinha é proibida; com feriado na terça, a segunda sozinha é proibida.', verificada: true },
    ],
  },
  {
    id: 'nobres',
    titulo: 'Períodos nobres e congressos',
    itens: [
      { texto: 'V-12 · Períodos nobres (1ª quinzena de janeiro, 2ª quinzena de dezembro e as semanas escolares de julho) exigem semanas cheias. Dias isolados só a partir de 2 meses antes, se houver vaga.', verificada: true },
      { texto: 'V-13 · Nas semanas escolares de julho, só quem tem filho em idade escolar marca até 2 meses antes da semana; depois disso, se sobrar vaga, qualquer sócio. Não há limite de semanas em julho. Não vale para janeiro. O comitê cadastra quem tem filho.', verificada: true },
      { texto: 'V-20 · O comitê revisa quem já usou julho, o peri-recesso e os feriadões nos anos anteriores e dá chance a outros interessados.' },
      { texto: 'V-21 · Em período de congresso (CBA e COPA, com data divulgada) ou de prova do TSA, você pode marcar férias. O dia ocupa uma das 6 vagas; se o dia já estiver cheio, você é candidato e não perde os 3 dias.' },
      { texto: 'V-22 · São 2 dias extras por ano civil para CBA, COPA ou prova do TSA (só para quem presta), exceto no 1º ano de grupo. Os dias são marcados com asterisco, com comprovante anexado em até 15 dias, e não descontam da cota. Sem comprovante, viram férias normais. COPA sem data divulgada 2 meses antes não dá direito aos dias extras.' },
    ],
  },
  {
    id: 'feriados',
    titulo: 'Feriados',
    itens: [
      { texto: 'V-18 · Tirando a semana cheia que contém o feriado, o feriado não conta como dia de férias.', verificada: true },
      { texto: 'V-19 · Férias numa semana com feriado sem tirar a semana toda: o feriado conta como dia de férias (você "paga" 1 dia a mais).', verificada: true },
      { texto: 'V-15/V-16 · Cada sócio marca 1 semana cheia com feriado por semestre, a qualquer momento, havendo vaga. Semanas extras só a partir de 30 dias antes do feriado, com vaga sobrando. Dias soltos numa semana com feriado não gastam essa semana.', verificada: true },
      { texto: 'F-03 · Recesso de fim de ano: o grupo se divide entre o peri-natal e o peri-réveillon. 2026/27: de 23/12/2026 a 02/01/2027. 2027/28: de 24/12/2027 a 02/01/2028. 25/12 e 01/01 são recesso, não feriado.' },
    ],
  },
  {
    id: 'prazos',
    titulo: 'Prazos e desmarcação',
    itens: [
      { texto: 'V-27 · Férias marcadas não podem ser desmarcadas depois que a escala do dia anterior sai, à noite. A véspera inteira fica travada.', verificada: true },
      { texto: 'V-25 · Desistir de semana em período nobre: até 1 mês antes. Depois disso os dias contam igual.', verificada: true },
      { texto: 'V-32 · Desmarcar semana cheia com feriado com menos de 2 meses de antecedência desconta 1 dia da cota (o comitê registra).' },
      { texto: 'V-26 · Desmarcar dias de congresso: até 2 meses antes do evento, senão eles contam como férias.' },
      { texto: 'V-28 · Saída emergencial: avise o coordenador do turno. O dia conta como férias, a menos que caiba em licença saúde.' },
      { texto: 'V-29 · Não chegou à cidade (aeroporto fechado, atraso de voo): o dia conta como férias, 1 dia se houver vaga e 2 se não houver.' },
    ],
  },
  {
    id: 'penalidades',
    titulo: 'Penalidades',
    itens: [
      { texto: 'V-30 · Cada dia de férias irregular tira 1 dia do total (pode ser descontado no ano seguinte). Vale para o que o app não bloqueia, como marcações antigas não ajustadas até 31/01/2027, faltas fora do app e exceções que não se confirmaram. O comitê registra a penalidade.' },
      { texto: 'S-04 · No 4º evento de conduta em 12 meses, o Comitê de Ética pode aplicar perda de 2 a 5 dias de férias, registrada como penalidade.' },
    ],
  },
]

/** Dúvidas que aparecem na hora de marcar — resposta curta e direta. */
export const FAQ_FERIAS = [
  {
    p: 'Quantos dias eu tenho neste ano?',
    r: 'A cota é informada pelo comitê de escalas: 5 dias no 1º ano, 20 no 2º e 3º, 30 do 4º em diante e +1 por ano depois de 25 anos de grupo (teto de 35). O extrato mostra a sua cota e o saldo na aba Individual.',
  },
  {
    p: 'O dia que eu quero já tem 6 pessoas. Posso marcar mesmo assim?',
    r: 'Pode, mas você entra como candidato, e o comitê de escalas é avisado e decide quem fica (V-10). Fora dos períodos nobres, a candidatura é só para extrema necessidade, e quem ficar com a vaga perde 3 dias. Na 2ª quinzena de dezembro, na 1ª de janeiro e nas semanas escolares de julho, quem fica não perde dias.',
  },
  {
    p: 'Marquei e me arrependi. Consigo desmarcar?',
    r: 'Sim, até a escala do dia anterior sair, ou seja, até dois dias antes (V-27). Semana em período nobre só até 1 mês antes (V-25). Semana cheia com feriado desmarcada com menos de 2 meses desconta 1 dia (V-32).',
  },
  {
    p: 'Feriado na semana conta como dia de férias?',
    r: 'Ninguém marca o próprio dia do feriado. Pegando a semana inteira, o feriado não conta. Pegando só parte dela, o feriado conta como 1 dia de férias, mesmo sem você ter marcado.',
  },
  {
    p: 'Quanto posso tirar em cada semestre?',
    r: 'Até a metade da cota em cada um, arredondada para cima (30 dias = até 15 por semestre). Os dias do 1º semestre valem até 30/06 e os do 2º até 31/12. O que não for usado no semestre é perdido, e o app bloqueia a marcação acima do teto. Quem está no 1º ano tem 1 semana e escolhe o semestre.',
  },
  {
    p: 'Posso marcar tudo em dias soltos?',
    r: 'Não. Com 15 a 18 dias no semestre, 2 semanas precisam ser cheias; com 10 dias, 1 semana. No máximo 2 segundas e 2 sextas isoladas por semestre. O app avisa e bloqueia na confirmação.',
  },
  {
    p: 'Quero férias em julho ou no fim de dezembro. Muda alguma coisa?',
    r: 'São períodos nobres e exigem semanas cheias. Em julho, só as semanas do calendário escolar são nobres: até 2 meses antes, a preferência é de quem tem filho em idade escolar. Não há limite de semanas em julho.',
  },
  {
    p: 'Vou a um congresso. Como marco?',
    r: 'São 2 dias extras por ano para CBA, COPA ou prova do TSA (exceto no 1º ano). Esses dias não descontam da cota se você mandar o comprovante em até 15 dias. Por enquanto, marque como férias e avise o comitê de escalas para registrar.',
  },
  {
    p: 'Sobrou dia de férias no fim do ano. Passa para o ano que vem?',
    r: 'Não. Os dias não acumulam. Adiantar dias do ano seguinte é possível, mas só com aprovação do comitê de escalas.',
  },
  {
    p: 'Tirei licença saúde. Perco férias?',
    r: 'Não. A licença saúde não desconta férias nem ocupa vaga. Você registra com o atestado e o comitê valida. Licença-maternidade reduz a cota do ano para 20 dias úteis.',
  },
  {
    p: 'Vou ser pai. Quantos dias tenho?',
    r: 'O dia do nascimento mais 1 dia. Se o nascimento cair em sábado, domingo ou feriado, vale só o próximo dia útil.',
  },
  {
    p: 'Precisei sair da escala de emergência. Como fica?',
    r: 'Conta como um dia de férias e precisa ser avisado ao coordenador do turno, a não ser que caiba em licença saúde (V-28).',
  },
]
