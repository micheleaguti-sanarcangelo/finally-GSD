'use client';

import { useState, useEffect, useRef } from 'react';
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

function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 4,
        flexShrink: 0,
        cursor: 'col-resize',
        backgroundColor: hovered ? '#4a4a5a' : '#2a2a3a',
        transition: 'background-color 0.15s',
        userSelect: 'none',
      }}
    />
  );
}

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(320);
  const dragging = useRef<'left' | 'right' | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  function startDrag(side: 'left' | 'right', e: React.MouseEvent) {
    dragging.current = side;
    dragStartX.current = e.clientX;
    dragStartWidth.current = side === 'left' ? leftWidth : rightWidth;
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - dragStartX.current;
      if (dragging.current === 'left') {
        setLeftWidth(Math.max(180, Math.min(480, dragStartWidth.current + delta)));
      } else {
        setRightWidth(Math.max(240, Math.min(560, dragStartWidth.current - delta)));
      }
    }
    function onMouseUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

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

        {/* Left column: watchlist (scrollable) + trade bar (pinned bottom) */}
        <div style={{ width: leftWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
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

        {/* Drag handle: left | center */}
        <DragHandle onMouseDown={(e) => startDrag('left', e)} />

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

        {/* Drag handle: center | right */}
        <DragHandle onMouseDown={(e) => startDrag('right', e)} />

        {/* Right column: portfolio heatmap above chat panel */}
        <div style={{ width: rightWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
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
