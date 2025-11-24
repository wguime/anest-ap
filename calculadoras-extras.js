// ==================== STOP-BANG (SAHOS RISK) ====================
function showSTOPBang() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">STOP-Bang</h1>
            <p class="section-subtitle">Risco de Síndrome da Apneia e Hipopneia Obstrutiva do Sono</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <div id="stopbangForm">
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-bed"></i>
                            Questionário STOP-Bang (1 ponto para cada SIM)
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">😴</div>
                                <div class="factor-text">
                                    <strong>S - Ronco alto</strong>
                                    <span class="factor-points">(Snoring) Ronco alto o suficiente para ser ouvido através de porta fechada?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🥱</div>
                                <div class="factor-text">
                                    <strong>T - Cansaço diurno</strong>
                                    <span class="factor-points">(Tired) Frequentemente cansado ou sonolento durante o dia?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">👁️</div>
                                <div class="factor-text">
                                    <strong>O - Apneia observada</strong>
                                    <span class="factor-points">(Observed) Alguém observou parada respiratória durante o sono?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🩺</div>
                                <div class="factor-text">
                                    <strong>P - Pressão alta</strong>
                                    <span class="factor-points">(Pressure) Hipertensão arterial tratada ou não tratada?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">📏</div>
                                <div class="factor-text">
                                    <strong>B - IMC > 35 kg/m²</strong>
                                    <span class="factor-points">(BMI) Índice de Massa Corporal maior que 35?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">👴</div>
                                <div class="factor-text">
                                    <strong>A - Idade > 50 anos</strong>
                                    <span class="factor-points">(Age) Idade acima de 50 anos?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">😮</div>
                                <div class="factor-text">
                                    <strong>N - Circunferência pescoço</strong>
                                    <span class="factor-points">(Neck) Circunferência pescoço > 40cm (♂) ou > 38cm (♀)?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleSTOPBangFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">👨</div>
                                <div class="factor-text">
                                    <strong>G - Sexo masculino</strong>
                                    <span class="factor-points">(Gender) Paciente do sexo masculino?</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <div id="stopbangResult" class="result-box" style="display: none;">
                        <h3>Resultado Final</h3>
                        <div class="score-display">
                            <span class="score-number" id="stopbangScore">0</span>
                            <span class="score-label">ponto(s)</span>
                        </div>
                        <div class="risk-classification" id="stopbangRisk"></div>
                        <div class="risk-recommendation" id="stopbangRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="stopbangCurrentScore">0</span> ponto(s)
                        </div>
                        <div class="score-status" id="stopbangStatus">
                            Responda SIM ou NÃO para cada item
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetSTOPBang()">
                        <i class="fas fa-redo"></i> Limpar Tudo
                    </button>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre o STOP-Bang</h3>
                <p>Screening rápido para Síndrome da Apneia Obstrutiva do Sono.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>0-2 pontos:</strong> Baixo risco de SAHOS</li>
                    <li><strong>3-4 pontos:</strong> Risco intermediário de SAHOS</li>
                    <li><strong>5-8 pontos:</strong> Alto risco de SAHOS</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function toggleSTOPBangFactor(card) {
    card.classList.toggle('selected');
    const icon = card.querySelector('.card-check i');
    
    if (card.classList.contains('selected')) {
        icon.classList.remove('fa-circle');
        icon.classList.add('fa-check-circle');
    } else {
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    }
    
    calcularSTOPBang();
}

function calcularSTOPBang() {
    const cards = document.querySelectorAll('#stopbangForm .risk-factor-card.selected');
    const total = cards.length;
    
    // Atualizar score tracker
    document.getElementById('stopbangCurrentScore').textContent = total;
    
    if (total === 0) {
        document.getElementById('stopbangStatus').textContent = 'Responda SIM ou NÃO para cada item';
    } else if (total <= 2) {
        document.getElementById('stopbangStatus').textContent = 'Baixo Risco de SAHOS';
    } else if (total <= 4) {
        document.getElementById('stopbangStatus').textContent = 'Risco Intermediário de SAHOS';
    } else {
        document.getElementById('stopbangStatus').textContent = 'Alto Risco de SAHOS';
    }
    
    // Mostrar resultado final
    const scoreDisplay = document.getElementById('stopbangScore');
    const riskDisplay = document.getElementById('stopbangRisk');
    const recommendationDisplay = document.getElementById('stopbangRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total <= 2) {
        riskLevel = 'Baixo Risco de SAHOS';
        riskClass = 'risk-low';
        recommendation = 'Baixa probabilidade de SAHOS moderada/grave. Proceder com anestesia padrão. Cuidados perioperatórios habituais.';
    } else if (total <= 4) {
        riskLevel = 'Risco Intermediário de SAHOS';
        riskClass = 'risk-moderate';
        recommendation = 'Risco INTERMEDIÁRIO de SAHOS. CUIDADOS: Evitar opioides excessivos, preferir analgesia multimodal, monitorização pós-operatória prolongada (4-6h), evitar decúbito dorsal, considerar CPAP no pós-operatório se disponível. Avaliar internação se cirurgia ambulatorial.';
    } else {
        riskLevel = 'Alto Risco de SAHOS';
        riskClass = 'risk-high';
        recommendation = 'ALTO RISCO de SAHOS moderada/grave. CUIDADOS INTENSIVOS: Analgesia multimodal SEM ou COM mínimo de opioides, anestesia regional quando possível, EVITAR benzodiazepínicos, monitorização contínua 24h pós-operatória, manter cabeceira elevada, CPAP imediato no pós-operatório, considerar UTI/semi-intensiva. Cirurgia ambulatorial CONTRAINDICADA.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('stopbangResult').style.display = 'block';
}

function resetSTOPBang() {
    const cards = document.querySelectorAll('#stopbangForm .risk-factor-card.selected');
    cards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    document.getElementById('stopbangCurrentScore').textContent = '0';
    document.getElementById('stopbangStatus').textContent = 'Responda SIM ou NÃO para cada item';
    document.getElementById('stopbangResult').style.display = 'none';
}

// ==================== ESCALA DE GLASGOW ====================
function showGlasgow() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Escala de Glasgow</h1>
            <p class="section-subtitle">Avaliação do Nível de Consciência</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="glasgowForm" class="calc-form">
                    <!-- Abertura Ocular -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-eye"></i> Abertura Ocular
                        </label>
                        <select class="form-select" id="glasgow_eyes" onchange="calcularGlasgow()">
                            <option value="4">Espontânea (4 pontos)</option>
                            <option value="3">À voz (3 pontos)</option>
                            <option value="2">À dor (2 pontos)</option>
                            <option value="1">Nenhuma (1 ponto)</option>
                        </select>
                    </div>

                    <!-- Resposta Verbal -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-comment"></i> Resposta Verbal
                        </label>
                        <select class="form-select" id="glasgow_verbal" onchange="calcularGlasgow()">
                            <option value="5">Orientado (5 pontos)</option>
                            <option value="4">Confuso (4 pontos)</option>
                            <option value="3">Palavras inapropriadas (3 pontos)</option>
                            <option value="2">Sons incompreensíveis (2 pontos)</option>
                            <option value="1">Nenhuma (1 ponto)</option>
                        </select>
                    </div>

                    <!-- Resposta Motora -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-hand-paper"></i> Resposta Motora
                        </label>
                        <select class="form-select" id="glasgow_motor" onchange="calcularGlasgow()">
                            <option value="6">Obedece comandos (6 pontos)</option>
                            <option value="5">Localiza dor (5 pontos)</option>
                            <option value="4">Retirada à dor (4 pontos)</option>
                            <option value="3">Flexão anormal/decorticação (3 pontos)</option>
                            <option value="2">Extensão anormal/descerebração (2 pontos)</option>
                            <option value="1">Nenhuma (1 ponto)</option>
                        </select>
                    </div>

                    <div id="glasgowResult" class="result-box">
                        <h3>Resultado</h3>
                        <div class="score-display">
                            <span class="score-number" id="glasgowScore">15</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="glasgowRisk"></div>
                        <div class="risk-recommendation" id="glasgowRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="glasgowCurrentScore">15</span> pontos
                        </div>
                        <div class="score-status" id="glasgowStatus">
                            Score Máximo - Totalmente Alerta
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetGlasgow()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre a Escala de Glasgow</h3>
                <p>Avalia nível de consciência baseado em 3 parâmetros.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>15-14 pontos:</strong> TCE leve</li>
                    <li><strong>13-9 pontos:</strong> TCE moderado</li>
                    <li><strong>≤ 8 pontos:</strong> TCE grave - IOT indicada</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    calcularGlasgow();
}

