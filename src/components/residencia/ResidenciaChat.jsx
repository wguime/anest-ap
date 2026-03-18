/**
 * ResidenciaChat
 * Interface de chat principal para o modulo de residencia medica.
 * Layout mobile-first com mensagens, acoes rapidas e input.
 */
import React, { Component, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Stethoscope, RefreshCw, HelpCircle, ArrowLeftRight, Trash2, BookOpen } from 'lucide-react';
import { Button, Spinner } from '@/design-system';
import { useResidenciaChat } from '../../contexts/ResidenciaChatContext';
import { useResidencia } from '../../hooks/useResidencia';
import TradeRequestForm from './TradeRequestForm';

// Lazy-load ReactMarkdown to avoid blocking initial render
let ReactMarkdown = null;
const ReactMarkdownPromise = import('react-markdown').then(mod => {
  ReactMarkdown = mod.default;
}).catch(() => {
  // If react-markdown fails to load, we'll use the plain text fallback
});

// ---------------------------------------------------------------------------
// Error boundary to prevent blank page on render crashes
// ---------------------------------------------------------------------------

class ChatErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('ChatErrorBoundary:', err); }
  render() {
    if (this.state.hasError) {
      return <p className="text-xs text-red-500 p-2">Erro ao renderizar mensagem.</p>;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple bold markdown: **texto** → <strong>texto</strong> */
function formatBold(text) {
  if (!text) return '';
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Render markdown content - uses ReactMarkdown if available, fallback to simple formatting */
function MarkdownContent({ children }) {
  if (ReactMarkdown) {
    return <ReactMarkdown>{children || ''}</ReactMarkdown>;
  }
  // Fallback: simple bold formatting with whitespace preservation
  return (
    <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatBold(children || '')) }} />
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SimilarityBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 70 ? 'bg-primary' : pct >= 50 ? 'bg-warning' : 'bg-[#9CA3AF]';

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function SourcesSection({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border/40 dark:border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline focus:outline-none"
      >
        <BookOpen className="w-3 h-3" />
        {open ? 'Ocultar fontes' : `Ver fontes (${sources.length})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {sources.map((src, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="shrink-0 w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground dark:text-[#D1D5DB] line-clamp-2 leading-relaxed">
                  {src.content || src.title || src.source || `Fonte ${i + 1}`}
                </p>
                {src.similarity != null && <SimilarityBar value={src.similarity} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatBubble({ message }) {
  const { role, content, metadata } = message;

  if (role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] bg-primary text-white dark:text-black rounded-2xl rounded-br-md px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </motion.div>
    );
  }

  // assistant
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 items-start"
    >
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="max-w-[80%] bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
        <ChatErrorBoundary>
          <div className="text-sm text-black dark:text-white max-w-none">
            <MarkdownContent>{content}</MarkdownContent>
          </div>
        </ChatErrorBoundary>
        {metadata?.sources?.length > 0 && (
          <SourcesSection sources={metadata.sources} />
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
            style={{ willChange: "transform, opacity" }}
          />
        ))}
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-primary hover:bg-muted dark:hover:bg-muted active:scale-[0.97] transition-all"
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResidenciaChat() {
  const {
    messages,
    isLoading,
    showTradeForm,
    setShowTradeForm,
    sendMessage,
    handleTradeSubmit,
    clearChat,
  } = useResidenciaChat();

  const { residentes } = useResidencia();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll on new messages or loading state change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-black dark:text-white">Assistente da Residencia</h2>
        </div>
        <button
          type="button"
          onClick={clearChat}
          title="Limpar conversa"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-muted dark:hover:bg-muted transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages area - scrollable */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
        ref={messagesEndRef}
      >
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
        {isLoading && <TypingIndicator />}
        <div ref={scrollRef} />
      </div>

      {/* Trade form (when showing) */}
      {showTradeForm && (
        <TradeRequestForm
          inline
          residentes={residentes}
          onSubmit={handleTradeSubmit}
          onCancel={() => setShowTradeForm(false)}
        />
      )}

      {/* Bottom dock: quick actions + input */}
      <div className="border-t border-border glass-surface">
        {/* Quick actions */}
        <div className="px-4 pt-3 pb-1.5 flex gap-2 overflow-x-auto scrollbar-hide">
          <QuickAction
            icon={Stethoscope}
            label="Plantao hoje"
            onClick={() => sendMessage('Quem esta de plantao hoje?')}
          />
          <QuickAction
            icon={ArrowLeftRight}
            label="Trocar plantao"
            onClick={() => sendMessage('Solicitar troca')}
          />
          <QuickAction
            icon={HelpCircle}
            label="Ajuda"
            onClick={() => sendMessage('ajuda')}
          />
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-1.5">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm text-black dark:text-white placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white dark:text-black disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResidenciaChat;
