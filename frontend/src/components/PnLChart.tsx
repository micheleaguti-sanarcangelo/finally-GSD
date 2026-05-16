'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PnLChartProps {
  historyVersion: number;
}

interface HistoryPoint {
  time: number;
  value: number;
}

export function PnLChart({ historyVersion }: PnLChartProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    fetch('/api/portfolio/history')
      .then((res) => res.json())
      .then((data) => {
        const mapped: HistoryPoint[] = (data.history ?? []).map(
          (h: { total_value: number; recorded_at: string }) => ({
            time: new Date(h.recorded_at).getTime(),
            value: h.total_value,
          })
        );
        setHistory(mapped);
      })
      .catch(() => {
        // leave history unchanged on network error
      });
  }, [historyVersion]);

  const hasData = history.length >= 2;

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs text-slate-400 mb-1 px-1">Portfolio Value (USD)</div>
      <div className="flex-1 min-h-0">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm text-center px-4">
            Portfolio history will appear after first trade
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(236,173,10,0.3)" stopOpacity={1} />
                  <stop offset="95%" stopColor="rgba(236,173,10,0)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={65}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #2a2a3a',
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Portfolio Value']}
                labelFormatter={(label: number) => new Date(label).toLocaleTimeString()}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ecad0a"
                fill="url(#pnlGradient)"
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
