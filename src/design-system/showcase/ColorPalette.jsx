// ColorPalette.jsx
// Showcase visual de todas as cores do Design System ANEST

import { useTheme } from '../hooks/useTheme.jsx';

// ============================================================================
// DEFINIÇÃO DAS CORES - Extraídas do Tokens.json
// ============================================================================

const LIGHT_COLORS = {
  background: [
    { name: 'Background Primary', value: '#F0FFF4', token: 'bg-primary' },
    { name: 'Background Card', value: '#FFFFFF', token: 'bg-card' },
    { name: 'Card Highlight', value: '#D4EDDA', token: 'card-highlight' },
    { name: 'Card Accent', value: '#C8E6C9', token: 'card-accent' },
  ],
  green: [
    { name: 'Green Darkest', value: '#002215', token: 'green-darkest' },
    { name: 'Green Dark', value: '#004225', token: 'green-dark' },
    { name: 'Green Medium', value: '#006837', token: 'green-medium' },
    { name: 'Green Bright', value: '#2E8B57', token: 'green-bright' },
    { name: 'Green Light', value: '#9BC53D', token: 'green-light' },
  ],
  text: [
    { name: 'Text Primary', value: '#000000', token: 'text-primary' },
    { name: 'Text Secondary', value: '#6B7280', token: 'text-secondary' },
    { name: 'Text Muted', value: '#9CA3AF', token: 'text-muted' },
  ],
  border: [
    { name: 'Border Default', value: '#C8E6C9', token: 'border' },
    { name: 'Border Divider', value: '#F3F4F6', token: 'border-divider' },
  ],
  status: [
    { name: 'Error', value: '#DC2626', token: 'status-error' },
    { name: 'Warning', value: '#F59E0B', token: 'status-warning' },
    { name: 'Success', value: '#34C759', token: 'status-success' },
    { name: 'Info', value: '#007AFF', token: 'status-info' },
  ],
};

const DARK_COLORS = {
  background: [
    { name: 'Background Primary', value: '#111916', token: 'bg-primary' },
    { name: 'Background Darkest', value: '#0A0F0D', token: 'bg-darkest' },
    { name: 'Background Card', value: '#1A2420', token: 'bg-card' },
    { name: 'Card Hover', value: '#212D28', token: 'card-hover' },
    { name: 'Card Light', value: '#243530', token: 'card-light' },
  ],
  green: [
    { name: 'Green Primary', value: '#2ECC71', token: 'green-primary' },
    { name: 'Green Light', value: '#58D68D', token: 'green-light' },
    { name: 'Green Muted', value: '#1E8449', token: 'green-muted' },
    { name: 'Green Dark', value: '#145A32', token: 'green-dark' },
  ],
  text: [
    { name: 'Text Primary', value: '#FFFFFF', token: 'text-primary' },
    { name: 'Text Secondary', value: '#A3B8B0', token: 'text-secondary' },
    { name: 'Text Muted', value: '#6B8178', token: 'text-muted' },
  ],
  border: [
    { name: 'Border Default', value: '#2A3F36', token: 'border' },
    { name: 'Border Light', value: '#344840', token: 'border-light' },
  ],
  status: [
    { name: 'Error', value: '#E74C3C', token: 'status-error' },
    { name: 'Warning', value: '#F39C12', token: 'status-warning' },
    { name: 'Success', value: '#2ECC71', token: 'status-success' },
    { name: 'Info', value: '#3498DB', token: 'status-info' },
  ],
};

// ============================================================================
// COMPONENTES
// ============================================================================

function ColorSwatch({ name, value, token }) {
  const { isDark } = useTheme();

  // Copiar cor para clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      // Fallback silencioso
    }
  };

  return (
    <div
      onClick={handleCopy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: isDark ? '#1A2420' : '#FFFFFF',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#2A3F36' : '#E5E7EB'}`,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = isDark
          ? '0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,66,37,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title="Clique para copiar"
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          background: value,
          border: '1px solid rgba(0,0,0,0.1)',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: isDark ? '#FFFFFF' : '#000000',
            marginBottom: '2px',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: isDark ? '#6B8178' : '#6B7280',
            fontFamily: 'monospace',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: isDark ? '#4A5B54' : '#9CA3AF',
          }}
        >
          {token}
        </div>
      </div>
    </div>
  );
}

function ColorSection({ title, colors }) {
  const { isDark } = useTheme();

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: '16px',
          color: isDark ? '#FFFFFF' : '#000000',
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {colors.map((color, i) => (
          <ColorSwatch key={i} {...color} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function ColorPalette() {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <div
      style={{
        padding: '24px',
        background: isDark ? '#111916' : '#F0FFF4',
        minHeight: '100vh',
        color: isDark ? '#FFFFFF' : '#000000',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2
        style={{
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '8px',
        }}
      >
        🎨 Color Palette
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: isDark ? '#A3B8B0' : '#6B7280',
          marginBottom: '32px',
        }}
      >
        {isDark ? 'Dark Mode' : 'Light Mode'} - Cores oficiais do ANEST Design
        System. Clique para copiar.
      </p>

      <ColorSection title="🖼️ Background" colors={colors.background} />
      <ColorSection title="🌿 Green (Institucional)" colors={colors.green} />
      <ColorSection title="📝 Text" colors={colors.text} />
      <ColorSection title="📦 Border" colors={colors.border} />
      <ColorSection title="⚡ Status" colors={colors.status} />
    </div>
  );
}

export default ColorPalette;

