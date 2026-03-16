import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useUser } from './UserContext';
import { useResidencia } from '../hooks/useResidencia';
import { useTrocaPlantao } from '../hooks/useTrocaPlantao';
import { askMedicalQuestion } from '../services/aiService';
import { useMessages } from './MessagesContext';

const ResidenciaChatContext = createContext(null);

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Normalizar texto removendo acentos e convertendo para lowercase
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Classificar intencao do usuario baseado em keywords
 */
function classifyIntent(text) {
  const n = normalize(text);

  // Trocas de plantao
  if (/aceitar\s+tr\d+/i.test(n)) {
    const match = text.match(/TR\d+/i);
    return { intent: 'trade_accept', code: match ? match[0].toUpperCase() : null };
  }
  if (/rejeitar\s+tr\d+/i.test(n)) {
    const match = text.match(/TR\d+/i);
    return { intent: 'trade_reject', code: match ? match[0].toUpperCase() : null };
  }
  if (/cancelar\s+tr\d+/i.test(n)) {
    const match = text.match(/TR\d+/i);
    return { intent: 'trade_cancel', code: match ? match[0].toUpperCase() : null };
  }
  if (/\b(trocar|troca.?plantao|solicitar\s+troca)\b/.test(n)) {
    return { intent: 'trade_request' };
  }
  if (/\b(minhas\s+trocas|status.*troca|trocas?\s+pendente|pendentes)\b/.test(n)) {
    return { intent: 'trade_list' };
  }

  // Escalas e plantao
  if (/\b(plantao\s+hoje|quem\s+esta\s+de\s+plantao|escala|plantao\s+amanha|plantao\s+agora)\b/.test(n)) {
    return { intent: 'schedule_query' };
  }

  // Estagios
  if (/\b(estagio|rodizio|rodizio|onde\s+esta|qual\s+estagio)\b/.test(n)) {
    return { intent: 'rotation_query' };
  }

  // Help
  if (/\b(ola|oi|ajuda|menu|help|\/help|bom\s+dia|boa\s+tarde|boa\s+noite)\b/.test(n)) {
    return { intent: 'help' };
  }

  // Default: RAG medico
  return { intent: 'medical_rag' };
}

const HELP_MESSAGE = `Posso ajudar com:

**Dúvidas médicas** - Pergunte sobre anestesiologia (baseado no livro SAESP)
**Plantão** - "Quem está de plantão hoje?"
**Estágios** - "Qual estágio do Daniel?"
**Trocas de plantão** - "Solicitar troca" ou "Minhas trocas"
**Aceitar/Rejeitar troca** - "Aceitar TR847291"

Digite sua pergunta ou escolha uma opção abaixo.`;

