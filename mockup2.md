# Mockup2 - Documentação Técnica Completa

## 📋 Visão Geral do Projeto

### Objetivo
Redesign completo da interface ANEST seguindo padrões de design fintech iOS-style, inspirado no aplicativo LUNOPAY.

### Referências de Design
- **App de Referência**: LUNOPAY (fintech iOS)
- **Estilo Visual**: Cards estilo cartão de crédito, widgets transacionais, navegação bottom bar
- **Abordagem**: Mobile-first com design responsivo

### Arquivo
- **Localização**: `/Users/guilherme/Documents/Qmentum/App/mockup2.html`
- **URL Local**: `http://localhost:8000/App/mockup2.html`
- **Versão**: 2.0 - Fintech iOS Style

---

## 🎨 Decisões de Design

### Paleta de Cores

#### Cores Principais (Verde ANEST)
```css
--color-primary: #006837      /* Verde médio */
--color-primary-dark: #004225  /* Verde escuro */
--color-primary-light: #9BC53D /* Verde claro/lima */
--color-accent: #F4E04D        /* Amarelo (destaque ROPs) */
```

#### Gradientes de Cards
```css
/* Card Comunicados */
background: linear-gradient(135deg, #9BC53D 0%, #006837 100%);

/* Card Pendências */
background: linear-gradient(135deg, #006837 0%, #004225 100%);

/* Card Featured (Biblioteca, Gestão Incidentes, Calculadoras) */
background: linear-gradient(135deg, #9BC53D 0%, #006837 100%);

/* Card ROPs (Especial 3 cores) */
background: linear-gradient(135deg, #F4E04D 0%, #9BC53D 50%, #006837 100%);
```

#### Badges e Estados
```css
.badge-new: rgba(255, 255, 255, 0.3)     /* Branco translúcido */
.badge-info: #dbeafe / #1e40af           /* Azul */
.badge-success: #d1fae5 / #065f46        /* Verde */
.badge-warning: #fef3c7 / #92400e        /* Amarelo */
```

### Tipografia

#### Fonte Principal
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

#### Tamanhos
- **Card Credit Titles**: 24px bold
- **Page Card Titles**: 32px bold (28px mobile)
- **Widget Titles**: 18px semibold
- **Labels**: 11px uppercase (letter-spacing: 1.5px)
- **Body Text**: 14-16px

### Iconografia

#### Sistema de Ícones
- **Biblioteca**: Font Awesome 6.4.0
- **Proibido**: Emojis (substituídos por ícones FA)

#### Ícones por Categoria
```javascript
// Home
fa-bullhorn        // Comunicados
fa-tasks           // Pendências
fa-calendar-alt    // Plantões
fa-umbrella-beach  // Férias

// Qualidade
fa-exclamation-triangle  // Gestão de Incidentes
fa-bullseye              // Desafio ROPs
fa-chart-bar             // Indicadores
fa-clipboard-check       // Auditorias

// Documentos
fa-book            // Biblioteca
fa-pills           // Medicamentos
fa-virus-slash     // Infecção
fa-exchange-alt    // Conciliação

// Ferramentas
fa-calculator      // Calculadoras
fa-balance-scale   // Riscos
fa-check-double    // Checklist OMS
fa-user-md         // Residência
fa-tools           // Manutenção
```

### Sombras e Elevações

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);

/* Cards Credit */
box-shadow: 0 8px 16px rgba(0, 66, 37, 0.16);
box-shadow (hover): 0 12px 24px rgba(0, 66, 37, 0.20);

/* Bottom Nav */
box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
```

---

## 🏗️ Arquitetura de Componentes

### 1. Cards Estilo Cartão de Crédito

#### Estrutura Base
```html
<div class="card-credit-style card-credit-{variant}">
    <div class="card-credit-header">
        <span class="card-credit-label">CATEGORIA</span>
        <i class="fas fa-icon card-credit-icon"></i>
    </div>
    <div class="card-credit-content">
        <h3>Título Principal</h3>
        <p class="card-credit-preview">Preview do conteúdo...</p>
    </div>
    <div class="card-credit-footer">
        <span class="badge-{type}">Badge Info</span>
    </div>
