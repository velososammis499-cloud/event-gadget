export function LoadingState({ message = '加载中...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      color: 'var(--text-muted)',
      fontSize: 14,
    }}>
      {message}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      padding: 48,
      color: 'var(--danger)',
      fontSize: 14,
    }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'transparent',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '6px 16px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
        }}>
          重试
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      color: 'var(--text-muted)',
      fontSize: 14,
    }}>
      {message}
    </div>
  );
}
