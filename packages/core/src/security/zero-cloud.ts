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
 */

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

/** Hostnames that always count as local. */
const LOCAL_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function inRange(ipInt: number, base: string, prefixBits: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = prefixBits === 0 ? 0 : (0xffffffff << (32 - prefixBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * Decide whether a URL points at a local target (this machine or the user's
 * own LAN). Non-HTTP(S) schemes (data:, file:, ws: to local, etc.) are
 * treated by scheme: only http/https/ws/wss are network egress; other
 * schemes never leave the machine via fetch and are allowed.
 */
export function isLocalUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    return true; // data:, blob:, file: — no network egress
  }

  const host = url.hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.home')) return true;
  if (host === '::1' || host.startsWith('fe80:')) return true; // IPv6 loopback / link-local

  const ipInt = ipv4ToInt(host);
  if (ipInt !== null) {
    return (
      inRange(ipInt, '127.0.0.0', 8) || // loopback
      inRange(ipInt, '10.0.0.0', 8) || // RFC-1918
      inRange(ipInt, '172.16.0.0', 12) || // RFC-1918
      inRange(ipInt, '192.168.0.0', 16) || // RFC-1918
      inRange(ipInt, '169.254.0.0', 16) // link-local
    );
  }

  return false;
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
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    this.assertAllowed(url);
    return fetch(input as RequestInfo, init);
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
  const base = originalFetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    zeroCloudGuard.assertAllowed(url);
    return base(input as RequestInfo, init);
  }) as typeof fetch;
  return uninstallGlobalFetchGuard;
}

export function uninstallGlobalFetchGuard(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}
