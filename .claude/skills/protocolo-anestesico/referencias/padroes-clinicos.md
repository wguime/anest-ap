# Padrões clínicos do serviço e erros a caçar ativamente

Ler antes de escrever qualquer conduta. Estes são os padrões adotados pelo
serviço e os erros que aparecem com mais frequência em protocolos herdados.
Quando o esboço do usuário contrariar um destes itens, **corrigir e explicar**.

---

## Parte A — Práticas refutadas que ainda circulam

Caçar ativamente. Se encontrar no esboço, remover e justificar na §21.

| Prática | Por que sai |
|---|---|
| **Dopamina em "dose renal"** (0,5–3 µg/kg/min para proteção renal) | Não previne LRA nem reduz diálise ou mortalidade — ANZICS, *Lancet* 2000;356(9248):2139-43 (**PMID 11191541** ✅); metanálise Kellum & Decker, *Crit Care Med* 2001;29(8):1526-31 (**PMID 11505120** ✅). Aumenta arritmia e taquicardia |
| **Carga volêmica fixa por fórmula** ("repor X litros nas primeiras Y horas") | Sobrecarga → deiscência, íleo, complicação pulmonar. Nota de calibragem: o RELIEF (*NEJM* 2018;378(24):2263-74, **PMID 29742967** ✅) mostrou que restrição excessiva também aumenta LRA — o alvo é moderação guiada por metas, não restrição máxima |
| **Oligúria tratada com volume por reflexo** | Oligúria intraoperatória é frequentemente resposta fisiológica ao estresse (ADH). Avaliar responsividade antes de expandir |
| **SF 0,9% em grande volume** | Acidose hiperclorêmica; no SMART (*NEJM* 2018;378(9):829-39, **PMID 29485925** ✅) balanceados reduziram eventos renais maiores vs. SF em críticos. Cristaloide balanceado como padrão; SF fica para diluições e hiponatremia |
| **Amidos hidroxietílicos (HES)** | LRA e coagulopatia. Contraindicados |
| **Albumina em dose hepatológica (0,5–1 g/kg) para hipoalbuminemia perioperatória** | Dose de paracentese de grande volume. Usar 20–40 g por evento, guiado por resposta |
| **Corticoide em dose alta "para SIRS"** | Evidência fraca e inconsistente. Dexametasona 8 mg tem indicação sólida para NVPO; hidrocortisona 500 mg não |
| **Retirada de cateter peridural "por tempo"** | Só por critério laboratorial + ASRA. Em cirurgia oncológica de grande porte o pico da coagulopatia costuma ser tardio (2º–5º DPO) |
| **AINE precoce em cirurgia abdominal maior** | Risco de LRA e preocupação com anastomose. Evitar 48–72 h |
| **Meta de normotermia abaixo de 36 °C** | Abaixo de 36 °C já é hipotermia leve — coagulopática e arritmogênica. O alvo é 36,0–36,5 °C |


> **Marcação ✅:** os PMIDs assinalados acima foram conferidos contra o registro
> do PubMed em sessão de verificação (agosto/2026). Ao reutilizar em um novo
> protocolo, reconfirmar por busca — a regra "identificador só entra se veio de
> busca da sessão" continua valendo para o documento final.

---

## Parte B — Padrões adotados

**Fluidoterapia.** Terapia guiada por metas com cristaloide balanceado. Taxa basal
declarada em ml/kg/h por fase, mais bolus de 250 ml avaliados por resposta do
volume sistólico. Balanço final o menor compatível com perfusão.

**Hemodinâmica.** Hierarquia explícita: noradrenalina primeira linha → vasopressina
associada acima de 0,3 µg/kg/min → inotrópico se índice cardíaco baixo com volemia
otimizada → azul de metileno como resgate em vasoplegia refratária.

**Ventilação.** Protetora sempre: VC 6–8 ml/kg de peso predito, PEEP titulada,
**driving pressure < 15 cmH₂O** priorizada sobre platô absoluto, recrutamento
programado.

**Bloqueio neuromuscular.** TOF quantitativo obrigatório. Extubação apenas com
TOF-ratio ≥ 0,9. Declarar quando a farmacocinética do relaxante muda com
temperatura ou pH.

**Profundidade anestésica.** Índice processado (BIS/entropia) quando houver
variação térmica, vasoplegia intensa, TIVA ou risco de despertar.

**Transfusão.** Restritiva: Hb < 7 g/dl (< 8 se coronariopatia), plaquetas por
contexto, fibrinogênio ≥ 150–200 mg/dl, viscoelástico quando disponível.

**Neuroeixo.** Sempre com critérios de inserção e de **retirada** explícitos,
ancorados no ASRA vigente e no perfil de coagulação esperado do procedimento.

**Analgesia.** Multimodal declarada por camadas, com dose máxima somada de
anestésico local considerando **todas as fontes** (neuroeixo + bloqueios +
lidocaína sistêmica).

**Temperatura.** Alvo por fase, não alvo único. Declarar quando desligar e quando
religar o aquecimento ativo.

---

## Parte C — Checagem de coerência interna

Antes de fechar o documento, verificar que **o mesmo número aparece igual em
todos os lugares**. Erros recorrentes:

- [ ] Meta de temperatura repetida em §8, §10 e no guia rápido — conferem?
- [ ] Taxa de fluido citada em §8 e §9 — conferem?
- [ ] Frequência respiratória em §8 e §11 — conferem?
- [ ] Quantidade de kits/materiais em §4 e §13 — conferem?
- [ ] Faixa de dose de vasopressor em §9, §16, §17 e no guia rápido — conferem?
- [ ] Gatilhos transfusionais em §12 e no algoritmo de sangramento — conferem?
- [ ] Critérios de extubação em §18 e no guia rápido — conferem?
- [ ] Toda dose máxima de anestésico local soma todas as vias?
- [ ] Toda meta é numérica, não adjetiva?
- [ ] Toda conduta contraintuitiva tem marcador de citação?