export function ResidenciaChatProvider({ children }) {
  const { user, firebaseUser } = useUser();
  const { residentes, plantao, getPlantaoByDate, getEstagioByResidente } = useResidencia();
  const { trades, pendingTrades, createTrade, acceptTrade, rejectTrade, cancelTrade } = useTrocaPlantao();
  const { createSystemNotification } = useMessages();

  const [messages, setMessages] = useState([
    {
      id: generateId(),
      role: 'assistant',
      content: `Olá, ${user?.firstName || 'Dr(a)'}! Sou o assistente da residência médica. ${HELP_MESSAGE}`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);

  const addMessage = useCallback((role, content, metadata = null) => {
    const msg = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata }),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  /**
   * Formatar lista de trocas para exibição no chat
   */
  const formatTradesList = useCallback(() => {
    const all = [...trades, ...pendingTrades.filter(p => !trades.find(t => t.codigo === p.codigo))];
    if (all.length === 0) {
      return 'Você não tem trocas de plantão no momento.';
    }
    const lines = all.map(t => {
      const statusMap = { pendente: 'Pendente', aceita: 'Aceita', rejeitada: 'Rejeitada', cancelada: 'Cancelada' };
      return `**${t.codigo}** - ${t.dataPlantao} - ${statusMap[t.status] || t.status}\n  ${t.solicitanteNome}: ${t.descricao}`;
    });
    return `Suas trocas de plantão:\n\n${lines.join('\n\n')}`;
  }, [trades, pendingTrades]);

  /**
   * Handler principal de mensagens
   */
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim()) return;

    // Adicionar mensagem do usuario
    addMessage('user', text.trim());

    const { intent, code } = classifyIntent(text);

    switch (intent) {
      case 'help': {
        addMessage('assistant', HELP_MESSAGE);
        break;
      }

      case 'trade_request': {
        setShowTradeForm(true);
        addMessage('assistant', 'Preencha o formulário abaixo para solicitar uma troca de plantão.');
        break;
      }

      case 'trade_accept': {
        if (!code) {
          addMessage('assistant', 'Por favor, informe o código da troca. Exemplo: "Aceitar TR847291"');
          break;
        }
        setIsLoading(true);
        const { success, error } = await acceptTrade(code);
        setIsLoading(false);
        if (success) {
          addMessage('assistant', `Troca **${code}** aceita com sucesso!`);
        } else {
          addMessage('assistant', `Não foi possível aceitar a troca ${code}: ${error}`);
        }
        break;
      }

      case 'trade_reject': {
        if (!code) {
          addMessage('assistant', 'Por favor, informe o código da troca. Exemplo: "Rejeitar TR847291"');
          break;
        }
        setIsLoading(true);
        const { success, error } = await rejectTrade(code);
        setIsLoading(false);
        if (success) {
          addMessage('assistant', `Troca **${code}** rejeitada.`);
        } else {
          addMessage('assistant', `Não foi possível rejeitar a troca ${code}: ${error}`);
        }
        break;
      }

      case 'trade_cancel': {
        if (!code) {
          addMessage('assistant', 'Por favor, informe o código da troca. Exemplo: "Cancelar TR847291"');
          break;
        }
        setIsLoading(true);
        const { success, error } = await cancelTrade(code);
        setIsLoading(false);
        if (success) {
          addMessage('assistant', `Troca **${code}** cancelada.`);
        } else {
          addMessage('assistant', `Não foi possível cancelar a troca ${code}: ${error}`);
        }
        break;
      }

      case 'trade_list': {
        addMessage('assistant', formatTradesList());
        break;
      }

      case 'schedule_query': {
        const info = getPlantaoByDate(new Date());
        if (info) {
          addMessage('assistant', `Plantão atual:\n\n**${info.residente}** (${info.ano})\n${info.data} - ${info.hora}`);
        } else {
          addMessage('assistant', 'Não encontrei informações sobre o plantão atual.');
        }
        break;
      }

      case 'rotation_query': {
        // Tentar extrair nome do texto
        const words = normalize(text).replace(/\b(estagio|rodizio|qual|onde|esta|do|da|de)\b/g, '').trim();
        const nomeSearch = words.trim();

        if (nomeSearch) {
          const residente = getEstagioByResidente(nomeSearch);
          if (residente) {
            addMessage('assistant',
              `**${residente.nome}** (${residente.ano})\nEstágio: ${residente.estagio || 'Não definido'}\nCirurgião: ${residente.cirurgiao || 'Não definido'}`
            );
          } else {
            addMessage('assistant', `Não encontrei residente com nome "${nomeSearch}".`);
          }
        } else {
          // Listar todos os residentes
          const lista = residentes
            .filter(r => r.nome)
            .map(r => `**${r.nome}** (${r.ano}) - ${r.estagio || 'sem estágio'}`)
            .join('\n');
          addMessage('assistant', `Estágios atuais:\n\n${lista}`);
        }
        break;
      }

      case 'medical_rag':
      default: {
        // Build conversation history for context
        const recentHistory = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map(m => ({ role: m.role, content: m.content }));

        setIsLoading(true);
        try {
          const { answer, sources, error } = await askMedicalQuestion(text.trim(), recentHistory);

          if (error) {
            addMessage('assistant', `Desculpe, ocorreu um erro ao consultar o assistente: ${error}`);
          } else {
            addMessage('assistant', answer || 'Sem resposta.', sources?.length > 0 ? { sources } : null);
          }
        } catch (err) {
          console.error('medical_rag error:', err);
          addMessage('assistant', `Desculpe, ocorreu um erro inesperado: ${err.message}`);
        }
        setIsLoading(false);
        break;
      }
    }
  }, [addMessage, acceptTrade, rejectTrade, cancelTrade, formatTradesList, getPlantaoByDate, getEstagioByResidente, residentes]);

  /**
   * Handler para envio do formulario de troca
   */
  const handleTradeSubmit = useCallback(async (tradeData) => {
    setShowTradeForm(false);
    setIsLoading(true);

    const { success, trade, error } = await createTrade(tradeData);
    setIsLoading(false);

    if (success && trade) {
      addMessage('assistant',
        `Troca criada com sucesso!\n\n**Código:** ${trade.codigo}\n**Data:** ${tradeData.dataPlantao}\n**Descrição:** ${tradeData.descricao}\n\nCompartilhe o código **${trade.codigo}** com seus colegas.`
      );

      // Criar notificação no sistema
      createSystemNotification({
        category: 'plantao',
        subject: 'Nova solicitação de troca de plantão',
        content: `${user?.firstName || 'Um residente'} solicita troca para ${tradeData.dataPlantao}. Código: ${trade.codigo}`,
        priority: 'alta',
        actionUrl: 'trocasPlantao',
        actionLabel: 'Ver Troca',
      });
    } else {
      addMessage('assistant', `Não foi possível criar a troca: ${error}`);
    }
  }, [createTrade, addMessage, createSystemNotification, user]);

  /**
   * Limpar histórico do chat
   */
  const clearChat = useCallback(() => {
    setMessages([
      {
        id: generateId(),
        role: 'assistant',
        content: `Olá, ${user?.firstName || 'Dr(a)'}! Sou o assistente da residência médica. ${HELP_MESSAGE}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [user]);

  const value = {
    messages,
    isLoading,
    showTradeForm,
    setShowTradeForm,
    sendMessage,
    handleTradeSubmit,
    clearChat,
  };

  return (
    <ResidenciaChatContext.Provider value={value}>
      {children}
    </ResidenciaChatContext.Provider>
  );
}

export function useResidenciaChat() {
  const ctx = useContext(ResidenciaChatContext);
  if (!ctx) {
    throw new Error('useResidenciaChat must be used within ResidenciaChatProvider');
  }
  return ctx;
}

export default ResidenciaChatContext;
