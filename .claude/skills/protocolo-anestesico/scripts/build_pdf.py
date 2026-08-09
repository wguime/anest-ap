# -*- coding: utf-8 -*-
"""
Renderiza protocolos anestesicos em PDF com a identidade visual ANEST.

Documento completo (a partir de markdown):
  python3 build_pdf.py protocolo.md saida.pdf \
      --titulo "Cirurgia Citorredutora com HIPEC" \
      --subtitulo "Manejo anestesico perioperatorio" \
      --sigla CRS-HIPEC --versao 2.1 \
      --data "agosto de 2026" --proxima "agosto de 2028" \
      --base "ERAS Society (2020); SOAPC (2019)" \
      --refs 32 --refs-verificadas 30 \
      --logo assets/anest-logo.png --logo-negativo assets/anest-branco.png

Guia de consulta rapida (a partir de HTML escrito a mao):
  python3 build_pdf.py rapido.html rapido.pdf --modo rapido --sigla CRS-HIPEC

Dependencias: pip install weasyprint markdown --break-system-packages
"""
import argparse, base64, io, os, re, sys

# ------------------------------------------------------------- paleta ANEST
VERDE     = "#004D26"
VERDE_ESC = "#00331A"
VERDE_CLR = "#7FB89A"
VERDE_TEN = "#EAF2ED"
DOURADO   = "#C8952B"
VERMELHO  = "#A8322D"
AMBAR     = "#B8860B"
GRAFITE   = "#16252B"


def carrega_marca(caminho="assets/marca.json"):
    """Sobrescreve a paleta embutida com os tokens reais do ANEST App, se houver."""
    import json
    global VERDE, VERDE_ESC, VERDE_CLR, VERDE_TEN, DOURADO, VERMELHO, AMBAR, GRAFITE
    if not os.path.exists(caminho):
        return None
    try:
        m = json.load(io.open(caminho, encoding="utf-8"))
    except Exception as e:
        sys.stderr.write("aviso: marca.json ilegivel (%s), usando paleta embutida\n" % e)
        return None
    c = m.get("cores", {})
    mapa = {"verde_institucional": "VERDE", "verde_profundo": "VERDE_ESC",
            "verde_claro": "VERDE_CLR", "verde_tenue": "VERDE_TEN",
            "dourado": "DOURADO", "vermelho_alerta": "VERMELHO",
            "ambar_atencao": "AMBAR", "grafite": "GRAFITE"}
    g = globals()
    for chave, var in mapa.items():
        v = c.get(chave)
        if isinstance(v, str) and v.startswith("#"):
            g[var] = v
    return m


def logo_tag(caminho, altura_mm, negativo=False):
    """<img> em base64 se houver arquivo; senao, wordmark tipografico ANEST."""
    if caminho and os.path.exists(caminho):
        ext = os.path.splitext(caminho)[1].lower()
        mime = {"svg": "image/svg+xml", "png": "image/png"}.get(ext[1:], "image/jpeg")
        b64 = base64.b64encode(io.open(caminho, "rb").read()).decode("ascii")
        return u'<img src="data:%s;base64,%s" style="height:%smm">' % (mime, b64, altura_mm)
    cor = "#ffffff" if negativo else VERDE
    return (u'<span class="wordmark" style="color:%s;border-bottom:1.6pt solid %s">'
            u'ANEST</span>' % (cor, DOURADO))


def _proporcao_svg(caminho):
    """largura/altura lida do viewBox. None quando nao da para saber."""
    if not caminho.lower().endswith(".svg"):
        return None
    try:
        cabecalho = io.open(caminho, encoding="utf-8").read(500)
    except Exception:
        return None
    m = re.search(r'viewBox\s*=\s*"[\d.eE+-]+\s+[\d.eE+-]+\s+([\d.eE+-]+)\s+([\d.eE+-]+)"',
                  cabecalho)
    if not m:
        return None
    largura, altura = float(m.group(1)), float(m.group(2))
    return largura / altura if altura else None


