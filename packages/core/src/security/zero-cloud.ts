/**
 * Zero-Cloud Egress Guard 🛡️
 *
 * When Zero-Cloud mode is enabled, every outbound HTTP/HTTPS request made by
 * OpenBot (model providers, tools, downloads) must resolve to a local target:
 * loopback, link-local, private LAN (RFC-1918), or a *.local hostname.
 * Anything else is blocked BEFORE any bytes leave the machine.
 *
 * Enforcement points:
 * - ModelRouter passes `guardedFetch` to every provider SDK client and
 *   rejects non-local providers outright while the mode is on.
 * - Tool handlers that fetch (read_url, web_search, model downloads, Twilio,
 *   TTS) call `guardedFetch` directly.
 * - `installGlobalFetchGuard()` optionally wraps globalThis.fetch so any
 *   other library traffic in the process is held to the same rule.
 *
 * All guarded traffic is dispatched through the shared transport layer
 * (net/http.ts): the guard decision is made first, and only then is the
 * request handed to the proxy-aware dispatcher.
 */

import { isLocalUrl, proxiedFetch } from '../net/http.js';

export { isLocalUrl };

export class ZeroCloudBlockedError extends Error {
  readonly url: string;
  constructor(url: string) {
    super(
      `Zero-Cloud mode is ON: outbound request to non-local host blocked (${url}). ` +
        `Only loopback / private-LAN / *.local targets are allowed.`
    );
    this.name = 'ZeroCloudBlockedError';
    this.url = url;
  }
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : (input as Request).url;
}

export class ZeroCloudGuard {
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Throw ZeroCloudBlockedError if the URL is not allowed right now. */
  assertAllowed(rawUrl: string): void {
    if (!this.enabled) return;
    if (!isLocalUrl(rawUrl)) {
      throw new ZeroCloudBlockedError(rawUrl);
    }
  }

  /** fetch() replacement that enforces the guard before delegating. */
  guardedFetch: typeof fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    this.assertAllowed(urlOf(input));
    return proxiedFetch(input as string | URL | Request, init);
  }) as typeof fetch;
}

/** Process-wide shared guard instance. */
export const zeroCloudGuard = new ZeroCloudGuard();

let originalFetch: typeof fetch | null = null;

/**
 * Wrap globalThis.fetch so ALL fetch traffic in this process (including
 * third-party SDKs that call the global fetch) is held to the guard.
 * Returns an uninstall function. Safe to call more than once.
 */
export function installGlobalFetchGuard(): () => void {
  if (originalFetch) return uninstallGlobalFetchGuard;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    zeroCloudGuard.assertAllowed(urlOf(input));
    return proxiedFetch(input as string | URL | Request, init);
  }) as typeof fetch;
  return uninstallGlobalFetchGuard;
}

export function uninstallGlobalFetchGuard(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}
