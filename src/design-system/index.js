// ANEST Design System v3.0
// Exports centralizados

// Hooks
export { useTheme, ThemeProvider } from './hooks';

// Utilitários
export * from './utils';

// Componentes
export * from './components';
// (Feedback components estão dentro de `components/ui` e entram aqui via export * acima.)

// Tokens (JSON)
export { default as tokens } from './Tokens.json';

// Showcases (Documentação Visual) — NÃO re-exportar via barrel para evitar
// que o `PagesShowcase` (que importa `../../pages`) puxe todas as páginas pro
// main bundle. Consumir via path direto se necessário em dev:
//   import { ShowcaseIndex } from '@/design-system/showcase';
//   import { ColorPalette } from '@/design-system/showcase/ColorPalette';