def logo_css_cabecalho(caminho, altura_mm=3.6, folga_mm=2.0):
    """CSS que poe o logo no cabecalho corrido, como background do margin box.

    Nao usa `content: url(...)` de proposito: o margin box desenha o content no
    tamanho INTRINSECO da imagem, e o SVG da marca declara so viewBox -- sairia
    com cerca de 263 mm de largura, por cima do corpo do texto. Como background,
    `background-size` da o controle de altura sem exigir que o arquivo declare
    tamanho, o que mantem o SVG generico para a capa e para o guia rapido.

    Sem arquivo de logo devolve string vazia, e o cabecalho volta a ser so texto.
    """
    if not (caminho and os.path.exists(caminho)):
        return ""
    ext = os.path.splitext(caminho)[1].lower()
    mime = {"svg": "image/svg+xml", "png": "image/png"}.get(ext[1:], "image/jpeg")
    b64 = base64.b64encode(io.open(caminho, "rb").read()).decode("ascii")
    proporcao = _proporcao_svg(caminho)
    if proporcao:
        largura = "%.2fmm" % (altura_mm * proporcao)
        recuo = altura_mm * proporcao + folga_mm
    else:
        # Sem proporcao conhecida, deixa o renderizador deduzir e reserva folga fixa.
        largura, recuo = "auto", 15.0
    return (u'vertical-align: middle; '
            u'background-image: url("data:%s;base64,%s"); '
            u'background-size: %s %.2fmm; background-position: left center; '
            u'background-repeat: no-repeat; padding-left: %.2fmm;'
            % (mime, b64, largura, altura_mm, recuo))


CSS_COMPLETO = u"""
@page {
  size: A4; margin: 20mm 15mm 16mm 15mm;
  @top-left { content: "%(cab)s"; font-family: "DejaVu Sans"; font-size: 7pt;
              color: #7a8c93; letter-spacing: .06em; %(logohdr)s }
  @top-right { content: "%(cabdir)s"; font-family: "DejaVu Sans"; font-size: 7pt; color: #7a8c93; }
  @bottom-right { content: counter(page) " / " counter(pages); font-family: "DejaVu Sans";
                  font-size: 8pt; color: %(verde)s; font-weight: bold; }
  @bottom-left { content: "Documento de uso interno - conferir doses com as apresentacoes disponiveis";
                 font-family: "DejaVu Sans"; font-size: 6.5pt; color: #9aa8ad; }
}
@page :first { margin: 0;
  /* content vazio nao apaga o background do margin box: a capa precisa zerar o
     logo do cabecalho explicitamente, senao ele vaza no canto superior. */
  @top-left { content: ""; background-image: none; padding-left: 0; }
  @top-right { content: ""; }
  @bottom-left { content: ""; } @bottom-right { content: ""; } }

html { font-size: 9pt; }
body { font-family: "DejaVu Sans", sans-serif; color: %(grafite)s; line-height: 1.42;
       text-align: left; hyphens: none; }
.wordmark { font-weight: bold; letter-spacing: .34em; font-size: 13pt; padding-bottom: 1mm; }

.cover { page: first; height: 297mm; width: 210mm; padding: 0; margin: 0;
         position: relative; page-break-after: always;
         background: linear-gradient(160deg, %(verde)s 0%%, %(verdeesc)s 100%%); color: #fff; }
.cover-inner { padding: 30mm 22mm 0 22mm; }
.cover .logo { margin-bottom: 14mm; }
.cover .logo .wordmark { font-size: 17pt; }
.cover .rule { width: 46mm; height: 3pt; background: %(dourado)s; margin-bottom: 9mm; }
.cover .kicker { font-size: 9pt; letter-spacing: .3em; text-transform: uppercase;
                 color: %(verdeclr)s; margin-bottom: 6mm; }
.cover h1 { font-size: 27pt; line-height: 1.15; font-weight: bold; margin: 0 0 6mm 0;
            color: #fff; border: none; padding: 0; }
.cover .sub { font-size: 12pt; color: #cfe4d8; line-height: 1.45; margin-bottom: 12mm; }
.cover .meta { font-size: 9pt; color: #dceae2; line-height: 1.9;
               border-top: 1px solid rgba(255,255,255,.28); padding-top: 6mm; }
.cover .meta b { color: #fff; }
.cover .footer-note { position: absolute; bottom: 18mm; left: 22mm; right: 22mm;
                      font-size: 7.5pt; color: %(verdeclr)s; line-height: 1.6;
                      border-top: 1px solid rgba(255,255,255,.2); padding-top: 4mm; }

.gov { page-break-after: always; }
.gov h2 { page-break-before: avoid; }
.gov table { font-size: 8.4pt; }
.gov td:first-child { width: 34%%; background: %(verdeten)s; font-weight: bold; color: %(verde)s; }

h2 { font-size: 14pt; color: %(verde)s; margin: 0 0 5mm 0; padding: 0 0 2mm 0;
     border-bottom: 2.2pt solid %(verde)s; page-break-after: avoid;
     page-break-before: always; letter-spacing: -.01em; }
h2:first-of-type { page-break-before: avoid; }
h3 { font-size: 10.5pt; color: %(verde)s; margin: 6mm 0 2.5mm 0; page-break-after: avoid;
     border-left: 3pt solid %(dourado)s; padding-left: 3mm; }
h4 { font-size: 9.5pt; color: %(grafite)s; margin: 4mm 0 1.5mm 0; page-break-after: avoid; }
p { margin: 0 0 2.4mm 0; }
strong { color: %(verdeesc)s; }
em { color: #3a4a51; }
ul, ol { margin: 0 0 2.8mm 0; padding-left: 5.5mm; }
li { margin-bottom: 1.1mm; }
hr { display: none; }

table { width: 100%%; border-collapse: collapse; margin: 2.5mm 0 4.5mm 0;
        font-size: 7.9pt; page-break-inside: auto; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th { background: %(verde)s; color: #fff; font-weight: bold; text-align: left;
     padding: 1.7mm 2mm; border: .4pt solid %(verde)s; line-height: 1.3; }
td { padding: 1.5mm 2mm; border: .4pt solid #cfdcd4; vertical-align: top; line-height: 1.34; }
tbody tr:nth-child(even) td { background: %(verdeten)s; }

blockquote { margin: 3mm 0 4mm 0; padding: 2.6mm 3.5mm; background: #fdf6e6;
             border-left: 3.5pt solid %(dourado)s; font-size: 8.4pt; page-break-inside: avoid; }
blockquote p:last-child { margin-bottom: 0; }

/* Bloco de fluxo (algoritmo de intercorrencia). Monoespacado porque o
   alinhamento das ramificacoes e funcional, mas com a MESMA paleta das tabelas
   -- fundo verde tenue, borda e barra verde -- para ler como elemento do
   documento, e nao como listagem de codigo. */
pre { background: %(verdeten)s; border: .4pt solid #cfdcd4; border-left: 3.5pt solid %(verde)s;
      padding: 3mm 3.5mm; font-family: "DejaVu Sans Mono", monospace; font-size: 7.6pt;
      line-height: 1.5; color: %(grafite)s; white-space: pre-wrap;
      page-break-inside: avoid; margin: 2.5mm 0 4.5mm 0; }

/* Formula solta no meio de uma frase. Em em, nao em pt, para acompanhar o
   tamanho do contexto em que cai. */
code { font-family: "DejaVu Sans Mono", monospace; font-size: .96em; background: %(verdeten)s;
       padding: .3mm 1mm; border-radius: 1.5pt; }
/* Dentro de tabela a pilha tingida quebra a leitura: metade da celula sai
   tingida e metade nao. Na tabela a formula fica so monoespacada. */
td code, th code { background: none; padding: 0; font-size: .97em; }
pre code { background: none; padding: 0; font-size: 1em; }
a { color: %(verde)s; text-decoration: none; }
"""

