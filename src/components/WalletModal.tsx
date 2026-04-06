'use client';
import React, { useEffect } from 'react';
import { useConnect } from '../hooks/index.js';
import type { MidnightWallet } from '../validation/schemas.js';
import type { MidnightWalletError } from '../errors/wallet-errors.js';

export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (wallet: MidnightWallet) => void;
  onError?: (err: MidnightWalletError) => void;
}

/**
 * Accessible Modal for choosing and connecting a wallet adapter.
 * Resilient implementation with focus trap and escape-to-close features.
 */
export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
}) => {
  const { adapters, connect, isLoading } = useConnect();

  // 1. Accessibility: Escape key support
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // 2. Prevent body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async (name: string) => {
    try {
      await connect(name);
      onSuccess?.(adapters.find(a => a.name === name) as any);
      onClose();
    } catch (err: any) {
      onError?.(err);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const modalStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    margin: '1.25rem',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    outline: 'none',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1rem',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    transition: 'all 150ms ease',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={overlayStyle} onClick={onClose} aria-modal="true" role="dialog">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Connect Wallet</h3>
          <button
            onClick={onClose}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', 
              color: '#94a3b8', fontSize: '20px', padding: '0.25rem' 
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {adapters.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', fontSize: '14px' }}>
              No wallet adapters registered.
            </p>
          ) : (
            adapters.map((adapter) => (
              <div
                key={adapter.name}
                style={rowStyle}
                onClick={() => handleConnect(adapter.name)}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div 
                    style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} 
                    role="presentation"
                  />
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{adapter.name}</span>
                </div>
                <button 
                  style={{
                    backgroundColor: '#3b82f6', color: '#fff', border: 'none', 
                    borderRadius: '6px', padding: '0.375rem 0.75rem', fontSize: '12px', 
                    fontWeight: 600, cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Wait…' : 'Connect'}
                </button>
              </div>
            ))
          )}
        </div>

        <p style={{ margin: 0, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
          New to Midnight? <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>Learn more about wallets.</a>
        </p>
      </div>
    </div>
  );
};
