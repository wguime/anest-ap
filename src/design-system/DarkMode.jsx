// ============================================
// ANEST DESIGN SYSTEM - DARK MODE
// Arquivo de referência visual
// ============================================
// Este arquivo é o modelo EXATO do tema escuro
// Use como referência para criar novas páginas
// ============================================

import { useState, useEffect } from 'react';

export default function DarkMode() {
  const [isLoading, setIsLoading] = useState(true);
  const [pressedCard, setPressedCard] = useState(null);
  const [pressedAtalho, setPressedAtalho] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // ============================================
  // TOKENS - DARK MODE
  // ============================================
  const colors = {
    // Fundos escuros
    bgDarkest: '#0A0F0D',      // Fundo mais escuro (dynamic island)
    bgDark: '#111916',         // Fundo principal
    bgCard: '#1A2420',         // Cards
    bgCardHover: '#212D28',    // Card hover
    bgCardLight: '#243530',    // Cards secundários, ícones
    
    // Verdes (mais vibrantes para contraste)
    greenPrimary: '#2ECC71',   // Verde principal, destaques
    greenLight: '#58D68D',     // Verde claro
    greenMuted: '#1E8449',     // Verde médio
    greenDark: '#145A32',      // Verde escuro
    greenGlow: 'rgba(46, 204, 113, 0.15)', // Efeito glow
    
    // Textos
    textPrimary: '#FFFFFF',    // Títulos
    textSecondary: '#A3B8B0',  // Subtítulos
    textMuted: '#6B8178',      // Placeholders
    
    // Bordas e divisores
    border: '#2A3F36',
    borderLight: '#344840',
    
    // Estados
    red: '#E74C3C',
    redGlow: 'rgba(231, 76, 60, 0.2)',
    orange: '#F39C12',
  };

  // ============================================
  // DADOS DE EXEMPLO
  // ============================================
  const plantoes = [
    { hospital: 'Hospital Santa Casa', data: 'Segunda, 16 Dez', hora: '07:00' },
    { hospital: 'Hospital São Lucas', data: 'Terça, 17 Dez', hora: '19:00' },
    { hospital: 'Hospital Regional', data: 'Quinta, 19 Dez', hora: '07:00' },
    { hospital: 'Hospital Municipal', data: 'Sábado, 21 Dez', hora: '13:00' },
  ];

  const ferias = [
    { nome: 'Dr. Carlos Silva', periodo: '20/12 - 05/01' },
    { nome: 'Dra. Ana Costa', periodo: '23/12 - 10/01' },
    { nome: 'Dr. Pedro Santos', periodo: '26/12 - 08/01' },
    { nome: 'Dra. Maria Oliveira', periodo: '27/12 - 12/01' },
    { nome: 'Dr. João Ferreira', periodo: '30/12 - 15/01' },
    { nome: 'Dra. Paula Mendes', periodo: '02/01 - 18/01' },
  ];

  const atalhos = [
    { nome: 'Calculadoras', destaque: true },
    { nome: 'Reportar', destaque: false },
    { nome: 'Manutenção', destaque: false },
    { nome: 'Desafio ROPs', destaque: false },
  ];

  // ============================================
  // ANIMAÇÕES
  // ============================================
  const styles = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 20px rgba(46, 204, 113, 0.3); }
      50% { box-shadow: 0 0 30px rgba(46, 204, 113, 0.5); }
    }
    .fade-in { animation: fadeIn 0.4s ease forwards; }
    .card-press { transition: transform 0.15s ease, background 0.15s ease; }
    .card-press:active { transform: scale(0.97); }
  `;

  // ============================================
  // COMPONENTE SKELETON (Dark)
  // ============================================
  const Skeleton = ({ width, height, borderRadius = 8 }) => (
    <div style={{
      width, height, borderRadius,
      background: `linear-gradient(90deg, ${colors.bgCard} 25%, ${colors.bgCardHover} 50%, ${colors.bgCard} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <style>{styles}</style>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#000',
        padding: '16px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}>
        <div style={{ width: '100%', maxWidth: '390px' }}>
          
          {/* ============================================ */}
          {/* PHONE FRAME */}
          {/* Dark: gradiente verde escuro + glow */}
          {/* ============================================ */}
          <div style={{
            background: `linear-gradient(145deg, ${colors.greenDark} 0%, ${colors.bgDarkest} 100%)`,
            borderRadius: '48px',
            padding: '12px',
            boxShadow: `0 30px 60px rgba(0,0,0,0.8), 0 0 40px ${colors.greenGlow}`,
          }}>
            
            {/* SCREEN */}
            <div style={{
              background: colors.bgDark,
              borderRadius: '40px',
              height: '844px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              
              {/* ============================================ */}
              {/* STATUS BAR */}
              {/* ============================================ */}
              <div style={{
                padding: '14px 28px 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '15px',
                fontWeight: 600,
                color: colors.textPrimary,
              }}>
                <span>9:41</span>
                <div style={{ width: '90px', height: '32px', background: colors.bgDarkest, borderRadius: '20px' }} />
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={colors.textPrimary}>
                    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                  </svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={colors.textPrimary}>
                    <rect x="2" y="7" width="18" height="12" rx="2" stroke={colors.textPrimary} strokeWidth="2" fill="none"/>
                    <rect x="4" y="9" width="13" height="8" rx="1" fill={colors.greenPrimary}/>
                    <rect x="20" y="10" width="2" height="6" rx="1" fill={colors.textPrimary}/>
                  </svg>
                </div>
              </div>

              {/* ============================================ */}
              {/* SCROLLABLE CONTENT */}
              {/* ============================================ */}
              <div style={{ padding: '24px 20px 100px', height: 'calc(100% - 50px)', overflowY: 'auto' }}>
                
                {/* ============================================ */}
                {/* HEADER */}
                {/* ============================================ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }} className="fade-in">
                  <p style={{ fontSize: '20px', color: colors.textPrimary, margin: 0, fontWeight: 700 }}>
                    Olá, Dr. João
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* NOTIFICATION BELL */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', 
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
                      cursor: 'pointer', position: 'relative',
                    }} className="card-press">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.greenPrimary} strokeWidth="2">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 01-3.46 0"/>
                      </svg>
                      {/* BADGE com glow */}
                      <div style={{
                        position: 'absolute', top: '-4px', right: '-4px', minWidth: '22px', height: '22px',
                        borderRadius: '11px', background: colors.red, color: colors.textPrimary, fontSize: '12px',
                        fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${colors.bgDark}`, padding: '0 5px',
                        boxShadow: `0 0 10px ${colors.redGlow}`,
                      }}>5</div>
                    </div>
                    
                    {/* AVATAR com glow verde */}
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${colors.greenPrimary} 0%, ${colors.greenMuted} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: colors.bgDarkest, fontWeight: 700, fontSize: '19px',
                      boxShadow: `0 4px 20px rgba(46, 204, 113, 0.4)`,
                    }} className="card-press">JM</div>
                  </div>
                </div>

                {/* ============================================ */}
                {/* SEARCH BAR */}
                {/* Dark: sem shadow, com border */}
                {/* ============================================ */}
                <div style={{
                  background: colors.bgCard, borderRadius: '16px', padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  border: `1px solid ${colors.border}`,
                  marginBottom: '24px',
                }} className="fade-in card-press">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.greenPrimary} strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span style={{ color: colors.textMuted, fontSize: '16px' }}>Buscar...</span>
                </div>

                {/* ============================================ */}
                {/* CARD COMUNICADOS */}
                {/* Dark: background bgCard, border, sem shadow */}
                {/* ============================================ */}
                <div style={{ marginBottom: '20px' }} className="fade-in">
                  <div style={{
                    background: colors.bgCard, 
                    borderRadius: '20px', 
                    padding: '20px',
                    cursor: 'pointer', 
                    border: `1px solid ${colors.border}`,
                    transform: pressedCard === 'comunicados' ? 'scale(0.99)' : 'scale(1)',
                    transition: 'transform 0.2s ease',
                  }}
                    onMouseDown={() => setPressedCard('comunicados')}
                    onMouseUp={() => setPressedCard(null)}
                    onMouseLeave={() => setPressedCard(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 500, color: colors.greenPrimary, margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Últimos</p>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary, margin: 0 }}>Comunicados</h2>
                      </div>
                      {/* Badge com gradiente e glow */}
                      <span style={{ 
                        background: `linear-gradient(135deg, ${colors.greenPrimary} 0%, ${colors.greenMuted} 100%)`, 
                        color: colors.bgDarkest, 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '5px 10px', 
                        borderRadius: '10px',
                        boxShadow: `0 2px 10px ${colors.greenGlow}`,
                      }}>3 novos</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                      {['Novo protocolo de sedação pediátrica', 'Atualização da escala de dezembro'].map((text, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Bullet com glow */}
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.greenPrimary, flexShrink: 0, boxShadow: `0 0 6px ${colors.greenPrimary}` }} />
                          <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0, fontWeight: 500 }}>{text}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: colors.greenPrimary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ver todos
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.greenPrimary} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ============================================ */}
                {/* ATALHOS RÁPIDOS */}
                {/* ============================================ */}
                <div style={{ 
                  background: colors.bgCard, 
                  borderRadius: '20px', 
                  padding: '20px', 
                  marginBottom: '16px', 
                  border: `1px solid ${colors.border}`,
                }} className="fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.textPrimary, margin: 0 }}>Atalhos Rápidos</h3>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: colors.greenPrimary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.greenPrimary} strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                      </svg>
                      Personalizar
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {atalhos.map((item, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', width: '70px' }}>
                        <div style={{
                          width: '54px', height: '54px', borderRadius: '50%',
                          background: item.destaque 
                            ? `linear-gradient(135deg, ${colors.greenPrimary} 0%, ${colors.greenMuted} 100%)` 
                            : colors.bgCardLight,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: item.destaque 
                            ? `0 6px 20px rgba(46, 204, 113, 0.4)` 
                            : '0 4px 12px rgba(0,0,0,0.3)',
                          border: item.destaque ? 'none' : `1px solid ${colors.border}`,
                          transform: pressedAtalho === i ? 'scale(0.92)' : 'scale(1)',
                          transition: 'transform 0.15s ease',
                        }}
                          onMouseDown={() => setPressedAtalho(i)}
                          onMouseUp={() => setPressedAtalho(null)}
                          onMouseLeave={() => setPressedAtalho(null)}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={item.destaque ? colors.bgDarkest : colors.greenPrimary} strokeWidth="1.5">
                            {i === 0 && <><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="4" width="12" height="5" rx="1"/><circle cx="8" cy="12" r="1" fill={item.destaque ? colors.bgDarkest : colors.greenPrimary}/><circle cx="12" cy="12" r="1" fill={item.destaque ? colors.bgDarkest : colors.greenPrimary}/><circle cx="16" cy="12" r="1" fill={item.destaque ? colors.bgDarkest : colors.greenPrimary}/><circle cx="8" cy="16" r="1" fill={item.destaque ? colors.bgDarkest : colors.greenPrimary}/><circle cx="12" cy="16" r="1" fill={item.destaque ? colors.bgDarkest : colors.greenPrimary}/><circle cx="16" cy="16" r="1" fill={item.destaque ? colors.bgDarkest : colors.greenPrimary}/></>}
                            {i === 1 && <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></>}
                            {i === 2 && <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>}
                            {i === 3 && <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>}
                          </svg>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 500, color: colors.textMuted, textAlign: 'center' }}>{item.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ============================================ */}
                {/* LISTA PLANTÕES */}
                {/* ============================================ */}
                <div style={{ 
                  background: colors.bgCard, 
                  borderRadius: '20px', 
                  padding: '20px', 
                  marginBottom: '16px', 
                  border: `1px solid ${colors.border}`,
                }} className="fade-in">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.textPrimary, margin: '0 0 16px 0' }}>Plantões</h3>
                  {plantoes.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0',
                      borderBottom: i < plantoes.length - 1 ? `1px solid ${colors.border}` : 'none',
                    }}>
                      <div style={{ 
                        width: '48px', height: '48px', borderRadius: '12px', 
                        background: colors.bgCardLight, 
                        border: `1px solid ${colors.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.greenPrimary} strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary, margin: 0 }}>{item.hospital}</p>
                        <p style={{ fontSize: '13px', color: colors.textMuted, margin: '2px 0 0 0' }}>{item.data}</p>
                      </div>
                      {/* Horário com glow sutil */}
                      <span style={{ 
                        fontSize: '15px', 
                        fontWeight: 700, 
                        color: colors.greenPrimary,
                        textShadow: `0 0 10px ${colors.greenGlow}`,
                      }}>{item.hora}</span>
                    </div>
                  ))}
                </div>

                {/* ============================================ */}
                {/* LISTA FÉRIAS */}
                {/* ============================================ */}
                <div style={{ 
                  background: colors.bgCard, 
                  borderRadius: '20px', 
                  padding: '20px', 
                  marginBottom: '20px', 
                  border: `1px solid ${colors.border}`,
                }} className="fade-in">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.textPrimary, margin: '0 0 16px 0' }}>Férias Programadas</h3>
                  {ferias.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0',
                      borderBottom: i < ferias.length - 1 ? `1px solid ${colors.border}` : 'none',
                    }}>
                      <div style={{ 
                        width: '48px', height: '48px', borderRadius: '12px', 
                        background: colors.bgCardLight, 
                        border: `1px solid ${colors.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary, margin: 0 }}>{item.nome}</p>
                        <p style={{ fontSize: '13px', color: colors.textMuted, margin: '2px 0 0 0' }}>{item.periodo}</p>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* ============================================ */}
              {/* BOTTOM NAVIGATION */}
              {/* ============================================ */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: colors.bgCard, 
                borderTop: `1px solid ${colors.border}`,
                padding: '16px 40px 36px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
              }}>
                {/* Ativo: fill com greenPrimary */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill={colors.greenPrimary}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                {/* Inativo: stroke com textMuted */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              </div>
            </div>
          </div>

          {/* Caption */}
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', fontWeight: 700, color: colors.greenPrimary, margin: '0 0 6px 0' }}>ANEST - Dark Mode</p>
            <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0 }}>Arquivo de referência do Design System</p>
          </div>
        </div>
      </div>
    </>
  );
}
