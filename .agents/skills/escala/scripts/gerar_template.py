#!/usr/bin/env python3
"""
Gera os docx da escala mensal UNIFICADA (sobreaviso materno + hospitais).

Uma tabela, uma linha por dia, um valor por célula — desenhado para ser
trivial de preencher e à prova de ambiguidade na hora de parsear (sem célula
multi-linha, sem domingo embutido no sábado como no export antigo do Numbers).

Três saídas, todas com o mesmo título, instruções e tabela de 7 colunas:
  modelo      → o MODELO ÚNICO, serve para qualquer mês (dono, 02/10/2026):
                sem data, sem dia da semana e sem faixa verde — quem preenche
                escreve o mês no título e a data em cada linha.
  preenchido  → o modelo único preenchido com o que está publicado no app
                (cópia "publicada" de cada mês na pasta de escalas — ver pasta.py).
  YYYY-MM     → LEGADO: template de um mês específico, com datas, "—" nos slots
                que não se aplicam e faixas verdes nos FDS/feriados.

Regras de quais slots de hospital se aplicam (espelham src/data/hospitaisTecnicas2026.js):
  - SOBREAVISO: todo dia.
  - UNIMED  (07–15): sábados e feriados. Domingo não tem.
  - HRO     (07–15): sábados, domingos e feriados.
  - PLANTÃO (15–23): sábados, domingos e feriados.

Uso:
  python3 gerar_template.py modelo                          # pasta padrão (MODELO_PATH)
  python3 gerar_template.py 2026-08 ["/caminho/custom.docx"]  # legado, mês específico
  (o preenchido sai por pasta.py publicada <dados.json>)
"""
import sys, re, calendar, os
from datetime import date
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

REPO = "/Users/guilherme/dev/anest"
PLANTAO_JS = f"{REPO}/src/data/plantao2026.js"
# Pasta padrão das escalas (onde o usuário busca/anexa os docx).
OUT_DIR = "/Users/guilherme/Documents/IA/Escalas funcinárias"
MODELO_PATH = os.path.join(OUT_DIR, "Modelo - escala mensal das funcionárias.docx")

PT_DIAS = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO']
PT_MESES = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
            'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
FUNCIONARIAS = ['Marta', 'Renata', 'Luciana', 'Elisete', 'Saionara', 'Mari']

COLS = ['DATA', 'DIA', 'SOBREAVISO', 'UNIMED (07-15)', 'HRO (07-15)',
        'PLANTÃO PAGO (15-23)', 'FERIADO']
NA = '—'  # marcador "não se aplica" — o importador ignora
LINHAS_MODELO = 31  # o maior mês; nos menores sobram linhas em branco

SUBTITULO = "SOBREAVISO MATERNO + HOSPITAIS"
REGRA_NOMES = "Use somente estes nomes: " + ", ".join(FUNCIONARIAS) + "."
REGRA_SOBREAVISO = "Coluna SOBREAVISO: preencha TODOS os dias (uma pessoa por dia)."

INSTRUCOES_MES = [
    "Preencha apenas os NOMES. As datas, os dias da semana e os feriados já estão prontos.",
    REGRA_SOBREAVISO,
    "Colunas UNIMED, HRO e PLANTÃO PAGO: só nas linhas verdes (sábados, domingos e feriados).",
    f'Onde aparecer "{NA}", não precisa preencher — pode deixar como está.',
    REGRA_NOMES,
]
INSTRUCOES_MODELO = [
    "Escreva o mês e o ano no título. Em cada linha, preencha a DATA (dd/mm/aaaa) e o DIA "
    "da semana, um dia por linha. Mês com menos de 31 dias: as últimas linhas ficam em branco.",
    REGRA_SOBREAVISO,
    "Colunas UNIMED, HRO e PLANTÃO PAGO: só nos sábados, domingos e feriados — domingo não "
    "tem UNIMED. Nos outros dias, deixe essas colunas em branco.",
    "Coluna FERIADO: escreva o nome do feriado, quando houver.",
    REGRA_NOMES,
]


def load_feriado_labels():
    """Extrai FERIADO_LABELS de plantao2026.js (fonte única da verdade)."""
    txt = open(PLANTAO_JS, encoding='utf-8').read()
    i = txt.find('FERIADO_LABELS')
    if i < 0:
        return {}
    block = txt[i: txt.find('}', i)]
    return dict(re.findall(r"'(\d{4}-\d{2}-\d{2})':\s*'([^']+)'", block))


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), hexcolor)
    tcPr.append(shd)


def set_cell(cell, text, bold=False, align='left', gray=False):
    cell.text = ''
    p = cell.paragraphs[0]
    p.alignment = {'left': WD_ALIGN_PARAGRAPH.LEFT,
                   'center': WD_ALIGN_PARAGRAPH.CENTER}[align]
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(10)
    if gray:
        run.font.color.rgb = RGBColor(0xAA, 0xAA, 0xAA)


