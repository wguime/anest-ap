/**
 * Gate do Extrato de Férias.
 *
 * Quem VÊ o extrato: todo ANESTESIOLOGISTA (dono 2026-09-11 — "libere a
 * funcionalidade de conferência de extrato de férias para todos os
 * anestesistas; NÃO é para liberar para funcionários, enfermeiros,
 * farmacêuticos, residentes"). Papel, não lista de e-mails: o cargo é
 * exatamente o recorte que o dono descreveu. A RLS `can_access_extrato_ferias()`
 * (migration 20260911180000) lê o MESMO papel em profiles.role — mudar um =
 * mudar o outro. Sem escape de admin: administrador que não é anestesiologista
 * fica de fora, como pedido. Dev local segue aberto.
 *
 * Histórico: 03/08 nasceu restrito a três pessoas por e-mail (Guilherme — as
 * DUAS contas, decisão 27/07 de manter ambas —, Fernanda e Leandro); 04/08
 * entrou João Ricardo; 11/09 abriu ao cargo. A lista por e-mail sobrevive
 * abaixo com OUTRO papel: quem recebe a notificação agregada de alertas
 * (EMAILS_ALERTAS_FERIAS) e quem pode marcar as próprias férias (EMAIL_TO_SOCIO).
 */
import { normalizeRole } from '@/utils/userTypes'

/**
 * Destinatários da notificação agregada diária de alertas de férias (1/dia,
 * só contagens). Era a allowlist de acesso até 11/09; o dono abriu a LEITURA
 * ao cargo sem mexer em quem é avisado — avisar 48 pessoas do mesmo alerta
 * seria ruído, e a fiscalização continua com estes.
 */
export const EMAILS_ALERTAS_FERIAS = [
  'wguime@yahoo.com.br',            // Guilherme Melo (conta 1)
  'anestesista.guilherme@gmail.com', // Guilherme Souza Melo (conta 2)
  'guollofernanda@gmail.com',       // Fernanda Guollo
  'leandrobernardes03@hotmail.com', // Leandro Bernardes
  'joaormoreiraster@gmail.com',     // João Ricardo Moreira (04/08) — coordenador do comitê de escalas
  'alineanestesio@gmail.com',       // Aline Boff Bonfante — comitê de escalas (18/11)
  'oscarmorais3@hotmail.com',       // Oscar Morais — comitê de escalas (18/11)
  'alexandre.schmidt82@gmail.com',  // Alexandre Schmidt — comitê de escalas (18/11)
]

/**
 * Comitê de escalas (regras de férias 2026/27): aprova exceções, adiantamentos
 * e decide os candidatos acima das 6 vagas. João Ricardo é o coordenador e
 * recebe os alertas. Também estão em EMAILS_ALERTAS_FERIAS.
 */
export const EMAILS_COMITE_ESCALAS = [
  'joaormoreiraster@gmail.com',    // João Ricardo Moreira (coordenador)
  'alineanestesio@gmail.com',      // Aline Boff Bonfante
  'oscarmorais3@hotmail.com',      // Oscar Morais
  'alexandre.schmidt82@gmail.com', // Alexandre Schmidt
]

/**
 * E-mail → nome do sócio no Pega Plantão (chave de identidade do extrato).
 * 18/11/2026 (dono): a marcação abriu a TODOS os sócios — V-01 das regras
 * novas ("a partir de janeiro, só no aplicativo"). Os 46 casaram 1:1 com
 * profiles (nome + e-mail) e o dono tem 2 contas. Rômulo segue em 2026 (sai
 * em 2027 — quem não está em SOCIOS_FERIAS do ano não marca naquele ano).
 * ESPELHA a função SQL `ferias_nome_socio()` (migration 20260804120000),
 * usada no WITH CHECK que impede marcar férias em nome de outro — mudar
 * aqui exige mudar lá. Quem não está aqui VÊ o extrato (se anestesiologista)
 * mas não ganha a aba Agendar.
 */
