/**
 * OpenBot Security Suite 🛡️
 * Zero-Cloud egress guard + AES-256-GCM BYOK key vault.
 */

export {
  ZeroCloudGuard,
  ZeroCloudBlockedError,
  zeroCloudGuard,
  isLocalUrl,
  installGlobalFetchGuard,
  uninstallGlobalFetchGuard,
} from './zero-cloud.js';

export { KeyVault } from './key-vault.js';
export type { KeyVaultOptions } from './key-vault.js';
