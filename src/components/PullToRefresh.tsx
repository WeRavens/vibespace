import React, { useState, useRef, useCallback } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  pullDistance?: number;
}

export function PullToRefresh({ onRefresh, children, pullDistance = 80 }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && window.scrollY === 0) {
      setPullY(Math.min(diff * 0.4, pullDistance));
    }
  }, [isRefreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    isPulling.current = false;
    
    if (pullY >= pullDistance * 0.8) {
      setIsRefreshing(true);
      setPullY(0);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullY(0);
    }
  }, [pullY, pullDistance, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull Indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center overflow-hidden transition-transform"
        style={{
          height: pullY > 10 ? pullY : 0,
          transform: `translateY(${pullY > 10 ? -pullY : 0}px)`,
        }}
      >
        <div className="flex flex-col items-center justify-center py-2">
          {isRefreshing ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-vibe-accent/20 border-t-vibe-accent" />
          ) : (
            <div 
              className="h-8 w-8 rounded-full border-2 border-vibe-line flex items-center justify-center"
              style={{ borderColor: pullY > 20 ? 'var(--vibe-accent)' : undefined }}
            >
              <svg 
                className={`w-4 h-4 transition-transform ${pullY > 30 ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div 
        className="transition-transform"
        style={{ transform: `translateY(${pullY}px)` }}
      >
        {children}
      </div>
    </div>
  );
}