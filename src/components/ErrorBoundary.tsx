import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>();

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };
    
    const handleReject = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setError(event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleReject);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleReject);
    };
  }, []);

  if (hasError) {
    return fallback || (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black p-8 text-center">
        <div className="mb-6 text-6xl">⚠️</div>
        <h1 className="mb-2 text-2xl font-bold text-white">Oops! Something went wrong</h1>
        <p className="mb-6 text-sm text-vibe-muted">{error?.message || 'An unexpected error occurred'}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-vibe-accent px-8 py-3 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95"
        >
          Reload App
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function SuspenseFallback({ type }: { type: 'feed' | 'profile' | 'create' }) {
  if (type === 'feed') return <FeedSkeleton />;
  if (type === 'profile') return <ProfileSkeleton />;
  return <CreateSkeleton />;
}

function FeedSkeleton() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-vibe-accent/20 border-t-vibe-accent" />
        <p className="text-xs font-bold uppercase tracking-widest text-vibe-muted">Loading vibes...</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="w-full max-w-xl space-y-6 p-6">
      <div className="flex items-center space-x-4">
        <div className="h-20 w-20 animate-pulse rounded-full bg-vibe-line" />
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-vibe-line" />
          <div className="h-4 w-24 animate-pulse rounded bg-vibe-line" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded bg-vibe-line" />
        ))}
      </div>
    </div>
  );
}

function CreateSkeleton() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-vibe-accent/20 border-t-vibe-accent" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-vibe-line ${className}`} />;
}