CSS_RAPIDO = u"""
@page { size: A4; margin: 9mm 9mm 8mm 9mm;
  @bottom-right { content: "%(cab)s - consulta rapida - " counter(page) "/" counter(pages);
                  font-family: "DejaVu Sans"; font-size: 6.5pt; color: #93a3a9; } }
html { font-size: 8pt; }
body { font-family: "DejaVu Sans", sans-serif; color: %(grafite)s; line-height: 1.32; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.wordmark { font-weight: bold; letter-spacing: .3em; font-size: 9pt; }

.masthead { display: flex; justify-content: space-between; align-items: flex-end;
            border-bottom: 2.5pt solid %(verde)s; padding-bottom: 1.4mm; margin-bottom: 2.4mm; }
.mh-logo { margin-bottom: .3mm; line-height: 1; }
.mh-logo .wordmark { font-size: 8pt; letter-spacing: .26em; }
.mh-kicker { font-size: 6.5pt; letter-spacing: .22em; text-transform: uppercase;
             color: %(dourado)s; font-weight: bold; }
.mh-title { font-size: 17pt; font-weight: bold; color: %(verde)s; line-height: 1.05;
            letter-spacing: -.02em; }
.mh-right { text-align: right; font-size: 7pt; color: #56696f; line-height: 1.35; }
.mh-ver { font-size: 6.3pt; color: #93a3a9; margin-top: .8mm; }

.banner { background: %(verde)s; color: #dfeee6; font-size: 7.4pt; padding: 1.8mm 3mm;
          margin-bottom: 3mm; }
.banner b { color: #f2cf85; }

h2.sec { font-size: 8.4pt; font-weight: bold; color: %(verde)s; text-transform: uppercase;
         letter-spacing: .1em; margin: 2.8mm 0 1.4mm 0; padding-bottom: .8mm;
         border-bottom: 1pt solid #b3cdbe; }
h2.sec.sm { font-size: 7.8pt; margin-top: 2.5mm; }
h2.sec .sub { text-transform: none; letter-spacing: 0; font-weight: normal;
              color: #7d9199; font-size: 7pt; }

.phase { border: .5pt solid #cfdde1; margin-bottom: 2.2mm; page-break-inside: avoid; }
.ph-head { font-size: 8.4pt; font-weight: bold; color: #fff; padding: 1.4mm 2.4mm;
           display: flex; align-items: baseline; }
.ph-tag { display: inline-block; background: rgba(255,255,255,.24); padding: .3mm 1.6mm;
          margin-right: 2.2mm; font-size: 6.6pt; letter-spacing: .1em; }
.ph-time { margin-left: auto; font-weight: normal; font-size: 7pt; opacity: .88; }
.p0 .ph-head { background: #5b7268; }
.p1 .ph-head { background: %(verde)s; }
.p2 .ph-head { background: %(ambar)s; }
.p3 .ph-head { background: %(vermelho)s; }
.p4 .ph-head { background: #2c7a5b; }
.ph-body { display: flex; gap: 3.5mm; padding: 2mm 2.4mm; }
.ph-body.single { display: block; }
.ph-body .col { flex: 1; }
.ph-body b { color: %(verdeesc)s; font-size: 7.4pt; }
.ph-body ul { margin: .8mm 0 0 0; padding-left: 3.4mm; }
.ph-body li { margin-bottom: .55mm; font-size: 7.2pt; }
ul.check { list-style: none; padding-left: 0; }
ul.check li:before { content: "\\2610\\00a0\\00a0"; color: #2c7a5b; font-weight: bold; }
.legend { font-size: 6.2pt; color: #7d9199; font-weight: normal; font-style: italic; }
b.t { color: %(vermelho)s; font-family: "DejaVu Sans Mono", monospace; font-size: 6.6pt; }

table { width: 100%%; border-collapse: collapse; }
table.mini { font-size: 7.1pt; margin-top: .8mm; }
table.mini td { padding: .78mm 1.6mm; border-bottom: .4pt solid #d9e5de; vertical-align: top; }
table.mini th { background: %(verdeten)s; color: %(verde)s; font-size: 6.8pt; text-align: left;
                padding: .9mm 1.6mm; }
table.mini td:first-child { color: #46595f; }
table.mini.wide td:first-child { width: 42%%; }
td.hi { color: %(vermelho)s; font-weight: bold; }
table.dose { font-size: 7.2pt; margin-top: .8mm; }
table.dose th { background: %(verde)s; color: #fff; padding: 1mm; font-size: 6.8pt; text-align: center; }
table.dose td { padding: .82mm; text-align: center; border: .4pt solid #d3e0d8; }
table.dose td:first-child { background: %(verdeten)s; font-weight: bold; color: %(verde)s; }
table.ck { font-size: 7.2pt; margin-bottom: 2mm; }
table.ck th { background: %(verde)s; color: #fff; text-align: left; padding: 1.1mm 2mm;
              font-size: 6.8pt; letter-spacing: .08em; }
table.ck td { padding: 1.2mm 1.6mm; border-bottom: .4pt solid #d9e5de; vertical-align: top; }
td.bx { width: 5mm; font-size: 10pt; color: %(verde)s; text-align: center; line-height: 1; }
table.trig { font-size: 6.9pt; margin-top: .8mm; }
table.trig thead th { background: %(verde)s; color: #fff; text-align: left;
                      padding: 1.2mm 2mm; font-size: 6.9pt; }
table.trig td { padding: .85mm 1.7mm; border-bottom: .4pt solid #d9e5de; vertical-align: top; }
table.trig tr.warn td { background: #fdf6e6; }
table.trig tr.danger td { background: #fdeceb; }
table.trig tr.danger td b { color: %(vermelho)s; }
.ref { color: #7d9199; font-size: 6.3pt; }

.tip { font-size: 6.8pt; color: #56696f; margin-top: 1.2mm; font-style: italic; }
.conv { font-size: 6.6pt; color: #56696f; font-style: italic; margin: -1mm 0 1.6mm 0; }
.crit { background: #fdeceb; border-left: 2.5pt solid %(vermelho)s; padding: 1.3mm 2.2mm;
        font-size: 7pt; margin-top: 1.2mm; }
.warnbox { background: #fdf6e6; border-left: 2.5pt solid %(dourado)s; padding: 1.3mm 2.2mm;
           font-size: 7pt; margin-bottom: 1.5mm; }
.formula { background: %(verde)s; color: #f2cf85; font-family: "DejaVu Sans Mono", monospace;
           font-size: 8pt; padding: 1.7mm; text-align: center; margin-bottom: 2.5mm; }
.alert { border: 1pt solid %(vermelho)s; margin-top: 3mm; page-break-inside: avoid; }
.alert-t { background: %(vermelho)s; color: #fff; font-weight: bold; font-size: 7.6pt;
           letter-spacing: .14em; padding: 1.2mm 2.4mm; }
.alert ul { margin: 1.6mm 0; padding-left: 6mm; }
.alert li { font-size: 7.2pt; margin-bottom: .8mm; }
.alert p { font-size: 7.2pt; margin: 1.4mm 2.4mm; }
.alert.info { border-color: %(verde)s; }
.alert.info .alert-t { background: %(verde)s; }
.two { display: flex; gap: 4mm; }
.two > div { flex: 1; }
/* Mesma regra do documento completo: o fluxo usa a paleta das tabelas do guia,
   nao o cinza de listagem de codigo. Fonte um pouco maior que a antiga -- num
   cartao de emergencia, algoritmo em letra miuda e defeito. */
pre { background: %(verdeten)s; border: .4pt solid #d3e0d8; border-left: 2.5pt solid %(verde)s;
      padding: 2.2mm 2.6mm; font-family: "DejaVu Sans Mono", monospace; font-size: 6.9pt;
      line-height: 1.5; color: %(grafite)s; white-space: pre-wrap; margin: 1mm 0 0 0; }
.foot { margin-top: 3mm; padding-top: 1.6mm; border-top: .5pt solid #cfdde1;
        font-size: 6.4pt; color: #7d9199; font-style: italic; }
"""

