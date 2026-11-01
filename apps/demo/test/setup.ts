// A fresh cache namespace per run: e2e tests must never read entries cached by a previous
// run (or by `pnpm dev`) from the shared Redis.
process.env.CACHE_NAMESPACE ??= `e2e-${Date.now()}`;
