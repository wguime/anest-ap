/**
 * Wave 1.4 T1.4.2: helpers de expiração de certificado.
 */

export function parseExpiracaoDate(validoAte) {
  if (!validoAte) return null;
  if (validoAte instanceof Date) return validoAte;
  if (typeof validoAte?.toDate === 'function') return validoAte.toDate();
  if (typeof validoAte?.seconds === 'number') return new Date(validoAte.seconds * 1000);
  if (typeof validoAte === 'string') {
    const d = new Date(validoAte);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function getDiasParaExpirar(validoAte, hoje = new Date()) {
  const fim = parseExpiracaoDate(validoAte);
  if (!fim) return null;
  const ms = fim.getTime() - hoje.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function getExpiracaoStatus(validoAte, hoje = new Date()) {
  const dias = getDiasParaExpirar(validoAte, hoje);
  if (dias === null) return { status: 'sem-expiracao', dias: null };
  if (dias < 0) return { status: 'expirado', dias };
  if (dias <= 7) return { status: 'critico', dias };
  if (dias <= 30) return { status: 'atencao', dias };
  return { status: 'valido', dias };
}

/**
 * Filtra certificados que merecem alerta de UI (expirados, críticos, atenção).
 */
export function getCertificadosComAlertaExpiracao(certificados, hoje = new Date()) {
  return (certificados || [])
    .filter((c) => c?.emitido && c?.validoAte)
    .map((c) => {
      const { status, dias } = getExpiracaoStatus(c.validoAte, hoje);
      return { ...c, expiracaoStatus: status, diasParaExpirar: dias };
    })
    .filter((c) => c.expiracaoStatus !== 'valido' && c.expiracaoStatus !== 'sem-expiracao')
    .sort((a, b) => (a.diasParaExpirar ?? 0) - (b.diasParaExpirar ?? 0));
}
