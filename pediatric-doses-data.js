// ==================== DADOS DE DOSES PEDIÁTRICAS ====================
// Calculadora automática baseada no peso da criança

const pediatricDosesData = [
    {
        droga: "Adrenalina",
        apresentacao: "1 mg/ml",
        dosePadrao: 0.01, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "1ml + 9ml AD",
        concentracaoFinal: 0.1, // mg/ml após diluição
        unidadeResultado: "ml",
        observacao: "Dose de emergência IV/IO"
    },
    {
        droga: "Atropina",
        apresentacao: "0,5 mg/ml",
        dosePadrao: 0.02, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Usar puro",
        concentracaoFinal: 0.5, // mg/ml
        unidadeResultado: "ml",
        doseMinima: 0.1, // mg
        doseMaxima: 0.5, // mg
        observacao: "Dose mínima: 0,1mg | Dose máxima: 0,5mg"
    },
    {
        droga: "Amiodarona",
        apresentacao: "50 mg/ml",
        dosePadrao: 5, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Diluir em SG 5%",
        concentracaoFinal: 50, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 300, // mg
        observacao: "Dose máxima: 300mg (1ª dose)"
    },
    {
        droga: "Diazepam",
        apresentacao: "5 mg/ml",
        dosePadrao: 0.2, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Usar puro",
        concentracaoFinal: 5, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 10, // mg
        observacao: "Dose máxima: 10mg"
    },
    {
        droga: "Fentanil",
        apresentacao: "50 mcg/ml",
        dosePadrao: 1, // mcg/kg
        unidadeDose: "mcg/kg",
        diluicao: "Usar puro ou diluir",
        concentracaoFinal: 50, // mcg/ml
        unidadeResultado: "ml",
        observacao: "Dose sedação: 1-2 mcg/kg"
    },
    {
        droga: "Midazolam",
        apresentacao: "5 mg/ml",
        dosePadrao: 0.1, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Usar puro ou diluir",
        concentracaoFinal: 5, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 5, // mg
        observacao: "Sedação: 0,05-0,15 mg/kg"
    },
    {
        droga: "Morfina",
        apresentacao: "10 mg/ml",
        dosePadrao: 0.1, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Diluir em SF ou SG",
        concentracaoFinal: 1, // mg/ml (após diluição 1:10)
        unidadeResultado: "ml",
        observacao: "Analgesia: 0,05-0,1 mg/kg"
    },
    {
        droga: "Propofol",
        apresentacao: "10 mg/ml",
        dosePadrao: 2.5, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Usar puro",
        concentracaoFinal: 10, // mg/ml
        unidadeResultado: "ml",
        observacao: "Indução: 2-3 mg/kg"
    },
    {
        droga: "Cetamina",
        apresentacao: "50 mg/ml",
        dosePadrao: 1, // mg/kg IV
        unidadeDose: "mg/kg",
        diluicao: "Diluir para 10mg/ml",
        concentracaoFinal: 10, // mg/ml
        unidadeResultado: "ml",
        observacao: "IV: 1-2 mg/kg | IM: 4-5 mg/kg"
    },
    {
        droga: "Succinilcolina",
        apresentacao: "100 mg/ml",
        dosePadrao: 1.5, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Diluir em SF",
        concentracaoFinal: 20, // mg/ml (diluição 1:5)
        unidadeResultado: "ml",
        observacao: "Bloqueio neuromuscular rápido"
    },
    {
        droga: "Rocurônio",
        apresentacao: "10 mg/ml",
        dosePadrao: 0.6, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Usar puro",
        concentracaoFinal: 10, // mg/ml
        unidadeResultado: "ml",
        observacao: "Intubação: 0,6-1,2 mg/kg"
    },
    {
        droga: "Dexametasona",
        apresentacao: "4 mg/ml",
        dosePadrao: 0.15, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Usar puro",
        concentracaoFinal: 4, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 10, // mg
        observacao: "Anti-inflamatório: 0,15-0,6 mg/kg"
    },
    {
        droga: "Ondansetrona",
        apresentacao: "2 mg/ml",
        dosePadrao: 0.15, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Diluir em SF",
        concentracaoFinal: 2, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 8, // mg
        observacao: "Dose máxima: 8mg"
    },
    {
        droga: "Paracetamol",
        apresentacao: "10 mg/ml",
        dosePadrao: 15, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Diluir em SF ou SG",
        concentracaoFinal: 10, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 1000, // mg
        observacao: "Dose: 10-15 mg/kg (máx: 1g)"
    },
    {
        droga: "Dipirona",
        apresentacao: "500 mg/ml",
        dosePadrao: 15, // mg/kg
        unidadeDose: "mg/kg",
        diluicao: "Diluir em SF",
        concentracaoFinal: 500, // mg/ml
        unidadeResultado: "ml",
        doseMaxima: 1000, // mg
        observacao: "Dose: 10-20 mg/kg (máx: 1g)"
    }
];

// Função para calcular dose
function calcularDosePediatrica(peso) {
    if (!peso || peso <= 0 || peso > 150) {
        return null;
    }
    
    return pediatricDosesData.map(medicamento => {
        // Calcular dose em mg ou mcg
        let doseCalculada = peso * medicamento.dosePadrao;
        
        // Aplicar limites se existirem
        if (medicamento.doseMinima && doseCalculada < medicamento.doseMinima) {
            doseCalculada = medicamento.doseMinima;
        }
        if (medicamento.doseMaxima && doseCalculada > medicamento.doseMaxima) {
            doseCalculada = medicamento.doseMaxima;
        }
        
        // Calcular volume final em ml
        const volumeFinal = doseCalculada / medicamento.concentracaoFinal;
        
        return {
            droga: medicamento.droga,
            apresentacao: medicamento.apresentacao,
            dosePadrao: `${medicamento.dosePadrao} ${medicamento.unidadeDose}`,
            diluicao: medicamento.diluicao,
            doseCalculada: doseCalculada.toFixed(2),
            volumeFinal: volumeFinal.toFixed(2),
            unidade: medicamento.unidadeResultado,
            observacao: medicamento.observacao
        };
    });
}

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.pediatricDosesData = pediatricDosesData;
    window.calcularDosePediatrica = calcularDosePediatrica;
}

