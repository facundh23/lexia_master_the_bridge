import { describe, it, expect, afterEach, vi } from 'vitest';
import { encryptPII } from '../src/routes/cases.js';

describe('encryptPII — fail-closed en producción', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lanza si falta PII_ENCRYPTION_KEY en producción', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PII_ENCRYPTION_KEY', '');
    expect(() => encryptPII('Argentina')).toThrow('PII_ENCRYPTION_KEY');
  });

  it('cifra normalmente en producción si la key está presente', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PII_ENCRYPTION_KEY', 'a-valid-test-key-for-production-use');
    const result = encryptPII('Argentina');
    expect(result).not.toBe('Argentina');
    expect(result?.split(':')).toHaveLength(3);
  });

  it('devuelve texto plano con warning fuera de producción si falta la key', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('PII_ENCRYPTION_KEY', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(encryptPII('Argentina')).toBe('Argentina');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('undefined/null devuelven null; string vacío se devuelve tal cual (comportamiento preexistente sin cambios)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PII_ENCRYPTION_KEY', '');
    expect(encryptPII(undefined)).toBeNull();
    expect(encryptPII(null)).toBeNull();
    expect(encryptPII('')).toBe('');
  });
});
