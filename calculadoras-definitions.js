// Definições completas das calculadoras clínicas
const calculatorDefinitions = [
    // ===== CALCULADORAS QMENTUM (Acreditação) =====
    {
        id: "morse",
        title: "Escala de Morse (Quedas)",
        category: "qmentum",
        inputs: [
            { id: "history_fall", label: "Histórico de queda recente", type: "bool", points: 25 },
            { id: "secondary_diagnosis", label: "Diagnóstico secundário", type: "bool", points: 15 },
            {
                id: "ambulatory_aid",
                label: "Auxílio de marcha",
                type: "select",
                options: [
                    { value: "none", label: "Nenhum/Repouso", points: 0 },
                    { value: "crutches", label: "Bengala/Muletas/Andador", points: 15 },
                    { value: "furniture", label: "Apoio em mobiliário", points: 30 }
                ]
            },
            { id: "iv_therapy", label: "Terapia endovenosa (heparina lock etc.)", type: "bool", points: 20 },
            {
                id: "gait",
                label: "Marcha",
                type: "select",
                options: [
                    { value: "normal", label: "Normal/Acamado/Cadeira", points: 0 },
                    { value: "weak", label: "Fraca", points: 10 },
                    { value: "impaired", label: "Comprometida", points: 20 }
                ]
            },
            {
                id: "mental_status",
                label: "Estado mental",
                type: "select",
                options: [
                    { value: "oriented", label: "Orientado", points: 0 },
                    { value: "overestimates", label: "Superestima capacidade/Esquece limitações", points: 15 }
                ]
            }
        ],
        compute: function(inputs) {
            let score = 0;
            if (inputs.history_fall) score += 25;
            if (inputs.secondary_diagnosis) score += 15;
            
            const aidOption = this.inputs[2].options.find(o => o.value === inputs.ambulatory_aid);
            if (aidOption) score += aidOption.points;
            
            if (inputs.iv_therapy) score += 20;
            
            const gaitOption = this.inputs[4].options.find(o => o.value === inputs.gait);
            if (gaitOption) score += gaitOption.points;
            
            const mentalOption = this.inputs[5].options.find(o => o.value === inputs.mental_status);
            if (mentalOption) score += mentalOption.points;
            
            let risco = "baixo risco (<25)";
            if (score >= 25 && score <= 44) risco = "médio risco (25–44)";
            if (score >= 45) risco = "alto risco (≥45)";
            
            return { score, risco };
        }
    },
    {
        id: "braden",
        title: "Escala de Braden (Lesão por Pressão)",
        category: "qmentum",
        inputs: [
            { id: "percepcao_sensorial", label: "Percepção sensorial (1–4)", type: "number", min: 1, max: 4 },
            { id: "umidade", label: "Umidade (1–4)", type: "number", min: 1, max: 4 },
            { id: "atividade", label: "Atividade (1–4)", type: "number", min: 1, max: 4 },
            { id: "mobilidade", label: "Mobilidade (1–4)", type: "number", min: 1, max: 4 },
            { id: "nutricao", label: "Nutrição (1–4)", type: "number", min: 1, max: 4 },
            { id: "friccao", label: "Fricção/Cisalhamento (1–3)", type: "number", min: 1, max: 3 }
        ],
        compute: function(inputs) {
            const score = inputs.percepcao_sensorial + inputs.umidade + inputs.atividade + 
                         inputs.mobilidade + inputs.nutricao + inputs.friccao;
            
            let risco = "sem risco";
            if (score <= 18) risco = "risco leve";
            if (score <= 14) risco = "risco moderado";
            if (score <= 12) risco = "alto risco";
            if (score <= 9) risco = "risco muito alto";
            
            return { score, risco };
        }
    },
    {
        id: "apfel",
        title: "Apfel (Risco de PONV)",
        category: "qmentum",
        inputs: [
            { id: "female", label: "Sexo feminino", type: "bool" },
            { id: "nonsmoker", label: "Não fumante", type: "bool" },
            { id: "history_ponv_motion", label: "Histórico de PONV/cinetose", type: "bool" },
            { id: "postop_opioids", label: "Uso de opioide no pós-operatório", type: "bool" }
        ],
        compute: function(inputs) {
            const pts = [inputs.female, inputs.nonsmoker, inputs.history_ponv_motion, inputs.postop_opioids]
                .filter(Boolean).length;
            const map = { 0: 10, 1: 20, 2: 40, 3: 60, 4: 80 };
            return { score: pts, "probabilidade (%)": map[pts] };
        }
    },
    {
        id: "caprini",
        title: "Caprini (TEV – Cirúrgico)",
        category: "qmentum",
        inputs: [
            { id: "age_41_60", label: "Idade 41–60 anos", type: "bool", points: 1 },
            { id: "age_61_74", label: "Idade 61–74 anos", type: "bool", points: 2 },
            { id: "age_75", label: "Idade ≥ 75 anos", type: "bool", points: 3 },
            { id: "bmi_over_25", label: "IMC > 25", type: "bool", points: 1 },
            { id: "oestrogen", label: "Uso de estrogênio/ACO", type: "bool", points: 1 },
            { id: "varicose_veins", label: "Varizes", type: "bool", points: 1 },
            { id: "swollen_legs", label: "Edema de MMII", type: "bool", points: 1 },
            { id: "sepsis", label: "Sepse (< 1 mês)", type: "bool", points: 1 },
            { id: "serious_lung_disease", label: "Doença pulmonar severa", type: "bool", points: 1 },
            { id: "heart_failure", label: "Insuficiência cardíaca", type: "bool", points: 1 },
            { id: "mi_stroke_history", label: "IAM/AVE prévio", type: "bool", points: 1 },
            { id: "bed_rest", label: "Restrito ao leito ≥ 72h", type: "bool", points: 1 },
            { id: "minor_surgery", label: "Cirurgia menor (<45 min)", type: "bool", points: 1 },
            { id: "major_surgery", label: "Cirurgia maior (≥45 min)", type: "bool", points: 2 },
            { id: "central_venous_access", label: "Acesso venoso central", type: "bool", points: 1 },
            { id: "cancer_active", label: "Câncer ativo", type: "bool", points: 2 },
            { id: "previous_tev", label: "TEV prévio", type: "bool", points: 3 },
            { id: "thrombophilia", label: "Trombofilia conhecida", type: "bool", points: 3 }
        ],
        compute: function(inputs) {
            let score = 0;
            this.inputs.forEach(input => {
                if (inputs[input.id]) score += input.points;
            });
            
            let risco = "muito baixo";
            if (score >= 1 && score <= 2) risco = "baixo";
            if (score >= 3 && score <= 4) risco = "moderado";
            if (score >= 5) risco = "alto";
            
            return { score, risco };
        }
    },
    {
        id: "padua",
        title: "Padua (TEV – Clínico)",
        category: "qmentum",
        inputs: [
            { id: "active_cancer", label: "Câncer ativo", type: "bool", points: 3 },
            { id: "previous_tev", label: "TEV prévio (exclui tromboflebite superficial)", type: "bool", points: 3 },
            { id: "reduced_mobility", label: "Mobilidade reduzida", type: "bool", points: 3 },
            { id: "known_thrombophilia", label: "Trombofilia conhecida", type: "bool", points: 3 },
            { id: "trauma_surgery_recent", label: "Trauma/cirurgia < 1 mês", type: "bool", points: 2 },
            { id: "age_over_70", label: "Idade ≥ 70 anos", type: "bool", points: 1 },
            { id: "heart_or_respiratory_failure", label: "Insuficiência cardíaca/respiratória", type: "bool", points: 1 },
            { id: "acute_mi_or_stroke", label: "IAM ou AVC isquêmico recente", type: "bool", points: 1 },
            { id: "acute_infection_or_rheum", label: "Infecção aguda/doença reumática", type: "bool", points: 1 },
            { id: "obesity_bmi_30", label: "Obesidade (IMC ≥ 30)", type: "bool", points: 1 },
            { id: "ongoing_hormonal_tx", label: "Terapia hormonal em curso", type: "bool", points: 1 }
        ],
        compute: function(inputs) {
            let score = 0;
            this.inputs.forEach(input => {
                if (inputs[input.id]) score += input.points;
            });
            
            const risco = (score >= 4) ? "alto" : "baixo";
            return { score, risco };
        }
    },

    // ===== CALCULADORAS GERAIS DE ANESTESIOLOGIA =====
    {
        id: "rcri",
        title: "RCRI (Lee)",
        category: "anestesiologia",
        inputs: [
            { id: "high_risk_surgery", label: "Cirurgia de alto risco (intraperitoneal, intratorácica, suprainguinal)", type: "bool" },
            { id: "ischemic_heart_disease", label: "Doença isquêmica cardíaca", type: "bool" },
            { id: "congestive_heart_failure", label: "Insuficiência cardíaca congestiva", type: "bool" },
            { id: "cerebrovascular_disease", label: "Doença cerebrovascular (AVC/AIT)", type: "bool" },
            { id: "insulin_therapy", label: "Diabetes em uso de insulina", type: "bool" },
            { id: "creatinine_over_2", label: "Creatinina sérica > 2,0 mg/dL", type: "bool" }
        ],
        compute: function(inputs) {
            const pts = [inputs.high_risk_surgery, inputs.ischemic_heart_disease, inputs.congestive_heart_failure,
                        inputs.cerebrovascular_disease, inputs.insulin_therapy, inputs.creatinine_over_2]
                .filter(Boolean).length;
            
            let classe, risco;
            if (pts === 0) { classe = "Classe I"; risco = "baixo"; }
            else if (pts === 1) { classe = "Classe II"; risco = "baixo-intermediário"; }
            else if (pts === 2) { classe = "Classe III"; risco = "intermediário"; }
            else { classe = "Classe IV"; risco = "alto"; }
            
            return { score: pts, classe, risco };
        }
    },
    {
        id: "ariscat",
        title: "ARISCAT (Risco Pulmonar Pós-op)",
        category: "anestesiologia",
        inputs: [
            { id: "age", label: "Idade (anos)", type: "number" },
            { id: "spo2", label: "SpO2 ambiente (%)", type: "number" },
            { id: "resp_infection_last_month", label: "Infecção respiratória < 1 mês", type: "bool" },
            { id: "anemia", label: "Anemia pré-op (Hb < 10 g/dL)", type: "bool" },
            {
                id: "incision",
                label: "Incisão cirúrgica",
                type: "select",
                options: [
                    { value: "periferica", label: "periférica" },
                    { value: "abdominal_superior", label: "abdominal superior" },
                    { value: "intratoracica", label: "intratorácica" }
                ]
            },
            { id: "duration_hours", label: "Duração prevista (h)", type: "number" },
            { id: "emergency", label: "Cirurgia de urgência", type: "bool" }
        ],
        compute: function(inputs) {
            let pts = 0;
            if (inputs.age >= 51 && inputs.age <= 80) pts += 3;
            if (inputs.age > 80) pts += 16;
            if (inputs.spo2 <= 95 && inputs.spo2 >= 91) pts += 8;
            if (inputs.spo2 <= 90) pts += 24;
            if (inputs.resp_infection_last_month) pts += 17;
            if (inputs.anemia) pts += 11;
            if (inputs.incision === "abdominal_superior") pts += 15;
            if (inputs.incision === "intratoracica") pts += 24;
            if (inputs.duration_hours >= 2 && inputs.duration_hours < 3) pts += 16;
            if (inputs.duration_hours >= 3) pts += 23;
            if (inputs.emergency) pts += 8;
            
            let risco = "baixo";
            if (pts >= 26 && pts <= 44) risco = "intermediário";
            if (pts >= 45) risco = "alto";
            
            return { score: pts, risco };
        }
    },
    {
        id: "stopbang",
        title: "STOP-Bang",
        category: "anestesiologia",
        inputs: [
            { id: "snoring", label: "Ronco alto", type: "bool" },
            { id: "tired", label: "Cansaço diurno", type: "bool" },
            { id: "observed_apnea", label: "Apneia observada", type: "bool" },
            { id: "pressure", label: "Pressão alta", type: "bool" },
            { id: "bmi_over_35", label: "IMC > 35", type: "bool" },
            { id: "age_over_50", label: "Idade > 50", type: "bool" },
            { id: "neck_over_40", label: "Pescoço > 40 cm", type: "bool" },
            { id: "male", label: "Sexo masculino", type: "bool" }
        ],
        compute: function(inputs) {
            const score = [inputs.snoring, inputs.tired, inputs.observed_apnea, inputs.pressure,
                          inputs.bmi_over_35, inputs.age_over_50, inputs.neck_over_40, inputs.male]
                .filter(Boolean).length;
            
            let risco = "baixo";
            if (score >= 3 && score <= 4) risco = "intermediário";
            if (score >= 5) risco = "alto";
            
            return { score, risco };
        }
    },
    {
        id: "ibw_bsa",
        title: "Peso Ideal (Devine) e SC (Du Bois)",
        category: "anestesiologia",
        inputs: [
            {
                id: "sex",
                label: "Sexo",
                type: "select",
                options: [
                    { value: "M", label: "M" },
                    { value: "F", label: "F" }
                ]
            },
            { id: "height_cm", label: "Altura (cm)", type: "number" },
            { id: "weight_kg", label: "Peso (kg)", type: "number" }
        ],
        compute: function(inputs) {
            const ibw = (inputs.sex === "M") ? 
                50 + 0.9 * (inputs.height_cm - 152) : 
                45.5 + 0.9 * (inputs.height_cm - 152);
            const abw = ibw + 0.4 * (inputs.weight_kg - ibw);
            const bsa = 0.007184 * Math.pow(inputs.height_cm, 0.725) * Math.pow(inputs.weight_kg, 0.425);
            
            return {
                "Peso Ideal (kg)": Number(ibw.toFixed(1)),
                "Peso Ajustado (kg)": Number(abw.toFixed(1)),
                "Sup. Corpórea (m²)": Number(bsa.toFixed(2))
            };
        }
    },
    {
        id: "opioid_convert",
        title: "Conversão de Opioides",
        category: "anestesiologia",
        inputs: [
            {
                id: "from_drug",
                label: "Opioide origem",
                type: "select",
                options: [
                    { value: "morfina_ev", label: "morfina_ev" },
                    { value: "morfina_vo", label: "morfina_vo" },
                    { value: "hidromorfona_ev", label: "hidromorfona_ev" },
                    { value: "fentanil_ev", label: "fentanil_ev" }
                ]
            },
            { id: "from_dose", label: "Dose origem", type: "number" },
            {
                id: "to_drug",
                label: "Opioide destino",
                type: "select",
                options: [
                    { value: "morfina_ev", label: "morfina_ev" },
                    { value: "morfina_vo", label: "morfina_vo" },
                    { value: "hidromorfona_ev", label: "hidromorfona_ev" },
                    { value: "fentanil_ev", label: "fentanil_ev" }
                ]
            }
        ],
        compute: function(inputs) {
            const eq = { morfina_ev: 10, morfina_vo: 30, hidromorfona_ev: 1.5, fentanil_ev: 0.1 };
            const mgMorphineIV = (inputs.from_dose / eq[inputs.from_drug]) * 10;
            const doseDestino = (mgMorphineIV / 10) * eq[inputs.to_drug];
            return {
                "Dose Equivalente": Number(doseDestino.toFixed(2)),
                observacao: "Conversão aproximada; ajustar para clínica/renal/idoso."
            };
        }
    },
    {
        id: "holliday_segar",
        title: "Holliday–Segar (Manutenção Pediátrica)",
        category: "anestesiologia",
        inputs: [
            { id: "weight_kg", label: "Peso (kg)", type: "number" }
        ],
        compute: function(inputs) {
            let mlDia = 0;
            if (inputs.weight_kg <= 10) mlDia = 100 * inputs.weight_kg;
            else if (inputs.weight_kg <= 20) mlDia = 100 * 10 + 50 * (inputs.weight_kg - 10);
            else mlDia = 100 * 10 + 50 * 10 + 20 * (inputs.weight_kg - 20);
            const mlHora = mlDia / 24;
            return {
                "Manutenção (ml/h)": Number(mlHora.toFixed(0)),
                "Manutenção (ml/dia)": Number(mlDia.toFixed(0))
            };
        }
    },
    {
        id: "aldrete",
        title: "Índice de Aldrete Modificado",
        category: "anestesiologia",
        inputs: [
            {
                id: "atividade",
                label: "Atividade",
                type: "select",
                options: [
                    { value: 2, label: "Move 4 extremidades" },
                    { value: 1, label: "Move 2 extremidades" },
                    { value: 0, label: "Não move extremidades" }
                ]
            },
            {
                id: "respiracao",
                label: "Respiração",
                type: "select",
                options: [
                    { value: 2, label: "Respira fundo e tosse" },
                    { value: 1, label: "Dispneia / Respiração superficial" },
                    { value: 0, label: "Apneia" }
                ]
            },
            {
                id: "circulacao",
                label: "Circulação",
                type: "select",
                options: [
                    { value: 2, label: "PA ± 20% do nível pré-anestésico" },
                    { value: 1, label: "PA ± 20-49% do nível pré-anestésico" },
                    { value: 0, label: "PA ± 50% do nível pré-anestésico" }
                ]
            },
            {
                id: "consciencia",
                label: "Consciência",
                type: "select",
                options: [
                    { value: 2, label: "Totalmente desperto" },
                    { value: 1, label: "Desperta ao chamado" },
                    { value: 0, label: "Não responde" }
                ]
            },
            {
                id: "saturacao",
                label: "Saturação de O₂",
                type: "select",
                options: [
                    { value: 2, label: "Mantém SpO₂ > 92% em ar ambiente" },
                    { value: 1, label: "Necessita O₂ para manter SpO₂ > 90%" },
                    { value: 0, label: "SpO₂ ≤ 90% com O₂" }
                ]
            }
        ],
        compute: function(inputs) {
            const score = parseInt(inputs.atividade) + parseInt(inputs.respiracao) + 
                         parseInt(inputs.circulacao) + parseInt(inputs.consciencia) + 
                         parseInt(inputs.saturacao);
            
            const resultado = score >= 9 ? "Apto para alta da SRPA" : "NÃO apto para alta (score < 9)";
            return { score, resultado };
        }
    }
];

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = calculatorDefinitions;
}

