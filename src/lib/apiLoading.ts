const SHOW_DELAY_MS = 200;

let inFlight = 0;
let visible = false;
let showTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  notify();
}

function begin() {
  inFlight += 1;
  if (inFlight === 1) {
    showTimer = setTimeout(() => {
      if (inFlight > 0) setVisible(true);
    }, SHOW_DELAY_MS);
  }
}

function end() {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    setVisible(false);
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Skip background auth token refresh — not user-facing work. */
function shouldTrackRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = requestUrl(input);
  if (!url.includes('/auth/v1/token')) return true;

  const body = init?.body;
  if (typeof body === 'string') return !body.includes('refresh_token');
  if (body instanceof URLSearchParams) return body.get('grant_type') !== 'refresh_token';
  return true;
}

export function isApiLoadingVisible(): boolean {
  return visible;
}

export function subscribeApiLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!shouldTrackRequest(input, init)) {
    return fetch(input, init);
  }

  begin();
  return fetch(input, init).finally(end);
}
