import { useEffect, useRef } from 'react';

export interface RealtimeMessage {
  type: string;
  payload?: unknown;
  version?: number;
  timestamp?: string;
}

type RealtimeListener = (msg: RealtimeMessage) => void;

const listeners = new Set<RealtimeListener>();
let ws: WebSocket | null = null;
let sse: EventSource | null = null;
let reconnectTimer: number | undefined;
let pollTimer: number | undefined;
let wsFailureCount = 0;
let lastKnownVersion = 0;
let isStarted = false;
let hasOpenedWsOnce = false;

function dispatch(msg: RealtimeMessage) {
  if (typeof msg.version === 'number' && msg.version > lastKnownVersion) {
    lastKnownVersion = msg.version;
  }
  for (const listener of listeners) {
    try {
      listener(msg);
    } catch {
      // isolate listener errors
    }
  }
}

function stopFallbackPolling() {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

function startFallbackPolling() {
  if (pollTimer !== undefined) return;
  pollTimer = window.setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      stopFallbackPolling();
      return;
    }
    try {
      const res = await fetch('/api/hotel/sync-version', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: number };
      if (typeof data.version === 'number') {
        if (lastKnownVersion !== 0 && data.version !== lastKnownVersion) {
          lastKnownVersion = data.version;
          dispatch({ type: 'sync:refresh', version: data.version });
        } else {
          lastKnownVersion = data.version;
        }
      }
    } catch {
      // ignore transient network glitches
    }
  }, 12000);
}

function connectSSE() {
  if (sse || typeof EventSource === 'undefined') {
    startFallbackPolling();
    return;
  }
  try {
    sse = new EventSource('/api/events');
    sse.onopen = () => {
      dispatch({ type: 'sync:refresh' });
    };
    sse.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as RealtimeMessage;
        if (msg?.type) {
          dispatch(msg);
        }
      } catch {
        // ignore malformed event
      }
    };
    sse.onerror = () => {
      sse?.close();
      sse = null;
      startFallbackPolling();
    };
  } catch {
    startFallbackPolling();
  }
}

function connectWebSocket() {
  if (typeof window === 'undefined' || ws) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  } catch {
    connectSSE();
    return;
  }

  let openedThisAttempt = false;

  ws.onopen = () => {
    openedThisAttempt = true;
    const wasReconnect = hasOpenedWsOnce;
    hasOpenedWsOnce = true;
    wsFailureCount = 0;
    stopFallbackPolling();
    if (sse) {
      sse.close();
      sse = null;
    }
    if (wasReconnect) {
      dispatch({ type: 'sync:refresh' });
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as RealtimeMessage;
      if (msg?.type) {
        dispatch(msg);
      }
    } catch {
      // ignore malformed event
    }
  };

  ws.onclose = () => {
    ws = null;
    if (listeners.size === 0) return;

    if (!openedThisAttempt && !hasOpenedWsOnce) {
      wsFailureCount += 1;
      if (wsFailureCount >= 2) {
        connectSSE();
        startFallbackPolling();
        return;
      }
    }

    const delay = Math.min(10000, 2000 + wsFailureCount * 1500);
    wsFailureCount += 1;
    reconnectTimer = window.setTimeout(() => {
      if (listeners.size > 0) {
        connectWebSocket();
      }
    }, delay);
  };
}

function handleVisibilityOrOnline() {
  if (document.visibilityState === 'hidden') return;
  if (!ws && !sse) {
    wsFailureCount = 0;
    connectWebSocket();
  }
  dispatch({ type: 'sync:refresh' });
}

function ensureStarted() {
  if (isStarted || typeof window === 'undefined') return;
  isStarted = true;
  connectWebSocket();
  window.addEventListener('online', handleVisibilityOrOnline);
  document.addEventListener('visibilitychange', handleVisibilityOrOnline);
}

function teardownIfIdle() {
  if (!isStarted || listeners.size > 0) return;
  isStarted = false;
  if (reconnectTimer !== undefined) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
  stopFallbackPolling();
  ws?.close();
  ws = null;
  sse?.close();
  sse = null;
  window.removeEventListener('online', handleVisibilityOrOnline);
  document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
}

export function useRealtimeEvents(onEvent: RealtimeListener) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const wrapped: RealtimeListener = (msg) => callbackRef.current(msg);
    listeners.add(wrapped);
    ensureStarted();
    return () => {
      listeners.delete(wrapped);
      teardownIfIdle();
    };
  }, []);
}
