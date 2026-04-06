import type { Middleware } from '../core/manager.js';
import { isBrowser } from '../utils/env.js';

/**
 * A built-in middleware for emitting operations as DOM CustomEvents on window.
 * 
 * This is particularly useful for:
 * - Integrating with browser devtools
 * - Tracking kit usage from outside the React component tree
 * - Event-based monitoring across the entire tab
 */
export function eventEmitter(): Middleware {
  return async (ctx, next) => {
    if (!isBrowser) {
      await next();
      return;
    }

    const { operation, adapterName } = ctx;
    
    // Notify window that an operation has started
    window.dispatchEvent(new CustomEvent('mwk:operation:start', {
      detail: { operation, adapterName, intent: ctx.intent, message: ctx.message }
    }));

    try {
      await next();
      
      // Notify window of success
      window.dispatchEvent(new CustomEvent('mwk:operation:success', {
        detail: { operation, adapterName, result: ctx.result }
      }));
    } catch (err) {
      // Notify window of failure
      window.dispatchEvent(new CustomEvent('mwk:operation:error', {
        detail: { 
          operation, 
          adapterName, 
          error: err instanceof Error ? err.message : String(err),
          code: (err as any).code || 'UNKNOWN_ERROR'
        }
      }));
      throw err;
    }
  };
}