function calcularGlasgow() {
    const eyes = parseInt(document.getElementById('glasgow_eyes')?.value || 4);
    const verbal = parseInt(document.getElementById('glasgow_verbal')?.value || 5);
    const motor = parseInt(document.getElementById('glasgow_motor')?.value || 6);
    
    const total = eyes + verbal + motor;
    
    // Atualizar score tracker
    document.getElementById('glasgowCurrentScore').textContent = total;
    
    // Atualizar status
    if (total >= 14) {
        document.getElementById('glasgowStatus').textContent = 'TCE Leve - Totalmente Alerta';
    } else if (total >= 9) {
        document.getElementById('glasgowStatus').textContent = 'TCE Moderado - Atenção';
    } else {
        document.getElementById('glasgowStatus').textContent = 'TCE Grave - IOT Indicada';
    }
    
    // Mostrar resultado
    const scoreDisplay = document.getElementById('glasgowScore');
    const riskDisplay = document.getElementById('glasgowRisk');
    const recommendationDisplay = document.getElementById('glasgowRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total >= 14) {
        riskLevel = 'TCE Leve (14-15 pontos)';
        riskClass = 'risk-low';
        recommendation = 'Paciente consciente e orientado. Observação clínica 6-24h. Considerar TC crânio se mecanismo importante ou cefaleia. Orientar retorno se piora.';
    } else if (total >= 9) {
        riskLevel = 'TCE Moderado (9-13 pontos)';
        riskClass = 'risk-moderate';
        recommendation = 'INTERNAÇÃO obrigatória. TC crânio urgente. Reavaliação neurológica frequente (a cada 2-4h). Considerar consulta com neurocirurgia. Preparar para possível IOT se Glasgow ≤ 8.';
    } else {
        riskLevel = 'TCE Grave (3-8 pontos)';
        riskClass = 'risk-high';
        recommendation = 'INTUBAÇÃO OROTRAQUEAL IMEDIATA (Glasgow ≤ 8). Sedação e analgesia. TC crânio URGENTE. Consulta neurocirurgia IMEDIATA. UTI. Monitorização neurológica contínua. Manter PPC > 60mmHg, PaCO2 35-40mmHg. Considerar PIC se indicado.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
}

function resetGlasgow() {
    document.getElementById('glasgow_eyes').value = 4;
    document.getElementById('glasgow_verbal').value = 5;
    document.getElementById('glasgow_motor').value = 6;
    calcularGlasgow();
}

// ==================== PESO IDEAL E BSA ====================
function showPesoIdeal() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Peso Ideal & BSA</h1>
            <p class="section-subtitle">Cálculos Antropométricos</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="pesoIdealForm" class="calc-form">
                    <!-- Sexo -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-venus-mars"></i> Sexo
                        </label>
                        <select class="form-select" id="sexo" onchange="calcularPesoIdeal()">
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                        </select>
                    </div>

                    <!-- Altura -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-ruler-vertical"></i> Altura (cm)
                        </label>
                        <input type="number" class="form-select" id="altura" placeholder="Ex: 170" 
                               min="100" max="250" onchange="calcularPesoIdeal()">
                    </div>

                    <!-- Peso Atual -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-weight"></i> Peso Atual (kg)
                        </label>
                        <input type="number" class="form-select" id="pesoAtual" placeholder="Ex: 70" 
                               min="20" max="300" step="0.1" onchange="calcularPesoIdeal()">
                    </div>

                    <div id="pesoIdealResult" class="result-box" style="display: none;">
                        <h3>Resultados</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Peso Ideal (Devine)</div>
                            <div class="result-value" id="pesoIdealValue">-</div>
                        </div>

                        <div class="calc-result-item">
                            <div class="result-label">IMC</div>
                            <div class="result-value" id="imcValue">-</div>
                        </div>

                        <div class="calc-result-item">
                            <div class="result-label">Superfície Corpórea (BSA)</div>
                            <div class="result-value" id="bsaValue">-</div>
                        </div>

                        <div class="calc-result-item">
                            <div class="result-label">Peso Ideal Ajustado (se IMC > 30)</div>
                            <div class="result-value" id="pesoAjustadoValue">-</div>
                        </div>

                        <div class="risk-recommendation" id="pesoRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetPesoIdeal()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Fórmulas Utilizadas</h3>
                <h4>Peso Ideal (Devine):</h4>
                <ul>
                    <li><strong>Homens:</strong> 50 + 0.91 × (altura - 152.4)</li>
                    <li><strong>Mulheres:</strong> 45.5 + 0.91 × (altura - 152.4)</li>
                </ul>
                <h4>BSA (DuBois & DuBois):</h4>
                <p>0.007184 × altura^0.725 × peso^0.425</p>
                <h4>Peso Ideal Ajustado (obesidade):</h4>
                <p>PI + 0.4 × (Peso Atual - PI)</p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularPesoIdeal() {
    const sexo = document.getElementById('sexo').value;
    const altura = parseFloat(document.getElementById('altura').value);
    const pesoAtual = parseFloat(document.getElementById('pesoAtual').value);
    
    if (!altura || !pesoAtual || altura < 100 || altura > 250 || pesoAtual < 20 || pesoAtual > 300) {
        document.getElementById('pesoIdealResult').style.display = 'none';
        return;
    }
    
    // Peso Ideal (Devine)
    let pesoIdeal;
    if (sexo === 'M') {
        pesoIdeal = 50 + 0.91 * (altura - 152.4);
    } else {
        pesoIdeal = 45.5 + 0.91 * (altura - 152.4);
    }
    
    // IMC
    const alturaM = altura / 100;
    const imc = pesoAtual / (alturaM * alturaM);
    
    // BSA (DuBois)
    const bsa = 0.007184 * Math.pow(altura, 0.725) * Math.pow(pesoAtual, 0.425);
    
    // Peso Ideal Ajustado (para obesos)
    const pesoAjustado = pesoIdeal + 0.4 * (pesoAtual - pesoIdeal);
    
    // Exibir resultados
    document.getElementById('pesoIdealValue').textContent = `${pesoIdeal.toFixed(1)} kg`;
    document.getElementById('imcValue').textContent = `${imc.toFixed(1)} kg/m²`;
    document.getElementById('bsaValue').textContent = `${bsa.toFixed(2)} m²`;
    
    if (imc >= 30) {
        document.getElementById('pesoAjustadoValue').textContent = `${pesoAjustado.toFixed(1)} kg`;
    } else {
        document.getElementById('pesoAjustadoValue').textContent = 'Usar Peso Ideal';
    }
    
    // Recomendações
    let recommendation = '';
    if (imc < 18.5) {
        recommendation = '⚠️ BAIXO PESO (IMC < 18.5). Risco aumentado de complicações. Avaliar suporte nutricional.';
    } else if (imc < 25) {
        recommendation = '✅ PESO NORMAL (IMC 18.5-24.9). Use o Peso Ideal para cálculos de drogas.';
    } else if (imc < 30) {
        recommendation = '⚠️ SOBREPESO (IMC 25-29.9). Use o Peso Ideal para maioria das drogas. Cuidado com drogas lipofílicas.';
    } else if (imc < 40) {
        recommendation = '⚠️ OBESIDADE (IMC 30-39.9). Use Peso Ideal Ajustado para drogas lipofílicas (propofol, fentanil, succinilcolina). Use Peso Ideal para hidrofílicas (relaxantes, antibióticos). Ventilação protetora: 6-8 mL/kg de Peso Ideal.';
    } else {
        recommendation = '🚨 OBESIDADE GRAVE (IMC ≥ 40). Usar Peso Ideal Ajustado para drogas lipofílicas. Peso Ideal para hidrofílicas. SEMPRE usar Peso Ideal para ventilação mecânica (6-8 mL/kg). Risco aumentado de via aérea difícil, SAHOS, e complicações cardiovasculares.';
    }
    
    document.getElementById('pesoRecommendation').textContent = recommendation;
    document.getElementById('pesoIdealResult').style.display = 'block';
}

function resetPesoIdeal() {
    document.getElementById('pesoIdealForm').reset();
    document.getElementById('pesoIdealResult').style.display = 'none';
}

// ==================== ÍNDICE DE ALDRETE E KROULIK ====================
function showAldrete() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Índice de Aldrete e Kroulik</h1>
            <p class="section-subtitle">Recuperação Pós-Anestésica (RPA)</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="aldreteForm" class="calc-form">
                    <!-- Atividade Motora -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-walking"></i> Atividade Motora
                        </label>
                        <select class="form-select" id="aldrete_motor" onchange="calcularAldrete()">
                            <option value="2">Move 4 extremidades voluntariamente (2 pontos)</option>
                            <option value="1">Move 2 extremidades voluntariamente (1 ponto)</option>
                            <option value="0">Incapaz de mover extremidades (0 ponto)</option>
                        </select>
                    </div>

                    <!-- Respiração -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-lungs"></i> Respiração
                        </label>
                        <select class="form-select" id="aldrete_respiracao" onchange="calcularAldrete()">
                            <option value="2">Respira profundamente e tosse (2 pontos)</option>
                            <option value="1">Dispneia ou limitação ventilatória (1 ponto)</option>
                            <option value="0">Apneia (0 ponto)</option>
                        </select>
                    </div>

                    <!-- Circulação -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-heartbeat"></i> Pressão Arterial
                        </label>
                        <select class="form-select" id="aldrete_pa" onchange="calcularAldrete()">
                            <option value="2">PA ± 20% do nível pré-anestésico (2 pontos)</option>
                            <option value="1">PA ± 20-50% do nível pré-anestésico (1 ponto)</option>
                            <option value="0">PA ± > 50% do nível pré-anestésico (0 ponto)</option>
                        </select>
                    </div>

                    <!-- Consciência -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-brain"></i> Consciência
                        </label>
                        <select class="form-select" id="aldrete_consciencia" onchange="calcularAldrete()">
                            <option value="2">Totalmente acordado (2 pontos)</option>
                            <option value="1">Acorda ao estímulo verbal (1 ponto)</option>
                            <option value="0">Não responde (0 ponto)</option>
                        </select>
                    </div>

                    <!-- Saturação -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-tint"></i> Saturação de O2
                        </label>
                        <select class="form-select" id="aldrete_spo2" onchange="calcularAldrete()">
                            <option value="2">SpO2 > 92% em ar ambiente (2 pontos)</option>
                            <option value="1">Necessita O2 para manter SpO2 > 90% (1 ponto)</option>
                            <option value="0">SpO2 < 90% mesmo com O2 (0 ponto)</option>
                        </select>
                    </div>

                    <div id="aldreteResult" class="result-box">
                        <h3>Resultado</h3>
                        <div class="score-display">
                            <span class="score-number" id="aldreteScore">10</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="aldreteRisk"></div>
                        <div class="risk-recommendation" id="aldreteRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="aldreteCurrentScore">10</span> pontos
                        </div>
                        <div class="score-status" id="aldreteStatus">
                            Alta da RPA
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetAldrete()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre o Índice de Aldrete</h3>
                <p>Avalia condições para alta da Sala de Recuperação Pós-Anestésica (RPA).</p>
                <h4>Critérios de Alta:</h4>
                <ul>
                    <li><strong>≥ 9 pontos:</strong> Apto para alta da RPA</li>
                    <li><strong>8 pontos:</strong> Considerar alta caso estável</li>
                    <li><strong>< 8 pontos:</strong> Manter em RPA</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    calcularAldrete();
}

