// ==================== CALCULADORAS MÉDICAS AVANÇADAS ====================
// Este arquivo contém calculadoras clínicas baseadas em evidências

// ==================== ARISCAT SCORE ====================
function showARISCAT() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">ARISCAT Score</h1>
            <p class="section-subtitle">Risco de Complicações Pulmonares Pós-Operatórias</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="ariscatForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-birthday-cake"></i> Idade</label>
                        <select class="form-select" id="ariscat_idade" onchange="calcularARISCAT()">
                            <option value="0">≤ 50 anos (0 pontos)</option>
                            <option value="3">51-80 anos (3 pontos)</option>
                            <option value="16">> 80 anos (16 pontos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-lungs"></i> SpO2 Pré-operatória</label>
                        <select class="form-select" id="ariscat_spo2" onchange="calcularARISCAT()">
                            <option value="0">≥ 96% (0 pontos)</option>
                            <option value="8">91-95% (8 pontos)</option>
                            <option value="24">≤ 90% (24 pontos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-virus"></i> Infecção Respiratória no Último Mês</label>
                        <select class="form-select" id="ariscat_infeccao" onchange="calcularARISCAT()">
                            <option value="0">Não (0 pontos)</option>
                            <option value="17">Sim (17 pontos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-tint"></i> Hemoglobina Pré-operatória</label>
                        <select class="form-select" id="ariscat_hb" onchange="calcularARISCAT()">
                            <option value="0">≥ 10 g/dL (0 pontos)</option>
                            <option value="11">< 10 g/dL (11 pontos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-procedures"></i> Incisão Cirúrgica</label>
                        <select class="form-select" id="ariscat_incisao" onchange="calcularARISCAT()">
                            <option value="0">Periférica (0 pontos)</option>
                            <option value="15">Abdominal superior (15 pontos)</option>
                            <option value="24">Intratorácica (24 pontos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-clock"></i> Duração da Cirurgia</label>
                        <select class="form-select" id="ariscat_duracao" onchange="calcularARISCAT()">
                            <option value="0">< 2 horas (0 pontos)</option>
                            <option value="16">2-3 horas (16 pontos)</option>
                            <option value="23">> 3 horas (23 pontos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-exclamation-triangle"></i> Cirurgia de Emergência</label>
                        <select class="form-select" id="ariscat_emergencia" onchange="calcularARISCAT()">
                            <option value="0">Não (0 pontos)</option>
                            <option value="8">Sim (8 pontos)</option>
                        </select>
                    </div>

                    <div id="ariscatResult" class="result-box">
                        <h3>Resultado</h3>
                        <div class="score-display">
                            <span class="score-number" id="ariscatScore">0</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="ariscatRisk"></div>
                        <div class="risk-recommendation" id="ariscatRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetARISCAT()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre ARISCAT</h3>
                <p>Prediz complicações pulmonares pós-operatórias (pneumonia, insuficiência respiratória, broncoespasmo).</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>< 26 pontos:</strong> Baixo risco (1.6%)</li>
                    <li><strong>26-44 pontos:</strong> Risco intermediário (13.3%)</li>
                    <li><strong>≥ 45 pontos:</strong> Alto risco (42.1%)</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    calcularARISCAT();
}

function calcularARISCAT() {
    const idade = parseInt(document.getElementById('ariscat_idade')?.value || 0);
    const spo2 = parseInt(document.getElementById('ariscat_spo2')?.value || 0);
    const infeccao = parseInt(document.getElementById('ariscat_infeccao')?.value || 0);
    const hb = parseInt(document.getElementById('ariscat_hb')?.value || 0);
    const incisao = parseInt(document.getElementById('ariscat_incisao')?.value || 0);
    const duracao = parseInt(document.getElementById('ariscat_duracao')?.value || 0);
    const emergencia = parseInt(document.getElementById('ariscat_emergencia')?.value || 0);
    
    const total = idade + spo2 + infeccao + hb + incisao + duracao + emergencia;
    
    document.getElementById('ariscatScore').textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total < 26) {
        riskLevel = 'Baixo Risco (1.6%)';
        riskClass = 'risk-low';
        recommendation = 'Risco baixo de complicações pulmonares. Fisioterapia respiratória padrão. Analgesia adequada. Deambulação precoce. Evitar sedação excessiva.';
    } else if (total <= 44) {
        riskLevel = 'Risco Intermediário (13.3%)';
        riskClass = 'risk-moderate';
        recommendation = 'Risco intermediário. FISIOTERAPIA INTENSIVA pré e pós-operatória. Espirometria de incentivo. Analgesia multimodal para facilitar tosse. Considerar VNI pós-operatória. Monitorização intensiva nas primeiras 48h.';
    } else {
        riskLevel = 'Alto Risco (42.1%)';
        riskClass = 'risk-high';
        recommendation = 'ALTO RISCO de complicações pulmonares. Otimização pré-operatória MANDATÓRIA. Fisioterapia intensiva. Ventilação protetora intraoperatória (6-8 mL/kg). VNI profilática pós-op. Analgesia epidural/bloqueios. UTI pós-operatória. Monitorização contínua 72h.';
    }
    
    document.getElementById('ariscatRisk').className = `risk-classification ${riskClass}`;
    document.getElementById('ariscatRisk').textContent = riskLevel;
    document.getElementById('ariscatRecommendation').textContent = recommendation;
}

function resetARISCAT() {
    document.getElementById('ariscatForm').reset();
    calcularARISCAT();
}

// ==================== RASS (Richmond Agitation-Sedation Scale) ====================
function showRASS() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">RASS</h1>
            <p class="section-subtitle">Richmond Agitation-Sedation Scale</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="text-align: center; margin-bottom: var(--spacing-lg); color: var(--primary-dark);">
                    Selecione o Nível de Sedação/Agitação
                </h3>
                
                <div id="rassForm">
                    <!-- Agitação -->
                    <div style="background: #fee2e2; padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                        <h4 style="color: #991b1b; margin: 0 0 var(--spacing-sm) 0;"><i class="fas fa-exclamation-triangle"></i> Agitação</h4>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, 4, 'Combativo')">
                            <div class="card-content">
                                <div class="factor-icon">🤬</div>
                                <div class="factor-text">
                                    <strong>+4 Combativo</strong>
                                    <span class="factor-points">Combativo, violento, risco para equipe</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, 3, 'Muito agitado')">
                            <div class="card-content">
                                <div class="factor-icon">😠</div>
                                <div class="factor-text">
                                    <strong>+3 Muito agitado</strong>
                                    <span class="factor-points">Puxa/remove tubos ou cateteres, agressivo</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, 2, 'Agitado')">
                            <div class="card-content">
                                <div class="factor-icon">😤</div>
                                <div class="factor-text">
                                    <strong>+2 Agitado</strong>
                                    <span class="factor-points">Movimentos não propositais frequentes, luta com ventilador</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, 1, 'Inquieto')">
                            <div class="card-content">
                                <div class="factor-icon">😟</div>
                                <div class="factor-text">
                                    <strong>+1 Inquieto</strong>
                                    <span class="factor-points">Ansioso mas movimentos não agressivos/vigorosos</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                    </div>

                    <!-- Alerta -->
                    <div style="background: #d1fae5; padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                        <h4 style="color: #065f46; margin: 0 0 var(--spacing-sm) 0;"><i class="fas fa-check-circle"></i> Alerta e Calmo</h4>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, 0, 'Alerta e calmo')">
                            <div class="card-content">
                                <div class="factor-icon">😊</div>
                                <div class="factor-text">
                                    <strong>0 Alerta e calmo</strong>
                                    <span class="factor-points">Espontaneamente atento, apropriado</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                    </div>

                    <!-- Sedação -->
                    <div style="background: #dbeafe; padding: var(--spacing-md); border-radius: var(--radius-md);">
                        <h4 style="color: #1e40af; margin: 0 0 var(--spacing-sm) 0;"><i class="fas fa-bed"></i> Sedação</h4>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, -1, 'Sonolento')">
                            <div class="card-content">
                                <div class="factor-icon">😌</div>
                                <div class="factor-text">
                                    <strong>-1 Sonolento</strong>
                                    <span class="factor-points">Não totalmente alerta, mas acordado (≥ 10s) ao chamado verbal</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, -2, 'Sedação leve')">
                            <div class="card-content">
                                <div class="factor-icon">😴</div>
                                <div class="factor-text">
                                    <strong>-2 Sedação leve</strong>
                                    <span class="factor-points">Acorda rapidamente (< 10s) ao chamado verbal</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, -3, 'Sedação moderada')">
                            <div class="card-content">
                                <div class="factor-icon">😪</div>
                                <div class="factor-text">
                                    <strong>-3 Sedação moderada</strong>
                                    <span class="factor-points">Movimento ou abertura ocular ao chamado verbal (mas sem contato visual)</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, -4, 'Sedação profunda')">
                            <div class="card-content">
                                <div class="factor-icon">😵</div>
                                <div class="factor-text">
                                    <strong>-4 Sedação profunda</strong>
                                    <span class="factor-points">Sem resposta à voz, mas movimento/abertura ocular ao estímulo físico</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="selectRASS(this, -5, 'Coma')">
                            <div class="card-content">
                                <div class="factor-icon">💤</div>
                                <div class="factor-text">
                                    <strong>-5 Coma</strong>
                                    <span class="factor-points">Sem resposta à voz ou estímulo físico</span>
                                </div>
                            </div>
                            <div class="card-check"><i class="fas fa-circle"></i></div>
                        </div>
                    </div>

                    <div id="rassResult" class="result-box" style="display: none;">
                        <h3>Avaliação RASS</h3>
                        <div class="score-display">
                            <span class="score-number" id="rassScore">0</span>
                        </div>
                        <div class="risk-classification" id="rassRisk"></div>
                        <div class="risk-recommendation" id="rassRecommendation"></div>
                    </div>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre RASS</h3>
                <p>Escala validada para avaliação de sedação e agitação em UTI e RPA.</p>
                <h4>Alvo de Sedação:</h4>
                <ul>
                    <li><strong>Pós-operatório:</strong> 0 a -1</li>
                    <li><strong>UTI ventilado:</strong> -2 a -3</li>
                    <li><strong>Bloqueio neuromuscular:</strong> -4 a -5</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function selectRASS(card, score, label) {
    document.querySelectorAll('#rassForm .risk-factor-card').forEach(c => {
        c.classList.remove('selected');
        const icon = c.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    card.classList.add('selected');
    const icon = card.querySelector('.card-check i');
    icon.classList.remove('fa-circle');
    icon.classList.add('fa-check-circle');
    
    const scoreDisplay = document.getElementById('rassScore');
    const riskDisplay = document.getElementById('rassRisk');
    const recommendationDisplay = document.getElementById('rassRecommendation');
    
    let displayScore = score >= 0 ? `+${score}` : score;
    scoreDisplay.textContent = displayScore;
    
    let riskClass, recommendation;
    
    if (score >= 2) {
        riskClass = 'risk-high';
        recommendation = '🚨 AGITAÇÃO SIGNIFICATIVA. Avaliar causas: dor, delirium, hipoxemia, retenção urinária, ansiedade. Tratar causa subjacente. Considerar sedação se necessário. Protocolar uso de contenções se risco de auto-extubação.';
    } else if (score === 1) {
        riskClass = 'risk-moderate';
        recommendation = '⚠️ Paciente inquieto. Avaliar conforto, dor, ansiedade. Reorientação. Considerar sedação leve se necessário.';
    } else if (score === 0) {
        riskClass = 'risk-very-low';
        recommendation = '✅ IDEAL. Paciente alerta e calmo. Manter vigilância. Facilita desmame ventilatório.';
    } else if (score >= -1) {
        riskClass = 'risk-low';
        recommendation = '✅ Sedação leve adequada para pós-operatório. Manter. Facilita interação e avaliação.';
    } else if (score >= -3) {
        riskClass = 'risk-moderate';
        recommendation = '⚠️ Sedação moderada. Adequada para ventilação mecânica. Avaliar necessidade diária. Tentativas de despertar diário.';
    } else {
        riskClass = 'risk-high';
        recommendation = '🚨 SEDAÇÃO PROFUNDA/COMA. Revisar necessidade. Considerar redução gradual de sedação salvo contraindicação. Avaliar necessidade de bloqueio neuromuscular.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = `RASS ${displayScore} - ${label}`;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('rassResult').style.display = 'block';
}

// ==================== CLEARANCE DE CREATININA ====================
function showClearanceCreatinina() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Clearance de Creatinina</h1>
            <p class="section-subtitle">Cockcroft-Gault e CKD-EPI</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="clearanceForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-birthday-cake"></i> Idade (anos)</label>
                        <input type="number" class="form-select" id="clear_idade" placeholder="Ex: 65" 
                               min="18" max="120" onchange="calcularClearance()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-venus-mars"></i> Sexo</label>
                        <select class="form-select" id="clear_sexo" onchange="calcularClearance()">
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-weight"></i> Peso (kg)</label>
                        <input type="number" class="form-select" id="clear_peso" placeholder="Ex: 70" 
                               min="30" max="200" step="0.1" onchange="calcularClearance()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-vial"></i> Creatinina Sérica (mg/dL)</label>
                        <input type="number" class="form-select" id="clear_creatinina" placeholder="Ex: 1.2" 
                               min="0.1" max="15" step="0.1" onchange="calcularClearance()">
                    </div>

                    <div id="clearanceResult" class="result-box" style="display: none;">
                        <h3>Resultados</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Clearance (Cockcroft-Gault)</div>
                            <div class="result-value" id="clearanceCG">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Estágio DRC</div>
                            <div class="result-value" id="clearanceEstagio" style="font-size: 18px;">-</div>
                        </div>

                        <div class="risk-recommendation" id="clearanceRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetClearance()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Estágios da DRC</h3>
                <ul style="font-size: 13px;">
                    <li><strong>G1:</strong> ≥ 90 mL/min - Normal</li>
                    <li><strong>G2:</strong> 60-89 mL/min - Leve</li>
                    <li><strong>G3a:</strong> 45-59 mL/min - Moderada</li>
                    <li><strong>G3b:</strong> 30-44 mL/min - Moderada a grave</li>
                    <li><strong>G4:</strong> 15-29 mL/min - Grave</li>
                    <li><strong>G5:</strong> < 15 mL/min - Falência renal</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularClearance() {
    const idade = parseInt(document.getElementById('clear_idade').value);
    const sexo = document.getElementById('clear_sexo').value;
    const peso = parseFloat(document.getElementById('clear_peso').value);
    const creatinina = parseFloat(document.getElementById('clear_creatinina').value);
    
    if (!idade || !peso || !creatinina || idade < 18 || peso < 30 || creatinina < 0.1) {
        document.getElementById('clearanceResult').style.display = 'none';
        return;
    }
    
    // Cockcroft-Gault
    let clearance = ((140 - idade) * peso) / (72 * creatinina);
    if (sexo === 'F') {
        clearance *= 0.85;
    }
    
    document.getElementById('clearanceCG').textContent = `${clearance.toFixed(1)} mL/min`;
    
    let estagio, recommendation;
    
    if (clearance >= 90) {
        estagio = 'G1 - Normal';
        recommendation = '✅ Função renal normal. Dose padrão de medicamentos. Manter hidratação adequada.';
    } else if (clearance >= 60) {
        estagio = 'G2 - DRC Leve';
        recommendation = '✅ DRC leve. Dose padrão da maioria dos medicamentos. Evitar nefrotóxicos desnecessários (AINEs, contraste). Hidratar adequadamente.';
    } else if (clearance >= 45) {
        estagio = 'G3a - DRC Moderada';
        recommendation = '⚠️ DRC moderada. AJUSTAR doses de drogas com eliminação renal (morfina, gabapentina, HBPM, antibióticos). Evitar AINEs. Cuidado com contraste. Considerar nefrologista.';
    } else if (clearance >= 30) {
        estagio = 'G3b - DRC Moderada a Grave';
        recommendation = '⚠️ DRC moderada a grave. AJUSTE OBRIGATÓRIO de doses. Evitar metformina, AINEs. Preferir fentanil/remifentanil ao invés de morfina. Cuidado com relaxantes. Consultar nefrologista.';
    } else if (clearance >= 15) {
        estagio = 'G4 - DRC Grave';
        recommendation = '🚨 DRC GRAVE. Ajuste rigoroso de doses. Evitar morfina (usar fentanil). Evitar succinilcolina (risco de hipercalemia). Monitorizar K+. Consulta nefrologia obrigatória. Considerar risco de necessidade de diálise pós-op.';
    } else {
        estagio = 'G5 - Falência Renal';
        recommendation = '🚨 FALÊNCIA RENAL. Paciente provavelmente em diálise. Programar diálise pré-operatória (idealmente no dia anterior). Usar apenas drogas sem eliminação renal (fentanil, remifentanil, atracúrio, cisatracúrio). Monitorizar K+ rigorosamente. Nefrologia obrigatória.';
    }
    
    document.getElementById('clearanceEstagio').textContent = estagio;
    document.getElementById('clearanceRecommendation').textContent = recommendation;
    document.getElementById('clearanceResult').style.display = 'block';
}

function resetClearance() {
    document.getElementById('clearanceForm').reset();
    document.getElementById('clearanceResult').style.display = 'none';
}

// ==================== MALLAMPATI E VIA AÉREA ====================
function showMallampati() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Avaliação de Via Aérea</h1>
            <p class="section-subtitle">Predição de Intubação Difícil</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="text-align: center; margin-bottom: var(--spacing-md); color: var(--primary-dark);">
                    Classificação de Mallampati
                </h3>
                
                <div id="mallampatiForm">
                    <div class="risk-factor-card" onclick="selectMallampati(this, 1)">
                        <div class="card-content">
                            <div class="factor-icon">👄</div>
                            <div class="factor-text">
                                <strong>Classe I</strong>
                                <span class="factor-points">Visualização completa de palato, úvula, pilares amigdalianos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectMallampati(this, 2)">
                        <div class="card-content">
                            <div class="factor-icon">👅</div>
                            <div class="factor-text">
                                <strong>Classe II</strong>
                                <span class="factor-points">Visualização de palato e úvula, mas não pilares</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectMallampati(this, 3)">
                        <div class="card-content">
                            <div class="factor-icon">🦷</div>
                            <div class="factor-text">
                                <strong>Classe III</strong>
                                <span class="factor-points">Visualização apenas de palato mole e base da úvula</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>
                    
                    <div class="risk-factor-card" onclick="selectMallampati(this, 4)">
                        <div class="card-content">
                            <div class="factor-icon">😬</div>
                            <div class="factor-text">
                                <strong>Classe IV</strong>
                                <span class="factor-points">Palato mole não visível</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>
                </div>

                <div id="mallampatiResult" class="result-box" style="display: none; margin-top: var(--spacing-lg);">
                    <h3>Avaliação de Via Aérea</h3>
                    <div class="score-display">
                        <span class="score-number" id="mallampatiScore">-</span>
                    </div>
                    <div class="risk-classification" id="mallampatiRisk"></div>
                    <div class="risk-recommendation" id="mallampatiRecommendation"></div>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Avaliação Completa de Via Aérea</h3>
                <h4>Outros Fatores a Avaliar:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Abertura bucal:</strong> < 3cm = difícil</li>
                    <li><strong>Dist. tireomentoniana:</strong> < 6cm = difícil</li>
                    <li><strong>Circunf. pescoço:</strong> > 40cm = difícil</li>
                    <li><strong>Protrusão mandibular:</strong> Incapaz = difícil</li>
                    <li><strong>História prévia:</strong> Intubação difícil</li>
                    <li><strong>Síndromes:</strong> Pierre Robin, Treacher Collins</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function selectMallampati(card, classe) {
    document.querySelectorAll('#mallampatiForm .risk-factor-card').forEach(c => {
        c.classList.remove('selected');
        const icon = c.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    card.classList.add('selected');
    const icon = card.querySelector('.card-check i');
    icon.classList.remove('fa-circle');
    icon.classList.add('fa-check-circle');
    
    const scoreDisplay = document.getElementById('mallampatiScore');
    const riskDisplay = document.getElementById('mallampatiRisk');
    const recommendationDisplay = document.getElementById('mallampatiRecommendation');
    
    scoreDisplay.textContent = `Classe ${classe}`;
    
    let riskClass, riskLevel, recommendation;
    
    if (classe === 1) {
        riskClass = 'risk-very-low';
        riskLevel = 'Classe I - Via Aérea Fácil';
        recommendation = '✅ Baixíssimo risco de via aérea difícil. Intubação convencional. Laringoscópio padrão. Ter plano B disponível (sempre).';
    } else if (classe === 2) {
        riskClass = 'risk-low';
        riskLevel = 'Classe II - Via Aérea Provavelmente Fácil';
        recommendation = '✅ Baixo risco. Intubação geralmente sem dificuldade. Preparar equipamentos alternativos (bougie, videolaringoscópio). Avaliar outros preditores.';
    } else if (classe === 3) {
        riskClass = 'risk-moderate';
        riskLevel = 'Classe III - Via Aérea Potencialmente Difícil';
        recommendation = '⚠️ RISCO MODERADO de intubação difícil. PREPARAR: Videolaringoscópio, bougie, ML, máscara facial. Considerar intubação acordado se outros fatores presentes. Ter plano C (cricotireoidotomia). Equipe experiente.';
    } else {
        riskClass = 'risk-high';
        riskLevel = 'Classe IV - Via Aérea Difícil';
        recommendation = '🚨 ALTO RISCO de via aérea difícil. PREPARAÇÃO MANDATÓRIA: Videolaringoscópio de primeira linha, fibroscópio disponível, ML de backup, kit de via aérea difícil completo. Considerar SERIAMENTE intubação acordada com fibroscópio. Anestesiologista experiente obrigatório. Plano A/B/C/D documentado.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('mallampatiResult').style.display = 'block';
}

// ==================== VOLUME CORRENTE PROTETORA ====================
function showVolumeProtetora() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Volume Corrente Protetora</h1>
            <p class="section-subtitle">Ventilação Protetora Intraoperatória</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="volumeForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-venus-mars"></i> Sexo</label>
                        <select class="form-select" id="vol_sexo" onchange="calcularVolume()">
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-ruler-vertical"></i> Altura (cm)</label>
                        <input type="number" class="form-select" id="vol_altura" placeholder="Ex: 170" 
                               min="140" max="220" onchange="calcularVolume()">
                    </div>

                    <div id="volumeResult" class="result-box" style="display: none;">
                        <h3>Parâmetros Ventilatórios</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Peso Ideal</div>
                            <div class="result-value" id="volPesoIdeal">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Volume Corrente (6 mL/kg)</div>
                            <div class="result-value" id="volVC6" style="color: #10B981;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Volume Corrente (8 mL/kg)</div>
                            <div class="result-value" id="volVC8" style="color: #F59E0B;">-</div>
                        </div>

                        <div class="risk-recommendation" id="volumeRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetVolume()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Ventilação Protetora</h3>
                <h4>Recomendações:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Volume:</strong> 6-8 mL/kg de peso ideal</li>
                    <li><strong>Pplatô:</strong> < 30 cmH2O</li>
                    <li><strong>PEEP:</strong> 5-8 cmH2O</li>
                    <li><strong>FR:</strong> Ajustar para PaCO2 35-45 mmHg</li>
                    <li><strong>FiO2:</strong> Menor possível (< 0.8)</li>
                </ul>
                <p style="font-size: 12px; margin-top: var(--spacing-sm);"><strong>Evidência:</strong> Reduz complicações pulmonares pós-operatórias</p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularVolume() {
    const sexo = document.getElementById('vol_sexo').value;
    const altura = parseFloat(document.getElementById('vol_altura').value);
    
    if (!altura || altura < 140) {
        document.getElementById('volumeResult').style.display = 'none';
        return;
    }
    
    // Peso Ideal
    let pesoIdeal;
    if (sexo === 'M') {
        pesoIdeal = 50 + 0.91 * (altura - 152.4);
    } else {
        pesoIdeal = 45.5 + 0.91 * (altura - 152.4);
    }
    
    const vc6 = pesoIdeal * 6;
    const vc8 = pesoIdeal * 8;
    
    document.getElementById('volPesoIdeal').textContent = `${pesoIdeal.toFixed(1)} kg`;
    document.getElementById('volVC6').textContent = `${vc6.toFixed(0)} mL`;
    document.getElementById('volVC8').textContent = `${vc8.toFixed(0)} mL`;
    
    const recommendation = `💨 <strong>VENTILAÇÃO PROTETORA RECOMENDADA:</strong><br><br>
• Iniciar com 6-8 mL/kg (${vc6.toFixed(0)}-${vc8.toFixed(0)} mL)<br>
• PEEP 5-8 cmH2O (individualizar)<br>
• Manter Pplatô < 30 cmH2O<br>
• Driving Pressure < 15 cmH2O<br>
• FR 12-16 rpm (ajustar pela ETCO2)<br>
• Manobras de recrutamento periódicas<br>
• FiO2 titulada para SpO2 94-98%<br><br>
<strong>⚠️ EVITAR:</strong> Volumes altos (> 10 mL/kg), PEEP zero, atelectasias.`;
    
    document.getElementById('volumeRecommendation').innerHTML = recommendation;
    document.getElementById('volumeResult').style.display = 'block';
}

function resetVolume() {
    document.getElementById('volumeForm').reset();
    document.getElementById('volumeResult').style.display = 'none';
}

// ==================== FLACC (FACE, LEGS, ACTIVITY, CRY, CONSOLABILITY) ====================
function showFLACC() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Escala FLACC</h1>
            <p class="section-subtitle">Avaliação de Dor Pediátrica (0-7 anos)</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="flaccForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-smile"></i> Face</label>
                        <select class="form-select" id="flacc_face" onchange="calcularFLACC()">
                            <option value="0">Sem expressão ou sorriso (0)</option>
                            <option value="1">Careta/franze testa ocasional (1)</option>
                            <option value="2">Careta frequente/tremor de queixo (2)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-child"></i> Pernas</label>
                        <select class="form-select" id="flacc_legs" onchange="calcularFLACC()">
                            <option value="0">Posição normal ou relaxada (0)</option>
                            <option value="1">Inquieto, agitado, tenso (1)</option>
                            <option value="2">Chutando ou pernas encolhidas (2)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-running"></i> Atividade</label>
                        <select class="form-select" id="flacc_activity" onchange="calcularFLACC()">
                            <option value="0">Quieto, posição normal, movimentos fáceis (0)</option>
                            <option value="1">Contorce-se, movimentos para frente e para trás, tenso (1)</option>
                            <option value="2">Arqueado, rígido ou se debatendo (2)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-volume-up"></i> Choro</label>
                        <select class="form-select" id="flacc_cry" onchange="calcularFLACC()">
                            <option value="0">Sem choro (acordado ou dormindo) (0)</option>
                            <option value="1">Choramingo, gemidos ocasionais (1)</option>
                            <option value="2">Choro contínuo, gritos, soluços frequentes (2)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-hand-holding-heart"></i> Consolabilidade</label>
                        <select class="form-select" id="flacc_console" onchange="calcularFLACC()">
                            <option value="0">Contente, relaxado (0)</option>
                            <option value="1">Tranquilizado por toque ocasional, abraço (1)</option>
                            <option value="2">Difícil de consolar ou confortar (2)</option>
                        </select>
                    </div>

                    <div id="flaccResult" class="result-box">
                        <h3>Avaliação de Dor</h3>
                        <div class="score-display">
                            <span class="score-number" id="flaccScore">0</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="flaccRisk"></div>
                        <div class="risk-recommendation" id="flaccRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetFLACC()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre FLACC</h3>
                <p>Escala validada para crianças de 2 meses a 7 anos ou não verbais.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>0:</strong> Sem dor</li>
                    <li><strong>1-3:</strong> Dor leve</li>
                    <li><strong>4-6:</strong> Dor moderada</li>
                    <li><strong>7-10:</strong> Dor intensa</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    calcularFLACC();
}

function calcularFLACC() {
    const face = parseInt(document.getElementById('flacc_face')?.value || 0);
    const legs = parseInt(document.getElementById('flacc_legs')?.value || 0);
    const activity = parseInt(document.getElementById('flacc_activity')?.value || 0);
    const cry = parseInt(document.getElementById('flacc_cry')?.value || 0);
    const console = parseInt(document.getElementById('flacc_console')?.value || 0);
    
    const total = face + legs + activity + cry + console;
    
    document.getElementById('flaccScore').textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total === 0) {
        riskLevel = 'Sem Dor';
        riskClass = 'risk-very-low';
        recommendation = '✅ Criança sem dor. Manter vigilância. Analgesia de manutenção se prescrita.';
    } else if (total <= 3) {
        riskLevel = 'Dor Leve';
        riskClass = 'risk-low';
        recommendation = '💊 Dor leve. Analgesia simples: Dipirona 15 mg/kg IV OU Paracetamol 15 mg/kg IV. Conforto e distração. Reavaliar em 30 minutos.';
    } else if (total <= 6) {
        riskLevel = 'Dor Moderada';
        riskClass = 'risk-moderate';
        recommendation = '⚠️ Dor moderada. Analgesia multimodal: Dipirona + Paracetamol. Considerar opioide fraco (Tramadol 1-2 mg/kg) OU Morfina 0.05-0.1 mg/kg IV. Reavaliação frequente (15-30 min). Conforto, posicionamento, presença dos pais.';
    } else {
        riskLevel = 'Dor Intensa';
        riskClass = 'risk-high';
        recommendation = '🚨 DOR INTENSA. Analgesia IMEDIATA: Morfina 0.1 mg/kg IV (titular até alívio) OU Fentanil 1 mcg/kg IV. Dipirona + Paracetamol. Considerar bloqueio regional se apropriado. Investigar causas cirúrgicas (sangramento, complicação). Reavaliação a cada 15 minutos. Sedação se agitação importante. Presença dos pais essencial.';
    }
    
    document.getElementById('flaccRisk').className = `risk-classification ${riskClass}`;
    document.getElementById('flaccRisk').textContent = riskLevel;
    document.getElementById('flaccRecommendation').textContent = recommendation;
}

function resetFLACC() {
    document.getElementById('flaccForm').reset();
    calcularFLACC();
}

console.log('✅ Calculadoras médicas avançadas carregadas');

