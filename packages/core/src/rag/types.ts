export type SourceType =
  | 'BOE'
  | 'codigo_civil'
  | 'instruccion_dgrn'
  | 'manual_ccse'
  | 'user_upload';

export interface CorpusChunk {
  id: string;
  text: string;
  vertical: string;
  visibility: 'public' | 'private';
  userId?: string;
  caseId?: string;
  sourceType: SourceType;
  sourceUrl?: string;
  documentId?: string;
  chunkIdx: number;
  chunkHash: string;
  publishedDate?: string;
}

export interface RetrieveOptions {
  userId: string;
  vertical: string;
  nResults?: number;
  includePrivate?: boolean;
}

export interface RetrievedChunk {
  chunk: CorpusChunk;
  distance: number;
  rerankScore?: number;
}
