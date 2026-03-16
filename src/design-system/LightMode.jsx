// ============================================
// ANEST DESIGN SYSTEM - LIGHT MODE
// Arquivo de referência visual
// ============================================
// Este arquivo é o modelo EXATO do tema claro
// Use como referência para criar novas páginas
// ============================================

import { useState, useEffect } from 'react';

export default function LightMode() {
  const [isLoading, setIsLoading] = useState(true);
  const [pressedCard, setPressedCard] = useState(null);
  const [pressedAtalho, setPressedAtalho] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // ============================================
  // TOKENS - LIGHT MODE
  // ============================================
  const colors = {
    // Fundos
    greenPale: '#F0FFF4',      // Fundo principal
    white: '#FFFFFF',          // Cards
    cardLight: '#D4EDDA',      // Card destaque (comunicados)
    cardAccent: '#C8E6C9',     // Bordas
    
    // Verdes Institucionais
    greenDarkest: '#002215',   // Texto principal verde
    greenDark: '#004225',      // Botões, badges, avatar
    greenMedium: '#006837',    // Ícones, links
    greenBright: '#2E8B57',    // Destaques
    greenLight: '#9BC53D',     // Horários
    
    // Textos
    black: '#000000',          // Títulos
    gray: '#6B7280',           // Subtítulos
    grayMedium: '#9CA3AF',     // Placeholders
    grayLight: '#F3F4F6',      // Divisores, backgrounds
    
    // Estados
    red: '#DC2626',            // Notificações
  };

  // ============================================
  // DADOS DE EXEMPLO
  // ============================================
  const plantoes = [
    { hospital: 'Hospital Santa Casa', data: 'Segunda, 16 Dez', hora: '07:00', bg: '#B8E0C8' },
    { hospital: 'Hospital São Lucas', data: 'Terça, 17 Dez', hora: '19:00', bg: '#A8D5BA' },
    { hospital: 'Hospital Regional', data: 'Quinta, 19 Dez', hora: '07:00', bg: '#C5E8D5' },
    { hospital: 'Hospital Municipal', data: 'Sábado, 21 Dez', hora: '13:00', bg: '#D4EDDA' },
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
    .fade-in { animation: fadeIn 0.4s ease forwards; }
    .card-press { transition: transform 0.15s ease; }
    .card-press:active { transform: scale(0.97); }
  `;

  // ============================================
  // COMPONENTE SKELETON
  // ============================================
  const Skeleton = ({ width, height, borderRadius = 8 }) => (
    <div style={{
      width, height, borderRadius,
      background: `linear-gradient(90deg, ${colors.grayLight} 25%, #E5E7EB 50%, ${colors.grayLight} 75%)`,
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
        background: '#E5E7EB',
        padding: '16px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}>
        <div style={{ width: '100%', maxWidth: '390px' }}>
          
          {/* ============================================ */}
          {/* PHONE FRAME */}
          {/* ============================================ */}
          <div style={{
            background: colors.greenDark,
            borderRadius: '48px',
            padding: '12px',
            boxShadow: '0 30px 60px rgba(0,66,37,0.4)',
          }}>
            
            {/* SCREEN */}
            <div style={{
              background: colors.greenPale,
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
                color: colors.greenDark,
              }}>
                <span>9:41</span>
                <div style={{ width: '90px', height: '32px', background: colors.greenDark, borderRadius: '20px' }} />
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={colors.greenDark}>
                    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                  </svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={colors.greenDark}>
                    <rect x="2" y="7" width="18" height="12" rx="2" stroke={colors.greenDark} strokeWidth="2" fill="none"/>
                    <rect x="4" y="9" width="13" height="8" rx="1" fill={colors.greenDark}/>
                    <rect x="20" y="10" width="2" height="6" rx="1" fill={colors.greenDark}/>
                  </svg>
                </div>
              </div>

              {/* ============================================ */}
              {/* SCROLLABLE CONTENT */}
              {/* ============================================ */}
              <div style={{ padding: '24px 20px 100px', height: 'calc(100% - 50px)', overflowY: 'auto' }}>
                
                {/* ============================================ */}
                {/* HEADER */}
                {/* Specs: fontSize 20px, fontWeight 700, marginBottom 24px */}
                {/* ============================================ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }} className="fade-in">
                  <p style={{ fontSize: '20px', color: colors.greenDark, margin: 0, fontWeight: 700 }}>
                    Olá, Dr. João
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* NOTIFICATION BELL - 44x44px */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', background: colors.white,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,66,37,0.1)', cursor: 'pointer', position: 'relative',
                    }} className="card-press">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.greenDark} strokeWidth="2">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 01-3.46 0"/>
                      </svg>
                      {/* BADGE - minWidth 22px, height 22px, borderRadius 11px */}
                      <div style={{
                        position: 'absolute', top: '-4px', right: '-4px', minWidth: '22px', height: '22px',
                        borderRadius: '11px', background: colors.red, color: colors.white, fontSize: '12px',
                        fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${colors.greenPale}`, padding: '0 5px',
                      }}>5</div>
                    </div>
                    
                    {/* AVATAR - 52x52px */}
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${colors.greenDark} 0%, ${colors.greenMedium} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: colors.white, fontWeight: 700, fontSize: '19px',
                      boxShadow: '0 4px 16px rgba(0,66,37,0.3)',
                    }} className="card-press">JM</div>
                  </div>
                </div>

                {/* ============================================ */}
                {/* SEARCH BAR */}
                {/* Specs: borderRadius 16px, padding 16px 18px, marginBottom 24px */}
                {/* ============================================ */}
                <div style={{
                  background: colors.white, borderRadius: '16px', padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  boxShadow: '0 2px 12px rgba(0,66,37,0.08)', border: `1px solid ${colors.cardAccent}`,
                  marginBottom: '24px',
                }} className="fade-in card-press">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.greenMedium} strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span style={{ color: colors.gray, fontSize: '16px' }}>Buscar...</span>
                </div>

                {/* ============================================ */}
                {/* CARD COMUNICADOS */}
                {/* Specs: background cardLight, borderRadius 20px, padding 20px */}
                {/* ============================================ */}
                <div style={{ marginBottom: '20px' }} className="fade-in">
                  <div style={{
                    background: colors.cardLight, borderRadius: '20px', padding: '20px',
                    cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,66,37,0.08)',
                    transform: pressedCard === 'comunicados' ? 'scale(0.99)' : 'scale(1)',
                    transition: 'transform 0.2s ease',
                  }}
                    onMouseDown={() => setPressedCard('comunicados')}
                    onMouseUp={() => setPressedCard(null)}
                    onMouseLeave={() => setPressedCard(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        {/* Label: fontSize 12px, uppercase */}
                        <p style={{ fontSize: '12px', fontWeight: 500, color: colors.greenMedium, margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Últimos</p>
                        {/* Title: fontSize 20px, fontWeight 700 */}
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.greenDarkest, margin: 0 }}>Comunicados</h2>
                      </div>
                      {/* Badge: fontSize 11px, borderRadius 10px */}
                      <span style={{ background: colors.greenDark, color: colors.white, fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '10px' }}>3 novos</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                      {['Novo protocolo de sedação pediátrica', 'Atualização da escala de dezembro'].map((text, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Bullet: 6x6px */}
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.greenMedium, flexShrink: 0 }} />
                          <p style={{ fontSize: '14px', color: colors.greenDarkest, margin: 0, fontWeight: 500 }}>{text}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: colors.greenMedium, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ver todos
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.greenMedium} strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ============================================ */}
                {/* ATALHOS RÁPIDOS */}
                {/* Specs: card branco, borderRadius 20px, círculos 54x54px */}
                {/* ============================================ */}
                <div style={{ background: colors.white, borderRadius: '20px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,66,37,0.06)' }} className="fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.black, margin: 0 }}>Atalhos Rápidos</h3>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: colors.greenMedium, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.greenMedium} strokeWidth="2">
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
                          background: item.destaque ? `linear-gradient(135deg, ${colors.greenMedium} 0%, ${colors.greenDark} 100%)` : colors.greenDark,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: item.destaque ? '0 6px 16px rgba(0,66,37,0.4)' : '0 4px 12px rgba(0,66,37,0.25)',
                          border: item.destaque ? `2px solid ${colors.greenLight}` : 'none',
                          transform: pressedAtalho === i ? 'scale(0.92)' : 'scale(1)',
                          transition: 'transform 0.15s ease',
                        }}
                          onMouseDown={() => setPressedAtalho(i)}
                          onMouseUp={() => setPressedAtalho(null)}
                          onMouseLeave={() => setPressedAtalho(null)}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                            {i === 0 && <><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="4" width="12" height="5" rx="1"/><circle cx="8" cy="12" r="1" fill="white"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="16" cy="12" r="1" fill="white"/><circle cx="8" cy="16" r="1" fill="white"/><circle cx="12" cy="16" r="1" fill="white"/><circle cx="16" cy="16" r="1" fill="white"/></>}
                            {i === 1 && <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></>}
                            {i === 2 && <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>}
                            {i === 3 && <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>}
                          </svg>
                        </div>
                        {/* Label: fontSize 10px */}
                        <span style={{ fontSize: '10px', fontWeight: 500, color: colors.gray, textAlign: 'center' }}>{item.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ============================================ */}
                {/* LISTA PLANTÕES */}
                {/* Specs: card branco, borderRadius 20px, ícone 48x48px borderRadius 12px */}
                {/* ============================================ */}
                <div style={{ background: colors.white, borderRadius: '20px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,66,37,0.06)' }} className="fade-in">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.black, margin: '0 0 16px 0' }}>Plantões</h3>
                  {plantoes.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0',
                      borderBottom: i < plantoes.length - 1 ? `1px solid ${colors.grayLight}` : 'none',
                    }}>
                      {/* Icon container: 48x48px, borderRadius 12px */}
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.greenDark} strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        {/* Title: fontSize 15px, fontWeight 600 */}
                        <p style={{ fontSize: '15px', fontWeight: 600, color: colors.black, margin: 0 }}>{item.hospital}</p>
                        {/* Subtitle: fontSize 13px */}
                        <p style={{ fontSize: '13px', color: colors.grayMedium, margin: '2px 0 0 0' }}>{item.data}</p>
                      </div>
                      {/* Value: fontSize 15px, fontWeight 700, greenLight */}
                      <span style={{ fontSize: '15px', fontWeight: 700, color: colors.greenLight }}>{item.hora}</span>
                    </div>
                  ))}
                </div>

                {/* ============================================ */}
                {/* LISTA FÉRIAS */}
                {/* ============================================ */}
                <div style={{ background: colors.white, borderRadius: '20px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,66,37,0.06)' }} className="fade-in">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.black, margin: '0 0 16px 0' }}>Férias Programadas</h3>
                  {ferias.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0',
                      borderBottom: i < ferias.length - 1 ? `1px solid ${colors.grayLight}` : 'none',
                    }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: colors.grayLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: colors.black, margin: 0 }}>{item.nome}</p>
                        <p style={{ fontSize: '13px', color: colors.grayMedium, margin: '2px 0 0 0' }}>{item.periodo}</p>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* ============================================ */}
              {/* BOTTOM NAVIGATION */}
              {/* Specs: padding 16px 40px 36px, ícones 28x28px */}
              {/* ============================================ */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: colors.white, borderTop: `1px solid ${colors.cardAccent}`,
                padding: '16px 40px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                {/* Ativo: fill com greenMedium */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill={colors.greenMedium}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                {/* Inativo: stroke com gray */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              </div>
            </div>
          </div>

          {/* Caption */}
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', fontWeight: 700, color: colors.greenDark, margin: '0 0 6px 0' }}>ANEST - Light Mode</p>
            <p style={{ fontSize: '13px', color: colors.gray, margin: 0 }}>Arquivo de referência do Design System</p>
          </div>
        </div>
      </div>
    </>
  );
}
