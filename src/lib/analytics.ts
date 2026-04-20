type EventName = 
  | 'app_load'
  | 'create_vibe'
  | 'view_profile'
  | 'like_vibe'
  | 'save_vibe'
  | 'share_vibe'
  | 'comment_vibe'
  | 'view_story'
  | 'create_story'
  | 'send_message'
  | 'vote_poll'
  | 'search_user'
  | 'upload_media'
  | 'error_occurred';

interface AnalyticsEvent {
  name: EventName;
  params?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId: string;
  platform: 'web' | 'ios' | 'android';
}

class Analytics {
  private sessionId: string;
  private userId?: string;
  private platform: 'web' | 'ios' | 'android';
  private events: AnalyticsEvent[] = [];
  private flushInterval?: ReturnType<typeof setInterval>;
  private maxQueueSize = 50;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.platform = this.getPlatform();
    this.startFlushInterval();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPlatform(): 'web' | 'ios' | 'android' {
    if (typeof window === 'undefined') return 'web';
    try {
      const { Capacitor } = require('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        return Capacitor.getPlatform() as 'ios' | 'android';
      }
    } catch {}
    return 'web';
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  track(name: EventName, params?: Record<string, any>) {
    const event: AnalyticsEvent = {
      name,
      params,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId,
      platform: this.platform,
    };

    this.events.push(event);

    if (this.events.length >= this.maxQueueSize) {
      this.flush();
    }

    console.log('[Analytics]', event);
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  async flush() {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      });

      if (!response.ok) {
        throw new Error('Analytics request failed');
      }
    } catch (error) {
      console.error('[Analytics] Flush failed:', error);
      this.events = [...eventsToSend, ...this.events];
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const analytics = new Analytics();

export function trackEvent(name: EventName, params?: Record<string, any>) {
  analytics.track(name, params);
}