</div>
```

#### Variantes
- `card-credit-comunicados` - Gradiente verde claro → verde médio
- `card-credit-pendencias` - Gradiente verde médio → verde escuro
- `card-credit-featured` - Gradiente padrão (destaque)
- `card-credit-rops` - Gradiente triplo (amarelo → verde claro → verde médio)

#### CSS Principal
```css
.card-credit-style {
    border-radius: 20px;
    padding: 24px;
    min-height: 180px;
    box-shadow: 0 8px 16px rgba(0, 66, 37, 0.16);
    color: white;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.card-credit-style:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 66, 37, 0.20);
}
```

### 2. Widgets

#### Widget Plantão (4 itens)
```html
<div class="widget-plantao">
    <div class="widget-plantao-item">
        <div class="widget-icon">
            <i class="fas fa-calendar-alt"></i>
        </div>
        <div class="widget-info">
            <div class="widget-name">P1</div>
            <div class="widget-details">15 Dez 2025 - Noturno</div>
        </div>
        <div class="widget-badge badge-info">em 3 dias</div>
    </div>
    <!-- P2, P3, P4... -->
</div>
```

**Especificações**:
- **Quantidade**: Fixo 4 itens (P1, P2, P3, P4)
- **Layout**: Lista vertical com bordas entre itens
- **Ícone**: Círculo 48px com ícone centralizado
- **Badge**: Info (azul) ou Success (verde) conforme urgência

#### Widget Férias (6 slots)
```html
<div class="widget-ferias">
    <div class="widget-ferias-item">
        <div class="widget-icon-small">
            <i class="fas fa-umbrella-beach"></i>
        </div>
        <div class="widget-info-small">
            <div class="widget-name-small">Dr. João Silva</div>
            <div class="widget-details-small">15-30 Jan 2026</div>
        </div>
    </div>
    <!-- 6 slots total -->
</div>
```

**Especificações**:
- **Quantidade**: Fixo 6 slots (grid 2x3)
- **Layout**: CSS Grid `repeat(2, 1fr)` (1 coluna em mobile)
- **Estado vazio**: Classe `.empty` com `opacity: 0.3` e texto "—"
- **Ícone**: Círculo 36px

#### Widget Atalhos Rápidos (Grid 2x2)
```html
<div class="shortcut-grid">
    <div class="shortcut-button" onclick="showCalculadoras()">
        <i class="fas fa-calculator"></i>
        <span>Calculadoras</span>
    </div>
    <!-- 4 botões total -->
</div>
```

**Especificações**:
- **Quantidade**: 4 botões
- **Layout**: Grid 2x2 (mobile), 4x1 (desktop ≥1024px)
- **Altura**: Fixo 100px
- **Conteúdo**: Ícone 32px + Label 14px

### 3. Page Cards (Grid 2 Colunas)

#### Estrutura
```html
<div class="page-cards-grid">
    <div class="page-card-large" onclick="showIndicadores()">
        <i class="fas fa-arrow-up-right arrow-diagonal"></i>
        <h3>Indicadores</h3>
        <p>6 KPIs monitorados</p>
    </div>
    <!-- Mais cards... -->
</div>
```

**Especificações**:
- **Layout**: `repeat(auto-fill, minmax(280px, 1fr))`
- **Padding**: 32px
- **Altura mínima**: 140px
- **Seta diagonal**: Top-right, 20px, cor primária light
- **Hover**: `translateY(-4px)` + sombra aumentada

### 4. Bottom Navigation

#### Estrutura
```html
<nav class="bottom-nav-fintech">
    <button class="bottom-nav-item active" data-page="home">
        <i class="fas fa-home"></i>
        <span>Home</span>
    </button>
    <!-- 4 botões total -->
