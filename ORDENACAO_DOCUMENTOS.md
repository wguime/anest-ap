# 📋 Ordenação de Documentos Implementada

## ✅ O que foi implementado

Os documentos agora são exibidos na biblioteca **exatamente na mesma ordem** estabelecida na pasta `Documentos`.

## 📁 Ordem das Categorias

Conforme a estrutura da pasta `Documentos`:

1. **📋 Protocolos** (`1 - Protocolos/`)
2. **📜 Políticas** (`2 - Políticas/`)
3. **📝 Formulários** (`3 - Formulários/`)
4. **📚 Manuais** (`4 - Manuais/`)
5. **📊 Relatórios de Segurança** (`4 - Relatórios de Segurança/`)
6. **🗺️ Mapeamento de Processos** (`5 - Mapeamento de Processos/`)
7. **📑 Termos** (`6 - Termos/`)
8. **📊 Ficha Técnica Indicadores** (`7 - Ficha Técnica Indicadores/`)
9. **⚠️ Mapeamento dos Riscos** (`8 - Mapeamento dos Riscos/`)
10. **🛡️ Plano de Segurança do Paciente** (`9 - Plano de Segurança do Paciente/`)

## 🔧 Funcionalidades Implementadas

### 1. Ordenação de Categorias
- Categorias são ordenadas conforme a numeração das pastas
- Números são exibidos nos títulos das categorias (ex: "1 - Protocolos")
- Categorias sem número aparecem no final

### 2. Ordenação Dentro de Cada Categoria
- Documentos são ordenados por **código** (se existir)
- Se não houver código, ordena por **título** (alfabético em português)
- Documentos com código aparecem antes dos sem código

### 3. Preferência por PDFs
- Quando há duplicatas (mesmo título), mantém apenas o PDF
- Se existir DOCX/DOC e novo for PDF → substitui pelo PDF
- Se ambos forem PDF → mantém o primeiro

## 📝 Arquivos Modificados

### `app.js`
- Adicionado objeto `ordemCategorias` com ordem numérica
- Implementada ordenação de categorias antes de exibir
- Implementada ordenação de documentos dentro de cada categoria
- Títulos de categorias agora incluem número (ex: "1 - Protocolos")

### `scripts/importar-documentos.js`
- Atualizado mapeamento para incluir "Ficha Técnica Indicadores" como categoria separada
- Comentários adicionados indicando ordem de cada categoria

### `biblioteca-manager.js`
- Select de categorias atualizado com números na ordem correta

## 🎯 Resultado Visual

Na biblioteca, os documentos aparecem assim:

```
📚 Biblioteca de Documentos

1 - Protocolos
  ├── PRO.ANEST.0001-00 avaliacao pre anestesica.pdf
  ├── PRO.ANEST.0002-00 Manejo da cefaleira pos puncao dural.pdf
  └── ...

2 - Políticas
  ├── PLI.ANEST.0001-00 Politica de gestao da qualidade.pdf
  └── ...

3 - Formulários
  ├── FOR.RPA.0001 Score de Eberhart.pdf
  └── ...

... (e assim por diante na ordem estabelecida)
```

## ✅ Garantias

- ✅ Ordem sempre respeitada conforme estrutura da pasta
- ✅ Documentos ordenados por código dentro de cada categoria
- ✅ Números das categorias visíveis na interface
- ✅ Script de importação usa mesma ordem
- ✅ Novos documentos adicionados manualmente respeitam a ordem

---

**Data**: Novembro 2025
**Status**: ✅ Implementado e testado








