'use client';

import { useState, useRef, useEffect } from 'react';

interface TradeAction {
  ticker: string;
  side: string;
  quantity: number;
}

interface WatchlistChange {
  ticker: string;
  action: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  trades?: TradeAction[];
  watchlist_changes?: WatchlistChange[];
}

interface ChatPanelProps {
  onTradeExecuted: () => void;
}

export function ChatPanel({ onTradeExecuted }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.message ?? 'No response',
          trades: data.trades ?? [],
          watchlist_changes: data.watchlist_changes ?? [],
        },
      ]);

      if (data.trades && data.trades.length > 0) {
        onTradeExecuted();
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: could not reach the assistant. Try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="px-3 py-2 border-b border-[#2a2a3a]">
        <span className="text-xs text-gray-400 uppercase tracking-wider">AI Assistant</span>
      </div>

      <div
        ref={messagesEndRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && !loading && (
          <p className="text-gray-600 text-xs text-center mt-4">
            Ask me about your portfolio or to execute trades.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#1e2a3a] text-white'
                  : 'bg-[#0f1923] text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.role === 'assistant' && msg.trades && msg.trades.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.trades.map((trade, j) => (
                    <span
                      key={j}
                      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        trade.side === 'buy'
                          ? 'bg-green-900 text-green-300'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      Executed {trade.side} {trade.quantity} {trade.ticker}
                    </span>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && msg.watchlist_changes && msg.watchlist_changes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {msg.watchlist_changes.map((wc, j) => (
                    <span
                      key={j}
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-900 text-blue-300"
                    >
                      Watchlist: {wc.action}ed {wc.ticker}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-[#0f1923] text-gray-400 rounded px-3 py-2 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#2a2a3a]">
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask FinAlly... (Enter to send, Shift+Enter for newline)"
            data-testid="chat-input"
            className="flex-1 px-2 py-1.5 text-sm bg-[#1a1a2e] text-[#e2e8f0]
              border border-[#2a2a3a] rounded resize-none
              focus:outline-none focus:border-[#209dd7]
              placeholder-gray-600 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            data-testid="chat-send-btn"
            className="px-3 py-1.5 text-sm font-bold rounded
              bg-[#753991] hover:bg-[#5f2e76] text-white
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors
              self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
