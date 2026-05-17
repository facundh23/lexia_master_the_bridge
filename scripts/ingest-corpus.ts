#!/usr/bin/env tsx
/**
 * One-shot corpus ingestion script.
 * Run: tsx scripts/ingest-corpus.ts
 * Requires: CHROMA_URL (default http://localhost:8000) and OPENAI_API_KEY env vars
 */
import 'dotenv/config';
import { createChromaClient, ensureCollection } from '../packages/core/src/storage/chroma.js';
import { createEmbeddingClient } from '../packages/core/src/rag/embed.js';
import { ingestChunks } from '../packages/core/src/rag/ingest.js';
import { SEED_CHUNKS } from '../packages/core/src/verticals/nacionalidad_residencia/corpus/seed.js';

async function main() {
  console.log('🔄 Iniciando ingestión de corpus...');

  const chroma = createChromaClient();
  const embeddings = createEmbeddingClient();

  await ensureCollection(chroma);
  console.log('✅ Colección lexia_corpus lista');

  console.log(`📚 Ingiriendo ${SEED_CHUNKS.length} chunks...`);
  await ingestChunks(chroma, embeddings, SEED_CHUNKS);

  console.log('✅ Corpus ingerido correctamente.');
  console.log('   Chunks indexados:');
  for (const chunk of SEED_CHUNKS) {
    console.log(`   - [${chunk.sourceType}] ${chunk.id}`);
  }
}

main().catch((err) => {
  console.error('❌ Error durante ingestión:', err);
  process.exit(1);
});
