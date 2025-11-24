// ==================== CALCULADORAS CLÍNICAS COMPLEMENTARES ====================

// ==================== GOLDMAN CARDIAC RISK INDEX ====================
function showGoldmanRisk() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Goldman Cardiac Risk Index</h1>
            <p class="section-subtitle">Risco Cardiovascular em Cirurgia Não-Cardíaca</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="text-align: center; margin-bottom: var(--spacing-md); color: var(--primary-dark);">
                    Selecione os Fatores Presentes
                </h3>
                
bo                <div id="goldmanForm">
                    <div class="risk-factor-card" onclick="toggleGoldman(this, 11)">
                        <div class="card-content">
                            <div class="factor-icon">💔</div>
                            <div class="factor-text">
                                <strong>Terceira bulha ou pulso venoso jugular (B3 ou PVJ)</strong>
                                <span class="factor-points">11 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 11)">
                        <div class="card-content">
                            <div class="factor-icon">💗</div>
                            <div class="factor-text">
                                <strong>Infarto agudo do miocárdio nos últimos 6 meses (IAM)</strong>
                                <span class="factor-points">11 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 7)">
                        <div class="card-content">
                            <div class="factor-icon">⚡</div>
                            <div class="factor-text">
                                <strong>Ritmo não sinusal ou extra-sístoles supraventriculares na ECG (ESSV)</strong>
                                <span class="factor-points">7 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 7)">
                        <div class="card-content">
                            <div class="factor-icon">⭐</div>
                            <div class="factor-text">
                                <strong>Mais de 5 extra-sístoles ventriculares por minuto (ESV)</strong>
                                <span class="factor-points">7 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 5)">
                        <div class="card-content">
                            <div class="factor-icon">👴</div>
                            <div class="factor-text">
                                <strong>Idade > 70 anos</strong>
                                <span class="factor-points">5 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 4)">
                        <div class="card-content">
                            <div class="factor-icon">🚨</div>
                            <div class="factor-text">
                                <strong>Cirurgia de Emergência</strong>
                                <span class="factor-points">4 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 3)">
                        <div class="card-content">
                            <div class="factor-icon">🫁</div>
                            <div class="factor-text">
                                <strong>Cirurgia Torácica/Abdominal/Aórtica</strong>
                                <span class="factor-points">3 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 3)">
                        <div class="card-content">
                            <div class="factor-icon">🚰</div>
                            <div class="factor-text">
                                <strong>Estenose aórtica importante</strong>
                                <span class="factor-points">3 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="toggleGoldman(this, 3)">
                        <div class="card-content">
                            <div class="factor-icon">⚠️</div>
                            <div class="factor-text">
                                <strong>Condição geral ruim (K+ < 3, ureia > 50, etc)</strong>
                                <span class="factor-points">3 pontos</span>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>
                </div>

                <div id="goldmanResult" class="result-box" style="display: none;">
                    <h3>Avaliação de Risco Cardíaco</h3>
                    <div class="risk-classification" id="goldmanRisk"></div>
                    <div class="risk-recommendation" id="goldmanRecommendation"></div>
                </div>

                <div class="score-tracker">
                    <div class="current-score">
                        <span class="score-label">Pontuação Total</span>
                        <span class="score-number" id="goldmanScore">0</span>
                    </div>
                </div>

                <button type="button" class="btn-reset" onclick="resetGoldman()">
                    <i class="fas fa-redo"></i> Limpar
                </button>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Classificação Goldman</h3>
                <ul style="font-size: 13px;">
                    <li><strong>Classe I (0-5):</strong> Risco mínimo (0.7%)</li>
                    <li><strong>Classe II (6-12):</strong> Baixo risco (5%)</li>
                    <li><strong>Classe III (13-25):</strong> Médio risco (11%)</li>
                    <li><strong>Classe IV (≥ 26):</strong> Alto risco (22%)</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

let goldmanPoints = 0;

function toggleGoldman(card, points) {
    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
        goldmanPoints -= points;
    } else {
        card.classList.add('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-circle');
        icon.classList.add('fa-check-circle');
        goldmanPoints += points;
    }
    
    document.getElementById('goldmanScore').textContent = goldmanPoints;
    
    let riskClass, riskLevel, recommendation;
    
    if (goldmanPoints <= 5) {
        riskClass = 'risk-very-low';
        riskLevel = 'Classe I - Risco Mínimo (0.7%)';
        recommendation = '✅ Risco cardiovascular mínimo. Proceder com cirurgia. Monitorização padrão.';
    } else if (goldmanPoints <= 12) {
        riskClass = 'risk-low';
        riskLevel = 'Classe II - Baixo Risco (5%)';
        recommendation = '⚠️ Baixo risco. Beta-bloqueador se indicado. Monitorização com ECG contínuo. Cuidado com balanço hídrico.';
    } else if (goldmanPoints <= 25) {
        riskClass = 'risk-moderate';
        riskLevel = 'Classe III - Risco Médio (11%)';
        recommendation = '⚠️ RISCO MODERADO. Otimização pré-operatória. Beta-bloqueador. Considerar monitorização invasiva. Leito de UTI programado. Evitar grandes variações hemodinâmicas.';
    } else {
        riskClass = 'risk-high';
        riskLevel = 'Classe IV - Alto Risco (22%)';
        recommendation = '🚨 ALTO RISCO CARDIOVASCULAR. Reavaliar necessidade/urgência da cirurgia. Cardiologia obrigatória. Otimização intensiva pré-op. Monitorização invasiva. UTI pós-operatória. Evitar cirurgias eletivas se possível.';
    }
    
    document.getElementById('goldmanRisk').className = `risk-classification ${riskClass}`;
    document.getElementById('goldmanRisk').textContent = riskLevel;
    document.getElementById('goldmanRecommendation').textContent = recommendation;
    
    if (goldmanPoints > 0) {
        document.getElementById('goldmanResult').style.display = 'block';
    } else {
        document.getElementById('goldmanResult').style.display = 'none';
    }
}

function resetGoldman() {
    document.querySelectorAll('#goldmanForm .risk-factor-card').forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    goldmanPoints = 0;
    document.getElementById('goldmanScore').textContent = '0';
    document.getElementById('goldmanResult').style.display = 'none';
}

// ==================== DÉFICIT HÍDRICO ====================
function showDeficitHidrico() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Déficit Hídrico</h1>
            <p class="section-subtitle">Cálculo de Reposição de Jejum</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="deficitForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-weight"></i> Peso (kg)</label>
                        <input type="number" class="form-select" id="def_peso" placeholder="Ex: 70" 
                               min="5" max="200" step="0.1" onchange="calcularDeficit()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-clock"></i> Horas de Jejum</label>
                        <input type="number" class="form-select" id="def_horas" placeholder="Ex: 8" 
                               min="0" max="48" step="0.5" onchange="calcularDeficit()">
                    </div>

                    <div id="deficitResult" class="result-box" style="display: none;">
                        <h3>Reposição de Fluidos</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Manutenção Horária</div>
                            <div class="result-value" id="defManutencao">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Déficit Total Acumulado</div>
                            <div class="result-value" id="defTotal" style="color: #EF4444;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">1ª Hora (50% déficit + manutenção)</div>
                            <div class="result-value" id="defHora1" style="color: #10B981; font-size: 20px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">2ª Hora (25% déficit + manutenção)</div>
                            <div class="result-value" id="defHora2" style="color: #F59E0B;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">3ª Hora (25% déficit + manutenção)</div>
                            <div class="result-value" id="defHora3" style="color: #F59E0B;">-</div>
                        </div>

                        <div class="risk-recommendation" id="deficitRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetDeficit()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Regra 4-2-1</h3>
                <ul style="font-size: 13px;">
                    <li><strong>Primeiros 10 kg:</strong> 4 mL/kg/h</li>
                    <li><strong>10-20 kg:</strong> + 2 mL/kg/h</li>
                    <li><strong>> 20 kg:</strong> + 1 mL/kg/h</li>
                </ul>
                <p style="font-size: 12px; margin-top: var(--spacing-sm);"><strong>Reposição:</strong> 50% na 1ª hora, 25% na 2ª e 3ª hora + manutenção</p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularDeficit() {
    const peso = parseFloat(document.getElementById('def_peso').value);
    const horas = parseFloat(document.getElementById('def_horas').value);
    
    if (!peso || !horas || peso < 5) {
        document.getElementById('deficitResult').style.display = 'none';
        return;
    }
    
    // Regra 4-2-1
    let manutencao;
    if (peso <= 10) {
        manutencao = peso * 4;
    } else if (peso <= 20) {
        manutencao = 40 + (peso - 10) * 2;
    } else {
        manutencao = 40 + 20 + (peso - 20) * 1;
    }
    
    const deficitTotal = manutencao * horas;
    const hora1 = (deficitTotal * 0.5) + manutencao;
    const hora2 = (deficitTotal * 0.25) + manutencao;
    const hora3 = (deficitTotal * 0.25) + manutencao;
    
    document.getElementById('defManutencao').textContent = `${manutencao.toFixed(0)} mL/h`;
    document.getElementById('defTotal').textContent = `${deficitTotal.toFixed(0)} mL`;
    document.getElementById('defHora1').textContent = `${hora1.toFixed(0)} mL`;
    document.getElementById('defHora2').textContent = `${hora2.toFixed(0)} mL`;
    document.getElementById('defHora3').textContent = `${hora3.toFixed(0)} mL`;
    
    const recommendation = `💧 <strong>PLANO DE HIDRATAÇÃO:</strong><br><br>
<strong>1ª HORA:</strong> Infundir ${hora1.toFixed(0)} mL (corrige 50% do déficit)<br>
<strong>2ª HORA:</strong> Infundir ${hora2.toFixed(0)} mL (corrige 25% do déficit)<br>
<strong>3ª HORA:</strong> Infundir ${hora3.toFixed(0)} mL (corrige 25% do déficit)<br>
<strong>Após 3ª hora:</strong> Manter ${manutencao.toFixed(0)} mL/h<br><br>
<strong>+ Perdas cirúrgicas:</strong> Repor conforme necessário<br>
<strong>Solução sugerida:</strong> Ringer Lactato ou SF 0.9%<br><br>
⚠️ Ajustar pela diurese, PAM, FC, perfusão periférica`;
    
    document.getElementById('deficitRecommendation').innerHTML = recommendation;
    document.getElementById('deficitResult').style.display = 'block';
}

