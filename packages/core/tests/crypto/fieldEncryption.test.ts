import { describe, it, expect } from 'vitest';
import { encryptField, decryptField, isEncrypted } from '../../src/crypto/fieldEncryption.js';

const PASS = 'test-passphrase-32-chars-minimum!!';

describe('fieldEncryption', () => {
  it('encripta en formato iv:tag:ciphertext', () => {
    const enc = encryptField('Argentina', PASS);
    expect(enc).not.toBe('Argentina');
    expect(enc.split(':')).toHaveLength(3);
  });

  it('descifra al valor original', () => {
    const enc = encryptField('Argentina', PASS);
    expect(decryptField(enc, PASS)).toBe('Argentina');
  });

  it('produce ciphertext diferente en cada llamada (IV aleatorio)', () => {
    const e1 = encryptField('Argentina', PASS);
    const e2 = encryptField('Argentina', PASS);
    expect(e1).not.toBe(e2);
    expect(decryptField(e1, PASS)).toBe('Argentina');
    expect(decryptField(e2, PASS)).toBe('Argentina');
  });

  it('isEncrypted detecta valores cifrados vs plaintext', () => {
    expect(isEncrypted(encryptField('test', PASS))).toBe(true);
    expect(isEncrypted('Argentina')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('lanza error si el ciphertext fue manipulado', () => {
    const enc = encryptField('test', PASS);
    const parts = enc.split(':');
    parts[2] = 'deadbeefdeadbeef';
    expect(() => decryptField(parts.join(':'), PASS)).toThrow();
  });

  it('cifra y descifra cadenas con caracteres especiales', () => {
    const value = 'Bolivia — notas con acentos: ñoño';
    expect(decryptField(encryptField(value, PASS), PASS)).toBe(value);
  });
});
