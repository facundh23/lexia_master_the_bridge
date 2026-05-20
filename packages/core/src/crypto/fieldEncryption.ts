import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SCRYPT_SALT = 'lexia-pii-v1';

function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, SCRYPT_SALT, 32);
}

export function encryptField(plaintext: string, passphrase: string): string {
  const key = deriveKey(passphrase);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptField(ciphertext: string, passphrase: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format');

  const [ivHex, tagHex, encHex] = parts as [string, string, string];
  const key = deriveKey(passphrase);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return (
    parts.length === 3 &&
    (parts[0]?.length ?? 0) === IV_BYTES * 2 &&
    (parts[1]?.length ?? 0) === TAG_BYTES * 2
  );
}
