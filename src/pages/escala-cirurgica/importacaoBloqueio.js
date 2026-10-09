/**
 * IMPORTAÇÃO DE ESCALA PELO APP BLOQUEADA (dono 09/10/2026): "se alguém tentar importar as
 * escalas pelo aplicativo quero que envie a mensagem: escala não pode ser publicada por falta
 * de créditos".
 *
 * A leitura das fotos usa a IA e a conta está sem crédito. O botão "Importar" (dia útil e fim
 * de semana) mostra a mensagem e não abre a tela. A publicação pelo chat (skill
 * `publicar-escala`) não passa por aqui e segue funcionando.
 *
 * Para liberar de novo: `IMPORTACAO_BLOQUEADA = false`.
 */
export const IMPORTACAO_BLOQUEADA = true
export const MENSAGEM_IMPORTACAO_BLOQUEADA = 'Escala não pode ser publicada por falta de créditos'
