# Status da Migração para Design Fintech iOS Style

## Data: 23 de Novembro de 2024

## Objetivo
Migrar completamente o aplicativo ANEST do layout antigo (painelSection/renderPainelMenu) para o novo design Fintech iOS Style (homeSection/renderHomeSection).

## Problema Atual
Mesmo com o layout Fintech carregando, o console ainda registra:
- Erro de rede `ERR_INTERNET_DISCONNECTED` ao tentar abrir o canal do Firestore (a chamada falha quando a máquina/localhost fica offline).
- Referências antigas podem continuar vindo de HTML inline ou scripts legados que ainda chamam `showSection('painel')`, por isso mantivemos wrappers de compatibilidade.

## Arquivos Criados/Modificados

### ✅ Arquivos Criados (Novo Sistema)
1. **`App/assets/css/fintech-design.css`** - Design system completo com:
   - Credit cards estilo fintech
   - Widgets de plantão e férias
   - Bottom navigation fintech style
   - Responsividade mobile-first

2. **`App/scripts/navigation.js`** - Sistema de navegação novo:
   - Função `navigateToPage(pageName)` - gerencia navegação entre abas
   - Mapeamento de nomes antigos para novos (painel→home, protocolos→documentos)

3. **`App/scripts/home-renderer.js`** - Renderização da Home:
   - Função `renderHomeSection()` - renderiza Home com novo design
   - Widgets: Comunicados, Pendências, Plantão, Férias, Atalhos Rápidos

4. **`App/scripts/sections-renderer.js`** - Renderização de outras seções:
   - `renderQualidadeSection()` - Qualidade com featured cards
   - `renderDocumentosSection()` - Documentos com featured card
   - `renderFerramentasSection()` - Ferramentas com featured card

5. **`App/api-pega-plantao.js`** - API mockada para widgets:
   - `buscarPlantaoHoje()` - retorna dados de plantão
   - `buscarFeriasLicencaHoje()` - retorna dados de férias

### ✅ Arquivos Modificados
1. **`App/index.dev.html`**:
   - IDs atualizados: `painelSection` → `homeSection`, `protocolosSection` → `documentosSection`
   - Bottom navigation atualizada para `bottom-nav-fintech`
   - Scripts novos adicionados antes do `app.js`
   - CSS `fintech-design.css` incluído

2. **`App/app.js`**:
   - **PROBLEMA**: Arquivo atual tem apenas 39 linhas (wrapper de compatibilidade)
   - Mas código de busca encontrou código antigo nas linhas 2621-3212
   - Isso indica que há código legado ainda presente ou cache

## Problemas Identificados

### 🔴 Crítico
1. **Referências Legadas Pendentes de Limpeza**:
   - Ainda existem cliques/trechos HTML que chamam `showSection('painel')`; hoje isso apenas redireciona para `navigateToPage('home')`, mas o ideal é atualizar todos para a nomenclatura nova.
   - Precisamos confirmar que nenhum arquivo adicional (ex.: `app 2.js`, HTML inline) injeta IDs antigos após o build.

2. **Cache do Navegador**:
   - Mesmo após hard refresh, código antigo ainda executa
   - Versões de arquivos podem estar em cache

### 🟡 Médio
1. **Erros de Rede / Offline**:
   - As chamadas para o canal em tempo real do Firestore falham quando o dispositivo está sem internet ou com proxy bloqueando `https://firestore.googleapis.com`.
   - Precisamos implementar tratativas (retry/offline fallback) para não poluir o console.

## ✅ Atualizações Realizadas (23/11/2025)
- `App/index.dev.html` atualizado com `homeSection`/`documentosSection`/`qualidadeSection`/`ferramentasSection`, inclusão da bottom navigation Fintech e carregamento dos novos CSS.
- Novos assets adicionados ao workspace atual: `assets/css/fintech-design.css`, `colors.css`, `responsive.css`, `responsive-improved.css` e `ios-widgets.css`.
- `App/scripts/navigation.js`, `home-renderer.js` e `sections-renderer.js` incluídos para espelhar o mockup Fintech.
- `App/app.js` ajustado para mapear IDs legados, chamar `renderHomeSection()`/`navigateToPage('home')` em `showMainApp()`, atualizar o `DOMContentLoaded` e tratar `renderPainelMenu()` apenas como wrapper.
- Query strings (`?v=`) dos novos CSS/JS foram incrementadas (`173360xxxx`) para forçar refresh de cache.

## Próximos Passos Necessários

### 1. Verificar Código Legado
- [ ] Verificar se há código inline no HTML chamando funções antigas
- [ ] Verificar se `app 2.js` ou outros arquivos estão sendo carregados
- [ ] Verificar service workers em cache

### 2. Atualizar Funções Críticas
- [x] Atualizar `showMainApp()` para usar `navigateToPage('home')`
- [x] Atualizar `DOMContentLoaded` para procurar `homeSection`
- [x] Atualizar `showSection('painel')` para redirecionar para `navigateToPage('home')`
- [x] Garantir que `renderPainelMenu()` seja apenas wrapper que redireciona

### 3. Forçar Atualização de Cache
- [x] Incrementar versões de todos os arquivos JS/CSS do novo layout
- [ ] Adicionar headers de no-cache se possível
- [ ] Instruir limpeza completa de cache

### 4. Validação
- [ ] Verificar que não há mais referências a `painelSection`
- [ ] Verificar que `renderPainelMenu()` não é mais chamada diretamente
- [ ] Testar navegação entre todas as abas
- [ ] Verificar renderização correta do novo design

## Comandos Úteis para Debug

```bash
# Verificar tamanho dos arquivos app.js
ls -lh App/app*.js | grep -v backup

# Buscar referências a código antigo
grep -r "painelSection\|renderPainelMenu" App/ --exclude-dir=node_modules

# Verificar qual arquivo está sendo carregado
grep "app.js" App/index.dev.html
```

## Estrutura de Navegação Nova

### IDs de Seções (HTML)
- `homeSection` (antigo `painelSection`)
- `qualidadeSection` (mantido)
- `documentosSection` (antigo `protocolosSection`)
- `ferramentasSection` (mantido)

### Funções de Navegação
- `navigateToPage(pageName)` - Nova função principal
- `showSection(sectionName)` - Wrapper de compatibilidade (redireciona)

### Funções de Renderização
- `renderHomeSection()` - Nova função para Home
- `renderQualidadeSection()` - Nova função para Qualidade
- `renderDocumentosSection()` - Nova função para Documentos
- `renderFerramentasSection()` - Nova função para Ferramentas
- `renderPainelMenu()` - DEPRECATED (wrapper que redireciona)

## Arquivos de Referência
- `mockup2.json` - Estrutura JSON do design (DELETADO após implementação)
- `mockup2.md` - Documentação técnica (DELETADO após implementação)
- `Reestruturação Layout iOS.plan.md` - Plano original de implementação

## Notas Importantes
- **NUNCA modificar `App/index.html`** - usar apenas `App/index.dev.html`
- Todos os scripts novos estão em `App/scripts/`
- CSS novo está em `App/assets/css/fintech-design.css`
- Versão atual do `app.js`: `?v=1733602000`


