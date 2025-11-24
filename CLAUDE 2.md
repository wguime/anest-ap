# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ANEST is a quality management and gamified training web application for anesthesiology services, built on Firebase. It integrates documentation, ROPs (Required Organizational Practices) quiz system from Qmentum accreditation, podcasts, medical residency management, and quality indicators.

**Live URL**: https://anest-ap.web.app

## Core Architecture

### Frontend Structure
- **Pure JavaScript (ES6+)** - No frameworks, vanilla JS with modular design
- **Firebase v8 SDK** - Authentication, Firestore, and Storage
- **Single Page Application (SPA)** - Screen-based navigation via `currentScreen` state
- **Component-based UI** - Reusable render functions like `renderProtocolCard()`, `renderSectionHeader()`, `renderStandardLayout()`

### Key Files

**Core Application:**
- `App/index.html` - Main HTML shell with version-controlled script loading (`?v=timestamp`)
- `App/app.js` - Core application logic, screen navigation, Firebase integration (~1,187 lines)
- `App/firebase-config.js` - Firebase initialization
- `App/styles.css` - Main stylesheet (~1,047 lines)
- `App/service-worker.js` - PWA offline functionality
- `manifest.json` - PWA configuration

**Data Files:**
- `App/rops-data.js` - Quiz question bank (~1,761 lines)
- `App/documents-data.js` - Document metadata
- `App/podcasts-data.js` - Audio lesson metadata
- `App/banco-questoes-loader.js` - Qmentum question bank loader

**Quality Panel:**
- `App/painel-qualidade.js` - Quality panel module with 6 major sections
- `App/painel-qualidade.css` - Quality panel-specific styles

**Document Management:**
- `App/documento-manager.js` - Universal document category management (~500+ lines)
- `App/biblioteca-manager.js` - Library-specific UI and uploads
- `App/biblioteca-protocolos-pages.js` - Protocol page rendering

**Medical Calculators:**
- `App/calculadoras-definitions.js` - Calculator registry and definitions (~300+ lines)
- `App/calculadoras-medicas.js` - Medical calculators
- `App/calculadoras-clinicas.js` - Clinical calculators
- `App/calculadoras-extras.js` - Additional calculators
- `App/doses-adultos-data.js` - Adult medication dosages
- `App/pediatric-doses-data.js` - Pediatric dosages

**Admin Modules:**
- `App/admin-panel-complete.js` - Main admin interface
- `App/admin-users.js` - User management
- `App/admin-analytics.js` - Analytics and KPIs
- `App/admin-logs.js` - Audit logs
- `App/admin-settings.js` - Configuration
- `App/admin-system.js` - System operations

**Permissions:**
- `App/permissions-system.js` - Role-based access control

### Data Architecture

**Firestore Collections:**
- `comunicados` - Announcements/communications
- `documentos` - General documents
- `kpis` - Quality indicators
- `kpi_documentos` - KPI-specific documents (6 indicators)
- `auditorias_documentos` - Audit documents (25 categories)
- `relatorios_documentos` - Safety reports
- `biblioteca_documentos` - Protocol library documents
- `medicamentos_documentos` - Medication safety documents
- `infeccao_documentos` - Infection control documents
- `conciliacao_documentos` - Medication reconciliation documents
- `checklist_documentos` - Surgical checklist documents
- `userProfiles/{userId}` - User profiles with role-based permissions
- `usuarios/{userId}/comunicados_lidos/{comunicadoId}` - Read communications tracking
- `usuarios/{userId}/documentos_visualizados/{documentoId}` - Viewed documents tracking
- `usuarios/{userId}/funcionalidades_visualizadas/{funcionalidadeId}` - Viewed features tracking

**Firebase Storage:**
- `Comunicados/` - Communication attachments
- `Documentos/` - General documents (PDFs, Office docs)
- Various category-specific folders for organized document storage

### State Management

Global state is managed via simple JavaScript variables at the top of `app.js`:
```javascript
let currentUser = null;
let currentScreen = 'home';
let currentQuiz = null;
let userProfile = null;
let userProgress = { scores: {}, completedTopics: [], totalPoints: 0, achievements: [] };
```

### Screen Navigation System

