/**
 * midnight-wallet-kit — basic usage example
 *
 * Run with:  npm run build && node dist/examples/basic-usage.js
 */
import {
  WalletManager,
  InjectedWalletAdapter,
  SeedWalletAdapter,
  MockWalletAdapter,
  IntentBuilder,
} from '../src/index.js';

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   midnight-wallet-kit  —  basic usage    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ── 1. Create the manager and register adapters ───────────────────────────

  const manager = new WalletManager();

  // In a browser you'd use InjectedWalletAdapter — here we register all three
  // to demonstrate the fallback mechanism.
  manager
    .register(new InjectedWalletAdapter())
    .register(new SeedWalletAdapter('correct horse battery staple banana planet'))
    .register(new MockWalletAdapter());

  // Listen for events
  manager.on('onConnect', (wallet) =>
    console.log(`  ✓ Event: onConnect → ${wallet.name}`),
  );
  manager.on('onDisconnect', (name) =>
    console.log(`  ✓ Event: onDisconnect → ${name}`),
  );
  manager.on('onError', (err) =>
    console.log(`  ✗ Event: onError → ${err.message}`),
  );
  manager.on('onStateChange', (state) =>
    console.log(`  ⟳ State: ${state}`),
  );

  // ── 2. Connect with fallback ──────────────────────────────────────────────

  console.log('\n── Connecting (Injected → Seed → Mock) ──');

  // Injected will fail (no browser), Seed will succeed.
  await manager.connectWithFallback(['injected', 'seed', 'mock']);

  const wallet = manager.getActiveWallet();
  console.log(`\n  Connected wallet : ${wallet.name}`);
  console.log(`  Address          : ${wallet.getAddress()}`);
  console.log(`  isConnected()    : ${wallet.isConnected()}`);

  // ── 3. Build a safe intent ────────────────────────────────────────────────

  console.log('\n── Building intent ──');

  const intent = IntentBuilder.create({
    contract: '0xe5ef84eb9e72532120f5530a13257b8d16ed9726333aa1af767dfbf2091e5fb0',
    action: 'mint',
    params: {
      tokenId: 42,
      recipient: wallet.getAddress(),
      metadata: {
        name: 'Midnight Warrior #42',
        rarity: 'legendary',
        attributes: [
          { trait: 'power', value: 99 },
          { trait: 'speed', value: undefined }, // intentionally broken — will be sanitized
        ],
      },
    },
  });

  console.log('  Intent:', JSON.stringify(intent, null, 4));

  // ── 4. Sign the intent ────────────────────────────────────────────────────

  console.log('\n── Signing intent ──');

  const signed = await wallet.signIntent(intent);
  console.log('  Signature :', signed.signature.slice(0, 32) + '…');
  console.log('  Public key:', signed.publicKey.slice(0, 32) + '…');
  console.log('  Timestamp :', new Date(signed.timestamp).toISOString());

  // ── 5. Disconnect ─────────────────────────────────────────────────────────

  console.log('\n── Disconnecting ──');
  await manager.disconnect();
  console.log(`  isConnected(): ${manager.isConnected()}`);
  console.log(`  State        : ${manager.getConnectionState()}`);

  // ── 6. Demonstrate error handling ─────────────────────────────────────────

  console.log('\n── Error handling ──');

  try {
    manager.getActiveWallet(); // Should throw
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log(`  Correctly threw: ${err.constructor.name}: ${err.message}`);
    }
  }

  try {
    IntentBuilder.create({ contract: '', action: '', params: {} });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log(`  Correctly threw: ${err.constructor.name}`);
    }
  }

  console.log('\n✅ All operations completed successfully.');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
