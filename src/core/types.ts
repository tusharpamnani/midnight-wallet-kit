import type { MidnightWallet } from '../validation/schemas.js';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

export interface WalletAdapterEvents {
  onConnect: (wallet: MidnightWallet) => void;
  onDisconnect: (walletName: string) => void;
  onError: (error: Error) => void;
  onStateChange: (state: ConnectionState) => void;
}