The app uses a screen-based navigation pattern controlled by `showSection()` function:
- `'painel'` - Main dashboard/sitemap
- `'home'` - Menu grid
- `'rops'` - ROPs quiz interface
- `'podcasts'` - Audio lessons
- `'residencia'` - Medical residency
- `'profile'` - User profile
- Multiple document sections (protocolos, politicas, formularios, etc.)

Each section typically has a dedicated `show{SectionName}()` function that renders content into the `painelSection` div.

## Development Commands

### Development Scripts

The repository includes several shell scripts for common tasks:

**Local Development:**
```bash
# Start local server (recommended)
./start-app.sh                    # Starts Python HTTP server on port 8000
./start-app-background.sh         # Starts server in background mode
./stop-app.sh                     # Stops the background server

# Alternative: Direct Python command
python3 -m http.server 8000
```

**Firebase Setup:**
```bash
./instalar_firebase_cli.sh        # Install Firebase CLI (one-time setup)
```

**Deployment:**
```bash
./DEPLOY.sh                       # Automated deployment to Firebase Hosting
./firebase_deploy_manual.sh       # Manual Firebase deployment with prompts
```

**Utilities:**
```bash
./converter_para_pdf.sh           # Convert Office docs to PDF format
./gerar-630-questoes.sh          # Generate question bank from source
./renomear_lote.sh               # Batch rename files
./aplicar-cors.sh                # Configure CORS for Firebase Storage
./configurar-cors-automatico.sh  # Automated CORS configuration
```

### Manual Firebase Deployment
```bash
# Login to Firebase (first time only)
firebase login

# Deploy hosting only
firebase deploy --only hosting

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules

# Deploy everything
firebase deploy
```

### Firebase Configuration
- Project ID: `anest-ap`
- Hosting directory: `App/`
- All Firebase commands should be run from the project root (`/Users/guilherme/Documents/Qmentum`)

## Security & Permissions

### Role-Based Access Control
Implemented via `userProfiles` collection with roles:
- **Administrador** - Full access, can manage users and content
- **Coordenador** - Administrative access
- **Médico Staff** - All content, no admin panel
- **Médico Residente** - Educational content
- **Enfermeiro** - Selected ROPs and protocols
- **Técnico/Auxiliar** - Basic protocols
- **Visitante** - Public content only

Admin emails are hardcoded in some functions:
```javascript
const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
```

### Firestore Security Rules
- Authentication required for all reads
- Admin role required for writes
- Users can read/update their own profiles
- Subcollections track user interactions (read communications, viewed documents)

### Storage Security Rules
- Public read access (`allow read: if true`)
- Authenticated write access (`allow write: if request.auth != null`)

## Key Features & Implementation Patterns

### 1. Document Management System
Uses standardized card rendering with `renderProtocolCard()`:
```javascript
renderProtocolCard({
    icon: '📄',
    title: 'Document Title',
    description: 'Description',
    file: 'path/to/file.pdf',
    color: '#2563eb',
    onClick: 'customFunction()',  // Optional custom handler
    showStatus: true  // Show available/pending badge
})
```

Documents are opened via:
- `openDocument(path, title)` - For PDFs (Firebase Storage URLs)
- Office docs use Office Online viewer or Google Docs viewer

### 2. Pending Items System
Tracks unread communications and unviewed documents per user:
- Creates pending badge counts in UI
- Uses Firestore subcollections for efficient querying
- Implemented in `loadPendencias()` function

### 3. Quality Panel (6 Major Sections)
1. **Indicadores de Qualidade** - 6 KPIs with document management
2. **Auditorias e Conformidades** - 25 categories with color-coded cards
3. **Relatórios de Segurança** - Safety reports archive
4. **Biblioteca de Protocolos** - Protocol document library
5. **Segurança de Medicamentos** - Medication safety protocols
6. **Controle de Infecção** - Infection control protocols

Each section has dedicated Firestore collections and standardized UI patterns.

### 4. ROPs Quiz System
- 6 macro areas with 26 subdivisions (ROPs)
- Question bank loaded from `banco-questoes-loader.js`
- Gamification with scoring, rankings, achievements
- Individual ROP quizzes or combined macro area quizzes