def novo_documento(titulo_mes, instrucoes):
    """Título + COMO PREENCHER + tabela só com o cabeçalho. Devolve (doc, table)."""
    doc = Document()
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run(f"ESCALA {titulo_mes} — {SUBTITULO}")
    r.bold = True
    r.font.size = Pt(13)

    head = doc.add_paragraph()
    head.add_run("COMO PREENCHER").bold = True
    head.runs[0].font.size = Pt(11)

    for txt in instrucoes:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run("•  " + txt)
        r.font.size = Pt(10)
    doc.add_paragraph()  # respiro antes da tabela

    table = doc.add_table(rows=1, cols=len(COLS))
    table.style = 'Table Grid'
    for c, name in zip(table.rows[0].cells, COLS):
        set_cell(c, name, bold=True, align='center')
        shade(c, 'D9D9D9')
    return doc, table


def slots_do_dia(dt, labels):
    """(unimed_ok, hro_ok, plantao_ok, destaque) para a data."""
    wd = dt.weekday()  # 0=seg ... 6=dom
    is_sat, is_sun = wd == 5, wd == 6
    is_fer = dt.isoformat() in labels
    hro_ok = is_sat or is_sun or is_fer
    return is_sat or is_fer, hro_ok, hro_ok, hro_ok


def gerar_modelo(out=MODELO_PATH):
    """Modelo único: 31 linhas em branco, sem faixa verde, sem "—"."""
    doc, table = novo_documento("______________ 20____", INSTRUCOES_MODELO)
    for _ in range(LINHAS_MODELO):
        row = table.add_row().cells
        for c in row:
            set_cell(c, '', align='center')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    doc.save(out)
    return out


def gerar_preenchido(dados, out):
    """O modelo único preenchido com um mês publicado.

    dados = {mes: 'YYYY-MM', sobreaviso: {dateKey: id}, hospitais: {dateKey: {unimed,hro,plantaoPago,label}}}
    — a mesma forma do doc escalasFuncionarias/{YYYY-MM} no Firestore. Dia sem
    nome publicado fica em branco (é o que mostra um mês parcial).
    """
    yy, mm = (int(x) for x in dados['mes'].split('-'))
    labels = load_feriado_labels()
    nomes = {f.lower(): f for f in FUNCIONARIAS}
    sobre = dados.get('sobreaviso') or {}
    hosp = dados.get('hospitais') or {}
    doc, table = novo_documento(f"{PT_MESES[mm]} {yy}", INSTRUCOES_MODELO)
    for d in range(1, calendar.monthrange(yy, mm)[1] + 1):
        dt = date(yy, mm, d)
        key = dt.isoformat()
        h = hosp.get(key) or {}
        valores = [
            dt.strftime('%d/%m/%Y'),
            PT_DIAS[dt.weekday()],
            nomes.get(sobre.get(key, ''), sobre.get(key) or ''),
            h.get('unimed') or '',
            h.get('hro') or '',
            h.get('plantaoPago') or '',
            h.get('label') or labels.get(key, ''),
        ]
        row = table.add_row().cells
        for c, v in zip(row, valores):
            set_cell(c, v, align='center')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    doc.save(out)
    return out


def gerar_mes(ym, out):
    """LEGADO: template de um mês específico, com faixas verdes."""
    yy, mm = (int(x) for x in ym.split('-'))
    labels = load_feriado_labels()
    ndays = calendar.monthrange(yy, mm)[1]
    doc, table = novo_documento(f"{PT_MESES[mm]} {yy}", INSTRUCOES_MES)

    for d in range(1, ndays + 1):
        dt = date(yy, mm, d)
        key = dt.isoformat()
        unimed_ok, hro_ok, plantao_ok, destaque = slots_do_dia(dt, labels)

        row = table.add_row().cells
        set_cell(row[0], dt.strftime('%d/%m/%Y'), align='center')
        set_cell(row[1], PT_DIAS[dt.weekday()], align='center')
        set_cell(row[2], '', align='center')                       # sobreaviso: sempre preencher
        set_cell(row[3], '' if unimed_ok else NA, align='center', gray=not unimed_ok)
        set_cell(row[4], '' if hro_ok else NA, align='center', gray=not hro_ok)
        set_cell(row[5], '' if plantao_ok else NA, align='center', gray=not plantao_ok)
        set_cell(row[6], labels.get(key, ''), align='center')      # feriado pré-rotulado
        if destaque:
            for c in row:
                shade(c, 'EAF5EA')  # verde claro: linha que precisa de nomes de hospital

    doc.save(out)
    n_fds = sum(1 for d in range(1, ndays + 1) if slots_do_dia(date(yy, mm, d), labels)[3])
    print(f"OK: {out}")
    print(f"  {ndays} dias (linhas) | {n_fds} linhas de hospital (FDS+feriados)")
    fers = [f"{k} {v}" for k, v in sorted(labels.items()) if k.startswith(ym)]
    print(f"  feriados no mês: {fers if fers else 'nenhum'}")


def main():
    if len(sys.argv) < 2:
        print("uso: gerar_template.py modelo | YYYY-MM [output.docx]", file=sys.stderr)
        sys.exit(1)
    if sys.argv[1] == 'modelo':
        out = gerar_modelo(sys.argv[2] if len(sys.argv) >= 3 else MODELO_PATH)
        print(f"OK: {out}")
        return
    ym = sys.argv[1]
    if len(sys.argv) >= 3:
        out = sys.argv[2]
    else:
        os.makedirs(OUT_DIR, exist_ok=True)
        out = os.path.join(OUT_DIR, f"Escala {ym}.docx")
    gerar_mes(ym, out)


if __name__ == '__main__':
    main()
