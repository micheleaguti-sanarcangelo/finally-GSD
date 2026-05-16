'use client';

import { useEffect, useState, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePriceStore } from '@/lib/store';

interface MainChartProps {
  ticker: string | null;
}

interface PricePoint {
  time: number;
  price: number;
}

export function MainChart({ ticker }: MainChartProps) {
  const prices = usePriceStore((state) => state.prices);
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const lastTimestampRef = useRef<Record<string, number>>({});

  // Accumulate price history from SSE for all tickers
  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;

    setPriceHistory((prev) => {
      const next = { ...prev };
      for (const t of Object.keys(prices)) {
        const update = prices[t];
        const lastTs = lastTimestampRef.current[t] ?? 0;
        if (update.timestamp !== lastTs) {
          lastTimestampRef.current[t] = update.timestamp;
          const existing = next[t] ?? [];
          next[t] = [...existing, { time: update.timestamp * 1000, price: update.price }].slice(-200);
        }
      }
      return next;
    });
  }, [prices]);

  // Seed a starting point when the selected ticker changes so the chart
  // appears after one SSE tick instead of two
  useEffect(() => {
    if (!ticker || !prices[ticker]) return;
    setPriceHistory((prev) => {
      if ((prev[ticker]?.length ?? 0) > 0) return prev;
      const p = prices[ticker];
      return { ...prev, [ticker]: [{ time: p.timestamp * 1000, price: p.price }] };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const currentPrice = ticker ? prices[ticker]?.price : null;
  const history = ticker ? (priceHistory[ticker] ?? []) : [];
  const hasData = history.length >= 2;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2 px-1">
        {ticker ? (
          <>
            <span className="text-accent-blue font-mono font-bold text-lg">{ticker}</span>
            <span className="text-accent-yellow font-mono text-base">
              {currentPrice != null ? `$${currentPrice.toFixed(2)}` : '---'}
            </span>
          </>
        ) : (
          <span className="text-slate-500 text-sm">No ticker selected</span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            {ticker ? 'Accumulating price data...' : 'Select a ticker from the watchlist'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(32,157,215,0.3)" stopOpacity={1} />
                  <stop offset="95%" stopColor="rgba(32,157,215,0)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #2a2a3a',
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                labelFormatter={(label: number) => new Date(label).toLocaleTimeString()}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#209dd7"
                fill="url(#chartGradient)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