function resetDeficit() {
    document.getElementById('deficitForm').reset();
    document.getElementById('deficitResult').style.display = 'none';
}

// ==================== BLOQUEADORES NEUROMUSCULARES ====================
function showBloqueadores() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Bloqueadores Neuromusculares</h1>
            <p class="section-subtitle">Guia Rápido de Dosagem</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="bloqForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-weight"></i> Peso (kg)</label>
                        <input type="number" class="form-select" id="bloq_peso" placeholder="Ex: 70" 
                               min="20" max="200" step="0.1" onchange="calcularBloqueador()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-syringe"></i> Bloqueador</label>
                        <select class="form-select" id="bloq_tipo" onchange="calcularBloqueador()">
                            <option value="">Selecione...</option>
                            <option value="succ">Succinilcolina (Despolarizante)</option>
                            <option value="rocu">Rocurônio (Rápido)</option>
                            <option value="vec">Vecurônio (Intermediário)</option>
                            <option value="atra">Atracúrio (Eliminação Hofmann)</option>
                            <option value="cisa">Cisatracúrio (Insuf. Renal/Hepática)</option>
                        </select>
                    </div>

                    <div id="bloqResult" class="result-box" style="display: none;">
                        <h3 id="bloqNome">-</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Dose de Intubação</div>
                            <div class="result-value" id="bloqIntubacao" style="color: #10B981; font-size: 20px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Dose de Manutenção</div>
                            <div class="result-value" id="bloqManutencao">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Duração de Ação</div>
                            <div class="result-value" id="bloqDuracao">-</div>
                        </div>

                        <div class="risk-recommendation" id="bloqRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetBloqueador()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Antagonistas</h3>
                <ul style="font-size: 13px;">
                    <li><strong>Neostigmina:</strong> 0.04-0.07 mg/kg (+ Atropina 0.02 mg/kg)</li>
                    <li><strong>Sugammadex:</strong> 2-4 mg/kg (moderado) ou 16 mg/kg (imediato)</li>
                    <li><strong>Não reverter antes TOF > 0.2</strong></li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularBloqueador() {
    const peso = parseFloat(document.getElementById('bloq_peso').value);
    const tipo = document.getElementById('bloq_tipo').value;
    
    if (!peso || !tipo || peso < 20) {
        document.getElementById('bloqResult').style.display = 'none';
        return;
    }
    
    let nome, intubacao, manutencao, duracao, recommendation;
    
    switch(tipo) {
        case 'succ':
            nome = 'Succinilcolina';
            intubacao = `${(peso * 1).toFixed(0)} - ${(peso * 1.5).toFixed(0)} mg`;
            manutencao = 'Não aplicável (dose única)';
            duracao = '5-10 minutos';
            recommendation = `⚡ <strong>DESPOLARIZANTE</strong><br><br>
<strong>Onset:</strong> 45-60 segundos<br>
<strong>Uso:</strong> Sequência rápida<br><br>
<strong>⚠️ CONTRAINDICAÇÕES:</strong><br>
• Hipercalemia (K+ > 5.5)<br>
• Insuficiência renal grave<br>
• Queimaduras > 48h<br>
• Trauma raquimedular<br>
• Distrofias musculares<br>
• História de hipertermia maligna<br>
• Lesão por esmagamento<br><br>
<strong>Efeitos adversos:</strong> Fasciculações, mialgias, bradicardia, ↑K+ ~0.5 mEq/L`;
            break;
            
        case 'rocu':
            nome = 'Rocurônio';
            intubacao = `${(peso * 0.6).toFixed(0)} - ${(peso * 1.2).toFixed(0)} mg`;
            manutencao = `${(peso * 0.1).toFixed(0)} - ${(peso * 0.15).toFixed(0)} mg (20-30 min)`;
            duracao = '30-45 minutos';
            recommendation = `🚀 <strong>NÃO-DESPOLARIZANTE RÁPIDO</strong><br><br>
<strong>Onset:</strong> 60-90 segundos (1.2 mg/kg)<br>
<strong>Uso:</strong> Sequência rápida (alternativa à succinilcolina), cirurgias gerais<br><br>
<strong>Vantagens:</strong><br>
• Reversível com Sugammadex<br>
• Sem liberação histamina<br>
• Sem efeitos cardiovasculares<br><br>
<strong>Manutenção:</strong> Bolus ou infusão 0.3-0.6 mg/kg/h<br>
<strong>Antagonista ideal:</strong> Sugammadex 2-4 mg/kg`;
            break;
            
        case 'vec':
            nome = 'Vecurônio';
            intubacao = `${(peso * 0.08).toFixed(0)} - ${(peso * 0.1).toFixed(0)} mg`;
            manutencao = `${(peso * 0.01).toFixed(0)} - ${(peso * 0.015).toFixed(0)} mg (15-20 min)`;
            duracao = '25-40 minutos';
            recommendation = `⏱️ <strong>DURAÇÃO INTERMEDIÁRIA</strong><br><br>
<strong>Onset:</strong> 2-3 minutos<br>
<strong>Uso:</strong> Cirurgias eletivas, manutenção prolongada<br><br>
<strong>Características:</strong><br>
• Sem efeitos CV ou histamina<br>
• Metabolismo hepático<br>
• Ajustar em insuf. hepática<br><br>
<strong>Reversão:</strong> Neostigmina ou Sugammadex<br>
<strong>Custo-efetivo</strong> para cirurgias longas`;
            break;
            
        case 'atra':
            nome = 'Atracúrio';
            intubacao = `${(peso * 0.4).toFixed(0)} - ${(peso * 0.5).toFixed(0)} mg`;
            manutencao = `${(peso * 0.1).toFixed(0)} - ${(peso * 0.2).toFixed(0)} mg (15-25 min)`;
            duracao = '20-35 minutos';
            recommendation = `🔄 <strong>ELIMINAÇÃO DE HOFMANN</strong><br><br>
<strong>Onset:</strong> 2-3 minutos<br>
<strong>Uso:</strong> Insuficiência renal ou hepática<br><br>
<strong>Vantagens:</strong><br>
• Metabolismo independente (hidrólise éster + Hofmann)<br>
• Seguro em disfunção orgânica<br><br>
<strong>⚠️ Desvantagens:</strong><br>
• Liberação de histamina (doses altas)<br>
• Hipotensão leve (rara)<br><br>
<strong>Infusão:</strong> 5-10 mcg/kg/min`;
            break;
            
        case 'cisa':
            nome = 'Cisatracúrio';
            intubacao = `${(peso * 0.15).toFixed(0)} - ${(peso * 0.2).toFixed(0)} mg`;
            manutencao = `${(peso * 0.03).toFixed(0)} mg (20-30 min)`;
            duracao = '35-50 minutos';
            recommendation = `⭐ <strong>GOLD STANDARD para IRC/IH</strong><br><br>
<strong>Onset:</strong> 2-3 minutos<br>
<strong>Uso:</strong> Disfunção renal/hepática, UTI<br><br>
<strong>Vantagens:</strong><br>
• SEM liberação de histamina<br>
• Metabolismo Hofmann exclusivo<br>
• Sem metabólitos ativos<br>
• Sem efeitos CV<br><br>
<strong>Infusão UTI:</strong> 1-3 mcg/kg/min<br>
<strong>Custo:</strong> Mais caro, mas indicação específica essencial`;
            break;
    }
    
    document.getElementById('bloqNome').textContent = nome;
    document.getElementById('bloqIntubacao').textContent = intubacao;
    document.getElementById('bloqManutencao').textContent = manutencao;
    document.getElementById('bloqDuracao').textContent = duracao;
    document.getElementById('bloqRecommendation').innerHTML = recommendation;
    document.getElementById('bloqResult').style.display = 'block';
}

function resetBloqueador() {
    document.getElementById('bloqForm').reset();
    document.getElementById('bloqResult').style.display = 'none';
}