### 5. Cache Busting
Scripts are loaded with version parameters to prevent caching issues:
```html
<script src="app.js?v=1730703000"></script>
```
Version number should be updated when deploying significant changes.

### 6. Medical Calculators
Comprehensive clinical decision support tools integrated throughout the application.

**Calculator Files:**
- `calculadoras-definitions.js` - Central registry (300+ lines) with calculator metadata
- `calculadoras-medicas.js` - Medical calculators implementation
- `calculadoras-clinicas.js` - Clinical risk assessment tools
- `calculadoras-extras.js` - Additional specialized calculators
- `doses-adultos-data.js` - Adult medication dosage database
- `pediatric-doses-data.js` - Pediatric dosage database
- `pedicalc-complete-data.js` - Comprehensive pediatric calculator data

**Available Calculators:**
- Morse Fall Risk Scale - Fall prevention assessment
- MEWS (Modified Early Warning Score) - Clinical deterioration detection
- Apfel Score - Post-operative nausea/vomiting risk
- Glasgow Coma Scale - Neurological assessment
- Pediatric dosage calculations - Weight-based medication dosing
- Adult medication dosages - Standard and critical care dosing

**Calculator Structure:**
```javascript
{
    id: "morse",
    title: "Escala de Morse (Quedas)",
    category: "qmentum",
    inputs: [
        { label: "Histórico de quedas", type: "boolean", points: 25 },
        // ... more inputs
    ],
    compute: function(inputs) {
        // Risk calculation logic
        return { score: totalScore, risk: "alto|medio|baixo" };
    },
    resultMessage: function(score) {
        // Risk interpretation
    }
}
```

## Module Dependencies & Loading Order

Scripts load in a specific sequence in `index.html`. **Never rearrange without understanding dependencies.**

**Loading Sequence:**
1. **External Dependencies** - Firebase SDK, Chart.js, Font Awesome
2. **Firebase Configuration** - `firebase-config.js`
3. **Data Loaders** (must load before feature modules)
   - `documents-data.js` - Document metadata
   - `rops-data.js` - ROPs quiz questions
   - `podcasts-data.js` - Audio lesson metadata
   - `banco-questoes-loader.js` - Converts Qmentum JSON format
4. **Calculator Data** (calculator modules depend on this)
   - `pedicalc-complete-data.js`
   - `doses-adultos-data.js`
5. **Calculator Modules**
   - `calculadoras-extras.js`
   - `calculadoras-medicas.js`
   - `calculadoras-clinicas.js`
6. **Feature Modules** (depend on data loaders)
   - `painel-qualidade.js` - Quality panel UI
   - `documento-manager.js` - Document management
   - `biblioteca-protocolos-pages.js` - Protocol page rendering
   - `biblioteca-manager.js` - Library-specific management
7. **Main Application** - `app.js` (orchestrates everything, loads last)

**Critical Warning:** Avoid circular dependencies between feature modules. Use event system or global state for inter-module communication.

## PWA & Service Worker

### Service Worker Configuration
Located in `App/service-worker.js`, enables offline functionality with intelligent caching.

**Current Cache Version:** `v5.2.0-podcasts`

**Caching Strategies:**
- **Network First**: HTML documents (try network, fallback to cache for offline)
- **Cache First**: Static assets like JS, CSS, images (serve from cache, update in background)
- **No Cache**: Firebase APIs, external CDNs (always fetch fresh)

**Essential Cached Files:**
```javascript
ESSENTIAL_FILES = [
    './', './index.html', './app.js',
    './calculadoras-definitions.js',
    './firebase-config.js', './rops-data-from-banco.js',
    './logo-anest.png', './manifest.json'
]
```

**To Force Cache Refresh:**
Update `CACHE_VERSION` constant in `service-worker.js` when deploying major changes. This invalidates old caches across all users.

### PWA Manifest
`manifest.json` configures Progressive Web App features:
- **Display Mode**: `standalone` (fullscreen app experience)
- **Theme Color**: `#1a4d2e` (dark green)
- **Icons**: Multiple sizes (72px to 512px)
- **Start URL**: `./index.html`
- **Shortcuts**: Quick access to ROPs Quiz, Documents, and Podcasts

**Installation:** Users can install the app to their home screen on mobile devices or as a desktop app on Chromium browsers.

