'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0d1117',
      color: '#e6edf3',
      fontFamily: 'monospace',
      gap: 16,
    }}>
      <div style={{ color: '#f85149', fontSize: 18, fontWeight: 600 }}>
        Something went wrong
      </div>
      <div style={{ color: '#8b949e', fontSize: 13, maxWidth: 480, textAlign: 'center' }}>
        {error.message}
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '6px 16px',
          backgroundColor: '#21262d',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Try again
      </button>
    </div>
  );
}
