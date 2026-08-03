# Escala Cirúrgica — matriz canônica de regras

> Atualizada em 2026-08-02. Este arquivo é a referência curta para revisão de código.
> O histórico detalhado continua em `docs/escala-cirurgica.md`, mas decisões antigas
> riscadas/removidas não prevalecem sobre esta matriz nem sobre o `AGENTS.md`.

| Domínio | Invariante atual | Implementação principal | Prova automatizada |
|---|---|---|---|
| Acesso | Leitura e edição usam o mesmo conjunto: anestesiologista, residente, técnico de enfermagem, secretária e admin; aliases legados são normalizados. | `gate.js`; RLS `can_write_escala_cirurgica()` | `escalaCirurgicaPersonas.test.jsx` |
| Data | A data selecionada é a data da escala; o dia em que o WhatsApp foi recebido não interfere. Data impressa divergente gera sugestão, nunca troca automática. | `ImportarEscalaPage.jsx`; Edge `dataDetectada` | `importarEscalaConferencia.test.jsx` |
| Turno | Matutino `<13:00`; vespertino `>=13:00`. Anexo misto publica somente o turno selecionado. Item sem hora fica preso ao turno escolhido no upload. | `utils.js#turnoDeHora/selecionarCasosDoTurno` | `turnoConvivencia.test.js` |
| Posição assistencial | SRPA identifica local e colega trabalhando e participa da fila, mas não é cirurgia: não recebe status, residente, cobrança ou contagem cirúrgica. Persistência atual usa placeholder compatível até a migration `posicoes_assistenciais`. | `escalaCirurgicaItens.js`; importação; Board/Minhas/Liberações | `turnoConvivencia.test.js`; `importarEscalaConferencia.test.jsx`; `escalaCirurgicaPersonas.test.jsx` |
| Importação | Vision/Excel só propõem dados; a conferência humana define responsáveis. Hospital detectado é sugestão. Imagem é reduzida no cliente e limitada/validada novamente na Edge. | `ImportarEscalaPage.jsx`; `imagemVision.js`; Edge | `importarEscalaConferencia.test.jsx`; `imagemVision.test.js` |
| Duplicatas | Duplicata exata de sala+hora+iniciais+procedimento+cirurgião gera alerta; nunca é removida automaticamente. | `escalaCirurgicaItens.js` | `turnoConvivencia.test.js` |
| Identidade | UID do roster vence texto. `//` herda somente dentro da mesma sala; `?` permanece sala descoberta. Residente tem roster próprio e nunca é responsável. | `utils.js`; `colunaLiberacao.js`; hooks de roster | `aplicarAtribuicoes.test.js`; `colunaLiberacao.test.js`; `escalaCirurgicaPersonas.test.jsx` |
| Ordem | `ordem_liberacao` vem do rodapé e é imutável na operação diária. A lib pode derivar só para exibição quando não há rodapé; nunca grava essa derivação. Liberação ocorre de baixo para cima e fora da ordem é bloqueada. | `colunaLiberacao.js`; `LiberacoesView.jsx` | `colunaLiberacao.test.js`; `liberacoesPainelLinha.test.jsx` |
| Estados | Eixo principal: agendada/iniciada/terminada. Eixo extra: atrasada/suspensa/passa para tarde; terminada não convive com extra. Urgência e emergência são tipo, não status. | `BoardView.jsx`; RPC de status | `escalaCirurgicaPersonas.test.jsx` |
| Tempo | Término da cirurgia é por caso. Tempo total da pessoa é manual e nunca soma estimativas. Contagem regressiva só para cirurgia iniciada. | `PainelTempo.jsx`; `colunaLiberacao.js` | `liberacoesPainelLinha.test.jsx`; `espelhoTempoTotal.test.js` |
| Ajuda/visitantes | Ajuda usa `ajuda_externa[turno]`; visitantes de outro hospital preservam origem e ordem. Repasse do último caso não apaga a presença do visitante. | `colunaLiberacao.js`; `utils.js`; `EscalaCirurgicaPage.jsx` | `colunaLiberacao.test.js`; `ajudasPreservadasNoRepasse.test.js` |
| Contraturno/noite | Último nome escalado do rodapé é plantão do turno seguinte e sai primeiro, inclusive se azul. P1–P4 noturnos seguem regras próprias e não reordenam o rodapé. | `colunaLiberacao.js`; `plantaoNoturno.js` | `colunaLiberacao.test.js`; `plantaoNoturno.test.js`; E2E noturno |
| Troca declarada | `trocaCom` declara; `assumidaPor` executa a identidade do slot. Swap dos dois lados é simultâneo com rollback; `ordem_liberacao` não muda. A troca antiga por proposta está aposentada. | `utils.js`; `EscalaCirurgicaContext.jsx`; `LiberacoesView.jsx` | `planoTroca.test.js`; E2E troca |
| Overrides | Escrita parcial preserva `trocaCom`, `assumidaPor`, `renovado`, observação e tempo que não estão sendo editados. Aba Liberações nunca grava ordem. | `EscalaCirurgicaContext.jsx`; `LiberacoesView.jsx` | `liberacoesPainelLinha.test.jsx` |
| Notificações | Nenhum evento operacional da escala notifica o grupo. Só permanece o aviso agregado de escala de amanhã, hoje destinado ao dono. | context; migration cleanup; cron | testes de personas (`notifyUsers` nunca chamado) |
| LGPD | Escala persiste apenas iniciais. Nome completo só transita para cobrança particular pura e nunca entra em `escala_cirurgica_caso`. Imagens/fixtures reais não são commitadas. | Edge; service; CHECKs SQL | testes de importação/serviço |
| Realtime | Cabeçalho, casos e P4 recarregam os três hospitais. Falhas não devem ser confundidas com ausência de escala; rajadas precisam ser coalescidas (lacuna P1 aberta). | `EscalaCirurgicaContext.jsx` | cobertura a adicionar |

## Lacunas arquiteturais abertas

1. **P0 — publicação não é realmente por turno no servidor.** O cliente mescla o dia,
   mas a RPC atual apaga e reinsere todos os casos. Publicar tarde recria IDs/status da manhã
   e permite corrida `fetch → merge`. A correção é RPC com lock e replace somente do turno.
2. **P0 — posição ainda usa placeholder de compatibilidade.** O próximo schema deve adicionar
   `posicoes_assistenciais` JSONB por turno ao cabeçalho; `linha_overrides` e
   `ordem_liberacao` não são substitutos semânticos.
3. **P1 — reset pós-publicação é uma segunda requisição.** Deve entrar na mesma transação.
4. **P1 — realtime recarrega em rajada e não protege contra resposta fora de ordem.**
5. **P1 — Edge ainda precisa de testes diretos do contrato sanitizado por hospital.**

Mudança nas lacunas 1–3 exige migration, revisão `migration-validator` e teste com dois
publicadores/turnos antes de aplicar em produção.
