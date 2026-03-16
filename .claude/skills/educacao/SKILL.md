---
name: educacao
description: Módulo educação continuada. Hierarquia Trilha→Curso→Módulo→Aula, CascadeCreator, ROPs quiz (600+ questões), certificados, admin 3 painéis.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Módulo Educação ANEST

## Quando Usar
Criar/editar trilhas, cursos, módulos, aulas. Trabalhar com AdminConteudoPage, CascadeCreator, ROPs quiz, certificados, educacaoService.

## Terminologia
- UI: "Treinamento" (exibido ao usuário)
- Código: `curso` (mantido para compatibilidade — NÃO renomear)

## Hierarquia
```
Trilha → Treinamento (curso) → Módulo → Aula
```
Junction tables no Firestore para relações N:N.

## Arquivos Principais
```
src/pages/educacao/
├── admin/
│   ├── AdminConteudoPage.jsx    # Layout 3 painéis (Navigator, Editor, Sidebar)
│   ├── components/
│   │   ├── CascadeCreator.jsx   # Wizard 4 steps
│   │   ├── StepAula.jsx         # Campos por tipo (video/audio/texto/quiz)
│   │   ├── EntitySelector.jsx   # Vincular entidades existentes
│   │   ├── TreeNavigator.jsx    # Árvore hierárquica
│   │   └── TrilhaBanner.jsx     # Banner com herança de imagem
├── hooks/
│   ├── useEducacaoData.js       # CRUD principal + forceRefreshFromFirestore()
│   ├── useProgressoUsuario.js
│   └── useEffectiveBanner.js    # Fallback: self→modulo→curso→trilha→default
└── utils/
    ├── visibilityUtils.js       # computeEffectiveVisibility(), canUserAccess()
    └── certificateGenerator.js
```

## Sistema de Visibilidade (CRÍTICO)
| Modo | Comportamento |
|------|---------------|
| INHERIT | Herda do pai (default para filhos) |
| PUBLIC | Visível a todos autenticados |
| RESTRICTED | Apenas allowedUserTypes |

Herança: Se toda cadeia é INHERIT → assume PUBLIC.
```javascript
import { computeEffectiveVisibility, canUserAccess } from './utils/visibilityUtils';
const { effectiveVisibility, effectiveAllowedUserTypes } =
  computeEffectiveVisibility(aula, [modulo, curso, trilha]);
```

## useEducacaoData (Hook CRUD Principal)
```javascript
const {
  trilhas, cursos, modulos, aulas, loading, error,
  addTrilha, updateTrilha, deleteTrilha,
  addCurso, updateCurso, deleteCurso,
  addModulo, updateModulo, deleteModulo,
  addAula, updateAula, deleteAula,
  getCursosByTrilha, getModulosByCursoId, getAulasByModuloId,
  buildContentTree, refreshData, forceRefreshFromFirestore,
} = useEducacaoData({ useMock: false, autoFetch: true });
```

## CascadeCreator — Wizard 4 Steps
1. StepTrilha → 2. StepTreinamento → 3. StepModulo → 4. StepAula
- Persistência localStorage (continuar sessão)
- EntitySelector para vincular entidades existentes
- CascadeSummary ao final

## StepAula — Campos por Tipo
| Tipo | Campos |
|------|--------|
| video | URL YouTube |
| texto | Rich-text editor |
| audio | URL arquivo |
| quiz | Banco de questões |

## TrilhaBanner e useEffectiveBanner
```jsx
<TrilhaBanner entity={aula} ancestry={[modulo, curso, trilha]} />
// sourceLevel: 'self' | 'modulo' | 'curso' | 'trilha' | 'default'
```

## ROPs Quiz
- 6 macro áreas, 26 subdivisões, 600+ questões
- Ranking por pontuação
- Service: `src/services/supabaseRopsQuizService.js`

## Certificados
- UUID único + QR Code
- Rota pública: `/verificar/:uuid` (sem auth)
- Generator: `src/pages/educacao/utils/certificateGenerator.js`

## Gotchas
- TIPOS_USUARIO: aceitar variações de case na normalização
- Student-safe queries: SEM junction tables no client, filtro client-side
- FormField + Fragment: usar `<div>` wrapper, NUNCA `<>`
- FileUpload: prop `onChange` (NÃO `onFileSelect`)

## Integrações
- UserContext → visibilidade por tipo
- Certificados → deep-link público
- Comunicados → notificações educação
- Centro de Gestão → aba Residência
