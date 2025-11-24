// ==================== TABELA DE DOSES PARA ADULTOS ====================
// Baseado em evidências e guidelines anestesiológicos

const dosesAdultosData = [
    // INDUÇÃO ANESTÉSICA
    {
        droga: 'Propofol',
        categoria: 'Indução',
        dose: '1.5-2.5 mg/kg',
        observacoes: 'Reduzir em idosos (1-1.5 mg/kg). Infusão: 50-200 mcg/kg/min',
        alertas: '⚠️ Hipotensão dose-dependente. Reduzir dose em choque'
    },
    {
        droga: 'Etomidato',
        categoria: 'Indução',
        dose: '0.2-0.3 mg/kg',
        observacoes: 'Estabilidade hemodinâmica. Evitar infusão contínua',
        alertas: '⚠️ Supressão adrenal. Mioclonias. Dor à injeção'
    },
    {
        droga: 'Cetamina',
        categoria: 'Indução',
        dose: '1-2 mg/kg IV (indução), 0.2-0.5 mg/kg (analgesia)',
        observacoes: 'Mantém drive respiratório. Analgesia: 10-20mg bolus',
        alertas: '⚠️ Evitar em HIC, IAM recente. Sialorréia, alucinações'
    },
    {
        droga: 'Tiopental',
        categoria: 'Indução',
        dose: '3-5 mg/kg',
        observacoes: 'Neuroprotetor. Raramente usado hoje',
        alertas: '⚠️ Hipotensão, depressão miocárdica. Porfiria contraindicada'
    },
    {
        droga: 'Midazolam',
        categoria: 'Indução/Sedação',
        dose: '0.05-0.1 mg/kg (indução), 1-2mg (sedação)',
        observacoes: 'Pré-med: 1-2mg IV. Reversível com flumazenil',
        alertas: '⚠️ Depressão respiratória. Paradoxal em idosos'
    },
    
    // MANUTENÇÃO INALATÓRIA
    {
        droga: 'Sevoflurano',
        categoria: 'Manutenção',
        dose: '1-2% (1-2 CAM)',
        observacoes: 'Indução inalatória: 8%. CAM: 2.05%. Onset rápido',
        alertas: '⚠️ Composto A em baixo fluxo. Seguro em pediatria'
    },
    {
        droga: 'Desflurano',
        categoria: 'Manutenção',
        dose: '4-8% (0.5-1 CAM)',
        observacoes: 'CAM: 6%. Despertar rápido. Vaporizador especial',
        alertas: '⚠️ Irritante vias aéreas. Não usar em indução'
    },
    {
        droga: 'Isoflurano',
        categoria: 'Manutenção',
        dose: '1-1.5% (0.5-1 CAM)',
        observacoes: 'CAM: 1.15%. Custo-efetivo',
        alertas: '⚠️ Odor pungente. Despertar lento'
    },
    
    // OPIOIDES
    {
        droga: 'Fentanil',
        categoria: 'Opioide',
        dose: '1-5 mcg/kg (bolus), 0.5-5 mcg/kg/h (infusão)',
        observacoes: 'Onset: 1-2 min. Duração: 30-60 min. Analgesia: 25-50mcg',
        alertas: '⚠️ Rigidez torácica em altas doses. Depressão respiratória'
    },
    {
        droga: 'Remifentanil',
        categoria: 'Opioide',
        dose: '0.1-0.5 mcg/kg/min',
        observacoes: 'Onset: 1 min. Metabolismo por esterases. Bolus: 0.5-1 mcg/kg',
        alertas: '⚠️ Hiperalgesia pós-op. Necessita analgesia multimodal'
    },
    {
        droga: 'Alfentanil',
        categoria: 'Opioide',
        dose: '10-50 mcg/kg',
        observacoes: 'Onset rápido. Duração curta (10-15 min)',
        alertas: '⚠️ Redistribuição rápida'
    },
    {
        droga: 'Morfina',
        categoria: 'Opioide',
        dose: '0.05-0.2 mg/kg IV, 5-10mg bolus',
        observacoes: 'Onset: 5-10 min. Duração: 3-4h. Analgesia eficaz',
        alertas: '⚠️ Metabólito ativo. Ajustar em IRC. Liberação histamina'
    },
    {
        droga: 'Tramadol',
        categoria: 'Opioide Fraco',
        dose: '50-100mg IV/IM, máx 400mg/dia',
        observacoes: 'Opioide fraco + inibidor recaptação. Menos constipação',
        alertas: '⚠️ Reduzir limiar convulsivo. Náuseas frequentes'
    },
    
    // BLOQUEADORES NEUROMUSCULARES
    {
        droga: 'Rocurônio',
        categoria: 'BNM',
        dose: '0.6-1.2 mg/kg (intubação), 0.1-0.15mg/kg (manutenção)',
        observacoes: 'Onset: 60-90s (1.2mg/kg). Duração: 30-45min. Infusão: 5-12mcg/kg/min',
        alertas: '⚠️ Reversível com Sugammadex. Sem efeito CV'
    },
    {
        droga: 'Succinilcolina',
        categoria: 'BNM',
        dose: '1-1.5 mg/kg',
        observacoes: 'Despolarizante. Onset: 45-60s. Único para SRI se não CI',
        alertas: '🚨 CI: hiperK+, distrofias, queimaduras > 48h, HM familiar'
    },
    {
        droga: 'Cisatracúrio',
        categoria: 'BNM',
        dose: '0.15-0.2 mg/kg (intubação), 0.03mg/kg (manutenção)',
        observacoes: 'Hofmann. Seguro em IRC/IH. Sem efeito CV/histamina',
        alertas: '✅ Gold standard para disfunção orgânica'
    },
    {
        droga: 'Atracúrio',
        categoria: 'BNM',
        dose: '0.4-0.5 mg/kg (intubação), 0.1-0.2mg/kg (manutenção)',
        observacoes: 'Hofmann + esterase. Seguro em IRC/IH',
        alertas: '⚠️ Liberação histamina em doses altas'
    },
    {
        droga: 'Vecurônio',
        categoria: 'BNM',
        dose: '0.08-0.1 mg/kg (intubação), 0.01-0.015mg/kg (manutenção)',
        observacoes: 'Duração intermediária. Custo-efetivo',
        alertas: '⚠️ Metabolismo hepático. Ajustar em IH'
    },
    
    // REVERSÃO BNM
    {
        droga: 'Sugammadex',
        categoria: 'Reversão BNM',
        dose: '2-4 mg/kg (moderado), 16 mg/kg (imediato)',
        observacoes: 'Reverte rocurônio/vecurônio. Seguro e eficaz',
        alertas: '⚠️ Não reverte outros BNM. Alto custo'
    },
    {
        droga: 'Neostigmina',
        categoria: 'Reversão BNM',
        dose: '0.04-0.07 mg/kg + Atropina 0.01-0.02 mg/kg',
        observacoes: 'Máx 5mg. Aguardar TOF > 0.2. Onset: 5-10min',
        alertas: '⚠️ Efeitos muscarínicos. Bradicardia'
    },
    
    // ANTICOLINÉRGICOS
    {
        droga: 'Atropina',
        categoria: 'Anticolinérgico',
        dose: '0.5-1mg IV (bradicardia), 0.01-0.02 mg/kg',
        observacoes: 'Onset: 1-2min. Dura 30-60min. Doses paradoxais < 0.5mg',
        alertas: '⚠️ Taquicardia, retenção urinária, midríase'
    },
    {
        droga: 'Glicopirrolato',
        categoria: 'Anticolinérgico',
        dose: '0.2-0.4mg IV, 0.005-0.01 mg/kg',
        observacoes: 'Não atravessa BHE. Menos taquicardia que atropina',
        alertas: '✅ Preferir em neuroanestesia'
    },
    
    // VASOPRESSORES/INOTRÓPICOS
    {
        droga: 'Efedrina',
        categoria: 'Vasopressor',
        dose: '5-10mg IV bolus, máx 50mg',
        observacoes: 'Agonista misto α/β. Útil em raquianestesia',
        alertas: '⚠️ Taquifilaxia. Evitar em cardiopatas'
    },
    {
        droga: 'Fenilefrina',
        categoria: 'Vasopressor',
        dose: '50-100mcg IV bolus, infusão 0.5-3 mcg/kg/min',
        observacoes: 'Agonista α1 puro. Aumenta RVS. Bradicardia reflexa',
        alertas: '✅ Preferir em obstetrícia e taquicardia basal'
    },
    {
        droga: 'Noradrenalina',
        categoria: 'Vasopressor',
        dose: '0.05-0.5 mcg/kg/min',
        observacoes: 'α1 > β1. Primeira linha em choque séptico',
        alertas: '⚠️ Acesso central preferível. Necrose se extravasamento'
    },
    {
        droga: 'Adrenalina',
        categoria: 'Vasopressor/Inotrópico',
        dose: 'Baixas: 0.01-0.05 mcg/kg/min (β), Altas: > 0.1 mcg/kg/min (α)',
        observacoes: 'PCR: 1mg IV q3-5min. Anafilaxia: 0.3-0.5mg IM',
        alertas: '⚠️ Arritmias, isquemia. Monitorização invasiva'
    },
    {
        droga: 'Dobutamina',
        categoria: 'Inotrópico',
        dose: '2.5-20 mcg/kg/min',
        observacoes: 'Agonista β1. Aumenta DC. Útil em ICC descompensada',
        alertas: '⚠️ Taquicardia, hipotensão em altas doses'
    },
    {
        droga: 'Dopamina',
        categoria: 'Inotrópico',
        dose: 'Baixa: 2-5 (renal), Média: 5-10 (β), Alta: > 10 (α) mcg/kg/min',
        observacoes: 'Dose-dependente. Menos usado atualmente',
        alertas: '⚠️ Arritmogênica. Noradrenalina preferível'
    },
    {
        droga: 'Vasopressina',
        categoria: 'Vasopressor',
        dose: '0.01-0.04 U/min (choque), 40U dose única (PCR)',
        observacoes: 'Não-catecolamina. Útil em choque refratário',
        alertas: '⚠️ Isquemia mesentérica/periférica'
    },
    
    // ANTIEMÉTICOS
    {
        droga: 'Ondansetrona',
        categoria: 'Antiemético',
        dose: '4-8mg IV',
        observacoes: 'Antagonista 5-HT3. Profilaxia: 4mg. Tratamento: 8mg',
        alertas: '⚠️ Prolongamento QT. Constipação. Cefaleia'
    },
    {
        droga: 'Dexametasona',
        categoria: 'Antiemético',
        dose: '4-8mg IV',
        observacoes: 'Profilaxia. Dar na indução. Efeito 2-3h',
        alertas: '✅ Também analgésico e anti-inflamatório'
    },
    {
        droga: 'Metoclopramida',
        categoria: 'Antiemético',
        dose: '10mg IV',
        observacoes: 'Procinético. Útil em gastroparesia',
        alertas: '⚠️ Sintomas extrapiramidais. Evitar em Parkinson'
    },
    {
        droga: 'Dimenidrinato',
        categoria: 'Antiemético',
        dose: '25-50mg IV',
        observacoes: 'Anti-histamínico. Sedativo',
        alertas: '⚠️ Sonolência. Visão borrada'
    },
    
    // ANALGÉSICOS NÃO OPIOIDES
    {
        droga: 'Dipirona',
        categoria: 'Analgésico',
        dose: '15-30 mg/kg IV (máx 2g), 6/6h',
        observacoes: 'Excelente analgésico. Poucos efeitos adversos',
        alertas: '⚠️ Hipotensão se rápido. Raro: agranulocitose'
    },
    {
        droga: 'Paracetamol',
        categoria: 'Analgésico',
        dose: '15 mg/kg IV (máx 1g), 6/6h, máx 4g/dia',
        observacoes: 'Seguro. Sinérgico com AINEs/opioides',
        alertas: '⚠️ Hepatotóxico em overdose. Ajustar em IH'
    },
    {
        droga: 'Cetoprofeno',
        categoria: 'AINE',
        dose: '100mg IV 8-12/12h',
        observacoes: 'Bom analgésico pós-op. Evitar se risco renal/sangramento',
        alertas: '⚠️ Sangramento, IRC, úlcera. Evitar > 3 dias'
    },
    {
        droga: 'Cetorolaco',
        categoria: 'AINE',
        dose: '15-30mg IV',
        observacoes: 'Analgesia potente. Máx 5 dias',
        alertas: '⚠️ SANGRAMENTO. Evitar em anticoagulados'
    },
    {
        droga: 'Ácido Tranexâmico',
        categoria: 'Antifibrinolítico',
        dose: '10-15 mg/kg IV (bolus), 1-5 mg/kg/h (infusão)',
        observacoes: 'Trauma: 1g em 10min + 1g em 8h. Reduz sangramento',
        alertas: '⚠️ Trombose (raro). Convulsões (altas doses)'
    },
    
    // OUTROS
    {
        droga: 'Lidocaína IV',
        categoria: 'Anestésico Local',
        dose: '1.5 mg/kg bolus + 1-2 mg/kg/h infusão',
        observacoes: 'Analgesia, anti-inflamatório, íleo pós-op',
        alertas: '⚠️ Toxicidade SNC > 5 mcg/mL. Arritmias'
    },
    {
        droga: 'Dexmedetomidina',
        categoria: 'Agonista α2',
        dose: '0.2-0.7 mcg/kg/h (infusão), bolus 0.5-1 mcg/kg em 10min',
        observacoes: 'Sedação consciente. Analgésico. Reduz opioides',
        alertas: '⚠️ Bradicardia, hipotensão. Caro'
    },
    {
        droga: 'Clonidina',
        categoria: 'Agonista α2',
        dose: '1-2 mcg/kg IV',
        observacoes: 'Sedação, analgesia, reduz tremores. Adjuvante regional',
        alertas: '⚠️ Hipotensão, bradicardia, boca seca'
    },
    {
        droga: 'Furosemida',
        categoria: 'Diurético',
        dose: '10-40mg IV',
        observacoes: 'Alça de Henle. Onset rápido (5-15min)',
        alertas: '⚠️ Hipovolemia, hipoK+. Monitorar eletrólitos'
    },
    {
        droga: 'Hidralazina',
        categoria: 'Anti-hipertensivo',
        dose: '5-20mg IV',
        observacoes: 'Vasodilatador arterial. Útil em emergência hipertensiva',
        alertas: '⚠️ Taquicardia reflexa. Cefaleia'
    },
    {
        droga: 'Metoprolol',
        categoria: 'Beta-bloqueador',
        dose: '2.5-5mg IV lento',
        observacoes: 'β1 seletivo. Útil em taquicardia, HAS',
        alertas: '⚠️ Bradicardia, broncoespasmo. Evitar em asma'
    },
    {
        droga: 'Esmolol',
        categoria: 'Beta-bloqueador',
        dose: '0.5-1 mg/kg bolus + 50-300 mcg/kg/min',
        observacoes: 'Ultra-curto. Útil em emergências. t1/2: 9min',
        alertas: '⚠️ Bradicardia, hipotensão. Titular cuidadosamente'
    },
    {
        droga: 'Flumazenil',
        categoria: 'Antagonista BZD',
        dose: '0.1-0.2mg IV, repetir até 1mg',
        observacoes: 'Reverte benzodiazepínicos. t1/2 curto (resedação)',
        alertas: '⚠️ Convulsões em uso crônico BZD. Síndrome abstinência'
    },
    {
        droga: 'Naloxona',
        categoria: 'Antagonista Opioide',
        dose: '0.04-0.4mg IV, repetir até 2mg',
        observacoes: 'Reverte opioides. Titular (evitar hipertensão/dor)',
        alertas: '⚠️ Síndrome abstinência. Edema pulmonar. Dor súbita'
    }
];

console.log('✅ Dados de doses para adultos carregados');