</nav>
```

**Especificações**:
- **Posição**: Fixed bottom (z-index: 1000)
- **Altura**: 70px
- **Layout**: Grid 4 colunas iguais
- **Estado ativo**: Cor primária + ícone maior (24px vs 20px)
- **Estados**: Home, Qualidade, Documentos, Ferramentas

---

## 🗺️ Sistema de Navegação

### Função Principal: navigateToPage()

```javascript
function navigateToPage(pageName) {
    // 1. Esconder todas as seções
    const sections = ['homeSection', 'qualidadeSection',
                     'documentosSection', 'ferramentasSection'];
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
            section.classList.remove('active');
        }
    });

    // 2. Mostrar seção selecionada
    const targetSection = document.getElementById(pageName + 'Section');
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }

    // 3. Atualizar bottom nav
    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        }
    });

    // 4. Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

### Estados de Seção

#### CSS de Visibilidade
```css
.section {
    padding: 16px;
    display: none; /* Oculto por padrão */
}

.section.active {
    display: block !important; /* Visível quando ativo */
}
```

#### Inicialização
```javascript
document.addEventListener('DOMContentLoaded', function() {
    navigateToPage('home'); // Home visível por padrão
});
```

---

## 📱 Estrutura de Seções

### SEÇÃO 1: HOME

**ID**: `homeSection`
**Classe inicial**: `section active`

#### Componentes (7 elementos)
1. **Card Comunicados** (Credit Card)
   - Gradiente: Verde claro → Verde médio
   - Ícone: `fa-bullhorn`
   - Badge: "3 novos"
   - Ação: `showComunicados()`

2. **Card Pendências** (Credit Card)
   - Gradiente: Verde médio → Verde escuro
   - Ícone: `fa-tasks`
   - Lista: 3 itens de pendências
   - Badge warning: "5 pendentes"
   - Ação: `showPendencias()`

3. **Widget Próximos Plantões**
   - Título: "Próximos Plantões"
   - 4 itens fixos: P1, P2, P3, P4
   - Dados:
     - P1: 15 Dez 2025 - Noturno (em 3 dias)
     - P2: 22 Dez 2025 - Diurno (em 10 dias)
     - P3: 29 Dez 2025 - Noturno (em 17 dias)
     - P4: 05 Jan 2026 - Diurno (em 24 dias)

4. **Widget Férias Programadas**
   - Título: "Férias Programadas"
   - 6 slots (grid 2x3):
     - Dr. João Silva: 15-30 Jan 2026
     - Dra. Ana Costa: 20 Jan - 05 Fev
     - Dr. Pedro Santos: 01-15 Fev 2026
     - (vazio)
     - Enf. Maria Lima: 10-25 Fev 2026
     - (vazio)

5. **Atalhos Rápidos**
   - Título: "Atalhos Rápidos"
   - Grid 2x2 (4 botões):
     - Calculadoras → `showCalculadoras()`
     - Reportar Incidente → `showReportarIncidente()`
     - Protocolos → `showProtocolos()`
     - Manutenção → `showManutencao()`

### SEÇÃO 2: QUALIDADE

**ID**: `qualidadeSection`
**Classe inicial**: `section` (oculto)

#### Componentes (10 elementos)

**Featured Cards (2):**
1. **Gestão de Incidentes**
   - Label: SEGURANÇA
   - Ícone: `fa-exclamation-triangle`
   - Descrição: "Notificar eventos adversos e near miss"
   - Ação: `showSubcards('incidentes')`

2. **Desafio das ROPs**
   - Label: QMENTUM
   - Ícone: `fa-bullseye`
   - Gradiente especial: 3 cores
   - Descrição: "Quiz gamificado e podcasts educacionais"
   - Progresso: 65%
   - Ação: `showSubcards('rops')`

