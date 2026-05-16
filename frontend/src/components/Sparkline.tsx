interface SparklineProps {
  prices: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ prices, width = 80, height = 32 }: SparklineProps) {
  if (prices.length < 2) {
    return <svg width={width} height={height} />;
  }

  let min = Math.min(...prices);
  let max = Math.max(...prices);

  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }

  const points = prices
    .map((price, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((price - min) / (max - min)) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'hidden' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="#209dd7"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
