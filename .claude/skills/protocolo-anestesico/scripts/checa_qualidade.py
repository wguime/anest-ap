# -*- coding: utf-8 -*-
"""
Confere aritmetica de doses e integridade estrutural do protocolo antes de renderizar.

Uso:
  python3 checa_qualidade.py protocolo.md
  python3 checa_qualidade.py protocolo.md --doses doses.json

Formato de doses.json (uma entrada por infusao a conferir):
[
  {"farmaco": "Noradrenalina", "massa_mg": 16, "volume_ml": 250,
   "conc_declarada_ug_ml": 64,
   "tabela": [{"dose_ug_kg_min": 0.1, "peso_kg": 70, "ml_h_declarado": 6.6}]}
]

Sai com codigo != 0 se encontrar erro bloqueante.
"""
import argparse, io, json, re, sys

ERROS = []
AVISOS = []


def erro(msg):
    ERROS.append(msg)


def aviso(msg):
    AVISOS.append(msg)


# ---------------------------------------------------------------- estrutura
def checa_markdown(caminho):
    s = io.open(caminho, encoding="utf-8").read()

    try:
        import markdown
    except ImportError:
        aviso("modulo markdown ausente - checagem de tabelas pulada")
        return s

    n_md = len(re.findall(r'^\s*\|[\s:\-|]+\|\s*$', s, flags=re.M))
    h = markdown.markdown(s, extensions=["tables", "fenced_code", "attr_list",
                                         "sane_lists", "nl2br", "toc"])
    n_html = h.count("<table>")
    print("  tabelas no markdown: %d | renderizadas: %d" % (n_md, n_html))
    if n_md != n_html:
        erro("TABELA QUEBRADA: %d no fonte, %d renderizadas. "
             "Falta linha em branco antes de alguma tabela." % (n_md, n_html))

    soltos = re.findall(r'<p>([^<]{0,200}\|[^<]{0,200})</p>', h)
    if soltos:
        erro("PIPE SOLTO em %d paragrafo(s) - tabela virou texto: %r"
             % (len(soltos), soltos[0][:80]))

    n_til = s.count("~")
    if n_til:
        aviso("%d ocorrencia(s) de '~' - em varias fontes fica parecido com sinal de "
              "menos. Trocar por 'cerca de'." % n_til)

    # Bloco cercado sai monoespacado, com cara de listagem de codigo, e destoa do
    # resto do documento -- que e feito de tabelas e listas. Fluxo de decisao vira
    # tabela Passo|Conduta com as ramificacoes recuadas; checklist vira "- [ ]";
    # diferencial vira lista com marcador.
    n_cerca = len(re.findall(r'^```', s, flags=re.M))
    if n_cerca:
        aviso("%d bloco(s) cercado(s) por ``` - saem monoespacados, fora do padrao "
              "visual do documento. Fluxo -> tabela Passo|Conduta; checklist -> '- [ ]'; "
              "diferencial -> lista." % n_cerca)

    # Marco temporal sem unidade nao diz de que referencial esta contando: "45" pode
    # ser minuto, dose ou numero de item. A regra do protocolo e escrever por extenso.
    orfaos = re.findall(r'\*\*(\d{1,3})\*\*\s+(?![a-zA-Zà-ÿ]*\s*(?:min|h|mg|ml|g|UI|mEq|%|°))'
                        r'([a-zà-ÿ]{3,})', s)
    if len(orfaos) >= 3:
        exemplos = ', '.join('**%s** %s' % o for o in orfaos[:3])
        aviso("%d numero(s) em negrito sem unidade seguidos de texto (ex.: %s). Se for "
              "marco temporal, escrever '45 min' e declarar o referencial."
              % (len(orfaos), exemplos))

    # secoes obrigatorias
    for sec in ["## 21.", "## 22."]:
        if sec not in s:
            aviso("secao %s ausente (mudancas / referencias)" % sec.strip("# ."))

    # marcadores de citacao
    cit = re.findall(r'\[\d+(?:,\s*\d+)*\]', s)
    print("  marcadores de citacao no corpo: %d" % len(cit))
    if len(cit) < 10:
        aviso("poucos marcadores de citacao (%d) - condutas centrais devem ser "
              "referenciadas" % len(cit))

    # referencias declaradas vs. citadas
    m = re.search(r'##\s*22\..*?$(.*)', s, flags=re.M | re.S)
    if m:
        declaradas = set(int(x) for x in re.findall(r'^\*\*\[(\d+)\]\*\*', m.group(1), flags=re.M))
        citadas = set()
        for c in cit:
            for n in re.findall(r'\d+', c):
                citadas.add(int(n))
        orfas = sorted(citadas - declaradas)
        nunca = sorted(declaradas - citadas)
        if orfas:
            erro("CITACAO ORFA: marcador(es) %s no texto sem entrada na secao 22" % orfas)
        if nunca:
            aviso("referencia(s) %s listada(s) mas nunca citada(s) no corpo" % nunca)

    # metas adjetivas
    for termo in ["diurese adequada", "pressao adequada", "volume adequado",
                  "temperatura adequada", "hidratacao adequada"]:
        if termo in s.lower():
            aviso("meta adjetiva encontrada: '%s' - substituir por numero" % termo)

    # marcos temporais sem legenda
    if re.search(r'\b[IH]0\s*[-\u2212]\s*\d+', s) and "= incis" not in s and "= inicio" not in s.lower():
        aviso("marcos temporais usados sem legenda declarando o referencial")

    return s


# ---------------------------------------------------------------- aritmetica
def checa_doses(caminho_json):
    dados = json.load(io.open(caminho_json, encoding="utf-8"))
    for d in dados:
        nome = d.get("farmaco", "?")
        massa = float(d["massa_mg"])
        vol = float(d["volume_ml"])
        conc_calc = massa * 1000.0 / vol          # ug/ml
        conc_dec = d.get("conc_declarada_ug_ml")
        if conc_dec is not None:
            if abs(conc_calc - float(conc_dec)) > max(0.01 * conc_calc, 0.5):
                erro("%s: concentracao declarada %.4g ug/ml, calculada %.4g ug/ml "
                     "(%.4g mg em %.4g ml)" % (nome, float(conc_dec), conc_calc, massa, vol))
            else:
                print("  OK %s: %.4g ug/ml" % (nome, conc_calc))
        for linha in d.get("tabela", []):
            dose = float(linha["dose_ug_kg_min"])
            peso = float(linha["peso_kg"])
            mlh_calc = dose * peso * 60.0 / conc_calc
            mlh_dec = linha.get("ml_h_declarado")
            if mlh_dec is not None:
                if abs(mlh_calc - float(mlh_dec)) > max(0.05 * mlh_calc, 0.05):
                    erro("%s: %.4g ug/kg/min a %.4g kg -> declarado %.4g ml/h, "
                         "calculado %.4g ml/h" % (nome, dose, peso, float(mlh_dec), mlh_calc))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("markdown")
    ap.add_argument("--doses", default="")
    a = ap.parse_args()

    print("== estrutura ==")
    checa_markdown(a.markdown)

    if a.doses:
        print("== aritmetica de doses ==")
        checa_doses(a.doses)

    print()
    if AVISOS:
        print("AVISOS (%d):" % len(AVISOS))
        for x in AVISOS:
            print("  ! " + x)
    if ERROS:
        print("ERROS BLOQUEANTES (%d):" % len(ERROS))
        for x in ERROS:
            print("  X " + x)
        sys.exit(1)
    print("Nenhum erro bloqueante.")


if __name__ == "__main__":
    main()