export const EMAIL_TO_SOCIO = {
  'mtcury19@gmail.com': 'MARCOS TADEU CURY',
  'raperizzolo@gmail.com': 'RAUL PERIZZOLO',
  'dallmagro@hotmail.com': 'ADRIANO DALL´MAGRO',
  'vicentepons4@gmail.com': 'VICENTE PONS',
  'dezembro71@hotmail.com': 'MAURICIO MAHALEM BASTOS',
  'rosecury64@gmail.com': 'ROSEMARY CURY',
  'eclampsium@yahoo.com.br': 'HUMBERTO HEPP',
  'rodneilima@gmail.com': 'RODNEI CABRAL LIMA',
  'marcoscc1211@gmail.com': 'MARCOS CARDOSO COSTA',
  'schneiderraquel17@gmail.com': 'RAQUEL SCHNEIDER',
  'alineanestesio@gmail.com': 'ALINE BOFF BONFANTE',
  'gustavogarim@hotmail.com': 'GUSTAVO ALMANSA GARIM',
  'oscarmorais3@hotmail.com': 'OSCAR AUGUSTO DE OLIVEIRA MORAIS',
  'janafavorito@gmail.com': 'JANAINA SANCHES FAVORITO MORAIS',
  'diegobori@hotmail.com': 'DIEGO B. RIGOTTI',
  'guollofernanda@gmail.com': 'FERNANDA GUOLLO',
  'gabicvedana@gmail.com': 'GABRIELA CITRON VEDANA',
  'robertagrando@yahoo.com.br': 'ROBERTA MARINA GRANDO',
  'gustavoo_b@hotmail.com': 'GUSTAVO BIESDORF',
  'leoferrazzo@gmail.com': 'LEONARDO FERRAZZO',
  'mariliojosef@hotmail.com': 'MARILIO JOSÉ FLACH',
  'fhm555@gmail.com': 'FERNANDO HENRIQUE MACHADO',
  'leandrobernardes03@hotmail.com': 'LEANDRO BERNARDES',
  'cristinabertolb@gmail.com': 'CRISTINA BERTOL BARBOSA MARCON',
  'tiagoiopviana@gmail.com': 'TIAGO IOP VIANA',
  'wguime@yahoo.com.br': 'G. MELO',
  'anestesista.guilherme@gmail.com': 'G. MELO',
  'paulotmed@gmail.com': 'PAULO TONINI',
  'guigostaub@hotmail.com': 'G. STAUB',
  'alexandre_danieli@yahoo.com.br': 'A. DANIELI',
  'joaormoreiraster@gmail.com': 'JOÃO RICARDO MOREIRA',
  'alexandre.schmidt82@gmail.com': 'A. SCHMIDT',
  'klismandrescherhilleshein@gmail.com': 'KLISMAN DRESCHER HILLESHEIN',
  'giovanagomes.noll@gmail.com': 'GIOVANA GOMES NOLL',
  'edusavoldi@gmail.com': 'EDUARDO SAVOLDI',
  'louisemwarnava@yahoo.com.br': 'LOUISE MACAGNAN WARNAVA',
  'dormatheuscunha@gmail.com': 'MATHEUS VIEIRA DA CUNHA',
  'thayna_santos9@hotmail.com': 'THAYNÁ REGINA SANTOS',
  'erlei@clinicacastelo.com.br': 'ERLEI PERINI',
  'gabrieljkc@gmail.com': 'GABRIEL JUAN KETTENHUBER COSTA',
  'karine.bedin9@gmail.com': 'KARINE BEDIN',
  'rafaelpelissaro@gmail.com': 'RAFAEL PELISSARO',
  'romulo_roxos@hotmail.com': 'ROMULO SANTOS ROXO',
  'joaohvanni@hotmail.com': 'JOAO HENRIQUE SALVAO VANNI',
  'guilhermexavier.d@gmail.com': 'GUILHERME XAVIER DI DOMENICO',
  'danikreis@gmail.com': 'DANIELA KLEIN REIS',
  'nathaliafornarifernandes@gmail.com': 'NATHALIA FORNARI FERNANDES',
}

/**
 * Comitê de Ética — recebe aviso quando alguém marca férias além da cota
 * (REGRAS: dia irregular custa um dia a menos no total; a decisão de 2 a 5
 * dias de perda é do Comitê). Decisão do dono 04/08: Leandro, Fernanda e
 * João Ricardo.
 */
export const EMAILS_COMITE_ETICA = [
  'leandrobernardes03@hotmail.com', // Leandro Bernardes
  'guollofernanda@gmail.com',       // Fernanda Guollo
  'joaormoreiraster@gmail.com',     // João Ricardo Moreira
]

const emailDe = (user) => (user?.email || '').trim().toLowerCase()

/** Ver o extrato = ser anestesiologista (alias legado 'medico' conta, via normalizeRole). */
export const podeVerExtratoFerias = (user) =>
  import.meta.env.DEV || normalizeRole(user?.role) === 'anestesiologista'

/**
 * Sócio que o usuário pode marcar/desmarcar (self-service: só o próprio).
 * Em DEV sem e-mail casado, cai no sócio do dono para permitir testar o
 * fluxo localmente — em produção a RLS é quem manda.
 * @returns {string|null} nome do sócio ou null (sem direito de marcar)
 */
export function getSocioDoUsuario(user) {
  const socio = EMAIL_TO_SOCIO[emailDe(user)]
  if (socio) return socio
  return import.meta.env.DEV ? 'G. MELO' : null
}
