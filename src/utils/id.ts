/**
 * crypto.randomUUID() is only available in secure contexts (HTTPS / localhost),
 * so phones browsing via http://192.168.x.x need a fallback.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