function calcularAldrete() {
    const motor = parseInt(document.getElementById('aldrete_motor')?.value || 2);
    const respiracao = parseInt(document.getElementById('aldrete_respiracao')?.value || 2);
    const pa = parseInt(document.getElementById('aldrete_pa')?.value || 2);
    const consciencia = parseInt(document.getElementById('aldrete_consciencia')?.value || 2);
    const spo2 = parseInt(document.getElementById('aldrete_spo2')?.value || 2);
    
    const total = motor + respiracao + pa + consciencia + spo2;
    
    // Atualizar score tracker
    document.getElementById('aldreteCurrentScore').textContent = total;
    
    if (total >= 9) {
        document.getElementById('aldreteStatus').textContent = 'Alta da RPA';
    } else if (total >= 8) {
        document.getElementById('aldreteStatus').textContent = 'Avaliar Alta';
    } else {
        document.getElementById('aldreteStatus').textContent = 'Manter em RPA';
    }
    
    // Mostrar resultado
    const scoreDisplay = document.getElementById('aldreteScore');
    const riskDisplay = document.getElementById('aldreteRisk');
    const recommendationDisplay = document.getElementById('aldreteRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total >= 9) {
        riskLevel = 'Alta da RPA Liberada (≥ 9 pontos)';
        riskClass = 'risk-very-low';
        recommendation = '✅ ALTA DA RPA AUTORIZADA. Paciente apresenta condições adequadas para alta da sala de recuperação. Manter vigilância contínua. Orientar quanto a sinais de alerta. Fornecer analgesia adequada se necessário.';
    } else if (total >= 8) {
        riskLevel = 'Considerar Alta (8 pontos)';
        riskClass = 'risk-low';
        recommendation = '⚠️ ALTA PODE SER CONSIDERADA. Reavaliar em 15 minutos. Se score mantiver-se estável ≥ 8 pontos e sem intercorrências, pode considerar alta. Manter vigilância aumentada. Orientar cuidadores sobre sinais de alerta.';
    } else {
        riskLevel = 'Manter em RPA (< 8 pontos)';
        riskClass = 'risk-high';
        recommendation = '🚫 ALTA NÃO AUTORIZADA. Manter paciente em RPA. Reavaliar a cada 15 minutos. Identificar e tratar causas: dor, náusea, hipotensão, hipoxemia, sedação excessiva. Considerar causas de instabilidade hemodinâmica ou respiratória. Contatar anestesiologista se não houver melhora.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
}

function resetAldrete() {
    document.getElementById('aldrete_motor').value = 2;
    document.getElementById('aldrete_respiracao').value = 2;
    document.getElementById('aldrete_pa').value = 2;
    document.getElementById('aldrete_consciencia').value = 2;
    document.getElementById('aldrete_spo2').value = 2;
    calcularAldrete();
}

// ==================== ESCALA DE STEWARD ====================
function showSteward() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Escala de Steward</h1>
            <p class="section-subtitle">Recuperação Pós-Anestésica Pediátrica</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="stewardForm" class="calc-form">
                    <!-- Consciência -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-baby"></i> Consciência
                        </label>
                        <select class="form-select" id="steward_consciencia" onchange="calcularSteward()">
                            <option value="2">Acordado (2 pontos)</option>
                            <option value="1">Responde a estímulos (1 ponto)</option>
                            <option value="0">Não responde (0 ponto)</option>
                        </select>
                    </div>

                    <!-- Via Aérea -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-wind"></i> Via Aérea
                        </label>
                        <select class="form-select" id="steward_via_aerea" onchange="calcularSteward()">
                            <option value="2">Tosse sob comando ou chora (2 pontos)</option>
                            <option value="1">Mantém via aérea sem suporte (1 ponto)</option>
                            <option value="0">Necessita suporte de via aérea (0 ponto)</option>
                        </select>
                    </div>

                    <!-- Movimento -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-child"></i> Movimento
                        </label>
                        <select class="form-select" id="steward_movimento" onchange="calcularSteward()">
                            <option value="2">Move 4 membros voluntariamente (2 pontos)</option>
                            <option value="1">Move 2 membros voluntariamente (1 ponto)</option>
                            <option value="0">Não move membros (0 ponto)</option>
                        </select>
                    </div>

                    <div id="stewardResult" class="result-box">
                        <h3>Resultado</h3>
                        <div class="score-display">
                            <span class="score-number" id="stewardScore">6</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="stewardRisk"></div>
                        <div class="risk-recommendation" id="stewardRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="stewardCurrentScore">6</span> pontos
                        </div>
                        <div class="score-status" id="stewardStatus">
                            Alta da RPA
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetSteward()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre a Escala de Steward</h3>
                <p>Avalia recuperação pós-anestésica em pacientes pediátricos.</p>
                <h4>Critérios de Alta:</h4>
                <ul>
                    <li><strong>6 pontos:</strong> Alta da RPA liberada</li>
                    <li><strong>4-5 pontos:</strong> Reavaliar em 15 minutos</li>
                    <li><strong>< 4 pontos:</strong> Manter em RPA</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    calcularSteward();
}

