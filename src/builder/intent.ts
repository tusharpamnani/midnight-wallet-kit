import { type MidnightIntent, MidnightIntentSchema, type Network } from '../validation/schemas.js';
import { InvalidIntentError } from '../errors/wallet-errors.js';

export interface IntentParams {
  /** Contract address or identifier */
  contract: string;
  /** Action to invoke on the contract */
  action: string;
  /** Key-value params for the action (deeply sanitized before validation) */
  params?: Record<string, unknown>;
  /** Target network (default: 'preprod') */
  network?: Network;
  /** Explicit nonce — if omitted, uses Date.now() */
  nonce?: number;
}

// ── Nonce management ─────────────────────────────────────────────────────────

let lastNonce = 0;

/**
 * Returns a monotonically increasing nonce.
 * Guarantees uniqueness even if two intents are created in the same ms.
 */
function nextNonce(): number {
  const now = Date.now();
  lastNonce = now > lastNonce ? now : lastNonce + 1;
  return lastNonce;
}

// ── Deep sanitization ────────────────────────────────────────────────────────

const MAX_DEPTH = 20;

/**
 * Recursively walks an object tree and:
 * 1. Replaces `undefined` with explicit `null` (to surface issues rather than hiding them)
 * 2. Replaces `NaN` and `Infinity` with `null`
 * 3. Coerces values that would crash `.toString()` to safe representations
 * 4. Detects circular references
 * 5. Enforces a max depth to prevent stack overflows
 *
 * Returns a new object — never mutates the input.
 */
function deepSanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  // Depth guard
  if (depth > MAX_DEPTH) {
    return '[max depth exceeded]';
  }

  // Primitives
  if (value === undefined) return null;
  if (value === null) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null; // NaN, Infinity, -Infinity
    return value;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return `[${typeof value}]`;
  }

  // Objects (circular reference guard)
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => deepSanitize(item, depth + 1, seen));
    }

    // Date → ISO string
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    }

    // Plain objects
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = deepSanitize((value as Record<string, unknown>)[key], depth + 1, seen);
    }
    return result;
  }

  // Fallback: coerce to string safely
  try {
    return String(value);
  } catch {
    return '[unserializable]';
  }
}

// ── IntentBuilder ────────────────────────────────────────────────────────────

/**
 * Safe Intent Builder
 *
 * This is the critical safety layer between your application code and the
 * wallet signing flow. It guarantees:
 *
 * 1. Every field is validated against the Zod schema
 * 2. Params are deeply sanitized (no undefined, no circular refs, no NaN)
 * 3. A monotonically increasing nonce is assigned for replay protection
 * 4. Structured errors with full detail on what went wrong
 * 5. No `.toString()` of undefined — ever
 */
export class IntentBuilder {
  /**
   * Create a validated, sanitized MidnightIntent.
   * Throws InvalidIntentError with details on validation failure.
   */
  static create(params: IntentParams): MidnightIntent {
    // 1. Guard against completely broken input
    if (!params || typeof params !== 'object') {
      throw new InvalidIntentError(
        'IntentBuilder.create() requires an IntentParams object.',
      );
    }

    // 2. Deep sanitize the params object
    const sanitizedParams = (
      params.params !== undefined && params.params !== null
        ? deepSanitize(params.params)
        : {}
    ) as Record<string, unknown>;

    // 3. Build the intent candidate
    const candidate = {
      contract: typeof params.contract === 'string' ? params.contract : '',
      action: typeof params.action === 'string' ? params.action : '',
      params: sanitizedParams,
      nonce: typeof params.nonce === 'number' && Number.isFinite(params.nonce)
        ? params.nonce
        : nextNonce(),
      network: params.network ?? 'preprod',
    };

    // 4. Validate with Zod
    const result = MidnightIntentSchema.safeParse(candidate);

    if (!result.success) {
      const details = result.error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
          return `  • ${path}: ${issue.message}`;
        })
        .join('\n');

      throw new InvalidIntentError(
        `Validation failed:\n${details}`,
        result.error.issues,
      );
    }

    return result.data;
  }

  /**
   * Convenience: create + return as JSON-safe object (no class instances).
   */
  static createJSON(params: IntentParams): Record<string, unknown> {
    return JSON.parse(JSON.stringify(IntentBuilder.create(params))) as Record<string, unknown>;
  }
}
