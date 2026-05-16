'use client';

import { useState, useEffect } from 'react';

interface TradeBarProps {
  selectedTicker: string | null;
  onTradeExecuted: () => void;
}

export function TradeBar({ selectedTicker, onTradeExecuted }: TradeBarProps) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTicker !== null) {
      setTicker(selectedTicker);
    }
  }, [selectedTicker]);

  async function executeTrade(side: 'buy' | 'sell') {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Invalid quantity');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.toUpperCase().trim(), quantity: qty, side }),
      });

      if (res.ok) {
        setError(null);
        onTradeExecuted();
      } else if (res.status === 400) {
        const data = await res.json();
        setError(data.detail ?? 'Trade failed');
      } else {
        setError('Trade failed — unexpected error');
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 border-t border-[#2a2a3a]">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Trade</div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker"
          maxLength={10}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono uppercase
            bg-[#1a1a2e] text-[#e2e8f0] border border-[#2a2a3a] rounded
            focus:outline-none focus:border-[#209dd7] placeholder-gray-600"
        />
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          min="1"
          step="1"
          className="w-20 px-2 py-1.5 text-sm font-mono
            bg-[#1a1a2e] text-[#e2e8f0] border border-[#2a2a3a] rounded
            focus:outline-none focus:border-[#209dd7] placeholder-gray-600"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => executeTrade('buy')}
          disabled={loading}
          className="flex-1 py-1.5 text-sm font-bold rounded
            bg-[#22c55e] hover:bg-[#16a34a] text-white
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : 'Buy'}
        </button>
        <button
          onClick={() => executeTrade('sell')}
          disabled={loading}
          className="flex-1 py-1.5 text-sm font-bold rounded
            bg-[#ef4444] hover:bg-[#dc2626] text-white
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : 'Sell'}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
