# 📁 Estrutura de Pastas no Firebase Storage

**Data de Criação:** Janeiro 2025  
**Status:** ✅ Todas as pastas criadas

---

## 📊 Resumo

- **Total de pastas criadas:** 31
- **Organização:** Por categoria, na ordem exata do aplicativo
- **Método:** Arquivos `.placeholder` garantem que as pastas existam

---

## 🗂️ Estrutura Completa

### 1. 📋 Auditorias e Conformidades (5 pastas)

```
auditoria_higiene_maos/
auditoria_uso_medicamentos/
auditoria_abreviaturas/
politica_gestao_qualidade/
politica_disclosure/
```

**Correspondência no App:**
- Qualidade > Auditorias e Conformidade > [Cards]

---

### 2. 📊 Relatórios de Segurança (4 pastas)

```
relatorio_trimestral/
relatorio_incidentes/
relatorio_auditorias/
relatorio_indicadores/
```

**Correspondência no App:**
- Qualidade > Relatórios de Segurança > [Cards]

---

### 3. 📚 Biblioteca de Documentos (1 pasta)

```
biblioteca_documentos/
```

**Correspondência no App:**
- Qualidade > Biblioteca de Documentos > Biblioteca de Documentos

---

### 4. 📈 KPIs - Indicadores de Qualidade (2 pastas)

```
kpi_adesao_protocolos/
kpi_taxa_infeccao/
```

**Correspondência no App:**
- Qualidade > KPIs > [Cards]

---

### 5. 💊 Biblioteca de Documentos - Medicamentos (7 pastas)

```
doc_mav/                          # Medicamentos de Alta Vigilância
doc_eletrolitos/                  # Eletrólitos Concentrados
doc_heparina/                     # Segurança no Uso da Heparina
doc_narcoticos/                   # Segurança dos Narcóticos
doc_lista_abreviaturas/           # Lista de Abreviaturas Perigosas
doc_intoxicacao_anestesicos/      # Intoxicação por Anestésicos Locais
doc_manejo_glicemia/              # Manejo da Glicemia
```

**Correspondência no App:**
- Qualidade > Biblioteca de Documentos > [Cards de Medicamentos]

---

### 6. 📋 Protocolos (7 pastas)

```
protocolo_higiene_maos/                    # Protocolo de Higiene das Mãos
protocolo_prevencao_isc/                    # Prevenção de Infecção de Sítio Cirúrgico
protocolo_prevencao_ics/                    # Prevenção de Infecção de Corrente Sanguínea
protocolo_prevencao_pav/                    # Prevenção de Pneumonia Associada à Ventilação
protocolo_prevencao_itu/                    # Prevenção de Infecção do Trato Urinário
protocolo_prevencao_broncoaspiracao/        # Prevenção da Broncoaspiração
protocolo_prevencao_alergia_latex/          # Prevenção de Alergia ao Látex
```

**Correspondência no App:**
- Qualidade > Protocolos de Prevenção > [Cards]

---

### 7. 💊 Conciliação Medicamentosa (3 pastas)

```
conciliacao_admissao/          # Conciliação na Admissão
conciliacao_transferencia/     # Conciliação na Transferência
conciliacao_alta/              # Conciliação na Alta
```

**Correspondência no App:**
- Qualidade > Conciliação Medicamentosa > [Cards]

---

### 8. 📋 Outros (2 pastas)

```
protocolo_institucional/       # Protocolo Institucional
checklist_cirurgia/            # Checklist de Cirurgia Segura
```

**Correspondência no App:**
- Qualidade > Conciliação > Protocolo Institucional
- Qualidade > Protocolos > Checklist de Cirurgia Segura

---

## 📋 Lista Completa (31 pastas)

1. `auditoria_higiene_maos`
2. `auditoria_uso_medicamentos`
3. `auditoria_abreviaturas`
4. `politica_gestao_qualidade`
5. `politica_disclosure`
6. `relatorio_trimestral`
7. `relatorio_incidentes`
8. `relatorio_auditorias`
9. `relatorio_indicadores`
10. `biblioteca_documentos`
11. `kpi_adesao_protocolos`
12. `kpi_taxa_infeccao`
13. `doc_mav`
14. `doc_eletrolitos`
15. `doc_heparina`
16. `doc_narcoticos`
17. `doc_lista_abreviaturas`
18. `doc_intoxicacao_anestesicos`
19. `doc_manejo_glicemia`
20. `protocolo_higiene_maos`
21. `protocolo_prevencao_isc`
22. `protocolo_prevencao_ics`
23. `protocolo_prevencao_pav`
24. `protocolo_prevencao_itu`
25. `protocolo_prevencao_broncoaspiracao`
26. `protocolo_prevencao_alergia_latex`
27. `conciliacao_admissao`
28. `conciliacao_transferencia`
29. `conciliacao_alta`
30. `protocolo_institucional`
31. `checklist_cirurgia`

