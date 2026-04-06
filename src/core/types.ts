import type { MidnightWallet, ServiceUriConfig } from '../validation/schemas.js';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'restoring'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

export interface WalletAdapterEvents {
  onConnect: (wallet: MidnightWallet) => void;
  onDisconnect: (walletName: string) => void;
  onError: (error: Error) => void;
  onStateChange: (state: ConnectionState) => void;
  onNetworkChange: (newUris: ServiceUriConfig, previousUris: ServiceUriConfig) => void;
}
