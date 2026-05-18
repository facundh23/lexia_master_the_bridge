import { getEnabledVerticals } from './registry.js';

export interface PreflightResult {
  ok: boolean;
  checks: Array<{ vertical: string; check: string; passed: boolean; detail?: string }>;
}

export function runPreflight(): PreflightResult {
  const verticals = getEnabledVerticals();
  const checks: PreflightResult['checks'] = [];

  for (const v of verticals) {
    checks.push({
      vertical: v.slug,
      check: 'slug_valid',
      passed: /^[a-z_]+$/.test(v.slug) && v.slug.length > 0,
    });

    checks.push({
      vertical: v.slug,
      check: 'corpus_namespace_present',
      passed: typeof v.corpus.namespace === 'string' && v.corpus.namespace.length > 0,
    });

    checks.push({
      vertical: v.slug,
      check: 'intake_fields_defined',
      passed: Array.isArray(v.intake.fields),
    });
  }

  const ok = checks.every((c) => c.passed);
  return { ok, checks };
}
