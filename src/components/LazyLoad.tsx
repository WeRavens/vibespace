import { lazy, Suspense, ComponentType, ReactElement } from 'react';
import { SuspenseFallback } from './ErrorBoundary';

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3
) {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempts = new Map<string, number>();
      
      const attempt = () => {
        factory()
          .then(resolve)
          .catch((error) => {
            const key = factory.toString();
            const count = attempts.get(key) || 0;
            
            if (count < retries) {
              attempts.set(key, count + 1);
              setTimeout(attempt, 1000 * Math.pow(2, count));
            } else {
              reject(error);
            }
          });
      };
      
      attempt();
    });
  });
}

export const LazyFeed = lazyWithRetry(() => import('./Feed').then(m => ({ default: m.Feed as ComponentType<any> })));
export const LazyExplore = lazyWithRetry(() => import('./Explore').then(m => ({ default: m.Explore as ComponentType<any> })));
export const LazyProfile = lazyWithRetry(() => import('./ProfileGrid').then(m => ({ default: m.ProfileGrid as ComponentType<any> })));
export const LazyNotifications = lazyWithRetry(() => import('./Notifications').then(m => ({ default: m.Notifications as ComponentType<any> })));
export const LazyMessages = lazyWithRetry(() => import('./Messages').then(m => ({ default: m.Messages as ComponentType<any> })));
export const LazyStories = lazyWithRetry(() => import('./Stories').then(m => ({ default: m.Stories as ComponentType<any> })));
export const LazySearch = lazyWithRetry(() => import('./Search').then(m => ({ default: m.SearchModal as ComponentType<any> })));
export const LazyPoll = lazyWithRetry(() => import('./Poll').then(m => ({ default: m.Poll as ComponentType<any> })));

export function withLazyRetry<P extends object>(Component: ComponentType<P>) {
  return (props: P): ReactElement => (
    <Suspense fallback={<SuspenseFallback type="feed" />}>
      <Component {...props} />
    </Suspense>
  );
}
