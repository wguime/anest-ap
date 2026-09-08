/**
 * Vocabulário que vai junto da imagem para a leitura da Vision (Onda 4, 4.7).
 *
 * São os APELIDOS, não os nomes completos: o mapa da escala é escrito em
 * apelido, e é ele que o modelo tem de reconhecer. Quem não tem apelido entra
 * pelo primeiro nome — nome completo praticamente não aparece no quadro.
 *
 * A resolução apelido → uid da conferência continua igual; o que muda é que o
 * modelo para de ter vocabulário aberto na coluna do anestesista, que é de onde
 * saem "GUILHERME M ELO" (o kerning parte o sobrenome) e o nome inventado no
 * lugar da marca de repetição.
 *
 * ⚠️ MORA AQUI, e não dentro de `useRosterAnestesistas`, porque esse hook é
 * mockado por mais de vinte arquivos de teste: importar a função de lá fazia o
 * teste dela passar sozinho e falhar na suíte completa, ao pegar o mock de
 * outro arquivo em vez do módulo real.
 */
export function vocabularioVision(roster) {
  const nomes = []
  for (const r of roster || []) {
    if (Array.isArray(r?.apelidos) && r.apelidos.length) nomes.push(...r.apelidos)
    else if (r?.nome) nomes.push(String(r.nome).trim().split(/\s+/)[0])
  }
  return nomes.map((n) => String(n || '').trim()).filter(Boolean)
}

export default vocabularioVision