function calcularSteward() {
    const consciencia = parseInt(document.getElementById('steward_consciencia')?.value || 2);
    const viaAerea = parseInt(document.getElementById('steward_via_aerea')?.value || 2);
    const movimento = parseInt(document.getElementById('steward_movimento')?.value || 2);
    
    const total = consciencia + viaAerea + movimento;
    
    // Atualizar score tracker
    document.getElementById('stewardCurrentScore').textContent = total;
    
    if (total >= 6) {
        document.getElementById('stewardStatus').textContent = 'Alta da RPA';
    } else if (total >= 4) {
        document.getElementById('stewardStatus').textContent = 'Reavaliar';
    } else {
        document.getElementById('stewardStatus').textContent = 'Manter em RPA';
    }
    
    // Mostrar resultado
    const scoreDisplay = document.getElementById('stewardScore');
    const riskDisplay = document.getElementById('stewardRisk');
    const recommendationDisplay = document.getElementById('stewardRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total === 6) {
        riskLevel = 'Alta da RPA Liberada (6 pontos)';
        riskClass = 'risk-very-low';
        recommendation = '✅ ALTA DA RPA AUTORIZADA. Criança apresenta recuperação completa. Alta para enfermaria ou sala de recuperação secundária. Orientar pais/responsáveis. Manter vigilância contínua. Analgesia adequada conforme prescrição.';
    } else if (total >= 4) {
        riskLevel = 'Reavaliar (4-5 pontos)';
        riskClass = 'risk-moderate';
        recommendation = '⚠️ REAVALIAR EM 15 MINUTOS. Criança em recuperação progressiva mas ainda não completamente desperta. Manter em RPA. Estimular despertar gradual. Avaliar dor e necessidade de analgesia. Verificar sinais vitais. Repetir score em 15 minutos.';
    } else {
        riskLevel = 'Manter em RPA (< 4 pontos)';
        riskClass = 'risk-high';
        recommendation = '🚫 ALTA NÃO AUTORIZADA. Manter criança em RPA com monitorização contínua. Avaliar causas de recuperação lenta: sedação excessiva, dor, obstrução de via aérea, hipoxemia. Contatar anestesiologista. Considerar antagonistas se indicado (flumazenil, naloxona). Reavaliar frequentemente.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
}

function resetSteward() {
    document.getElementById('steward_consciencia').value = 2;
    document.getElementById('steward_via_aerea').value = 2;
    document.getElementById('steward_movimento').value = 2;
    calcularSteward();
}

// ==================== ASA PHYSICAL STATUS ====================
function showASA() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">ASA Physical Status</h1>
            <p class="section-subtitle">Classificação do Estado Físico</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="text-align: center; margin-bottom: var(--spacing-lg); color: var(--primary-dark);">
                    Selecione a Classificação ASA
                </h3>
                
                <div id="asaForm">
                    <div class="risk-factor-card" onclick="selectASA(this, 1)">
                        <div class="card-content">
                            <div class="factor-icon">💚</div>
                            <div class="factor-text">
                                <strong>ASA I - Paciente Saudável</strong>
                                <span class="factor-points">Sem alteração fisiológica, bioquímica ou psiquiátrica</span>
                            </div>
                        </div>
                        <div class="card-check">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectASA(this, 2)">
                        <div class="card-content">
                            <div class="factor-icon">💛</div>
                            <div class="factor-text">
                                <strong>ASA II - Doença Sistêmica Leve</strong>
                                <span class="factor-points">HAS controlada, DM sem lesão órgão-alvo, tabagismo, obesidade leve</span>
                            </div>
                        </div>
                        <div class="card-check">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectASA(this, 3)">
                        <div class="card-content">
                            <div class="factor-icon">🧡</div>
                            <div class="factor-text">
                                <strong>ASA III - Doença Sistêmica Grave</strong>
                                <span class="factor-points">HAS mal controlada, DM com lesão órgão, DPOC, obesidade mórbida, IAM > 3m</span>
                            </div>
                        </div>
                        <div class="card-check">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectASA(this, 4)">
                        <div class="card-content">
                            <div class="factor-icon">❤️</div>
                            <div class="factor-text">
                                <strong>ASA IV - Ameaça Constante à Vida</strong>
                                <span class="factor-points">IAM < 3m, ICC grave, sepse, DIC, insuficiência renal/hepática grave</span>
                            </div>
                        </div>
                        <div class="card-check">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectASA(this, 5)">
                        <div class="card-content">
                            <div class="factor-icon">🖤</div>
                            <div class="factor-text">
                                <strong>ASA V - Moribundo</strong>
                                <span class="factor-points">Não sobrevive sem cirurgia (rotura AAA, trauma grave, hemorragia maciça)</span>
                            </div>
                        </div>
                        <div class="card-check">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectASA(this, 6)">
                        <div class="card-content">
                            <div class="factor-icon">🤍</div>
                            <div class="factor-text">
                                <strong>ASA VI - Morte Cerebral</strong>
                                <span class="factor-points">Doador de órgãos</span>
                            </div>
                        </div>
                        <div class="card-check">
                            <i class="fas fa-circle"></i>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: var(--spacing-lg) 0; padding: var(--spacing-md); background: var(--bg-light); border-radius: var(--radius-md);">
                        <p style="font-size: 14px; color: var(--text-secondary); margin: 0;">
                            <strong>Sufixo "E":</strong> Adicionar se cirurgia de emergência
                        </p>
                    </div>

                    <div id="asaResult" class="result-box" style="display: none;">
                        <h3>Classificação Selecionada</h3>
                        <div class="score-display">
                            <span class="score-number" id="asaScore">-</span>
                        </div>
                        <div class="risk-classification" id="asaRisk"></div>
                        <div class="risk-recommendation" id="asaRecommendation"></div>
                    </div>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre ASA Physical Status</h3>
                <p>Classificação da American Society of Anesthesiologists para avaliação pré-anestésica.</p>
                <h4>Importância:</h4>
                <ul>
                    <li>Padronização da comunicação entre profissionais</li>
                    <li>Preditor de morbimortalidade perioperatória</li>
                    <li>Planejamento anestésico-cirúrgico</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function selectASA(card, asa) {
    // Remover seleção anterior
    document.querySelectorAll('#asaForm .risk-factor-card').forEach(c => {
        c.classList.remove('selected');
        const icon = c.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    // Selecionar atual
    card.classList.add('selected');
    const icon = card.querySelector('.card-check i');
    icon.classList.remove('fa-circle');
    icon.classList.add('fa-check-circle');
    
    // Mostrar resultado
    const scoreDisplay = document.getElementById('asaScore');
    const riskDisplay = document.getElementById('asaRisk');
    const recommendationDisplay = document.getElementById('asaRecommendation');
    
    scoreDisplay.textContent = `ASA ${asa}`;
    
    const classifications = [
        { level: 'Paciente Saudável', class: 'risk-very-low', rec: 'Paciente sem alterações sistêmicas. Anestesia de rotina. Baixíssimo risco perioperatório.' },
        { level: 'Doença Sistêmica Leve', class: 'risk-low', rec: 'Doença sistêmica leve sem limitação funcional. Otimizar condições clínicas. Risco perioperatório baixo.' },
        { level: 'Doença Sistêmica Grave', class: 'risk-moderate', rec: 'Doença grave com limitação funcional mas não incapacitante. OTIMIZAÇÃO pré-operatória mandatória. Avaliação especializada. Monitorização intensiva. Risco perioperatório moderado a alto.' },
        { level: 'Ameaça Constante à Vida', class: 'risk-high', rec: 'Doença grave incapacitante com ameaça constante à vida. Otimização PRÉ-operatória ESSENCIAL. Consulta especializada obrigatória. Monitorização invasiva. UTI pós-operatória. Risco perioperatório muito alto.' },
        { level: 'Moribundo', class: 'risk-very-high', rec: 'Paciente moribundo que não sobrevive sem cirurgia. Cirurgia de EMERGÊNCIA para salvar vida. Preparação e ressuscitação simultâneas. Monitorização invasiva completa. UTI pós. Risco de morte perioperatória > 50%.' },
        { level: 'Morte Cerebral', class: 'risk-very-high', rec: 'Morte cerebral declarada. Doador de órgãos. Manutenção hemodinâmica para preservação de órgãos. Protocolo específico de doação.' }
    ];
    
    const info = classifications[asa - 1];
    
    riskDisplay.className = `risk-classification ${info.class}`;
    riskDisplay.textContent = `ASA ${asa} - ${info.level}`;
    recommendationDisplay.textContent = info.rec;
    
    document.getElementById('asaResult').style.display = 'block';
}

// ==================== CONVERSÃO DE OPIOIDES ====================
function showConversaoOpioides() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Conversão de Opioides</h1>
            <p class="section-subtitle">Equianalgesia de Opioides</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="opioideForm" class="calc-form">
                    <!-- Opioide Origem -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-pills"></i> Opioide Atual
                        </label>
                        <select class="form-select" id="opioide_origem" onchange="calcularConversaoOpioide()">
                            <option value="">Selecione...</option>
                            <option value="morfina_oral">Morfina Oral</option>
                            <option value="morfina_iv">Morfina IV/SC</option>
                            <option value="codeina">Codeína Oral</option>
                            <option value="tramadol">Tramadol Oral</option>
                            <option value="oxicodona">Oxicodona Oral</option>
                            <option value="metadona">Metadona Oral</option>
                            <option value="fentanil_td">Fentanil Transdérmico (mcg/h)</option>
                        </select>
                    </div>

                    <!-- Dose Atual -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-calculator"></i> Dose Atual (mg/24h ou mcg/h)
                        </label>
                        <input type="number" class="form-select" id="dose_atual" placeholder="Ex: 60" 
                               min="0" step="0.1" onchange="calcularConversaoOpioide()">
                    </div>

                    <!-- Opioide Destino -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-exchange-alt"></i> Converter Para
                        </label>
                        <select class="form-select" id="opioide_destino" onchange="calcularConversaoOpioide()">
                            <option value="">Selecione...</option>
                            <option value="morfina_oral">Morfina Oral</option>
                            <option value="morfina_iv">Morfina IV/SC</option>
                            <option value="oxicodona">Oxicodona Oral</option>
                            <option value="metadona">Metadona Oral</option>
                            <option value="fentanil_td">Fentanil Transdérmico (mcg/h)</option>
                        </select>
                    </div>

                    <div id="opioideResult" class="result-box" style="display: none;">
                        <h3>Conversão Calculada</h3>
                        <div class="calc-result-item">
                            <div class="result-label">Equivalente de Morfina Oral</div>
                            <div class="result-value" id="morfinaEquivalente">-</div>
                        </div>
                        <div class="calc-result-item">
                            <div class="result-label">Dose Convertida</div>
                            <div class="result-value" id="doseConvertida" style="font-size: 24px; color: var(--primary-dark);">-</div>
                        </div>
                        <div class="risk-recommendation" id="opioideRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetOpioide()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Tabela de Equianalgesia</h3>
                <ul style="font-size: 13px;">
                    <li>Morfina 30mg VO = Morfina 10mg IV = 1x</li>
                    <li>Codeína 200mg VO = 1x</li>
                    <li>Tramadol 300mg VO = 1x</li>
                    <li>Oxicodona 20mg VO = 1x</li>
                    <li>Fentanil 25 mcg/h TD = 1x</li>
                    <li>Metadona: varia (1:4 até 1:20)</li>
                </ul>
                <p style="font-size: 13px; margin-top: var(--spacing-sm);"><strong>⚠️ Reduzir 25-50% da dose calculada ao rotacionar para evitar toxicidade!</strong></p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularConversaoOpioide() {
    const origem = document.getElementById('opioide_origem').value;
    const dose = parseFloat(document.getElementById('dose_atual').value);
    const destino = document.getElementById('opioide_destino').value;
    
    if (!origem || !dose || !destino || dose <= 0) {
        document.getElementById('opioideResult').style.display = 'none';
        return;
    }
    
    // Fatores de conversão para morfina oral equivalente
    const fatores = {
        'morfina_oral': 1,
        'morfina_iv': 3,
        'codeina': 0.15,
        'tramadol': 0.1,
        'oxicodona': 1.5,
        'metadona': 4, // Aproximado, varia muito
        'fentanil_td': 2.4 // mcg/h para mg morfina oral/24h
    };
    
    // Converter para morfina oral equivalente
    const morfinaEq = dose * fatores[origem];
    
    // Converter para opioide destino
    const doseDestino = morfinaEq / fatores[destino];
    
    // Redução de 25% por segurança
    const doseSegura = doseDestino * 0.75;
    
    // Exibir resultados
    document.getElementById('morfinaEquivalente').textContent = `${morfinaEq.toFixed(1)} mg/24h`;
    
    let unidade = origem.includes('fentanil_td') || destino.includes('fentanil_td') ? ' mcg/h' : ' mg/24h';
    document.getElementById('doseConvertida').textContent = `${doseSegura.toFixed(1)}${unidade}`;
    
    let recommendation = `⚠️ DOSE CALCULADA COM REDUÇÃO DE 25% POR SEGURANÇA. Iniciar com dose reduzida e titular conforme resposta. Monitorizar sedação, frequência respiratória e dor. Risco de depressão respiratória nas primeiras 24-48h. Ter naloxona disponível.`;
    
    if (destino === 'metadona' || origem === 'metadona') {
        recommendation += ` \n\n🚨 ATENÇÃO METADONA: Meia-vida longa (8-59h). Risco de acúmulo. Iniciar com doses BAIXAS. Titular lentamente (a cada 3-5 dias). Pode causar prolongamento QT. ECG basal recomendado.`;
    }
    
    document.getElementById('opioideRecommendation').textContent = recommendation;
    document.getElementById('opioideResult').style.display = 'block';
}

function resetOpioide() {
    document.getElementById('opioideForm').reset();
    document.getElementById('opioideResult').style.display = 'none';
}

// ==================== DOSE MÁXIMA ANESTÉSICO LOCAL ====================
function showDoseMaxAL() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Dose Máxima de Anestésico Local</h1>
            <p class="section-subtitle">Prevenir Toxicidade Sistêmica</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="alForm" class="calc-form">
                    <!-- Peso -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-weight"></i> Peso do Paciente (kg)
                        </label>
                        <input type="number" class="form-select" id="peso_al" placeholder="Ex: 70" 
                               min="1" max="200" onchange="calcularDoseMaxAL()">
                    </div>

                    <!-- Anestésico -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-syringe"></i> Anestésico Local
                        </label>
                        <select class="form-select" id="anestesico" onchange="calcularDoseMaxAL()">
                            <option value="">Selecione...</option>
                            <option value="lidocaina">Lidocaína sem Vasoconstritor</option>
                            <option value="lidocaina_epi">Lidocaína com Epinefrina</option>
                            <option value="bupivacaina">Bupivacaína sem Vasoconstritor</option>
                            <option value="bupivacaina_epi">Bupivacaína com Epinefrina</option>
                            <option value="ropivacaina">Ropivacaína</option>
                            <option value="levobupivacaina">Levobupivacaína</option>
                            <option value="prilocaina">Prilocaína</option>
                            <option value="mepivacaina">Mepivacaína</option>
                        </select>
                    </div>

                    <!-- Concentração -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-flask"></i> Concentração (%)
                        </label>
                        <select class="form-select" id="concentracao" onchange="calcularDoseMaxAL()">
                            <option value="">Selecione...</option>
                            <option value="0.25">0.25%</option>
                            <option value="0.5">0.5%</option>
                            <option value="0.75">0.75%</option>
                            <option value="1">1%</option>
                            <option value="1.5">1.5%</option>
                            <option value="2">2%</option>
                        </select>
                    </div>

                    <div id="alResult" class="result-box" style="display: none;">
                        <h3>Doses Máximas Calculadas</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Dose Máxima (mg)</div>
                            <div class="result-value" id="dosemaxMg" style="font-size: 24px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Volume Máximo (mL)</div>
                            <div class="result-value" id="dosemaxMl" style="font-size: 24px; color: var(--primary-dark);">-</div>
                        </div>

                        <div class="risk-recommendation" id="alRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetAL()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Doses Máximas Recomendadas</h3>
                <ul style="font-size: 13px;">
                    <li><strong>Lidocaína:</strong> 4.5 mg/kg (sem epi) | 7 mg/kg (com epi)</li>
                    <li><strong>Bupivacaína:</strong> 2 mg/kg (sem epi) | 2.5 mg/kg (com epi)</li>
                    <li><strong>Ropivacaína:</strong> 3 mg/kg</li>
                    <li><strong>Levobupivacaína:</strong> 2.5 mg/kg</li>
                    <li><strong>Prilocaína:</strong> 6 mg/kg</li>
                    <li><strong>Mepivacaína:</strong> 5 mg/kg</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularDoseMaxAL() {
    const peso = parseFloat(document.getElementById('peso_al').value);
    const anestesico = document.getElementById('anestesico').value;
    const concentracao = parseFloat(document.getElementById('concentracao').value);
    
    if (!peso || !anestesico || !concentracao || peso <= 0) {
        document.getElementById('alResult').style.display = 'none';
        return;
    }
    
    // Doses máximas em mg/kg
    const dosesMax = {
        'lidocaina': 4.5,
        'lidocaina_epi': 7,
        'bupivacaina': 2,
        'bupivacaina_epi': 2.5,
        'ropivacaina': 3,
        'levobupivacaina': 2.5,
        'prilocaina': 6,
        'mepivacaina': 5
    };
    
    const doseMaxKg = dosesMax[anestesico];
    const doseMaxMg = doseMaxKg * peso;
    
    // 1% = 10mg/mL
    const mgPorMl = concentracao * 10;
    const volumeMaxMl = doseMaxMg / mgPorMl;
    
    document.getElementById('dosemaxMg').textContent = `${doseMaxMg.toFixed(0)} mg`;
    document.getElementById('dosemaxMl').textContent = `${volumeMaxMl.toFixed(1)} mL`;
    
    let recommendation = `⚠️ NÃO EXCEDER estas doses. Aspirar antes de injetar. Injeção lenta e fracionada. Monitorizar paciente continuamente. `;
    
    recommendation += `\n\n🚨 SINAIS DE TOXICIDADE: Gosto metálico, zumbido, tonteira, convulsão, arritmias, colapso cardiovascular. TRATAMENTO: Lipídio 20% (bolo 1.5 mL/kg + infusão 0.25 mL/kg/min). Suporte avançado de vida.`;
    
    document.getElementById('alRecommendation').textContent = recommendation;
    document.getElementById('alResult').style.display = 'block';
}

function resetAL() {
    document.getElementById('alForm').reset();
    document.getElementById('alResult').style.display = 'none';
}

// ==================== MANUTENÇÃO HÍDRICA PEDIÁTRICA ====================
function showManutencaoPediatrica() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Manutenção Hídrica Pediátrica</h1>
            <p class="section-subtitle">Regra de Holliday-Segar</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="manutencaoForm" class="calc-form">
                    <!-- Peso -->
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-baby"></i> Peso da Criança (kg)
                        </label>
                        <input type="number" class="form-select" id="peso_manutencao" placeholder="Ex: 15" 
                               min="1" max="100" step="0.1" onchange="calcularManutencao()">
                    </div>

                    <div id="manutencaoResult" class="result-box" style="display: none;">
                        <h3>Necessidades Hídricas</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Manutenção 24h</div>
                            <div class="result-value" id="manut24h">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Manutenção/Hora</div>
                            <div class="result-value" id="manutHora" style="font-size: 24px; color: var(--primary-dark);">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Reposição Jejum (mL)</div>
                            <div class="result-value" id="jejumReposicao">-</div>
                        </div>

                        <div class="risk-recommendation" id="manutencaoRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetManutencao()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Regra de Holliday-Segar</h3>
                <ul style="font-size: 13px;">
                    <li><strong>0-10 kg:</strong> 100 mL/kg/dia (4 mL/kg/h)</li>
                    <li><strong>11-20 kg:</strong> 1000 mL + 50 mL/kg/dia para cada kg > 10kg</li>
                    <li><strong>> 20 kg:</strong> 1500 mL + 20 mL/kg/dia para cada kg > 20kg</li>
                </ul>
                <h4>Reposição de Jejum:</h4>
                <p style="font-size: 13px;">
                    <strong>1ª hora:</strong> 50% do déficit + manutenção<br>
                    <strong>2ª hora:</strong> 25% do déficit + manutenção<br>
                    <strong>3ª hora:</strong> 25% do déficit + manutenção
                </p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularManutencao() {
    const peso = parseFloat(document.getElementById('peso_manutencao').value);
    
    if (!peso || peso <= 0) {
        document.getElementById('manutencaoResult').style.display = 'none';
        return;
    }
    
    let manutencao24h, manutencaoHora;
    
    // Regra de Holliday-Segar
    if (peso <= 10) {
        manutencao24h = peso * 100;
        manutencaoHora = peso * 4;
    } else if (peso <= 20) {
        manutencao24h = 1000 + (peso - 10) * 50;
        manutencaoHora = 40 + (peso - 10) * 2;
    } else {
        manutencao24h = 1500 + (peso - 20) * 20;
        manutencaoHora = 60 + (peso - 20) * 1;
    }
    
    // Jejum de 8 horas (exemplo)
    const horasJejum = 8;
    const deficit = manutencaoHora * horasJejum;
    const reposicao1h = deficit * 0.5 + manutencaoHora;
    const reposicao2h = deficit * 0.25 + manutencaoHora;
    
    document.getElementById('manut24h').textContent = `${manutencao24h.toFixed(0)} mL`;
    document.getElementById('manutHora').textContent = `${manutencaoHora.toFixed(1)} mL/h`;
    document.getElementById('jejumReposicao').textContent = `1ªh: ${reposicao1h.toFixed(0)}mL | 2ªh: ${reposicao2h.toFixed(0)}mL | 3ªh: ${reposicao2h.toFixed(0)}mL`;
    
    let recommendation = `💧 Utilizar soluções balanceadas (Ringer Lactato ou Plasmalyte). Evitar soro glicosado isolado em > 1 ano. Monitorizar glicemia, diurese e sinais de sobrecarga. Ajustar conforme perdas cirúrgicas e estado clínico.`;
    
    document.getElementById('manutencaoRecommendation').textContent = recommendation;
    document.getElementById('manutencaoResult').style.display = 'block';
}

function resetManutencao() {
    document.getElementById('manutencaoForm').reset();
    document.getElementById('manutencaoResult').style.display = 'none';
}

// Exportar função para window
window.showManutencaoPediatrica = showManutencaoPediatrica;
window.calcularManutencao = calcularManutencao;
window.resetManutencao = resetManutencao;

console.log('✅ Calculadoras extras carregadas');

