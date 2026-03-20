import { useCallback, useRef, useState, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export default function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<'idle' | 'pulling' | 'refreshing'>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || state === 'refreshing') return;
    // 페이지가 맨 위에 있을 때만 작동
    if (window.scrollY > 5) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [disabled, state]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || disabled || state === 'refreshing') return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      // 당기는 중 — 스크롤 방지
      const distance = Math.min(dy * 0.5, threshold * 1.5);
      setPullDistance(distance);
      if (distance > 10) {
        setState('pulling');
      }
    }
  }, [disabled, state, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || disabled) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setState('refreshing');
      setPullDistance(threshold * 0.6);
      try {
        await onRefresh();
      } catch (e) {
        void e;
      }
    }

    setState('idle');
    setPullDistance(0);
  }, [disabled, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { state, pullDistance };
}
