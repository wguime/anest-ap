// ==================== DADOS COMPLETOS DE DOSES PEDIÁTRICAS ====================
// Baseado no arquivo PediCalc.xlsx
// Calculadora automática baseada no peso da criança

const pediCalcData = {
    pcr: {
        categoria: "PCR (Parada Cardiorrespiratória)",
        icon: "fas fa-heartbeat",
        color: "#F44336",
        drogas: [
            {
                droga: "ADRENALINA",
                apresentacao: "1 mg/ml",
                dosePadrao: 0.01, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "1ml + 9 ml AD",
                concentracaoFinal: 0.1, // mg/ml
                observacao: "Dose de emergência IV/IO"
            },
            {
                droga: "ATROPINA",
                apresentacao: "0,25 mg/ml",
                dosePadrao: 0.02, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 0.25,
                doseMinima: 0.1,
                doseMaxima: 0.5,
                observacao: "Dose mínima: 0,1mg | Dose máxima: 0,5mg"
            },
            {
                droga: "PUSH SF 0,9%",
                apresentacao: "0,15 mEq/ml",
                dosePadrao: 20, // ml/kg
                unidadeDose: "ml/kg",
                diluicao: "PURO",
                concentracaoFinal: 1, // Para cálculo direto em ml
                observacao: "Reposição volêmica em bolus"
            },
            {
                droga: "BICA Na 8,4%",
                apresentacao: "1 mEq/ml",
                dosePadrao: 1, // mEq/kg
                unidadeDose: "mEq/kg",
                diluicao: "20 ml + 20 ml AD",
                concentracaoFinal: 0.5, // mEq/ml
                observacao: "Bicarbonato de Sódio - diluir 50%"
            },
            {
                droga: "LIDOCAÍNA 2%",
                apresentacao: "20 mg/ml",
                dosePadrao: 1, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 20,
                observacao: "Antiarrítmico"
            },
            {
                droga: "GLUCO Ca 10%",
                apresentacao: "100 mg/ml",
                dosePadrao: 20, // mg/kg (para crianças)
                unidadeDose: "mg/kg",
                diluicao: "10 ml + 10 ml AD",
                concentracaoFinal: 50,
                doseMaxima: 1000, // 1g para adulto
                observacao: "Gluconato de Cálcio - diluir 50%"
            },
            {
                droga: "ADENOSINA",
                apresentacao: "3 mg/ml",
                dosePadrao: 0.1, // mg/kg inicial
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 3,
                doseMaxima: 0.3, // dose máxima por kg
                observacao: "0,1 mg/kg inicial → máx 0,3 mg/kg"
            },
            {
                droga: "GLICOSE 10%",
                apresentacao: "100 mg/ml",
                dosePadrao: 500, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 100,
                observacao: "Hipoglicemia"
            }
        ]
    },
    sedacao: {
        categoria: "Sedação / Analgesia / Bloqueio",
        icon: "fas fa-syringe",
        color: "#9C27B0",
        drogas: [
            {
                droga: "FENTANIL",
                apresentacao: "50 mcg/ml",
                dosePadrao: 2, // mcg/kg
                unidadeDose: "mcg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 50,
                observacao: "Analgesia: 1-3 mcg/kg"
            },
            {
                droga: "MIDAZOLAM",
                apresentacao: "5 mg/ml",
                dosePadrao: 0.2, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 5,
                doseMaxima: 5,
                observacao: "Sedação: 0,05-0,3 mg/kg"
            },
            {
                droga: "DIAZEPAM",
                apresentacao: "10 mg/2 ml",
                dosePadrao: 0.5, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 5,
                doseMaxima: 10,
                observacao: "Sedação/Anticonvulsivante"
            },
            {
                droga: "MORFINA",
                apresentacao: "10 mg/ml",
                dosePadrao: 0.1, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "1 ml + 9 ml AD",
                concentracaoFinal: 1,
                observacao: "Analgesia: 0,05-0,1 mg/kg"
            },
            {
                droga: "QUETAMINA (CETAMINA)",
                apresentacao: "50 mg/ml",
                dosePadrao: 1, // mg/kg IV
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 50,
                observacao: "IV: 1-2 mg/kg | IM: 4-5 mg/kg"
            },
            {
                droga: "PANCURÔNIO",
                apresentacao: "2 mg/ml",
                dosePadrao: 0.1, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 2,
                observacao: "Bloqueio neuromuscular"
            },
            {
                droga: "SUCCINILCOLINA",
                apresentacao: "100 mg/frasco",
                dosePadrao: 1, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "1 frasco + 5 ml AD",
                concentracaoFinal: 20,
                observacao: "Bloqueio neuromuscular rápido"
            },
            {
                droga: "ROCURÔNIO",
                apresentacao: "10 mg/ml",
                dosePadrao: 0.6, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 10,
                observacao: "Intubação: 0,6-1,2 mg/kg"
            },
            {
                droga: "PROPOFOL",
                apresentacao: "10 mg/ml",
                dosePadrao: 1, // mg/kg (indução 2-3)
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 10,
                observacao: "Indução: 2-3 mg/kg | Sedação: 1-2 mg/kg"
            },
            {
                droga: "THIOPENTAL",
                apresentacao: "500 mg/frasco",
                dosePadrao: 1, // mg/kg (indução 3-5)
                unidadeDose: "mg/kg",
                diluicao: "1 frasco + 20 ml AD",
                concentracaoFinal: 25,
                observacao: "Indução: 3-5 mg/kg"
            }
        ]
    },
    anticonvulsivante: {
        categoria: "Anticonvulsivantes",
        icon: "fas fa-brain",
        color: "#FF9800",
        drogas: [
            {
                droga: "FENOBARBITAL",
                apresentacao: "100 mg/ml",
                dosePadrao: 5, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 100,
                observacao: "Dose de ataque: 15-20 mg/kg"
            },
            {
                droga: "FENITOÍNA",
                apresentacao: "50 mg/ml",
                dosePadrao: 15, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 50,
                observacao: "Infundir lentamente (máx 50mg/min)"
            }
        ]
    },
    antidotos: {
        categoria: "Antídotos",
        icon: "fas fa-flask",
        color: "#4CAF50",
        drogas: [
            {
                droga: "NALOXONE",
                apresentacao: "0,4 mg/ml",
                dosePadrao: 0.1, // mg/kg (ou 0.01 inicialmente)
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 0.4,
                doseMaxima: 2,
                observacao: "Antagonista opioide - dose inicial: 0,01-0,1 mg/kg"
            },
            {
                droga: "FLUMAZENIL",
                apresentacao: "0,1 mg/ml",
                dosePadrao: 0.01, // mg/kg
                unidadeDose: "mg/kg",
                diluicao: "SEM DILUIR",
                concentracaoFinal: 0.1,
                doseMaxima: 0.2,
                observacao: "Antagonista benzodiazepínico"
            }
        ]
    }
};

