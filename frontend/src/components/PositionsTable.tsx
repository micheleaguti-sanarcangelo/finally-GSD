'use client';

import { usePriceStore } from '@/lib/store';

interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const prices = usePriceStore(state => state.prices);

  if (positions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">No positions — buy something from the trade bar</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#2a2a3a] text-gray-400 uppercase tracking-wider">
            <th className="px-3 py-2 text-left">Ticker</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Avg Cost</th>
            <th className="px-3 py-2 text-right">Live Price</th>
            <th className="px-3 py-2 text-right">P&amp;L ($)</th>
            <th className="px-3 py-2 text-right">P&amp;L (%)</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const livePrice = prices[pos.ticker]?.price ?? pos.avg_cost;
            const livePnl = (livePrice - pos.avg_cost) * pos.quantity;
            const livePnlPct = ((livePrice - pos.avg_cost) / pos.avg_cost) * 100;
            const pnlColor = livePnl >= 0 ? 'text-green-400' : 'text-red-400';
            const pnlSign = livePnl >= 0 ? '+' : '';
            const pctSign = livePnlPct >= 0 ? '+' : '';

            return (
              <tr
                key={pos.ticker}
                className="border-b border-[#1a1a2e] hover:bg-[#1a1a2e] transition-colors"
              >
                <td className="px-3 py-2 font-bold text-[#ecad0a] font-mono">{pos.ticker}</td>
                <td className="px-3 py-2 text-right text-[#e2e8f0] font-mono">{pos.quantity}</td>
                <td className="px-3 py-2 text-right text-[#e2e8f0] font-mono">
                  ${pos.avg_cost.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-[#e2e8f0] font-mono">
                  ${livePrice.toFixed(2)}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${pnlColor}`}>
                  {pnlSign}${livePnl.toFixed(2)}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${pnlColor}`}>
                  {pctSign}{livePnlPct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
