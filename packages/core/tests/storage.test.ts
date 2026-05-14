import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChromaClient, createMinioClient } from '../src/storage/index.js';

vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    heartbeat: vi.fn().mockResolvedValue({ 'nanosecond heartbeat': 1 }),
    getOrCreateCollection: vi.fn().mockResolvedValue({ name: 'lexia_corpus' }),
  })),
}));

vi.mock('minio', () => ({
  Client: vi.fn().mockImplementation(() => ({
    bucketExists: vi.fn().mockResolvedValue(false),
    makeBucket: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('createChromaClient', () => {
  it('creates a ChromaClient with default URL', () => {
    const client = createChromaClient();
    expect(client).toBeDefined();
  });

  it('creates a ChromaClient with custom URL', () => {
    const client = createChromaClient({ path: 'http://custom:8000' });
    expect(client).toBeDefined();
  });
});

describe('createMinioClient', () => {
  it('creates a MinioClient with default config', () => {
    const client = createMinioClient();
    expect(client).toBeDefined();
  });
});
