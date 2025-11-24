# Prompt para Claude Code – Ícone e Tela “Ética e Bioética”

Você é o Claude Code atuando dentro de um projeto de aplicativo já em produção.  
Sua tarefa é **criar o ícone da área “Ética e Bioética”** e **gerar o código da tela** que exibe os 5 cards abaixo, **mantendo rigorosamente o padrão visual já existente no aplicativo**.

---

## Contexto geral

- O aplicativo já possui:
  - Sistema de theming (cores, tipografia, espaçamento, ícones).
  - Componentes padrões de **cards**, **títulos de seção**, **ícones** e **navegação**.
- Você **NÃO** deve criar um novo design do zero, e sim **reutilizar o mesmo padrão de layout, cores e componentes** que o app já utiliza.
- As cores **não devem ser codificadas diretamente em hex** se o projeto já utiliza tokens/variáveis de tema. Use sempre o **tema padrão** (por exemplo: `theme.colors.primary`, `theme.colors.text`, etc., adaptando ao padrão do projeto).
- O estilo deve ser **limpo, minimalista, com boa legibilidade**, seguindo o padrão atual do app.

Se necessário, **deduza** o padrão com base nos outros ícones/telas já existentes no projeto (por exemplo: stroke, raio de borda, tamanhos, sombras, etc.).

---

## Ícone “Ética e Bioética”

Crie um ícone vetorial (por exemplo, componente SVG ou equivalente no framework do projeto) com estas características:

1. **Conceito visual**
   - Ícone principal: **balança de justiça** estilizada, representando ética, justiça e imparcialidade.
   - Integrar, de forma discreta, um **balão de fala** ou elemento de diálogo, simbolizando **deliberação ética** e discussão de casos.
   - Estilo **outline / stroke**, fino, consistente com os demais ícones do app.
   - Visual **simples, sem excesso de detalhes**, para funcionar bem em tamanhos pequenos.

2. **Estilo e padrão visual**
   - Manter **mesmo stroke-width** dos outros ícones do aplicativo.
   - Arredondamentos, ângulos e proporções alinhados com o restante do set de ícones.
   - Usar **cor padrão de ícone** do tema (por exemplo: `theme.colors.iconDefault`), sem hardcode de cores.
   - Ser legível em modo claro e escuro, se o app tiver ambos.

3. **Uso do ícone**
   - O componente deve ser facilmente reutilizável em:
     - Tab de navegação (menu)
     - Cabeçalho da tela “Ética e Bioética”
     - Eventuais cards ou botões relacionados à área de Ética.

Implemente o componente de ícone usando o **mesmo padrão** já adotado no projeto (por exemplo, `IconEthics` ou nome equivalente, conforme convenção do código existente).

---

## Tela “Ética e Bioética” – Layout e Conteúdo

Crie o código de uma tela chamada, por exemplo, `EthicsScreen` (ou equivalente ao padrão de naming do projeto), com as seguintes características:

1. **Cabeçalho da tela**
   - Título: **“Ética e Bioética”**
   - Ícone à esquerda ou acima do título: usar o ícone criado acima.
   - Tipografia e espaçamento devem seguir os componentes padrões de título de tela.

2. **Estrutura principal**
   - A tela deve exibir **5 cards**, em layout idêntico ao de outros módulos/listas do app (por exemplo, cards clicáveis que navegam para detalhes).
   - **IMPORTANTE:** Mantenha o mesmo componente de card já usado em outras telas (por exemplo, `ListItem`, `Card`, `MenuTile`, etc.), sem inventar um novo padrão.

3. **Cards obrigatórios (títulos exatos)**

Você deve criar **exatamente estes 5 cards**, **com estes textos de título**, sem alterar nada:

1. `Gestão de Dilemas Bioéticos`  
2. `Parecer Ético – Encaminhamento para UTI`  
3. `Ética – Diretrizes Institucionais`  
4. `Emissão de Parecer Técnico-Ético`  
5. `Código de Ética`  

> **Atenção:** Os 4 primeiros títulos devem permanecer **exatamente como estão acima**. A única adição em relação à versão anterior é o **5º card: “Código de Ética”**. Não modifique nenhum texto dos 4 primeiros cards.

4. **Comportamento dos cards**
   - Cada card deve ser **clicável** e preparado para navegar para uma tela de detalhe ou abrir o conteúdo correspondente.
   - Para cada card, crie **handlers de navegação** ou callbacks, seguindo a arquitetura do app (ex.: `onPress={() => navigate('EthicsDilemmas')}`), mas você pode usar nomes de rotas genéricos/sem implementação de detalhe.
   - A ordem dos cards na tela deve ser exatamente a listada acima (1 a 5).

5. **Acessibilidade e responsividade**
   - Garantir que os textos sejam acessíveis (tamanho e contraste adequados, conforme tema).
   - Cards devem se adaptar bem a diferentes larguras de tela, seguindo o padrão do app.

---

## Restrições importantes

- **Não altere**:
  - A estrutura de layout já utilizada por outras telas semelhantes.
  - As cores padrões (use apenas o sistema de tema).
  - Os textos dos 4 primeiros cards.
- A **única mudança de conteúdo** em relação à tela anterior é a inclusão do **5º card: “Código de Ética”**.
- Escreva o código de forma **limpa, tipada** (se o projeto usar TypeScript), e em conformidade com os padrões e convenções já existentes no repositório.

---

## Entregáveis esperados

1. Componente de ícone para “Ética e Bioética” (por exemplo: `IconEthics`).
2. Código da tela `EthicsScreen` (ou equivalente), contendo:
   - Cabeçalho com ícone e título “Ética e Bioética”.
   - Lista de 5 cards, exatamente com os títulos especificados.
   - Estrutura de navegação/callback para cada card.

Use o mesmo estilo de código que você encontra nas outras telas do projeto e mantenha a coesão com o design system já implementado.
