# Prompt 3 — Card novo: acompanhamento de cirurgia cardíaca

> Cole o bloco abaixo numa **aba nova** do Claude Code, na raiz do repo. Ele é autossuficiente.

---

```
Estou criando um módulo novo no ANEST — app de gestão de qualidade usado por
anestesiologistas em Chapecó/SC, consultado NO CELULAR durante o ato anestésico. Falta uma
tela para acompanhar cirurgia cardíaca: hoje o anestesista anota tempos de CEC, heparina e
parada circulatória em papel ou de cabeça, e esses tempos decidem conduta e entram no
registro. O balanço hídrico da cirurgia cardíaca também é próprio — tem o priming da
máquina, cardioplegia e ultrafiltração, que a calculadora geral não cobre.

Com isso em mente: crie um card de acompanhamento de cirurgia cardíaca. Faça em três
etapas, nesta ordem.

ETAPA 1 — LEVANTAMENTO, antes de desenhar
Defina O QUE a tela acompanha, com fonte para cada item. Não invente campo: cada um precisa
sair de protocolo institucional ou diretriz. Pontos de partida — confirme e amplie:

- Tempos: CEC total, pinçamento aórtico (clampeamento), parada circulatória total,
  perfusão cerebral seletiva quando houver, tempo de reperfusão.
- Anticoagulação: dose de heparina, TCA alvo e medidas seriadas, dose de protamina e a
  relação protamina:heparina, heparina adicional.
- Balanço próprio da CEC: priming, cardioplegia, ultrafiltração, débito urinário, balanço
  acumulado dentro e fora de bomba.
- Temperatura, e por que ela importa no tempo de parada circulatória.

Fontes a consultar: STS (Society of Thoracic Surgeons), EACTS, SCA (Society of
Cardiovascular Anesthesiologists), diretrizes de perfusão (AmSECT), e protocolos de
instituições de referência publicados. Para cada campo, registre a fonte e — mais
importante — os LIMIARES que mudam conduta: a partir de quanto tempo de parada circulatória
o risco neurológico sobe, qual TCA autoriza entrar em bomba, e assim por diante. Um
cronômetro que só conta não ajuda; o que ajuda é o cronômetro que avisa.

Onde a evidência divergir entre sociedades, mostre a divergência em vez de escolher uma.

ETAPA 2 — PROTÓTIPO, para o dono aprovar por imagem
Regra da casa (`CLAUDE.md` Regra #3): HTML estático em `.tmp/`, tokens reais copiados de
`src/styles/anest-theme.css`, renderizado a 430px E a ~812×375, nos DOIS temas, com a
medição ao lado. Abra com `open .tmp/arquivo.html` e PARE, esperando aprovação. Não mexa em
`src/` antes disso.

O que o protótipo precisa responder: com a cirurgia em andamento e o celular na bancada,
o que tem de estar SEMPRE à vista sem rolar? Provavelmente os cronômetros ativos e o
balanço acumulado. Mostre onde eles ficam e quantos pixels sobram para o resto.

⚠️ A variante `deitado:` (`tailwind.config.js:27`) existe para celular na horizontal e é o
formato natural para uma tela de acompanhamento apoiada na bancada. Deitado sobram largura e
faltam 375px de altura. Para testar no navegador, o Chromium de desktop reporta
`pointer: fine` e a variante NÃO ativa: emule toque (`hasTouch: true, isMobile: true`).

ETAPA 3 — IMPLEMENTAR
Siga a skill `/nova-pagina`: case no switch de `App.jsx`, entrada em
`src/navigation/pageSlugs.js`, e `PAGE_TO_CARD` se exigir permissão. ⚠️ Em página nova NÃO
renderize BottomNav próprio (`App.jsx:1011`, TODO BUG-06).

Decisões que precisam da sua atenção e do dono, não de palpite:
- Os dados PERSISTEM ou vivem só na sessão? Se persistem, é dado de saúde: passa por
  `.claude/rules/lgpd.md` e a migration por `migration-validator` ANTES de aplicar. Se não
  persistem, recarregar a página perde a cirurgia inteira — e isso precisa ser dito na tela.
- Cronômetro precisa sobreviver ao app em segundo plano. Guardar o INSTANTE de início e
  derivar o tempo do relógio; contador incrementado por `setInterval` para quando a aba
  dorme. Há precedente no repo: `plantaoNoturno` e a fase noturna da escala derivam tudo do
  relógio, sem escrita periódica.
- Conta clínica não-trivial vai para lib pura em `src/lib/` com teste próprio, e a página a
  importa. Lib sem importador de produção é armadilha: a suíte fica verde sem cobrir a conta
  que roda.

Pronto quando:
- `npm run lint` sem ERRO, `npm run build` passa, `npm run test:run` passa.
- Teste cobrindo os limiares que mudam conduta, e rodado contra o código ANTIGO antes de
  ser chamado de trava.
- Screenshot nos dois temas, a 430px e deitado.
- Um documento em `docs/` com a fonte de cada campo e de cada limiar.

⚠️ Não deployar com cirurgia em andamento: cada deploy renomeia os hashes e o cliente no
bundle velho pede um chunk que não existe (ver `docs/deploy-e-ci.md`). Para uma tela de
acompanhamento intraoperatório isso é pior que em qualquer outra.

Se o levantamento da Etapa 1 mostrar que o escopo é grande demais para um card só, diga isso
e proponha um recorte, em vez de entregar tudo pela metade.
```

---

**O que foi inferido:** que o valor está nos limiares e não nos cronômetros (por isso a Etapa 1 pede
o que muda conduta), e que persistência é decisão em aberto com consequência de LGPD — o prompt
levanta em vez de decidir.
