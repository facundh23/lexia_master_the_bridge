import { createHash } from 'crypto';

export function splitIntoChunks(
  text: string,
  chunkSize = 500,
  overlap = 50,
): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const tail = current.slice(-overlap);
      current = tail ? `${tail}\n\n${para}` : para;
    } else {
      current = candidate;
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

export function hashChunk(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
