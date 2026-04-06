'use client';
import React, { useState } from 'react';
import { useWallet, useConnect } from '../hooks/index.js';
import { WalletModal } from './WalletModal.js';
import type { MidnightWallet } from '../validation/schemas.js';
import type { MidnightWalletError } from '../errors/wallet-errors.js';

export interface ConnectButtonProps {
  /** The text displayed when disconnected (default: 'Connect Wallet') */
  label?: string;
  /** Same as label if omitted */
  disconnectedLabel?: string;
  /** Explicit connection success callback */
  onConnectSuccess?: (wallet: MidnightWallet) => void;
  /** Explicit error callback */
  onConnectError?: (error: MidnightWalletError) => void;
  /** Custom label when connected, or text resolver (default: truncated address) */
  connectedLabel?: string | ((address: string) => string);
  /** Optional tailwind or CSS-in-JS class */
  className?: string;
  /** Optional inline style override */
  style?: React.CSSProperties;
}

/**
 * Headless-ready ConnectButton with minimal high-quality styles.
 * Clicking naturally alternates between 'Connect' (opens modal) 
 * and 'Disconnect' (triggers manager.disconnect).
 */
export const ConnectButton: React.FC<ConnectButtonProps> = ({
  label = 'Connect Wallet',
  disconnectedLabel,
  connectedLabel,
  onConnectSuccess,
  onConnectError,
  className,
  style,
}) => {
  const { isConnected, address, wallet, connectionState } = useWallet();
  const { disconnect, isLoading } = useConnect();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayConnected = (addr: string): string => {
    if (typeof connectedLabel === 'function') return connectedLabel(addr);
    if (typeof connectedLabel === 'string') return connectedLabel;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  const handleAction = async () => {
    if (isConnected) {
      await disconnect();
    } else {
      setIsModalOpen(true);
    }
  };

  // Pure CSS styled button components as variables to keep it zero-dep
  const defaultStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.625rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: isConnected ? '#ef4444' : '#1e1b4b',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: isLoading ? 'wait' : 'pointer',
    transition: 'all 200ms ease',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    appearance: 'none',
    opacity: isLoading ? 0.7 : 1,
    ...style,
  };

  return (
    <>
      <button
        className={className}
        style={defaultStyles}
        onClick={handleAction}
        disabled={isLoading || connectionState === 'restoring'}
      >
        {isLoading && (
          <svg
            style={{ marginRight: 8, animation: 'spin 1s linear infinite' }}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </svg>
        )}
        {address ? displayConnected(address) : (disconnectedLabel || label)}
      </button>

      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(w: MidnightWallet) => {
          setIsModalOpen(false);
          onConnectSuccess?.(w);
        }}
        onError={onConnectError}
      />
    </>
  );
};