// Função para calcular dose pediátrica
function calcularDosePediCalc(peso, categoria = null) {
    if (!peso || peso <= 0 || peso > 150) {
        return null;
    }
    
    const resultados = [];
    const categorias = categoria ? [categoria] : Object.keys(pediCalcData);
    
    categorias.forEach(catKey => {
        const cat = pediCalcData[catKey];
        cat.drogas.forEach(medicamento => {
            // Calcular dose em mg ou mcg
            let doseCalculada = peso * medicamento.dosePadrao;
            
            // Aplicar limites se existirem
            if (medicamento.doseMinima && doseCalculada < medicamento.doseMinima) {
                doseCalculada = medicamento.doseMinima;
            }
            if (medicamento.doseMaxima) {
                if (medicamento.unidadeDose.includes('mg/kg')) {
                    const doseMaxPorKg = medicamento.doseMaxima * peso;
                    if (doseCalculada > doseMaxPorKg) {
                        doseCalculada = doseMaxPorKg;
                    }
                } else if (doseCalculada > medicamento.doseMaxima) {
                    doseCalculada = medicamento.doseMaxima;
                }
            }
            
            // Calcular volume final em ml
            const volumeFinal = doseCalculada / medicamento.concentracaoFinal;
            
            resultados.push({
                categoria: cat.categoria,
                droga: medicamento.droga,
                apresentacao: medicamento.apresentacao,
                dosePadrao: `${medicamento.dosePadrao} ${medicamento.unidadeDose}`,
                diluicao: medicamento.diluicao,
                doseCalculada: doseCalculada.toFixed(2),
                volumeFinal: volumeFinal.toFixed(2),
                unidade: "ml",
                observacao: medicamento.observacao
            });
        });
    });
    
    return resultados;
}

// Export to window for browser use
if (typeof window !== 'undefined') {
    window.pediCalcData = pediCalcData;
    window.calcularDosePediCalc = calcularDosePediCalc;
}

