#!/usr/bin/env python3
"""
Importa o docx UNIFICADO preenchido (sobreaviso materno + hospitais) e emite:
  - blocos JS prontos para colar nos dois data files,
  - relatório de validação (nomes desconhecidos, dias faltando, linhas parciais).

Não escreve nos arquivos — só extrai e valida. Quem aplica os Edit sou eu
(Claude), depois de checar o relatório.

Uso:
  python3 importar.py "/Users/guilherme/Desktop/Escala 2026-08.docx"
"""
import sys, re
from docx import Document

NA = '—'
VALID = {'MARTA': 'marta', 'RENATA': 'renata', 'LUCIANA': 'luciana',
         'ELISETE': 'elisete', 'SAIONARA': 'saionara', 'MARI': 'mari'}


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip())


def name_id(raw):
    """Devolve (id_lower, Title, erro|None)."""
    n = norm(raw)
    if not n or n == NA:
        return None, None, None
    key = n.upper()
    if key not in VALID:
        return None, None, n
    return VALID[key], n.title(), None


def main():
    if len(sys.argv) < 2:
        print("uso: importar.py <docx>", file=sys.stderr)
        sys.exit(1)
    doc = Document(sys.argv[1])
    sobre = {}      # key -> id
    hosp = {}       # key -> {unimed,hro,plantaoPago,label}
    issues = []
    PT_FDS = ('SÁBADO', 'SABADO', 'DOMINGO')

    for t in doc.tables:
        for ri, row in enumerate(t.rows):
            cells = [c.text for c in row.cells]
            if len(cells) < 7:
                continue
            m = re.search(r'(\d{2})/(\d{2})/(\d{4})', cells[0])
            if not m:
                continue  # header / linhas sem data
            dd, mm, yy = m.groups()
            key = f"{yy}-{mm}-{dd}"
            dia = norm(cells[1]).upper()

            # --- SOBREAVISO (todo dia) ---
            sid, _, serr = name_id(cells[2])
            if serr:
                issues.append(f"{key}: sobreaviso nome desconhecido {serr!r}")
            elif sid:
                sobre[key] = sid
            else:
                issues.append(f"{key}: sobreaviso VAZIO")

            # --- HOSPITAIS (FDS + feriados) ---
            uid, uname, uerr = name_id(cells[3])
            hid, hname, herr = name_id(cells[4])
            pid, pname, perr = name_id(cells[5])
            for e in (uerr, herr, perr):
                if e:
                    issues.append(f"{key}: hospital nome desconhecido {e!r}")
            label = norm(cells[6]) or None
            is_fds = (dia in PT_FDS) or bool(label)
            has_any = any((uname, hname, pname))

            if has_any or (is_fds and label):
                hosp[key] = {'unimed': uname, 'hro': hname,
                             'plantaoPago': pname, 'label': label}
                # completude: HRO e PLANTÃO são obrigatórios em todo dia de hospital
                if not hname:
                    issues.append(f"{key}: hospital HRO faltando")
                if not pname:
                    issues.append(f"{key}: hospital PLANTÃO faltando")
                # UNIMED obrigatório em sábado/feriado (não em domingo)
                if dia != 'DOMINGO' and not uname:
                    issues.append(f"{key}: hospital UNIMED faltando (sábado/feriado)")
            elif is_fds:
                issues.append(f"{key}: linha de FDS/feriado SEM nomes de hospital")

    # ---- saída ----
    print("=== SOBREAVISO (cole em SOBREAVISO_MATERNO_2026) ===")
    for k in sorted(sobre):
        print(f"  '{k}': '{sobre[k]}',")
    print(f"\n=== HOSPITAIS (cole em HOSPITAIS_2026) ===")
    for k in sorted(hosp):
        e = hosp[k]
        u = (f"'{e['unimed']}'," if e['unimed'] else "null,").ljust(12)
        h = (f"'{e['hro']}'," if e['hro'] else "null,").ljust(12)
        p = (f"'{e['plantaoPago']}'," if e['plantaoPago'] else "null,").ljust(12)
        lbl = f"'{e['label']}'" if e['label'] else "null"
        print(f"  '{k}': {{ unimed: {u}hro: {h}plantaoPago: {p}label: {lbl} }},")

    # ---- conferência legível (humano bate o olho antes de aplicar) ----
    PT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
    from datetime import date as _date
    def fmt(k):
        y, m, d = k.split('-')
        return f"{d}/{m} {PT[_date(int(y), int(m), int(d)).weekday()]}"
    print(f"\n=== CONFERÊNCIA — revise antes de aplicar ===")
    print(f"Sobreaviso materno (1/dia, 19h→07h):")
    for k in sorted(sobre):
        print(f"  {fmt(k)}  {sobre[k].title()}")
    print(f"Hospitais (FDS + feriados):")
    for k in sorted(hosp):
        e = hosp[k]
        partes = []
        if e['unimed']:      partes.append(f"UNIMED {e['unimed']}")
        if e['hro']:         partes.append(f"HRO {e['hro']}")
        if e['plantaoPago']: partes.append(f"PP {e['plantaoPago']}")
        tail = f"  [{e['label']}]" if e['label'] else ""
        print(f"  {fmt(k)}  " + " · ".join(partes) + tail)

    print(f"\n=== RESUMO ===")
    print(f"  sobreaviso: {len(sobre)} dias")
    print(f"  hospitais:  {len(hosp)} dias")
    print(f"  ISSUES: {len(issues)}")
    for i in issues:
        print(f"    - {i}")
    # exit code != 0 se houver problema, pra eu não aplicar cego
    sys.exit(1 if issues else 0)


if __name__ == '__main__':
    main()