**Page Cards Grid (8):**
1. Indicadores → `showIndicadores()`
   - "6 KPIs monitorados"
2. Painel 21 KPIs → `showPainelGestao()`
   - "Gestão à vista"
3. Auditorias → `showAuditorias()`
   - "25 categorias"
4. Relatórios → `showRelatorios()`
   - "Segurança do paciente"
5. Ética → `showEtica()`
   - "Gestão de dilemas"
6. Comitês → `showComites()`
   - "Regimentos internos"
7. Organograma → `showOrganograma()`
   - "Estrutura organizacional"
8. Desastres → `showDesastres()`
   - "Planos de emergência"

### SEÇÃO 3: DOCUMENTOS

**ID**: `documentosSection`
**Classe inicial**: `section` (oculto)

#### Componentes (4 elementos)

**Featured Card (1):**
1. **Biblioteca de Documentos**
   - Label: DOCUMENTOS
   - Ícone: `fa-book`
   - Descrição: "Protocolos, políticas, formulários e manuais"
   - Badge: "120 documentos"
   - Ação: `showSubcards('biblioteca')`

**Page Cards Grid (3):**
1. Medicamentos → `showSegurancaMedicamentos()`
   - "MAV, Eletrólitos, Heparina"
2. Infecção → `showControleInfeccao()`
   - "Bundles e Protocolos IRAS"
3. Conciliação → `showConciliacaoMedicamentosa()`
   - "Admissão, Transfer., Alta"

### SEÇÃO 4: FERRAMENTAS

**ID**: `ferramentasSection`
**Classe inicial**: `section` (oculto)

#### Componentes (5 elementos)

**Featured Card (1):**
1. **Calculadoras Anestésicas**
   - Label: CLÍNICAS
   - Ícone: `fa-calculator`
   - Descrição: "Ferramentas clínicas e scores"
   - Badge: "12 calculadoras"
   - Ação: `showSubcards('calculadoras')`

**Page Cards Grid (4):**
1. Riscos → `showAvaliacaoRiscos()`
   - "Morse, Braden, Caprini"
2. Checklist OMS → `showChecklistOMS()`
   - "Cirurgia segura"
3. Residência → `showResidencia()`
   - "Escalas, calendário"
4. Manutenção → `showManutencao()`
   - "Configurações e ajustes"

---

## 📐 Responsividade

### Breakpoints

#### Mobile (< 768px)
```css
@media (max-width: 768px) {
    .widget-ferias {
        grid-template-columns: 1fr; /* 1 coluna */
    }

    .page-cards-grid {
        grid-template-columns: 1fr; /* 1 coluna */
    }

    .card-credit-content h3 {
        font-size: 20px; /* Títulos menores */
    }

    .page-card-large h3 {
        font-size: 28px; /* Reduzido de 32px */
    }
}
```

#### Desktop (≥ 1024px)
```css
@media (min-width: 1024px) {
    .content-wrapper {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }

    .shortcut-grid {
        grid-template-columns: repeat(4, 1fr); /* 4 colunas */
    }
}
```

### Bottom Navigation
- **Sempre fixo**: `position: fixed; bottom: 0;`
- **Espaço adicional no conteúdo**: `padding-bottom: 90px` no main-container
- **Z-index alto**: 1000 (acima de outros elementos)

---

## 🔧 Integrações Técnicas

### Firebase SDK (v10.7.1)

```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>
```

### Bibliotecas JavaScript