---

## 🔗 Mapeamento Collection ↔ Storage

Cada collection do Firestore tem uma pasta correspondente no Storage:

| Firestore Collection | Storage Folder |
|---------------------|----------------|
| `auditoria_higiene_maos` | `auditoria_higiene_maos/` |
| `auditoria_uso_medicamentos` | `auditoria_uso_medicamentos/` |
| `auditoria_abreviaturas` | `auditoria_abreviaturas/` |
| `politica_gestao_qualidade` | `politica_gestao_qualidade/` |
| `politica_disclosure` | `politica_disclosure/` |
| `relatorio_trimestral` | `relatorio_trimestral/` |
| `relatorio_incidentes` | `relatorio_incidentes/` |
| `relatorio_auditorias` | `relatorio_auditorias/` |
| `relatorio_indicadores` | `relatorio_indicadores/` |
| `biblioteca_documentos` | `biblioteca_documentos/` |
| `kpi_adesao_protocolos` | `kpi_adesao_protocolos/` |
| `kpi_taxa_infeccao` | `kpi_taxa_infeccao/` |
| `doc_mav` | `doc_mav/` |
| `doc_eletrolitos` | `doc_eletrolitos/` |
| `doc_heparina` | `doc_heparina/` |
| `doc_narcoticos` | `doc_narcoticos/` |
| `doc_lista_abreviaturas` | `doc_lista_abreviaturas/` |
| `doc_intoxicacao_anestesicos` | `doc_intoxicacao_anestesicos/` |
| `doc_manejo_glicemia` | `doc_manejo_glicemia/` |
| `protocolo_higiene_maos` | `protocolo_higiene_maos/` |
| `protocolo_prevencao_isc` | `protocolo_prevencao_isc/` |
| `protocolo_prevencao_ics` | `protocolo_prevencao_ics/` |
| `protocolo_prevencao_pav` | `protocolo_prevencao_pav/` |
| `protocolo_prevencao_itu` | `protocolo_prevencao_itu/` |
| `protocolo_prevencao_broncoaspiracao` | `protocolo_prevencao_broncoaspiracao/` |
| `protocolo_prevencao_alergia_latex` | `protocolo_prevencao_alergia_latex/` |
| `conciliacao_admissao` | `conciliacao_admissao/` |
| `conciliacao_transferencia` | `conciliacao_transferencia/` |
| `conciliacao_alta` | `conciliacao_alta/` |
| `protocolo_institucional` | `protocolo_institucional/` |
| `checklist_cirurgia` | `checklist_cirurgia/` |

---

## 🚀 Como Usar

### Para adicionar um documento:

1. **Faça upload do arquivo** para a pasta correspondente no Storage
   - Exemplo: Para `doc_mav`, faça upload em `doc_mav/`

2. **Crie o documento no Firestore** na collection correspondente
   - Exemplo: Collection `doc_mav`

3. **Use a URL do Storage** no campo `arquivoURL` do documento

### Exemplo de URL:

```
https://storage.googleapis.com/anest-ap.firebasestorage.app/doc_mav/arquivo.pdf
```

---

## 📝 Notas Importantes

1. **Arquivos `.placeholder`**: Cada pasta contém um arquivo `.placeholder` invisível que garante que a pasta exista mesmo sem arquivos.

2. **Ordem**: As pastas estão organizadas na ordem exata que aparecem no aplicativo.

3. **Nomenclatura**: Os nomes das pastas correspondem exatamente aos nomes das collections no Firestore.

4. **Criação Automática**: No Firebase Storage, as pastas são criadas automaticamente quando você faz upload de um arquivo. Os arquivos `.placeholder` garantem que a estrutura exista antecipadamente.

---

## 🔄 Recriar Estrutura

Se precisar recriar a estrutura:

```bash
cd App
node scripts/criar-estrutura-storage.js
```

---

**Última atualização:** Janeiro 2025

