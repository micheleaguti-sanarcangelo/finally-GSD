'use client';

import { usePriceStore } from '@/lib/store';

interface HeaderProps {
  totalValue: number;
  cashBalance: number;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#22c55e',
  CONNECTING: '#eab308',
  CLOSED: '#ef4444',
};

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function Header({ totalValue, cashBalance }: HeaderProps) {
  const status = usePriceStore((state) => state.status);
  const dotColor = STATUS_COLORS[status] ?? STATUS_COLORS.CLOSED;

  return (
    <header
      style={{
        backgroundColor: '#1a1a2e',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid #2a2a3a',
        flexShrink: 0,
      }}
    >
      {/* Left: brand */}
      <span style={{ color: '#ecad0a', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
        FinAlly
      </span>

      {/* Right: metrics + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Portfolio Value
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
            ${formatMoney(totalValue)}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Cash
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
            ${formatMoney(cashBalance)}
          </div>
        </div>

        {/* Connection status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: dotColor,
              transition: 'background-color 0.3s ease',
            }}
            title={status}
          />
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