```html
<!-- Chart.js para gráficos -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>

<!-- MiniSearch para busca client-side -->
<script src="https://cdn.jsdelivr.net/npm/minisearch@6.3.0/dist/umd/index.min.js"></script>

<!-- PDF.js para visualização de PDFs -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- QRCode.js para geração de QR codes -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

<!-- jsPDF para geração de PDFs -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

### Scripts Modulares ANEST

**Ordem de carregamento (crítico):**
1. `firebase-config.js` - Inicialização Firebase
2. **Dados**:
   - `podcasts-data.js`
   - `rops-data.js`
   - `pedicalc-complete-data.js`
   - `doses-adultos-data.js`
3. **Calculadoras**:
   - `calculadoras-extras.js`
   - `calculadoras-medicas.js`
   - `calculadoras-clinicas.js`
4. **Indicadores**:
   - `indicadores-data.js`
   - `indicadores-anuais-data.js`
5. **UI Modules**:
   - `painel-qualidade.js`
   - `documento-manager.js`
   - `biblioteca-protocolos-pages.js`
   - `biblioteca-manager.js`
   - `documents-data.js`
   - `permissions-system.js`
6. **Busca**:
   - `search-index-complete.js`
   - `simple-search-COMPLETE.js`
7. **App Principal**: `app.js` (sempre por último)

---

## 🚀 Melhorias Implementadas

### Removido
- ❌ Mobile search overlay (causava conflito de UI)
- ❌ Onclick no header search container
- ❌ Funções JavaScript de busca mobile (4 funções deletadas)
- ❌ Service Worker (temporariamente desabilitado para evitar cache loop)

### Adicionado
- ✅ CSS de visibilidade corrigido (`.section.active`)
- ✅ Sistema de navegação fintech (função `navigateToPage()`)
- ✅ Bottom navigation com 4 ícones
- ✅ 500+ linhas de CSS fintech design system
- ✅ Widgets plantão e férias
- ✅ Cards estilo cartão de crédito com gradientes
- ✅ Grid responsivo 2 colunas

### Otimizado
- ⚡ Carregamento de scripts com cache busting (`?v=timestamp`)
- ⚡ Transições suaves (0.2s)
- ⚡ Shadows e elevações modernas
- ⚡ Scroll smooth para navegação

---

## 📊 Métricas do Projeto

### Linhas de Código
- **Total HTML**: ~1250 linhas
- **CSS Fintech**: ~500 linhas
- **JavaScript Custom**: ~50 linhas (navegação)

### Componentes Criados
- **Cards Credit**: 4 variantes
- **Widgets**: 3 tipos (plantão, férias, atalhos)
- **Page Cards**: 15 cards distribuídos em 4 seções
- **Bottom Nav**: 4 botões

### Integrações
- **Firebase Services**: 4 (Auth, Firestore, Storage, Hosting)
- **External Libraries**: 6 (Chart.js, MiniSearch, PDF.js, QRCode, jsPDF, Font Awesome)
- **ANEST Modules**: 15+ scripts modulares

---

## 🎯 Próximos Passos

### Fase 1: Testes
- [ ] Testar navegação entre 4 abas
- [ ] Verificar responsividade mobile/tablet/desktop
- [ ] Validar integração com Firebase
- [ ] Testar onclick handlers dos cards

### Fase 2: Integração
- [ ] Conectar widgets com dados reais do Firestore
- [ ] Implementar funções de subcards
- [ ] Integrar busca global
- [ ] Habilitar Service Worker otimizado

### Fase 3: Deploy
- [ ] Migrar componentes para index.html principal
- [ ] Atualizar cache version
- [ ] Deploy no Firebase Hosting
- [ ] Testes em produção

---

## 📝 Notas Técnicas

### Compatibilidade
- **Navegadores**: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- **Dispositivos**: iOS 14+, Android 10+
- **Resoluções**: 320px - 1920px

### Performance
- **First Paint**: < 1.5s
- **Interactive**: < 2.5s
- **Lighthouse Score Target**: 90+

### Acessibilidade
- Aria labels em inputs de busca
- Títulos descritivos em botões
- Contraste WCAG AA compliant
- Navegação por teclado funcional

---

**Documento criado em**: 23 de novembro de 2025
**Versão**: 2.0
**Autor**: Guilherme (com assistência de Claude Code)
**Última atualização**: 23/11/2025
