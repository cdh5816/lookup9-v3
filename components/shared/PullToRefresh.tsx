import React from 'react';
import usePullToRefresh from 'hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const PullToRefresh = ({ onRefresh, children, disabled }: PullToRefreshProps) => {
  const { state, pullDistance } = usePullToRefresh({ onRefresh, disabled });

  return (
    <div>
      <div
        className="ptr-indicator"
        style={{ height: state !== 'idle' ? `${Math.max(pullDistance, state === 'refreshing' ? 48 : 0)}px` : '0' }}
      >
        {state === 'pulling' && (
          <span style={{ opacity: Math.min(pullDistance / 60, 1), fontSize: '13px', color: 'var(--text-muted)' }}>
            ↓ 당겨서 새로고침
          </span>
        )}
        {state === 'refreshing' && (
          <div className="flex items-center gap-2">
            <div className="ptr-spinner" />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>새로고침 중...</span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
