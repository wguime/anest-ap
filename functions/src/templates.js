/**
 * Templates de notificação para lembretes de escala.
 */

const HOSPITAL_LABELS = {
  hro: 'HRO',
  unimed: 'UNIMED',
  plantao_pago: 'Plantão Pago',
};

const TURNO_LABELS = {
  manha: '07h–15h',
  tarde: '15h–23h',
};

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildSobreavisoReminder(horizonte, dataKey) {
  const dataBR = formatDateBR(dataKey);
  if (horizonte === 'd-1') {
    return {
      subject: 'Lembrete: seu sobreaviso é amanhã',
      content: `Você está escalada para sobreaviso materno em ${dataBR} (19h às 07h).`,
    };
  }
  return {
    subject: 'Hoje você está de sobreaviso',
    content: `Sobreaviso materno hoje, ${dataBR}, das 19h às 07h.`,
  };
}

function buildHospitalReminder(horizonte, dataKey, hospital, turno) {
  const dataBR = formatDateBR(dataKey);
  const h = HOSPITAL_LABELS[hospital] || hospital;
  const t = TURNO_LABELS[turno] || turno;
  if (horizonte === 'd-1') {
    return {
      subject: `Lembrete: plantão ${h} amanhã`,
      content: `Você está escalada para ${h} (${t}) em ${dataBR}.`,
    };
  }
  return {
    subject: `Hoje você tem plantão ${h}`,
    content: `${h} ${t} hoje, ${dataBR}.`,
  };
}

module.exports = {
  buildSobreavisoReminder,
  buildHospitalReminder,
  HOSPITAL_LABELS,
  TURNO_LABELS,
};
