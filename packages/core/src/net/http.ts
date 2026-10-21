/**
 * Shared HTTP transport layer 🌐
 *
 * Every outbound fetch in @openbot/core goes through here so that two
 * properties hold everywhere, deterministically, on any machine:
 *
 * 1. PROXY-AWARENESS — when HTTP_PROXY / HTTPS_PROXY (or the lowercase /
 *    ALL_PROXY variants) are set, remote requests are dispatched through
 *    that proxy via an explicit undici ProxyAgent instead of relying on
 *    runtime flags (e.g. NODE_USE_ENV_PROXY) that may or may not be set.
 *    Local targets (loopback, RFC-1918 LAN, *.local) and NO_PROXY matches
 *    always go direct through an explicit Agent — never through the proxy.
 *
 * 2. BOUNDED CONNECTS — the direct Agent caps the connect phase at 5s, so
 *    a blackholed route (SYN dropped, dead proxy, unroutable host) fails
 *    in seconds instead of hanging until an OS-level timeout. Callers add
 *    a whole-request AbortSignal on top for a total bound.
 *
 * `isLocalUrl` also lives here: it is the single definition of "local"
 * shared by this transport layer (proxy bypass) and the Zero-Cloud guard
 * (security/zero-cloud.ts re-exports it).
 */

import { Agent, ProxyAgent, fetch as undiciFetch, type Dispatcher } from 'undici';

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

/** Connect-phase cap for direct (non-proxied) requests. */
export const DIRECT_CONNECT_TIMEOUT_MS = 5000;

let sharedDirectAgent: Agent | undefined;
const proxyAgents = new Map<string, ProxyAgent>();

function directDispatcher(): Agent {
  if (!sharedDirectAgent) {
    sharedDirectAgent = new Agent({ connect: { timeout: DIRECT_CONNECT_TIMEOUT_MS } });
  }
  return sharedDirectAgent;
}

function proxyDispatcher(proxyUrl: string): ProxyAgent {
  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    agent = new ProxyAgent({ uri: proxyUrl });
    proxyAgents.set(proxyUrl, agent);
  }
  return agent;
}

function proxyUrlForProtocol(protocol: string): string | undefined {
  const env = process.env;
  if (protocol === 'https:') {
    return env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy || undefined;
  }
  return env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy || undefined;
}

/** Standard NO_PROXY matching: comma list, optional leading dot / "*.", optional :port, "*" wildcard. */
function noProxyMatches(url: URL): boolean {
  const raw = process.env.NO_PROXY || process.env.no_proxy || '';
  if (!raw.trim()) return false;
  const host = url.hostname.toLowerCase();
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  for (const entryRaw of raw.split(',')) {
    const entry = entryRaw.trim().toLowerCase();
    if (!entry) continue;
    if (entry === '*') return true;
    let patternHost = entry.replace(/^\*\./, '.');
    let patternPort = '';
    const colon = patternHost.lastIndexOf(':');
    if (colon > 0 && /^\d+$/.test(patternHost.slice(colon + 1))) {
      patternPort = patternHost.slice(colon + 1);
      patternHost = patternHost.slice(0, colon);
    }
    if (patternPort && patternPort !== port) continue;
    if (patternHost.startsWith('.')) {
      if (host === patternHost.slice(1) || host.endsWith(patternHost)) return true;
    } else if (host === patternHost) {
      return true;
    }
  }
  return false;
}

/**
 * Pick the undici dispatcher for a URL: explicit direct Agent for local /
 * NO_PROXY targets, a cached ProxyAgent when a proxy is configured for the
 * scheme, otherwise the direct Agent (with its bounded connect timeout).
 * The dispatcher is returned explicitly on every request so behavior never
 * depends on process-global fetch configuration.
 */
export function dispatcherForUrl(rawUrl: string): Dispatcher {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return directDispatcher();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return directDispatcher();
  if (isLocalUrl(url.href) || noProxyMatches(url)) return directDispatcher();
  const proxy = proxyUrlForProtocol(url.protocol);
  return proxy ? proxyDispatcher(proxy) : directDispatcher();
}

/**
 * fetch() with the correct dispatcher for the target URL injected.
 * Response is the standard fetch Response (undici's implementation, which
 * is what Node's global fetch itself uses). A `Request` input is
 * reconstructed (method/headers/body preserved) so callers that pass one
 * keep their semantics.
 */
export async function proxiedFetch(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  let rawUrl: string;
  let effectiveInit: Record<string, unknown> = { ...(init as Record<string, unknown>) };
  if (typeof input === 'string') {
    rawUrl = input;
  } else if (input instanceof URL) {
    rawUrl = input.href;
  } else {
    rawUrl = input.url;
    effectiveInit = {
      method: input.method,
      headers: input.headers,
      ...effectiveInit,
    };
    if (effectiveInit.body === undefined && input.body) {
      effectiveInit.body = input.body;
      effectiveInit.duplex = 'half';
    }
  }
  const dispatcher = dispatcherForUrl(rawUrl);
  const response = await undiciFetch(rawUrl, {
    ...effectiveInit,
    dispatcher,
  } as Parameters<typeof undiciFetch>[1]);
  return response as unknown as Response;
}

/**
 * Run a fetch whose CONNECT + RESPONSE-HEADERS phase is bounded by
 * `timeoutMs`, then hand back the live response with the timer cleared —
 * so streaming bodies (large downloads, streamed chat) are not capped by
 * the header timeout. If the deadline fires first, the returned promise
 * rejects with a clear timeout error instead of hanging.
 */
export async function fetchWithHeaderTimeout(
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`${label}: no response headers within ${timeoutMs}ms`));
  }, timeoutMs);
  // Do not let this timer keep a CLI process alive on its own.
  if (typeof timer.unref === 'function') timer.unref();
  try {
    return await proxiedFetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
