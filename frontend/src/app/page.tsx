'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { Header } from '@/components/Header';
import { WatchlistPanel } from '@/components/WatchlistPanel';
import { TradeBar } from '@/components/TradeBar';
import { PositionsTable } from '@/components/PositionsTable';
import { ChatPanel } from '@/components/ChatPanel';
import { MainChart } from '@/components/MainChart';
import { PortfolioHeatmap } from '@/components/PortfolioHeatmap';
import { PnLChart } from '@/components/PnLChart';

type Position = {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pnl_percent: number;
};

type Portfolio = {
  positions: Position[];
  cash_balance: number;
  total_value: number;
};

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  useSSE();

  async function fetchPortfolio() {
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) return;
      const data = await res.json();
      setPortfolio(data);
    } catch {
      // leave portfolio unchanged on network error
    }
  }

  function handleTradeExecuted() {
    fetchPortfolio();
    setHistoryVersion((v) => v + 1);
  }

  useEffect(() => {
    fetchPortfolio();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#0d1117' }}>
      {/* Fixed header — full width */}
      <Header
        totalValue={portfolio?.total_value ?? 0}
        cashBalance={portfolio?.cash_balance ?? 0}
      />

      {/* Three-column content area — fills remaining height */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left column 260px: watchlist (scrollable) + trade bar (pinned bottom) */}
        <div style={{ width: 260, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2a3a', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <WatchlistPanel
              selectedTicker={selectedTicker}
              onSelectTicker={setSelectedTicker}
            />
          </div>
          <div style={{ borderTop: '1px solid #2a2a3a' }}>
            <TradeBar
              selectedTicker={selectedTicker}
              onTradeExecuted={handleTradeExecuted}
            />
          </div>
        </div>

        {/* Center column flex-1: main chart (55%) + positions + P&L chart (45%) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: '0 0 55%', overflow: 'hidden', borderBottom: '1px solid #2a2a3a', padding: 8 }}>
            <MainChart ticker={selectedTicker} />
          </div>
          <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
              <PositionsTable positions={portfolio?.positions ?? []} />
            </div>
            <div style={{ height: 160, borderTop: '1px solid #2a2a3a', padding: 8 }}>
              <PnLChart historyVersion={historyVersion} />
            </div>
          </div>
        </div>

        {/* Right column 320px: portfolio heatmap above chat panel */}
        <div style={{ width: 320, borderLeft: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 200, borderBottom: '1px solid #2a2a3a', padding: 8 }}>
            <PortfolioHeatmap positions={portfolio?.positions ?? []} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ChatPanel onTradeExecuted={handleTradeExecuted} />
          </div>
        </div>

      </div>
    </div>
  );
}
