#!/usr/bin/env tsx
/**
 * Preflight de verticales para CI: falla si algún manifest no pasa sus checks.
 * Run: pnpm exec tsx scripts/preflight-check.ts
 */
import { runPreflight } from '../packages/core/src/vertical/preflight.js';

const result = runPreflight();
if (!result.ok) {
  console.error('Preflight FAILED:', JSON.stringify(result.checks, null, 2));
  process.exit(1);
}
console.log('Preflight OK:', result.checks.length, 'checks passed');
