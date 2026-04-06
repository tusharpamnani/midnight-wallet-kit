import type { Middleware } from '../core/manager.js';

/**
 * A built-in middleware for logging wallet kit operations to the console.
 * 
 * Provides detailed timing and payload inspection for:
 * - Connection attempts
 * - Disconnections
 * - Intent signing
 * - Message signing
 */
export function consoleLogger(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    const { operation, adapterName } = ctx;
    
    console.group(`[WalletKit] Operation: ${operation} (${adapterName || 'No Adapter'})`);
    
    if (ctx.intent) console.log('Intent:', ctx.intent);
    if (ctx.message) console.log('Message:', ctx.message);

    try {
      await next();
      const duration = Date.now() - start;
      
      console.log('Result:', ctx.result);
      console.log(`Success! Taken: ${duration}ms`);
    } catch (err) {
      const duration = Date.now() - start;
      console.error(`Failed after ${duration}ms:`, err);
      throw err;
    } finally {
      console.groupEnd();
    }
  };
}
