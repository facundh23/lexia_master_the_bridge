import { describe, it, expect } from 'vitest';
import { splitIntoChunks, hashChunk } from '../../src/rag/chunk.js';

describe('splitIntoChunks', () => {
  it('returns single chunk when text is short', () => {
    const chunks = splitIntoChunks('Texto corto.', 500, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Texto corto.');
  });

  it('splits long text at paragraph boundaries', () => {
    const longText = Array.from({ length: 10 }, (_, i) => `Párrafo ${i + 1} con contenido.`).join(
      '\n\n',
    );
    const chunks = splitIntoChunks(longText, 100, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('all content is preserved across chunks (no content lost)', () => {
    const source =
      'Artículo 22.\n\nEl tiempo de residencia es de 10 años.\n\nSe reduce a 5 años para refugiados.';
    const chunks = splitIntoChunks(source, 60, 10);
    const joined = chunks.join(' ');
    expect(joined).toContain('Artículo 22');
    expect(joined).toContain('10 años');
    expect(joined).toContain('refugiados');
  });

  it('filters empty paragraphs', () => {
    const chunks = splitIntoChunks('A\n\n\n\nB', 500, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('A');
    expect(chunks[0]).toContain('B');
  });
});

describe('hashChunk', () => {
  it('returns 16-char hex string', () => {
    expect(hashChunk('texto')).toHaveLength(16);
    expect(hashChunk('texto')).toMatch(/^[a-f0-9]+$/);
  });

  it('same input → same hash', () => {
    expect(hashChunk('test')).toBe(hashChunk('test'));
  });

  it('different inputs → different hashes', () => {
    expect(hashChunk('a')).not.toBe(hashChunk('b'));
  });
});
