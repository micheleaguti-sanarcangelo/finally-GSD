'use client';

import { Treemap, ResponsiveContainer } from 'recharts';
import { usePriceStore } from '@/lib/store';

interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  unrealized_pnl: number;
}

interface PortfolioHeatmapProps {
  positions: Position[];
}

interface TreemapNode {
  name: string;
  size: number;
  pnl: number;
}

const CustomContent = (props: any) => {
  const { x, y, width, height, name, pnl } = props;
  const fill = pnl > 0 ? '#16a34a' : pnl < 0 ? '#dc2626' : '#374151';
  const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#0d1117"
        strokeWidth={1}
      />
      {width > 60 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (height > 50 ? 8 : 0)}
          textAnchor="middle"
          fill="white"
          fontSize={11}
          fontWeight="bold"
        >
          {name}
        </text>
      )}
      {width > 60 && height > 50 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize={10}
        >
          {pnlStr}
        </text>
      )}
    </g>
  );
};

export function PortfolioHeatmap({ positions }: PortfolioHeatmapProps) {
  const prices = usePriceStore((state) => state.prices);

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No positions yet
      </div>
    );
  }

  const treemapData: TreemapNode[] = positions.map((pos) => {
    const currentPrice = prices[pos.ticker]?.price ?? pos.avg_cost;
    const marketValue = currentPrice * pos.quantity;
    const pnl = (currentPrice - pos.avg_cost) * pos.quantity;
    return { name: pos.ticker, size: Math.max(marketValue, 1), pnl };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={treemapData}
        dataKey="size"
        aspectRatio={4 / 3}
        isAnimationActive={false}
        content={<CustomContent />}
      />
    </ResponsiveContainer>
  );
}
