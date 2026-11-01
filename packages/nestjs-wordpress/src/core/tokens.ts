/**
 * Injection tokens of the source-agnostic core.
 *
 * Symbols (instead of classes) are used for contracts that have no single implementation:
 * `CONTENT_SOURCE` is bound by an adapter module (WordPress today, others later), so code
 * that depends on it never imports the adapter.
 */
export const CONTENT_SOURCE = Symbol('CONTENT_SOURCE');