COVER = u"""
<div class="cover"><div class="cover-inner">
  <div class="logo">{logo}</div>
  <div class="rule"></div>
  <div class="kicker">Protocolo assistencial &middot; Anestesiologia</div>
  <h1>{titulo}</h1>
  <div class="sub">{subtitulo}<br>Documento completo com refer&ecirc;ncias verificadas</div>
  <div class="meta">
    <b>C&oacute;digo</b> {codigo}<br>
    <b>Vers&atilde;o</b> {versao} &nbsp;&middot;&nbsp; <b>Revis&atilde;o</b> {data}
    &nbsp;&middot;&nbsp; <b>Pr&oacute;xima</b> {proxima}<br>
    <b>Base normativa</b> {base}<br>
    <b>Refer&ecirc;ncias</b> {refsv} de {refs} verificadas contra o registro do PubMed (&sect;22)
  </div>
  <div class="footer-note">
    Documento de uso interno. As doses e dilui&ccedil;&otilde;es devem ser conferidas com as
    apresenta&ccedil;&otilde;es comerciais efetivamente dispon&iacute;veis na institui&ccedil;&atilde;o antes do uso.
    Este protocolo n&atilde;o substitui o julgamento cl&iacute;nico individualizado.
  </div>
</div></div>
"""

GOV = u"""
<div class="gov">
<h2>Controle do documento</h2>
<table>
<tr><td>C&oacute;digo</td><td>{codigo}</td></tr>
<tr><td>Vers&atilde;o</td><td>{versao}</td></tr>
<tr><td>Data de revis&atilde;o</td><td>{data}</td></tr>
<tr><td>Pr&oacute;xima revis&atilde;o programada</td><td>{proxima}</td></tr>
<tr><td>Elaborado por</td><td>{elaborado}</td></tr>
<tr><td>Revisado por</td><td>{revisado}</td></tr>
<tr><td>Aprovado por</td><td>{aprovado}</td></tr>
<tr><td>Base normativa</td><td>{base}</td></tr>
<tr><td>Refer&ecirc;ncias verificadas</td><td>{refsv} de {refs} conferidas contra o registro do
PubMed nesta revis&atilde;o (PMID e DOI). As demais constam sem identificador e requerem
confer&ecirc;ncia antes da aprova&ccedil;&atilde;o definitiva.</td></tr>
<tr><td>Ciclo de revis&atilde;o</td><td>Verifica&ccedil;&atilde;o peri&oacute;dica de diretrizes;
revis&atilde;o estrutural a cada 2 anos ou a qualquer momento diante de alerta de seguran&ccedil;a</td></tr>
</table>
{historico}
</div>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada")
    ap.add_argument("saida")
    ap.add_argument("--modo", default="completo", choices=["completo", "rapido"])
    ap.add_argument("--titulo", default="Protocolo Anestesico")
    ap.add_argument("--subtitulo", default="Manejo anestesico perioperatorio")
    ap.add_argument("--sigla", default="GERAL")
    ap.add_argument("--versao", default="1.0")
    ap.add_argument("--data", default="")
    ap.add_argument("--proxima", default="")
    ap.add_argument("--base", default="")
    ap.add_argument("--refs", default="0")
    ap.add_argument("--refs-verificadas", dest="refsv", default="0")
    ap.add_argument("--elaborado", default="&mdash;")
    ap.add_argument("--revisado", default="&mdash;")
    ap.add_argument("--aprovado", default="Pendente de aprova&ccedil;&atilde;o em reuni&atilde;o de servi&ccedil;o")
    ap.add_argument("--logo", default="")
    ap.add_argument("--logo-negativo", dest="logoneg", default="")
    ap.add_argument("--historico", default="")
    ap.add_argument("--marca", default="assets/marca.json")
    ap.add_argument("--sem-capa", dest="semcapa", action="store_true")
    ap.add_argument("--sem-governanca", dest="semgov", action="store_true")
    a = ap.parse_args()

    from weasyprint import HTML, CSS

    marca = carrega_marca(a.marca)
    if marca:
        print("paleta carregada de:", a.marca)
        if not a.logo:
            a.logo = marca.get("logos", {}).get("principal", "")
        if not a.logoneg:
            a.logoneg = marca.get("logos", {}).get("negativo", "")

    codigo = "PROT-ANEST-%s-v%s" % (a.sigla, a.versao)
    ctx = {"verde": VERDE, "verdeesc": VERDE_ESC, "verdeclr": VERDE_CLR,
           "verdeten": VERDE_TEN, "dourado": DOURADO, "vermelho": VERMELHO,
           "ambar": AMBAR, "grafite": GRAFITE,
           "cab": ("ANEST | " + a.titulo) if a.modo == "completo" else a.sigla,
           "cabdir": (a.data or ""),
           # O guia rapido leva o logo no masthead da pagina 1, nao no margin box.
           "logohdr": logo_css_cabecalho(a.logo) if a.modo == "completo" else ""}

    src = io.open(a.entrada, encoding="utf-8").read()

    if a.modo == "rapido":
        html = src.replace("{{LOGO}}", logo_tag(a.logo, 5))
        css = CSS_RAPIDO % ctx
    else:
        import markdown
        linhas = src.split("\n")
        ini = 0
        for i, l in enumerate(linhas):
            if l.startswith("## "):
                ini = i
                break
        corpo = markdown.markdown(
            "\n".join(linhas[ini:]),
            extensions=["tables", "fenced_code", "attr_list", "sane_lists", "nl2br", "toc"],
            extension_configs={"toc": {"permalink": False}},
        )
        capa = "" if a.semcapa else COVER.format(
            logo=logo_tag(a.logoneg or a.logo, 11, negativo=not a.logoneg),
            titulo=a.titulo, subtitulo=a.subtitulo, codigo=codigo, versao=a.versao,
            data=a.data, proxima=a.proxima, base=a.base, refs=a.refs, refsv=a.refsv)
        hist = ""
        if a.historico and os.path.exists(a.historico):
            import markdown as _md
            hist = _md.markdown(io.open(a.historico, encoding="utf-8").read(),
                                extensions=["tables"])
        gov = "" if a.semgov else GOV.format(
            codigo=codigo, versao=a.versao, data=a.data, proxima=a.proxima,
            elaborado=a.elaborado, revisado=a.revisado, aprovado=a.aprovado,
            base=a.base, refs=a.refs, refsv=a.refsv, historico=hist)
        html = (u"<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>"
                u"<title>%s</title></head><body>%s%s%s</body></html>"
                % (a.titulo, capa, gov, corpo))
        css = CSS_COMPLETO % ctx

    HTML(string=html).write_pdf(a.saida, stylesheets=[CSS(string=css)])
    print("PDF gerado:", a.saida)


if __name__ == "__main__":
    main()