## Document Management Architecture

### Overview
Documents are managed through a unified system with 20+ categories, each with dedicated Firestore collections and optional Storage paths.

### Core Modules
- **`documento-manager.js`** - Universal document category management (~500+ lines)
  - Defines `CATEGORIAS_DOCUMENTOS` object with all category configurations
  - Provides `showDocumentCategory(categoryKey)` for rendering any category
  - Handles create, read, update, delete operations

- **`biblioteca-manager.js`** - Library-specific UI and file uploads
  - Specialized interface for protocol library
  - Advanced filtering and search

- **`biblioteca-protocolos-pages.js`** - Protocol-specific page rendering
  - Multi-page document viewing
  - Category-based navigation

### Document Category Structure
Each category in `CATEGORIAS_DOCUMENTOS` includes:
```javascript
{
    collection: 'firestore_collection_name',  // Required
    folder: 'Storage/Path/To/Files',         // Optional (if files stored)
    icon: '📄',                               // Display icon
    returnFunction: 'showParentScreen'       // Navigation after edit
}
```

**Example Categories:**
- `higiene_maos` - Hand hygiene audits → `auditorias_documentos` collection
- `uso_medicamentos` - Medication use audits → `auditorias_documentos` collection
- `biblioteca_protocolos` - Protocol library → `biblioteca_documentos` collection
- `relatorio_trimestral` - Quarterly reports → `relatorios_documentos` collection

### Adding Documents
Documents can be added via:
1. **Admin UI** - Upload interface with metadata forms
2. **Programmatic Creation**:
```javascript
await db.collection('categoria_documentos').add({
    titulo: 'Document Title',
    descricao: 'Description',
    data: firebase.firestore.FieldValue.serverTimestamp(),
    arquivo: 'Documentos/categoria/filename.pdf',  // Optional
    categoria: 'Category Name'  // Optional
});
```

**File Upload Flow:**
1. Select file via UI
2. Upload to Storage under category folder
3. Get download URL
4. Store metadata in Firestore with file path
5. Track in user's viewed documents subcollection

## Admin & Permissions System

### Permissions Architecture
Hybrid system combining role templates with per-user permission overrides.

**Core File:** `permissions-system.js`

### Role Templates
Pre-defined roles with default permissions:

| Role | Level | Access |
|------|-------|--------|
| **Administrador** | Full | All features + admin panel |
| **Coordenador** | High | All content + limited admin |
| **Médico Staff** | High | All educational/clinical content |
| **Médico Residente** | Medium | Educational content only |
| **Enfermeiro** | Medium | Selected ROPs and protocols |
| **Técnico/Auxiliar** | Basic | Essential protocols only |
| **Visitante** | Public | Public content only |

### Permission Keys
**ROPs Access:**
- `rop-cultura` - Culture of Safety ROPs
- `rop-comunicacao` - Communication ROPs
- `rop-medicamentos` - Medication Use ROPs
- `rop-vida-profissional` - Professional Life ROPs
- `rop-infeccoes` - Infection Prevention ROPs
- `rop-riscos` - Risk Assessment ROPs

**Document Access:**
- `doc-protocolos` - Clinical protocols
- `doc-politicas` - Institutional policies
- `doc-formularios` - Forms and templates
- `doc-manuais` - Operational manuals
- `doc-relatorios` - Safety reports

**Module Access:**
- `podcasts` - Audio lessons
- `residencia` - Medical residency module
- `admin-panel` - Administrative panel

### Admin Panel Modules
Located in separate files for modularity:

- **`admin-panel-complete.js`** - Main admin interface and navigation
- **`admin-users.js`** - User management (create, edit, delete, roles)
- **`admin-analytics.js`** - Usage analytics, KPIs, and reporting
- **`admin-logs.js`** - System audit logs and user activity
- **`admin-settings.js`** - Application configuration and feature toggles
- **`admin-system.js`** - System-level operations (cache, backups, maintenance)

### Checking Permissions in Code
```javascript
// Check specific permission
if (userProfile.permissions['doc-protocolos']) {
    // User has access to protocols
}

// Check admin role
if (userProfile.role === 'Administrador' || userProfile.isAdmin) {
    // User is admin
}

// Legacy admin check (hardcoded emails, being phased out)
const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
if (adminEmails.includes(currentUser.email)) {
    // User is admin
}
```

