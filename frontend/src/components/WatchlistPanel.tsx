'use client';

import { useEffect, useRef, useState } from 'react';
import { usePriceStore } from '@/lib/store';
import { Sparkline } from './Sparkline';

interface WatchlistPanelProps {
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onTradeOpen?: (ticker: string) => void;
}

type FlashDirection = 'up' | 'down' | null;

export function WatchlistPanel({ selectedTicker, onSelectTicker }: WatchlistPanelProps) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [sparklineHistory, setSparklineHistory] = useState<Record<string, number[]>>({});
  const [flashState, setFlashState] = useState<Record<string, FlashDirection>>({});
  const [addInput, setAddInput] = useState('');

  const prices = usePriceStore((state) => state.prices);
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function fetchWatchlist() {
    try {
      const res = await fetch('/api/watchlist');
      if (!res.ok) return;
      const data = (await res.json()) as { watchlist: Array<{ ticker: string; price: number | null }> };
      setWatchlist(data.watchlist.map((entry) => entry.ticker));
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
    }
  }

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Accumulate sparkline history and trigger flash on price changes
  useEffect(() => {
    if (watchlist.length === 0) return;

    setSparklineHistory((prev) => {
      const next = { ...prev };
      for (const ticker of watchlist) {
        const update = prices[ticker];
        if (update) {
          const history = prev[ticker] ?? [];
          next[ticker] = [...history, update.price].slice(-60);
        }
      }
      return next;
    });

    // Flash logic per ticker
    for (const ticker of watchlist) {
      const update = prices[ticker];
      if (!update) continue;

      const direction = update.direction;
      if (direction === 'flat') continue;

      // Clear existing timer
      if (flashTimers.current[ticker]) {
        clearTimeout(flashTimers.current[ticker]);
      }

      setFlashState((prev) => ({ ...prev, [ticker]: direction as FlashDirection }));

      flashTimers.current[ticker] = setTimeout(() => {
        setFlashState((prev) => ({ ...prev, [ticker]: null }));
      }, 500);
    }
  }, [prices, watchlist]);

  // Cleanup all flash timers on unmount
  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      for (const id of Object.values(timers)) {
        clearTimeout(id);
      }
    };
  }, []);

  async function handleRemove(ticker: string) {
    try {
      await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
      await fetchWatchlist();
    } catch (err) {
      console.error('Failed to remove ticker:', err);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ticker = addInput.toUpperCase().trim();
    if (!ticker || ticker.length > 10) return;
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok || res.status === 400) {
        setAddInput('');
        await fetchWatchlist();
      }
    } catch (err) {
      console.error('Failed to add ticker:', err);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0d1117',
        borderRight: '1px solid #2a2a3a',
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2a3a' }}>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Watchlist
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a3a' }}>
              <th style={thStyle}>Ticker</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Chg%</th>
              <th style={thStyle}></th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((ticker) => {
              const update = prices[ticker];
              const flash = flashState[ticker];
              const isSelected = selectedTicker === ticker;
              const changePercent = update?.change_percent ?? 0;
              const changeColor = changePercent >= 0 ? '#22c55e' : '#ef4444';

              return (
                <tr
                  key={ticker}
                  onClick={() => onSelectTicker(ticker)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#1e2a3a' : 'transparent',
                    borderBottom: '1px solid #2a2a3a',
                  }}
                >
                  <td style={{ ...tdStyle, color: '#ecad0a', fontWeight: 600 }}>{ticker}</td>
                  <td
                    className={flash === 'up' ? 'flash-up' : flash === 'down' ? 'flash-down' : ''}
                    style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {update ? `$${update.price.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: changeColor }}>
                    {update ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ ...tdStyle, padding: '2px 4px' }}>
                    <Sparkline prices={sparklineHistory[ticker] ?? []} />
                  </td>
                  <td style={{ ...tdStyle, padding: '2px 8px 2px 0', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(ticker);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#4b5563',
                        fontSize: '0.9rem',
                        lineHeight: 1,
                        padding: '0 2px',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; }}
                      title={`Remove ${ticker}`}
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add ticker form */}
      <form
        onSubmit={handleAdd}
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px',
          borderTop: '1px solid #2a2a3a',
        }}
      >
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value.toUpperCase())}
          placeholder="Ticker"
          maxLength={10}
          data-testid="watchlist-ticker-input"
          style={{
            flex: 1,
            backgroundColor: '#0d1117',
            border: '1px solid #2a2a3a',
            borderRadius: '4px',
            color: '#e2e8f0',
            padding: '4px 8px',
            fontSize: '0.75rem',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          data-testid="watchlist-add-btn"
          style={{
            backgroundColor: '#753991',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Add
        </button>
      </form>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  color: '#64748b',
  fontWeight: 500,
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px',
  whiteSpace: 'nowrap',
};
