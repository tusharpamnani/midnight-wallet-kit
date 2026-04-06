/**
 * Safe browser detection that works in Node.js, Next.js (Server/Client),
 * and standard browser environments.
 */
export const isBrowser = typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined';