### Updating Permissions
```javascript
// Update user role and permissions
await db.collection('userProfiles').doc(userId).update({
    role: 'Médico Staff',
    permissions: {
        'rop-cultura': true,
        'rop-medicamentos': true,
        'doc-protocolos': true,
        'podcasts': true
        // Individual permission overrides
    }
});
```

## Common Development Tasks

### Adding a New Document Category
1. Create new Firestore collection (e.g., `new_category_documentos`)
2. Add read/write rules in `firestore.rules`
3. Create `showNewCategory()` function in `painel-qualidade.js`
4. Add card to sitemap in `showSection('painel')`
5. Use `renderStandardLayout()` helper for consistent UI

### Adding a New Communication
Admins can create via UI, or programmatically:
```javascript
await db.collection('comunicados').add({
    titulo: 'Title',
    conteudo: 'Content',
    data: firebase.firestore.FieldValue.serverTimestamp(),
    prioridade: 'alta|media|baixa',
    autor: 'Author Name',
    categoria: 'Category'
});
```

### Updating User Role
```javascript
await db.collection('userProfiles').doc(userId).update({
    role: 'Administrador',
    isAdmin: true
});
```

### Opening Documents
PDFs from Storage:
```javascript
openDocument('Documentos/folder/file.pdf', 'Display Title');
```

External or special handling:
```javascript
window.open(url, '_blank');
```

## Styling Guidelines

### Color Palette (Green Theme)
- Primary: `#16a085` (teal green)
- Primary Dark: `#138f74`
- Secondary: `#27ae60` (green)
- Accent: `#2ecc71` (bright green)
- Dark backgrounds use variations of green

### Dark Mode
- Toggle via `toggleDarkMode()`
- Preference saved in localStorage
- Body class: `dark-mode`

### Responsive Design
- Mobile-first approach
- Breakpoints handled in CSS
- Cards use CSS Grid with `auto-fill` for responsive columns

## Firebase Hosting Configuration

In `firebase.json`:
- Public directory: `App`
- Headers configured for caching (604800s for JS/CSS, 31536000s for images/PDFs)
- CORS headers for PDFs and audio files
- Content-Type headers for various file formats

## Important Notes

### Versioning
When making changes to JS/CSS files:
1. Update version number in `index.html` script tags
2. Clear browser cache during testing
3. Deploy to Firebase for production changes

### Admin Access
Admin functionality checks are scattered throughout the codebase. Search for:
- `adminEmails.includes(currentUser.email)`
- `isAdmin()` function calls
- `userProfile.role === 'Administrador'`

### Document Paths
- All document paths in Firestore should be relative to Storage root
- Use forward slashes for paths
- Avoid spaces in filenames (use underscores or hyphens)

### Error Handling
Most async functions include try-catch blocks with user-facing error messages:
```javascript
try {
    // Firebase operation
} catch (error) {
    console.error('Error description:', error);
    showToast('User-friendly error message', 'error');
}
```

### Toast Notifications
Use `showToast(message, type)` for user feedback:
- Types: `'success'`, `'error'`, `'info'`, `'warning'`

## Testing & Debugging

### Browser Console
Check for:
- Firebase initialization: "Firebase initialized successfully"
- User authentication state
- Firestore permission errors (often indicates security rules issues)

### Common Issues
1. **Document not showing**: Check Firestore collection name and security rules
2. **PDF won't open**: Verify Storage path and CORS configuration
3. **Changes not appearing**: Clear cache or update version numbers
4. **Permission denied**: Check user role in `userProfiles` collection

### Firebase Console Access
- Project Console: https://console.firebase.google.com/project/anest-ap
- Check Firestore, Storage, Authentication, and Hosting tabs for data verification

## Backup & Recovery

Important: The repository contains extensive backup documentation in `Backups/` and numerous `*.md` implementation guides. Reference these for:
- Feature implementation history
- Bug fix documentation
- Design decision rationale
- Previous system states

## Contact & Support

- Admin Email: guilherme@anest.com.br
- Firebase Project: anest-ap
- Hosting URL: https://anest-ap.web.app