// ==================== ESCALA DE DOR (EVA/EVN) ====================
function showEscalaDor() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Escala de Dor</h1>
            <p class="section-subtitle">EVA/EVN - Avaliação e Tratamento</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="text-align: center; margin-bottom: var(--spacing-md); color: var(--primary-dark);">
                    Selecione a Intensidade da Dor
                </h3>
                
                <div id="dorForm" style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
                    <div class="risk-factor-card" onclick="selectDor(this, 0, 'Sem Dor')">
                        <div class="card-content">
                            <div class="factor-icon" style="font-size: 40px;">😊</div>
                            <div class="factor-text">
                                <strong>0 - Sem Dor</strong>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="selectDor(this, 1, 'Dor Muito Leve')">
                        <div class="card-content">
                            <div class="factor-icon" style="font-size: 40px;">🙂</div>
                            <div class="factor-text">
                                <strong>1-2 - Dor Muito Leve</strong>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="selectDor(this, 3, 'Dor Leve')">
                        <div class="card-content">
                            <div class="factor-icon" style="font-size: 40px;">😐</div>
                            <div class="factor-text">
                                <strong>3-4 - Dor Leve</strong>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="selectDor(this, 5, 'Dor Moderada')">
                        <div class="card-content">
                            <div class="factor-icon" style="font-size: 40px;">😟</div>
                            <div class="factor-text">
                                <strong>5-6 - Dor Moderada</strong>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="selectDor(this, 7, 'Dor Intensa')">
                        <div class="card-content">
                            <div class="factor-icon" style="font-size: 40px;">😣</div>
                            <div class="factor-text">
                                <strong>7-8 - Dor Intensa</strong>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>

                    <div class="risk-factor-card" onclick="selectDor(this, 9, 'Dor Máxima/Insuportável')">
                        <div class="card-content">
                            <div class="factor-icon" style="font-size: 40px;">😫</div>
                            <div class="factor-text">
                                <strong>9-10 - Dor Máxima/Insuportável</strong>
                            </div>
                        </div>
                        <div class="card-check"><i class="fas fa-circle"></i></div>
                    </div>
                </div>

                <div id="dorResult" class="result-box" style="display: none; margin-top: var(--spacing-md);">
                    <h3>Avaliação e Tratamento</h3>
                    <div class="score-display">
                        <span class="score-number" id="dorScore">-</span>
                    </div>
                    <div class="risk-classification" id="dorRisk"></div>
                    <div class="risk-recommendation" id="dorRecommendation"></div>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Analgesia Multimodal</h3>
                <p style="font-size: 13px;">Combine múltiplas classes para melhor controle e menos efeitos adversos.</p>
                <ul style="font-size: 13px;">
                    <li><strong>Dipirona:</strong> 15-30 mg/kg IV (até 2g)</li>
                    <li><strong>Paracetamol:</strong> 15 mg/kg IV (até 1g)</li>
                    <li><strong>Cetoprofeno:</strong> 100 mg IV</li>
                    <li><strong>Morfina:</strong> 0.05-0.1 mg/kg IV</li>
                    <li><strong>Fentanil:</strong> 0.5-1 mcg/kg IV</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function selectDor(card, nivel, label) {
    document.querySelectorAll('#dorForm .risk-factor-card').forEach(c => {
        c.classList.remove('selected');
        const icon = c.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    card.classList.add('selected');
    const icon = card.querySelector('.card-check i');
    icon.classList.remove('fa-circle');
    icon.classList.add('fa-check-circle');
    
    document.getElementById('dorScore').textContent = label;
    
    let riskClass, recommendation;
    
    if (nivel === 0) {
        riskClass = 'risk-very-low';
        recommendation = '✅ Sem dor. Manter vigilância. Analgesia de manutenção se prescrita.';
    } else if (nivel <= 2) {
        riskClass = 'risk-low';
        recommendation = '💊 <strong>Dor Muito Leve</strong><br>Analgesia simples:<br>• Dipirona 1g IV 6/6h OU<br>• Paracetamol 1g IV 6/6h<br>• Reavaliar em 30-60 minutos';
    } else if (nivel <= 4) {
        riskClass = 'risk-low';
        recommendation = '💊 <strong>Dor Leve</strong><br>Analgesia combinada:<br>• Dipirona 1-2g IV +<br>• Paracetamol 1g IV<br>• Considerar AINE (Cetoprofeno 100mg IV)<br>• Reavaliar em 30 minutos';
    } else if (nivel <= 6) {
        riskClass = 'risk-moderate';
        recommendation = '⚠️ <strong>Dor Moderada</strong><br>Analgesia multimodal:<br>• Dipirona 2g IV +<br>• Paracetamol 1g IV +<br>• Cetoprofeno 100mg IV<br>• <strong>Considerar opioide fraco:</strong><br>  - Tramadol 100mg IV OU<br>  - Morfina 2-3mg IV (0.03-0.05 mg/kg)<br>• Reavaliar em 15-30 minutos';
    } else if (nivel <= 8) {
        riskClass = 'risk-high';
        recommendation = '🚨 <strong>Dor Intensa</strong><br>Tratamento IMEDIATO:<br>• <strong>Morfina 5-10mg IV</strong> (0.1 mg/kg) OU<br>• <strong>Fentanil 50-100mcg IV</strong> (1 mcg/kg)<br>• Titular até alívio adequado<br>• + Dipirona 2g IV<br>• + Paracetamol 1g IV<br>• Considerar:<br>  - Cetamina 0.1-0.3 mg/kg<br>  - Bloqueios regionais<br>  - Analgesia controlada pelo paciente (PCA)<br>• Reavaliar a cada 15 minutos';
    } else {
        riskClass = 'risk-high';
        recommendation = '🚨🚨 <strong>DOR MÁXIMA - EMERGÊNCIA</strong><br>Ação IMEDIATA:<br>• <strong>Morfina 10mg IV</strong> (titular 2-3mg a cada 5 min) OU<br>• <strong>Fentanil 100-200mcg IV</strong><br>• <strong>Cetamina 10-20mg IV</strong> (associar)<br>• Dipirona + Paracetamol + AINE<br>• <strong>INVESTIGAR CAUSAS CIRÚRGICAS:</strong><br>  - Sangramento<br>  - Isquemia<br>  - Complicação cirúrgica<br>• Considerar:<br>  - Bloqueio regional URGENTE<br>  - Sedação (Midazolam/Propofol)<br>  - PCA ou infusão contínua<br>• Chamar cirurgião<br>• Reavaliação contínua';
    }
    
    document.getElementById('dorRisk').className = `risk-classification ${riskClass}`;
    document.getElementById('dorRisk').textContent = label;
    document.getElementById('dorRecommendation').innerHTML = recommendation;
    document.getElementById('dorResult').style.display = 'block';
}

// ==================== ÍNDICE DE CHOQUE ====================
function showIndiceChoque() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Índice de Choque</h1>
            <p class="section-subtitle">FC/PAS - Avaliação de Choque Hipovolêmico</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="choqueForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-heartbeat"></i> Frequência Cardíaca (bpm)</label>
                        <input type="number" class="form-select" id="choque_fc" placeholder="Ex: 100" 
                               min="30" max="220" onchange="calcularChoque()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-chart-line"></i> Pressão Arterial Sistólica (mmHg)</label>
                        <input type="number" class="form-select" id="choque_pas" placeholder="Ex: 120" 
                               min="40" max="250" onchange="calcularChoque()">
                    </div>

                    <div id="choqueResult" class="result-box" style="display: none;">
                        <h3>Índice de Choque</h3>
                        <div class="score-display">
                            <span class="score-number" id="choqueScore">-</span>
                        </div>
                        <div class="risk-classification" id="choqueRisk"></div>
                        <div class="risk-recommendation" id="choqueRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetChoque()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Interpretação</h3>
                <ul style="font-size: 13px;">
                    <li><strong>< 0.6:</strong> Normal</li>
                    <li><strong>0.6-1.0:</strong> Choque compensado</li>
                    <li><strong>1.0-1.4:</strong> Choque moderado</li>
                    <li><strong>> 1.4:</strong> Choque grave</li>
                </ul>
                <p style="font-size: 12px; margin-top: var(--spacing-sm);"><strong>Útil para:</strong> Trauma, hemorragia, sepse inicial</p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularChoque() {
    const fc = parseFloat(document.getElementById('choque_fc').value);
    const pas = parseFloat(document.getElementById('choque_pas').value);
    
    if (!fc || !pas || fc < 30 || pas < 40) {
        document.getElementById('choqueResult').style.display = 'none';
        return;
    }
    
    const indice = fc / pas;
    
    document.getElementById('choqueScore').textContent = indice.toFixed(2);
    
    let riskClass, riskLevel, recommendation;
    
    if (indice < 0.6) {
        riskClass = 'risk-very-low';
        riskLevel = 'Normal';
        recommendation = '✅ Índice de choque normal. Paciente hemodinamicamente estável. Manter vigilância. Hidratação de manutenção.';
    } else if (indice < 1.0) {
        riskClass = 'risk-low';
        riskLevel = 'Choque Compensado';
        recommendation = '⚠️ Choque compensado inicial. Perda volêmica ~10-20%.<br><br><strong>Conduta:</strong><br>• Acesso venoso calibroso<br>• Expansão volêmica (SF/RL 500-1000 mL)<br>• Investigar fonte de perda<br>• Monitorização contínua<br>• Checar Hb, lactato<br>• Manter diurese > 0.5 mL/kg/h';
    } else if (indice < 1.4) {
        riskClass = 'risk-moderate';
        riskLevel = 'Choque Moderado';
        recommendation = '🚨 <strong>CHOQUE MODERADO</strong><br>Perda volêmica ~20-40%<br><br><strong>Conduta URGENTE:</strong><br>• 2 acessos calibrosos (14-16G)<br>• Expansão rápida: 1-2L cristaloide<br>• Hemotransfusão se Hb < 7 g/dL<br>• Noradrenalina se PAM < 65 após volume<br>• Controlar sangramento IMEDIATO<br>• USG FAST/exames de imagem<br>• Considerar ativação de protocolo de hemorragia maciça<br>• UTI/Centro Cirúrgico';
    } else {
        riskClass = 'risk-high';
        riskLevel = 'Choque Grave';
        recommendation = '🚨🚨 <strong>CHOQUE GRAVE - CÓDIGO VERMELHO</strong><br>Perda > 40% volemia<br><br><strong>RESSUSCITAÇÃO IMEDIATA:</strong><br>• Ativar PROTOCOLO DE HEMORRAGIA MACIÇA<br>• Múltiplos acessos calibrosos<br>• Expansão agressiva + vasopressor<br>• Transfusão maciça (1:1:1)<br>• Ácido tranexâmico 1g IV<br>• Controle cirúrgico URGENTE do sangramento<br>• Considerar reanimação hemostática<br>• Acionar equipe de trauma/cirurgia vascular<br>• Centro cirúrgico IMEDIATO<br>• Monitorização invasiva<br>• <strong>Alta mortalidade - agir rapidamente</strong>';
    }
    
    document.getElementById('choqueRisk').className = `risk-classification ${riskClass}`;
    document.getElementById('choqueRisk').textContent = riskLevel;
    document.getElementById('choqueRecommendation').innerHTML = recommendation;
    document.getElementById('choqueResult').style.display = 'block';
}

function resetChoque() {
    document.getElementById('choqueForm').reset();
    document.getElementById('choqueResult').style.display = 'none';
}

// ==================== PERDAS SANGUÍNEAS ====================
function showPerdasSanguineas() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Perdas Sanguíneas</h1>
            <p class="section-subtitle">Estimativa e Reposição Volêmica</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="perdasForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-weight"></i> Peso (kg)</label>
                        <input type="number" class="form-select" id="perdas_peso" placeholder="Ex: 70" 
                               min="30" max="200" step="0.1" onchange="calcularPerdas()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-venus-mars"></i> Sexo</label>
                        <select class="form-select" id="perdas_sexo" onchange="calcularPerdas()">
                            <option value="M">Masculino (70 mL/kg)</option>
                            <option value="F">Feminino (65 mL/kg)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-tint"></i> Perda Estimada (mL)</label>
                        <input type="number" class="form-select" id="perdas_volume" placeholder="Ex: 500" 
                               min="0" max="10000" step="50" onchange="calcularPerdas()">
                    </div>

                    <div id="perdasResult" class="result-box" style="display: none;">
                        <h3>Análise de Perda Volêmica</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Volemia Total</div>
                            <div class="result-value" id="perdasVolemia">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">% de Perda</div>
                            <div class="result-value" id="perdasPercent" style="color: #EF4444; font-size: 20px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Classe de Hemorragia</div>
                            <div class="result-value" id="perdasClasse">-</div>
                        </div>

                        <div class="risk-recommendation" id="perdasRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetPerdas()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Classes de Hemorragia (ATLS)</h3>
                <ul style="font-size: 13px;">
                    <li><strong>Classe I:</strong> < 15% (< 750 mL) - Mínima</li>
                    <li><strong>Classe II:</strong> 15-30% (750-1500 mL) - Moderada</li>
                    <li><strong>Classe III:</strong> 30-40% (1500-2000 mL) - Grave</li>
                    <li><strong>Classe IV:</strong> > 40% (> 2000 mL) - Crítica</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularPerdas() {
    const peso = parseFloat(document.getElementById('perdas_peso').value);
    const sexo = document.getElementById('perdas_sexo').value;
    const volume = parseFloat(document.getElementById('perdas_volume').value);
    
    if (!peso || volume === undefined || peso < 30) {
        document.getElementById('perdasResult').style.display = 'none';
        return;
    }
    
    const volemia = peso * (sexo === 'M' ? 70 : 65);
    const percentual = (volume / volemia) * 100;
    
    document.getElementById('perdasVolemia').textContent = `${volemia.toFixed(0)} mL`;
    document.getElementById('perdasPercent').textContent = `${percentual.toFixed(1)}%`;
    
    let classe, recommendation;
    
    if (percentual < 15) {
        classe = 'Classe I - Hemorragia Mínima';
        recommendation = `✅ <strong>CLASSE I</strong> (< 15% volemia)<br><br>
<strong>Reposição:</strong><br>
• Cristaloide 3:1 (${(volume * 3).toFixed(0)} mL)<br>
• Ringer Lactato ou SF 0.9%<br>
• Infundir em 1-2 horas<br><br>
<strong>Monitorização:</strong><br>
• Sinais vitais de 30/30 min<br>
• Diurese horária<br>
• Não requer transfusão habitualmente`;
    } else if (percentual < 30) {
        classe = 'Classe II - Hemorragia Moderada';
        recommendation = `⚠️ <strong>CLASSE II</strong> (15-30% volemia)<br><br>
<strong>Reposição:</strong><br>
• Cristaloide 3:1 RÁPIDO (${(volume * 3).toFixed(0)} mL)<br>
• 2 acessos calibrosos<br>
• Expansão inicial rápida (500-1000 mL em bolus)<br><br>
<strong>Considerar hemotransfusão se:</strong><br>
• Hb < 7-8 g/dL<br>
• Instabilidade hemodinâmica persistente<br>
• Sangramento ativo contínuo<br><br>
<strong>Monitorização:</strong><br>
• Sinais vitais contínuos<br>
• Gasometria + Hb + lactato<br>
• Controlar fonte de sangramento`;
    } else if (percentual < 40) {
        classe = 'Classe III - Hemorragia Grave';
        recommendation = `🚨 <strong>CLASSE III</strong> (30-40% volemia)<br><br>
<strong>RESSUSCITAÇÃO AGRESSIVA:</strong><br>
• Cristaloide 1-2L RÁPIDO<br>
• <strong>HEMOTRANSFUSÃO:</strong> 2-4 concentrados de hemácias<br>
• Plasma fresco: 1:1 com CH<br>
• Considerar plaquetas se sangramento difuso<br>
• Ácido tranexâmico 1g IV<br><br>
<strong>Alvos:</strong><br>
• PAM > 65 mmHg (> 80 se TCE)<br>
• Hb > 7 g/dL<br>
• Lactato em queda<br>
• Controle cirúrgico do sangramento<br><br>
<strong>Acionar:</strong> Banco de sangue, cirurgia, UTI`;
    } else {
        classe = 'Classe IV - Hemorragia Crítica';
        recommendation = `🚨🚨 <strong>CLASSE IV - HEMORRAGIA MACIÇA</strong><br><br>
<strong>PROTOCOLO DE HEMORRAGIA MACIÇA:</strong><br>
• <strong>Transfusão maciça 1:1:1</strong><br>
  (CH : PFC : Plaquetas)<br>
• <strong>Ácido tranexâmico 1g IV</strong> (IMEDIATO)<br>
• Reposição volêmica controlada (evitar hemodiluição)<br>
• <strong>Controle cirúrgico URGENTE</strong><br><br>
<strong>Metas de ressuscitação hemostática:</strong><br>
• PAS 80-90 mmHg (permissive hypotension)<br>
• Hipotensão permissiva ATÉ controle cirúrgico<br>
• Evitar cristaloides excessivos<br>
• Hemoderivados prioritários<br><br>
<strong>Monitorização:</strong><br>
• ROTEM/TEG se disponível<br>
• Gasometria, lactato, Ca++, temp<br>
• Prevenir hipotermia, acidose, coagulopatia<br><br>
<strong>⚠️ MORTALIDADE ELEVADA - Centro cirúrgico AGORA</strong>`;
    }
    
    document.getElementById('perdasClasse').textContent = classe;
    document.getElementById('perdasRecommendation').innerHTML = recommendation;
    document.getElementById('perdasResult').style.display = 'block';
}

function resetPerdas() {
    document.getElementById('perdasForm').reset();
    document.getElementById('perdasResult').style.display = 'none';
}

// ==================== TABELA DE DOSES ADULTOS ====================
function showDosesAdultos() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    // Verificar se os dados estão carregados
    if (typeof dosesAdultosData === 'undefined') {
        section.innerHTML = `
            <div class="section-header">
                <button class="btn-back" onclick="showCalculadoras()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">❌ Erro</h1>
            </div>
            <div class="info-box">
                <p>Dados de doses para adultos não carregados.</p>
            </div>
        `;
        return;
    }
    
    const categorias = [...new Set(dosesAdultosData.map(d => d.categoria))];
    
    let html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">💊 Doses Medicações - Adultos</h1>
            <p class="section-subtitle">Guia Rápido de Dosagens Anestesiológicas</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <!-- Busca -->
                <div class="form-group">
                    <input type="text" class="form-select" id="searchAdultos" 
                           placeholder="🔍 Buscar medicação..." 
                           onkeyup="filtrarDosesAdultos()">
                </div>
                
                <!-- Filtro por categoria -->
                <div class="form-group">
                    <select class="form-select" id="categoriaAdultos" onchange="filtrarDosesAdultos()">
                        <option value="">Todas as Categorias</option>
                        ${categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                    </select>
                </div>
                
                <div id="tabelaDosesAdultos"></div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    renderizarDosesAdultos(dosesAdultosData);
}

function renderizarDosesAdultos(dados) {
    const container = document.getElementById('tabelaDosesAdultos');
    if (!container) return;
    
    if (dados.length === 0) {
        container.innerHTML = `
            <div class="info-box">
                <p>Nenhuma medicação encontrada.</p>
            </div>
        `;
        return;
    }
    
    // Agrupar por categoria
    const grouped = {};
    dados.forEach(med => {
        if (!grouped[med.categoria]) {
            grouped[med.categoria] = [];
        }
        grouped[med.categoria].push(med);
    });
    
    let html = '';
    
    for (const [categoria, medicacoes] of Object.entries(grouped)) {
        html += `
            <div style="margin-bottom: var(--spacing-lg);">
                <h3 style="color: var(--primary-dark); margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: var(--primary-light); border-radius: var(--radius-sm);">
                    📋 ${categoria}
                </h3>
        `;
        
        medicacoes.forEach(med => {
            html += `
                <div class="med-card" style="background: white; border: 1px solid #E5E7EB; border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-sm); box-shadow: var(--shadow-sm);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-sm);">
                        <h4 style="margin: 0; color: var(--primary-dark); font-size: 16px;">
                            💊 ${med.droga}
                        </h4>
                        <span style="background: var(--primary-light); color: var(--primary-dark); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600;">
                            ${med.categoria}
                        </span>
                    </div>
                    
                    <div style="background: #F3F4F6; padding: var(--spacing-sm); border-radius: var(--radius-sm); margin-bottom: var(--spacing-sm);">
                        <strong style="color: #059669;">📊 Dose:</strong>
                        <div style="font-size: 15px; font-weight: 600; color: #047857; margin-top: 4px;">
                            ${med.dose}
                        </div>
                    </div>
                    
                    <div style="font-size: 13px; color: #6B7280; margin-bottom: var(--spacing-xs);">
                        <strong style="color: #374151;">ℹ️ Observações:</strong><br>
                        ${med.observacoes}
                    </div>
                    
                    ${med.alertas ? `
                        <div style="font-size: 13px; color: ${med.alertas.includes('✅') ? '#059669' : '#DC2626'}; background: ${med.alertas.includes('✅') ? '#D1FAE5' : '#FEE2E2'}; padding: var(--spacing-xs); border-radius: var(--radius-sm); margin-top: var(--spacing-xs);">
                            <strong>${med.alertas.includes('✅') ? '✅' : '⚠️'} ${med.alertas.includes('✅') ? 'Indicação' : 'Alertas'}:</strong><br>
                            ${med.alertas}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

function filtrarDosesAdultos() {
    const searchTerm = document.getElementById('searchAdultos')?.value.toLowerCase() || '';
    const categoria = document.getElementById('categoriaAdultos')?.value || '';
    
    if (typeof dosesAdultosData === 'undefined') return;
    
    let filtered = dosesAdultosData;
    
    if (searchTerm) {
        filtered = filtered.filter(med => 
            med.droga.toLowerCase().includes(searchTerm) ||
            med.dose.toLowerCase().includes(searchTerm) ||
            med.observacoes.toLowerCase().includes(searchTerm)
        );
    }
    
    if (categoria) {
        filtered = filtered.filter(med => med.categoria === categoria);
    }
    
    renderizarDosesAdultos(filtered);
}

// ==================== DROGAS DE EMERGÊNCIA - ADULTOS (SAVA) ====================
function showEmergenciaAdultos() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">🚨 Drogas de Emergência - Adultos</h1>
            <p class="section-subtitle">Cálculo Automático por Peso (SAVA/ACLS)</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-weight"></i> Peso do Paciente (kg)</label>
                    <input type="number" class="form-select" id="emerg_peso" placeholder="Ex: 70" 
                           min="40" max="150" step="0.1" onchange="calcularEmergencia()">
                </div>

                <div id="emergResult" style="display: none; margin-top: var(--spacing-lg);">
                    <h3 style="text-align: center; margin-bottom: var(--spacing-md);">
                        <i class="fas fa-syringe"></i> Doses Calculadas
                    </h3>
                    
                    <div id="emergTableContainer"></div>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Protocolo SAVA/ACLS</h3>
                <p>Doses baseadas em guidelines de Suporte Avançado de Vida em Adultos.</p>
                <p><strong>⚠️ IMPORTANTE:</strong> Estas são doses de referência. Titular conforme resposta clínica.</p>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

const drogasEmergenciaAdultos = [
    // === PARADA CARDIORRESPIRATÓRIA ===
    { droga: 'Adrenalina (PCR)', dose_mg_kg: 0.01, unidade: 'mg', diluicao: '1:10.000 (1mg/10mL)', via: 'IV', obs: 'Repetir a cada 3-5 min' },
    { droga: 'Amiodarona (FV/TV)', dose_mg_kg: 5, dose_max: 300, unidade: 'mg', diluicao: '150mg/3mL', via: 'IV', obs: 'Bolus rápido, 2ª dose 150mg' },
    { droga: 'Lidocaína (Arritmia)', dose_mg_kg: 1, dose_max: 100, unidade: 'mg', diluicao: '20mg/mL', via: 'IV', obs: 'Seguir com infusão 1-4 mg/min' },
    { droga: 'Bicarbonato de Sódio', dose_mg_kg: 1, dose_max: 100, unidade: 'mEq', diluicao: '8.4% (1mEq/mL)', via: 'IV', obs: 'Apenas se acidose/hipercalemia' },
    { droga: 'Sulfato de Magnésio (Torsades)', dose_mg_kg: null, dose_fixa: 2, unidade: 'g', diluicao: '50% (5g/10mL)', via: 'IV', obs: '2g em 10-20 min' },
    
    // === ANAFILAXIA ===
    { droga: 'Adrenalina (Anafilaxia)', dose_mg_kg: 0.005, dose_max: 0.5, unidade: 'mg', diluicao: '1:1.000 (1mg/mL)', via: 'IM', obs: 'Repetir após 5-15 min se necessário' },
    { droga: 'Hidrocortisona (Anafilaxia)', dose_mg_kg: null, dose_fixa: 200, unidade: 'mg', diluicao: '100mg/2mL', via: 'IV', obs: 'Crise adrenal: 100mg 6/6h' },
    { droga: 'Metilprednisolona', dose_mg_kg: 1, dose_max: 125, unidade: 'mg', diluicao: '125mg ou 500mg', via: 'IV', obs: 'Anafilaxia, choque séptico' },
    
    // === VASOATIVOS E INOTRÓPICOS ===
    { droga: 'Noradrenalina', dose_mcg_kg_min: '0.05-0.5', unidade: 'mcg/kg/min', diluicao: '4mg/4mL', via: 'Infusão IV central', obs: 'Primeira linha choque séptico' },
    { droga: 'Adrenalina (Infusão)', dose_mcg_kg_min: '0.01-0.5', unidade: 'mcg/kg/min', diluicao: '1-4mg/250mL', via: 'Infusão IV', obs: 'Baixas doses β > altas α' },
    { droga: 'Dobutamina', dose_mcg_kg_min: '2.5-20', unidade: 'mcg/kg/min', diluicao: '250mg/250mL', via: 'Infusão IV', obs: 'ICC descompensada, inotrópico' },
    { droga: 'Dopamina', dose_mcg_kg_min: '2-20', unidade: 'mcg/kg/min', diluicao: '200mg/250mL', via: 'Infusão IV', obs: '2-5:renal 5-10:β >10:α' },
    { droga: 'Vasopressina', dose_unidades_min: '0.01-0.04', unidade: 'U/min', diluicao: '20U/100mL', via: 'Infusão IV', obs: 'Choque refratário, PCR: 40U dose única' },
    { droga: 'Milrinona', dose_mcg_kg_min: '0.375-0.75', unidade: 'mcg/kg/min', diluicao: '20mg/100mL', via: 'Infusão IV', obs: 'Bolus 50mcg/kg em 10min opcional' },
    
    // === VASODILATADORES ===
    { droga: 'Nitroprussiato de Sódio', dose_mcg_kg_min: '0.3-10', unidade: 'mcg/kg/min', diluicao: '50mg/250mL', via: 'Infusão IV', obs: 'Emergência hipertensiva, proteger luz' },
    { droga: 'Nitroglicerina (Tridil)', dose_mcg_min: '5-200', unidade: 'mcg/min', diluicao: '50mg/250mL', via: 'Infusão IV', obs: 'EAP, isquemia miocárdica, começar 5mcg/min' },
    { droga: 'Hidralazina', dose_mg_kg: null, dose_fixa: 10, dose_max: 20, unidade: 'mg', diluicao: '20mg/mL', via: 'IV', obs: 'Emergência HAS, repetir após 20min' },
    
    // === ARRITMIAS ===
    { droga: 'Adenosina (TSV)', dose_mg_kg: null, dose_fixa: 6, unidade: 'mg', diluicao: '3mg/mL', via: 'IV', obs: 'Bolus rápido + flush, 2ª dose 12mg' },
    { droga: 'Atropina (Bradicardia)', dose_mg_kg: null, dose_fixa: 0.5, dose_max: 3, unidade: 'mg', diluicao: '0.5mg/mL', via: 'IV', obs: 'Repetir até 3mg total' },
    { droga: 'Metoprolol', dose_mg_kg: null, dose_fixa: 5, unidade: 'mg', diluicao: '1mg/mL', via: 'IV', obs: 'Lento 2-5min, repetir até 15mg' },
    
    // === CONVULSÕES ===
    { droga: 'Midazolam (Convulsão)', dose_mg_kg: 0.1, dose_max: 10, unidade: 'mg', diluicao: '5mg/mL', via: 'IV', obs: 'Lento, titular. Infusão: 0.1mg/kg/h' },
    { droga: 'Fenitoína', dose_mg_kg: 15, dose_max: 1500, unidade: 'mg', diluicao: '50mg/mL', via: 'IV', obs: 'Máx 50mg/min, ECG contínuo, SF apenas' },
    { droga: 'Levetiracetam (Keppra)', dose_mg_kg: 20, dose_max: 3000, unidade: 'mg', diluicao: '500mg/5mL', via: 'IV', obs: 'Alternativa, menos efeitos CV' },
    
    // === REVERSÃO ===
    { droga: 'Naloxona', dose_mg_kg: null, dose_fixa: 0.4, dose_max: 2, unidade: 'mg', diluicao: '0.4mg/mL', via: 'IV/IM', obs: 'Titular, repetir até 10mg total' },
    { droga: 'Flumazenil', dose_mg_kg: null, dose_fixa: 0.2, dose_max: 1, unidade: 'mg', diluicao: '0.1mg/mL', via: 'IV', obs: 'Repetir 0.2mg até 1mg, cuidado convulsão' },
    { droga: 'Sugammadex (Emergência)', dose_mg_kg: 16, unidade: 'mg', diluicao: '200mg/2mL', via: 'IV', obs: 'Reversão imediata rocurônio ("cannot intubate")' },
    { droga: 'Protamina', dose_mg_por_100U_heparina: 1, unidade: 'mg', diluicao: '50mg/5mL', via: 'IV lento', obs: '1mg reverte 100U heparina, máx 50mg' },
    
    // === HEMOSTASIA ===
    { droga: 'Ácido Tranexâmico', dose_mg_kg: 10, dose_max: 1000, unidade: 'mg', diluicao: '500mg/5mL', via: 'IV', obs: '1g bolus + 1g em 8h. Trauma: em 3h' },
    { droga: 'Vitamina K (Fitomenadiona)', dose_mg_kg: null, dose_fixa: 10, unidade: 'mg', diluicao: '10mg/mL', via: 'IV lento', obs: 'Reversão warfarin, dar em 20-30min' },
    { droga: 'Complexo Protrombínico (CCP)', dose_UI_kg: 25, unidade: 'UI/kg', diluicao: 'Variável', via: 'IV', obs: 'Reversão warfarin urgente, 25-50 UI/kg' },
    { droga: 'Desmopressina (DDAVP)', dose_mcg_kg: 0.3, dose_max: 20, unidade: 'mcg', diluicao: '4mcg/mL', via: 'IV', obs: 'Von Willebrand, disfunção plaquetária' },
    
    // === METABÓLICO ===
    { droga: 'Cloreto de Cálcio 10%', dose_mg_kg: null, dose_fixa: 10, unidade: 'mL', diluicao: '10% (1g/10mL)', via: 'IV central', obs: 'Hipercalemia, hipoCa++, bloqueio Ca' },
    { droga: 'Gluconato de Cálcio 10%', dose_mg_kg: null, dose_fixa: 30, unidade: 'mL', diluicao: '10% (1g/10mL)', via: 'IV', obs: 'Menos irritante, periférico OK' },
    { droga: 'Glicose 50%', dose_mg_kg: null, dose_fixa: 50, unidade: 'mL', diluicao: '50% (25g/50mL)', via: 'IV', obs: 'Hipoglicemia <60mg/dL, 1amp = 25g' },
    { droga: 'Insulina Regular', dose_UI_kg: 0.1, unidade: 'UI', diluicao: '100UI/mL', via: 'IV/SC', obs: 'Hipercalemia: 10U + 50mL glicose 50%' },
    { droga: 'Glucagon', dose_mg_kg: null, dose_fixa: 1, unidade: 'mg', diluicao: '1mg/mL', via: 'IV/IM/SC', obs: 'Hipoglicemia sem acesso, overdose β-bloq' },
    
    // === EDEMA/DIURESE ===
    { droga: 'Furosemida', dose_mg_kg: 0.5, dose_max: 40, unidade: 'mg', diluicao: '10mg/mL', via: 'IV', obs: 'EAP, hipervolemia. Pode repetir dose dobrada' },
    { droga: 'Manitol 20%', dose_g_kg: 0.25, unidade: 'g/kg', diluicao: '20% (1g/5mL)', via: 'IV', obs: 'HIC, 0.25-1g/kg em 20-30min' },
    { droga: 'Solução Salina Hipertônica 3%', dose_mL_kg: 2, unidade: 'mL/kg', diluicao: '3% (30g/L)', via: 'IV central', obs: 'HIC, hipoNa grave, 2-5 mL/kg' },
    
    // === EMERGÊNCIAS ESPECÍFICAS ===
    { droga: 'Dantrolene', dose_mg_kg: 2.5, dose_max: null, unidade: 'mg/kg', diluicao: '20mg/60mL', via: 'IV', obs: 'Hipertermia maligna, repetir até 10mg/kg' },
    { droga: 'Emulsão Lipídica 20% (Intralipid)', dose_mL_kg: 1.5, unidade: 'mL/kg', diluicao: '20%', via: 'IV', obs: 'Toxicidade AL: bolus + infusão 0.25mL/kg/min' },
    { droga: 'N-Acetilcisteína', dose_mg_kg: 150, unidade: 'mg', diluicao: '200mg/mL', via: 'IV', obs: 'Paracetamol: 150mg/kg + 50 + 100mg/kg (21h)' },
    { droga: 'Ocitocina', dose_UI: '5-10', unidade: 'UI', diluicao: '5UI/mL', via: 'IV lento', obs: 'Hemorragia pós-parto: 5-10UI lento ou infusão' },
    { droga: 'Misoprostol', dose_mcg: 800, unidade: 'mcg', diluicao: '200mcg/cp', via: 'Sublingual/Retal', obs: 'Hemorragia pós-parto: 800mcg SL/retal' }
];

function calcularEmergencia() {
    const peso = parseFloat(document.getElementById('emerg_peso').value);
    
    if (!peso || peso < 40) {
        document.getElementById('emergResult').style.display = 'none';
        return;
    }
    
    let tableHTML = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: var(--primary-dark); color: white;">
                    <tr>
                        <th style="padding: var(--spacing-sm); text-align: left; border: 1px solid #ddd;">Droga</th>
                        <th style="padding: var(--spacing-sm); text-align: center; border: 1px solid #ddd;">Dose</th>
                        <th style="padding: var(--spacing-sm); text-align: center; border: 1px solid #ddd;">Via</th>
                        <th style="padding: var(--spacing-sm); text-align: left; border: 1px solid #ddd;">Observações</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    drogasEmergenciaAdultos.forEach((droga, index) => {
        const bgColor = index % 2 === 0 ? '#f9fafb' : 'white';
        let doseCalculada = '';
        
        // Doses fixas
        if (droga.dose_fixa) {
            doseCalculada = `<strong>${droga.dose_fixa} ${droga.unidade}</strong>`;
        } 
        // Dose em mg/kg
        else if (droga.dose_mg_kg) {
            let dose = droga.dose_mg_kg * peso;
            if (droga.dose_max && dose > droga.dose_max) {
                dose = droga.dose_max;
            }
            doseCalculada = `<strong>${dose.toFixed(1)} ${droga.unidade}</strong>`;
        } 
        // Infusões em mcg/kg/min
        else if (droga.dose_mcg_kg_min) {
            doseCalculada = `<strong>${droga.dose_mcg_kg_min} ${droga.unidade}</strong>`;
        } 
        // Infusões em U/min
        else if (droga.dose_unidades_min) {
            doseCalculada = `<strong>${droga.dose_unidades_min} ${droga.unidade}</strong>`;
        }
        // Infusões em mcg/min (não peso-dependente)
        else if (droga.dose_mcg_min) {
            doseCalculada = `<strong>${droga.dose_mcg_min} ${droga.unidade}</strong>`;
        }
        // Dose em UI/kg
        else if (droga.dose_UI_kg) {
            let dose = droga.dose_UI_kg * peso;
            doseCalculada = `<strong>${dose.toFixed(0)} ${droga.unidade}</strong>`;
        }
        // Dose em g/kg
        else if (droga.dose_g_kg) {
            let dose = droga.dose_g_kg * peso;
            doseCalculada = `<strong>${dose.toFixed(1)} g</strong> (${(dose * 1000).toFixed(0)} mg)`;
        }
        // Dose em mL/kg
        else if (droga.dose_mL_kg) {
            let dose = droga.dose_mL_kg * peso;
            doseCalculada = `<strong>${dose.toFixed(1)} ${droga.unidade}</strong>`;
        }
        // Dose em UI (fixa)
        else if (droga.dose_UI) {
            doseCalculada = `<strong>${droga.dose_UI} ${droga.unidade}</strong>`;
        }
        // Dose em mcg (fixa)
        else if (droga.dose_mcg) {
            doseCalculada = `<strong>${droga.dose_mcg} ${droga.unidade}</strong>`;
        }
        // Dose em mcg/kg
        else if (droga.dose_mcg_kg) {
            let dose = droga.dose_mcg_kg * peso;
            if (droga.dose_max && dose > droga.dose_max) {
                dose = droga.dose_max;
            }
            doseCalculada = `<strong>${dose.toFixed(1)} ${droga.unidade}</strong>`;
        }
        // Protamina (especial)
        else if (droga.dose_mg_por_100U_heparina) {
            doseCalculada = `<strong>1 mg/${droga.dose_mg_por_100U_heparina * 100}U heparina</strong>`;
        }
        
        if (droga.diluicao) {
            doseCalculada += `<br><span style="font-size: 11px; color: #6B7280;">${droga.diluicao}</span>`;
        }
        
        tableHTML += `
            <tr style="background: ${bgColor};">
                <td style="padding: var(--spacing-sm); border: 1px solid #ddd; font-weight: 600;">${droga.droga}</td>
                <td style="padding: var(--spacing-sm); border: 1px solid #ddd; text-align: center;">${doseCalculada}</td>
                <td style="padding: var(--spacing-sm); border: 1px solid #ddd; text-align: center;">${droga.via}</td>
                <td style="padding: var(--spacing-sm); border: 1px solid #ddd; font-size: 12px;">${droga.obs}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: var(--spacing-md); padding: var(--spacing-sm); background: #FEE2E2; border-radius: var(--spacing-xs); font-size: 12px;">
            <strong>⚠️ ALERTA:</strong> Doses calculadas para peso de <strong>${peso.toFixed(1)} kg</strong>. 
            <strong>${drogasEmergenciaAdultos.length} drogas</strong> listadas. Titular conforme resposta clínica. Monitorização contínua obrigatória.
        </div>
    `;
    
    document.getElementById('emergTableContainer').innerHTML = tableHTML;
    document.getElementById('emergResult').style.display = 'block';
}

// ==================== PERDA SANGUÍNEA MÁXIMA PERMITIDA ====================
function showPerdaMaxima() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Perda Sanguínea Máxima Permitida</h1>
            <p class="section-subtitle">Cálculo de Perda Aceitável sem Transfusão</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="perdaMaxForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-weight"></i> Peso (kg)</label>
                        <input type="number" class="form-select" id="pmax_peso" placeholder="Ex: 70" 
                               min="20" max="200" step="0.1" onchange="calcularPerdaMaxima()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-venus-mars"></i> Sexo</label>
                        <select class="form-select" id="pmax_sexo" onchange="calcularPerdaMaxima()">
                            <option value="M">Masculino (volemia 70 mL/kg)</option>
                            <option value="F">Feminino (volemia 65 mL/kg)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-droplet"></i> Hematócrito Inicial (%)</label>
                        <input type="number" class="form-select" id="pmax_hti" placeholder="Ex: 40" 
                               min="15" max="60" onchange="calcularPerdaMaxima()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-chart-line"></i> Hematócrito Mínimo Aceitável (%)</label>
                        <input type="number" class="form-select" id="pmax_htf" placeholder="Ex: 21" 
                               min="15" max="40" value="21" onchange="calcularPerdaMaxima()">
                        <small style="font-size: 11px; color: #6B7280;">Adulto saudável: 21% | Cardiopata/idoso: 24-27%</small>
                    </div>

                    <div id="perdaMaxResult" class="result-box" style="display: none;">
                        <h3>Perda Máxima Permitida</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Volemia Total</div>
                            <div class="result-value" id="pmaxVolemia">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Perda Máxima Permitida</div>
                            <div class="result-value" id="pmaxPerda" style="color: #EF4444; font-size: 22px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">% da Volemia</div>
                            <div class="result-value" id="pmaxPercent">-</div>
                        </div>

                        <div class="risk-recommendation" id="pmaxRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetPerdaMaxima()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Fórmula</h3>
                <p style="font-size: 13px;"><strong>PSM = Volemia × (Hti - Htf) / Hti</strong></p>
                <p style="font-size: 12px; margin-top: var(--spacing-sm);">
                    <strong>PSM:</strong> Perda Sanguínea Máxima<br>
                    <strong>Hti:</strong> Hematócrito inicial<br>
                    <strong>Htf:</strong> Hematócrito final (mínimo aceitável)
                </p>
                <h4 style="margin-top: var(--spacing-md);">Gatilhos Transfusionais:</h4>
                <ul style="font-size: 12px;">
                    <li><strong>Adulto saudável:</strong> Hb < 7 g/dL (Ht ~21%)</li>
                    <li><strong>Cardiopata:</strong> Hb < 8-9 g/dL (Ht 24-27%)</li>
                    <li><strong>Sangramento ativo:</strong> Protocolo hemorragia maciça</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularPerdaMaxima() {
    const peso = parseFloat(document.getElementById('pmax_peso').value);
    const sexo = document.getElementById('pmax_sexo').value;
    const hti = parseFloat(document.getElementById('pmax_hti').value);
    const htf = parseFloat(document.getElementById('pmax_htf').value);
    
    if (!peso || !hti || !htf || peso < 20 || hti < 15 || htf < 15) {
        document.getElementById('perdaMaxResult').style.display = 'none';
        return;
    }
    
    if (htf >= hti) {
        alert('Hematócrito final deve ser menor que o inicial');
        return;
    }
    
    const volemia = peso * (sexo === 'M' ? 70 : 65);
    const perdaMaxima = volemia * (hti - htf) / hti;
    const percentual = (perdaMaxima / volemia) * 100;
    
    document.getElementById('pmaxVolemia').textContent = `${volemia.toFixed(0)} mL`;
    document.getElementById('pmaxPerda').textContent = `${perdaMaxima.toFixed(0)} mL`;
    document.getElementById('pmaxPercent').textContent = `${percentual.toFixed(1)}%`;
    
    const recommendation = `🩸 <strong>INTERPRETAÇÃO:</strong><br><br>
Perda sanguínea de até <strong>${perdaMaxima.toFixed(0)} mL</strong> pode ser tolerada sem necessidade de transfusão, 
assumindo reposição adequada de cristaloides (regra 3:1) e que o paciente atinja um Ht de ${htf}%.<br><br>
<strong>⚠️ IMPORTANTE:</strong><br>
• Monitorizar sinais clínicos de hipoperfusão<br>
• Considerar comorbidades (cardiopatia, idade)<br>
• Perdas > 30% volemia: considerar hemoderivados<br>
• Sangramento ativo: protocolo de hemorragia maciça<br>
• Hematócrito alvo pode ser maior em pacientes de risco<br><br>
<strong>Reposição sugerida:</strong> ${(perdaMaxima * 3).toFixed(0)} mL de cristaloide (regra 3:1)`;
    
    document.getElementById('pmaxRecommendation').innerHTML = recommendation;
    document.getElementById('perdaMaxResult').style.display = 'block';
}

function resetPerdaMaxima() {
    document.getElementById('perdaMaxForm').reset();
    document.getElementById('perdaMaxResult').style.display = 'none';
}

// ==================== TUBO ENDOTRAQUEAL PEDIÁTRICO ====================
function showTuboEndotraqueal() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Tubo Endotraqueal Pediátrico</h1>
            <p class="section-subtitle">Cálculo de Tamanho e Profundidade</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="tuboForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-birthday-cake"></i> Idade</label>
                        <select class="form-select" id="tubo_idade" onchange="calcularTubo()">
                            <option value="">Selecione...</option>
                            <option value="0">Recém-nascido prematuro (< 1 kg)</option>
                            <option value="0.5">Recém-nascido prematuro (1-2 kg)</option>
                            <option value="1">Recém-nascido termo (2.5-4 kg)</option>
                            <option value="6m">6 meses</option>
                            <option value="1a">1 ano</option>
                            <option value="2a">2 anos</option>
                            <option value="3a">3 anos</option>
                            <option value="4a">4 anos</option>
                            <option value="5a">5 anos</option>
                            <option value="6a">6 anos</option>
                            <option value="7a">7 anos</option>
                            <option value="8a">8 anos</option>
                            <option value="9a">9 anos</option>
                            <option value="10a">10 anos</option>
                            <option value="12a">12 anos</option>
                            <option value="14a">14 anos</option>
                        </select>
                    </div>

                    <div id="tuboResult" class="result-box" style="display: none;">
                        <h3>Parâmetros do Tubo</h3>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Tubo SEM Cuff</div>
                            <div class="result-value" id="tuboSemCuff" style="color: #10B981; font-size: 20px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Tubo COM Cuff</div>
                            <div class="result-value" id="tuboComCuff" style="color: #3B82F6; font-size: 20px;">-</div>
                        </div>
                        
                        <div class="calc-result-item">
                            <div class="result-label">Profundidade (cm na rima labial)</div>
                            <div class="result-value" id="tuboProfundidade" style="color: #EF4444; font-size: 20px;">-</div>
                        </div>

                        <div class="risk-recommendation" id="tuboRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetTubo()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Fórmulas</h3>
                <h4>Tamanho do Tubo:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Sem cuff:</strong> (Idade/4) + 4</li>
                    <li><strong>Com cuff:</strong> (Idade/4) + 3.5</li>
                </ul>
                <h4>Profundidade de Inserção:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Oral:</strong> Tamanho do tubo × 3</li>
                    <li><strong>Nasal:</strong> Tamanho do tubo × 3.5</li>
                </ul>
                <h4>Lembrar:</h4>
                <ul style="font-size: 12px;">
                    <li>Ter 0.5 mm acima e abaixo preparados</li>
                    <li>Neonatos: 2.5-3.5 mm (sem cuff)</li>
                    <li>< 8 anos: preferir sem cuff (tradicionalmente)</li>
                    <li>≥ 8 anos: com ou sem cuff aceitável</li>
                    <li>Pressão do cuff: < 20 cmH2O</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularTubo() {
    const idadeSel = document.getElementById('tubo_idade').value;
    
    if (!idadeSel) {
        document.getElementById('tuboResult').style.display = 'none';
        return;
    }
    
    let tuboSemCuff, tuboComCuff, profundidade, idade, recommendation;
    
    // Conversão de idade para anos
    if (idadeSel === '0') {
        tuboSemCuff = 2.5;
        tuboComCuff = '-';
        profundidade = '7-8';
        idade = 'Prematuro < 1 kg';
        recommendation = '🚨 <strong>PREMATURO EXTREMO</strong><br>Tubo 2.5 sem cuff. Profundidade 7-8 cm. Confirmação com raio X obrigatória.';
    } else if (idadeSel === '0.5') {
        tuboSemCuff = 3.0;
        tuboComCuff = '-';
        profundidade = '8-9';
        idade = 'Prematuro 1-2 kg';
        recommendation = '🚨 <strong>PREMATURO</strong><br>Tubo 3.0 sem cuff. Profundidade 8-9 cm. RX para confirmar posição.';
    } else if (idadeSel === '1') {
        tuboSemCuff = 3.5;
        tuboComCuff = '-';
        profundidade = '10-11';
        idade = 'RN termo';
        recommendation = '👶 <strong>RECÉM-NASCIDO TERMO</strong><br>Tubo 3.5 sem cuff. Profundidade 10-11 cm (regra: peso + 6). Verificar expansão torácica bilateral.';
    } else {
        // Conversão idade
        let idadeAnos;
        if (idadeSel === '6m') {
            idadeAnos = 0.5;
            idade = '6 meses';
        } else {
            idadeAnos = parseInt(idadeSel);
            idade = `${idadeAnos} anos`;
        }
        
        // Fórmula: (Idade/4) + 4 (sem cuff) e (Idade/4) + 3.5 (com cuff)
        tuboSemCuff = (idadeAnos / 4) + 4;
        tuboComCuff = (idadeAnos / 4) + 3.5;
        profundidade = (tuboSemCuff * 3).toFixed(1);
        
        if (idadeAnos < 8) {
            recommendation = `👶 <strong>${idade.toUpperCase()}</strong><br>
Tubo sem cuff preferível (menos trauma traqueal).<br>
Profundidade: ${profundidade} cm (oral).<br>
Ter 0.5 mm acima e abaixo preparados.<br>
Verificar escape de ar com pressão 15-20 cmH2O.`;
        } else {
            recommendation = `🧒 <strong>${idade.toUpperCase()}</strong><br>
Tubo com ou sem cuff aceitável.<br>
Se usar com cuff: manter pressão < 20 cmH2O.<br>
Profundidade: ${profundidade} cm (oral), ${(tuboComCuff * 3.5).toFixed(1)} cm (nasal).<br>
Confirmar ausculta bilateral e capnografia.`;
        }
    }
    
    document.getElementById('tuboSemCuff').textContent = typeof tuboSemCuff === 'number' ? 
        `${tuboSemCuff.toFixed(1)} mm` : tuboSemCuff;
    document.getElementById('tuboComCuff').textContent = typeof tuboComCuff === 'number' ? 
        `${tuboComCuff.toFixed(1)} mm` : tuboComCuff;
    document.getElementById('tuboProfundidade').textContent = `${profundidade} cm`;
    document.getElementById('tuboRecommendation').innerHTML = recommendation;
    document.getElementById('tuboResult').style.display = 'block';
}

function resetTubo() {
    document.getElementById('tuboForm').reset();
    document.getElementById('tuboResult').style.display = 'none';
}

// ==================== CALCULADORA DE TRANSFUSÕES SANGUÍNEAS ====================
function showTransfusoes() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        <div class="section-header">
            <button class="btn-back" onclick="showCalculadoras()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">Transfusões Sanguíneas e Maciças</h1>
            <p class="section-subtitle">Cálculo de Hemoderivados (RN a Adultos)</p>
        </div>

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="transfusaoForm" class="calc-form">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-user"></i> Faixa Etária</label>
                        <select class="form-select" id="transf_faixa" onchange="calcularTransfusoes()">
                            <option value="">Selecione...</option>
                            <option value="neo">Neonato (< 1 mês)</option>
                            <option value="lactente">Lactente (1 mês - 2 anos)</option>
                            <option value="crianca">Criança (2-12 anos)</option>
                            <option value="adolescente">Adolescente (12-18 anos)</option>
                            <option value="adulto">Adulto (> 18 anos)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-weight"></i> Peso (kg)</label>
                        <input type="number" class="form-select" id="transf_peso" placeholder="Ex: 70" 
                               min="0.5" max="200" step="0.1" onchange="calcularTransfusoes()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-droplet"></i> Hemoglobina Atual (g/dL)</label>
                        <input type="number" class="form-select" id="transf_hb" placeholder="Ex: 7" 
                               min="3" max="20" step="0.1" onchange="calcularTransfusoes()">
                    </div>

                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-bullseye"></i> Hemoglobina Alvo (g/dL)</label>
                        <input type="number" class="form-select" id="transf_hb_alvo" placeholder="Ex: 10" 
                               min="7" max="15" step="0.1" value="10" onchange="calcularTransfusoes()">
                    </div>

                    <div id="transfResult" class="result-box" style="display: none;">
                        <h3>Prescrição de Hemoderivados</h3>
                        
                        <div class="calc-result-item" style="background: #FEE2E2; padding: var(--spacing-md); border-radius: var(--radius-sm);">
                            <h4 style="margin: 0 0 var(--spacing-sm) 0; color: #991B1B;">
                                <i class="fas fa-flask"></i> Concentrado de Hemácias (CH)
                            </h4>
                            <div class="result-label">Volume Necessário</div>
                            <div class="result-value" id="transfCH" style="color: #DC2626; font-size: 20px;">-</div>
                            <div style="font-size: 12px; margin-top: var(--spacing-xs);" id="transfCHObs">-</div>
                        </div>
                        
                        <div class="calc-result-item" style="background: #FEF3C7; padding: var(--spacing-md); border-radius: var(--radius-sm);">
                            <h4 style="margin: 0 0 var(--spacing-sm) 0; color: #92400E;">
                                <i class="fas fa-vial"></i> Plasma Fresco Congelado (PFC)
                            </h4>
                            <div class="result-label">Volume (se INR > 1.5 ou sangramento)</div>
                            <div class="result-value" id="transfPFC" style="color: #D97706; font-size: 18px;">-</div>
                        </div>
                        
                        <div class="calc-result-item" style="background: #DBEAFE; padding: var(--spacing-md); border-radius: var(--radius-sm);">
                            <h4 style="margin: 0 0 var(--spacing-sm) 0; color: #1E3A8A;">
                                <i class="fas fa-bacterium"></i> Concentrado de Plaquetas
                            </h4>
                            <div class="result-label">Volume (se PLT < 50k ou sangramento)</div>
                            <div class="result-value" id="transfPLT" style="color: #2563EB; font-size: 18px;">-</div>
                        </div>
                        
                        <div class="calc-result-item" style="background: #E0E7FF; padding: var(--spacing-md); border-radius: var(--radius-sm);">
                            <h4 style="margin: 0 0 var(--spacing-sm) 0; color: #3730A3;">
                                <i class="fas fa-snowflake"></i> Crioprecipitado
                            </h4>
                            <div class="result-label">Volume (se fibrinogênio < 100-150 mg/dL)</div>
                            <div class="result-value" id="transfCRIO" style="color: #4F46E5; font-size: 18px;">-</div>
                        </div>

                        <div class="risk-recommendation" id="transfRecommendation" style="margin-top: var(--spacing-md);"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetTransfusoes()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Fórmulas</h3>
                <h4>Concentrado de Hemácias:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Neonatos/Pediátrico:</strong> 10-15 mL/kg</li>
                    <li><strong>Adultos:</strong> 1 CH aumenta Hb em ~1 g/dL</li>
                    <li><strong>Fórmula exata:</strong> Vol(mL) = [(Hb alvo - Hb atual) × Peso × 3]</li>
                </ul>
                <h4>Plasma Fresco Congelado:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Dose:</strong> 10-20 mL/kg (alvo INR < 1.5)</li>
                    <li><strong>1 unidade adulto:</strong> ~250 mL</li>
                </ul>
                <h4>Plaquetas:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Pediátrico:</strong> 10-20 mL/kg</li>
                    <li><strong>Adulto:</strong> 1 pool (6 unidades) ou 1 aférese</li>
                    <li><strong>Aumento esperado:</strong> ~30.000-50.000/µL</li>
                </ul>
                <h4>Crioprecipitado:</h4>
                <ul style="font-size: 13px;">
                    <li><strong>Dose:</strong> 1 unidade/10 kg ou 5-10 unidades (adulto)</li>
                    <li><strong>Cada unidade:</strong> ~200 mg fibrinogênio</li>
                </ul>
                <h4>Transfusão Maciça (1:1:1):</h4>
                <ul style="font-size: 13px;">
                    <li><strong>CH : PFC : PLT</strong> em proporção 1:1:1</li>
                    <li>Adicionar crioprecipitado se fibrinogênio < 100</li>
                    <li>Ácido tranexâmico 1g IV IMEDIATO</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function calcularTransfusoes() {
    const faixa = document.getElementById('transf_faixa').value;
    const peso = parseFloat(document.getElementById('transf_peso').value);
    const hb = parseFloat(document.getElementById('transf_hb').value);
    const hb_alvo = parseFloat(document.getElementById('transf_hb_alvo').value);
    
    if (!faixa || !peso || !hb || !hb_alvo || peso < 0.5) {
        document.getElementById('transfResult').style.display = 'none';
        return;
    }
    
    if (hb_alvo <= hb) {
        alert('Hemoglobina alvo deve ser maior que a atual');
        return;
    }
    
    let volCH, volPFC, volPLT, volCRIO, unidadesCH, chObs, recommendation;
    
    // === CONCENTRADO DE HEMÁCIAS ===
    if (faixa === 'neo' || faixa === 'lactente' || faixa === 'crianca') {
        // Pediátrico: usar fórmula precisa ou 10-15 mL/kg
        let volFormula = (hb_alvo - hb) * peso * 3; // Fórmula baseada em volemia
        let volSimples = peso * 10; // Dose simples
        volCH = Math.max(volFormula, volSimples);
        unidadesCH = Math.ceil(volCH / 250); // Considerando bolsas de 250mL
        chObs = `Infundir <strong>${volCH.toFixed(0)} mL</strong> (aproximadamente ${unidadesCH} unidade(s) pediátrica(s)).<br>
        <strong>Velocidade:</strong> 5 mL/kg/h (máx 2-4h). Não exceder 10 mL/kg se euvolêmico.<br>
        <strong>Filtro leucorreduzido</strong> em neonatos/imunossuprimidos.`;
    } else {
        // Adolescente/Adulto: 1 CH aumenta ~1 g/dL
        unidadesCH = Math.ceil(hb_alvo - hb);
        volCH = unidadesCH * 300; // ~300mL por unidade adulto
        chObs = `<strong>${unidadesCH} concentrado(s) de hemácias</strong> (CH).<br>
        Cada CH adulto tem ~300 mL e aumenta Hb em ~1 g/dL.<br>
        <strong>Velocidade:</strong> 1-2 horas por unidade (máx 4h).`;
    }
    
    // === PLASMA FRESCO CONGELADO ===
    let dosePFC = 15; // mL/kg (dose padrão)
    volPFC = peso * dosePFC;
    let unidadesPFC = Math.ceil(volPFC / 250);
    
    // === PLAQUETAS ===
    let dosePLT = 10; // mL/kg
    volPLT = peso * dosePLT;
    let unidadesPLT;
    if (faixa === 'adulto') {
        unidadesPLT = '1 pool (6 U) ou 1 aférese';
    } else {
        unidadesPLT = `${Math.ceil(volPLT / 50)} unidade(s)`;
    }
    
    // === CRIOPRECIPITADO ===
    let unidadesCRIO = Math.ceil(peso / 10);
    if (faixa === 'adulto') {
        unidadesCRIO = Math.max(unidadesCRIO, 10); // Mínimo 10 unidades adulto
    }
    volCRIO = unidadesCRIO * 15; // ~15mL por unidade
    
    // === OUTPUT ===
    document.getElementById('transfCH').textContent = 
        faixa === 'neo' || faixa === 'lactente' || faixa === 'crianca' ? 
        `${volCH.toFixed(0)} mL` : `${unidadesCH} CH`;
    document.getElementById('transfCHObs').innerHTML = chObs;
    
    document.getElementById('transfPFC').textContent = 
        `${volPFC.toFixed(0)} mL (${unidadesPFC} unidade(s))`;
    
    document.getElementById('transfPLT').textContent = 
        faixa === 'adulto' ? unidadesPLT : `${volPLT.toFixed(0)} mL (${unidadesPLT})`;
    
    document.getElementById('transfCRIO').textContent = 
        `${unidadesCRIO} unidade(s) (~${volCRIO.toFixed(0)} mL)`;
    
    // === RECOMENDAÇÕES ===
    recommendation = `
        <h4 style="color: var(--primary-dark);">📋 Recomendações Clínicas:</h4>
        <ul style="font-size: 13px; margin-top: var(--spacing-sm);">
            <li><strong>Gatilho transfusional Hb:</strong>
                <ul style="margin-left: var(--spacing-md); font-size: 12px;">
                    <li>Paciente estável: Hb < 7 g/dL</li>
                    <li>Cardiopata/idoso: Hb < 8 g/dL</li>
                    <li>Sangramento ativo: individualizar</li>
                </ul>
            </li>
            <li><strong>Pré-transfusão:</strong> Tipo sanguíneo, prova cruzada, consentimento, acesso calibroso</li>
            <li><strong>Monitorização:</strong> Sinais vitais a cada 15 min na 1ª hora, depois 30/30 min</li>
            <li><strong>Reações transfusionais:</strong> Parar imediatamente se febre, calafrios, dispneia, hipotensão</li>
        </ul>
        
        <div style="background: #FEF2F2; padding: var(--spacing-md); border-radius: var(--radius-sm); margin-top: var(--spacing-md); border-left: 4px solid #DC2626;">
            <h4 style="color: #991B1B; margin: 0 0 var(--spacing-sm) 0;">
                <i class="fas fa-exclamation-triangle"></i> Transfusão Maciça (Protocolo 1:1:1)
            </h4>
            <p style="font-size: 13px; margin: 0;">
                <strong>Definição:</strong> Perda de 1 volemia em 24h OU > 50% volemia em 3h OU > 150 mL/min<br><br>
                <strong>Protocolo:</strong><br>
                • <strong>${unidadesCH} CH</strong> : <strong>${unidadesPFC} PFC</strong> : <strong>1 pool PLT</strong> (proporção 1:1:1)<br>
                • <strong>Ácido tranexâmico:</strong> 1g IV IMEDIATO (nas primeiras 3h)<br>
                • <strong>Crioprecipitado:</strong> ${unidadesCRIO} unidades se fibrinogênio < 100 mg/dL<br>
                • <strong>Cálcio:</strong> 1g IV a cada 4 CH (quelação pelo citrato)<br>
                • <strong>Manter aquecimento</strong> dos hemoderivados e do paciente<br>
                • <strong>Alvos:</strong> Hb > 7-9, PLT > 50k (>100k em TCE/neuro), INR < 1.5, Fibrinogênio > 150<br>
                • <strong>Controle cirúrgico</strong> do sangramento prioritário
            </p>
        </div>
        
        <div style="background: #FEF3C7; padding: var(--spacing-sm); border-radius: var(--radius-sm); margin-top: var(--spacing-sm); font-size: 12px;">
            <strong>⚠️ Lembrete:</strong> Dados calculados para peso <strong>${peso.toFixed(1)} kg</strong>. 
            Ajustar conforme resposta clínica e laboratorial (Hb, coagulograma, plaquetas).
        </div>
    `;
    
    document.getElementById('transfRecommendation').innerHTML = recommendation;
    document.getElementById('transfResult').style.display = 'block';
}

function resetTransfusoes() {
    document.getElementById('transfusaoForm').reset();
    document.getElementById('transfResult').style.display = 'none';
}

console.log('✅ Calculadoras clínicas complementares carregadas');

